package br.com.icaroamaral.elo

import java.text.Normalizer

object EloWakeParser {
    enum class WakeDecision {
        NO_WAKE,
        WAKE_ONLY,
        WAKE_WITH_COMMAND
    }

    data class WakeHypothesis(
        val raw: String,
        val normalized: String,
        val aliasMatched: String,
        val wakeMatched: Boolean,
        val commandAfterWake: String,
        val decision: WakeDecision
    )

    private data class WakeMatch(val range: IntRange, val alias: String)

    private val leadingWakeRegexes = listOf(
        Regex("^\\s*([eéèêë]lo)\\b", RegexOption.IGNORE_CASE),
        Regex("^\\s*([eéèêë]\\s+lo)\\b", RegexOption.IGNORE_CASE),
        Regex("^\\s*(ello)\\b", RegexOption.IGNORE_CASE),
        Regex("^\\s*(hello)\\b", RegexOption.IGNORE_CASE)
    )
    private val immediateSeparatorRegex = Regex("^[\\s,.:;!?\\-–—]+")
    private val whitespaceRegex = Regex("\\s+")
    private val diacriticsRegex = Regex("\\p{Mn}+")
    private val punctuationRegex = Regex("[,.:;!?\\-–—]+")

    @JvmStatic
    fun hasLeadingWake(text: String): Boolean {
        return findLeadingWake(text) != null
    }

    @JvmStatic
    fun extractCommandAfterWake(text: String): String {
        val match = findLeadingWake(text) ?: return ""
        return text.substring(match.range.last + 1)
            .replace(immediateSeparatorRegex, "")
            .trim()
            .replace(whitespaceRegex, " ")
    }

    @JvmStatic
    fun normalizeTranscript(text: String): String {
        return Normalizer.normalize(text.trim(), Normalizer.Form.NFD)
            .replace(diacriticsRegex, "")
            .replace(punctuationRegex, " ")
            .lowercase()
            .trim()
            .replace(whitespaceRegex, " ")
    }

    @JvmStatic
    fun analyzeHypothesis(text: String): WakeHypothesis {
        val raw = text.trim()
        val normalized = normalizeTranscript(raw)
        val wake = findLeadingWake(raw)
        val command = if (wake == null) "" else extractCommandAfterWake(raw)
        val decision = when {
            wake == null -> WakeDecision.NO_WAKE
            command.isBlank() -> WakeDecision.WAKE_ONLY
            else -> WakeDecision.WAKE_WITH_COMMAND
        }

        return WakeHypothesis(
            raw = raw,
            normalized = normalized,
            aliasMatched = wake?.alias.orEmpty(),
            wakeMatched = wake != null,
            commandAfterWake = command,
            decision = decision
        )
    }

    @JvmStatic
    fun selectBestWakeHypothesis(results: List<String>?): WakeHypothesis {
        val analyzed = results.orEmpty()
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .map { analyzeHypothesis(it) }

        return analyzed
            .sortedWith(
                compareByDescending<WakeHypothesis> {
                    when (it.decision) {
                        WakeDecision.WAKE_WITH_COMMAND -> 2
                        WakeDecision.WAKE_ONLY -> 1
                        WakeDecision.NO_WAKE -> 0
                    }
                }.thenByDescending { it.commandAfterWake.length }
                    .thenByDescending { it.raw.length }
            )
            .firstOrNull()
            ?: WakeHypothesis("", "", "", false, "", WakeDecision.NO_WAKE)
    }

    @JvmStatic
    fun mergeCommandContinuation(current: String, next: String): String {
        val base = current.trim()
        val addition = next.trim()
        if (base.isBlank()) return addition
        if (addition.isBlank()) return base

        val baseLower = base.lowercase()
        val additionLower = addition.lowercase()
        if (additionLower == baseLower || baseLower.contains(additionLower)) return base
        if (additionLower.contains(baseLower)) return addition

        val baseWords = base.split(Regex("\\s+")).filter { it.isNotBlank() }
        val additionWords = addition.split(Regex("\\s+")).filter { it.isNotBlank() }
        val maxOverlap = minOf(baseWords.size, additionWords.size)
        for (size in maxOverlap downTo 1) {
            val baseTail = baseWords.takeLast(size).joinToString(" ").lowercase()
            val additionHead = additionWords.take(size).joinToString(" ").lowercase()
            if (baseTail == additionHead) {
                return (baseWords + additionWords.drop(size)).joinToString(" ")
            }
        }

        return (base + " " + addition).trim().replace(whitespaceRegex, " ")
    }

    private fun findLeadingWake(text: String): WakeMatch? {
        for (regex in leadingWakeRegexes) {
            val match = regex.find(text) ?: continue
            val alias = normalizeTranscript(match.groupValues[1])
            return WakeMatch(match.range, alias)
        }
        return null
    }
}
