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
        if (connectivityState == EloConnectivityState.ONLINE_VALIDATED) {
            return EloOfflineDispatchDecision.RouteWeb
        }
        if (EloOfflineRouter.detectIntent(normalized) == EloOfflineIntent.NONE) {
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
}

enum class EloOfflineDispatchDecision {
    RouteWeb,
    DispatchNative,
    Duplicate
}
