package com.nextgptapp.here.data.model

sealed class ImageGenerationStatus {
    data class Generated(val path:String):ImageGenerationStatus()
    object Downloading:ImageGenerationStatus()
    object Completed:ImageGenerationStatus()
    data class GenerationError(val error:String):ImageGenerationStatus()
    data class DownloadError(val url:String):ImageGenerationStatus()
}