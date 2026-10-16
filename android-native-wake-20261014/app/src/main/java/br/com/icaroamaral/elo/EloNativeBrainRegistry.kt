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
    @Volatile var renewDispatcher: (() -> Boolean)? = null
    @Volatile var sessionRenewed: (() -> Unit)? = null
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
        val existing = EloNativeVoiceSession.candidate()
        if (enabled && existing != null && existing.sameScope(context)) {
            if (context.expiresAt > existing.expiresAt) renewContext(raw, result)
            else result(existing.usable(), if (existing.usable()) "READY" else "RENEWAL_RETRY_PENDING")
            return
        }
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
    fun renewContext(raw: String, result: (Boolean, String) -> Unit) {
        val previous = EloNativeVoiceSession.candidate()
        val next = runCatching { EloCanonicalVoiceContext.parse(raw) }.getOrNull()
        if (!enabled || previous == null || next == null || !previous.sameScope(next) || next.expiresAt <= previous.expiresAt) {
            result(false, "RENEWAL_SCOPE_REJECTED"); return
        }
        validator.execute {
            val valid = runCatching { client.validate(next, previous); true }.getOrDefault(false)
            main.post {
                if (!valid) { result(false, "RENEWAL_VALIDATION_FAILED"); return@post }
                fun commitWhenIdle() {
                    if (!enabled || EloNativeVoiceSession.candidate() !== previous) { result(false, "RENEWAL_CANCELLED"); return }
                    // Never swap a context used by an in-flight canonical POST.
                    if (JSONObject(status).optString("state") == "PROCESSING") { main.postDelayed({ commitWhenIdle() }, 200); return }
                    val ok = EloNativeVoiceSession.renew(previous, next)
                    if (ok) sessionRenewed?.invoke()
                    result(ok, if (ok) "SESSION_RENEWED" else "RENEWAL_REJECTED")
                }
                commitWhenIdle()
            }
        }
    }
}
