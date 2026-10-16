package br.com.icaroamaral.elo

import org.json.JSONObject

object EloWakeWordDecision {
    fun matches(result: JSONObject, minimumConfidence: Double = 0.90): Boolean {
        val text = result.optString("text").trim()
        if (text != "elo" && !text.startsWith("elo ")) return false
        val first = result.optJSONArray("result")?.optJSONObject(0) ?: return false
        val duration = first.optDouble("end") - first.optDouble("start")
        return first.optString("word") == "elo" && first.optDouble("conf") >= minimumConfidence &&
            duration in 0.12..1.5
    }
}
