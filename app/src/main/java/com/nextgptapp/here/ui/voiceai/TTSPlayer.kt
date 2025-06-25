// File: here/ui/voiceai/TTSPlayer.kt
package com.nextgptapp.here.ui.voiceai

import android.content.Context
import android.media.MediaPlayer
import java.io.File

object TTSPlayer {
    fun play(context: Context, audioBytes: ByteArray) {
        val tempFile = File.createTempFile("eleven_tts", ".mp3", context.cacheDir)
        tempFile.writeBytes(audioBytes)

        val mediaPlayer = MediaPlayer().apply {
            setDataSource(tempFile.absolutePath)
            prepare()
            start()
        }

        mediaPlayer.setOnCompletionListener {
            it.release()
            tempFile.delete()
        }
    }
}
