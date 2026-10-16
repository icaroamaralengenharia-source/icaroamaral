package br.com.icaroamaral.elo

/** A decoder segment is not necessarily the end of the person's complete turn. */
class EloVoiceUtteranceBuffer(private val settleMs: Long = 650, private val maxChars: Int = 36_000) {
    private val segments = mutableListOf<String>()
    private var partial = ""
    private var lastSegmentAt = 0L
    private var emitted = false
    fun preview() = (segments + partial).filter { it.isNotBlank() }.joinToString(" ").take(maxChars)
    fun partial(text: String) { if (!emitted) partial = text.trim().take(maxChars) }
    fun segment(text: String, nowMs: Long) {
        if (emitted) return
        if (text.isNotBlank()) { segments.add(text.trim().take(maxChars)); lastSegmentAt = nowMs }
        partial = ""
    }
    fun poll(nowMs: Long): String? {
        if (emitted || segments.isEmpty() || partial.isNotBlank() || nowMs - lastSegmentAt < settleMs) return null
        emitted = true
        return preview().also { segments.clear(); partial = "" }
    }
}
