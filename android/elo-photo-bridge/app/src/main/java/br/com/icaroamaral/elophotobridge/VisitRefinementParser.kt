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

class VisitRefinementParser(private val commandParser: CommandParser = CommandParser()) {
  fun parse(input: String): VisitRefinementInput {
    val raw = input.trim()
    val selectedIndex = raw.toIntOrNull()?.takeIf { it > 0 }
    if (selectedIndex != null) return VisitRefinementInput(selectedIndex = selectedIndex)

    val command = commandParser.parse(raw)
    val times = TimeRangeTextParser.parse(raw)
    val timeAttempted = TimeRangeTextParser.hasAttempt(raw)
    val city = parseCity(raw)

    return VisitRefinementInput(
      date = command.dateHint,
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

  private fun parseCity(raw: String): String? {
    var text = TimeRangeTextParser.strip(raw)
      .replace(Regex("\\b\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?\\b"), " ")
      .replace(Regex("\\b\\d{1,2}\\s+de\\s+[\\p{L}]+(?:\\s+de\\s+\\d{4})?\\b", RegexOption.IGNORE_CASE), " ")
      .replace(Regex("\\b(?:monte|montar|faca|faça|gerar|gere|relatorio|relatório|sgto|stelecom|photo|bridge|elo)\\b", RegexOption.IGNORE_CASE), " ")
      .replace(Regex("\\b(?:o|a|do|dia|data|em|no|na|de|ate|até|as|às|inicio|início|fim|final)\\b", RegexOption.IGNORE_CASE), " ")
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
