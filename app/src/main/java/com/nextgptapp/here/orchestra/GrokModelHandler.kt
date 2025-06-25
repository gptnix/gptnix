package com.nextgptapp.here.orchestra

import android.util.Log
import com.nextgptapp.here.data.model.AIModel
import com.nextgptapp.here.data.model.Message
import com.nextgptapp.here.data.model.ChatRequest
import com.nextgptapp.here.data.model.ChatResponse
import com.nextgptapp.here.data.model.GroqService
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

object GrokModelHandler {

    fun sendToGroq(
        messages: List<AIModel>,
        modelName: String = "llama3-70b-8192",
        endpoint: String = "https://api.groq.com/openai/v1/chat/completions",
        apiKey: String,
        maxTokens: Int = 2048,
        temperature: Double = 0.7,
        onSuccess: (String) -> Unit,
        onError: (Throwable) -> Unit
    ) {
        val retrofit = Retrofit.Builder()
            .baseUrl("https://api.groq.com/") // mora imati nešto kao base URL zbog Retrofit-a
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val service = retrofit.create(GroqService::class.java)

        val request = ChatRequest(
            model = modelName,
            messages = messages.map { Message(it.role, it.content) },
            temperature = temperature,
            stream = false
        )

        val call = service.sendMessage(endpoint, request)

        call.enqueue(object : Callback<ChatResponse> {
            override fun onResponse(call: Call<ChatResponse>, response: Response<ChatResponse>) {
                if (response.isSuccessful) {
                    val content = response.body()?.choices?.firstOrNull()?.message?.content
                    if (!content.isNullOrBlank()) {
                        onSuccess(content)
                    } else {
                        onError(Throwable("⚠️ Empty Groq response."))
                    }
                } else {
                    onError(Throwable("❌ Groq API error: ${response.code()} ${response.message()}"))
                }
            }

            override fun onFailure(call: Call<ChatResponse>, t: Throwable) {
                Log.e("GrokModelHandler", "❌ Request failed: ${t.message}")
                onError(t)
            }
        })
    }
}
