package br.com.icaroamaral.elo

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioManager
import android.media.AudioRecordingConfiguration
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONObject
import org.vosk.Model
import org.vosk.LibVosk
import org.vosk.Recognizer
import org.vosk.android.StorageService
import java.util.concurrent.atomic.AtomicInteger

/** All waiting audio stays local and ephemeral. There is no SpeechRecognizer fallback. */
class EloVoskAudioEngine(private val context: Context, private val listener: Listener) {
    interface Listener {
        fun ready(lease: Long)
        fun wake(lease: Long, continuationConsumed: Boolean)
        fun partial(lease: Long, text: String)
        fun final(lease: Long, text: String)
        fun failed(lease: Long, reason: String)
    }
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var model: Model? = null
    @Volatile private var worker: Thread? = null
    @Volatile private var recorder: AudioRecord? = null
    @Volatile private var currentLease = -1L
    private val workers = AtomicInteger(0)
    @Volatile var peakWorkers = 0
        private set
    fun ready() = model != null
    fun activeWorkers() = workers.get()
    fun isRecording() = recorder?.recordingState == AudioRecord.RECORDSTATE_RECORDING
    fun prepare(done: (Boolean) -> Unit) {
        if (ready()) { done(true); return }
        LibVosk.vosk_set_log_level(-1)
        // Model is packaged with the candidate; never downloaded by the phone.
        StorageService.unpack(context, "elo-wake-pt", "elo-wake-pt", { loaded ->
            val wordAvailable = runCatching {
                com.sun.jna.NativeLibrary.getInstance("vosk").getFunction("vosk_model_find_word")
                    .invokeInt(arrayOf(loaded.pointer, "elo")) >= 0
            }.getOrDefault(false)
            if (wordAvailable) { model = loaded; done(true) }
            else { loaded.close(); done(false) }
        }, { _ -> done(false) })
    }
    @Suppress("MissingPermission")
    fun start(owner: EloVoiceCoordinator.Owner, lease: Long): Boolean {
        if (!ready() || owner != EloVoiceCoordinator.Owner.WAKE || worker?.isAlive == true || workers.get() != 0) return false
        if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return false
        currentLease = lease
        val myModel = model ?: return false
        val next = Thread({
            var input: AudioRecord? = null
            var recognizer: Recognizer? = null
            var recordingCallback: AudioManager.AudioRecordingCallback? = null
            val active = workers.incrementAndGet()
            peakWorkers = maxOf(peakWorkers, active)
            try {
                check(active == 1) { "MIC_OWNER_CONFLICT" }
                recognizer = if (owner == EloVoiceCoordinator.Owner.WAKE)
                    Recognizer(myModel, SAMPLE_RATE.toFloat(), """["elo","[unk]"]""")
                else Recognizer(myModel, SAMPLE_RATE.toFloat())
                recognizer.setWords(true)
                if (owner == EloVoiceCoordinator.Owner.BRAIN) recognizer.setEndpointerDelays(30.0f, 1.0f, 40.0f)
                val minimum = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
                check(minimum > 0) { "CAPTURE_CONFIGURATION" }
                input = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minimum * 2, 6400))
                check(input.state == AudioRecord.STATE_INITIALIZED) { "CAPTURE_INITIALIZATION" }
                recorder = input
                if (currentLease != lease) return@Thread
                if (Build.VERSION.SDK_INT >= 29) {
                    recordingCallback = object : AudioManager.AudioRecordingCallback() {
                        override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>) {
                            if (configs.any { it.isClientSilenced }) post(lease) { listener.failed(lease, "CLIENT_SILENCED") }
                        }
                    }
                    input.registerAudioRecordingCallback(context.mainExecutor, recordingCallback)
                }
                input.startRecording()
                check(input.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "CAPTURE_START" }
                post(lease) { listener.ready(lease) }
                val buffer = ShortArray(1600)
                val utterance = EloVoiceUtteranceBuffer()
                var lastPartial = ""
                while (currentLease == lease && !Thread.currentThread().isInterrupted) {
                    val count = input.read(buffer, 0, buffer.size)
                    if (count <= 0) throw IllegalStateException("CAPTURE_READ")
                    if (currentLease != lease) break
                    if (recognizer.acceptWaveForm(buffer, count)) {
                        val result = JSONObject(recognizer.result)
                        val text = result.optString("text").trim()
                        if (owner == EloVoiceCoordinator.Owner.WAKE) {
                            if (EloWakeWordDecision.matches(result)) {
                                val continuation = text.split(Regex("\\s+")).drop(1).any { it.isNotBlank() }
                                post(lease) { listener.wake(lease, continuation) }; break
                            }
                        } else {
                            utterance.segment(text, SystemClock.elapsedRealtime())
                            if (text.isNotBlank()) {
                                val preview = utterance.preview()
                                post(lease) { listener.partial(lease, preview) }
                            }
                        }
                        lastPartial = ""
                    } else if (owner == EloVoiceCoordinator.Owner.BRAIN) {
                        val partial = JSONObject(recognizer.partialResult).optString("partial")
                        utterance.partial(partial)
                        if (partial.isNotBlank() && partial != lastPartial) {
                            lastPartial = partial
                            val preview = utterance.preview()
                            post(lease) { listener.partial(lease, preview) }
                        }
                    }
                    if (owner == EloVoiceCoordinator.Owner.BRAIN) {
                        val finalText = utterance.poll(SystemClock.elapsedRealtime())
                        if (finalText != null) { post(lease) { listener.final(lease, finalText) }; break }
                    }
                }
            } catch (_: SecurityException) { post(lease) { listener.failed(lease, "PERMISSION_REVOKED") } }
            catch (_: Exception) { post(lease) { listener.failed(lease, "LOCAL_CAPTURE_ERROR") } }
            finally {
                if (Build.VERSION.SDK_INT >= 29) recordingCallback?.let { callback ->
                    runCatching { input?.unregisterAudioRecordingCallback(callback) }
                }
                runCatching { input?.stop() }; runCatching { input?.release() }
                if (recorder === input) recorder = null
                runCatching { recognizer?.close() }
                workers.decrementAndGet()
            }
        }, "EloLocalAudio")
        worker = next
        next.start()
        return true
    }
    private fun post(lease: Long, action: () -> Unit) { main.post { if (currentLease == lease) action() } }
    fun stop(): Boolean {
        currentLease = -1
        val previous = worker
        runCatching { recorder?.stop() } // Unblock the native read before joining.
        previous?.interrupt()
        if (previous !== Thread.currentThread()) runCatching { previous?.join(1200) }
        val released = previous?.isAlive != true && workers.get() == 0
        if (released) { worker = null; recorder = null }
        return released
    }
    fun close() {
        if (stop()) { model?.close(); model = null }
    }
    companion object { const val SAMPLE_RATE = 16_000 }
}

