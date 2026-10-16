package br.com.icaroamaral.elo

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Base64
import java.util.concurrent.atomic.AtomicReference

/** Deliberately not a data class: tokens must never appear in generated toString(). */
class EloCanonicalVoiceContext private constructor(
    val token: String, val userId: String, val conversationId: String,
    val expiresAt: Long, val identity: JSONObject, val chatContext: JSONObject, val voice: String
) {
    fun usable(now: Long = System.currentTimeMillis() / 1000) = expiresAt > now + 30
    fun sameScope(other: EloCanonicalVoiceContext) =
        userId == other.userId && conversationId == other.conversationId &&
        identity.optString("institutionId") == other.identity.optString("institutionId") &&
        identity.optString("companyId") == other.identity.optString("companyId") &&
        identity.optString("projectId") == other.identity.optString("projectId")
    override fun toString() = "EloCanonicalVoiceContext(redacted)"
    companion object {
        fun parse(raw: String): EloCanonicalVoiceContext {
            require(raw.length <= 180_000) { "CONTEXT_TOO_LARGE" }
            val json = JSONObject(raw)
            val token = json.getString("accessToken")
            require(token.length in 40..12_000 && token.matches(Regex("[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+"))) { "INVALID_SESSION" }
            val claims = JSONObject(String(Base64.getUrlDecoder().decode(token.split('.')[1]), Charsets.UTF_8))
            val identity = json.getJSONObject("identity")
            val userId = identity.getString("userId")
            val conversation = json.getString("conversationId")
            require(userId.length in 1..140 && conversation.matches(Regex("[A-Za-z0-9_-]{1,180}"))) { "INVALID_SCOPE" }
            require(claims.optString("sub") == userId) { "IDENTITY_MISMATCH" }
            val safeIdentity = JSONObject().put("userId", userId)
            listOf("anonymousId", "institutionId", "companyId", "projectId").forEach { key ->
                identity.optString(key).takeIf { it.isNotBlank() && it.length <= 180 }?.let { safeIdentity.put(key, it) }
            }
            val input = json.optJSONObject("chatContext") ?: JSONObject()
            val safeContext = JSONObject()
                .put("currentConversationId", conversation).put("mode", "standalone").put("source", "elo")
            listOf("eloContext", "memoryScope", "workingMemorySummary", "imageAnalysisContext",
                "activeDocument", "activeAnalysisContext", "deviceId", "documentsSummary",
                "activeDocumentId", "activeSubject").forEach { key ->
                if (input.has(key)) safeContext.put(key, input.get(key))
            }
            require(safeContext.toString().length <= 120_000) { "CONTEXT_TOO_LARGE" }
            val voice = json.optJSONObject("neuralVoice")?.optString("voice").orEmpty().lowercase()
                .takeIf { it in setOf("alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer") }.orEmpty()
            return EloCanonicalVoiceContext(token, userId, conversation, claims.optLong("exp"), safeIdentity, safeContext, voice)
                .also { require(it.usable()) { "SESSION_EXPIRED" } }
        }
    }
}

/** Only an in-process handoff. Nothing is written to preferences, files or diagnostics. */
object EloNativeVoiceSession {
    @Volatile private var current: EloCanonicalVoiceContext? = null
    @Volatile private var validated = false
    fun current(): EloCanonicalVoiceContext? = current?.takeIf { validated && it.usable() }
    fun candidate() = current
    fun replace(context: EloCanonicalVoiceContext): Boolean {
        val same = current?.sameScope(context) ?: true
        current = context; validated = false
        return same
    }
    fun confirm(context: EloCanonicalVoiceContext): Boolean {
        if (current !== context || !context.usable()) return false
        validated = true; return true
    }
    fun clear() { validated = false; current = null }
    @Synchronized fun renew(previous: EloCanonicalVoiceContext, next: EloCanonicalVoiceContext): Boolean {
        if (!validated || current !== previous || !previous.sameScope(next) || !next.usable() || next.expiresAt <= previous.expiresAt) return false
        current = next
        return true
    }
}

class EloNativeVoiceFailure(val code: String) : Exception(code)
data class EloVoiceToolResult(val answer: String, val played: Boolean = false, val pending: Boolean = false)

/** Uses the same authenticated conversation endpoints as the official Web client. */
class EloCanonicalVoiceClient(private val testTransport: JsonTransport? = null) {
    var trace: ((String, Long) -> Unit)? = null
    fun interface JsonTransport {
        fun exchange(method: String, path: String, body: JSONObject?): JSONObject
    }
    private val active = AtomicReference<HttpURLConnection?>()
    @Volatile private var revision = 0L
    fun cancel() { revision += 1; active.getAndSet(null)?.disconnect() }
    private fun check(context: EloCanonicalVoiceContext, expected: Long, expectedSession: EloCanonicalVoiceContext = context) {
        if (Thread.currentThread().isInterrupted || revision != expected) throw EloNativeVoiceFailure("CANCELLED")
        if (!context.usable()) throw EloNativeVoiceFailure("SESSION_EXPIRED")
        if (EloNativeVoiceSession.candidate() !== expectedSession) throw EloNativeVoiceFailure("CONTEXT_CHANGED")
    }
    private fun request(context: EloCanonicalVoiceContext, expected: Long, path: String, body: JSONObject? = null,
                        expectedSession: EloCanonicalVoiceContext = context): JSONObject {
        val started = System.nanoTime()
        check(context, expected, expectedSession)
        require(path.startsWith("/api/elo/")) { "INVALID_ENDPOINT" }
        testTransport?.let {
            val result = it.exchange(if (body == null) "GET" else "POST", path, body)
            check(context, expected, expectedSession)
            return result
        }
        val connection = URL(BACKEND + path).openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 12_000; connection.readTimeout = 40_000
        connection.requestMethod = if (body == null) "GET" else "POST"
        connection.setRequestProperty("Authorization", "Bearer " + context.token)
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
        active.set(connection)
        try {
            check(context, expected, expectedSession)
            if (body != null) {
                connection.doOutput = true
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                connection.setFixedLengthStreamingMode(bytes.size)
                connection.outputStream.use { it.write(bytes) }
            }
            val status = connection.responseCode
            if (status !in 200..299) throw EloNativeVoiceFailure(if (status == 401 || status == 403) "SESSION_REJECTED" else "HTTP_" + status)
            val data = connection.inputStream.use { stream ->
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    check(context, expected, expectedSession)
                    val count = stream.read(buffer); if (count < 0) break
                    if (output.size() + count > 2_000_000) throw EloNativeVoiceFailure("RESPONSE_TOO_LARGE")
                    output.write(buffer, 0, count)
                }
                JSONObject(output.toString("UTF-8"))
            }
            check(context, expected, expectedSession)
            if (data.optBoolean("ok", true).not()) throw EloNativeVoiceFailure("BACKEND_REJECTED")
            return data
        } finally {
            active.compareAndSet(connection, null); connection.disconnect()
            val phase = if (body == null) "history" else if (path.endsWith("/messages"))
                if (body.optString("role") == "user") "save_user" else "save_assistant" else "answer"
            trace?.invoke(phase, (System.nanoTime() - started) / 1_000_000)
        }
    }
    private fun conversationPath(context: EloCanonicalVoiceContext): String =
        "/api/elo/conversations/" + context.conversationId + "?" +
            context.identity.keys().asSequence().joinToString("&") { key ->
                URLEncoder.encode(key, "UTF-8") + "=" + URLEncoder.encode(context.identity.optString(key), "UTF-8")
            }
    fun validate(context: EloCanonicalVoiceContext, expectedSession: EloCanonicalVoiceContext = context): Int {
        require(context.sameScope(expectedSession)) { "CONTEXT_CHANGED" }
        val result = request(context, revision, conversationPath(context), expectedSession = expectedSession)
        if (result.optJSONObject("conversation")?.optString("id") != context.conversationId)
            throw EloNativeVoiceFailure("CONVERSATION_MISMATCH")
        return result.optJSONArray("messages")?.length() ?: 0
    }
    private fun persist(context: EloCanonicalVoiceContext, expected: Long, role: String, content: String) {
        val body = JSONObject(context.identity.toString()).put("role", role).put("content", content).put("attachments", JSONArray())
        // A timed-out POST is never retried automatically; the service suspends for canonical resync.
        request(context, expected, "/api/elo/conversations/" + context.conversationId + "/messages", body)
    }
    fun ask(context: EloCanonicalVoiceContext, text: String, tool: ((String) -> EloVoiceToolResult?)? = null): String {
        val expected = revision
        val conversation = request(context, expected, conversationPath(context))
        if (conversation.optJSONObject("conversation")?.optString("id") != context.conversationId)
            throw EloNativeVoiceFailure("CONVERSATION_MISMATCH")
        val all = conversation.optJSONArray("messages") ?: JSONArray()
        val messages = (0 until all.length()).map { all.getJSONObject(it) }.filter {
            it.optString("role") in listOf("user", "assistant") && it.optString("content").isNotBlank()
        }
        val recent = JSONArray()
        messages.takeLast(48).forEach { recent.put(JSONObject().put("role", it.optString("role")).put("content", it.optString("content").take(36_000))) }
        val contextBody = JSONObject(context.chatContext.toString())
        if (messages.size > 48) {
            val archive = JSONArray()
            val older = messages.dropLast(48)
            (older.take(4) + older.takeLast(4)).distinctBy { it.optString("id", it.toString()) }.take(12).forEach {
                archive.put(JSONObject().put("role", it.optString("role")).put("content", it.optString("content").take(if (it.optString("role") == "user") 300 else 120)))
            }
            contextBody.put("conversationArchive", JSONObject().put("conversationId", context.conversationId).put("messages", archive))
        }
        persist(context, expected, "user", text)
        val toolResult = tool?.invoke(text)
        if (toolResult != null) {
            check(context, expected)
            val answer = toolResult.answer.trim().take(12_000)
            if (answer.isBlank()) throw EloNativeVoiceFailure("EMPTY_TOOL_ANSWER")
            persist(context, expected, "assistant", answer)
            return answer
        }
        val payload = JSONObject().put("message", text).put("history", recent).put("context", contextBody)
            .put("anonymousId", context.identity.optString("anonymousId")).put("eloContext", contextBody.optString("eloContext", "geral"))
        val result = request(context, expected, "/api/elo/chat", payload)
        val answer = result.optString("answer").trim().take(12_000)
        if (answer.isBlank()) throw EloNativeVoiceFailure("EMPTY_ANSWER")
        check(context, expected)
        persist(context, expected, "assistant", answer)
        return answer
    }
    companion object { const val BACKEND = "https://obrareport-backend.onrender.com" }
}
