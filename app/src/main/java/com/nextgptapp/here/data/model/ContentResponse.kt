package com.nextgptapp.here.data.model

sealed class ContentResponse {
    class Text(val content: String) : ContentResponse()
    class Progress(val progress: Int) : ContentResponse()
    class Error(val message: String) : ContentResponse()
}