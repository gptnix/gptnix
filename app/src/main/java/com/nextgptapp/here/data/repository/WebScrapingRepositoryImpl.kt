package com.nextgptapp.here.data.repository

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.Jsoup
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import com.nextgptapp.here.data.model.browse.WebContent

class WebScrapingRepositoryImpl @Inject constructor() : WebScrapingRepository {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    override suspend fun fetchWebContent(url: String): WebContent? = withContext(Dispatchers.IO) {
        return@withContext try {
            val request = Request.Builder()
                .url(url)
                .addHeader("User-Agent", "Mozilla/5.0 (compatible; GPTNiXBot/1.0)")
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                val html = response.body?.string() ?: return@withContext null
                val cleanText = extractTextFromHtml(html)
                WebContent(
                    url = url,
                    title = extractTitle(html),
                    content = cleanText,
                    timestamp = System.currentTimeMillis()
                )
            } else {
                Log.w("WEB_SCRAPE", "⚠️ Request failed for $url with code ${response.code}")
                null
            }
        } catch (e: Exception) {
            Log.e("WEB_SCRAPE", "❌ Error fetching $url: ${e.message}")
            null
        }
    }

    override suspend fun extractTextFromHtml(html: String): String {
        return Jsoup.parse(html).text()
    }

    private fun extractTitle(html: String): String {
        return Jsoup.parse(html).title().ifBlank { "Nepoznato" }
    }

    override suspend fun isUrlAccessible(url: String): Boolean = withContext(Dispatchers.IO) {
        return@withContext try {
            val request = Request.Builder()
                .url(url)
                .head()
                .build()
            val response = client.newCall(request).execute()
            response.isSuccessful
        } catch (e: Exception) {
            false
        }
    }
}
