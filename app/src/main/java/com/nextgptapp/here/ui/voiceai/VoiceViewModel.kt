package com.nextgptapp.here.ui.voiceai

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Bundle
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nextgptapp.here.components.AppLogger
import com.nextgptapp.here.components.Constants
import com.nextgptapp.here.components.ConversationType
import com.nextgptapp.here.components.CreditHelpers
import com.nextgptapp.here.data.model.ChatMessage
import com.nextgptapp.here.data.model.GPTMessage
import com.nextgptapp.here.data.model.GPTModel
import com.nextgptapp.here.data.model.GPTRequestParam
import com.nextgptapp.here.data.model.GPTRole
import com.nextgptapp.here.data.model.RecentChat
import com.nextgptapp.here.data.repository.ChatRepository
import com.nextgptapp.here.data.repository.FirebaseRepository
import com.nextgptapp.here.data.repository.MessageRepository
import com.nextgptapp.here.data.repository.PreferenceRepository
import com.nextgptapp.here.data.repository.RecentChatRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.Locale
import javax.inject.Inject

private const val TAG="VoiceViewModel"

@HiltViewModel
class VoiceViewModel @Inject constructor(
    @ApplicationContext val application: Context,
    private val chatRepository: ChatRepository,
    private val creditHelpers: CreditHelpers,
    private val messageRepository: MessageRepository,
    private val firebaseRepository: FirebaseRepository,
    private val preferenceRepository: PreferenceRepository,
    private val recentChatRepository: RecentChatRepository,
): ViewModel() {

    private val apiScope = CoroutineScope(Dispatchers.IO)
    private var apiJob: Job? = null
    val isCreditsPurchased get() = creditHelpers.isCreditsPurchased
    val creditsCount get() = creditHelpers.credits
    private val _minCreditsRequired = MutableStateFlow(1)
    val minCreditsRequired get() = _minCreditsRequired.asStateFlow()
    private val isAiProcessing = mutableStateOf(false)
    private var speechRecognizer: SpeechRecognizer? = null
    val isListening = mutableStateOf(false)
    val isActive = mutableStateOf(false)
    private val isSpeaking = mutableStateOf(false)
    private var tts: TextToSpeech? = null
    var conversationId:Long = -1
    private var utteranceId:Int? =0
    private var recentMessageId:Long = 0
    private var content =""
    private var utteranceCount:Int =0
    private var isHandleFromPartial=false
    private var contentCount =0
    val showNoCreditsBottomSheet = mutableStateOf(false)
    val statusText = mutableStateOf<StatusText>(StatusText.EMPTY)
    val voiceLanguage = mutableStateOf(Locale.getDefault())
    private val audioManager = application.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    private val coroutineExceptionHandler = CoroutineExceptionHandler{ _, throwable ->
        throwable.printStackTrace()
    }

    init {
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(application)

        speechRecognizer?.setRecognitionListener(object : android.speech.RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                AppLogger.logD("SpeechRecognizer", "Ready for speech")
            }

            override fun onBeginningOfSpeech() {
                AppLogger.logD("SpeechRecognizer", "Speech started")
            }

            override fun onRmsChanged(rmsdB: Float) {
                // Optionally, handle changes in the speech signal's volume
            }

            override fun onBufferReceived(buffer: ByteArray?) {}

            override fun onEndOfSpeech() {
                AppLogger.logD("SpeechRecognizer", "Speech ended")
            }

            override fun onError(error: Int) {
                AppLogger.logE("SpeechRecognizer", "Error occurred: $error")
                /* if (isListening) {
                     startListening()
                 }*/
                when (error) {
                    SpeechRecognizer.ERROR_AUDIO -> AppLogger.logE("SpeechRecognizer", "Audio error.")
                    SpeechRecognizer.ERROR_CLIENT -> AppLogger.logE("SpeechRecognizer", "Client error.")
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> AppLogger.logE("SpeechRecognizer", "Permission error.")
                    SpeechRecognizer.ERROR_NETWORK -> AppLogger.logE("SpeechRecognizer", "Network error.")
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> AppLogger.logE("SpeechRecognizer", "Network timeout.")
                    SpeechRecognizer.ERROR_NO_MATCH -> {
                        AppLogger.logE("SpeechRecognizer", "No match found.")
                        if (isAiProcessing.value.not() && isListening.value)
                        {
                            stopListening()
                            startListening()
                        }
                    }
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> AppLogger.logE("SpeechRecognizer", "Recognizer busy.")
                    SpeechRecognizer.ERROR_SERVER -> AppLogger.logE("SpeechRecognizer", "Server error.")
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> AppLogger.logE("SpeechRecognizer", "Speech timeout.")
                    SpeechRecognizer.ERROR_TOO_MANY_REQUESTS -> AppLogger.logE("SpeechRecognizer", "Too many requests.")
                    else -> AppLogger.logE("SpeechRecognizer", "Unknown error: $error")
                }
            }

            override fun onResults(results: Bundle?) {
                results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.forEach { result ->
                        AppLogger.logD("SpeechRecognizer", "Recognized text: $result")
                        isSpeaking.value = true
                        isActive.value = false
                        //speak(result)
                        _minCreditsRequired.value = getMinRequiredCredits(result)
                        if (isCreditsPurchased.value.not() && minCreditsRequired.value>creditsCount.value)
                        {
                            showNoCreditsBottomSheet.value = true
                            stopListening()
                            return
                        }
                        statusText.value=StatusText.SPEAKING
                        stopListening()

                        callChatApi(result)

                    }

                /*  if (isListening) {

                    viewModelScope.launch {
                        stopListening()
                        delay(50)
                        startListening()
                    }
                }*/

            }

            override fun onPartialResults(partialResults: Bundle?) {
                partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.forEach { result ->
                        isActive.value = true
                        AppLogger.logD("Partial", "Partial: $result")

                    }
            }

            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        tts = TextToSpeech(application, TextToSpeech.OnInitListener { status ->
            if (status == TextToSpeech.SUCCESS) {
                val croLocale = Locale("hr", "HR")
                val engLocale = Locale("en", "US")

                val croVoices = tts?.voices?.filter { it.locale == croLocale }
                val engVoices = tts?.voices?.filter { it.locale == engLocale }

                when {
                    !croVoices.isNullOrEmpty() -> {
                        tts?.language = croLocale
                        tts?.voice = croVoices.first()
                        AppLogger.logE("TTS_VOICE", "✅ Hrvatski glas: ${croVoices.first().name}")
                    }

                    !engVoices.isNullOrEmpty() -> {
                        tts?.language = engLocale
                        tts?.voice = engVoices.first()
                        AppLogger.logE("TTS_VOICE", "🔁 Nema HR glasa, koristi engleski: ${engVoices.first().name}")
                    }

                    else -> {
                        tts?.language = Locale.getDefault()
                        AppLogger.logE("TTS_VOICE", "❌ Nema ni HR ni EN glasa. Koristi default: ${tts?.language}")
                    }
                }

                // Fino podešavanje
                tts?.setPitch(1.1f)
                tts?.setSpeechRate(0.95f)
            } else {
                AppLogger.logE("TTS_VOICE", "🧨 TTS inicijalizacija nije uspjela. Status: $status")
            }
        })



        utteranceId = tts?.setOnUtteranceProgressListener(object :UtteranceProgressListener(){
            override fun onStart(p0: String?) {
                isActive.value = true
                AppLogger.logE(TAG,"Start tts")
            }

            override fun onDone(p0: String?) {
                utteranceCount--
                if(utteranceCount>0)
                    return
                isSpeaking.value = false
                isActive.value = false
                if (isAiProcessing.value.not())
                {
                    AppLogger.logE(TAG,"done tts")
                    viewModelScope.launch {
                        startListening() }
                }
                //startListening()
            }

            override fun onError(p0: String?) {
                utteranceCount--
                if(utteranceCount>0)
                    return
                isSpeaking.value = false
                isActive.value = false
                if (isAiProcessing.value.not())
                {
                    viewModelScope.launch {
                        startListening() }
                }

            }
        })

        if ( isCreditsPurchased.value)
        {
            _minCreditsRequired.value = -10000 //
        } else {
            _minCreditsRequired.value = getMinRequiredCredits("Text") // init with dummy
        }
    }

    fun setChatId(chatId:String){
        AppLogger.logE(TAG,"Set ConversationId...")
        conversationId = chatId.toLong()
    }

    fun startListening() {
        if (speechRecognizer != null && !isListening.value) {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                // putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000) // Adjust silence duration
                // putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 2000) // Adjust minimum input duration

            }
            speechRecognizer?.startListening(intent)
            statusText.value=StatusText.LISTENING
            isListening.value = true
        }
    }

    fun stopListening() {
        AppLogger.logE(TAG,"Stopped called")
        speechRecognizer?.stopListening()
        isListening.value = false

    }

    fun toggleListening(uiState:Boolean)
    {
        if (isListening.value==uiState)
            return

        if (isListening.value)
            stopListening()
        else
            startListening()
    }

    fun callChatApi(prompt:String)
    {
        AppLogger.logE(TAG,"OutconversationId:$conversationId")
        if (isAiProcessing.value)
        {
            return // call in progress
        }

        viewModelScope.launch(Dispatchers.Default) {
            if (conversationId< 1)
            {
                conversationId = recentChatRepository.addChat(RecentChat(title = prompt, type = ConversationType.TEXT.name))
                AppLogger.logE(TAG,"conversationId:$conversationId")
            }
            messageRepository.addMessage(ChatMessage(recentChatId = conversationId, role = GPTRole.USER.value, content = prompt, type = ConversationType.TEXT.name))
            recentMessageId=0
            val history = messageRepository.getMessages(conversationId,10)
            val reqMessages: MutableList<GPTMessage> = mutableListOf(
            )
            if (history.isNotEmpty()){
                history.reversed().forEach { obj->
                    reqMessages.add(GPTMessage(obj.content,GPTRole.values().first { it.value == obj.role }.value))
                }
            }

            val flow: Flow<String> = chatRepository.textCompletionsWithStreamGemini(
                scope = apiScope,
                GPTRequestParam(
                    messages = reqMessages.toList(),
                    model =  GPTModel.gpt35Turbo.model
                )
            )
            content = ""
            apiJob = apiScope.launch(coroutineExceptionHandler) {
                isAiProcessing.value = true
                utteranceCount = 0
                contentCount=0
                isHandleFromPartial=false
                flow.collect{
                    if(content.isEmpty())
                    {
                    }
                    content+=it
                    contentCount+=1
                    if (contentCount>=4)
                    {
                        val textToSend:String = if (contentCount==4) {
                            content
                        }else{
                            it
                        }

                        if (!content.contains("Failure!",true))
                        {
                            utteranceCount++
                            speak(textToSend)
                        }
                        isHandleFromPartial = true

                    }

                    if (recentMessageId>0)
                    {
                        messageRepository.updateContent(recentMessageId,content,"")
                    }else{
                        recentMessageId=messageRepository.addMessage(ChatMessage(recentChatId = conversationId, role = GPTRole.ASSISTANT.value, content = content, type = ConversationType.TEXT.name))
                    }
                }
                if (!content.contains("Failure!",true))
                {
                    if (isHandleFromPartial.not())
                    {
                        utteranceCount++
                        speak(content)
                    }

                    if ( isCreditsPurchased.value)
                    {
                        incrementGPT4Count()

                    }else
                    {
                        decreaseTextChatCredits("$prompt $content")
                    }
                }else{
                    statusText.value=StatusText.ERROR
                }
                isAiProcessing.value = false
                recentChatRepository.updateChat(RecentChat(id = conversationId, title = prompt,content = if (content.length<100) content else content.substring(0..99)))
            }
        }
    }

    private fun muteSystemSounds() {
        AppLogger.logE("VoiceViewModel", "muteSystemSounds() pozvana — preskočeno zbog sigurnosnih ograničenja.")
        // ⚠️ Android više ne dozvoljava mutiranje sistemskih streamova bez posebne dozvole.
        // Ako ti stvarno treba Do Not Disturb, moraš tražiti notification policy access.
    }


    private fun unmuteSystemSounds() {
        AppLogger.logE("VoiceViewModel", "unmuteSystemSounds() pozvana — preskočeno zbog sigurnosnih ograničenja.")
        // ⚠️ Android ne dopušta ponovno uključivanje sistemskog zvuka bez posebne dozvole.
    }


    fun speak(text: String) {
        val processedText = text // BEZ hintova, trust me bro
        Log.e("TTS_DEBUG", "📤 Tekst za slanje: $processedText")

        viewModelScope.launch(Dispatchers.IO) {
            try {
                Log.e("TTS_DEBUG", "🔧 Postavljam Retrofit")
                val retrofit = Retrofit.Builder()
                    .baseUrl("https://api.elevenlabs.io/")
                    .addConverterFactory(GsonConverterFactory.create())
                    .build()

                val ttsService = retrofit.create(ElevenTTSService::class.java)

                Log.e("TTS_DEBUG", "📡 Pozivam ElevenLabs API s voiceId=pNInz6obpgDQGcFmaJgB (Adam)")

                // Pošalji zahtjev s tekstom
                val response = ttsService.synthesize(
                    voiceId = "pNInz6obpgDQGcFmaJgB", // Adam (multilingual)
                    request = ElevenTTSRequest(
                        text = processedText,
                        modelId = "eleven_multilingual_v2" // Ovdje garantiramo višejezičnost
                    )
                )

                if (response.isSuccessful) {
                    Log.e("TTS_DEBUG", "✅ Uspješan odgovor! Parsiram bytes...")
                    response.body()?.bytes()?.let {
                        Log.e("TTS_DEBUG", "🎧 Audio veličina: ${it.size} bajtova")
                        withContext(Dispatchers.Main) {
                            Log.e("TTS_DEBUG", "▶️ Pokrećem TTSPlayer")
                            TTSPlayer.play(application, it)
                        }
                    } ?: Log.e("TTS_DEBUG", "⚠️ TTS response body je null!")
                } else {
                    AppLogger.logE("ElevenLabs", "❌ Neuspješan TTS odgovor: ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e("TTS_DEBUG", "💥 Greška u speak(): ${e.message}")
                e.printStackTrace()
            }
        }
    }




    private fun preprocessText(input: String): String {
        // Remove unwanted characters
        return input.replace(Regex("[^\\w\\s.,!?']"), "").trim()
    }

    fun stopSpeaking() {
        tts?.stop()
        audioManager.abandonAudioFocus { }
    }

    private fun release() {
        tts?.shutdown()
    }

    private fun incrementGPT4Count(){
        preferenceRepository.setGPT4DailyCount(preferenceRepository.getGPT4DailyCount()+1)
    }

    private fun decreaseTextChatCredits(wordsStr:String){
        viewModelScope.launch {
            firebaseRepository.decrementCredits(getCreditsCostForMessage(wordsStr))
        }
    }

    private fun getCreditsCostForMessage(input:String):Int {
        val words = input.split("\\s+".toRegex())
        val count = words.count()
        var credits = 1

        when (if (preferenceRepository.getGPTModel().contentEquals(GPTModel.gpt4.name)) GPTModel.gpt4 else GPTModel.gpt35Turbo){
            GPTModel.gpt4 -> {
                credits = count / Constants.MESSAGES_WORDS_GPT4
                if ((count % Constants.MESSAGES_WORDS_GPT4) > 0) {
                    credits += 1
                }
                credits *= Constants.CHAT_MESSAGE_GPT4_COST

            }
            GPTModel.gpt35Turbo -> {
                credits = count / Constants.WORDS_PER_MESSAGES
                if ((count % Constants.WORDS_PER_MESSAGES) > 0) {
                    credits += 1
                }
                credits *= Constants.CHAT_MESSAGE_COST

            }
            else -> {}
        }
        //Log.e("Credits ACT","Min Req:${credits} count:${count}")

        return credits
    }

    private fun getMinRequiredCredits(input:String):Int {
        val words = input.split("\\s+".toRegex())
        val count = words.count()
        var credits = 1

        when (if (preferenceRepository.getGPTModel().contentEquals(GPTModel.gpt4.name)) GPTModel.gpt4 else GPTModel.gpt35Turbo){
            GPTModel.gpt4 -> {
                credits = (count * 2) / Constants.MESSAGES_WORDS_GPT4
                if (((count * 2) % Constants.MESSAGES_WORDS_GPT4) > 0) {
                    credits += 1
                }
                credits *= Constants.CHAT_MESSAGE_GPT4_COST

            }
            GPTModel.gpt35Turbo -> {
                credits = (count * 2) / Constants.WORDS_PER_MESSAGES
                if (((count * 2) % Constants.WORDS_PER_MESSAGES) > 0) {
                    credits += 1
                }
                credits *= Constants.CHAT_MESSAGE_COST

            }
            else -> {}
        }
        Log.e("Credits","Min Req:${credits} count:${count}")

        return credits
    }

    fun resetCreditsDialog(){
        showNoCreditsBottomSheet.value = false
        startListening()
    }

    override fun onCleared() {
        super.onCleared()
        speechRecognizer?.destroy()
        release()
        unmuteSystemSounds()
    }
}

enum class StatusText(val text: String) {
    EMPTY(""),
    LISTENING("Listening..."),
    SPEAKING("Speaking..."),
    ERROR("Network Error!");

    override fun toString(): String {
        return text
    }
}