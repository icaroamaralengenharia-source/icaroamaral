package br.com.icaroamaral.elo

import android.content.Context
import android.media.MediaPlayer
import br.com.icaroamaral.elo.offlinev2.EloOfflineAction
import br.com.icaroamaral.elo.offlinev2.EloOfflineEngine
import br.com.icaroamaral.elo.offlinev2.EloOfflineTrack
import br.com.icaroamaral.elo.offlinev2.OfflineMusicStore
import br.com.icaroamaral.elo.offlinev2.TechnicalKnowledgeEngine
import org.json.JSONArray
import java.time.Clock

/** Additive bridge for Offline Core V2; the legacy WebView/controller remains authoritative online. */
class EloOfflineV2Controller(
    context: Context,
    private val playbackUiCallback: (EloOfflinePlaybackUiEvent) -> Unit = {},
) {
    private val appContext = context.applicationContext
    private val store = OfflineMusicStore(appContext)
    private val tracks = loadTracks()
    private val engine = EloOfflineEngine(tracks, loadTechnicalKnowledge(), Clock.systemDefaultZone())
    private var player: MediaPlayer? = null
    private var currentIndex = tracks.indexOfFirst {
        it.id == appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TRACK, "")
    }
    private var currentFileIndex = 0
    @Volatile private var musicReady = false

    init {
        Thread {
            val installed = runCatching { store.installBundledCatalog() }.getOrDefault(0)
            musicReady = installed == tracks.sumOf { it.files.size } && installed > 0
        }.start()
    }

    fun handle(command: String): String? {
        val result = engine.handle(command)
        if (!result.handled) return null

        when (val action = result.action) {
            is EloOfflineAction.PlayTrack -> {
                val index = tracks.indexOfFirst { it.id == action.trackId }
                if (index >= 0) playAt(index)
            }
            EloOfflineAction.Pause -> player?.pause()
            EloOfflineAction.Resume -> player?.start()
            EloOfflineAction.NextTrack -> if (tracks.isNotEmpty()) playAt((currentIndex + 1 + tracks.size) % tracks.size)
            EloOfflineAction.PreviousTrack -> if (tracks.isNotEmpty()) playAt((currentIndex - 1 + tracks.size) % tracks.size)
            EloOfflineAction.Shuffle -> if (tracks.isNotEmpty()) playAt(tracks.indices.random())
            EloOfflineAction.CurrentTrack, EloOfflineAction.None -> Unit
        }
        return resultJson(result.text, result.requiresInternet)
    }

    fun stop() {
        player?.release()
        player = null
        playbackUiCallback(EloOfflinePlaybackUiEvent.Stopped)
    }

    fun release() = stop()

    private fun playAt(index: Int) {
        if (index !in tracks.indices) return
        currentIndex = index
        currentFileIndex = 0
        val track = tracks[index]
        engine.context.lastMusicTrackId = track.id
        appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_TRACK, track.id).apply()
        playCurrent(track)
    }

    private fun playCurrent(track: EloOfflineTrack) {
        if (!musicReady) return
        val path = track.files.getOrNull(currentFileIndex) ?: return
        val file = store.resolve(path) ?: return
        player?.release()
        player = runCatching {
            MediaPlayer().apply {
                setDataSource(file.absolutePath)
                setOnCompletionListener {
                    if (currentFileIndex + 1 < track.files.size) {
                        currentFileIndex++
                        playCurrent(track)
                    } else if (tracks.isNotEmpty()) {
                        playAt((currentIndex + 1) % tracks.size)
                    }
                }
                prepare()
                start()
            }
        }.getOrNull()
        if (player != null) playbackUiCallback(EloOfflinePlaybackUiEvent.PlayingV2(track))
    }

    private fun loadTracks(): List<EloOfflineTrack> = runCatching {
        val items = JSONArray(appContext.assets.open(CATALOG_ASSET).bufferedReader().use { it.readText() })
        (0 until items.length()).mapNotNull { i ->
            val item = items.optJSONObject(i) ?: return@mapNotNull null
            val files = item.optJSONArray("files") ?: JSONArray()
            val paths = (0 until files.length()).mapNotNull { j ->
                files.optJSONObject(j)?.optString("optimizedPath").orEmpty().ifBlank { null }
            }
            if (!item.optBoolean("offlineAvailable", false) || paths.isEmpty()) return@mapNotNull null
            val aliases = item.optJSONArray("aliases")?.let { values ->
                (0 until values.length()).map { values.optString(it) }
            }.orEmpty()
            EloOfflineTrack(
                id = item.optString("id"),
                title = item.optString("title"),
                composer = item.optString("composer", item.optString("artist")),
                genre = item.optString("genre", "instrumental"),
                aliases = aliases,
                files = paths,
            )
        }
    }.getOrDefault(emptyList())

    private fun loadTechnicalKnowledge(): TechnicalKnowledgeEngine = runCatching {
        val json = appContext.assets.open(KNOWLEDGE_ASSET).bufferedReader().use { it.readText() }
        TechnicalKnowledgeEngine.fromJson(json)
    }.getOrElse { TechnicalKnowledgeEngine.defaults() }

    private fun resultJson(message: String, requiresInternet: Boolean): String {
        return "{" +
            "\"handled\":true," +
            "\"route\":\"offline-v2\"," +
            "\"requiresInternet\":" + requiresInternet + "," +
            "\"message\":\"" + escape(message) + "\"" +
            "}"
    }

    private fun escape(value: String): String = value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")

    companion object {
        private const val CATALOG_ASSET = "offline-media/catalog.json"
        private const val KNOWLEDGE_ASSET = "offline-knowledge/engineering.json"
        private const val PREFS = "elo_offline_v2"
        private const val KEY_TRACK = "track"
    }
}