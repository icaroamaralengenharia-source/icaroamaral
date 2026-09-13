package br.com.icaroamaral.elo.offlinev2
import java.text.Normalizer
import java.time.Clock
import java.util.Locale

class EloOfflineEngine(
    tracks: List<EloOfflineTrack>,
    technicalKnowledge: TechnicalKnowledgeEngine = TechnicalKnowledgeEngine.defaults(),
    clock: Clock = Clock.systemDefaultZone(),
) {
    val context = EloOfflineContext()
    private val dateTime = DateTimeEngine(clock)
    private val calculator = CalculatorEngine()
    private val conversation = ConversationEngine()
    private val technical = technicalKnowledge
    private val music = MusicCommandEngine(tracks)

    fun handle(input: String): EloOfflineResult {
        val raw = input.trim()
        if (raw.isBlank()) return fallback()

        music.answer(raw, context)?.let { return it }
        dateTime.answer(raw)?.let {
            context.lastTopic = "data_hora"
            context.lastIntent = "date_time"
            return EloOfflineResult(true, it)
        }
        calculator.calculate(raw, context)?.let {
            context.lastTopic = "calculo"
            context.lastIntent = "calculo_${it.topic}"
            return EloOfflineResult(true, it.text)
        }
        conversation.answer(raw)?.let {
            context.lastTopic = "conversa"
            context.lastIntent = "conversation"
            return EloOfflineResult(true, it)
        }
        technical.answer(raw)?.let { (answer, topic) ->
            context.lastTopic = "tecnico"
            context.lastTechnicalTopic = topic
            context.lastIntent = "technical_$topic"
            return EloOfflineResult(true, answer)
        }
        if (isClearlyOnline(raw)) {
            context.lastTopic = "online"
            context.lastIntent = "requires_internet"
            return EloOfflineResult(true, "Esse pedido precisa de internet. Quando a conexão voltar eu consigo pesquisar.", requiresInternet = true)
        }
        return fallback()
    }

    private fun isClearlyOnline(input: String): Boolean {
        val text = normalize(input)
        return listOf("pesquise", "pesquisar", "procure na internet", "noticias", "preco", "clima agora", "cotacao", "tempo agora", "busque na web")
            .any(text::contains)
    }

    private fun fallback(): EloOfflineResult = EloOfflineResult(
        handled = false,
        text = "Não consegui resolver isso offline. Se for algo que dependa da internet, tente novamente quando estivermos conectados.",
    )

    private fun normalize(value: String): String = Normalizer.normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "")
        .replace("[^a-z0-9 ]".toRegex(), " ")
        .replace("\\s+".toRegex(), " ")
        .trim()
}
