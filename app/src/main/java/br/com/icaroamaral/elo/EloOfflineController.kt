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

    fun connectivityState(): String = EloConnectivity.snapshot(appContext).name

    fun playOfflineMusic(command: String): String {
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

    fun stopMedia(): String {
        player.stop()
        playbackUiCallback(EloOfflinePlaybackUiEvent.Stopped)
        return "{\"ok\":true,\"action\":\"stop\"}"
    }

    fun release() {
        player.release()
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
    data object Stopped : EloOfflinePlaybackUiEvent()
}
