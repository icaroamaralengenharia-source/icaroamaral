package br.com.icaroamaral.elo.offlinev2
import br.com.icaroamaral.elo.EloRoutingTrace
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

    @JvmOverloads
    fun handle(input: String, online: Boolean? = null): EloOfflineResult {
        val raw = input.trim()
        if (raw.isBlank()) return traced("Fallback", raw, fallback(), online, "blank")

        val normalized = normalize(raw)
        EloRoutingTrace.log("ELO_TRACE_02_NORMALIZED", normalized, online = online, reason = "raw_present")

        music.answer(raw, context)?.let { return traced("MusicCommandEngine", raw, it, online) }
        dateTime.answer(raw)?.let {
            context.lastTopic = "data_hora"
            context.lastIntent = "date_time"
            return traced("DateTimeEngine", raw, EloOfflineResult(true, it), online)
        }
        calculator.calculate(raw, context)?.let {
            context.lastTopic = "calculo"
            context.lastIntent = "calculo_${it.topic}"
            return traced("CalculatorEngine", raw, EloOfflineResult(true, it.text), online)
        }
        conversation.answer(raw)?.let {
            context.lastTopic = "conversa"
            context.lastIntent = "conversation"
            return traced("ConversationEngine", raw, EloOfflineResult(true, it), online)
        }
        technical.answer(raw)?.let { (answer, topic) ->
            context.lastTopic = "tecnico"
            context.lastTechnicalTopic = topic
            context.lastIntent = "technical_$topic"
            return traced("TechnicalKnowledgeEngine", raw, EloOfflineResult(true, answer), online)
        }
        if (isClearlyOnline(raw)) {
            context.lastTopic = "online"
            context.lastIntent = "requires_internet"
            return traced("OnlineRequest", raw, EloOfflineResult(true, "Esse pedido precisa de internet. Quando a conexão voltar eu consigo pesquisar.", requiresInternet = true), online)
        }
        return traced("Fallback", raw, fallback(), online, "no_engine_match")
    }

    private fun traced(engine: String, phrase: String, result: EloOfflineResult, online: Boolean?, reason: String = ""): EloOfflineResult {
        EloRoutingTrace.log("ELO_TRACE_06_ENGINE_SELECTED", phrase, online = online, engine = engine, handled = result.handled, requiresInternet = result.requiresInternet, action = result.action.traceName(), reason = reason)
        EloRoutingTrace.log("ELO_TRACE_07_ENGINE_RESULT", phrase, online = online, engine = engine, handled = result.handled, requiresInternet = result.requiresInternet, action = result.action.traceName(), reason = if (result.handled) "result_ready" else reason)
        return result
    }

    private fun EloOfflineAction.traceName(): String = when (this) {
        EloOfflineAction.None -> "None"
        EloOfflineAction.Pause -> "Pause"
        EloOfflineAction.Resume -> "Resume"
        EloOfflineAction.NextTrack -> "NextTrack"
        EloOfflineAction.PreviousTrack -> "PreviousTrack"
        EloOfflineAction.Shuffle -> "Shuffle"
        EloOfflineAction.CurrentTrack -> "CurrentTrack"
        is EloOfflineAction.PlayTrack -> "PlayTrack"
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
