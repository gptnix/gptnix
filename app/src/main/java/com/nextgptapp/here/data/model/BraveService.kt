package com.nextgptapp.here.data.model

import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.Query
import retrofit2.http.Header
import com.nextgptapp.here.data.model.browse.BrowseResult

interface BraveService {
    @GET("res/v1/web/search")
    suspend fun search(
        @Query("q") query: String,
        @Query("country") country: String = "HR",
        @Query("safesearch") safesearch: String = "off",
        @Query("count") count: Int = 3,
        @Header("X-Subscription-Token") apiKey: String,
        @Header("User-Agent") userAgent: String = "GPTNiX/1.0"
    ): BrowseResult
}