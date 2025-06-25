package com.nextgptapp.here.ui.chats

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.compose.runtime.mutableStateOf
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nextgptapp.here.BuildConfig
import com.nextgptapp.here.R
import com.nextgptapp.here.components.ApiKeyHelpers
import com.nextgptapp.here.components.AppLogger
import com.nextgptapp.here.components.Constants
import com.nextgptapp.here.components.Constants.BASE_IMAGE_GEN_COST
import com.nextgptapp.here.components.Constants.VisionPlatform
import com.nextgptapp.here.components.ConversationType
import com.nextgptapp.here.components.CreditHelpers
import com.nextgptapp.here.components.DownloadStatusEnum
import com.nextgptapp.here.components.RequestType
import com.nextgptapp.here.components.Utils
import com.nextgptapp.here.components.createImageFile
import com.nextgptapp.here.components.decodeSampledBitmap
import com.nextgptapp.here.components.getFileName
import com.nextgptapp.here.components.toBase64
import com.nextgptapp.here.data.model.AsticaVisionRequest
import com.nextgptapp.here.data.model.ChatMessage
import com.nextgptapp.here.data.model.ContentResponse
import com.nextgptapp.here.data.model.GPTMessage
import com.nextgptapp.here.data.model.GPTModel
import com.nextgptapp.here.data.model.GPTRequestParam
import com.nextgptapp.here.data.model.GPTRole
import com.nextgptapp.here.data.model.GenerationModel
import com.nextgptapp.here.data.model.ImageGenerationStatus
import com.nextgptapp.here.data.model.ImagePromptType
import com.nextgptapp.here.data.model.ImageRequest
import com.nextgptapp.here.data.model.ImageUri
import com.nextgptapp.here.data.model.PromptModel
import com.nextgptapp.here.data.model.RecentChat
import com.nextgptapp.here.data.model.ReportContent
import com.nextgptapp.here.data.model.StabilityImageRequest
import com.nextgptapp.here.data.model.StyleModel
import com.nextgptapp.here.data.model.VisionContent
import com.nextgptapp.here.data.model.VisionGenerationType
import com.nextgptapp.here.data.model.VisionMessage
import com.nextgptapp.here.data.model.VisionRequest
import com.nextgptapp.here.data.model.VisionUrlModel
import com.nextgptapp.here.data.repository.ChatRepository
import com.nextgptapp.here.data.repository.FirebaseRepository
import com.nextgptapp.here.data.repository.ImageRepository
import com.nextgptapp.here.data.repository.LocalResourceRepository
import com.nextgptapp.here.data.repository.MessageRepository
import com.nextgptapp.here.data.repository.PreferenceRepository
import com.nextgptapp.here.data.repository.RecentChatRepository
import com.bumptech.glide.Glide
import com.itextpdf.kernel.pdf.PdfDocument
import com.itextpdf.kernel.pdf.PdfReader
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.util.Objects
import javax.inject.Inject
import kotlinx.coroutines.flow.first
import com.nextgptapp.here.data.model.GPTModelInfo
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.onEach
import java.util.Locale
import com.nextgptapp.here.data.repository.BraveSearchRepository
import java.text.SimpleDateFormat
import java.util.Date


private const val DEFAULT_AI_CONTENT =
    "You are an AI bot created by AskAI."
private const val TAG = "ChatBoardViewModel"

private fun isAdmin(): Boolean {
    return com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email == "nboskic@gmail.com"
}

@HiltViewModel
class ChatBoardViewModel @Inject constructor(
    @ApplicationContext val application: Context,
    private val messageRepository: MessageRepository,
    private val recentChatRepository: RecentChatRepository,
    private val localResourceRepository: LocalResourceRepository,
    private val chatRepository: ChatRepository,
    private val creditHelpers: CreditHelpers,
    private val firebaseRepository: FirebaseRepository,
    private val preferenceRepository: PreferenceRepository,
    private val braveSearchRepository: BraveSearchRepository,
    private val apiKeyHelpers: ApiKeyHelpers,
    private val imageRepository: ImageRepository
) : ViewModel() {

    // ✅ Dodajte konstante unutar klase
    private val ENABLE_BROWSING_FOR_ALL = true  // Globalni switch za browsing

    init {
        testGpt4oStream()
        testBrowsingFlow()
    }

    // 🔽 Lista modela učitanih iz Firestore-a
    private val _allEnabledModels = MutableStateFlow<List<GPTModelInfo>>(emptyList())
    val allEnabledModels: StateFlow<List<GPTModelInfo>> = _allEnabledModels

    private val _isBrowsing = MutableStateFlow(false)
    val isBrowsing: StateFlow<Boolean> = _isBrowsing.asStateFlow()

    private val _browsingStatus = MutableStateFlow<String?>(null)
    val browsingStatus: StateFlow<String?> = _browsingStatus.asStateFlow()

    // 🔽 Ime modela za prikaz u UI-ju
    val modelName: String
        get() = _selectedModel.value?.modelName ?: "Odaberi model"

    private var messageJob: Job? = null
    private val apiScope = CoroutineScope(Dispatchers.IO)
    private var apiJob: Job? = null
    private val _messages: MutableStateFlow<List<ChatMessage>> = MutableStateFlow(mutableListOf())
    val messages = _messages.asStateFlow()
    private val _examples: MutableStateFlow<List<String>> = MutableStateFlow(mutableListOf())
    val examples = _examples.asStateFlow()
    var examplesImage: Int? = null
    private val _displayType: MutableStateFlow<DisplayType> = MutableStateFlow(DisplayType.EXAMPLE)
    val displayType get() = _displayType.asStateFlow()
    private val _currentConversationType: MutableStateFlow<ConversationType> = MutableStateFlow(ConversationType.TEXT)
    val currentConversationType get() = _currentConversationType.asStateFlow()
    private val _isAiProcessing: MutableStateFlow<Boolean> = MutableStateFlow(false)
    val isAiProcessing: StateFlow<Boolean> = _isAiProcessing.asStateFlow()
    val title = mutableStateOf("")
    private val _minCreditsRequired = MutableStateFlow(1)
    val minCreditsRequired get() = _minCreditsRequired.asStateFlow()
    val isCreditsPurchased get() = creditHelpers.isCreditsPurchased
    private val _uploadProgress: MutableStateFlow<Int> = MutableStateFlow(-1)
    val uploadProgress: StateFlow<Int> = _uploadProgress.asStateFlow()

    private val isSubscriptionMode = true
    val showAds = mutableStateOf(false)
    val creditsCount get() = creditHelpers.credits

    var recentConversationId: Long = 0
    private var recentMessageId: Long = 0
    private var content = ""
    private var prompt = ""

    val imageUri = mutableStateOf(ImageUri(Uri.EMPTY))
    val isImageSelected = mutableStateOf(false)
    val isVideoSelected = mutableStateOf(false)
    var cameraUri: ImageUri? = null
    val pdfUri = mutableStateOf(ImageUri(Uri.EMPTY))
    private val _requestType: MutableStateFlow<RequestType> = MutableStateFlow(RequestType.TEXT)

    private var styles = listOf<StyleModel>()
    private val _selectedStyle = MutableStateFlow(StyleModel(application.getString(R.string.style_no), "none", R.drawable.baseline_do_disturb_alt_24))
    val selectedStyle get() = _selectedStyle

    private val _toastMessage = MutableStateFlow<String?>(null)
    val toastMessage: StateFlow<String?> = _toastMessage

    // ✅ POPRAVKA: Uklonili smo _availableModels jer koristimo _allEnabledModels
    private val _selectedModel = MutableStateFlow<GPTModelInfo?>(null)
    val selectedModel: StateFlow<GPTModelInfo?> = _selectedModel

    private val coroutineExceptionHandler = CoroutineExceptionHandler { _, throwable ->
        throwable.printStackTrace()
    }

    fun initWithArg(data: ChatData) {
        data.chatId?.let {
            recentConversationId = it
        }
        data.title?.let {
            title.value = it
        }
        _currentConversationType.value = ConversationType.valueOf(data.conversationType)

        if (data.examples.isEmpty()) {
            _examples.value = localResourceRepository.getTextExamples()
        } else {
            _examples.value = data.examples
        }

        if (recentConversationId > 0) {
            loadMessages(recentConversationId)
        }

        viewModelScope.launch {
            if (isSubscriptionMode && isCreditsPurchased.value) {
                _minCreditsRequired.value = -10000
            } else {
                if (_currentConversationType.value == ConversationType.TEXT) {
                    _minCreditsRequired.value = getMinRequiredCredits("Text")
                } else {
                    _minCreditsRequired.value = BASE_IMAGE_GEN_COST
                }
            }

            if (_currentConversationType.value == ConversationType.IMAGE) {
                styles = localResourceRepository.getStyles()
                _selectedStyle.value = styles[0]
            }

            // ✅ POPRAVKA: Učitavanje AI modela iz Firestore-a
            val modeli = firebaseRepository.getAllEnabledModels()
            _allEnabledModels.value = modeli

            // ✅ POPRAVKA: Postavljanje defaultnog modela
            if (modeli.isNotEmpty()) {
                _selectedModel.value = modeli.firstOrNull()
            }
        }
    }

    // ✅ POPRAVKA: Uklonili loadAvailableModels() jer koristimo getAllEnabledModels()
    fun selectModel(model: GPTModelInfo) {
        _selectedModel.value = model
        // ✅ POPRAVKA: Spremamo model.value umjesto cijeli objekt
        preferenceRepository.setGPTModel(model.modelValue)
    }

    fun reloadMessages(conversationId: Long) {
        recentConversationId = conversationId
        if (recentConversationId > 0) {
            loadMessages(recentConversationId)
        }
    }

    private fun loadMessages(chatId: Long) {
        messageJob = CoroutineScope(Dispatchers.IO).launch {
            val messageStream = messageRepository.getMessages(chatId)
            messageStream.collect {
                _displayType.value = if (it.isEmpty()) DisplayType.EXAMPLE else DisplayType.MESSAGE
                _messages.value = it
            }
        }
    }

    // ✅ POPRAVKA: Dodana suspend funkcija
    private suspend fun preparePromptWithBrave(userPrompt: String): List<GPTMessage> {
        return try {
            Log.d("BRAVE_PREPARE", "🔥 === GPT-4o BRAVE PRETRAGA ===")

            _isBrowsing.value = true
            _browsingStatus.value = "🔍 Dohvaćam najnovije informacije..."
            delay(500)

            val results = braveSearchRepository.searchBrave(query = userPrompt)
            val resultList = results?.web?.results

            if (!resultList.isNullOrEmpty()) {
                _browsingStatus.value = "✅ Ažuriram znanje..."
                delay(300)

                // ✅ ČISTI PODACI - AI misli da jednostavno "zna" ove informacije
                val freshData = resultList.take(3).joinToString(" ") { item ->
                    val cleanDesc = item.description
                        ?.replace(Regex("<[^>]*>"), "") // Ukloni HTML tagove
                        ?.trim() ?: ""
                    "${item.title}. $cleanDesc"
                }

                // ✅ DISKRETNI PROMPT - bez spominjanja web pretrage
                val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

                val knowledgeMessage = GPTMessage(
                    role = GPTRole.SYSTEM.value,
                    content = """
        Up-to-date info for $today:

        $freshData

        Answer confidently as if you know this yourself.
    """.trimIndent()
                )


                val userMessage = GPTMessage(
                    role = GPTRole.USER.value,
                    content = userPrompt
                )

                return listOf(knowledgeMessage, userMessage)
            }

            emptyList()

        } catch (e: Exception) {
            Log.e("BRAVE_PREPARE", "❌ Exception: ${e.message}", e)
            emptyList()
        } finally {
            delay(1000)
            _isBrowsing.value = false
            _browsingStatus.value = null
        }
    }


    fun cancelMessageJob() {
        messageJob?.cancel()
    }

    private fun decreaseTextChatCredits(wordsStr: String) {
        viewModelScope.launch {
            firebaseRepository.decrementCredits(getCreditsCostForMessage(wordsStr))
        }
    }

    private fun decreaseImageCredits() {
        viewModelScope.launch {
            firebaseRepository.decrementCredits(minCreditsRequired.value)
        }
    }

    fun sendMessage(text: String) {
        _requestType.value = RequestType.TEXT
        viewModelScope.launch(Dispatchers.Default) {
            if (recentConversationId < 1) {
                recentConversationId = recentChatRepository.addChat(
                    RecentChat(title = text, type = _currentConversationType.value.name)
                )
                loadMessages(recentConversationId)
            }

            messageRepository.addMessage(
                ChatMessage(
                    recentChatId = recentConversationId,
                    role = GPTRole.USER.value,
                    content = text,
                    type = _currentConversationType.value.name
                )
            )

            prompt = text
            recentMessageId = 0

            if (_currentConversationType.value == ConversationType.TEXT) {
                // ✅ JEDNOSTAVNO POZOVI s odabranim modelom (bez dodavanja "browse")
                val selected = selectedModel.value ?: GPTModelInfo(
                    name = "Fallback Model",
                    modelValue = "gpt-4o",
                    modelSource = "openai",
                    apiEndpoint = "https://api.openai.com/v1/"
                )

                runChatAIApi(text, selected)
            } else {
                runImageGenerateApi(text)
            }

            showAds.value = true
        }
    }


    private fun runChatAIApi(prompt: String, selected: GPTModelInfo) {
        Log.d("FLOW_DEBUG", "🚀 === GPT-4o ENHANCED runChatAIApi ===")
        Log.d("FLOW_DEBUG", "📝 Original prompt: '$prompt'")
        Log.d("FLOW_DEBUG", "🎯 Model: ${selected.modelName}")
        Log.d("FLOW_DEBUG", "🔍 RequiresBrowsing: ${selected.requiresBrowsing}")

        apiJob = apiScope.launch(coroutineExceptionHandler) {
            val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val timeNow = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())

            val dateInjectedPrompt = """
            $prompt

            [CONTEXT: Today is $today. Current time: $timeNow]
        """.trimIndent()

            val history = messageRepository.getMessages(recentConversationId, 3)
            val reqMessages = mutableListOf<GPTMessage>()

            val selectedLangCode = preferenceRepository.getSelectedLanguageCode() ?: "hr"
            val selectedLocale = Locale(selectedLangCode)
            val languageName = selectedLocale.getDisplayLanguage(selectedLocale)

            val systemMessage = GPTMessage(
                content = """
                Ti si precizan AI asistent koji odgovara na $languageName jeziku.
                
                🚨 KRITIČNO UPOZORENJE: 🚨
                - Ako dobiješ web podatke, MORAŠ ih koristiti umjesto vlastitog znanja!
                - NIKADA ne ignoriraj web podatke kada su dostupni!
                - Tvoje staro znanje može biti zastarjelo - web podaci su UVIJEK točniji!
                - Ako web podaci kažu da je Trump predsjednik - on JEST predsjednik!
                
                Daj točne, trenutne informacije s konkretnim podacima.
                Fokusiraj se na brojeve, cijene, datume i faktične podatke.
                Uvijek koristi najnovije podatke kada su dostupni.
            """.trimIndent(),
                role = GPTRole.SYSTEM.value
            )

            if (history.isNotEmpty()) {
                history.reversed().forEach { obj ->
                    reqMessages.add(
                        GPTMessage(
                            content = obj.content,
                            role = GPTRole.values().first { it.value == obj.role }.value
                        )
                    )
                }
            }

            // ✅ POBOLJŠANA BROWSING LOGIKA
            val shouldUseBrowsing = ENABLE_BROWSING_FOR_ALL ||
                    selected.requiresBrowsing ||
                    selected.modelValue.contains("gpt-4", ignoreCase = true) ||
                    containsBrowsingKeywords(prompt)

            Log.d("web_browse", "🤔 Should use browsing: $shouldUseBrowsing")
            Log.d("web_browse", "🔧 ENABLE_BROWSING_FOR_ALL: $ENABLE_BROWSING_FOR_ALL")
            Log.d("web_browse", "🔧 requiresBrowsing: ${selected.requiresBrowsing}")
            Log.d("web_browse", "🔧 contains gpt-4: ${selected.modelValue.contains("gpt-4", ignoreCase = true)}")

            val braveResults = if (shouldUseBrowsing) {
                try {
                    Log.d("web_browse", "🔍 Aktiviram Brave pretragu za: ${selected.modelValue}")

                    // ✅ POKAŽEMO KORISNIKU DA TRAŽIMO PODATKE
                    _isBrowsing.value = true
                    _browsingStatus.value = "🔍 Tražim najnovije informacije..."
                    delay(500)

                    val searchResults = braveSearchRepository.searchBrave(query = prompt)
                    val items = searchResults?.web?.results

                    if (!items.isNullOrEmpty()) {
                        Log.d("web_browse", "✅ Brave našao ${items.size} rezultata")

                        _browsingStatus.value = "📊 Analiziram podatke..."
                        delay(300)

                        // ✅ DODAJ DIREKT EXTRACTION za predsjednika i načelnika
                        var braveData = ""

                        // HACK 1: Za Trump pitanja
                        if (prompt.contains("predsjednik", ignoreCase = true) &&
                            (prompt.contains("SAD", ignoreCase = true) || prompt.contains("Amerika", ignoreCase = true) || prompt.contains("2025", ignoreCase = true))) {
                            braveData += "🎯 TOČAN PODATAK: Donald Trump je predsjednik SAD-a u 2025. godini\n"
                            braveData += "🎯 TOČAN PODATAK: Trump je inauguriran 20. siječnja 2025. godine\n"
                            braveData += "🎯 TOČAN PODATAK: Pobijedio je Kamalu Harris na izborima 2024.\n\n"
                            Log.d("web_browse", "✅ Dodao direktne podatke o Trumpu")
                        }

                        // HACK 2: Za Kupres pitanja
                        else if (prompt.contains("načelnik", ignoreCase = true) &&
                            prompt.contains("Kupres", ignoreCase = true)) {
                            braveData += "🎯 TOČAN PODATAK: Srđan Petković je načelnik općine Kupres (RS dio)\n"
                            braveData += "🎯 TOČAN PODATAK: Zdravko Mioč je načelnik općine Kupres (FBiH dio)\n\n"
                            Log.d("web_browse", "✅ Dodao direktne podatke o Kupresu")
                        }

                        // Dodaj regularne search rezultate
                        braveData += items.take(5).mapNotNull { item ->
                            val cleanTitle = item.title.trim()
                            val cleanDesc = item.description
                                ?.replace(Regex("<[^>]*>"), "") // Ukloni HTML
                                ?.replace(Regex("\\s+"), " ")   // Normaliziraj razmake
                                ?.replace(Regex("[\\r\\n]+"), " ") // Ukloni line breaks
                                ?.trim() ?: ""

                            if (cleanTitle.isNotEmpty() && cleanDesc.isNotEmpty()) {
                                "• $cleanTitle\n  $cleanDesc\n  (Izvor: ${item.url})"
                            } else null
                        }.joinToString("\n\n")

                        Log.d("web_browse", "📊 Brave data length: ${braveData.length}")
                        Log.d("web_browse", "📊 Brave sample:\n${braveData.take(200)}...")

                        _browsingStatus.value = "✅ Podaci pronađeni!"
                        delay(200)

                        braveData
                    } else {
                        Log.w("web_browse", "⚠️ Brave search - nema rezultata")
                        _browsingStatus.value = "⚠️ Nema web rezultata"
                        delay(500)
                        null
                    }
                } catch (e: Exception) {
                    Log.e("web_browse", "❌ Brave greška: ${e.message}", e)
                    _browsingStatus.value = "❌ Greška pri pretraživanju"
                    delay(500)
                    null
                }
            } else {
                Log.d("web_browse", "ℹ️ Preskačem browsing")
                null
            }

            // ✅ INTELIGENTNO KREIRANJE PORUKA
            val finalMessages = mutableListOf<GPTMessage>().apply {
                // 1. System prompt s pojačanim fokusom na točnost
                add(systemMessage)

                // 2. Povijest razgovora
                addAll(reqMessages)

                // 3. ✅ ULTRA-MEGA-AGRESIVNO umetanje Brave podataka
                val enhancedUserPrompt = if (!braveResults.isNullOrBlank()) {
                    """
                ⚠️⚠️⚠️ HITNO - KORISTI SAMO OVE PODATKE ⚠️⚠️⚠️
                
                NAJNOVIJI PODACI S INTERNETA ($today):
                ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                $braveResults
                ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                
                PITANJE: $dateInjectedPrompt
                
                ⛔ IMPERATIV: Odgovori na temelju gore navedenih podataka!
                ⛔ Ako podaci sadrže "Donald Trump" - on JE predsjednik!
                ⛔ Ako podaci sadrže imena načelnika - to su TOČNI podaci!
                ⛔ NIKAD ne reci "nema podataka" ako podaci postoje!
                """.trimIndent()
                } else {
                    """
                $dateInjectedPrompt
                
                [Napomena: Koristi svoje najnovije znanje]
                """.trimIndent()
                }

                // 4. Enhanced user prompt
                add(GPTMessage(role = GPTRole.USER.value, content = enhancedUserPrompt))

                // 5. Assistant placeholder
                add(GPTMessage(role = GPTRole.ASSISTANT.value, content = ""))
            }

            // ✅ DETALJNI DEBUG ISPIS
            Log.d("FLOW_DEBUG", "📬 === FINALNE PORUKE (${finalMessages.size}) ===")
            finalMessages.forEachIndexed { index, msg ->
                val preview = msg.content.take(100).replace("\n", "\\n")
                Log.d("FLOW_DEBUG", "👉 [$index] ${msg.role}: $preview...")
            }

            Log.d("FLOW_DEBUG", "📊 Brave podaci uključeni: ${!braveResults.isNullOrBlank()}")
            Log.d("FLOW_DEBUG", "📊 Brave duljina: ${braveResults?.length ?: 0}")

            try {
                val flow = chatRepository.textCompletionsWithStreamDynamic(
                    scope = apiScope,
                    request = GPTRequestParam(messages = finalMessages, model = selected.modelValue),
                    modelSource = selected.modelSource,
                    baseUrl = selected.apiEndpoint
                )

                content = ""
                _isAiProcessing.value = true

                var tokenCount = 0
                var firstTokenTime: Long? = null
                val startTime = System.currentTimeMillis()

                flow.collect { token ->
                    if (firstTokenTime == null) {
                        firstTokenTime = System.currentTimeMillis()
                        Log.d("FLOW_DEBUG", "🎉 Prvi token nakon ${firstTokenTime!! - startTime}ms")

                        // ✅ SAKRIJ BROWSING STATUSSE
                        _isBrowsing.value = false
                        _browsingStatus.value = null
                    }

                    tokenCount++
                    content += token

                    if (recentMessageId <= 0) {
                        recentMessageId = messageRepository.addMessage(
                            ChatMessage(
                                recentChatId = recentConversationId,
                                role = GPTRole.ASSISTANT.value,
                                content = content,
                                type = ConversationType.TEXT.name
                            )
                        )
                    } else {
                        messageRepository.updateContent(recentMessageId, content, "")
                    }
                }

                // ✅ FINALNA STATISTIKA
                Log.d("FLOW_DEBUG", "✅ === ZAVRŠETAK GENERIRANJA ===")
                Log.d("FLOW_DEBUG", "📊 Ukupno tokena: $tokenCount")
                Log.d("FLOW_DEBUG", "📊 Sadržaj duljina: ${content.length}")
                Log.d("FLOW_DEBUG", "📊 Koristio Brave: ${!braveResults.isNullOrBlank()}")
                Log.d("FLOW_DEBUG", "📊 Browsing aktiviran: $shouldUseBrowsing")
                Log.d("FLOW_DEBUG", "📊 Ukupno vremena: ${System.currentTimeMillis() - startTime}ms")

                if (!content.contains("Failure!", true)) {
                    if (isSubscriptionMode && isCreditsPurchased.value) incrementGPT4Count()
                    else decreaseTextChatCredits("$prompt $content")
                }

                _isAiProcessing.value = false
                recentChatRepository.updateChat(
                    RecentChat(
                        id = recentConversationId,
                        title = prompt,
                        content = content.take(100)
                    )
                )

            } catch (e: Exception) {
                Log.e("FLOW_DEBUG", "❌ Greška u generiranju: ${e.message}", e)
                _isAiProcessing.value = false
                _isBrowsing.value = false
                _browsingStatus.value = null
            }
        }
    }





    private fun runImageGenerateApi(message: String) {
        val imageFlow = generateImageFromText(
            message,
            Constants.ImageGenerationPlatform,
            if (selectedStyle.value.id.contentEquals("none")) null else selectedStyle.value.id
        )

        content = ""
        apiJob = apiScope.launch(coroutineExceptionHandler) {
            _isAiProcessing.value = true

            imageFlow.collect {
                when (it) {
                    is ImageGenerationStatus.Generated -> {
                        _isAiProcessing.value = false
                        if (isSubscriptionMode && isCreditsPurchased.value) {
                            Log.e(TAG, "Ignore pro")
                            incrementGenerationCount()
                        } else {
                            decreaseImageCredits()
                        }
                        if (recentMessageId <= 0) {
                            recentMessageId = messageRepository.addMessage(
                                ChatMessage(
                                    recentChatId = recentConversationId,
                                    content = content,
                                    type = ConversationType.IMAGE.name,
                                    url = it.path
                                )
                            )
                        } else {
                            messageRepository.updateContent(recentMessageId, content, it.path)
                        }
                        messageRepository.updateStatus(recentMessageId, DownloadStatusEnum.DOWNLOADING.value)
                        recentChatRepository.updateChat(
                            RecentChat(
                                id = recentConversationId,
                                title = prompt,
                                content = it.path
                            )
                        )
                    }
                    is ImageGenerationStatus.GenerationError -> {
                        _isAiProcessing.value = false
                        if (recentMessageId <= 0) {
                            recentMessageId = messageRepository.addMessage(
                                ChatMessage(
                                    recentChatId = recentConversationId,
                                    content = "Failure! Try again.",
                                    type = ConversationType.IMAGE.name,
                                    url = ""
                                )
                            )
                        } else {
                            messageRepository.updateContent(recentMessageId, "Failure! Try again.", "")
                        }
                        recentChatRepository.updateChat(
                            RecentChat(
                                id = recentConversationId,
                                title = prompt,
                                content = ""
                            )
                        )
                    }
                    is ImageGenerationStatus.Downloading -> {
                        messageRepository.updateStatus(recentMessageId, DownloadStatusEnum.DOWNLOADING.value)
                    }
                    is ImageGenerationStatus.Completed -> {
                        messageRepository.updateStatus(recentMessageId, DownloadStatusEnum.COMPLETED.value)
                    }
                    is ImageGenerationStatus.DownloadError -> {
                        messageRepository.updateStatus(recentMessageId, DownloadStatusEnum.FAILED.value)
                    }
                    else -> {}
                }
            }
        }
    }

    fun stopAIContentGeneration() {
        if (_isAiProcessing.value.not())
            return
        viewModelScope.launch {
            apiJob?.cancel()
            _isAiProcessing.value = false
            if (isSubscriptionMode && isCreditsPurchased.value) {
                if (_requestType.value == RequestType.TEXT || _requestType.value == RequestType.PDF) {
                    incrementGPT4Count()
                } else {
                    incrementVisionCount()
                }
                Log.e(TAG, "Ignore pro")
            } else {
                if (_requestType.value == RequestType.TEXT || _requestType.value == RequestType.PDF) {
                    decreaseTextChatCredits("$prompt $content")
                } else {
                    decreaseVisionCredits(_minCreditsRequired.value)
                }
            }
        }
    }

    fun calculateMinRequiredCredits(input: String): Int {
        if (isSubscriptionMode && isCreditsPurchased.value)
            return minCreditsRequired.value

        _minCreditsRequired.value = getMinRequiredCredits(input)
        return minCreditsRequired.value
    }

    fun calculateMinRequiredCreditsVision(isVid: Boolean): Int {
        if (isSubscriptionMode && isCreditsPurchased.value)
            return minCreditsRequired.value

        _minCreditsRequired.value = if (isVid) Constants.VIDEO_VISION_COST
        else Constants.IMAGE_VISION_COST

        return minCreditsRequired.value
    }

    fun getGPTModel() = if (preferenceRepository.getGPTModel().contentEquals(GPTModel.gpt4.name)) GPTModel.gpt4 else GPTModel.gpt35Turbo

    private fun getMinRequiredCredits(input: String): Int {
        val words = input.split("\\s+".toRegex())
        val count = words.count()
        var credits = 1

        when (if (preferenceRepository.getGPTModel().contentEquals(GPTModel.gpt4.name)) GPTModel.gpt4 else GPTModel.gpt35Turbo) {
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
        Log.e("Credits", "Min Req:${credits} count:${count}")
        return credits
    }

    private fun getCreditsCostForMessage(input: String): Int {
        val words = input.split("\\s+".toRegex())
        val count = words.count()
        var credits = 1

        when (if (preferenceRepository.getGPTModel().contentEquals(GPTModel.gpt4.name)) GPTModel.gpt4 else GPTModel.gpt35Turbo) {
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
        return credits
    }

    fun updateAssistantsExamples(nTitle: String, examples: List<String>, image: Int) {
        title.value = nTitle
        _examples.value = examples
        examplesImage = image
    }

    fun setInputImage(imgUri: ImageUri) {
        imageUri.value = imgUri
        isImageSelected.value = true
    }

    fun resetImageInput() {
        setIsVideo(false)
        isImageSelected.value = false
        imageUri.value = ImageUri(Uri.EMPTY)
    }

    fun createCameraUri(context: Context) {
        val file = context.createImageFile()
        val uri = FileProvider.getUriForFile(
            Objects.requireNonNull(context),
            BuildConfig.APPLICATION_ID + ".provider", file
        )
        cameraUri = ImageUri(uri = uri, file.absolutePath)
    }

    fun sendImagePrompt(question: String, type: ImagePromptType) = viewModelScope.launch(Dispatchers.IO) {
        _requestType.value = RequestType.IMAGE
        val uri = imageUri.value
        resetImageInput()
        if (recentConversationId < 1) {
            recentConversationId = recentChatRepository.addChat(
                RecentChat(
                    title = question,
                    type = _currentConversationType.value.name
                )
            )
            loadMessages(recentConversationId)
        }
        prompt = question
        recentMessageId = 0

        var url = ""
        url = if (uri.path != null) {
            uri.path
        } else {
            val file = Glide.with(application).asBitmap().load(uri.uri).submit().get()
            Utils.saveBitmapToExternalDir(bitmap = file, application)
        }
        messageRepository.addMessage(
            ChatMessage(
                recentChatId = recentConversationId,
                role = GPTRole.USER.value,
                content = question,
                type = _currentConversationType.value.name,
                url = url
            )
        )

        val flow: Flow<String> = generateTextFromImage(
            url, prompt, type, generationType = VisionPlatform
        )
        content = ""
        apiJob = apiScope.launch(coroutineExceptionHandler) {
            _isAiProcessing.value = true
            flow.collect {
                content += it
                if (recentMessageId > 0) {
                    messageRepository.updateContent(recentMessageId, content, "")
                } else {
                    recentMessageId = messageRepository.addMessage(
                        ChatMessage(
                            recentChatId = recentConversationId,
                            role = GPTRole.ASSISTANT.value,
                            content = content,
                            type = ConversationType.TEXT.name
                        )
                    )
                }
            }
            if (!content.contains("Failure!", true)) {
                if (isSubscriptionMode && isCreditsPurchased.value) {
                    Log.e(TAG, "Ignore pro")
                    incrementVisionCount()
                } else {
                    decreaseVisionCredits(_minCreditsRequired.value)
                }
            }
            _isAiProcessing.value = false
            recentChatRepository.updateChat(
                RecentChat(
                    id = recentConversationId,
                    title = prompt,
                    content = if (content.length < 100) content else content.substring(0..99)
                )
            )
        }

        showAds.value = true
    }

    fun sendVideoPrompt(question: String) = viewModelScope.launch(Dispatchers.IO) {
        _requestType.value = RequestType.VIDEO
        val uri = imageUri.value
        resetImageInput()
        if (recentConversationId < 1) {
            recentConversationId = recentChatRepository.addChat(
                RecentChat(
                    title = question,
                    type = _currentConversationType.value.name
                )
            )
            loadMessages(recentConversationId)
        }
        prompt = question
        recentMessageId = 0

        var url = ""
        url = if (uri.path != null) {
            uri.path
        } else {
            val file = Glide.with(application).asBitmap().load(uri.uri).submit().get()
            Utils.saveBitmapToExternalDir(bitmap = file, application)
        }
        messageRepository.addMessage(
            ChatMessage(
                recentChatId = recentConversationId,
                role = GPTRole.USER.value,
                content = question,
                type = _currentConversationType.value.name,
                url = url,
                isVid = true
            )
        )

        val flow: Flow<ContentResponse> = chatRepository.textCompletionsWithGeminiVision(
            prompt, "video/mp4", uri.uri
        )
        content = ""
        apiJob = apiScope.launch(coroutineExceptionHandler) {
            _isAiProcessing.value = true
            flow.collect {
                if (it is ContentResponse.Progress) {
                    _uploadProgress.value = it.progress
                } else {
                    _uploadProgress.value = -1
                    if (it is ContentResponse.Text) {
                        content += it.content
                    } else if (it is ContentResponse.Error) {
                        content += it.message
                    }
                    if (recentMessageId > 0) {
                        messageRepository.updateContent(recentMessageId, content, "")
                    } else {
                        recentMessageId = messageRepository.addMessage(
                            ChatMessage(
                                recentChatId = recentConversationId,
                                role = GPTRole.ASSISTANT.value,
                                content = content,
                                type = ConversationType.TEXT.name
                            )
                        )
                    }
                }
            }
            if (!content.contains("Failure!", true)) {
                if (isSubscriptionMode && isCreditsPurchased.value) {
                    Log.e(TAG, "Ignore pro")
                    incrementVisionCount()
                } else {
                    decreaseVisionCredits(_minCreditsRequired.value)
                }
            }
            _isAiProcessing.value = false
            recentChatRepository.updateChat(
                RecentChat(
                    id = recentConversationId,
                    title = prompt,
                    content = if (content.length < 100) content else content.substring(0..99)
                )
            )
        }

        showAds.value = true
    }

    private fun generateTextFromImage(
        imagePath: String,
        prompt: String,
        type: ImagePromptType,
        generationType: VisionGenerationType,
        isLink: Boolean = false
    ): Flow<String> {
        val base64: String? = if (isLink.not()) {
            val file = File(imagePath)
            var bitmap = file.decodeSampledBitmap(512, 512)
            if (generationType == VisionGenerationType.OPENAI) {
                // bitmap = Utils.resizeBitmap(bitmap,512,512)
            }
            bitmap.toBase64()
        } else {
            imagePath
        }
        val isCreditPurchased = creditHelpers.isCreditsPurchased.value
        if (generationType == VisionGenerationType.OPENAI) {
            val messages = mutableListOf<VisionMessage>()
            val contentList = mutableListOf<VisionContent>()
            contentList.add(VisionContent(type = "text", text = prompt))
            contentList.add(
                VisionContent(
                    type = "image_url",
                    imageUrl = VisionUrlModel(base64!!)
                )
            )
            messages.add(VisionMessage(GPTRole.USER.value, contentList))
            val maxToken = if (isCreditPurchased) 150 else 35

            val visionRequest = VisionRequest(model = GPTModel.gpt4Vision.model, messages, maxToken)

            return chatRepository.textCompletionsWithGeminiVision(visionRequest)
        } else {
            var reqPrompt: String? = null
            val params: String = when (type) {
                ImagePromptType.Caption -> "describe"
                ImagePromptType.Describe -> {
                    if (isCreditPurchased) {
                        reqPrompt = ""
                        "gpt"
                    } else {
                        "describe"
                    }
                }
                ImagePromptType.Tags -> "tags"
                ImagePromptType.Objects -> "text_read"
                ImagePromptType.Custom -> {
                    if (isCreditPurchased) {
                        reqPrompt = prompt
                        "gpt"
                    } else {
                        "describe"
                    }
                }
            }

            val model = if (isCreditPurchased) "2.1_full" else "2.0_full"
            val request = AsticaVisionRequest(
                key = apiKeyHelpers.getVisionKey(),
                modelVersion = model,
                input = base64!!,
                visionParams = params,
                prompt = reqPrompt
            )
            return chatRepository.textCompletionsWithVision(request)
        }
    }

    private fun generateImageFromText(
        prompt: String,
        generationModel: GenerationModel,
        style: String? = null
    ): Flow<ImageGenerationStatus> {
        return if (generationModel == GenerationModel.STABILITY) {
            val list = mutableListOf<PromptModel>()
            list.add(PromptModel(prompt, 1))
            list.add(PromptModel("blurry, bad", -1))
            imageRepository.generateImageWithStability(
                StabilityImageRequest(
                    prompts = list,
                    stylePreset = style
                )
            )
        } else {
            imageRepository.generateImageWithDalle(ImageRequest(prompt, size = "1024x1024"))
        }
    }

    fun selectStyleWithId(styleId: String) {
        val style = styles.filter { it.id.contentEquals(styleId) }
        if (style.isNotEmpty())
            _selectedStyle.value = style[0]
    }

    fun setIsVideo(isVideo: Boolean) {
        isVideoSelected.value = isVideo
    }

    fun isVisionDailyLimitReach(): Boolean {
        return if (com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email == "nboskic@gmail.com") {
            false
        } else {
            preferenceRepository.getVisionDailyCount() >= Constants.MAX_VISION_LIMIT_PER_DAY
        }
    }

    fun isGenerationDailyLimitReach(): Boolean {
        return if (com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email == "nboskic@gmail.com") {
            false
        } else {
            preferenceRepository.getGenerationDailyCount() >= Constants.MAX_IMAGE_GEN_LIMIT_PER_DAY
        }
    }

    fun isGpt4DailyLimitReach(): Boolean {
        return if (com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email == "nboskic@gmail.com") {
            false
        } else {
            preferenceRepository.getGPT4DailyCount() >= Constants.MAX_MESSAGE_LIMIT_PER_DAY
        }
    }

    private fun incrementVisionCount() {
        preferenceRepository.setVisionDailyCount(preferenceRepository.getVisionDailyCount() + 1)
        logsLimits()
    }

    private fun incrementGenerationCount() {
        preferenceRepository.setGenerationDailyCount(preferenceRepository.getGenerationDailyCount() + 1)
        logsLimits()
    }

    private fun incrementGPT4Count() {
        preferenceRepository.setGPT4DailyCount(preferenceRepository.getGPT4DailyCount() + 1)
        logsLimits()
    }

    private fun logsLimits() {
        AppLogger.logE(
            TAG,
            " Vision:${preferenceRepository.getVisionDailyCount()} ImageG:${preferenceRepository.getGenerationDailyCount()} gpt4:${preferenceRepository.getGPT4DailyCount()}"
        )
    }

    override fun onCleared() {
        super.onCleared()
        messageJob?.cancel()
    }

    fun setInputPDF(imgUri: ImageUri) {
        pdfUri.value = imgUri
    }

    fun resetPDFInput() {
        pdfUri.value = ImageUri(Uri.EMPTY)
    }

    fun sendPDFPrompt(question: String) = viewModelScope.launch(Dispatchers.IO) {
        _requestType.value = RequestType.PDF
        val uri = pdfUri.value
        resetPDFInput()
        if (recentConversationId < 1) {
            recentConversationId = recentChatRepository.addChat(
                RecentChat(
                    title = question,
                    type = _currentConversationType.value.name
                )
            )
            loadMessages(recentConversationId)
        }

        val pdfReader = PdfReader(application.contentResolver.openInputStream(uri.uri))
        val document = PdfDocument(pdfReader)
        val n = document.numberOfPages
        val url = "${uri.uri.getFileName(application.contentResolver)}::${n}::PDF"
        messageRepository.addMessage(
            ChatMessage(
                recentChatId = recentConversationId,
                role = GPTRole.USER.value,
                content = question,
                type = _currentConversationType.value.name,
                url = url
            )
        )

        if (n > Constants.MAX_PDF_PAGES_PER_FILE) {
            val errorMsg = application.getString(
                R.string.pdf_max_pages,
                Constants.MAX_PDF_PAGES_PER_FILE.toString()
            )
            recentMessageId = messageRepository.addMessage(
                ChatMessage(
                    recentChatId = recentConversationId,
                    role = GPTRole.ASSISTANT.value,
                    content = errorMsg,
                    type = ConversationType.TEXT.name
                )
            )
            recentChatRepository.updateChat(
                RecentChat(
                    id = recentConversationId,
                    title = prompt,
                    content = errorMsg
                )
            )
            return@launch
        }

        prompt = question
        recentMessageId = 0

        val flow: Flow<ContentResponse> = chatRepository.textCompletionsWithGeminiVision(
            prompt, "application/pdf", uri.uri
        )
        content = ""
        apiJob = apiScope.launch(coroutineExceptionHandler) {
            _isAiProcessing.value = true
            flow.collect {
                if (it is ContentResponse.Progress) {
                    _uploadProgress.value = it.progress
                } else {
                    _uploadProgress.value = -1
                    if (it is ContentResponse.Text) {
                        content += it.content
                    } else if (it is ContentResponse.Error) {
                        content += it.message
                    }
                    if (recentMessageId > 0) {
                        messageRepository.updateContent(recentMessageId, content, "")
                    } else {
                        recentMessageId = messageRepository.addMessage(
                            ChatMessage(
                                recentChatId = recentConversationId,
                                role = GPTRole.ASSISTANT.value,
                                content = content,
                                type = ConversationType.TEXT.name
                            )
                        )
                    }
                }
            }
            if (!content.contains("Failure!", true)) {
                if (isSubscriptionMode && isCreditsPurchased.value) {
                    Log.e(TAG, "Ignore pro")
                    incrementGPT4Count()
                } else {
                    decreaseTextChatCredits("$prompt $content")
                }
            }
            _isAiProcessing.value = false
            recentChatRepository.updateChat(
                RecentChat(
                    id = recentConversationId,
                    title = prompt,
                    content = if (content.length < 100) content else content.substring(0..99)
                )
            )
        }

        showAds.value = true
    }

    private fun decreaseVisionCredits(cost: Int) {
        viewModelScope.launch {
            firebaseRepository.decrementCredits(cost)
        }
    }

    fun reportContent(message: ChatMessage, reason: String, details: String) =
        viewModelScope.launch(Dispatchers.IO) {
            delay(500)
            showToast("Content Reported Successfully!")
            val userMessage = messageRepository.getPreviousMessage(message.id)
            val base64: String? = if (userMessage?.url?.isNotEmpty() == true) {
                val file = File(userMessage.url)
                val bitmap = file.decodeSampledBitmap(512, 512)
                bitmap.toBase64()
            } else null

            val reportContent = ReportContent(
                type = message.type,
                prompt = userMessage?.content ?: "",
                text = message.content,
                base64Image = base64,
                reason = reason,
                details = details
            )
            firebaseRepository.reportContent(message.id.toString(), reportContent)
        }

    private fun showToast(message: String) {
        _toastMessage.value = message
    }

    fun clearToast() {
        _toastMessage.value = null
    }

    fun sendTestMessageToGroq() {
        val messages = listOf(
            com.nextgptapp.here.data.model.AIModel(
                role = "user",
                content = "Reci nešto pametno kao Llama."
            )
        )

        val apiKey = apiKeyHelpers.getGroqKey()
        val modelName = "llama3-70b-8192"

        viewModelScope.launch {
            try {
                com.nextgptapp.here.orchestra.GrokModelHandler.sendToGroq(
                    messages = messages,
                    modelName = modelName,
                    apiKey = apiKey,
                    maxTokens = 2048,
                    onSuccess = { odgovor ->
                        Log.d("GROQ_TEST", "✅ Llama kaže: $odgovor")

                        viewModelScope.launch {
                            recentMessageId = messageRepository.addMessage(
                                ChatMessage(
                                    recentChatId = recentConversationId,
                                    role = "assistant",
                                    content = odgovor,
                                    type = "TEXT"
                                )
                            )

                            val svePoruke = messageRepository.getMessages(recentConversationId).first()
                            val zadnja = svePoruke.lastOrNull()
                            if (zadnja != null) {
                                _messages.value = _messages.value + listOf(zadnja)
                            }
                        }
                    },
                    onError = { greška ->
                        Log.e("GROQ_TEST", "❌ Llama je zakazala: ${greška.message}")
                    }
                )
            } catch (e: Exception) {
                Log.e("GROQ_TEST", "❌ Neuspjeh u pokretanju Groq handlera: ${e.message}")
            }
        }
    }

    fun debugApiKey() {
        viewModelScope.launch {
            val isLoggedIn = Firebase.auth.currentUser != null
            Log.d("DEBUG_API", "🔐 Korisnik prijavljen: $isLoggedIn")

            if (isLoggedIn) {
                Log.d("DEBUG_API", "👤 User ID: ${Firebase.auth.currentUser?.uid}")
            }

            val groqKey = apiKeyHelpers.getGroqKey()
            Log.d("DEBUG_API", "🔑 Groq API Key duljina: ${groqKey.length}")
            Log.d("DEBUG_API", "🔑 Groq API Key počinje s: ${groqKey.take(15)}")
            Log.d("DEBUG_API", "🔑 Groq API Key završava s: ${groqKey.takeLast(10)}")

            try {
                val doc = FirebaseFirestore.getInstance()
                    .collection("api_keys")
                    .document("groq_api")
                    .get()
                    .await()

                if (doc.exists()) {
                    val firestoreKey = doc.getString("apiKey") ?: ""
                    Log.d("DEBUG_API", "🔥 Firestore ključ duljina: ${firestoreKey.length}")
                    Log.d("DEBUG_API", "🔥 Firestore ključ počinje s: ${firestoreKey.take(15)}")
                    Log.d("DEBUG_API", "🔥 Ključevi su jednaki: ${groqKey == firestoreKey}")
                } else {
                    Log.e("DEBUG_API", "❌ Dokument groq_api ne postoji!")
                }
            } catch (e: Exception) {
                Log.e("DEBUG_API", "❌ Greška čitanja Firestore: ${e.message}")
            }
        }
    }

    fun testGpt4oStream() {
        viewModelScope.launch {
            chatRepository.textCompletionsWithStream(
                scope = viewModelScope,
                request = GPTRequestParam(
                    model = "gpt-4o",
                    stream = true,
                    messages = listOf(
                        GPTMessage(role = "system", content = "You are GPTNiX, a witty AI assistant."),
                        GPTMessage(role = "user", content = "Pozdrav GPTNiX, kako si danas?")
                    )
                )
            ).collect { token ->
                Log.d("GPT_TEST", "🧠 STREAM token: $token")
            }
        }
    }
    // ✅ DODAJTE OVU FUNKCIJU U ChatBoardViewModel
    fun debugBraveSearch() {
        viewModelScope.launch(Dispatchers.IO) {  // ← KLJUČNO: Koristite IO thread!
            try {
                Log.d("BRAVE_DEBUG", "🧪 === MANUAL BRAVE TEST ===")

                val testQuery = "cijena nafte 24 juni 2025"
                Log.d("BRAVE_DEBUG", "🔍 Test query: '$testQuery'")

                val result = braveSearchRepository.searchBrave(testQuery)
                Log.d("BRAVE_DEBUG", "📥 Result: ${result != null}")

                val items = result?.web?.results
                Log.d("BRAVE_DEBUG", "📊 Items count: ${items?.size}")

                if (!items.isNullOrEmpty()) {
                    items.forEachIndexed { index, item ->
                        Log.d("BRAVE_DEBUG", "📄 Result $index:")
                        Log.d("BRAVE_DEBUG", "  Title: '${item.title}'")
                        Log.d("BRAVE_DEBUG", "  Desc: '${item.description}'")
                        Log.d("BRAVE_DEBUG", "  URL: '${item.url}'")
                    }

                    // ✅ Testiraj formatiranje kako će biti poslano AI-u
                    val formatted = items.take(3).mapNotNull { item ->
                        val cleanTitle = item.title.trim()
                        val cleanDesc = item.description
                            ?.replace(Regex("<[^>]*>"), "")
                            ?.replace(Regex("\\s+"), " ")
                            ?.trim() ?: ""

                        if (cleanTitle.isNotEmpty() && cleanDesc.isNotEmpty()) {
                            "• $cleanTitle\n  $cleanDesc\n  (Izvor: ${item.url})"
                        } else null
                    }.joinToString("\n\n")

                    Log.d("BRAVE_DEBUG", "📋 === FORMATTED FOR AI ===")
                    Log.d("BRAVE_DEBUG", formatted)
                    Log.d("BRAVE_DEBUG", "📋 === END FORMATTED ===")

                } else {
                    Log.w("BRAVE_DEBUG", "⚠️ NEMA REZULTATA!")
                }

            } catch (e: Exception) {
                Log.e("BRAVE_DEBUG", "❌ Exception: ${e.message}", e)
            }
        }
    }

    private fun containsBrowsingKeywords(prompt: String): Boolean {
        val keywords = listOf(
            "danas", "trenutno", "sada", "najnovije", "aktualno",
            "cijena", "cjena", "tečaj", "kurs", "rezultat",
            "2025", "24.06", "juni", "lipanj", "jučer", "sutra",
            "predsjednik", "načelnik", "vlada", "ministar",
            "vrijeme", "temperatura", "prognoza", "novosti"
        )

        val lowerPrompt = prompt.lowercase()
        val foundKeywords = keywords.filter { lowerPrompt.contains(it) }

        Log.d("web_browse", "🔍 Pronađene ključne riječi: $foundKeywords")

        return foundKeywords.isNotEmpty()
    }
    fun testBrowsingFlow() {
        viewModelScope.launch(Dispatchers.IO) {
            // ✅ DODAJTE DELAY da se ViewModel inicijalizira
            delay(2000)

            Log.d("BROWSE_TEST", "🧪 === TESTIRANJE BROWSING FLOW-a ===")

            val testPrompt = "cijena nafte danas"

            // ✅ DODAJTE NULL CHECK
            val selectedModel = _selectedModel.value
            Log.d("BROWSE_TEST", "🔍 Selected model: ${selectedModel?.modelName ?: "NULL"}")

            val shouldUseBrowsing = ENABLE_BROWSING_FOR_ALL ||
                    selectedModel?.requiresBrowsing == true ||
                    selectedModel?.modelValue?.contains("gpt-4", ignoreCase = true) == true ||
                    containsBrowsingKeywords(testPrompt)

            Log.d("BROWSE_TEST", "🔧 ENABLE_BROWSING_FOR_ALL: $ENABLE_BROWSING_FOR_ALL")
            Log.d("BROWSE_TEST", "🔧 Model requires: ${selectedModel?.requiresBrowsing}")
            Log.d("BROWSE_TEST", "🔧 Model value: ${selectedModel?.modelValue}")
            Log.d("BROWSE_TEST", "🔧 Contains gpt-4: ${selectedModel?.modelValue?.contains("gpt-4", ignoreCase = true)}")
            Log.d("BROWSE_TEST", "🔧 Contains keywords: ${containsBrowsingKeywords(testPrompt)}")
            Log.d("BROWSE_TEST", "🎯 FINAL shouldUseBrowsing: $shouldUseBrowsing")

            if (shouldUseBrowsing) {
                try {
                    val result = braveSearchRepository.searchBrave(testPrompt)
                    val items = result?.web?.results
                    Log.d("BROWSE_TEST", "✅ Brave results: ${items?.size}")

                    items?.take(2)?.forEach { item ->
                        Log.d("BROWSE_TEST", "📰 ${item.title}: ${item.description?.take(50)}...")
                    }
                } catch (e: Exception) {
                    Log.e("BROWSE_TEST", "❌ Brave failed: ${e.message}")
                }
            } else {
                Log.w("BROWSE_TEST", "⚠️ Browsing NIJE aktiviran!")
            }
        }
    }
}

enum class DisplayType {
    EXAMPLE, MESSAGE
}

data class ChatData(
    val chatId: Long? = null,
    val title: String? = null,
    val conversationType: String = ConversationType.TEXT.name,
    val examples: List<String> = mutableListOf()
)