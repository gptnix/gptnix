package com.nextgptapp.here.data.repository

import android.content.Context
import android.net.Uri
import android.util.Log
import com.google.gson.Gson
import com.nextgptapp.here.components.ApiKeyHelpers
import com.nextgptapp.here.components.AppLogger
import com.nextgptapp.here.components.Utils
import com.nextgptapp.here.data.model.AsticaVisionRequest
import com.nextgptapp.here.data.model.Content
import com.nextgptapp.here.data.model.ContentResponse
import com.nextgptapp.here.data.model.FileData
import com.nextgptapp.here.data.model.GPTRequestParam
import com.nextgptapp.here.data.model.GPTRole
import com.nextgptapp.here.data.model.GoogleApiModel
import com.nextgptapp.here.data.model.GoogleApiResponseModel
import com.nextgptapp.here.data.model.InlineData
import com.nextgptapp.here.data.model.ModerationRequest
import com.nextgptapp.here.data.model.Part
import com.nextgptapp.here.data.model.ProgressRequestBody
import com.nextgptapp.here.data.model.VisionRequest
import com.nextgptapp.here.data.source.remote.AIVisionService
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit  // ← DODAJTE OVO
import javax.inject.Inject
import com.nextgptapp.here.data.repository.BraveSearchRepository
import com.nextgptapp.here.data.model.GPTMessage
import com.nextgptapp.here.data.model.browse.WebContent


interface ChatRepository {

    fun textCompletionsWithStream(scope: CoroutineScope, request: GPTRequestParam): Flow<String>

    fun textCompletionsWith(request: GPTRequestParam): Flow<String>

    fun textCompletionsWithVision(request: VisionRequest): Flow<String>

    fun textCompletionsWithVision(request: AsticaVisionRequest): Flow<String>

    fun textCompletionsWithStreamGemini(
        scope: CoroutineScope,
        request: GPTRequestParam,
        baseUrl: String = "https://generativelanguage.googleapis.com/v1beta/"
    ): Flow<String>

    fun textCompletionsWithGeminiVision(request: VisionRequest): Flow<String>

    fun textCompletionsWithGeminiVision(
        prompt: String,
        mimeType: String,
        uri: Uri
    ): Flow<ContentResponse>

    fun textCompletionsWithStreamOpenAI(
        scope: CoroutineScope,
        requestParam: GPTRequestParam,
        baseUrl: String = "https://api.openai.com/v1/"
    ): Flow<String>

    fun textCompletionsWithStreamGroq(
        scope: CoroutineScope,
        requestParam: GPTRequestParam,
        baseUrl: String = "https://api.groq.com/openai/v1/"
    ): Flow<String>

    fun textCompletionsWithStreamTogether(
        scope: CoroutineScope,
        requestParam: GPTRequestParam,
        baseUrl: String = "https://api.together.xyz/v1/"
    ): Flow<String>

    fun textCompletionsWithStreamDynamic(
        scope: CoroutineScope,
        request: GPTRequestParam,
        modelSource: String = "openai",
        baseUrl: String = "https://api.openai.com/v1/"
    ): Flow<String>
    suspend fun preparePromptWithBrave(userPrompt: String): List<GPTMessage>
}

private const val MATCH_STRING = "\"text\":"

class ChatRepositoryImpl @Inject constructor(
    @ApplicationContext val application: Context,
    private val aiVisionService: AIVisionService,
    private val apiKeyHelpers: ApiKeyHelpers,
    private val braveSearchRepository: BraveSearchRepository,
    private val okHttpClient: OkHttpClient  // ✅ DODAO INJEKTIRANI CLIENT
) : ChatRepository {

    private val FlaggedMsg = "Failure! Your prompt is flagged as inappropriate and Its against our privacy policy. Please try again with some different context."

    override fun textCompletionsWithStream(
        scope: CoroutineScope,
        request: GPTRequestParam
    ): Flow<String> = callbackFlow {
        withContext(Dispatchers.IO) {
            runCatching {

                Log.d("OLD_DEBUG", "🔄 === STARA METODA DEBUG ===")
                Log.d("OLD_DEBUG", "📤 Request parametri:")
                Log.d("OLD_DEBUG", "📤 Model: ${request.model}")
                Log.d("OLD_DEBUG", "📤 Stream: ${request.stream}")
                Log.d("OLD_DEBUG", "📤 Temperature: ${request.temperature}")
                Log.d("OLD_DEBUG", "📤 ApiKey: ${request.apiKey}")
                Log.d("OLD_DEBUG", "📤 ApiEndpoint: ${request.apiEndpoint}")
                Log.d("OLD_DEBUG", "📤 Messages count: ${request.messages.size}")
                request.messages.forEachIndexed { index, msg ->
                    Log.d("OLD_DEBUG", "📤 Message $index: ${msg.role} -> '${msg.content}'")
                }

                val apiKey = apiKeyHelpers.getApiKey()
                Log.d("OLD_DEBUG", "🔑 API Key duljina: ${apiKey.length}")
                Log.d("OLD_DEBUG", "🔑 API Key početak: ${apiKey.take(15)}...")

                if (apiKey.isEmpty()) {
                    Log.e("OLD_DEBUG", "❌ KRITIČNA GREŠKA: API Key je prazan!")
                    trySend("Failure! API Key not configured.")
                    close()
                    return@runCatching
                }

                if (apiKey.startsWith("sk-proj-")) {
                    Log.d("OLD_DEBUG", "⚠️ Project API key detected - preskačem moderation")
                } else {
                    Log.d("OLD_DEBUG", "🔍 Pokretam moderation check...")

                    val moderationResult = aiVisionService.inputModerations(
                        ModerationRequest(request.messages.last().content),
                        "Bearer $apiKey"
                    ).execute()

                    if (moderationResult.isSuccessful && moderationResult.body()?.results?.get(0)?.flagged == true) {
                        trySend("Failure! Your request is flagged as inappropriate.")
                        close()
                        return@runCatching
                    }
                }

                val auth = "Bearer $apiKey"
                Log.d("OLD_DEBUG", "🌐 Pozivam aiVisionService.textCompletionsWithStream...")
                Log.d("OLD_DEBUG", "🎯 Authorization: Bearer ${apiKey.take(10)}...")

                // ✅ KLJUČNI DIO - POZIV KROZ RETROFIT
                val response = aiVisionService.textCompletionsWithStream(request, auth).execute()

                Log.d("OLD_DEBUG", "📡 HTTP Response kod: ${response.code()}")
                Log.d("OLD_DEBUG", "📡 Response successful: ${response.isSuccessful}")
                Log.d("OLD_DEBUG", "📡 Response headers: ${response.headers()}")

                // ✅ PROVJERI RESPONSE BODY
                val responseBody = response.body()
                Log.d("OLD_DEBUG", "📦 Response body: ${responseBody != null}")
                Log.d("OLD_DEBUG", "📦 Response body klasa: ${responseBody?.javaClass?.simpleName}")

                if (responseBody != null) {
                    val source = responseBody.source()
                    Log.d("OLD_DEBUG", "🧵 Response source klasa: ${source.javaClass.simpleName}")
                    val buffer = source.buffer
                    Log.d("OLD_DEBUG", "🧵 Response buffer klasa: ${buffer.javaClass.simpleName}")
                    Log.d("OLD_DEBUG", "🧵 Response buffer size: ${buffer.size}")
                    Log.d("OLD_DEBUG", "🧵 Response buffer exhausted: ${buffer.exhausted()}")
                }

                if (response.isSuccessful) {
                    Log.d("OLD_DEBUG", "✅ OpenAI API poziv uspješan!")

                    val inputStream = response.body()?.byteStream()?.bufferedReader()
                        ?: throw Exception("Response body is null")

                    Log.d("OLD_DEBUG", "📖 InputStream kreiran, započinje čitanje...")

                    try {
                        var ts = System.currentTimeMillis()
                        var lineCount = 0
                        var hasContent = false

                        while (true) {
                            val line = withContext(Dispatchers.IO) {
                                inputStream.readLine()
                            } ?: continue

                            lineCount++
                            if (lineCount <= 5) {
                                Log.d("OLD_DEBUG", "📄 Line $lineCount: $line")
                            }

                            if (line == "data: [DONE]") {
                                Log.d("OLD_DEBUG", "✅ Stream završen ([DONE])")
                                if (!hasContent) {
                                    trySend("No content received from AI.")
                                }
                                close()
                                break
                            } else if (line.startsWith("data:")) {
                                try {
                                    val value = parseResponse(line)

                                    val currentTS = System.currentTimeMillis()
                                    if (value.isNotEmpty()) {
                                        if (!hasContent) {
                                            hasContent = true
                                            Log.d("OLD_DEBUG", "💬 Prvi sadržaj: ${value.take(50)}...")
                                        }
                                        trySend(value)

                                        val diff = currentTS - ts
                                        if (diff < 30) delay(30 - diff)
                                        ts = currentTS
                                    }

                                } catch (e: Exception) {
                                    Log.e("OLD_DEBUG", "❌ Exception parsing: ${e.message}", e)
                                    trySend("Greška: ${e.localizedMessage ?: "Nepoznata greška"}")
                                }
                            }

                            if (!scope.isActive) {
                                Log.d("OLD_DEBUG", "🛑 Scope not active, prekidam")
                                break
                            }
                        }

                        Log.d("OLD_DEBUG", "📊 === STATISTIKA STARE METODE ===")
                        Log.d("OLD_DEBUG", "📊 Ukupno linija: $lineCount")
                        Log.d("OLD_DEBUG", "📊 Ima sadržaj: $hasContent")

                    } catch (e: IOException) {
                        Log.e("OLD_DEBUG", "❌ IOException: ${e.message}", e)
                        trySend("Greška: ${e.localizedMessage ?: "IOException"}")
                    } finally {
                        withContext(Dispatchers.IO) {
                            inputStream.close()
                        }
                        close()
                    }

                } else {
                    Log.e("OLD_DEBUG", "❌ OpenAI API poziv NEUSPJEŠAN! Kod: ${response.code()}")

                    try {
                        val errorBody = response.errorBody()?.string()
                        Log.e("OLD_DEBUG", "❌ Error body: $errorBody")

                        when (response.code()) {
                            401 -> trySend("Failure! Invalid API key.")
                            429 -> trySend("Failure! Rate limit exceeded.")
                            400 -> trySend("Failure! Invalid request.")
                            402 -> trySend("Failure! Insufficient credits.")
                            else -> trySend("Failure! API error (${response.code()}).")
                        }
                    } catch (e: Exception) {
                        Log.e("OLD_DEBUG", "❌ Error parsing error response: ${e.message}")
                        trySend("Failure! Try again later.")
                    }
                    close()
                }

            }.onFailure {
                Log.e("OLD_DEBUG", "❌ Exception: ${it.message}", it)
                trySend("Network Failure! Try again.")
                close()
            }
        }
    }.flowOn(Dispatchers.IO)

    override fun textCompletionsWith(
        request: GPTRequestParam
    ): Flow<String> = flow {
        try {
            val apiKey = request.apiKey ?: apiKeyHelpers.getApiKey()
            val base = request.apiEndpoint ?: "https://api.openai.com/v1/"
            val url = base.removeSuffix("/") + "/chat/completions"

            val json = buildJsonObject {
                put("model", request.model)
                put("stream", false)
                put("temperature", request.temperature ?: 0.7f)
                put("messages", buildJsonArray {
                    request.messages.forEach { msg ->
                        add(buildJsonObject {
                            put("role", msg.role)
                            put("content", msg.content)
                        })
                    }
                })
            }.toString()

            Log.d("NON_STREAM", "📤 Request payload: $json")
            Log.d("NON_STREAM", "🌍 URL: $url")

            // ✅ POPRAVKA: Koristim injektirani client
            val req = Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer $apiKey")
                .addHeader("Content-Type", "application/json")
                .post(json.toRequestBody("application/json".toMediaType()))
                .build()

            val response = okHttpClient.newCall(req).execute()
            val body = response.body?.string()

            if (!response.isSuccessful || body == null) {
                Log.e("NON_STREAM", "❌ Greška: ${response.code} | Body: $body")
                emit("Greška: ${response.code}")
                return@flow
            }

            Log.d("NON_STREAM", "✅ JSON Response: $body")

            val parsed = Json.parseToJsonElement(body).jsonObject
            val content = parsed["choices"]
                ?.jsonArray?.firstOrNull()?.jsonObject
                ?.get("message")?.jsonObject
                ?.get("content")?.jsonPrimitive?.content

            if (content != null) {
                emit(content)
            } else {
                emit("⚠️ Nema sadržaja u odgovoru.")
            }

        } catch (e: Exception) {
            Log.e("NON_STREAM", "❌ Exception: ${e.message}", e)
            emit("Greška: ${e.message}")
        }
    }

    override fun textCompletionsWithVision(request: VisionRequest): Flow<String> = flow {
        runCatching {
            aiVisionService.askAIVision(request, "Bearer ${apiKeyHelpers.getApiKey()}")
        }.onSuccess {
            Log.e("REsponse", "$it")
            it.choices?.let { choice ->
                Log.e("Choice", "$choice")
                choice[0].message.content.let { txt ->
                    emit(txt)
                }
            }
        }.onFailure {
            it.printStackTrace()
            emit("Failure! Try again later.")
        }
    }

    override fun textCompletionsWithVision(request: AsticaVisionRequest): Flow<String> = flow {
        runCatching {
            Log.e("Request", "${request.visionParams}")
            aiVisionService.askAsticaVisionAI(request)
        }.onSuccess {
            Log.e("REsponse", "$it")
            it.let { result ->
                Log.e("Choice", "$result")
                if (result.status.contentEquals("success")) {
                    if (!result.captionGPTS.isNullOrEmpty()) {
                        emit(result.captionGPTS)
                    } else if (result.caption != null) {
                        emit(result.caption.text)
                    } else if (!result.tags.isNullOrEmpty()) {
                        var tags = ""
                        result.tags.forEach {
                            tags += if (tags.isEmpty())
                                "#${it.name}"
                            else
                                ", #${it.name}"
                        }
                        emit(tags)
                    } else if (!result.objects.isNullOrEmpty()) {
                        var tags = ""
                        result.objects.forEach {
                            tags += if (tags.isEmpty())
                                "${it.name}"
                            else
                                ", ${it.name}"
                        }
                        emit(tags)
                    } else if (result.asticaOCR != null) {
                        emit(result.asticaOCR.content)
                    } else {
                        emit("Failure! can't analysed the image")
                    }
                } else {
                    emit("Failure! can't analysed the image.")
                }
            }
        }.onFailure {
            it.printStackTrace()
            emit("Failure! Try again later.")
        }
    }

    override fun textCompletionsWithStreamGemini(
        scope: CoroutineScope,
        request: GPTRequestParam,
        baseUrl: String
    ): Flow<String> = callbackFlow {
        withContext(Dispatchers.IO) {
            runCatching {
                val content = mutableListOf<Content>()
                request.messages.forEach {
                    val role = when (it.role) {
                        GPTRole.ASSISTANT.name -> "model"
                        GPTRole.USER.name -> "user"
                        else -> "user"
                    }
                    content.add(Content(role, listOf(Part(it.content))))
                }

                val apiRequest = GoogleApiModel(content)
                val jsonToSend = Gson().toJson(apiRequest)

                Log.d("GEMINI", "📤 Sending request JSON: $jsonToSend")
                Log.d("GEMINI", "🔑 Using Gemini key: ${apiKeyHelpers.getGeminiKey().take(10)}...")

                val response = aiVisionService
                    .generateContent(apiKeyHelpers.getGeminiKey(), apiRequest)
                    .execute()

                if (response.isSuccessful) {
                    Log.d("GEMINI", "✅ Gemini response: ${response.code()} ${response.message()}")
                    response.body()?.let { responseBody ->
                        val source = responseBody.source()
                        while (!source.exhausted()) {
                            val line = source.readUtf8Line()
                            line?.let {
                                val value = parseGeminiResponse(line)
                                if (value.isNotEmpty())
                                    trySend(value)
                            }
                            if (!scope.isActive) break
                        }
                    }
                    close()
                } else {
                    Log.e("GEMINI", "❌ Gemini HTTP Error: ${response.code()} - ${response.message()}")
                    try {
                        val errorJson = response.errorBody()?.string()
                        Log.e("GEMINI", "❌ Gemini error body: $errorJson")
                    } catch (e: Exception) {
                        Log.e("GEMINI", "❌ Failed to parse error body: ${e.message}", e)
                    }

                    if (response.code() == 503) {
                        trySend("Failure!:The model is overloaded. Please try again later.")
                    } else {
                        trySend("Failure!:Try again later.")
                    }
                    close()
                }
            }.onFailure {
                Log.e("GEMINI", "❌ Exception: ${it.message}", it)
                trySend("Network Failure! Try again.")
                close()
            }
        }
    }.flowOn(Dispatchers.IO)

    override fun textCompletionsWithGeminiVision(request: VisionRequest): Flow<String> =
        callbackFlow {
            withContext(Dispatchers.IO) {
                runCatching {
                    val content = mutableListOf<Content>()
                    val inlineData = InlineData(
                        mime_type = "image/jpeg",
                        data = request.messages[0].content[1].imageUrl!!.url
                    )
                    val parts = listOf(
                        Part(text = request.messages[0].content[0].text!!),
                        Part(inline_data = inlineData)
                    )
                    content.add(Content(parts = parts))
                    val apiRequest = GoogleApiModel(content)
                    val response =
                        aiVisionService.askTextWithVision(apiKeyHelpers.getApiKey(), apiRequest)
                            .execute()
                    if (response.isSuccessful) {
                        response.body()?.let { apiResponse ->
                            if (apiResponse.candidates[0].finishReason != null && apiResponse.candidates[0].finishReason.contentEquals(
                                    "SAFETY"
                                )
                            ) {
                                trySend(FlaggedMsg)
                            } else {
                                apiResponse.candidates[0].content.parts.forEach { part ->
                                    println("Response text: ${part.text}")
                                    trySend(part.text!!)
                                }
                            }
                        }
                        close()

                    } else {
                        if (!response.isSuccessful) {
                            var jsonObject: JSONObject? = null
                            try {
                                jsonObject = JSONObject(response.errorBody()!!.string())
                                println(jsonObject)
                            } catch (e: JSONException) {
                                e.printStackTrace()
                            }
                        }

                        if (response.code() == 503) {
                            trySend("Failure!:The model is overloaded. Please try again later.")
                        } else {
                            trySend("Failure!:Try again later.")
                        }
                        close()
                    }
                }.onFailure {
                    it.printStackTrace()
                    trySend("Network Failure! Try again.")
                    close()
                }
            }

        }.flowOn(Dispatchers.IO)

    override fun textCompletionsWithGeminiVision(
        prompt: String,
        mimeType: String,
        uri: Uri
    ): Flow<ContentResponse> = callbackFlow<ContentResponse> {

        runCatching {
            val videoFile = Utils.getFileFromUri(context = application, uri = uri)!!
            AppLogger.logE("Chat Repo", "File Path:${videoFile.absolutePath}")

            val contentLength = videoFile.length()
            val displayName = videoFile.name

            val requestBody = RequestBody.create(
                "application/json".toMediaTypeOrNull(),
                "{\"file\": {\"display_name\": \"$displayName\"}}"
            )

            val initializeResponse = aiVisionService.initializeUpload(
                apiKey = apiKeyHelpers.getApiKey(),
                contentLength = contentLength,
                mimeType = mimeType,
                requestBody = requestBody
            )

            if (initializeResponse.isSuccessful && initializeResponse.headers()["X-Goog-Upload-URL"] != null) {

                val uploadUrl = initializeResponse.headers()["X-Goog-Upload-URL"]!!

                val progressBody = ProgressRequestBody(videoFile, mimeType) { progress ->
                    println("Upload Progress: $progress%")
                    trySend(ContentResponse.Progress(progress))
                }

                val uploadResponse = aiVisionService.uploadFile(
                    uploadUrl = uploadUrl,
                    contentLength = contentLength,
                    offset = 0,
                    file = progressBody
                )

                if (uploadResponse.isSuccessful) {

                    val fileUri = uploadResponse.body()?.file?.uri
                    val fileId = uploadResponse.body()?.file?.name?.replace("files/", "")
                    AppLogger.logE("Chat Repo", "fileId:${fileId} uri:${fileUri}")
                    if (fileId != null && fileUri != null) {

                        var state: String
                        do {
                            println("Checking file status...")
                            val fileStatusResponse =
                                aiVisionService.checkFileStatus(fileId, apiKeyHelpers.getApiKey())
                            state = fileStatusResponse.body()?.state ?: "UNKNOWN"
                            println("File state: $state")

                            if (state == "PROCESSING") {
                                println("Processing video...")
                                delay(5000)
                            }

                        } while (state == "PROCESSING")

                        if (state == "ACTIVE") {

                            val content = mutableListOf<Content>()
                            val fileData = FileData(mimeType, fileUri)

                            val parts = listOf(
                                Part(text = prompt),
                                Part(fileData = fileData)
                            )
                            content.add(Content(parts = parts))
                            val apiRequest = GoogleApiModel(content)
                            val response =
                                aiVisionService.askTextWithVision(
                                    apiKeyHelpers.getApiKey(),
                                    apiRequest
                                ).execute()
                            if (response.isSuccessful) {
                                response.body()?.let { apiResponse ->
                                    if (apiResponse.candidates[0].finishReason != null && apiResponse.candidates[0].finishReason.contentEquals(
                                            "SAFETY"
                                        )
                                    ) {
                                        trySend(ContentResponse.Error(FlaggedMsg))
                                    } else {
                                        apiResponse.candidates[0].content.parts.forEach { part ->
                                            println("Response text: ${part.text}")
                                            trySend(ContentResponse.Text(part.text!!))
                                        }
                                    }
                                }
                                close()

                            } else {
                                if (!response.isSuccessful) {
                                    var jsonObject: JSONObject? = null
                                    try {
                                        jsonObject = JSONObject(response.errorBody()!!.string())
                                        println(jsonObject)
                                    } catch (e: JSONException) {
                                        e.printStackTrace()
                                    }
                                }
                                if (response.code() == 503) {
                                    trySend(ContentResponse.Error("Failure!:The model is overloaded. Please try again later."))
                                } else {
                                    trySend(ContentResponse.Error("Failure!:Try again later."))
                                }
                                close()
                            }

                        } else {
                            trySend(ContentResponse.Error("Network Failure! Try again."))
                            close()
                        }

                    } else {
                        trySend(ContentResponse.Error("Network Failure! Try again."))
                        close()
                    }

                } else {
                    trySend(ContentResponse.Error("Network Failure! Try again."))
                    close()
                }

            } else {
                trySend(ContentResponse.Error("Network Failure! Try again."))
                close()
            }

        }.onFailure {
            it.printStackTrace()
            trySend(ContentResponse.Error("Network Failure! Try again."))
            close()
        }
    }.flowOn(Dispatchers.IO)

    override fun textCompletionsWithStreamDynamic(
        scope: CoroutineScope,
        request: GPTRequestParam,
        modelSource: String,
        baseUrl: String
    ): Flow<String> {
        val source = modelSource.lowercase()

        Log.d("DYNAMIC_DEBUG", "🎯 === textCompletionsWithStreamDynamic POZVAN ===")
        Log.d("DYNAMIC_DEBUG", "🎯 Model: ${request.model}")
        Log.d("DYNAMIC_DEBUG", "🏷️ Source: $modelSource")
        Log.d("DYNAMIC_DEBUG", "🔗 Base URL: $baseUrl")
        Log.d("DYNAMIC_DEBUG", "📨 Messages count: ${request.messages.size}")

        request.messages.forEach { msg ->
            Log.d("DYNAMIC_DEBUG", "📝 Message: ${msg.role} -> ${msg.content.take(50)}...")
        }

        return when (source) {
            "groq" -> {
                Log.d("DYNAMIC_DEBUG", "🦙 Preusmjeravam na Groq API")
                textCompletionsWithStreamGroq(scope, request, baseUrl)
            }
            "deepseek" -> {
                Log.d("DYNAMIC_DEBUG", "🧠 Preusmjeravam na DeepSeek API")
                textCompletionsWithStreamDeepSeek(scope, request, baseUrl)
            }
            "chutes" -> {
                Log.d("DYNAMIC_DEBUG", "🚀 Preusmjeravam na Chutes API (koristi DeepSeek endpoint)")
                textCompletionsWithStreamDeepSeek(scope, request, baseUrl)
            }
            "google", "gemini" -> {
                Log.d("DYNAMIC_DEBUG", "🔥 Preusmjeravam na Gemini API")
                textCompletionsWithStreamGemini(scope, request, baseUrl)
            }
            "together" -> {
                Log.d("DYNAMIC_DEBUG", "🤝 Preusmjeravam na Together API")
                textCompletionsWithStreamTogether(scope, request, baseUrl)
            }
            "openai" -> {
                Log.d("DYNAMIC_DEBUG", "🔄 KORISTIM STARU METODU ZA OPENAI")
                textCompletionsWithStream(scope, request)
            }
            else -> {
                Log.w("DYNAMIC_DEBUG", "⚠️ Nepoznat modelSource: $modelSource — koristim fallback STARU METODU")
                textCompletionsWithStream(scope, request)
            }
        }
    }

    override fun textCompletionsWithStreamOpenAI(
        scope: CoroutineScope,
        requestParam: GPTRequestParam,
        baseUrl: String
    ): Flow<String> = callbackFlow {
        Log.d("OPENAI_DEBUG", "🤖 === POČETAK textCompletionsWithStreamOpenAI ===")
        Log.d("OPENAI_DEBUG", "🌍 BaseURL primljen: '$baseUrl'")
        Log.d("OPENAI_DEBUG", "🎯 Model: '${requestParam.model}'")

        withContext(Dispatchers.IO) {
            try {
                val apiKey = requestParam.apiKey ?: apiKeyHelpers.getApiKey()
                Log.d("OPENAI_DEBUG", "🗝️ API Key duljina: ${apiKey?.length}")

                if (apiKey.isNullOrBlank()) {
                    Log.e("OPENAI_DEBUG", "❌ KRITIČNO: API Key je prazan!")
                    trySend("❌ Nema API ključa za model: ${requestParam.model}")
                    close()
                    return@withContext
                }

                val url = baseUrl.removeSuffix("/") + "/chat/completions"
                Log.d("OPENAI_DEBUG", "🌍 Finalni URL: '$url'")

                val json = buildJsonObject {
                    put("model", requestParam.model)
                    put("stream", true)
                    put("temperature", requestParam.temperature ?: 0.7f)
                    put("messages", buildJsonArray {
                        requestParam.messages.forEach { msg ->
                            add(buildJsonObject {
                                put("role", msg.role)
                                put("content", msg.content)
                            })
                        }
                    })
                }.toString()

                Log.d("OPENAI_DEBUG", "📤 JSON payload: $json")

                // ✅ INJEKTIRANI CLIENT DEBUG
                Log.d("OPENAI_DEBUG", "🔧 Injektirani client interceptors: ${okHttpClient.interceptors.size}")
                okHttpClient.interceptors.forEachIndexed { index, interceptor ->
                    Log.d("OPENAI_DEBUG", "🔧 Interceptor $index: ${interceptor.javaClass.simpleName}")
                }

                // ✅ EKSPERIMENT: Kreiraj potpuno novi client
                Log.d("OPENAI_DEBUG", "🧪 EKSPERIMENT: Kreiram potpuno novi OkHttpClient...")

                val freshClient = OkHttpClient.Builder()
                    .readTimeout(60, TimeUnit.SECONDS)
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(60, TimeUnit.SECONDS)
                    .build()

                Log.d("OPENAI_DEBUG", "🧪 Fresh client interceptors: ${freshClient.interceptors.size}")
                Log.d("OPENAI_DEBUG", "🧪 Fresh client network interceptors: ${freshClient.networkInterceptors.size}")
                Log.d("OPENAI_DEBUG", "📚 OkHttp verzija: ${okhttp3.OkHttp.VERSION}")

                val request = Request.Builder()
                    .url(url)
                    .addHeader("Authorization", "Bearer $apiKey")
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Accept", "text/event-stream")           // ✅ KLJUČNI HEADER
                    .addHeader("Cache-Control", "no-cache")             // ✅ SPRJEČAVA CACHE
                    .addHeader("Connection", "keep-alive")              // ✅ DRŽI KONEKCIJU
                    .addHeader("User-Agent", "okhttp/4.12.0")          // ✅ USER AGENT
                    .post(json.toRequestBody("application/json".toMediaType()))
                    .build()

                Log.d("OPENAI_DEBUG", "📬 Request headers nakon popravka:")
                request.headers.forEach { (name, value) ->
                    Log.d("OPENAI_DEBUG", "📬   $name: $value")
                }

                Log.d("OPENAI_DEBUG", "📡 === POČETAK NETWORK POZIVA (FRESH CLIENT + HEADERS) ===")

// ✅ KORISTITE FRESH CLIENT umjesto injektiranog
                freshClient.newCall(request).execute().use { response ->
                    Log.d("OPENAI_DEBUG", "🧪 Fresh client response status: ${response.code}")
                    Log.d("OPENAI_DEBUG", "🧪 Fresh client response successful: ${response.isSuccessful}")
                    Log.d("OPENAI_DEBUG", "🧪 Response content-type: ${response.header("content-type")}")

                    if (!response.isSuccessful) {
                        Log.e("OPENAI_DEBUG", "❌ Fresh client response NIJE uspješan!")
                        val errorBody = response.body?.string()
                        Log.e("OPENAI_DEBUG", "❌ Fresh client error body: $errorBody")
                        trySend("❌ Greška: ${response.code}")
                        close()
                        return@use
                    }

                    val body = response.body
                    if (body == null) {
                        Log.e("OPENAI_DEBUG", "❌ Fresh client body je null!")
                        trySend("❌ Prazan body")
                        close()
                        return@use
                    }

                    Log.d("OPENAI_DEBUG", "📦 Fresh body klasa: ${body.javaClass.simpleName}")
                    val source = body.source()
                    Log.d("OPENAI_DEBUG", "🧵 Fresh source klasa: ${source.javaClass.simpleName}")
                    val buffer = source.buffer
                    Log.d("OPENAI_DEBUG", "🧵 Fresh buffer klasa: ${buffer.javaClass.simpleName}")
                    Log.d("OPENAI_DEBUG", "🧵 Fresh buffer size: ${buffer.size}")
                    Log.d("OPENAI_DEBUG", "🧪 Fresh client source exhausted: ${buffer.exhausted()}")

                    if (buffer.exhausted()) {
                        Log.e("OPENAI_DEBUG", "❌ ČAK I S HEADERS - FRESH CLIENT JE EXHAUSTED!")
                        Log.e("OPENAI_DEBUG", "❌ Response headers: ${response.headers}")

                        // ✅ POKUŠAJ PEEK DA VIDIMO ZAŠTO JE PRAZAN
                        try {
                            val peek = buffer.peek()
                            val available = peek.buffer.size
                            Log.e("OPENAI_DEBUG", "🔍 Peek buffer size: $available")
                            if (available > 0) {
                                val sample = peek.readUtf8(minOf(available, 200))
                                Log.e("OPENAI_DEBUG", "🔍 Peek sadržaj: '$sample'")
                            }
                        } catch (e: Exception) {
                            Log.e("OPENAI_DEBUG", "❌ Peek error: ${e.message}")
                        }

                        trySend("❌ Stream exhausted čak i s headers")
                        close()
                        return@use
                    }

                    Log.d("OPENAI_DEBUG", "✅ FRESH CLIENT + HEADERS RADI! Stream je dostupan!")
                    Log.d("OPENAI_DEBUG", "🧵 === POČETAK STREAMANJA ===")

                    var receivedChunks = 0
                    var lineCount = 0

                    while (!buffer.exhausted()) {
                        lineCount++
                        val line = buffer.readUtf8Line()

                        if (line == null) {
                            Log.d("OPENAI_DEBUG", "🔍 Line $lineCount je null, nastavljam...")
                            continue
                        }
                        if (line.isEmpty()) {
                            Log.d("OPENAI_DEBUG", "📭 Line $lineCount prazan")
                            continue
                        }

                        Log.d("OPENAI_DEBUG", "🟨 Line $lineCount: $line")

                        if (line == "data: [DONE]") {
                            Log.d("OPENAI_DEBUG", "✅ Stream završen ([DONE])")
                            break
                        }

                        if (line.startsWith("data:")) {
                            val jsonLine = line.removePrefix("data:").trim()
                            if (jsonLine.isEmpty()) {
                                Log.d("OPENAI_DEBUG", "📭 JSON line prazan nakon trim")
                                continue
                            }

                            try {
                                val parsed = Json.parseToJsonElement(jsonLine).jsonObject
                                val choice = parsed["choices"]?.jsonArray?.firstOrNull()?.jsonObject
                                val delta = choice?.get("delta")?.jsonObject
                                val content = delta?.get("content")?.jsonPrimitive?.content

                                if (!content.isNullOrBlank()) {
                                    Log.d("OPENAI_DEBUG", "💬 Content chunk: '$content'")
                                    trySend(content)
                                    receivedChunks++
                                    delay(30) // Rate limiting
                                }

                            } catch (e: Exception) {
                                Log.e("OPENAI_DEBUG", "❌ JSON parsing error: ${e.message}")
                                Log.e("OPENAI_DEBUG", "❌ Problematični JSON: '$jsonLine'")
                            }
                        }
                    }

                    Log.d("OPENAI_DEBUG", "📊 === FINALNA STATISTIKA ===")
                    Log.d("OPENAI_DEBUG", "📊 Ukupno linija: $lineCount")
                    Log.d("OPENAI_DEBUG", "📊 Ukupno chunks: $receivedChunks")

                    if (receivedChunks == 0) {
                        Log.w("OPENAI_DEBUG", "⚠️ FRESH CLIENT + HEADERS: NEMA CONTENT CHUNKS!")
                    } else {
                        Log.d("OPENAI_DEBUG", "✅ FRESH CLIENT + HEADERS: Uspješno primio $receivedChunks chunks!")
                    }
                }

            } catch (e: Exception) {
                Log.e("OPENAI_DEBUG", "❌ Exception: ${e.message}", e)
                trySend("❌ Network greška: ${e.message}")
            } finally {
                Log.d("OPENAI_DEBUG", "🔚 === ZATVARANJE FLOW-a ===")
                close()
            }
        }
    }.flowOn(Dispatchers.IO)

    override fun textCompletionsWithStreamGroq(
        scope: CoroutineScope,
        requestParam: GPTRequestParam,
        baseUrl: String
    ): Flow<String> = callbackFlow {
        withContext(Dispatchers.IO) {
            val apiKey = apiKeyHelpers.getGroqKey()
            Log.d("ChatRepository", "🔑 Groq API Key: ${apiKey.take(10)}...")

            if (apiKey.isBlank()) {
                trySend("❌ Nema Groq API ključa").also { close() }
                return@withContext
            }

            val url = baseUrl.removeSuffix("/") + "/chat/completions"
            Log.d("ChatRepository", "🌍 Groq URL: $url")

            val json = buildJsonObject {
                put("model", requestParam.model)
                put("stream", true)
                put("temperature", requestParam.temperature ?: 0.7f)
                put("messages", buildJsonArray {
                    requestParam.messages.forEach { msg ->
                        add(buildJsonObject {
                            put("role", msg.role)
                            put("content", msg.content)
                        })
                    }
                })
            }.toString()

            val request = Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer $apiKey")
                .addHeader("Content-Type", "application/json")
                .post(json.toRequestBody("application/json".toMediaType()))
                .build()

            try {
                // ✅ POPRAVKA: Koristim injektirani client
                okHttpClient.newCall(request).execute().use { response ->
                    Log.d("ChatRepository", "📥 Groq Status code: ${response.code}")

                    if (!response.isSuccessful) {
                        val errorBody = response.body?.string()
                        Log.e("ChatRepository", "❌ Groq error: ${response.code} | $errorBody")
                        trySend("❌ Groq greška: ${response.code}").also { close() }
                        return@use
                    }

                    val inputStream = response.body?.byteStream()?.bufferedReader()
                        ?: throw Exception("Response body is null")

                    try {
                        var ts = System.currentTimeMillis()
                        while (true) {
                            val line = withContext(Dispatchers.IO) {
                                inputStream.readLine()
                            } ?: continue

                            if (line == "data: [DONE]") {
                                close()
                                break
                            } else if (line.startsWith("data:")) {
                                try {
                                    val value = parseGroqResponse(line)
                                    val currentTS = System.currentTimeMillis()
                                    if (value.isNotEmpty()) {
                                        trySend(value)
                                        if ((currentTS - ts) < 30) {
                                            delay(30 - (currentTS - ts))
                                        }
                                        ts = currentTS
                                    }
                                } catch (e: Exception) {
                                    Log.e("ChatRepository", "❌ Groq parsing error: ${e.message}")
                                }
                            }
                            if (!scope.isActive) {
                                break
                            }
                        }
                    } finally {
                        withContext(Dispatchers.IO) {
                            inputStream.close()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("ChatRepository", "❌ Groq network error: ${e.message}")
                trySend("❌ Groq network greška: ${e.message}")
            } finally {
                close()
            }
        }
    }.flowOn(Dispatchers.IO)

    override fun textCompletionsWithStreamTogether(
        scope: CoroutineScope,
        requestParam: GPTRequestParam,
        baseUrl: String
    ): Flow<String> = callbackFlow {
        withContext(Dispatchers.IO) {
            val apiKey = apiKeyHelpers.getTogetherKey()
            Log.d("ChatRepository", "🔑 Together API Key: ${apiKey.take(10)}...")

            if (apiKey.isBlank()) {
                trySend("❌ Nema Together API ključa").also { close() }
                return@withContext
            }

            val url = baseUrl.removeSuffix("/") + "/chat/completions"
            Log.d("ChatRepository", "🌍 Together URL: $url")

            val json = buildJsonObject {
                put("model", requestParam.model)
                put("stream", true)
                put("temperature", requestParam.temperature ?: 0.7f)
                put("messages", buildJsonArray {
                    requestParam.messages.forEach { msg ->
                        add(buildJsonObject {
                            put("role", msg.role)
                            put("content", msg.content)
                        })
                    }
                })
            }.toString()

            val request = Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer $apiKey")
                .addHeader("Content-Type", "application/json")
                .post(json.toRequestBody("application/json".toMediaType()))
                .build()

            try {
                // ✅ POPRAVKA: Koristim injektirani client
                okHttpClient.newCall(request).execute().use { response ->
                    Log.d("ChatRepository", "📥 Together Status code: ${response.code}")

                    if (!response.isSuccessful) {
                        val errorBody = response.body?.string()
                        Log.e("ChatRepository", "❌ Together error: ${response.code} | $errorBody")
                        trySend("❌ Together greška: ${response.code}").also { close() }
                        return@use
                    }

                    val inputStream = response.body?.byteStream()?.bufferedReader()
                        ?: throw Exception("Response body is null")

                    try {
                        var ts = System.currentTimeMillis()
                        while (true) {
                            val line = withContext(Dispatchers.IO) {
                                inputStream.readLine()
                            } ?: continue

                            if (line == "data: [DONE]") {
                                close()
                                break
                            } else if (line.startsWith("data:")) {
                                try {
                                    val value = parseTogetherResponse(line)
                                    val currentTS = System.currentTimeMillis()
                                    if (value.isNotEmpty()) {
                                        trySend(value)
                                        if ((currentTS - ts) < 30) {
                                            delay(30 - (currentTS - ts))
                                        }
                                        ts = currentTS
                                    }
                                } catch (e: Exception) {
                                    Log.e("ChatRepository", "❌ Together parsing error: ${e.message}")
                                }
                            }
                            if (!scope.isActive) {
                                break
                            }
                        }
                    } finally {
                        withContext(Dispatchers.IO) {
                            inputStream.close()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("ChatRepository", "❌ Together network error: ${e.message}")
                trySend("❌ Together network greška: ${e.message}")
            } finally {
                close()
            }
        }
    }.flowOn(Dispatchers.IO)

    private suspend fun searchWithBraveIfNeeded(userPrompt: String): String {
        // Jednostavna heuristika: koristi Brave samo ako je pitanje "svježe"
        val keywords = listOf("danas", "jučer", "2025", "trenutno", "što se događa", "novosti", "tko je pobijedio", "vrijeme", "cijena", "pretraži", "najnovije")
        val shouldUseBrave = keywords.any { userPrompt.lowercase().contains(it) }

        if (!shouldUseBrave) return ""

        return try {
            val result = braveSearchRepository.searchBrave(query = userPrompt)
            val items = result?.web?.results ?: emptyList()

            if (items.isEmpty()) {
                "\n\n🔎 Nema rezultata pretrage (Brave)."
            } else {
                val formatted = items.joinToString("\n") {
                    "• ${it.title}\n${it.description}\n${it.url}"
                }
                "\n\n🔎 Rezultati pretrage (Brave):\n$formatted"
            }
        } catch (e: Exception) {
            Log.e("BRAVE_SEARCH", "❌ Greška kod Brave pretrage", e)
            ""
        }
    }

    private suspend fun tryBraveSearchWebContent(userPrompt: String): List<WebContent> {
        return try {
            braveSearchRepository.getWebContent(userPrompt)
        } catch (e: Exception) {
            Log.e("BRAVE", "❌ Brave search failed: ${e.message}")
            emptyList()
        }
    }

    override suspend fun preparePromptWithBrave(userPrompt: String): List<GPTMessage> {
        return try {
            val results = braveSearchRepository.searchBrave(query = userPrompt)
            val formatted = results?.web?.results
                ?.take(3)
                ?.joinToString("\n") { "• ${it.title}\n${it.description}\n${it.url}" }
                ?: "Nema rezultata s interneta."

            listOf(
                GPTMessage(
                    role = GPTRole.SYSTEM.value,
                    content = "Korisnik je tražio svježe informacije. U nastavku su najnoviji rezultati s interneta:\n\n$formatted"
                ),
                GPTMessage(
                    role = GPTRole.USER.value,
                    content = userPrompt
                )
            )
        } catch (e: Exception) {
            listOf(
                GPTMessage(role = GPTRole.USER.value, content = userPrompt)
            )
        }
    }



    private fun textCompletionsWithStreamDeepSeek(
        scope: CoroutineScope,
        requestParam: GPTRequestParam,
        baseUrl: String
    ): Flow<String> = callbackFlow {
        withContext(Dispatchers.IO) {
            val apiKey = apiKeyHelpers.getDeepSeekKey()
            Log.d("ChatRepository", "🔑 DeepSeek API Key: ${apiKey.take(10)}...")

            if (apiKey.isBlank()) {
                trySend("❌ Nema DeepSeek API ključa").also { close() }
                return@withContext
            }

            val url = baseUrl.removeSuffix("/") + "/chat/completions"
            Log.d("ChatRepository", "🌍 DeepSeek URL: $url")

            val json = buildJsonObject {
                put("model", requestParam.model)
                put("stream", true)
                put("temperature", requestParam.temperature ?: 0.7f)
                put("messages", buildJsonArray {
                    requestParam.messages.forEach { msg ->
                        add(buildJsonObject {
                            put("role", msg.role)
                            put("content", msg.content)
                        })
                    }
                })
            }.toString()

            val request = Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer $apiKey")
                .addHeader("Content-Type", "application/json")
                .post(json.toRequestBody("application/json".toMediaType()))
                .build()

            try {
                // ✅ POPRAVKA: Koristim injektirani client
                okHttpClient.newCall(request).execute().use { response ->
                    Log.d("ChatRepository", "📥 DeepSeek Status code: ${response.code}")

                    if (!response.isSuccessful) {
                        val errorBody = response.body?.string()
                        Log.e("ChatRepository", "❌ DeepSeek error: ${response.code} | $errorBody")
                        trySend("❌ DeepSeek greška: ${response.code}").also { close() }
                        return@use
                    }

                    val inputStream = response.body?.byteStream()?.bufferedReader()
                        ?: throw Exception("Response body is null")

                    try {
                        var ts = System.currentTimeMillis()
                        while (true) {
                            val line = withContext(Dispatchers.IO) {
                                inputStream.readLine()
                            } ?: continue

                            if (line == "data: [DONE]") {
                                close()
                                break
                            } else if (line.startsWith("data:")) {
                                try {
                                    val value = parseDeepSeekResponse(line)
                                    val currentTS = System.currentTimeMillis()
                                    if (value.isNotEmpty()) {
                                        trySend(value)
                                        if ((currentTS - ts) < 30) {
                                            delay(30 - (currentTS - ts))
                                        }
                                        ts = currentTS
                                    }
                                } catch (e: Exception) {
                                    Log.e("ChatRepository", "❌ DeepSeek parsing error: ${e.message}")
                                }
                            }
                            if (!scope.isActive) {
                                break
                            }
                        }
                    } finally {
                        withContext(Dispatchers.IO) {
                            inputStream.close()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("ChatRepository", "❌ DeepSeek network error: ${e.message}")
                trySend("❌ DeepSeek network greška: ${e.message}")
            } finally {
                close()
            }
        }
    }.flowOn(Dispatchers.IO)

    // Response parsers
    private fun parseResponse(jsonString: String): String {
        try {
            val jsonObject = JSONObject(jsonString.replace("data: ", ""))

            val choicesArray = jsonObject.optJSONArray("choices")
            if (choicesArray != null && choicesArray.length() > 0) {
                val choiceObject = choicesArray.optJSONObject(0)
                val deltaObject = choiceObject?.optJSONObject("delta")
                val contentElement = deltaObject?.optString("content")
                if (!contentElement.isNullOrEmpty()) {
                    return contentElement
                }
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
        return ""
    }

    private fun parseGeminiResponse(jsonString: String): String {
        try {
            val gson = Gson()
            val model =
                gson.fromJson(
                    jsonString.replace("data: ", ""),
                    GoogleApiResponseModel::class.java
                )
            model?.let { apiResponse ->
                if (apiResponse.candidates[0].finishReason != null && apiResponse.candidates[0].finishReason.contentEquals(
                        "SAFETY"
                    )
                ) {
                    return FlaggedMsg
                } else {
                    apiResponse.candidates[0].content.parts.forEach { part ->
                        println("Response text: ${part.text}")
                        return part.text!!
                    }
                }
            }

        } catch (e: JSONException) {
            e.printStackTrace()
        }
        return ""
    }

    private fun parseGroqResponse(jsonString: String): String {
        try {
            val jsonObject = JSONObject(jsonString.replace("data: ", ""))
            val choicesArray = jsonObject.optJSONArray("choices")
            if (choicesArray != null && choicesArray.length() > 0) {
                val choiceObject = choicesArray.optJSONObject(0)
                val deltaObject = choiceObject?.optJSONObject("delta")
                val contentElement = deltaObject?.optString("content")
                if (!contentElement.isNullOrEmpty()) {
                    return contentElement
                }
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
        return ""
    }

    private fun parseDeepSeekResponse(jsonString: String): String {
        try {
            val jsonObject = JSONObject(jsonString.replace("data: ", ""))
            val choicesArray = jsonObject.optJSONArray("choices")
            if (choicesArray != null && choicesArray.length() > 0) {
                val choiceObject = choicesArray.optJSONObject(0)
                val deltaObject = choiceObject?.optJSONObject("delta")
                val contentElement = deltaObject?.optString("content")
                if (!contentElement.isNullOrEmpty()) {
                    return contentElement
                }
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
        return ""
    }

    private fun parseTogetherResponse(jsonString: String): String {
        try {
            val jsonObject = JSONObject(jsonString.replace("data: ", ""))
            val choicesArray = jsonObject.optJSONArray("choices")
            if (choicesArray != null && choicesArray.length() > 0) {
                val choiceObject = choicesArray.optJSONObject(0)
                val deltaObject = choiceObject?.optJSONObject("delta")
                val contentElement = deltaObject?.optString("content")
                if (!contentElement.isNullOrEmpty()) {
                    return contentElement
                }
            }
        } catch (e: JSONException) {
            e.printStackTrace()
        }
        return ""
    }
}