package br.com.icaroamaral.elo

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.Normalizer
import java.util.Locale
import kotlin.math.pow
import kotlin.math.sqrt

object EloLocalToolEngine {
    private val blocked = Regex("\\b(alert|window|document|fetch|constructor|__proto__|function|eval|import|location|cookie)\\b", RegexOption.IGNORE_CASE)
    private val numberPattern = "-?\\d+(?:\\.\\d+)?"

    fun handle(command: String): EloOfflineRouteResult? {
        calculate(command)?.let { return it }
        convert(command)?.let { return it }
        engineering(command)?.let { return it }
        return null
    }

    fun normalize(value: String): String {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
            .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
            .lowercase()
            .replace(",", ".")
            .replace("×", "x")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun format(value: Double): String {
        if (!value.isFinite()) return ""
        val rounded = kotlin.math.round(value * 100000000.0) / 100000000.0
        val symbols = DecimalFormatSymbols(Locale("pt", "BR"))
        return DecimalFormat("#,##0.########", symbols).format(rounded)
    }

    private fun calculate(command: String): EloOfflineRouteResult? {
        if (blocked.containsMatchIn(command)) return null
        val n = normalize(command)
        val value = try {
            when {
                n.startsWith("media de ") -> {
                    val values = Regex(numberPattern).findAll(n).map { it.value.toDouble() }.toList()
                    if (values.size < 2) throw IllegalArgumentException("media_invalida")
                    values.sum() / values.size
                }
                Regex("^$numberPattern\\s*%\\s*de\\s*$numberPattern$").matches(n) -> {
                    val values = Regex(numberPattern).findAll(n).map { it.value.toDouble() }.toList()
                    values[0] / 100.0 * values[1]
                }
                n.startsWith("raiz de ") -> {
                    val v = Regex(numberPattern).find(n)?.value?.toDouble() ?: return null
                    if (v < 0) throw IllegalArgumentException("raiz_negativa")
                    sqrt(v)
                }
                else -> {
                    val expression = n
                        .replace(Regex("^quanto e\\s+"), "")
                        .replace(Regex("^calcule\\s+"), "")
                        .replace(Regex("^calcular\\s+"), "")
                        .replace("vezes", "*")
                        .replace("dividido por", "/")
                        .replace("elevado a", "^")
                        .replace(Regex("\\bx\\b"), "*")
                        .replace(Regex("\\s+"), "")
                    if (!Regex("[+\\-*/^()%]").containsMatchIn(expression)) return null
                    MathParser(expression).parse()
                }
            }
        } catch (error: ArithmeticException) {
            return EloOfflineRouteResult(true, EloOfflineIntent.CALCULATOR, "Nao e possivel dividir por zero.")
        } catch (_: Throwable) {
            return EloOfflineRouteResult(true, EloOfflineIntent.CALCULATOR, "Nao consegui calcular essa expressao com seguranca.")
        }
        return EloOfflineRouteResult(true, EloOfflineIntent.CALCULATOR, format(value))
    }

    private fun convert(command: String): EloOfflineRouteResult? {
        val units = mapOf(
            "mm" to UnitDef("length", .001, "mm"),
            "milimetro" to UnitDef("length", .001, "mm"),
            "milimetros" to UnitDef("length", .001, "mm"),
            "cm" to UnitDef("length", .01, "cm"),
            "centimetro" to UnitDef("length", .01, "cm"),
            "centimetros" to UnitDef("length", .01, "cm"),
            "m" to UnitDef("length", 1.0, "m"),
            "metro" to UnitDef("length", 1.0, "m"),
            "metros" to UnitDef("length", 1.0, "m"),
            "km" to UnitDef("length", 1000.0, "km"),
            "mm2" to UnitDef("area", .000001, "mm²"),
            "cm2" to UnitDef("area", .0001, "cm²"),
            "m2" to UnitDef("area", 1.0, "m²"),
            "ha" to UnitDef("area", 10000.0, "ha"),
            "hectare" to UnitDef("area", 10000.0, "ha"),
            "hectares" to UnitDef("area", 10000.0, "ha"),
            "cm3" to UnitDef("volume", .000001, "cm³"),
            "m3" to UnitDef("volume", 1.0, "m³"),
            "l" to UnitDef("volume", .001, "L"),
            "litro" to UnitDef("volume", .001, "L"),
            "litros" to UnitDef("volume", .001, "L"),
            "ml" to UnitDef("volume", .000001, "mL"),
            "g" to UnitDef("mass", .001, "g"),
            "kg" to UnitDef("mass", 1.0, "kg"),
            "t" to UnitDef("mass", 1000.0, "t"),
            "pa" to UnitDef("pressure", 1.0, "Pa"),
            "kpa" to UnitDef("pressure", 1000.0, "kPa"),
            "mpa" to UnitDef("pressure", 1000000.0, "MPa")
        )
        val n = normalize(command).replace("metros quadrados", "m2").replace("metros cubicos", "m3")
        val match = Regex("($numberPattern)\\s*([a-z0-9]+)\\s+(?:em|para)\\s+([a-z0-9]+)").find(n) ?: return null
        val from = units[match.groupValues[2]] ?: return null
        val to = units[match.groupValues[3]] ?: return null
        if (from.family != to.family) return null
        val value = match.groupValues[1].toDouble() * from.factor / to.factor
        return EloOfflineRouteResult(true, EloOfflineIntent.CONVERSION, "${format(value)} ${to.label}")
    }

    private fun engineering(command: String): EloOfflineRouteResult? {
        return concreteSlab(command) ?: rectangle(command) ?: slope(command)
    }

    private fun concreteSlab(command: String): EloOfflineRouteResult? {
        val n = normalize(command)
        if (!Regex("\\b(laje|concreto)\\b").containsMatchIn(n)) return null
        val match = Regex("(\\d+(?:\\.\\d+)?)\\s*(?:m|metros?)?\\s*(?:por|x)\\s*(\\d+(?:\\.\\d+)?)\\s*(?:m|metros?)?.{0,50}?(\\d+(?:\\.\\d+)?)\\s*(cm|mm|m|metros?|centimetros?|milimetros?)").find(n) ?: return null
        val width = match.groupValues[1].toDouble()
        val length = match.groupValues[2].toDouble()
        val thickness = toMeters(match.groupValues[3].toDouble(), match.groupValues[4])
        val volume = width * length * thickness
        return EloOfflineRouteResult(true, EloOfflineIntent.ENGINEERING, "Para uma laje de ${format(width)} m x ${format(length)} m com ${format(thickness)} m de espessura:\n${format(width)} x ${format(length)} x ${format(thickness)} = ${format(volume)} m³.")
    }

    private fun rectangle(command: String): EloOfflineRouteResult? {
        val n = normalize(command)
        if (!Regex("\\b(area|perimetro)\\b").containsMatchIn(n)) return null
        val match = Regex("(\\d+(?:\\.\\d+)?)\\s*(?:m|metros?)?\\s*(?:por|x)\\s*(\\d+(?:\\.\\d+)?)\\s*(?:m|metros?)?").find(n) ?: return null
        val a = match.groupValues[1].toDouble()
        val b = match.groupValues[2].toDouble()
        return if (Regex("\\bperimetro\\b").containsMatchIn(n)) {
            val perimeter = 2 * (a + b)
            EloOfflineRouteResult(true, EloOfflineIntent.ENGINEERING, "Perimetro do retangulo: 2 x (${format(a)} + ${format(b)}) = ${format(perimeter)} m.")
        } else {
            val area = a * b
            EloOfflineRouteResult(true, EloOfflineIntent.ENGINEERING, "Area do retangulo: ${format(a)} x ${format(b)} = ${format(area)} m².")
        }
    }

    private fun slope(command: String): EloOfflineRouteResult? {
        val n = normalize(command)
        val match = Regex("(?:inclinacao|declividade|rampa|sobe).{0,30}?(\\d+(?:\\.\\d+)?)\\s*(?:m|metros?)?.{0,20}?(?:em|por|para)?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:m|metros?)?").find(n) ?: return null
        val rise = match.groupValues[1].toDouble()
        val run = match.groupValues[2].toDouble()
        if (run == 0.0) return null
        val percent = rise / run * 100.0
        return EloOfflineRouteResult(true, EloOfflineIntent.ENGINEERING, "Inclinacao percentual: (${format(rise)} / ${format(run)}) x 100 = ${format(percent)}%.")
    }

    private fun toMeters(value: Double, unit: String): Double {
        val n = normalize(unit)
        return when {
            n.startsWith("cm") || n.startsWith("centimetro") -> value / 100.0
            n.startsWith("mm") || n.startsWith("milimetro") -> value / 1000.0
            else -> value
        }
    }

    private data class UnitDef(val family: String, val factor: Double, val label: String)

    private class MathParser(private val source: String) {
        private var index = 0
        fun parse(): Double { val value = expression(); if (index != source.length) throw IllegalArgumentException("invalid_expression"); return value }
        private fun expression(): Double { var value = term(); while (peek() == '+' || peek() == '-') { val op = source[index++]; val right = term(); value = if (op == '+') value + right else value - right }; return value }
        private fun term(): Double { var value = power(); while (peek() == '*' || peek() == '/') { val op = source[index++]; val right = power(); if (op == '/' && right == 0.0) throw ArithmeticException("division_by_zero"); value = if (op == '*') value * right else value / right }; return value }
        private fun power(): Double { var value = unary(); if (peek() == '^') { index += 1; value = value.pow(power()) }; return value }
        private fun unary(): Double { if (peek() == '+') { index += 1; return unary() }; if (peek() == '-') { index += 1; return -unary() }; return primary() }
        private fun primary(): Double { if (peek() == '(') { index += 1; val value = expression(); if (peek() != ')') throw IllegalArgumentException("missing_parenthesis"); index += 1; return value }; val start = index; while (peek()?.let { it.isDigit() || it == '.' } == true) index += 1; if (start == index) throw IllegalArgumentException("number_expected"); var value = source.substring(start, index).toDouble(); while (peek() == '%') { index += 1; value /= 100.0 }; return value }
        private fun peek(): Char? = source.getOrNull(index)
    }
}
