package com.nextgptapp.here.data.model

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Streaming

data class OpenAIRequestBody(
    val model: String,
    val messages: List<Map<String, String>>,
    val stream: Boolean = true,
    val temperature: Double = 0.9
)

interface OpenAIService {

    @POST("chat/completions")
    @Streaming
    suspend fun chatCompletionsStream(
        @Header("Authorization") authorization: String,
        @Header("Content-Type") contentType: String = "application/json",
        @Header("Accept") accept: String = "text/event-stream",
        @Body request: OpenAIRequestBody
    ): Response<ResponseBody>
}
