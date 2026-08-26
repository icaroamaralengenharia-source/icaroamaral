package br.com.icaroamaral.elo

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import kotlin.system.measureTimeMillis

data class EloTtsResult(
    val ok: Boolean,
    val statusCode: Int,
    val contentType: String,
    val bytes: ByteArray? = null,
    val byteCount: Int = 0,
    val error: String? = null,
    val elapsedMs: Long = 0,
    val headersMs: Long = 0,
    val downloadMs: Long = 0,
    val bodySummary: String = "-"
)

class EloTtsClient(
    private val endpoint: String = TTS_ENDPOINT,
    private val connectTimeoutMs: Int = 8_000,
    private val readTimeoutMs: Int = 25_000
) {
    @Volatile
    private var activeConnection: HttpURLConnection? = null

    fun cancelActive() {
        runCatching { activeConnection?.disconnect() }
        activeConnection = null
    }

    fun synthesize(text: String): EloTtsResult {
        val trimmed = text.trim()
        if (trimmed.isBlank()) return EloTtsResult(false, 0, "-", error = "Texto vazio.")

        var result = EloTtsResult(false, 0, "-", error = "Nao executado.")
        val elapsed = measureTimeMillis {
            result = runCatching { postTts(trimmed) }.getOrElse { error ->
                EloTtsResult(
                    ok = false,
                    statusCode = 0,
                    contentType = "-",
                    error = error.javaClass.simpleName + ": " + (error.message ?: "Falha de rede."),
                    bodySummary = "network-error"
                )
            }
        }
        return result.copy(elapsedMs = elapsed)
    }

    private fun postTts(text: String): EloTtsResult {
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = connectTimeoutMs
            readTimeout = readTimeoutMs
            doOutput = true
            useCaches = false
            setRequestProperty("Connection", "keep-alive")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Accept", "audio/mpeg")
        }
        activeConnection = connection

        try {
            val payload = JSONObject().put("text", text).toString()
            val startedAt = System.nanoTime()
            connection.outputStream.use { it.write(payload.toByteArray(StandardCharsets.UTF_8)) }

            val status = connection.responseCode
            val type = connection.contentType.orEmpty().ifBlank { "-" }
            val headersMs = nanosToMs(System.nanoTime() - startedAt)
            val isAudio = status in 200..299 && type.contains("audio", ignoreCase = true)
            if (isAudio) {
                val downloadStartedAt = System.nanoTime()
                val bytes = connection.inputStream.use { it.readBytes() }
                val downloadMs = nanosToMs(System.nanoTime() - downloadStartedAt)
                return EloTtsResult(true, status, type, bytes, bytes.size, headersMs = headersMs, downloadMs = downloadMs)
            }

            val body = readBody(connection, status)
            return EloTtsResult(
                ok = false,
                statusCode = status,
                contentType = type,
                error = "TTS_HTTP_" + status,
                headersMs = headersMs,
                bodySummary = summarize(body)
            )
        } finally {
            if (activeConnection === connection) activeConnection = null
            connection.disconnect()
        }
    }

    private fun readBody(connection: HttpURLConnection, status: Int): String {
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        if (stream == null) return ""
        return BufferedReader(InputStreamReader(stream, StandardCharsets.UTF_8)).use { it.readText() }
    }

    private fun summarize(body: String): String {
        return body.replace(Regex("\\s+"), " ").trim().take(220).ifBlank { "empty-body" }
    }

    private fun nanosToMs(nanos: Long): Long = nanos / 1_000_000L

    companion object {
        const val TTS_ENDPOINT = "https://obrareport-backend.onrender.com/api/elo/tts"
    }
}