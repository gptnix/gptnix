package com.nextgptapp.here.data.source.remote

import com.nextgptapp.here.data.model.AIMessageResponse
import com.nextgptapp.here.data.model.AsticaVisionRequest
import com.nextgptapp.here.data.model.AsticaVisionResponse
import com.nextgptapp.here.data.model.FileInfo
import com.nextgptapp.here.data.model.FileUploadResponse
import com.nextgptapp.here.data.model.GPTRequestParam
import com.nextgptapp.here.data.model.GoogleApiModel
import com.nextgptapp.here.data.model.GoogleApiResponseModel
import com.nextgptapp.here.data.model.ImageGenerationResponse
import com.nextgptapp.here.data.model.ImageRequest
import com.nextgptapp.here.data.model.ModerationRequest
import com.nextgptapp.here.data.model.ModerationResponse
import com.nextgptapp.here.data.model.StabilityImageGenerationResponse
import com.nextgptapp.here.data.model.StabilityImageRequest
import com.nextgptapp.here.data.model.VisionRequest
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming
import retrofit2.http.Url

interface AIVisionService {

    @POST("chat/completions")
    @Streaming
    fun textCompletionsWithStream(@Body body: GPTRequestParam, @Header("Authorization") authHeader: String): Call<ResponseBody>

    @POST("chat/completions")
    suspend fun askAIAssistant(@Body body: GPTRequestParam, @Header("Authorization") authHeader: String): AIMessageResponse

    @POST("moderations")
    fun inputModerations(@Body request: ModerationRequest, @Header("Authorization") authHeader: String): Call<ModerationResponse>

    @POST("images/generations")
    suspend fun generateImages(@Body body: ImageRequest, @Header("Authorization") authHeader: String): ImageGenerationResponse

    @Headers("Accept: application/json")
    @POST("https://api.stability.ai/v1/generation/{engine_id}/text-to-image")
    suspend fun generateImagesWithStability(@Path("engine_id") engineId: String, @Body body: StabilityImageRequest, @Header("Authorization") authHeader: String): StabilityImageGenerationResponse

    @POST("chat/completions")
    suspend fun askAIVision(@Body body: VisionRequest, @Header("Authorization") authHeader: String): AIMessageResponse

    @Headers("Accept: application/json")
    @POST("https://vision.astica.ai/describe")
    suspend fun askAsticaVisionAI(@Body body: AsticaVisionRequest): AsticaVisionResponse

    @GET("https://translate.googleapis.com/translate_a/single?client=gtx&ie=UTF-8&oe=UTF-8&dt=t")
    @Streaming
    suspend fun translateText(@Query("sl") source: String, @Query("tl") target: String, @Query("q") query: String): Response<ResponseBody>

    @POST("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse")
    @Streaming
    fun generateContent(
        @Query("key") apiKey: String,
        @Body request: GoogleApiModel
    ): Call<ResponseBody>

    @POST("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent")
    fun askTextWithVision(
        @Query("key") apiKey: String,
        @Body request: GoogleApiModel
    ): Call<GoogleApiResponseModel>

    // Initialize upload
    @POST("https://generativelanguage.googleapis.com/upload/v1beta/files")
    suspend fun initializeUpload(
        @Query("key") apiKey: String,
        @Header("X-Goog-Upload-Protocol") protocol: String = "resumable",
        @Header("X-Goog-Upload-Command") command: String = "start",
        @Header("X-Goog-Upload-Header-Content-Length") contentLength: Long,
        @Header("X-Goog-Upload-Header-Content-Type") mimeType: String,
        @Header("Content-Type") contentType: String = "application/json",
        @Body requestBody: RequestBody
    ): Response<Unit>

    // Upload file (using the provided URL from the initialization step)
    @PUT
    suspend fun uploadFile(
        @Url uploadUrl: String,
        @Header("Content-Length") contentLength: Long,
        @Header("X-Goog-Upload-Offset") offset: Long,
        @Header("X-Goog-Upload-Command") command: String = "upload, finalize",
        @Body file: RequestBody
    ): Response<FileUploadResponse>

    // Check file status (polling)
    @GET("https://generativelanguage.googleapis.com/v1beta/files/{fileId}")
    suspend fun checkFileStatus(
        @Path("fileId") fileId: String,
        @Query("key") apiKey: String
    ): Response<FileInfo>

    // ✅ GROQ API Endpoint
    @Headers("Content-Type: application/json")
    @POST("https://api.groq.com/openai/v1/chat/completions")
    @Streaming
    fun textCompletionsWithStreamGroq(
        @Body request: GPTRequestParam,
        @Header("Authorization") authorization: String
    ): Call<ResponseBody>

    // ✅ TOGETHER API Endpoint
    @Headers("Content-Type: application/json")
    @POST("https://api.together.xyz/v1/chat/completions")
    @Streaming
    fun textCompletionsWithStreamTogether(
        @Body request: GPTRequestParam,
        @Header("Authorization") authorization: String
    ): Call<ResponseBody>

    // DEEPSEEK API Endpoint
    @Headers("Content-Type: application/json")
    @POST("https://api.deepseek.com/v1/chat/completions")
    @Streaming
    fun textCompletionsWithStreamDeepSeek(
        @Body request: GPTRequestParam,
        @Header("Authorization") authorization: String
    ): Call<ResponseBody>

    // GEMINI API Endpoint (ako koristite direktni Gemini API)
    @Headers("Content-Type: application/json")
    @POST("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent")
    @Streaming
    fun textCompletionsWithStreamGeminiDirect(
        @Body request: GoogleApiModel,
        @Query("key") apiKey: String
    ): Call<ResponseBody>
}