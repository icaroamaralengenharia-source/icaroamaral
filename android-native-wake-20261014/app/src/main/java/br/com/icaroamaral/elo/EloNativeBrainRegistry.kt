package br.com.icaroamaral.elo

import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors

/** In-process status only. No transcripts, user IDs or tokens in diagnostics. */
object EloNativeBrainRegistry {
    @Volatile var activityVisible = false
    @Volatile var preparing = false
    @Volatile var command: ((String) -> Unit)? = null
    @Volatile var readMessage: ((String) -> Boolean)? = null
    @Volatile var musicDispatcher: ((JSONObject, (JSONObject) -> Unit) -> Boolean)? = null
    @Volatile var musicCancel: ((String) -> Unit)? = null
    @Volatile var enabled = false
        private set
    @Volatile private var status = """{"state":"WAKE_DISABLED","enabled":false,"owner":"NONE","reason":""}"""
    private val observers = CopyOnWriteArraySet<(String) -> Unit>()
    private val transcriptObservers = CopyOnWriteArraySet<(String, Boolean) -> Unit>()
    private val main = Handler(Looper.getMainLooper())
    private val validator = Executors.newSingleThreadExecutor()
    private val client = EloCanonicalVoiceClient()
    fun status() = status
    fun observe(observer: (String) -> Unit) { observers.add(observer); observer(status) }
    fun unobserve(observer: (String) -> Unit) { observers.remove(observer) }
    fun observeTranscripts(observer: (String, Boolean) -> Unit) { transcriptObservers.add(observer) }
    fun unobserveTranscripts(observer: (String, Boolean) -> Unit) { transcriptObservers.remove(observer) }
    /** Ephemeral UI channel; no transcript is added to the diagnostic status or retained here. */
    fun transcript(text: String, final: Boolean) { if (activityVisible) transcriptObservers.forEach { it(text.take(36_000), final) } }
    fun publish(snapshot: EloVoiceCoordinator.Snapshot, modelReady: Boolean, peakWorkers: Int) {
        enabled = snapshot.enabled
        status = JSONObject().put("state", snapshot.state.name).put("enabled", snapshot.enabled)
            .put("owner", snapshot.owner.name).put("generation", snapshot.generation)
            .put("captureLease", snapshot.captureLease).put("turn", snapshot.turn)
            .put("reason", snapshot.reason).put("modelReady", modelReady)
            .put("peakCaptureWorkers", peakWorkers).toString()
        observers.forEach { it(status) }
    }
    fun bindContext(raw: String, result: (Boolean, String) -> Unit) {
        if (!activityVisible) { result(false, "VISIBLE_APP_REQUIRED"); return }
        val context = runCatching { EloCanonicalVoiceContext.parse(raw) }.getOrElse {
            result(false, "INVALID_SESSION_CONTEXT"); return
        }
        val existing = EloNativeVoiceSession.current()
        if (enabled && existing != null && existing.sameScope(context)) { result(true, "READY"); return }
        if (enabled) {
            command?.invoke(EloWakeService.ACTION_STOP)
            result(false, "CONTEXT_CHANGED_RETRY")
            return
        }
        client.cancel()
        EloNativeVoiceSession.replace(context)
        validator.execute {
            val ok = runCatching { client.validate(context); EloNativeVoiceSession.confirm(context) }.getOrDefault(false)
            main.post {
                if (!ok && EloNativeVoiceSession.candidate() === context) EloNativeVoiceSession.clear()
                result(ok, if (ok) "READY" else "SESSION_VALIDATION_FAILED")
            }
        }
    }
    fun clearContext() {
        client.cancel()
        command?.invoke(EloWakeService.ACTION_STOP)
        EloNativeVoiceSession.clear()
    }
}
