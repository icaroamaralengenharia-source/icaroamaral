package br.com.icaroamaral.elo

import android.content.Context

class EloOfflineController(
    context: Context,
    private val playbackUiCallback: (EloOfflinePlaybackUiEvent) -> Unit = {},
    private val routeResultCallback: (EloOfflineRouteResult) -> Unit = {},
    private val playerCoordinator: EloMusicPlayerCoordinator = EloMusicPlayerCoordinator()
) {
    private val appContext = context.applicationContext
    private val router = EloOfflineRouter(appContext)
    private val player = EloOfflineMusicPlayer(appContext)
    private val offlineV2 = EloOfflineV2Controller(
        context = appContext,
        playbackUiCallback = playbackUiCallback,
        beforePlayback = {
            playerCoordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.OFFLINE)
        },
        isOfflineOwner = {
            playerCoordinator.currentPlayer() == EloMusicPlayerCoordinator.ActivePlayer.OFFLINE
        }
    )

    fun connectivityState(): String = EloConnectivity.snapshot(appContext).name

    fun playOfflineMusic(command: String): String {
        if (isActiveMusicStopCommand(command)) return stopCommandResult()
        if (EloConnectivity.snapshot(appContext) != EloConnectivityState.ONLINE_VALIDATED) {
            offlineV2.handle(command)?.let { return it }
        }
        val result = router.route(command)
        if (result.localStop) {
            player.stop()
            playbackUiCallback(EloOfflinePlaybackUiEvent.Stopped)
        }
        if (result.localPlay && result.track != null) {
            playerCoordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.OFFLINE)
            player.play(result.track)
            playbackUiCallback(EloOfflinePlaybackUiEvent.Playing(result.track))
        }
        if (result.handled) routeResultCallback(result)
        return offlineResultJson(result)
    }


    fun playOfflineTrack(trackId: String): String = offlineV2.playTrack(trackId)

    fun pauseOfflineTrack(): String = offlineV2.pauseTrack()

    fun resumeOfflineTrack(): String = offlineV2.resumeTrack()

    fun nextOfflineTrack(): String = offlineV2.nextTrack()

    fun previousOfflineTrack(): String = offlineV2.previousTrack()

    fun stopMedia(): String {
        playerCoordinator.stopActivePlayer()
        stopForArbitration()
        playbackUiCallback(EloOfflinePlaybackUiEvent.Stopped)
        return "{\"ok\":true,\"action\":\"stop\"}"
    }

    fun release() {
        stopForArbitration()
    }

    /** Stops all native playback without changing coordinator ownership mid-switch. */
    fun stopForArbitration() {
        offlineV2.stop()
        player.stop()
        playerCoordinator.deactivatePlayer(EloMusicPlayerCoordinator.ActivePlayer.OFFLINE)
    }

    fun routeOfflineChat(command: String): String {
        if (isActiveMusicStopCommand(command)) return stopCommandResult()
        val online = EloConnectivity.snapshot(appContext) == EloConnectivityState.ONLINE_VALIDATED
        val local = if (online) {
            offlineV2.handleLocal(command)
        } else {
            offlineV2.handle(command)
        }
        if (local != null) {
            EloRoutingTrace.logJson("ELO_TRACE_05_CONTROLLER", command, "TEXT", online, local, "offline_v2_return")
            return local
        }
        if (online) {
            val web = "{\"handled\":false,\"route\":\"web\"}"
            EloRoutingTrace.logJson("ELO_TRACE_05_CONTROLLER", command, "TEXT", online, web, "online_web_fallback")
            return web
        }

        val result = router.route(command)
        if (result.localStop) {
            player.stop()
            playbackUiCallback(EloOfflinePlaybackUiEvent.Stopped)
        }
        if (result.localPlay && result.track != null) {
            playerCoordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.OFFLINE)
            player.play(result.track)
            playbackUiCallback(EloOfflinePlaybackUiEvent.Playing(result.track))
        }
        if (result.handled) routeResultCallback(result)
        return offlineResultJson(result).also {
            EloRoutingTrace.logJson("ELO_TRACE_05_CONTROLLER", command, "TEXT", online, it, "legacy_router_fallback")
        }
    }
    private fun offlineResultJson(result: EloOfflineRouteResult): String {
        return "{" +
            "\"handled\":" + result.handled + "," +
            "\"intent\":\"" + escape(result.intent.name) + "\"," +
            "\"message\":\"" + escape(result.message) + "\"," +
            "\"localPlay\":" + result.localPlay + "," +
            "\"localStop\":" + result.localStop + "," +
            "\"unavailableOffline\":" + result.unavailableOffline + "," +
            "\"trackId\":\"" + escape(result.track?.id ?: "") + "\"" +
            "}"
    }

    private fun stopCommandResult(): String {
        stopMedia()
        return "{\"handled\":true,\"intent\":\"MUSIC_STOP\",\"text\":\"Música interrompida.\",\"message\":\"Música interrompida.\",\"localPlay\":false,\"localStop\":true,\"unavailableOffline\":false,\"trackId\":\"\"}"
    }

    private fun isActiveMusicStopCommand(command: String): Boolean =
        playerCoordinator.currentPlayer() != EloMusicPlayerCoordinator.ActivePlayer.NONE &&
            EloVoiceMediaCommand.isStopCommandForActiveMusic(command)

    private fun escape(value: String): String {
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
    }
}

sealed class EloOfflinePlaybackUiEvent {
    data class Playing(val track: EloOfflineTrack) : EloOfflinePlaybackUiEvent()
    data class PlayingV2(val track: br.com.icaroamaral.elo.offlinev2.EloOfflineTrack) : EloOfflinePlaybackUiEvent()
    data class PausedV2(val track: br.com.icaroamaral.elo.offlinev2.EloOfflineTrack) : EloOfflinePlaybackUiEvent()
    data class ErrorV2(val track: br.com.icaroamaral.elo.offlinev2.EloOfflineTrack?, val error: String) : EloOfflinePlaybackUiEvent()
    data object Stopped : EloOfflinePlaybackUiEvent()
}
