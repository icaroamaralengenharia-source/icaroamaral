package br.com.icaroamaral.elo

class EloOfflineDispatchGate(
    private val duplicateWindowMs: Long = 1200L,
    private val clock: () -> Long = { System.currentTimeMillis() }
) {
    private var lastCommand = ""
    private var lastAtMs = 0L

    fun evaluate(command: String, connectivityState: EloConnectivityState): EloOfflineDispatchDecision {
        val normalized = EloOfflineRouter.normalize(command)
        if (normalized.isBlank()) return EloOfflineDispatchDecision.RouteWeb
        val intent = EloOfflineRouter.detectIntent(normalized)
        if (intent == EloOfflineIntent.CALCULATOR || intent == EloOfflineIntent.CONVERSION || intent == EloOfflineIntent.ENGINEERING) {
            return EloOfflineDispatchDecision.DispatchNative
        }
        if (connectivityState != EloConnectivityState.ONLINE_VALIDATED && looksLikeOfflineV2Command(normalized)) {
            val now = clock()
            if (normalized == lastCommand && now - lastAtMs <= duplicateWindowMs) return EloOfflineDispatchDecision.Duplicate
            lastCommand = normalized
            lastAtMs = now
            return EloOfflineDispatchDecision.DispatchNative
        }
        if (connectivityState == EloConnectivityState.ONLINE_VALIDATED) {
            return EloOfflineDispatchDecision.RouteWeb
        }
        if (intent == EloOfflineIntent.NONE) {
            return EloOfflineDispatchDecision.RouteWeb
        }

        val now = clock()
        if (normalized == lastCommand && now - lastAtMs <= duplicateWindowMs) {
            return EloOfflineDispatchDecision.Duplicate
        }

        lastCommand = normalized
        lastAtMs = now
        return EloOfflineDispatchDecision.DispatchNative
    }
    private fun looksLikeOfflineV2Command(text: String): Boolean = listOf("amanha", "ontem", "depois de amanha", "que dia", "que horas", "hora", "ola", "oi", "quanto e", "calcule", "calcular", "concreto", "fck", "alvenaria", "argamassa", "impermeabilizacao", "infiltracao", "fissura", "reboco", "chapisco", "telhado", "hidraulica", "eletrica", "inspecao", "medicao", "laudo", "orcamento", "arquitetura", "planta", "acessibilidade", "toque ", "tocar ", "play ", "pausar", "pause", "continue", "proxima", "anterior", "embaralh", "o que esta tocando", "pesquise", "pesquisar").any(text::contains)
}
enum class EloOfflineDispatchDecision {
    RouteWeb,
    DispatchNative,
    Duplicate
}
