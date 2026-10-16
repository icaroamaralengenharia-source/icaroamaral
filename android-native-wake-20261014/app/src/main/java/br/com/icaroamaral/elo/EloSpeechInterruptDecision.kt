package br.com.icaroamaral.elo

import org.json.JSONObject
import java.text.Normalizer

/** Only an isolated, confident command may stop output. No conversational transcript is retained. */
object EloSpeechInterruptDecision {
    private fun words(text: String) = Normalizer.normalize(text.lowercase(), Normalizer.Form.NFD)
        .replace(Regex("\\p{Mn}+"), "").replace(Regex("[^a-z ]"), " ")
        .trim().split(Regex("\\s+"))
    fun command(result: JSONObject): String? {
        val text = result.optString("text").trim()
        if (text !in setOf("espere", "calma")) return null
        val items = result.optJSONArray("result") ?: return null
        if (items.length() != 1) return null
        val word = items.optJSONObject(0) ?: return null
        val duration = word.optDouble("end") - word.optDouble("start")
        return text.takeIf { word.optString("word") == text && word.optDouble("conf") >= 0.90 && duration in 0.15..1.8 }
    }
    // AEC is required as well. Suppress a keyword present in the outgoing text:
    // a local grammar alone cannot distinguish that TTS word from the user's voice.
    fun allowed(command: String, outgoingText: String) =
        command in setOf("espere", "calma") && command !in words(outgoingText)
}
