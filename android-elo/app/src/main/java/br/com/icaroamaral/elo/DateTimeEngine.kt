package br.com.icaroamaral.elo

import java.time.Clock
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

class DateTimeEngine(
    private val clock: Clock = Clock.systemDefaultZone(),
    private val locale: Locale = Locale("pt", "BR"),
) {
    private val dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy", locale)

    fun answer(input: String): String? {
        val text = normalize(input)
        val today = LocalDate.now(clock)
        return when {
            text.contains("depois de amanha") -> "Depois de amanhã será ${format(today.plusDays(2))}."
            text.contains("amanha") -> "Amanhã será ${format(today.plusDays(1))}."
            text.contains("ontem") -> "Ontem foi ${format(today.minusDays(1))}."
            text.contains("que dia da semana") || text.contains("dia da semana") ->
                "Hoje é ${today.dayOfWeek.getDisplayName(TextStyle.FULL, locale)}."
            text == "hoje" || text.contains("data de hoje") || text.contains("que dia e hoje") ->
                "Hoje é ${format(today)}."
            text.contains("que horas") || text.contains("hora agora") || text == "horas" ->
                "Agora são ${ZonedDateTime.now(clock).format(DateTimeFormatter.ofPattern("HH:mm", locale))}."
            text.contains("qual o mes") || text.contains("qual mes") ->
                "Estamos em ${today.month.getDisplayName(TextStyle.FULL, locale)}."
            text.contains("qual o ano") || text.contains("qual ano") -> "Estamos em ${today.year}."
            else -> null
        }
    }

    private fun format(date: LocalDate): String = date.format(dateFormatter)

    private fun normalize(value: String): String = java.text.Normalizer.normalize(value.lowercase(locale), java.text.Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "")
        .replace("[^a-z0-9 ]".toRegex(), " ")
        .replace("\\s+".toRegex(), " ")
        .trim()
}
