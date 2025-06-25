package com.nextgptapp.here.data.model

import com.google.gson.annotations.SerializedName

data class GoogleApiModel(@SerializedName("contents")
                            val contents: List<Content>)
data class Content(
    @SerializedName("role")
    val role: String?=null,
    @SerializedName("parts")
    val parts: List<Part>
)

data class Part(
    @SerializedName("text")
    val text: String?=null,
    @SerializedName("inline_data")
    val inline_data: InlineData? = null,
    @SerializedName("file_data")
    val fileData: FileData? = null
)

data class GoogleApiResponseModel(val candidates: List<Candidate>,
                               val usageMetadata: UsageMetadata,
                               val modelVersion: String)

data class Candidate(
    val content: Content,
    val finishReason: String?,
    val index: Int,
    val safetyRatings: List<SafetyRating>
)
data class SafetyRating(
    val category: String,
    val probability: String
)

data class UsageMetadata(
    val promptTokenCount: Int,
    val candidatesTokenCount: Int,
    val totalTokenCount: Int
)

data class InlineData(
    val mime_type: String,
    val data: String
)

data class FileInfoResponse(
    val file: FileInfo
)

data class FileInfo(
    val id: String,
    val uri: String,
    val state: String,
    val name:String
)

// Upload response model
data class FileUploadResponse(
    val file: FileInfo
)

data class FileData(
    val mime_type: String,
    val file_uri: String
)

