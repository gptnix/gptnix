package com.nextgptapp.here.ui.voiceai

import com.google.gson.annotations.SerializedName

data class ElevenTTSRequest(
    @SerializedName("text")
    val text: String,

    @SerializedName("model_id")
    val modelId: String = "eleven_multilingual_v2", // Dodano za HR i druge jezike

    @SerializedName("voice_settings")
    val voiceSettings: VoiceSettings = VoiceSettings()
)

data class VoiceSettings(
    @SerializedName("stability")
    val stability: Float = 0.3f,

    @SerializedName("similarity_boost")
    val similarityBoost: Float = 0.75f
)
