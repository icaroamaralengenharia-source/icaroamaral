package br.com.icaroamaral.elo

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.io.File
import java.util.Locale

data class EloVoiceReport(
    val voiceMode: String,
    val ttsHttp: String = "-",
    val ttsContentType: String = "-",
    val ttsBytes: String = "-",
    val voiceStage: String = voiceMode,
    val dataSource: String = "-",
    val isPlaying: String = "-",
    val durationMs: String = "-",
    val playerError: String = "-",
    val streamMusic: String = "-",
    val audioAttributes: String = "-",
    val latency: String = "-",
    val error: String? = null
)

class EloVoicePlayer(
    context: Context,
    private val ttsClient: EloTtsClient = EloTtsClient()
) {
    private val appContext = context.applicationContext
    private val handler = Handler(Looper.getMainLooper())
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var mediaPlayer: MediaPlayer? = null
    private var tempAudioFile: File? = null
    private var focusRequest: AudioFocusRequest? = null
    private var audioFocusListener: AudioManager.OnAudioFocusChangeListener? = null
    private var audioFocusLost = false
    private var ttsReady = false
    private var doneCallback: (() -> Unit)? = null
    private var statusCallback: ((EloVoiceReport) -> Unit)? = null
    private var speakStartedAtMs = 0L
    private var prepareStartedAtMs = 0L
    private var firstAudioReported = false
    private var generation = 0
    private var ttsGeneration = 0
    private val tts: TextToSpeech

    init {
        tts = TextToSpeech(appContext) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            statusCallback?.invoke(baseReport(if (ttsReady) "ANDROID_TTS_READY" else "ANDROID_TTS_INIT_FAIL", error = "init=" + status))
            if (ttsReady) handler.post { tts.language = Locale("pt", "BR") }
        }
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                if (!isCurrent(ttsGeneration)) return
                firstAudioReported = true
                statusCallback?.invoke(baseReport("ANDROID_TTS_ON_START", latency = firstAudioLatencySummary("androidTts")))
            }

            override fun onError(utteranceId: String?) {
                if (!isCurrent(ttsGeneration)) return
                statusCallback?.invoke(baseReport("ANDROID_TTS_ON_ERROR", playerError = utteranceId ?: "tts-error", error = utteranceId ?: "tts-error"))
                finish(ttsGeneration)
            }

            override fun onDone(utteranceId: String?) {
                if (!isCurrent(ttsGeneration)) return
                statusCallback?.invoke(baseReport("ANDROID_TTS_ON_DONE"))
                finish(ttsGeneration)
            }
        })
    }

    fun speak(text: String, preferLocalFastPath: Boolean = false, onStatus: (EloVoiceReport) -> Unit, onDone: () -> Unit) {
        stop()
        val myGeneration = generation
        doneCallback = onDone
        statusCallback = onStatus
        speakStartedAtMs = SystemClock.elapsedRealtime()
        prepareStartedAtMs = 0L
        firstAudioReported = false

        if (preferLocalFastPath) {
            onStatus(baseReport("FAST_LOCAL_TTS", playerError = "operational-short", latency = "fastLocal=true"))
            speakLocalWhenReady(text, 0, myGeneration)
            return
        }

        val chunks = buildChunks(text)
        onStatus(baseReport("TTS_NEURAL_PENDING", playerError = "chunks=" + chunks.size, latency = "t4=tts-start; chunking=" + (chunks.size > 1)))
        scheduleFirstAudioWatchdog(text, myGeneration)
        speakChunkQueue(chunks, 0, myGeneration)
    }

    fun testLocalTts(onStatus: (EloVoiceReport) -> Unit, onDone: () -> Unit) {
        stop()
        val myGeneration = generation
        doneCallback = onDone
        statusCallback = onStatus
        speakStartedAtMs = SystemClock.elapsedRealtime()
        prepareStartedAtMs = 0L
        firstAudioReported = false
        speakLocalWhenReady("Teste de voz do ELO", 0, myGeneration)
    }

    fun stop() {
        generation += 1
        ttsGeneration = generation
        ttsClient.cancelActive()
        runCatching { mediaPlayer?.setOnPreparedListener(null) }
        runCatching { mediaPlayer?.setOnCompletionListener(null) }
        runCatching { mediaPlayer?.setOnErrorListener(null) }
        runCatching { mediaPlayer?.stop() }
        cleanupPlayer()
        runCatching { tts.stop() }
        doneCallback = null
    }

    fun shutdown() {
        stop()
        tts.shutdown()
    }

    private fun scheduleFirstAudioWatchdog(text: String, myGeneration: Int) {
        handler.postDelayed({
            if (!isCurrent(myGeneration) || firstAudioReported) return@postDelayed
            statusCallback?.invoke(baseReport("WATCHDOG_LOCAL_FALLBACK", playerError = "first-audio-timeout=" + FIRST_AUDIO_WATCHDOG_MS, latency = firstAudioLatencySummary("watchdog")))
            ttsClient.cancelActive()
            cleanupPlayer()
            speakLocalWhenReady(text, 0, myGeneration)
        }, FIRST_AUDIO_WATCHDOG_MS)
    }
    private fun speakChunkQueue(chunks: List<String>, index: Int, myGeneration: Int) {
        if (!isCurrent(myGeneration)) return
        if (index >= chunks.size) {
            finish(myGeneration)
            return
        }

        val chunk = chunks[index]
        statusCallback?.invoke(baseReport("GENERATING", playerError = "chunk=" + (index + 1) + "/" + chunks.size + "; chars=" + chunk.length))
        Thread {
            val ttsResult = ttsClient.synthesize(chunk)
            handler.post {
                if (!isCurrent(myGeneration)) return@post
                statusCallback?.invoke(
                    baseReport(
                        stage = if (ttsResult.ok) "FETCHED" else "TTS_NEURAL_HTTP_FAIL",
                        ttsHttp = ttsResult.statusCode.toString() + " / " + ttsResult.elapsedMs + "ms",
                        ttsContentType = ttsResult.contentType,
                        ttsBytes = ttsResult.byteCount.toString(),
                        playerError = "chunk=" + (index + 1) + "/" + chunks.size,
                        latency = ttsLatencySummary(ttsResult),
                        error = ttsResult.error ?: ttsResult.bodySummary
                    )
                )

                val audio = ttsResult.bytes
                if (ttsResult.ok && audio != null && audio.isNotEmpty()) {
                    playNeuralFromCacheFile(
                        audio = audio,
                        fallbackText = chunk,
                        ttsResult = ttsResult,
                        myGeneration = myGeneration,
                        chunkIndex = index,
                        chunkCount = chunks.size,
                        onChunkDone = { speakChunkQueue(chunks, index + 1, myGeneration) }
                    )
                } else {
                    speakLocalWhenReady(chunk, 0, myGeneration)
                }
            }
        }.start()
    }

    private fun playNeuralFromCacheFile(
        audio: ByteArray,
        fallbackText: String,
        ttsResult: EloTtsResult,
        myGeneration: Int,
        chunkIndex: Int,
        chunkCount: Int,
        onChunkDone: () -> Unit
    ) {
        if (!isCurrent(myGeneration)) return
        val audioFile = File(appContext.cacheDir, TEMP_AUDIO_FILE_PREFIX + chunkIndex + ".mp3")
        val cacheStartedAt = SystemClock.elapsedRealtime()
        runCatching {
            audioFile.writeBytes(audio)
            tempAudioFile = audioFile
        }.onFailure { error ->
            if (!isCurrent(myGeneration)) return
            statusCallback?.invoke(baseReport("ERROR", playerError = "cache-write: " + error.javaClass.simpleName, error = error.message ?: "cache-write"))
            speakLocalWhenReady(fallbackText, 0, myGeneration)
            return
        }
        val cacheWriteMs = SystemClock.elapsedRealtime() - cacheStartedAt

        val attributes = buildSpeechAudioAttributes(AudioAttributes.USAGE_ASSISTANT)
        val focusGranted = requestAudioFocus(attributes)
        if (!focusGranted) {
            statusCallback?.invoke(baseReport("ERROR", dataSource = "CACHE_FILE", playerError = "focus=false", error = "Audio focus not granted"))
            cleanupPlayer()
            speakLocalWhenReady(fallbackText, 0, myGeneration)
            return
        }

        prepareStartedAtMs = SystemClock.elapsedRealtime()
        statusCallback?.invoke(
            baseReport(
                stage = "PREPARING",
                ttsHttp = ttsResult.statusCode.toString() + " / " + ttsResult.elapsedMs + "ms",
                ttsContentType = ttsResult.contentType,
                ttsBytes = audio.size.toString(),
                dataSource = "CACHE_FILE",
                audioAttributes = attributesSummary(AudioAttributes.USAGE_ASSISTANT),
                playerError = "chunk=" + (chunkIndex + 1) + "/" + chunkCount + "; focus=" + focusGranted,
                latency = ttsLatencySummary(ttsResult) + "; cacheWriteMs=" + cacheWriteMs + "; t8=prepareAsync-start"
            )
        )

        runCatching {
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(attributes)
                setVolume(1f, 1f)
                setDataSource(audioFile.absolutePath)
                setOnPreparedListener { player ->
                    if (!isCurrent(myGeneration)) return@setOnPreparedListener
                    val prepareMs = elapsedSince(prepareStartedAtMs)
                    statusCallback?.invoke(
                        baseReport(
                            stage = "PREPARED",
                            ttsHttp = ttsResult.statusCode.toString(),
                            ttsContentType = ttsResult.contentType,
                            ttsBytes = audio.size.toString(),
                            dataSource = "CACHE_FILE",
                            isPlaying = safeIsPlaying(player),
                            durationMs = safeDuration(player),
                            audioAttributes = attributesSummary(AudioAttributes.USAGE_ASSISTANT),
                            playerError = "chunk=" + (chunkIndex + 1) + "/" + chunkCount,
                            latency = "playerPrepareMs=" + prepareMs + "; t9=onPrepared"
                        )
                    )

                    val started = runCatching {
                        player.start()
                        true
                    }.getOrElse { error ->
                        if (isCurrent(myGeneration)) {
                            statusCallback?.invoke(baseReport("ERROR", dataSource = "CACHE_FILE", playerError = error.javaClass.simpleName + ": " + (error.message ?: "start"), error = error.message ?: "start"))
                            cleanupPlayer()
                            speakLocalWhenReady(fallbackText, 0, myGeneration)
                        }
                        false
                    }
                    if (!started || !isCurrent(myGeneration)) return@setOnPreparedListener

                    val isPlayingNow = safeIsPlaying(player)
                    statusCallback?.invoke(
                        baseReport(
                            stage = "PLAY_CALLED",
                            dataSource = "CACHE_FILE",
                            isPlaying = isPlayingNow,
                            durationMs = safeDuration(player),
                            audioAttributes = attributesSummary(AudioAttributes.USAGE_ASSISTANT),
                            playerError = "chunk=" + (chunkIndex + 1) + "/" + chunkCount,
                            latency = firstAudioLatencySummary("t10=startCalled")
                        )
                    )

                    if (isPlayingNow == "true") {
                        firstAudioReported = true
                        statusCallback?.invoke(
                            baseReport(
                                stage = "PLAYING",
                                dataSource = "CACHE_FILE",
                                isPlaying = isPlayingNow,
                                durationMs = safeDuration(player),
                                audioAttributes = attributesSummary(AudioAttributes.USAGE_ASSISTANT),
                                playerError = "chunk=" + (chunkIndex + 1) + "/" + chunkCount,
                                latency = firstAudioLatencySummary("t11=playing")
                            )
                        )
                    } else {
                        statusCallback?.invoke(baseReport("ERROR", dataSource = "CACHE_FILE", isPlaying = isPlayingNow, durationMs = safeDuration(player), playerError = "start-not-playing", error = "MediaPlayer did not enter playing state"))
                        cleanupPlayer()
                        speakLocalWhenReady(fallbackText, 0, myGeneration)
                    }
                }
                setOnCompletionListener { player ->
                    if (!isCurrent(myGeneration)) return@setOnCompletionListener
                    statusCallback?.invoke(
                        baseReport(
                            stage = "COMPLETED",
                            dataSource = "CACHE_FILE",
                            isPlaying = safeIsPlaying(player),
                            durationMs = safeDuration(player),
                            playerError = "chunk=" + (chunkIndex + 1) + "/" + chunkCount,
                            latency = firstAudioLatencySummary("completed")
                        )
                    )
                    cleanupPlayer()
                    onChunkDone()
                }
                setOnErrorListener { player, what, extra ->
                    if (!isCurrent(myGeneration)) return@setOnErrorListener true
                    statusCallback?.invoke(
                        baseReport(
                            stage = "ERROR",
                            dataSource = "CACHE_FILE",
                            isPlaying = safeIsPlaying(player),
                            durationMs = safeDuration(player),
                            playerError = "what=" + what + ", extra=" + extra,
                            error = "MediaPlayer error what=" + what + ", extra=" + extra
                        )
                    )
                    cleanupPlayer()
                    speakLocalWhenReady(fallbackText, 0, myGeneration)
                    true
                }
                prepareAsync()
            }
        }.onFailure { error ->
            if (!isCurrent(myGeneration)) return
            statusCallback?.invoke(baseReport("ERROR", dataSource = "CACHE_FILE", playerError = error.javaClass.simpleName + ": " + (error.message ?: "prepareAsync"), error = error.message ?: "prepareAsync"))
            cleanupPlayer()
            speakLocalWhenReady(fallbackText, 0, myGeneration)
        }
    }

    private fun requestAudioFocus(attributes: AudioAttributes): Boolean {
        val listener = AudioManager.OnAudioFocusChangeListener { focusChange ->
            handler.post { handleAudioFocusChange(focusChange) }
        }
        audioFocusListener = listener
        audioFocusLost = false
        return if (Build.VERSION.SDK_INT >= 26) {
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener(listener)
                .build()
            focusRequest = request
            val granted = audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            if (!granted) audioFocusListener = null
            granted
        } else {
            @Suppress("DEPRECATION")
            val granted = audioManager.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            if (!granted) audioFocusListener = null
            granted
        }
    }

    private fun handleAudioFocusChange(focusChange: Int) {
        if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
            if (!audioFocusLost) return
            audioFocusLost = false
            val player = mediaPlayer ?: return
            runCatching {
                player.start()
                statusCallback?.invoke(baseReport("AUDIO_FOCUS_GAIN", dataSource = "CACHE_FILE", isPlaying = safeIsPlaying(player)))
            }.onFailure { error ->
                statusCallback?.invoke(baseReport("AUDIO_FOCUS_RESUME_FAILED", dataSource = "CACHE_FILE", error = error.message ?: "audio-focus-resume"))
            }
            return
        }

        if (focusChange != AudioManager.AUDIOFOCUS_LOSS &&
            focusChange != AudioManager.AUDIOFOCUS_LOSS_TRANSIENT &&
            focusChange != AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK
        ) return

        audioFocusLost = true
        val player = mediaPlayer
        if (focusChange != AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            runCatching { if (player?.isPlaying == true) player.pause() }
        }
        val stage = when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> "AUDIO_FOCUS_LOSS"
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> "AUDIO_FOCUS_LOSS_TRANSIENT"
            else -> "AUDIO_FOCUS_DUCK"
        }
        statusCallback?.invoke(baseReport(stage, dataSource = "CACHE_FILE", isPlaying = player?.let(::safeIsPlaying) ?: "-"))
    }

    private fun abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= 26) {
            focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            focusRequest = null
        } else {
            @Suppress("DEPRECATION")
            audioFocusListener?.let { audioManager.abandonAudioFocus(it) }
        }
        audioFocusListener = null
        audioFocusLost = false
    }

    private fun buildSpeechAudioAttributes(usage: Int): AudioAttributes {
        return AudioAttributes.Builder()
            .setUsage(usage)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
    }

    private fun speakLocalWhenReady(text: String, attempt: Int, myGeneration: Int) {
        if (!isCurrent(myGeneration)) return
        if (!ttsReady && attempt < LOCAL_TTS_MAX_ATTEMPTS) {
            statusCallback?.invoke(baseReport("ANDROID_TTS_WAITING", playerError = "attempt=" + attempt))
            handler.postDelayed({ speakLocalWhenReady(text, attempt + 1, myGeneration) }, LOCAL_TTS_RETRY_MS)
            return
        }

        if (!ttsReady) {
            statusCallback?.invoke(baseReport("ANDROID_TTS_NOT_READY"))
            finish(myGeneration)
            return
        }

        val localeResult = tts.setLanguage(Locale("pt", "BR"))
        statusCallback?.invoke(baseReport("ANDROID_TTS_LOCALE", playerError = "locale=" + localeResult))

        ttsGeneration = myGeneration
        val params = Bundle().apply {
            putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, UTTERANCE_ID)
        }
        val status = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, UTTERANCE_ID)
        statusCallback?.invoke(baseReport("ANDROID_TTS_SPEAK", playerError = "speak=" + status))
        if (status == TextToSpeech.ERROR) finish(myGeneration)
    }

    private fun baseReport(
        stage: String,
        ttsHttp: String = "-",
        ttsContentType: String = "-",
        ttsBytes: String = "-",
        dataSource: String = "-",
        isPlaying: String = "-",
        durationMs: String = "-",
        playerError: String = "-",
        audioAttributes: String = "-",
        latency: String = "-",
        error: String? = null
    ): EloVoiceReport {
        return EloVoiceReport(
            voiceMode = stage,
            ttsHttp = ttsHttp,
            ttsContentType = ttsContentType,
            ttsBytes = ttsBytes,
            voiceStage = stage,
            dataSource = dataSource,
            isPlaying = isPlaying,
            durationMs = durationMs,
            playerError = playerError,
            streamMusic = streamMusicSummary(),
            audioAttributes = audioAttributes,
            latency = latency,
            error = error
        )
    }

    private fun buildChunks(text: String): List<String> {
        val clean = text.replace(Regex("\\s+"), " ").trim()
        if (clean.length <= DIRECT_TTS_MAX_CHARS) return listOf(clean)

        val chunks = mutableListOf<String>()
        val sentences = Regex("(?<=[.!?;:])\\s+").split(clean).filter { it.isNotBlank() }
        var current = ""
        sentences.forEach { sentence ->
            val next = if (current.isBlank()) sentence else current + " " + sentence
            if (next.length <= CHUNK_TARGET_MAX_CHARS) {
                current = next
            } else {
                if (current.isNotBlank()) chunks.add(current)
                if (sentence.length > CHUNK_TARGET_MAX_CHARS) chunks.addAll(splitLongSentence(sentence)) else current = sentence
            }
        }
        if (current.isNotBlank()) chunks.add(current)
        return chunks.filter { it.isNotBlank() }.ifEmpty { listOf(clean) }
    }

    private fun splitLongSentence(sentence: String): List<String> {
        val parts = mutableListOf<String>()
        var rest = sentence.trim()
        while (rest.length > CHUNK_TARGET_MAX_CHARS) {
            val limit = CHUNK_TARGET_MAX_CHARS.coerceAtMost(rest.length)
            val cut = rest.lastIndexOf(' ', limit).takeIf { it >= CHUNK_TARGET_MIN_CHARS } ?: limit
            parts.add(rest.substring(0, cut).trim())
            rest = rest.substring(cut).trim()
        }
        if (rest.isNotBlank()) parts.add(rest)
        return parts
    }

    private fun streamMusicSummary(): String {
        val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        return current.toString() + "/" + max
    }

    private fun attributesSummary(usage: Int): String {
        return "usage=" + usage + ", contentType=" + AudioAttributes.CONTENT_TYPE_SPEECH
    }

    private fun safeIsPlaying(player: MediaPlayer): String {
        return runCatching { player.isPlaying.toString() }.getOrDefault("-")
    }

    private fun safeDuration(player: MediaPlayer): String {
        return runCatching { player.duration.toString() }.getOrDefault("-")
    }

    private fun elapsedSince(startedAtMs: Long): Long {
        return if (startedAtMs > 0L) SystemClock.elapsedRealtime() - startedAtMs else 0L
    }

    private fun ttsLatencySummary(result: EloTtsResult): String {
        return "ttsMs=" + result.elapsedMs + "; ttsHeadersMs=" + result.headersMs + "; ttsDownloadMs=" + result.downloadMs
    }

    private fun firstAudioLatencySummary(source: String): String {
        return source + "; playerPrepareMs=" + elapsedSince(prepareStartedAtMs) + "; timeToFirstAudioMs=" + elapsedSince(speakStartedAtMs)
    }

    private fun isCurrent(myGeneration: Int): Boolean = myGeneration == generation

    private fun cleanupPlayer() {
        runCatching { mediaPlayer?.release() }
        mediaPlayer = null
        abandonAudioFocus()
        runCatching { tempAudioFile?.delete() }
        tempAudioFile = null
    }

    private fun finish(myGeneration: Int) {
        if (!isCurrent(myGeneration)) return
        val callback = doneCallback
        doneCallback = null
        handler.post {
            if (!isCurrent(myGeneration)) return@post
            cleanupPlayer()
            callback?.invoke()
        }
    }

    companion object {
        private const val UTTERANCE_ID = "elo-answer"
        private const val TEMP_AUDIO_FILE_PREFIX = "elo_tts_chunk_"
        private const val LOCAL_TTS_MAX_ATTEMPTS = 4
        private const val LOCAL_TTS_RETRY_MS = 250L
        private const val FIRST_AUDIO_WATCHDOG_MS = 8_000L
        private const val DIRECT_TTS_MAX_CHARS = 260
        private const val CHUNK_TARGET_MIN_CHARS = 120
        private const val CHUNK_TARGET_MAX_CHARS = 240
    }
}
