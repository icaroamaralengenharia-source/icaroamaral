package br.com.icaroamaral.elo

import android.net.Uri
import android.webkit.WebMessage
import android.webkit.WebMessagePort
import android.webkit.WebView
import org.json.JSONObject

/** A message port is transferred only to the official top frame, never to arbitrary iframes. */
class EloNativeBrainWebChannel(
    private val webView: WebView,
    private val activate: () -> Boolean
) {
    private var port: WebMessagePort? = null
    private val musicPending = mutableMapOf<String, (JSONObject) -> Unit>()
    private val musicDispatcher: (JSONObject, (JSONObject) -> Unit) -> Boolean = { request, result ->
        if (!trusted() || port == null) false else {
            musicPending[request.getString("id")] = result
            send(JSONObject().put("type", "MUSIC_REQUEST").put("request", request)); true
        }
    }
    private val musicCancel: (String) -> Unit = { id ->
        musicPending.remove(id)
        send(JSONObject().put("type", "MUSIC_CANCEL").put("id", id))
    }
    private val observer: (String) -> Unit = { data -> send(JSONObject().put("type", "STATE").put("data", JSONObject(data))) }
    private val transcriptObserver: (String, Boolean) -> Unit = { text, final ->
        if (trusted() && EloNativeBrainRegistry.activityVisible)
            send(JSONObject().put("type", "TRANSCRIPT").put("text", text).put("final", final))
    }
    private fun trusted() = runCatching {
        val uri = Uri.parse(webView.url)
        uri.scheme == "https" && uri.host == "www.icaroamaral.com.br" && uri.path == "/elo.html"
    }.getOrDefault(false)
    fun install() {
        if (port != null && trusted()) { resume(); return }
        close()
        if (!trusted()) return
        val nonce = java.util.UUID.randomUUID().toString()
        val script = webView.context.assets.open("elo-native-brain.js").bufferedReader().use { it.readText() }
            .replace("ELO_NATIVE_CHANNEL_TOKEN_V1", nonce)
        webView.evaluateJavascript(script) {
            if (!trusted()) return@evaluateJavascript
            val pair = webView.createWebMessageChannel()
            port = pair[0]
            pair[0].setWebMessageCallback(object : WebMessagePort.WebMessageCallback() {
                override fun onMessage(port: WebMessagePort, message: WebMessage) {
                    if (!trusted()) { close(); EloNativeBrainRegistry.clearContext(); return }
                    val raw = message.data ?: return
                    if (raw.length > 190_000) return
                    val json = runCatching { JSONObject(raw) }.getOrNull() ?: return
                    val id = json.optInt("id", -1)
                    val type = json.optString("type")
                    fun reply(ok: Boolean, code: String) {
                        send(JSONObject().put("type", "RESULT").put("id", id).put("ok", ok).put("code", code))
                    }
                    when (type) {
                        "CONTEXT" -> {
                            val payload = json.optJSONObject("payload")
                            if (payload == null) reply(false, "INVALID_CONTEXT")
                            else EloNativeBrainRegistry.bindContext(payload.toString()) { ok, code -> reply(ok, code) }
                        }
                        "ACTIVATE" -> reply(activate(), "ACTIVATION_REQUESTED")
                        "MUSIC_RESULT" -> {
                            val payload = json.optJSONObject("payload")
                            val id = payload?.optString("requestId").orEmpty()
                            val callback = musicPending.remove(id)
                            if (callback != null && payload != null) {
                                val rawResult = payload.optJSONObject("result") ?: JSONObject()
                                callback(JSONObject().put("handled", rawResult.optBoolean("handled"))
                                    .put("played", rawResult.optBoolean("played")).put("positionAdvanced", rawResult.optBoolean("positionAdvanced"))
                                    .put("pending", rawResult.optBoolean("pending")).put("decision", rawResult.optString("decision").take(80))
                                    .put("answer", rawResult.optString("answer").take(1200)))
                            }
                            reply(callback != null, "MUSIC_RESULT_RECEIVED")
                        }
                        "END" -> { EloNativeBrainRegistry.command?.invoke(EloWakeService.ACTION_END_CONVERSATION); reply(true, "ENDING") }
                        "INTERRUPT" -> { EloNativeBrainRegistry.command?.invoke(EloWakeService.ACTION_INTERRUPT); reply(true, "INTERRUPTING") }
                        "READ_MESSAGE" -> {
                            val text = json.optJSONObject("payload")?.optString("text").orEmpty()
                            val ok = text.length in 1..12_000 && EloNativeBrainRegistry.readMessage?.invoke(text) == true
                            reply(ok, if (ok) "NATIVE_READING" else "READING_UNAVAILABLE")
                        }
                        "SUSPEND" -> {
                            EloNativeBrainRegistry.command?.invoke(EloWakeService.ACTION_SUSPEND)
                            val started = android.os.SystemClock.elapsedRealtime()
                            fun checkRelease() {
                                val state = JSONObject(EloNativeBrainRegistry.status())
                                val released = state.optString("owner") == "NONE" && state.optString("reason") != "CAPTURE_NOT_RELEASED"
                                if (released || android.os.SystemClock.elapsedRealtime() - started >= 4000)
                                    reply(released, if (released) "CAPTURE_RELEASED" else "CAPTURE_NOT_RELEASED")
                                else webView.postDelayed({ checkRelease() }, 50)
                            }
                            checkRelease()
                        }
                        "RESUME_WAKE" -> { EloNativeBrainRegistry.command?.invoke(EloWakeService.ACTION_RESUME); reply(true, "RESUMING_WAKE") }
                        "DISABLE", "CLEAR_CONTEXT" -> { EloNativeBrainRegistry.clearContext(); reply(true, "DISABLED") }
                        "STATUS" -> { observer(EloNativeBrainRegistry.status()); reply(true, "STATUS") }
                        else -> reply(false, "UNSUPPORTED_MESSAGE")
                    }
                }
            })
            webView.postWebMessage(WebMessage("elo-native-brain-channel-v1:" + nonce, arrayOf(pair[1])),
                Uri.parse("https://www.icaroamaral.com.br"))
            EloNativeBrainRegistry.observe(observer)
            EloNativeBrainRegistry.observeTranscripts(transcriptObserver)
            EloNativeBrainRegistry.musicDispatcher = musicDispatcher
            EloNativeBrainRegistry.musicCancel = musicCancel
        }
    }
    fun resume() {
        if (trusted()) webView.evaluateJavascript("window.EloNativeBrain?.onResume?.()", null)
    }
    private fun send(json: JSONObject) { runCatching { port?.postMessage(WebMessage(json.toString())) } }
    fun close() {
        if (EloNativeBrainRegistry.musicDispatcher === musicDispatcher) EloNativeBrainRegistry.musicDispatcher = null
        if (EloNativeBrainRegistry.musicCancel === musicCancel) EloNativeBrainRegistry.musicCancel = null
        musicPending.values.toList().forEach { it(JSONObject().put("handled", true).put("decision", "WEBVIEW_CLOSED").put("answer", "Abra novamente o ELO para acionar o player.")) }
        musicPending.clear()
        EloNativeBrainRegistry.unobserve(observer)
        EloNativeBrainRegistry.unobserveTranscripts(transcriptObserver)
        runCatching { port?.close() }; port = null
    }
}
