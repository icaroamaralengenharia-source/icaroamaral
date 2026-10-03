package br.com.icaroamaral.elo

import java.text.Normalizer
import java.util.Locale

/** Shared intent/context contract used as a shadow planner by the Android offline surface. */
data class EloCentralPlan(
    val intent: String,
    val confidence: Double,
    val reason: String,
    val referent: String? = null,
)

class EloCentralIntentContract {
    fun plan(input: String, context: EloOfflineContext): EloCentralPlan {
        val text = normalize(input)
        if (text.isBlank()) return EloCentralPlan("empty", 1.0, "empty_input")

        val continuation = text.matches(Regex("(sim|nao|ok|pode|continue|continuar|isso|essa|esse|e depois|por que|como assim).*"))
        if (continuation && (!context.lastIntent.isNullOrBlank() || !context.lastTopic.isNullOrBlank())) {
            return EloCentralPlan("follow_up", 0.98, "continuation_with_active_context", context.lastTopic)
        }
        if (text.matches(Regex(".*(que dia|qual a data|hoje|amanha|ontem|que horas|qual o mes|qual o ano).*"))) {
            return EloCentralPlan("date_time", 0.95, "date_or_time_request")
        }
        if (text.matches(Regex(".*(quanto e|quanto é|area de|perimetro|raiz quadrada|em centimetros|em centímetros).*"))) {
            return EloCentralPlan("math", 0.94, "deterministic_calculation")
        }
        if (text.matches(Regex(".*(memorize|memoriza|guarde|guardar|lembre|minha memoria|minha memória).*"))) {
            return EloCentralPlan("memory", 0.93, "explicit_memory_signal")
        }
        if (text.matches(Regex(".*(fissura|trinca|rachadura|infiltracao|infiltração|parede|laje|pilar|viga|fundacao|fundação|reboco|argamassa|alvenaria|vistoria).*"))) {
            return EloCentralPlan("engineering", 0.84, "engineering_domain_signal")
        }
        if (text.matches(Regex("(oi|ola|olá|bom dia|boa tarde|boa noite|obrigado|obrigada|valeu|beleza|ok).*"))) {
            return EloCentralPlan("conversation", 0.90, "social_message")
        }
        return EloCentralPlan("conversation", 0.55, "default_conversation")
    }

    private fun normalize(value: String): String = Normalizer.normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "")
        .replace("[^a-z0-9 ]".toRegex(), " ")
        .replace("\\s+".toRegex(), " ")
        .trim()
}
