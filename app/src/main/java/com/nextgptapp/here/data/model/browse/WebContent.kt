package com.nextgptapp.here.data.model.browse

data class WebContent(
    val url: String,
    val title: String,
    val content: String,
    val timestamp: Long,
    val summary: String? = null
)
