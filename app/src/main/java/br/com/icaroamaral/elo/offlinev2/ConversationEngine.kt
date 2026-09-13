package br.com.icaroamaral.elo.offlinev2
import java.text.Normalizer
import java.util.Locale

class ConversationEngine {
    fun answer(input: String): String? {
        val text = normalize(input)
        return when {
            text.matches(Regex("(oi|ola|ola elo|bom dia|boa tarde|boa noite)")) -> when {
                text == "bom dia" -> "Bom dia! Estou aqui e funcionando offline."
                text == "boa tarde" -> "Boa tarde! Posso ajudar localmente."
                text == "boa noite" -> "Boa noite! Continuo disponível offline."
                else -> "Olá! Estou aqui e funcionando offline."
            }
            text == "elo" -> "Oi! Sou o ELO Offline."
            text.contains("obrigado") || text == "valeu" || text == "beleza" || text == "ok" -> "Por nada!"
            text.contains("quem e voce") -> "Sou o ELO Offline Core V2, um assistente local."
            text.contains("o que voce sabe fazer") -> "Consigo conversar, calcular, informar data e hora, consultar engenharia local e controlar músicas offline."
            text.contains("estamos offline") || text.contains("funciona sem internet") -> "Sim. Estou funcionando localmente, sem usar internet."
            else -> null
        }
    }

    private fun normalize(value: String): String = Normalizer.normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "")
        .replace("[^a-z0-9 ]".toRegex(), " ")
        .replace("\\s+".toRegex(), " ")
        .trim()
}
