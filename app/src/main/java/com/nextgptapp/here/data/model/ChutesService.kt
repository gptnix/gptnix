package com.nextgptapp.here.data.model

import retrofit2.http.Body
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Url
import retrofit2.Call

// 📤 Zahtjev za Chutes API
data class ChutesChatRequest(
    val model: String,
    val messages: List<ChutesMessage>,
    val temperature: Double = 0.7,
    val stream: Boolean = false,
    val max_tokens: Int? = null
)

// 🎭 Poruke
data class ChutesMessage(
    val role: String,
    val content: String
)

// 📥 Odgovor
data class ChutesChatResponse(
    val choices: List<ChutesChoice>
)

data class ChutesChoice(
    val message: ChutesMessage,
    val finish_reason: String
)

// 🚀 Retrofit servis
interface ChutesService {
    @Headers("Content-Type: application/json")
    @POST
    fun sendMessage(
        @Url fullUrl: String,
        @Body request: ChutesChatRequest
    ): Call<ChutesChatResponse>
}
