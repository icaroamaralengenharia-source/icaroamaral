package br.com.icaroamaral.elo

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import kotlin.system.measureTimeMillis

data class EloConversationMessage(
    val role: String,
    val content: String
)

data class EloChatResult(
    val ok: Boolean,
    val statusCode: Int,
    val answer: String,
    val error: String? = null,
    val elapsedMs: Long = 0,
    val bodySummary: String = "-",
    val type: String = "answer",
    val rawCommand: String = "-",
    val normalizedCommand: String = "-",
    val router: String = "-",
    val routerAction: String = "-",
    val ttsText: String = "-",
    val mediaTitle: String = "-",
    val mediaArtist: String = "-",
    val mediaVideoId: String = "-",
    val rawResponse: String = "-",
    val followupDetected: Boolean = false,
    val followupTopic: String = "-",
    val historySize: Int = 0
)

class EloApiClient(
    private val endpoint: String = COMMAND_ENDPOINT,
    private val connectTimeoutMs: Int = 12_000,
    private val readTimeoutMs: Int = 40_000
) {
    @Volatile
    private var activeConnection: HttpURLConnection? = null

    fun cancelActive() {
        runCatching { activeConnection?.disconnect() }
        activeConnection = null
    }

    fun ask(text: String, history: List<EloConversationMessage> = emptyList()): EloChatResult {
        val trimmed = text.trim()
        if (trimmed.isBlank()) {
            return EloChatResult(false, 0, "", "Comando vazio.", bodySummary = "empty-command")
        }

        var result = EloChatResult(false, 0, "", "Nao executado.")
        val elapsed = measureTimeMillis {
            result = runCatching { postCommand(trimmed, history) }.getOrElse { error ->
                EloChatResult(
                    ok = false,
                    statusCode = 0,
                    answer = "",
                    error = error.javaClass.simpleName + ": " + (error.message ?: "Falha de rede."),
                    bodySummary = "network-error",
                    rawCommand = trimmed
                )
            }
        }
        return result.copy(elapsedMs = elapsed)
    }

    fun warmUpHealth(): Long {
        var elapsed = 0L
        runCatching {
            elapsed = measureTimeMillis {
                val healthEndpoint = endpoint.replace("/api/elo/command", "/api/health")
                val connection = (URL(healthEndpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 5_000
                    readTimeout = 8_000
                    setRequestProperty("Connection", "keep-alive")
                    setRequestProperty("Accept", "application/json")
                }
                activeConnection = connection
                try {
                    connection.responseCode
                    readBody(connection, connection.responseCode)
                } finally {
                    if (activeConnection === connection) activeConnection = null
                    connection.disconnect()
                }
            }
        }
        return elapsed
    }
    private fun postCommand(text: String, history: List<EloConversationMessage>): EloChatResult {
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = connectTimeoutMs
            readTimeout = readTimeoutMs
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Accept", "application/json")
        }
        activeConnection = connection

        try {
            val payload = JSONObject()
                .put("command", text)
                .put("source", "elo-android")
                .put("history", buildHistoryJson(history))
                .put(
                    "context",
                    JSONObject()
                        .put("source", "elo-android")
                        .put("mode", "standalone")
                        .put("eloContext", "geral")
                        .put("deviceId", "elo-android-wake-v0")
                        .put("location", JSONObject().put("pathname", "android").put("hash", ""))
                )
                .toString()

            connection.outputStream.use { it.write(payload.toByteArray(StandardCharsets.UTF_8)) }

            val status = connection.responseCode
            val body = readBody(connection, status)
            val summary = summarize(body)
            val json = runCatching { JSONObject(body) }.getOrNull()
            val media = json?.optJSONObject("media")
            val answer = json?.optString("answer").orEmpty().trim()
            val ttsText = json?.optString("ttsText").orEmpty().trim().ifBlank { answer }
            val type = json?.optString("type").orEmpty().ifBlank { "answer" }
            val router = json?.optString("router").orEmpty().ifBlank { "-" }
            val action = json?.optString("action").orEmpty().ifBlank { media?.optString("action").orEmpty() }.ifBlank { "-" }
            val rawCommand = json?.optString("rawCommand").orEmpty().ifBlank { text }
            val normalizedCommand = json?.optString("normalizedCommand").orEmpty().ifBlank { text }

            if (status in 200..299 && (ttsText.isNotBlank() || type == "media")) {
                return EloChatResult(
                    ok = true,
                    statusCode = status,
                    answer = answer.ifBlank { ttsText },
                    bodySummary = summary,
                    type = type,
                    rawCommand = rawCommand,
                    normalizedCommand = normalizedCommand,
                    router = router,
                    routerAction = action,
                    ttsText = ttsText.ifBlank { answer },
                    mediaTitle = media?.optString("title").orEmpty().ifBlank { "-" },
                    mediaArtist = media?.optString("artist").orEmpty().ifBlank { "-" },
                    mediaVideoId = media?.optString("videoId").orEmpty().ifBlank { "-" },
                    rawResponse = body.take(1200),
                    followupDetected = json?.optBoolean("followupDetected", false) ?: false,
                    followupTopic = json?.optString("followupTopic").orEmpty().ifBlank { "-" },
                    historySize = json?.optInt("historySize", history.size) ?: history.size
                )
            }

            val error = json?.optString("error").orEmpty().ifBlank { "HTTP " + status }
            return EloChatResult(
                ok = false,
                statusCode = status,
                answer = answer,
                error = error,
                bodySummary = summary,
                type = type,
                rawCommand = rawCommand,
                normalizedCommand = normalizedCommand,
                router = router,
                routerAction = action,
                ttsText = ttsText.ifBlank { answer },
                rawResponse = body.take(1200),
                followupDetected = json?.optBoolean("followupDetected", false) ?: false,
                followupTopic = json?.optString("followupTopic").orEmpty().ifBlank { "-" },
                historySize = json?.optInt("historySize", history.size) ?: history.size
            )
        } finally {
            if (activeConnection === connection) activeConnection = null
            connection.disconnect()
        }
    }

    private fun buildHistoryJson(history: List<EloConversationMessage>): JSONArray {
        val array = JSONArray()
        history.takeLast(10).forEach { item ->
            val role = if (item.role == "assistant") "assistant" else "user"
            val content = item.content.trim().take(700)
            if (content.isNotBlank()) {
                array.put(JSONObject().put("role", role).put("content", content))
            }
        }
        return array
    }

    private fun readBody(connection: HttpURLConnection, status: Int): String {
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        if (stream == null) return ""
        return BufferedReader(InputStreamReader(stream, StandardCharsets.UTF_8)).use { it.readText() }
    }

    private fun summarize(body: String): String {
        return body.replace(Regex("\\s+"), " ").trim().take(260).ifBlank { "empty-body" }
    }

    companion object {
        const val COMMAND_ENDPOINT = "https://obrareport-backend.onrender.com/api/elo/command"
    }
}