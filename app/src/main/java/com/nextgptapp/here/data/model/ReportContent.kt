package com.nextgptapp.here.data.model

import com.google.firebase.firestore.FieldValue
import com.google.gson.annotations.SerializedName

data class ReportContent(
    @SerializedName("type")
    val type: String = "",
    @SerializedName("prompt")
    val prompt: String = "",
    @SerializedName("Content")
    val text: String = "",
    @SerializedName("base64Content")
    val base64Image: String?=null,
    @SerializedName("reportReason")
    val reason: String = "",
    @SerializedName("extraDetails")
    val details: String = "",
    @SerializedName("timeStamp")
    val timeStamp:FieldValue = FieldValue.serverTimestamp()
)
