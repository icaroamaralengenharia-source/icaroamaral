package br.com.icaroamaral.elophotobridge

import java.text.Normalizer
import java.time.LocalDate
import java.time.LocalTime

data class VisitRefinementInput(
  val date: LocalDate? = null,
  val startTime: LocalTime? = null,
  val endTime: LocalTime? = null,
  val cityHint: String? = null,
  val selectedIndex: Int? = null
)

class VisitRefinementParser(private val commandParser: CommandParser = CommandParser()) {
  fun parse(input: String): VisitRefinementInput {
    val raw = input.trim()
    val selectedIndex = raw.toIntOrNull()?.takeIf { it > 0 }
    if (selectedIndex != null) return VisitRefinementInput(selectedIndex = selectedIndex)

    val date = commandParser.parse(raw).dateHint
    val times = parseTimeRange(raw)
    val city = parseCity(raw)

    return VisitRefinementInput(
      date = date,
      startTime = times?.first,
      endTime = times?.second,
      cityHint = city,
      selectedIndex = null
    )
  }

  private fun parseTimeRange(raw: String): Pair<LocalTime, LocalTime>? {
    val normalized = normalize(raw).replace("as", "a").replace("ate", "a")
    val regex = Regex("\\b(\\d{1,2})(?:[:h](\\d{2}))?\\s*(?:a|ate)\\s*(\\d{1,2})(?:[:h](\\d{2}))?\\b")
    val match = regex.find(normalized) ?: return null
    val startHour = match.groupValues[1].toIntOrNull() ?: return null
    val startMinute = match.groupValues[2].takeIf(String::isNotBlank)?.toIntOrNull() ?: 0
    val endHour = match.groupValues[3].toIntOrNull() ?: return null
    val endMinute = match.groupValues[4].takeIf(String::isNotBlank)?.toIntOrNull() ?: 0
    return runCatching { LocalTime.of(startHour, startMinute) to LocalTime.of(endHour, endMinute) }.getOrNull()
  }

  private fun parseCity(raw: String): String? {
    var text = raw
      .replace(Regex("\\b\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?\\b"), " ")
      .replace(Regex("\\b\\d{1,2}\\s+de\\s+[\\p{L}]+(?:\\s+de\\s+\\d{4})?\\b", RegexOption.IGNORE_CASE), " ")
      .replace(Regex("\\bde\\s+\\d{1,2}[:h]\\d{2}\\s*(?:a|ate|até|as|às)\\s*\\d{1,2}[:h]\\d{2}\\b", RegexOption.IGNORE_CASE), " ")
      .replace(Regex("\\b\\d{1,2}(?:[:h]\\d{2})?\\s*(?:a|ate|até|as|às)\\s*\\d{1,2}(?:[:h]\\d{2})?\\b", RegexOption.IGNORE_CASE), " ")
      .replace(Regex("\\b(?:do|dia|em|no|na|de|ate|até|as|às)\\b", RegexOption.IGNORE_CASE), " ")
      .trim()
    text = text.replace(Regex("\\s+"), " ").trim()
    return text.takeIf { it.isNotBlank() && it.any(Char::isLetter) }
  }

  companion object {
    fun normalize(value: String?): String {
      return Normalizer.normalize((value ?: "").lowercase(), Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "")
        .replace("\\s+".toRegex(), " ")
        .trim()
    }

    fun cityMatches(candidate: String?, hint: String?): Boolean {
      val normalizedCandidate = normalize(candidate)
      val normalizedHint = normalize(hint)
      if (normalizedHint.isBlank()) return true
      if (normalizedCandidate.isBlank() || normalizedCandidate == "unknown") return false
      return normalizedCandidate == normalizedHint ||
        normalizedCandidate.contains(normalizedHint) ||
        normalizedHint.contains(normalizedCandidate)
    }
  }
}
