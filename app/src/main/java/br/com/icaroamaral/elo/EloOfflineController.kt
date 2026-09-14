package br.com.icaroamaral.elo

import android.content.Context

class EloOfflineController(
    context: Context,
    private val playbackUiCallback: (EloOfflinePlaybackUiEvent) -> Unit = {},
    private val routeResultCallback: (EloOfflineRouteResult) -> Unit = {}
) {
    private val appContext = context.applicationContext
    private val router = EloOfflineRouter(appContext)
    private val player = EloOfflineMusicPlayer(appContext)
    private val offlineV2 = EloOfflineV2Controller(appContext, playbackUiCallback)

    fun connectivityState(): String = EloConnectivity.snapshot(appContext).name

    fun playOfflineMusic(command: String): String {
        if (EloConnectivity.snapshot(appContext) != EloConnectivityState.ONLINE_VALIDATED) {
            offlineV2.handle(command)?.let { return it }
        }
        val result = router.route(command)
        if (result.localStop) {
            player.stop()
            playbackUiCallback(EloOfflinePlaybackUiEvent.Stopped)
        }
        if (result.localPlay && result.track != null) {
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
        offlineV2.stop()
        player.stop()
        playbackUiCallback(EloOfflinePlaybackUiEvent.Stopped)
        return "{\"ok\":true,\"action\":\"stop\"}"
    }

    fun release() {
        offlineV2.release()
        player.release()
    }

    fun routeOfflineChat(command: String): String {
        val online = EloConnectivity.snapshot(appContext) == EloConnectivityState.ONLINE_VALIDATED
        val local = if (online) {
            offlineV2.handleLocal(command)
        } else {
            offlineV2.handle(command)
        }
        if (local != null) return local
        if (online) return "{\"handled\":false,\"route\":\"web\"}"

        val result = router.route(command)
        if (result.localStop) {
            player.stop()
            playbackUiCallback(EloOfflinePlaybackUiEvent.Stopped)
        }
        if (result.localPlay && result.track != null) {
            player.play(result.track)
            playbackUiCallback(EloOfflinePlaybackUiEvent.Playing(result.track))
        }
        if (result.handled) routeResultCallback(result)
        return offlineResultJson(result)
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
