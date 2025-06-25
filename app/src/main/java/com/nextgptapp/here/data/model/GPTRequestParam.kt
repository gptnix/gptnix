package com.nextgptapp.here.data.model

import com.google.gson.annotations.SerializedName

data class GPTRequestParam(
    @SerializedName("temperature")
    val temperature: Double = 0.9,
    @SerializedName("stream")
    var stream: Boolean = true,
    @SerializedName("model")
    val model: String = GPTModel.gpt4.model,
    @SerializedName("messages")
    val messages: List<GPTMessage> = emptyList(),

    // ✅ Dodano za dinamične API pozive:
    val apiKey: String? = null,
    val apiEndpoint: String? = null
)
