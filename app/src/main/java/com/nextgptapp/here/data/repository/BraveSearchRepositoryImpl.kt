package com.nextgptapp.here.data.repository

import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.nextgptapp.here.data.model.browse.BrowseResult
import com.nextgptapp.here.data.model.browse.WebResults
import com.nextgptapp.here.data.model.browse.BraveSearchItem
import kotlinx.coroutines.tasks.await
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import javax.inject.Inject
import com.nextgptapp.here.data.model.browse.toWebContentList
import com.nextgptapp.here.data.model.browse.WebContent

class BraveSearchRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val okHttpClient: OkHttpClient
) : BraveSearchRepository {

    override suspend fun searchBrave(query: String): BrowseResult? {
        return try {
            Log.d("BRAVE_DEBUG", "🔥 === DIJAGNOSTIČKA BRAVE PRETRAGA ===")
            Log.d("BRAVE_DEBUG", "📝 Query: '$query'")

            // ✅ Dohvaćanje konfiguracije
            val doc = firestore.collection("ai_models")
                .document("brave-search")
                .get()
                .await()

            if (!doc.exists()) {
                Log.e("BRAVE_DEBUG", "❌ Dokument 'brave-search' ne postoji!")
                return null
            }

            val apiKey = doc.getString("apiKey")
            val endpoint = doc.getString("apiEndpoint")

            Log.d("BRAVE_DEBUG", "🔑 API Key: ${apiKey?.take(15)}...${apiKey?.takeLast(5)}")
            Log.d("BRAVE_DEBUG", "🌐 Endpoint: $endpoint")

            if (apiKey.isNullOrBlank() || endpoint.isNullOrBlank()) {
                Log.e("BRAVE_DEBUG", "❌ API Key ili endpoint je prazan!")
                return null
            }

            // ✅ Kreiraj URL
            val encodedQuery = URLEncoder.encode(query.trim(), "UTF-8")
            val url = "${endpoint.removeSuffix("/")}?q=$encodedQuery&count=5"

            Log.d("BRAVE_DEBUG", "📡 Konačni URL: $url")

            // ✅ Kreiraj request
            val request = Request.Builder()
                .url(url)
                .addHeader("Accept", "application/json")
                .addHeader("X-Subscription-Token", apiKey)
                .addHeader("User-Agent", "AskAI-Android/1.0")
                .build()

            Log.d("BRAVE_DEBUG", "📬 Request headers:")
            request.headers.forEach { (name, value) ->
                if (name == "X-Subscription-Token") {
                    Log.d("BRAVE_DEBUG", "📬   $name: ${value.take(10)}...${value.takeLast(5)}")
                } else {
                    Log.d("BRAVE_DEBUG", "📬   $name: $value")
                }
            }

            // ✅ Pozovi API
            Log.d("BRAVE_DEBUG", "🚀 Šaljem request...")
            val response = okHttpClient.newCall(request).execute()

            Log.d("BRAVE_DEBUG", "📥 Response status: ${response.code}")
            Log.d("BRAVE_DEBUG", "📥 Response message: '${response.message}'")
            Log.d("BRAVE_DEBUG", "📥 Response successful: ${response.isSuccessful}")

            // ✅ Provjeri response headers
            Log.d("BRAVE_DEBUG", "📥 Response headers:")
            response.headers.forEach { (name, value) ->
                Log.d("BRAVE_DEBUG", "📥   $name: $value")
            }

            if (!response.isSuccessful) {
                val errorBody = response.body?.string()
                Log.e("BRAVE_DEBUG", "❌ HTTP Error ${response.code}: '$errorBody'")
                return null
            }

            // ✅ Čitaj response body
            val responseBody = response.body?.string()
            Log.d("BRAVE_DEBUG", "📦 Response body length: ${responseBody?.length ?: 0}")

            if (responseBody.isNullOrBlank()) {
                Log.e("BRAVE_DEBUG", "❌ Response body je prazan!")
                return null
            }

            // ✅ KLJUČNO: Isprintaj CIJELI response za analizu
            Log.d("BRAVE_DEBUG", "📦 === CIJELI RESPONSE BODY ===")
            Log.d("BRAVE_DEBUG", responseBody)
            Log.d("BRAVE_DEBUG", "📦 === KRAJ RESPONSE BODY ===")

            // ✅ Pokušaj parsirati JSON
            val json = try {
                JSONObject(responseBody)
            } catch (e: Exception) {
                Log.e("BRAVE_DEBUG", "❌ JSON parsing error: ${e.message}")
                Log.e("BRAVE_DEBUG", "❌ Response nije valjan JSON: '${responseBody.take(200)}'")
                return null
            }

            // ✅ Analiziraj JSON strukturu
            Log.d("BRAVE_DEBUG", "🔍 JSON root keys: ${json.keys().asSequence().toList()}")

            // ✅ Pokušaj naći results u različitim lokacijama
            var resultsArray: JSONArray? = null
            var resultsLocation = "NEPOZNATO"

            when {
                json.has("web") -> {
                    Log.d("BRAVE_DEBUG", "🌐 Pronašao 'web' objekt")
                    val webObject = json.getJSONObject("web")
                    Log.d("BRAVE_DEBUG", "🌐 'web' keys: ${webObject.keys().asSequence().toList()}")

                    if (webObject.has("results")) {
                        resultsArray = webObject.getJSONArray("results")
                        resultsLocation = "web.results"
                        Log.d("BRAVE_DEBUG", "✅ Pronašao results u web.results")
                    }
                }
                json.has("results") -> {
                    Log.d("BRAVE_DEBUG", "📄 Pronašao direktni 'results'")
                    resultsArray = json.getJSONArray("results")
                    resultsLocation = "results"
                }
                json.has("organic") -> {
                    Log.d("BRAVE_DEBUG", "🌱 Pronašao 'organic'")
                    resultsArray = json.getJSONArray("organic")
                    resultsLocation = "organic"
                }
                else -> {
                    Log.w("BRAVE_DEBUG", "⚠️ Nema poznatih result ključeva!")
                    Log.w("BRAVE_DEBUG", "⚠️ Dostupni ključevi: ${json.keys().asSequence().toList()}")

                    // ✅ Isprintaj sadržaj svih objekata da vidimo strukturu
                    json.keys().forEach { key ->
                        val value = json.get(key)
                        Log.d("BRAVE_DEBUG", "🔍 Key '$key' type: ${value.javaClass.simpleName}")
                        if (value is JSONObject) {
                            Log.d("BRAVE_DEBUG", "🔍   Objekt '$key' keys: ${value.keys().asSequence().toList()}")
                        } else if (value is JSONArray) {
                            Log.d("BRAVE_DEBUG", "🔍   Array '$key' length: ${value.length()}")
                        } else {
                            Log.d("BRAVE_DEBUG", "🔍   Value '$key': $value")
                        }
                    }
                }
            }

            if (resultsArray == null) {
                Log.e("BRAVE_DEBUG", "❌ Nije pronađen results array nigdje!")
                return null
            }

            Log.d("BRAVE_DEBUG", "📊 Results pronađeni u: $resultsLocation")
            Log.d("BRAVE_DEBUG", "📊 Broj rezultata: ${resultsArray.length()}")

            // ✅ Analiziraj svaki result item
            val items = mutableListOf<BraveSearchItem>()

            for (i in 0 until resultsArray.length()) {
                val item = resultsArray.getJSONObject(i)
                Log.d("BRAVE_DEBUG", "📄 === RESULT $i ===")
                Log.d("BRAVE_DEBUG", "📄 Keys: ${item.keys().asSequence().toList()}")

                // ✅ Isprintaj sve ključeve i vrijednosti
                item.keys().forEach { key ->
                    val value = item.opt(key)
                    Log.d("BRAVE_DEBUG", "📄   $key: ${value?.toString()?.take(100)}")
                }

                // ✅ Pokušaj mapirati na BraveSearchItem
                val title = item.optString("title", "")
                val url = item.optString("url", "")
                val description = item.optString("description",
                    item.optString("snippet",
                        item.optString("meta_description", "")
                    )
                )
                val source = item.optString("source",
                    item.optString("hostname", "")
                )

                Log.d("BRAVE_DEBUG", "📄 Mapiran result $i:")
                Log.d("BRAVE_DEBUG", "📄   Title: '$title'")
                Log.d("BRAVE_DEBUG", "📄   URL: '$url'")
                Log.d("BRAVE_DEBUG", "📄   Description: '${description.take(50)}...'")
                Log.d("BRAVE_DEBUG", "📄   Source: '$source'")

                val braveItem = BraveSearchItem(
                    title = title,
                    url = url,
                    description = description,
                    source = source
                )

                items.add(braveItem)
            }

            val result = BrowseResult(
                query = query,
                web = WebResults(results = items)
            )

            Log.d("BRAVE_DEBUG", "✅ === USPJEŠNO ZAVRŠENO ===")
            Log.d("BRAVE_DEBUG", "✅ Ukupno items: ${items.size}")
            Log.d("BRAVE_DEBUG", "✅ Query: '${result.query}'")
            Log.d("BRAVE_DEBUG", "✅ Web results size: ${result.web?.results?.size}")

            result

        } catch (e: Exception) {
            Log.e("BRAVE_DEBUG", "❌ Exception: ${e.message}", e)
            null
        }
    }
    override suspend fun getWebContent(query: String): List<WebContent> {
        val result = searchBrave(query)
        if (result == null) {
            Log.w("BRAVE_DEBUG", "⚠️ searchBrave vratio null, vraćam prazan WebContent list")
            return emptyList()
        }

        val list = result.toWebContentList()
        Log.d("BRAVE_DEBUG", "📚 WebContent konverzija završena, veličina: ${list.size}")
        return list
    }

}