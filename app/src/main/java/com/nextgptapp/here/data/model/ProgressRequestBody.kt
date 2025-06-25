package com.nextgptapp.here.data.model

import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody
import okio.Buffer
import okio.BufferedSink
import okio.source
import java.io.File

class ProgressRequestBody(
    private val file: File,
    private val mimeType: String,
    private val progressListener: (Int) -> Unit
) : RequestBody() {

    override fun contentType(): MediaType? {
        return mimeType.toMediaTypeOrNull()
    }

    override fun contentLength(): Long {
        return file.length()
    }

    override fun writeTo(sink: BufferedSink) {
        val totalBytes = contentLength()
        var bytesWritten: Long = 0

        file.source().use { source ->
            val buffer = Buffer()
            var read: Long

            // Read into buffer and write to sink with progress tracking
            while (source.read(buffer, 8192L).also { read = it } != -1L) {
                sink.write(buffer, read)
                bytesWritten += read

                // Calculate progress percentage and notify listener
                val progress = (100 * bytesWritten / totalBytes).toInt()
                progressListener(progress)
            }
        }
    }
}