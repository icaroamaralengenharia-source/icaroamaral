package br.com.icaroamaral.elo

import android.content.Context
import android.media.MediaPlayer
import android.util.Log
import br.com.icaroamaral.elo.offlinev2.EloOfflineAction
import br.com.icaroamaral.elo.offlinev2.EloOfflineEngine
import br.com.icaroamaral.elo.offlinev2.EloOfflineTrack
import br.com.icaroamaral.elo.offlinev2.OfflineMusicStore
import br.com.icaroamaral.elo.offlinev2.TechnicalKnowledgeEngine
import org.json.JSONArray
import java.time.Clock

/** Additive bridge for Offline Core V2; legacy WebView/controller remains authoritative online. */
class EloOfflineV2Controller(
    context: Context,
    private val playbackUiCallback: (EloOfflinePlaybackUiEvent) -> Unit = {},
) {
    private val appContext = context.applicationContext
    private val store = OfflineMusicStore(appContext)
    private val tracks = loadTracks()
    private val engine = EloOfflineEngine(tracks, loadTechnicalKnowledge(), Clock.systemDefaultZone())
    private val stateLock = Any()
    private var player: MediaPlayer? = null
    private var currentIndex = tracks.indexOfFirst {
        it.id == appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TRACK, "")
    }
    private var currentFileIndex = 0
    private var currentTrack: EloOfflineTrack? = tracks.getOrNull(currentIndex)
    private var pendingAction: (() -> Unit)? = null
    @Volatile private var musicReady = false
    @Volatile private var readyFailure: String? = null

    init {
        Thread {
            val outcome = runCatching { store.installBundledCatalog() }
            val installed = outcome.getOrNull() ?: 0
            val expected = tracks.sumOf { it.files.size }
            val pending = synchronized(stateLock) {
                musicReady = outcome.isSuccess && installed == expected && installed > 0
                readyFailure = outcome.exceptionOrNull()?.message
                    ?: if (!musicReady) "offline music install incomplete: " + installed + "/" + expected else null
                val action = pendingAction
                pendingAction = null
                action
            }
            if (musicReady) {
                pending?.invoke()
            } else if (pending != null) {
                emitError(currentTrack, readyFailure ?: "offline music initialization failed")
            }
        }.apply {
            name = "elo-offline-music-install"
            isDaemon = true
            start()
        }
    }

    fun handle(command: String): String? {
        return handleResolved(command, allowMusic = true)
    }

    fun handleLocal(command: String): String? {
        return handleResolved(command, allowMusic = false)
    }

    private fun handleResolved(command: String, allowMusic: Boolean): String? {
        val online = EloConnectivity.snapshot(appContext) == EloConnectivityState.ONLINE_VALIDATED
        val result = engine.handle(command, online)
        if (!result.handled) {
            EloRoutingTrace.log("ELO_TRACE_08_HANDLED", command, online = online, handled = false, requiresInternet = result.requiresInternet, reason = "engine_not_handled")
            return null
        }
        if (!allowMusic && (result.requiresInternet || result.action != EloOfflineAction.None)) {
            EloRoutingTrace.log("ELO_TRACE_08_HANDLED", command, online = online, handled = false, requiresInternet = result.requiresInternet, action = result.action.toString(), reason = "blocked_nonlocal_action")
            return null
        }
        EloRoutingTrace.log("ELO_TRACE_08_HANDLED", command, online = online, handled = true, requiresInternet = result.requiresInternet, action = result.action.toString(), reason = "offline_v2_handled")

        when (val action = result.action) {
            is EloOfflineAction.PlayTrack -> {
                val index = tracks.indexOfFirst { it.id == action.trackId }
                if (index >= 0) requestPlayAt(index)
            }
            EloOfflineAction.Pause -> pauseTrack()
            EloOfflineAction.Stop -> stop()
            EloOfflineAction.Resume -> resumeTrack()
            EloOfflineAction.NextTrack -> nextTrack()
            EloOfflineAction.PreviousTrack -> previousTrack()
            EloOfflineAction.Shuffle -> if (tracks.isNotEmpty()) requestPlayAt(tracks.indices.random())
            EloOfflineAction.CurrentTrack, EloOfflineAction.None -> Unit
        }
        return resultJson(result.text, result.requiresInternet, result.action)
    }

    fun playTrack(trackId: String): String {
        val index = tracks.indexOfFirst { it.id == trackId }
        if (index < 0) return errorJson("offline track not found: " + trackId)
        requestPlayAt(index)
        return controlJson("PLAYING", tracks[index])
    }

    fun pauseTrack(): String {
        val active = player
        val track = currentTrack
        if (active == null || track == null) return controlJson("PAUSED", track)
        return runCatching {
            if (active.isPlaying) active.pause()
            playbackUiCallback(EloOfflinePlaybackUiEvent.PausedV2(track))
            controlJson("PAUSED", track)
        }.getOrElse { errorJson("pause failed: " + it.message.orEmpty()) }
    }

    fun resumeTrack(): String {
        val active = player
        val track = currentTrack
        if (active == null || track == null) return controlJson("PLAYING", track)
        return runCatching {
            active.start()
            playbackUiCallback(EloOfflinePlaybackUiEvent.PlayingV2(track))
            controlJson("PLAYING", track)
        }.getOrElse { errorJson("resume failed: " + it.message.orEmpty()) }
    }

    fun nextTrack(): String {
        if (tracks.isEmpty()) return errorJson("offline catalog is empty")
        val index = (currentIndex + 1 + tracks.size) % tracks.size
        requestPlayAt(index)
        return controlJson("TRACK_CHANGED", tracks[index])
    }

    fun previousTrack(): String {
        if (tracks.isEmpty()) return errorJson("offline catalog is empty")
        val index = (currentIndex - 1 + tracks.size) % tracks.size
        requestPlayAt(index)
        return controlJson("TRACK_CHANGED", tracks[index])
    }

    fun stop() {
        synchronized(stateLock) { pendingAction = null }
        player?.release()
        player = null
        playbackUiCallback(EloOfflinePlaybackUiEvent.Stopped)
    }

    fun release() = stop()

    private fun requestPlayAt(index: Int) {
        if (index !in tracks.indices) return
        currentIndex = index
        currentFileIndex = 0
        val track = tracks[index]
        currentTrack = track
        engine.context.lastMusicTrackId = track.id
        appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_TRACK, track.id).apply()
        whenReady { playCurrent(track) }
    }

    private fun whenReady(action: () -> Unit) {
        val runNow = synchronized(stateLock) {
            if (musicReady) {
                true
            } else {
                pendingAction = action
                false
            }
        }
        if (runNow) action()
    }

    private fun playCurrent(track: EloOfflineTrack) {
        if (!musicReady) {
            whenReady { playCurrent(track) }
            return
        }
        val path = track.files.getOrNull(currentFileIndex)
        val file = path?.let(store::resolve)
        if (file == null) {
            emitError(track, "offline file unavailable: " + path.orEmpty())
            return
        }

        player?.release()
        player = null
        val created = MediaPlayer()
        player = created
        try {
            created.setAudioAttributes(
                android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            created.setDataSource(file.absolutePath)
            created.setOnCompletionListener {
                if (currentFileIndex + 1 < track.files.size) {
                    currentFileIndex++
                    playCurrent(track)
                } else if (tracks.isNotEmpty()) {
                    requestPlayAt((currentIndex + 1) % tracks.size)
                }
            }
            created.setOnErrorListener { _, what, extra ->
                emitError(track, "MediaPlayer error what=" + what + " extra=" + extra + " file=" + file.name)
                true
            }
            created.prepare()
            created.start()
            Log.i(
                AUDIO_LOG_TAG,
                "native_media_started track=${track.id} file=${file.name} isPlaying=${created.isPlaying} positionMs=${created.currentPosition}"
            )
            playbackUiCallback(EloOfflinePlaybackUiEvent.PlayingV2(track))
        } catch (error: Throwable) {
            if (player === created) player = null
            created.release()
            Log.e(AUDIO_LOG_TAG, "native_media_start_failed track=${track.id} file=${file.name}", error)
            emitError(track, "MediaPlayer prepare/start failed: " + error.message.orEmpty())
        }
    }

    private fun emitError(track: EloOfflineTrack?, message: String) {
        playbackUiCallback(EloOfflinePlaybackUiEvent.ErrorV2(track, message))
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

    private fun resultJson(message: String, requiresInternet: Boolean, action: EloOfflineAction): String {
        val state = when (action) {
            EloOfflineAction.Pause -> "PAUSED"
            EloOfflineAction.Resume -> "PLAYING"
            EloOfflineAction.NextTrack, EloOfflineAction.PreviousTrack -> "TRACK_CHANGED"
            is EloOfflineAction.PlayTrack, EloOfflineAction.Shuffle -> "PLAYING"
            else -> "IDLE"
        }
        return "{" +
            "\"handled\":true," +
            "\"route\":\"offline-v2\"," +
            "\"requiresInternet\":" + requiresInternet + "," +
            "\"state\":\"" + state + "\"," +
            "\"text\":\"" + escape(message) + "\"," +
            "\"message\":\"" + escape(message) + "\"," +
            "\"trackId\":\"" + escape(currentTrack?.id.orEmpty()) + "\"" +
            "}"
    }

    private fun controlJson(state: String, track: EloOfflineTrack?): String {
        return "{" +
            "\"handled\":true," +
            "\"route\":\"offline-v2-native\"," +
            "\"state\":\"" + state + "\"," +
            "\"trackId\":\"" + escape(track?.id.orEmpty()) + "\"," +
            "\"title\":\"" + escape(track?.title.orEmpty()) + "\"" +
            "}"
    }

    private fun errorJson(message: String): String {
        return "{" +
            "\"handled\":false," +
            "\"route\":\"offline-v2-native\"," +
            "\"state\":\"ERROR\"," +
            "\"error\":\"" + escape(message) + "\"" +
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
        private const val AUDIO_LOG_TAG = "ELO_OFFLINE_AUDIO"
    }
}
