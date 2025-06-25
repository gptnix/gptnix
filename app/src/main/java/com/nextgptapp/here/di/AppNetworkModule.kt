package com.nextgptapp.here.di

import android.util.Log
import com.google.gson.GsonBuilder
import com.nextgptapp.here.components.ApiKeyHelpers
import com.nextgptapp.here.data.source.remote.AIVisionService
import com.nextgptapp.here.data.model.OpenAIService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import com.nextgptapp.here.data.model.BraveService


@Module
@InstallIn(SingletonComponent::class)
object AppNetworkModule {

    @Singleton
    @Provides
    fun provideOkHttpClient(apiKeyHelpers: ApiKeyHelpers): OkHttpClient {
        return OkHttpClient.Builder()
            .readTimeout(60, TimeUnit.SECONDS)
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    @Singleton
    @Provides
    fun provideGsonConverterFactory(): GsonConverterFactory {
        val gson = GsonBuilder().setLenient().create()
        return GsonConverterFactory.create(gson)
    }

    // ✅ Dinamički Retrofit (možeš pozvat kad god trebaš custom URL)
    fun provideDynamicRetrofit(baseUrl: String, client: OkHttpClient, converter: GsonConverterFactory): Retrofit {
        Log.d("AppNetworkModule", "🌐 Dynamic baseUrl: $baseUrl")
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(converter)
            .build()
    }

    // ✅ OpenAI service s default URL-om
    @Singleton
    @Provides
    fun provideOpenAIService(
        okHttpClient: OkHttpClient,
        converterFactory: GsonConverterFactory
    ): OpenAIService {
        val baseUrl = "https://api.openai.com/v1/"
        return provideDynamicRetrofit(baseUrl, okHttpClient, converterFactory)
            .create(OpenAIService::class.java)
    }

    @Singleton
    @Provides
    fun provideAIVisionService(
        okHttpClient: OkHttpClient,
        converterFactory: GsonConverterFactory
    ): AIVisionService {
        val baseUrl = "https://api.openai.com/v1/"
        return provideDynamicRetrofit(baseUrl, okHttpClient, converterFactory)
            .create(AIVisionService::class.java)
    }

    // ✅ Brave Search Service
    @Singleton
    @Provides
    fun provideBraveService(
        okHttpClient: OkHttpClient,
        converterFactory: GsonConverterFactory
    ): BraveService {
        val baseUrl = "https://api.search.brave.com/"
        return provideDynamicRetrofit(baseUrl, okHttpClient, converterFactory)
            .create(BraveService::class.java)
    }
}
