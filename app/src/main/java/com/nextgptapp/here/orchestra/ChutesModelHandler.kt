package com.nextgptapp.here.orchestra

import android.util.Log
import com.nextgptapp.here.data.model.*
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.*
import retrofit2.converter.gson.GsonConverterFactory

object ChutesModelHandler {

    fun sendToChutes(
        messages: List<AIModel>,
        modelName: String = "deepseek-ai/DeepSeek-V3-0324",
        endpoint: String = "https://llm.chutes.ai/v1/chat/completions",
        apiKey: String,
        maxTokens: Int = 4096,
        temperature: Double = 0.7,
        onSuccess: (String) -> Unit,
        onError: (Throwable) -> Unit
    ) {
        val client = OkHttpClient.Builder()
            .addInterceptor(Interceptor { chain ->
                val request = chain.request().newBuilder()
                    .addHeader("Authorization", "Bearer $apiKey")
                    .addHeader("Content-Type", "application/json")
                    .build()
                chain.proceed(request)
            })
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl("https://llm.chutes.ai/") // mora nešto biti zbog Retrofit-a
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        val service = retrofit.create(ChutesService::class.java)

        val request = ChutesChatRequest(
            model = modelName,
            messages = messages.map { ChutesMessage(it.role, it.content) },
            temperature = temperature,
            stream = false,
            max_tokens = maxTokens
        )

        service.sendMessage(endpoint, request).enqueue(object : Callback<ChutesChatResponse> {
            override fun onResponse(call: Call<ChutesChatResponse>, response: Response<ChutesChatResponse>) {
                if (response.isSuccessful) {
                    val content = response.body()?.choices?.firstOrNull()?.message?.content
                    if (!content.isNullOrBlank()) {
                        onSuccess(content)
                    } else {
                        onError(Throwable("⚠️ Prazan odgovor od Chutes AI"))
                    }
                } else {
                    onError(Throwable("❌ Chutes API greška: ${response.code()} ${response.message()}"))
                }
            }

            override fun onFailure(call: Call<ChutesChatResponse>, t: Throwable) {
                Log.e("ChutesModelHandler", "❌ Neuspješan poziv: ${t.message}")
                onError(t)
            }
        })
    }
}
