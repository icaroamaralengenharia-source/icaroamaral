package br.com.icaroamaral.elophotobridge

import java.text.Normalizer
import java.time.LocalTime

internal data class ParsedTimeRangeText(
  val startTime: LocalTime,
  val endTime: LocalTime,
  val rawStartTime: String,
  val rawEndTime: String,
  val startHasSeconds: Boolean,
  val endHasSeconds: Boolean
)

internal object TimeRangeTextParser {
  private const val TIME_PATTERN = "(\\d{1,2})(?:[:h](\\d{2})(?::(\\d{2}))?)?"

  fun hasAttempt(input: String): Boolean {
    val normalized = normalize(input)
    val labeledAttempt = Regex("\\b(?:inicio|start|comeco)\\b.*\\b(?:fim|final|end|termino)\\b").containsMatchIn(normalized)
    val rangeAttempt = Regex("\\b\\d{1,2}(?:[:h]\\d{2}(?::\\d{2})?)?\\s*(?:a|ate|as)\\s*\\d{1,2}(?:[:h]\\d{2}(?::\\d{2})?)?\\b").containsMatchIn(normalized)
    return labeledAttempt || rangeAttempt
  }

  fun parse(input: String): ParsedTimeRangeText? {
    val normalized = normalize(input)
    val labeled = Regex("\\b(?:inicio|start|comeco)\\s*:?\\s*$TIME_PATTERN\\b.*?\\b(?:fim|final|end|termino)\\s*:?\\s*$TIME_PATTERN\\b")
    labeled.find(normalized)?.let { return toRange(it, 1, 4) }

    val rangeText = normalized.replace(Regex("\\b(?:ate|as)\\b"), "a")
    val range = Regex("\\b$TIME_PATTERN\\s*a\\s*$TIME_PATTERN\\b")
    range.find(rangeText)?.let { return toRange(it, 1, 4) }

    return null
  }

  fun strip(input: String): String {
    return input
      .replace(Regex("\\b(?:inicio|início|start|comeco|começo)\\s*:?\\s*\\d{1,2}(?:[:h]\\d{2}(?::\\d{2})?)?\\b.*?\\b(?:fim|final|end|termino|término)\\s*:?\\s*\\d{1,2}(?:[:h]\\d{2}(?::\\d{2})?)?\\b", RegexOption.IGNORE_CASE), " ")
      .replace(Regex("\\bde\\s+\\d{1,2}[:h]\\d{2}(?::\\d{2})?\\s*(?:a|ate|até|as|às)\\s*\\d{1,2}[:h]\\d{2}(?::\\d{2})?\\b", RegexOption.IGNORE_CASE), " ")
      .replace(Regex("\\bdas\\s+\\d{1,2}[:h]\\d{2}(?::\\d{2})?\\s*(?:a|ate|até|as|às)\\s*\\d{1,2}[:h]\\d{2}(?::\\d{2})?\\b", RegexOption.IGNORE_CASE), " ")
      .replace(Regex("\\b\\d{1,2}(?:[:h]\\d{2}(?::\\d{2})?)?\\s*(?:a|ate|até|as|às)\\s*\\d{1,2}(?:[:h]\\d{2}(?::\\d{2})?)?\\b", RegexOption.IGNORE_CASE), " ")
  }

  private fun toRange(match: MatchResult, startIndex: Int, endIndex: Int): ParsedTimeRangeText? {
    val startHour = match.groupValues[startIndex].toIntOrNull() ?: return null
    val startMinute = match.groupValues[startIndex + 1].takeIf(String::isNotBlank)?.toIntOrNull() ?: 0
    val startSecondText = match.groupValues[startIndex + 2].takeIf(String::isNotBlank)
    val startSecond = startSecondText?.toIntOrNull() ?: 0
    val endHour = match.groupValues[endIndex].toIntOrNull() ?: return null
    val endMinute = match.groupValues[endIndex + 1].takeIf(String::isNotBlank)?.toIntOrNull() ?: 0
    val endSecondText = match.groupValues[endIndex + 2].takeIf(String::isNotBlank)
    val endSecond = endSecondText?.toIntOrNull() ?: 0
    return runCatching {
      ParsedTimeRangeText(
        startTime = LocalTime.of(startHour, startMinute, startSecond),
        endTime = LocalTime.of(endHour, endMinute, endSecond),
        rawStartTime = listOf(match.groupValues[startIndex], match.groupValues[startIndex + 1], match.groupValues[startIndex + 2]).filter(String::isNotBlank).joinToString(":"),
        rawEndTime = listOf(match.groupValues[endIndex], match.groupValues[endIndex + 1], match.groupValues[endIndex + 2]).filter(String::isNotBlank).joinToString(":"),
        startHasSeconds = startSecondText != null,
        endHasSeconds = endSecondText != null
      )
    }.getOrNull()
  }

  private fun normalize(value: String?): String {
    return Normalizer.normalize((value ?: "").lowercase(), Normalizer.Form.NFD)
      .replace("\\p{Mn}+".toRegex(), "")
      .replace("\\s+".toRegex(), " ")
      .trim()
  }
}
