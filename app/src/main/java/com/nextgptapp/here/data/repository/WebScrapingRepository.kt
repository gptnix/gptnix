package com.nextgptapp.here.data.repository

import com.nextgptapp.here.data.model.browse.WebContent

interface WebScrapingRepository {
    suspend fun fetchWebContent(url: String): WebContent?
    suspend fun extractTextFromHtml(html: String): String
    suspend fun isUrlAccessible(url: String): Boolean
}
