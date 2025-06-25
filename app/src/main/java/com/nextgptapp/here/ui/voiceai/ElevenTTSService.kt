// File: here/ui/voiceai/ElevenTTSService.kt
package com.nextgptapp.here.ui.voiceai

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*
import retrofit2.http.Body
import retrofit2.http.POST

interface ElevenTTSService {

    @Headers(
        "Accept: audio/mpeg",
        "Content-Type: application/json",
        "xi-api-key: sk_6d228d71a3325e1774f2d4751036d54c59f535c031d2a464"
    )
    @POST("v1/text-to-speech/{voice_id}")
    @Streaming
    suspend fun synthesize(
        @Path("voice_id") voiceId: String,
        @Body request: ElevenTTSRequest
    ): Response<ResponseBody>
}
