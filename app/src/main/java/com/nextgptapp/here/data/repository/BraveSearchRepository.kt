package com.nextgptapp.here.data.repository

import com.nextgptapp.here.data.model.browse.BrowseResult
import com.nextgptapp.here.data.model.browse.WebContent

interface BraveSearchRepository {
    suspend fun searchBrave(query: String): BrowseResult?
    suspend fun getWebContent(query: String): List<WebContent>
}
