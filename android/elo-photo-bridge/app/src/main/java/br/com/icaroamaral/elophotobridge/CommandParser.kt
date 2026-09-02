package br.com.icaroamaral.elophotobridge

import java.text.Normalizer
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

class CommandParser {
  fun parse(input: String): ParsedCommand {
    val raw = input.trim()
    val normalized = normalize(raw)
    val reportType = when {
      normalized.contains("sgto") -> ReportType.SGTO
      normalized.contains("stelecom") -> ReportType.STELECOM
      normalized.contains("relatorio") -> ReportType.UNKNOWN
      else -> ReportType.UNKNOWN
    }
    val latestVisit = normalized.contains("ultima visita") || normalized.contains("ultimo atendimento")
    val dateHint = parseDate(raw, normalized)
    val cityHint = parseCityHint(raw)
    val timeRange = TimeRangeTextParser.parse(raw)
    val timeAttempted = TimeRangeTextParser.hasAttempt(raw)

    return ParsedCommand(
      reportType = reportType,
      cityHint = cityHint,
      dateHint = dateHint,
      latestVisit = latestVisit,
      startTimeHint = timeRange?.startTime,
      endTimeHint = timeRange?.endTime,
      rawStartTimeHint = timeRange?.rawStartTime,
      rawEndTimeHint = timeRange?.rawEndTime,
      endTimeHasSeconds = timeRange?.endHasSeconds ?: false,
      timeRangeInvalid = timeAttempted && timeRange == null
    )
  }

  private fun parseDate(raw: String, normalized: String): LocalDate? {
    if (normalized.contains("hoje")) return LocalDate.now()
    if (normalized.contains("ontem")) return LocalDate.now().minusDays(1)

    Regex("\\b(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?\\b")
      .find(raw)
      ?.let { match ->
        val day = match.groupValues[1].toIntOrNull() ?: return@let null
        val month = match.groupValues[2].toIntOrNull() ?: return@let null
        val yearText = match.groupValues.getOrNull(3).orEmpty()
        val year = when (yearText.length) {
          0 -> LocalDate.now().year
          2 -> 2000 + yearText.toInt()
          else -> yearText.toIntOrNull() ?: return@let null
        }
        return runCatching { LocalDate.of(year, month, day) }.getOrNull()
      }

    Regex("\\b(\\d{1,2})\\s+de\\s+([\\p{L}]+)(?:\\s+de\\s+(\\d{4}))?\\b", RegexOption.IGNORE_CASE)
      .find(raw)
      ?.let { match ->
        val day = match.groupValues[1].toIntOrNull() ?: return@let null
        val month = monthNumber(normalize(match.groupValues[2])) ?: return@let null
        val year = match.groupValues.getOrNull(3)?.takeIf(String::isNotBlank)?.toIntOrNull() ?: LocalDate.now().year
        return runCatching { LocalDate.of(year, month, day) }.getOrNull()
      }

    return try {
      LocalDate.parse(raw, DateTimeFormatter.ISO_LOCAL_DATE)
    } catch (_: DateTimeParseException) {
      null
    }
  }

  private fun parseCityHint(raw: String): String? {
    Regex("\\b(?:de|em)\\s+([\\p{L}\\s]+?)\\s+(?:do\\s+dia|dia|em|no|na)\\b", RegexOption.IGNORE_CASE)
      .find(raw)
      ?.groupValues
      ?.getOrNull(1)
      ?.trim()
      ?.takeIf { looksLikeCity(it) }
      ?.let { return it }

    return Regex("\\b(?:de|em)\\s+([\\p{L}\\s]+)$", RegexOption.IGNORE_CASE)
      .find(raw)
      ?.groupValues
      ?.getOrNull(1)
      ?.trim()
      ?.takeIf { looksLikeCity(it) }
  }

  private fun looksLikeCity(value: String): Boolean {
    val normalized = normalize(value)
    if (normalized.isBlank()) return false
    return !listOf("hoje", "ontem", "ultima visita", "ultimo atendimento", "agosto", "setembro", "janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "outubro", "novembro", "dezembro").any { normalized.contains(it) }
  }

  private fun monthNumber(value: String): Int? {
    return mapOf(
      "janeiro" to 1,
      "fevereiro" to 2,
      "marco" to 3,
      "abril" to 4,
      "maio" to 5,
      "junho" to 6,
      "julho" to 7,
      "agosto" to 8,
      "setembro" to 9,
      "outubro" to 10,
      "novembro" to 11,
      "dezembro" to 12
    )[value]
  }

  private fun normalize(value: String): String {
    return Normalizer.normalize(value.lowercase(), Normalizer.Form.NFD)
      .replace("\\p{Mn}+".toRegex(), "")
      .replace("\\s+".toRegex(), " ")
      .trim()
  }
}
