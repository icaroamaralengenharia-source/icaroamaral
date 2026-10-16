package br.com.icaroamaral.elo

import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/** Reuses the official resolver/player through the private port; never launches another app. */
class EloNativeMusicGateway(private val yieldFocus: (Long, Long) -> Boolean) {
    private val main = Handler(Looper.getMainLooper())
    private data class Operation(val id: String, val result: CompletableFuture<JSONObject>)
    @Volatile private var active: Operation? = null
    @Volatile private var pending = false
    @Volatile var decision = "NONE"
        private set
    @Volatile var played = false
        private set
    fun execute(text: String, turn: Long, generation: Long): EloVoiceToolResult? {
        if (!pending && !EloNativeMusicIntent.matches(text)) return null
        val operation = Operation(UUID.randomUUID().toString(), CompletableFuture())
        active = operation; played = false; decision = "RESOLVING"
        main.post {
            if (active !== operation || !yieldFocus(turn, generation)) {
                operation.result.completeExceptionally(EloNativeVoiceFailure("CANCELLED")); return@post
            }
            val request = JSONObject().put("id", operation.id).put("text", text.take(36_000))
                .put("turn", turn).put("generation", generation).put("pending", pending)
            val dispatched = EloNativeBrainRegistry.musicDispatcher?.invoke(request) { result ->
                if (active === operation) operation.result.complete(result)
            } == true
            if (!dispatched) operation.result.complete(JSONObject().put("handled", true).put("decision", "PLAYER_UNAVAILABLE")
                .put("answer", "Abra o ELO para acionar o player de música."))
        }
        try {
            val result = operation.result.get(25, TimeUnit.SECONDS)
            if (active !== operation) throw EloNativeVoiceFailure("CANCELLED")
            pending = result.optBoolean("pending")
            decision = result.optString("decision", "PLAYER_UNAVAILABLE").take(80)
            if (!result.optBoolean("handled")) return null
            played = result.optBoolean("played") && result.optBoolean("positionAdvanced")
            val answer = if (played) result.optString("answer") else result.optString("answer")
                .takeUnless { it.startsWith("Tocando", true) }.orEmpty()
            return EloVoiceToolResult(answer.ifBlank { "A reprodução não foi confirmada pelo player." }.take(1200), played, pending)
        } catch (failure: InterruptedException) {
            Thread.currentThread().interrupt(); throw EloNativeVoiceFailure("CANCELLED")
        } catch (failure: java.util.concurrent.TimeoutException) {
            decision = "PLAYER_TIMEOUT"; pending = false
            main.post { EloNativeBrainRegistry.musicCancel?.invoke(operation.id) }
            return EloVoiceToolResult("O player não respondeu. Abra o ELO e tente novamente.")
        } finally { if (active === operation) active = null }
    }
    fun cancel() {
        val old = active; active = null
        if (old != null) {
            old.result.completeExceptionally(EloNativeVoiceFailure("CANCELLED"))
            main.post { EloNativeBrainRegistry.musicCancel?.invoke(old.id) }
        }
    }
    fun clear() { cancel(); pending = false; played = false }
    fun clearPending() { pending = false }
}
