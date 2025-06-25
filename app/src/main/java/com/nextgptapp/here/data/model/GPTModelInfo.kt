package com.nextgptapp.here.data.model

data class GPTModelInfo(
    val id: String = "",
    val name: String = "",
    val model: String = "",
    val modelId: String = "",
    val modelValue: String = "",
    val modelName: String = "",
    val modelSource: String = "",
    val provider: String = "",
    val apiKey: String = "",
    val apiKeyType: String = "Bearer",
    val apiEndpoint: String = "",
    val authType: String = "Bearer",
    val systemPrompt: String = "",
    val defaultPrompt: String = "",
    val isActive: Boolean = true,
    val enabled: Boolean = true,
    val supportsStreaming: Boolean = true,
    val costPerMTokenIn: Double = 0.0,
    val costPerMTokenOut: Double = 0.0,
    val maxTokens: Int = 4096,
    val fallbackModel: String? = null,
    val languageSupport: List<String> = emptyList(),
    val strengths: List<String> = emptyList(),

    // ✅ GPT-4o DODANO:
    val requiresBrowsing: Boolean = false
)
