package br.com.icaroamaral.elo

/** Begin synthesis with less text; preserve the entire reply, word order and neural profile. */
object EloSpeechChunks {
    fun build(text: String): List<String> {
        var rest = text.replace(Regex("\\s+"), " ").trim()
        if (rest.isBlank()) return emptyList()
        val chunks = mutableListOf<String>()
        while (rest.isNotBlank()) {
            val limit = if (chunks.isEmpty()) 160 else 240
            if (rest.length <= limit) { chunks.add(rest); break }
            val sentence = Regex("[.!?;:]\\s").findAll(rest.take(limit + 1)).lastOrNull { it.range.first >= 70 }
            var cut = sentence?.range?.first?.plus(1) ?: rest.lastIndexOf(' ', limit).takeIf { it >= 70 } ?: limit
            if (cut > 0 && Character.isHighSurrogate(rest[cut - 1])) cut -= 1
            chunks.add(rest.take(cut).trim())
            rest = rest.drop(cut).trim()
        }
        return chunks
    }
}
