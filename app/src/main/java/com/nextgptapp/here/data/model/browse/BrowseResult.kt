package com.nextgptapp.here.data.model.browse

import com.google.gson.annotations.SerializedName
import com.nextgptapp.here.data.model.browse.WebContent

data class BrowseResult(
    @SerializedName("query") val query: String? = null,
    @SerializedName("web") val web: WebResults? = null
)

data class WebResults(
    @SerializedName("results") val results: List<BraveSearchItem>? = null
)

data class BraveSearchItem(
    @SerializedName("title") val title: String,
    @SerializedName("url") val url: String,
    @SerializedName("description") val description: String? = null,
    @SerializedName("source") val source: String? = null
)

fun BrowseResult.toWebContentList(): List<WebContent> {
    return web?.results?.map { result ->
        WebContent(
            url = result.url,
            title = result.title,
            content = result.description ?: "",
            timestamp = System.currentTimeMillis(),
            summary = null
        )
    } ?: emptyList()
}

