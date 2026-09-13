package br.com.icaroamaral.elo

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import kotlin.math.pow
import kotlin.math.sqrt

class CalculatorEngine {
    data class Calculation(val value: Double, val text: String, val topic: String = "calculo")

    fun calculate(input: String, context: EloOfflineContext): Calculation? {
        val normalized = normalize(input)
        val volume = Regex("(?:laje|volume|caixa|bloco)[^0-9-]*(-?[0-9]+(?:[.,][0-9]+)?)\\s*[x×]\\s*(-?[0-9]+(?:[.,][0-9]+)?)\\s*[x×]\\s*(-?[0-9]+(?:[.,][0-9]+)?)")
            .find(normalized)
        if (volume != null) {
            val value = volume.groupValues.drop(1).map(::number).reduce(Double::times)
            return Calculation(value, "Volume: ${format(value)} m³", "volume")
        }

        Regex("(?:15|20|[0-9]+(?:[.,][0-9]+)?)\\s*%\\s*(?:de|sobre)\\s*(-?[0-9]+(?:[.,][0-9]+)?)")
            .find(normalized)?.let { match ->
                val percent = number(match.groupValues[0].substringBefore('%').trim())
                val base = number(match.groupValues[1])
                val value = percent * base / 100.0
                return Calculation(value, "Resultado: ${format(value)}", "porcentagem")
            }

        Regex("raiz(?: quadrada)?(?: de)?\\s*(-?[0-9]+(?:[.,][0-9]+)?)").find(normalized)?.let {
            val value = sqrt(number(it.groupValues[1]))
            return Calculation(value, "Raiz quadrada: ${format(value)}", "raiz")
        }

        Regex("(?:area|área)\\s*(?:de)?\\s*(-?[0-9]+(?:[.,][0-9]+)?)\\s*[x×]\\s*(-?[0-9]+(?:[.,][0-9]+)?)").find(input.lowercase())?.let {
            val value = number(it.groupValues[1]) * number(it.groupValues[2])
            return Calculation(value, "Área: ${format(value)} m²", "area")
        }

        Regex("perimetro\\s*(?:de)?\\s*(-?[0-9]+(?:[.,][0-9]+)?)\\s*[x×]\\s*(-?[0-9]+(?:[.,][0-9]+)?)").find(normalized)?.let {
            val value = 2.0 * (number(it.groupValues[1]) + number(it.groupValues[2]))
            return Calculation(value, "Perímetro: ${format(value)} m", "perimetro")
        }

        Regex("(-?[0-9]+(?:[.,][0-9]+)?)\\s*(?:metros?|m)\\s*(?:em|para)\\s*(centimetros?|cm)").find(normalized)?.let {
            val value = number(it.groupValues[1]) * 100.0
            return Calculation(value, "Conversão: ${format(value)} cm", "conversao")
        }
        Regex("(-?[0-9]+(?:[.,][0-9]+)?)\\s*(?:centimetros?|cm)\\s*(?:em|para)\\s*(metros?|m)").find(normalized)?.let {
            val value = number(it.groupValues[1]) / 100.0
            return Calculation(value, "Conversão: ${format(value)} m", "conversao")
        }

        val operation = Regex("(-?[0-9]+(?:[.,][0-9]+)?)\\s*([+\\-*/x×^]|vezes|mais|menos|dividido por)\\s*(-?[0-9]+(?:[.,][0-9]+)?)").find(normalized)
        if (operation != null) {
            val left = number(operation.groupValues[1])
            val right = number(operation.groupValues[3])
            val value = apply(operation.groupValues[2], left, right) ?: return null
            context.lastCalculatedValue = value
            return Calculation(value, "Resultado: ${format(value)}")
        }

        if (normalized.matches(Regex("e (?:vezes|multiplicado por) [0-9]+(?:[.,][0-9]+)?"))) {
            val right = Regex("[0-9]+(?:[.,][0-9]+)?").find(normalized)?.value?.let(::number) ?: return null
            val left = context.lastCalculatedValue ?: return null
            val value = left * right
            return Calculation(value, "Resultado: ${format(value)}")
        }
        return null
    }

    private fun apply(operator: String, left: Double, right: Double): Double? = when (operator) {
        "+", "mais" -> left + right
        "-", "menos" -> left - right
        "*", "x", "×", "vezes" -> left * right
        "/", "dividido por" -> right.takeIf { it != 0.0 }?.let { left / it }
        "^" -> left.pow(right)
        else -> null
    }

    private fun number(value: String): Double = value.replace(".", "").replace(',', '.').toDouble()

    private fun format(value: Double): String = DecimalFormat("0.##", DecimalFormatSymbols(Locale("pt", "BR"))).format(value)

    private fun normalize(value: String): String = java.text.Normalizer.normalize(value.lowercase(Locale.ROOT), java.text.Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "")
        .replace("á", "a")
        .replace("[^a-z0-9.,+*/x×^%\\- ]".toRegex(), " ")
        .replace("\\s+".toRegex(), " ")
        .trim()
}
