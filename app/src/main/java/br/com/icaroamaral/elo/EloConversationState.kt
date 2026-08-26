package br.com.icaroamaral.elo

enum class EloConversationState {
    WAKE_LISTENING,
    COMMAND_LISTENING,
    PROCESSING,
    SPEAKING
}

class EloCommandStabilizer {
    private var bestText = ""

    fun accept(texts: List<String>?): String {
        val candidate = texts.orEmpty()
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .maxByOrNull { it.length }
            .orEmpty()

        if (candidate.length >= bestText.length) {
            bestText = candidate
        }

        return bestText
    }

    fun snapshot(): String = bestText.trim()

    fun reset() {
        bestText = ""
    }
}
