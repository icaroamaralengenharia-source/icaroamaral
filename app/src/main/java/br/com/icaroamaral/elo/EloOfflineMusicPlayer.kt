package br.com.icaroamaral.elo

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import java.io.File

class EloOfflineMusicPlayer(context: Context) {
    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val lock = Any()
    private var mediaPlayer: MediaPlayer? = null
    private var queue: List<EloOfflineTrackFile> = emptyList()
    private var queueIndex = 0
    private var activeRunId = 0
    private var resumeOnFocusGain = false

    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        when (change) {
            AudioManager.AUDIOFOCUS_LOSS -> stop()
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                resumeOnFocusGain = synchronized(lock) { mediaPlayer?.isPlaying == true }
                pause()
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                if (resumeOnFocusGain) {
                    resumeOnFocusGain = false
                    resume()
                }
            }
        }
    }

    private val focusRequest: AudioFocusRequest? =
        if (Build.VERSION.SDK_INT >= 26) {
            AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(mediaAudioAttributes())
                .setOnAudioFocusChangeListener(focusListener)
                .build()
        } else {
            null
        }

    fun play(track: EloOfflineTrack) {
        playFiles(track.files)
    }

    fun playFiles(files: List<EloOfflineTrackFile>) {
        stop()
        if (files.isEmpty()) return
        if (!requestAudioFocus()) return
        val runId = synchronized(lock) {
            queue = files
            queueIndex = 0
            activeRunId += 1
            activeRunId
        }
        Thread { playCurrent(runId) }.start()
    }

    fun pause() {
        synchronized(lock) { mediaPlayer }.let { player -> runCatching { player?.pause() } }
    }

    fun resume() {
        synchronized(lock) { mediaPlayer }.let { player -> runCatching { player?.start() } }
    }

    fun stop() {
        val player = synchronized(lock) {
            activeRunId += 1
            queue = emptyList()
            queueIndex = 0
            val current = mediaPlayer
            mediaPlayer = null
            current
        }
        releasePlayerInstance(player)
        abandonAudioFocus()
    }

    fun release() {
        stop()
    }

    private fun playCurrent(runId: Int) {
        val file = synchronized(lock) {
            if (runId != activeRunId) return
            queue.getOrNull(queueIndex)
        } ?: run {
            finishRun(runId)
            return
        }

        var player: MediaPlayer? = null
        try {
            val cached = copyAssetToCache(file.path)
            val created = MediaPlayer()
            player = created
            created.setAudioAttributes(mediaAudioAttributes())
            created.setOnCompletionListener { completed ->
                if (!isCurrent(runId, completed)) {
                    releasePlayerInstance(completed)
                    return@setOnCompletionListener
                }
                releaseCurrentPlayer(completed)
                synchronized(lock) { queueIndex += 1 }
                playCurrent(runId)
            }
            created.setOnErrorListener { errored, _, _ ->
                if (!isCurrent(runId, errored)) {
                    releasePlayerInstance(errored)
                    return@setOnErrorListener true
                }
                releaseCurrentPlayer(errored)
                synchronized(lock) { queueIndex += 1 }
                playCurrent(runId)
                true
            }
            created.setDataSource(cached.absolutePath)
            created.prepare()
            synchronized(lock) {
                if (runId != activeRunId) {
                    throw StalePlaybackException()
                }
                mediaPlayer = created
            }
            created.start()
        } catch (_: StalePlaybackException) {
            releaseMaybeCurrentPlayer(player)
        } catch (_: Throwable) {
            releaseMaybeCurrentPlayer(player)
            synchronized(lock) {
                if (runId == activeRunId) queueIndex += 1
            }
            playCurrent(runId)
        }
    }

    private fun finishRun(runId: Int) {
        val shouldAbandon = synchronized(lock) { runId == activeRunId }
        if (shouldAbandon) abandonAudioFocus()
    }

    private fun isCurrent(runId: Int, player: MediaPlayer): Boolean {
        return synchronized(lock) { runId == activeRunId && mediaPlayer === player }
    }

    private fun releaseCurrentPlayer(player: MediaPlayer) {
        val current = synchronized(lock) {
            if (mediaPlayer === player) {
                mediaPlayer = null
                player
            } else {
                null
            }
        }
        releasePlayerInstance(current)
    }

    private fun copyAssetToCache(assetPath: String): File {
        val normalized = normalizeAssetPath(assetPath)
        val target = File(appContext.cacheDir, "elo-offline-audio/" + normalized.replace("/", "_"))
        if (target.exists() && target.length() > 0) return target
        target.parentFile?.mkdirs()
        appContext.assets.open(normalized).use { input ->
            target.outputStream().use { output -> input.copyTo(output) }
        }
        return target
    }

    private fun normalizeAssetPath(assetPath: String): String {
        val normalized = assetPath.trim().removePrefix("/")
        require(normalized.startsWith("offline-media/classical/")) { "Asset fora da biblioteca offline." }
        require(!normalized.contains("..") && !normalized.contains('\\')) { "Asset path inválido." }
        return normalized
    }

    private fun releaseMaybeCurrentPlayer(player: MediaPlayer?) {
        if (player == null) return
        synchronized(lock) {
            if (mediaPlayer === player) mediaPlayer = null
        }
        releasePlayerInstance(player)
    }

    private fun releasePlayerInstance(player: MediaPlayer?) {
        runCatching {
            player?.setOnCompletionListener(null)
            player?.setOnErrorListener(null)
            player?.stop()
        }
        runCatching { player?.release() }
    }

    private fun requestAudioFocus(): Boolean {
        val result = if (Build.VERSION.SDK_INT >= 26) {
            audioManager.requestAudioFocus(focusRequest!!)
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
        }
        return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= 26) {
            focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(focusListener)
        }
    }

    private fun mediaAudioAttributes(): AudioAttributes {
        return AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
    }

    private class StalePlaybackException : RuntimeException()
}