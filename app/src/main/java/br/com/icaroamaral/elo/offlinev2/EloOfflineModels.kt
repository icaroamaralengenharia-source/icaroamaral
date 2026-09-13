package br.com.icaroamaral.elo.offlinev2
data class EloOfflineTrack(
    val id: String,
    val title: String,
    val composer: String,
    val genre: String,
    val aliases: List<String>,
    val files: List<String>,
)

sealed class EloOfflineAction {
    data class PlayTrack(val trackId: String) : EloOfflineAction()
    data object Pause : EloOfflineAction()
    data object Resume : EloOfflineAction()
    data object NextTrack : EloOfflineAction()
    data object PreviousTrack : EloOfflineAction()
    data object Shuffle : EloOfflineAction()
    data object CurrentTrack : EloOfflineAction()
    data object None : EloOfflineAction()
}

data class EloOfflineResult(
    val handled: Boolean,
    val text: String,
    val action: EloOfflineAction = EloOfflineAction.None,
    val requiresInternet: Boolean = false,
)

data class EloOfflineContext(
    var lastTopic: String? = null,
    var lastCalculatedValue: Double? = null,
    var lastIntent: String? = null,
    var lastMusicTrackId: String? = null,
    var lastTechnicalTopic: String? = null,
)
