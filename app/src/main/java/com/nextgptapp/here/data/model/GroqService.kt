package com.nextgptapp.here.data.model

import retrofit2.http.Body
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Url
import retrofit2.Call

// 📤 Zahtjev za Groq API
data class ChatRequest(
    val model: String,
    val messages: List<Message>,
    val temperature: Double = 0.7,
    val stream: Boolean = false,
    val max_tokens: Int? = null
)

// 🎭 Poruke (OpenAI format)
data class Message(
    val role: String,
    val content: String
)

// 📥 Odgovor
data class ChatResponse(
    val choices: List<Choice>
)

data class Choice(
    val message: Message,
    val finish_reason: String
)

// 🚀 Retrofit servis
interface GroqService {
    @Headers("Content-Type: application/json")
    @POST
    fun sendMessage(
        @Url fullUrl: String,
        @Body request: ChatRequest
    ): Call<ChatResponse>
}
