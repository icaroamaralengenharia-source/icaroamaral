package br.com.icaroamaral.elo

import android.util.Log
import org.json.JSONObject

/** Temporary, non-sensitive routing diagnostics for the physical smoke test. */
object EloRoutingTrace {
    fun log(
        stage: String,
        phrase: String,
        source: String = "TEXT",
        online: Boolean? = null,
        engine: String = "",
        handled: Boolean = false,
        requiresInternet: Boolean = false,
        action: String = "",
        reason: String = "",
    ) {
        runCatching {
            Log.i(
                stage,
                "phrase=${safe(phrase)} source=${safe(source)} online=${online?.toString() ?: "unknown"} " +
                    "engine=${safe(engine)} handled=$handled requiresInternet=$requiresInternet " +
                    "action=${safe(action)} reason=${safe(reason)}"
            )
        }
    }

    fun logJson(stage: String, phrase: String, source: String, online: Boolean?, json: String, reason: String = "") {
        val result = runCatching { JSONObject(json) }.getOrNull()
        log(
            stage = stage,
            phrase = phrase,
            source = source,
            online = online,
            engine = result?.optString("engine").orEmpty().ifBlank { result?.optString("route").orEmpty() },
            handled = result?.optBoolean("handled", false) ?: false,
            requiresInternet = result?.optBoolean("requiresInternet", false) ?: false,
            action = result?.optString("action").orEmpty().ifBlank { result?.optString("state").orEmpty() },
            reason = reason,
        )
    }

    private fun safe(value: String): String = value
        .replace(Regex("[\\r\\n\\t]+"), " ")
        .trim()
        .take(160)
}
