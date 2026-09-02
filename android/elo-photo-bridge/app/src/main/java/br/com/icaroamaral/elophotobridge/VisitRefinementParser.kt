package br.com.icaroamaral.elophotobridge

import java.text.Normalizer
import java.time.LocalDate
import java.time.LocalTime

data class VisitRefinementInput(
  val date: LocalDate? = null,
  val startTime: LocalTime? = null,
  val endTime: LocalTime? = null,
  val cityHint: String? = null,
  val selectedIndex: Int? = null,
  val rawStartTime: String? = null,
  val rawEndTime: String? = null,
  val startHasSeconds: Boolean = false,
  val endHasSeconds: Boolean = false,
  val timeRangeInvalid: Boolean = false
)

private data class ParsedTimeRange(
  val startTime: LocalTime,
  val endTime: LocalTime,
  val rawStartTime: String,
  val rawEndTime: String,
  val startHasSeconds: Boolean,
  val endHasSeconds: Boolean
)

class VisitRefinementParser(private val commandParser: CommandParser = CommandParser()) {
  fun parse(input: String): VisitRefinementInput {
    val raw = input.trim()
    val selectedIndex = raw.toIntOrNull()?.takeIf { it > 0 }
    if (selectedIndex != null) return VisitRefinementInput(selectedIndex = selectedIndex)

    val date = commandParser.parse(raw).dateHint
    val timeAttempted = hasTimeRange(raw)
    val times = parseTimeRange(raw)
    val city = parseCity(raw)

    return VisitRefinementInput(
      date = date,
      startTime = times?.startTime,
      endTime = times?.endTime,
      cityHint = city,
      selectedIndex = null,
      rawStartTime = times?.rawStartTime,
      rawEndTime = times?.rawEndTime,
      startHasSeconds = times?.startHasSeconds ?: false,
      endHasSeconds = times?.endHasSeconds ?: false,
      timeRangeInvalid = timeAttempted && times == null
    )
  }

  private fun hasTimeRange(raw: String): Boolean {
    val normalized = normalize(raw)
    return Regex("\\b\\d{1,2}(?:[:h]\\d{2}(?::\\d{2})?)?\\s*(?:a|ate)\\s*\\d{1,2}(?:[:h]\\d{2}(?::\\d{2})?)?\\b").containsMatchIn(normalized)
  }

  private fun parseTimeRange(raw: String): ParsedTimeRange? {
    val normalized = normalize(raw).replace("as", "a").replace("ate", "a")
    val regex = Regex("\\b(\\d{1,2})(?:[:h](\\d{2})(?::(\\d{2}))?)?\\s*(?:a|ate)\\s*(\\d{1,2})(?:[:h](\\d{2})(?::(\\d{2}))?)?\\b")
    val match = regex.find(normalized) ?: return null
    val startHour = match.groupValues[1].toIntOrNull() ?: return null
    val startMinute = match.groupValues[2].takeIf(String::isNotBlank)?.toIntOrNull() ?: 0
    val startSecondText = match.groupValues[3].takeIf(String::isNotBlank)
    val startSecond = startSecondText?.toIntOrNull() ?: 0
    val endHour = match.groupValues[4].toIntOrNull() ?: return null
    val endMinute = match.groupValues[5].takeIf(String::isNotBlank)?.toIntOrNull() ?: 0
    val endSecondText = match.groupValues[6].takeIf(String::isNotBlank)
    val endSecond = endSecondText?.toIntOrNull() ?: 0
    return runCatching {
      ParsedTimeRange(
        startTime = LocalTime.of(startHour, startMinute, startSecond),
        endTime = LocalTime.of(endHour, endMinute, endSecond),
        rawStartTime = listOf(match.groupValues[1], match.groupValues[2], match.groupValues[3]).filter(String::isNotBlank).joinToString(":"),
        rawEndTime = listOf(match.groupValues[4], match.groupValues[5], match.groupValues[6]).filter(String::isNotBlank).joinToString(":"),
        startHasSeconds = startSecondText != null,
        endHasSeconds = endSecondText != null
      )
    }.getOrNull()
  }

  private fun parseCity(raw: String): String? {
    var text = raw
      .replace(Regex("\\b\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?\\b"), " ")
      .replace(Regex("\\b\\d{1,2}\\s+de\\s+[\\p{L}]+(?:\\s+de\\s+\\d{4})?\\b", RegexOption.IGNORE_CASE), " ")
      .replace(Regex("\\bde\\s+\\d{1,2}[:h]\\d{2}(?::\\d{2})?\\s*(?:a|ate|até|as|às)\\s*\\d{1,2}[:h]\\d{2}(?::\\d{2})?\\b", RegexOption.IGNORE_CASE), " ")
      .replace(Regex("\\b\\d{1,2}(?:[:h]\\d{2}(?::\\d{2})?)?\\s*(?:a|ate|até|as|às)\\s*\\d{1,2}(?:[:h]\\d{2}(?::\\d{2})?)?\\b", RegexOption.IGNORE_CASE), " ")
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