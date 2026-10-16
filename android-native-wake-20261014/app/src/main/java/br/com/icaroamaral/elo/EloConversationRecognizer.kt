package br.com.icaroamaral.elo

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.text.Normalizer

/**
 * Keep a leading interrogative only when another hypothesis from the same utterance
 * contains it and the final result is an exact suffix. This repairs dropped openings
 * without inventing words or retaining a different partial hypothesis.
 */
internal fun preserveQuestionOpening(finalText: String, hypotheses: List<String>): String {
    fun normalized(value: String) = Normalizer.normalize(value.lowercase(), Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "")
        .replace("[^a-z0-9 ]".toRegex(), " ")
        .replace("\\s+".toRegex(), " ").trim()

    val final = normalized(finalText)
    if (final.isBlank()) return finalText
    val openers = setOf(
        "qual", "qual e", "qual eh", "qual a", "qual o", "qual os", "qual as", "qual e a", "qual e o",
        "quais", "quais sao", "quais sao as", "quais sao os", "quem", "como", "onde", "aonde", "quando",
        "quanto", "quanto e", "quanto custa", "qual seria", "qual seria a", "o que", "o que e", "o que eh",
        "que", "por que", "para que", "pra que", "de onde", "com quem"
    )
    return hypotheses.asReversed().firstOrNull { candidate ->
        val complete = normalized(candidate)
        if (complete.length <= final.length + 2 || !complete.endsWith(" $final")) return@firstOrNull false
        val opening = complete.dropLast(final.length).trim()
        opening.length <= 32 && opening in openers
    }?.trim()?.take(36_000) ?: finalText
}

/** One explicit conversational turn, never wake waiting. No audio files or transcript logs.
 * The system recognizer may use its network service, as the previous ELO recognizer did.
 * A terminal result/error must acknowledge release before the coordinator changes owner.
 */
class EloConversationRecognizer(
    private val context: Context,
    private val listener: Listener,
    private val trace: (String, Long) -> Unit = { _, _ -> }
) {
    interface Listener {
        fun ready(lease: Long)
        fun partial(lease: Long, text: String)
        fun final(lease: Long, text: String)
        fun empty(lease: Long)
        fun failed(lease: Long, reason: String)
    }
    private val main = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var revision = 0L
    private var lease = -1L
    private var stopping = false
    private var poisoned = false
    private val releases = mutableListOf<(Boolean) -> Unit>()
    private val partialHypotheses = mutableListOf<String>()
    private var timeout: Runnable? = null
    var active = false
        private set
    var ready = false
        private set
    fun isStopping() = stopping
    fun start(nextLease: Long): Boolean {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (active || stopping || poisoned || !SpeechRecognizer.isRecognitionAvailable(context)) {
            trace("start_rejected", nextLease)
            return false
        }
        val expected = ++revision
        lease = nextLease; active = true; ready = false
        partialHypotheses.clear()
        trace("start_begin", nextLease)
        try {
            // Default system service retains multilingual title recognition. Do not force
            // the small Portuguese wake vocabulary onto conversational speech.
            val next = SpeechRecognizer.createSpeechRecognizer(context)
            recognizer = next
            next.setRecognitionListener(object : RecognitionListener {
                private fun current() = revision == expected && active
                override fun onReadyForSpeech(params: Bundle?) {
                    trace("ready_callback", nextLease)
                    if (current() && !stopping) { ready = true; listener.ready(nextLease) }
                }
                override fun onBeginningOfSpeech() { trace("speech_begin", nextLease) }
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {} // Never retained.
                override fun onEndOfSpeech() { trace("speech_end", nextLease); ready = false }
                override fun onPartialResults(results: Bundle?) {
                    trace("partial_callback", nextLease)
                    if (current() && !stopping) {
                        val candidates = candidates(results)
                        partialHypotheses.addAll(candidates)
                        while (partialHypotheses.size > 10) partialHypotheses.removeAt(0)
                        listener.partial(nextLease, candidates.firstOrNull().orEmpty())
                    }
                }
                override fun onResults(results: Bundle?) {
                    trace("results_callback", nextLease)
                    if (!current()) return
                    val cancelled = stopping
                    val options = candidates(results)
                    val primary = options.firstOrNull().orEmpty()
                    val transcript = if (cancelled) "" else preserveQuestionOpening(primary, options.drop(1) + partialHypotheses)
                    if (!cancelled && transcript != primary) trace("final_question_opening_recovered", nextLease)
                    terminal()
                    if (!cancelled) {
                        if (transcript.isBlank()) listener.empty(nextLease)
                        else listener.final(nextLease, transcript)
                    }
                }
                override fun onError(error: Int) {
                    trace("error_$error", nextLease)
                    if (!current()) return
                    val cancelled = stopping
                    terminal()
                    if (!cancelled) when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> listener.empty(nextLease)
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> listener.failed(nextLease, "PERMISSION_REVOKED")
                        else -> listener.failed(nextLease, "SYSTEM_STT_ERROR_$error")
                    }
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
            next.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
                // Longer music names must not be finalized at the first brief pause.
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1400L)
            })
            trace("start_listening_called", nextLease)
            return true
        } catch (failure: Exception) {
            trace("start_exception_${failure.javaClass.simpleName}", nextLease)
            // No attempt to fall back to another microphone owner after a failed start.
            close(); return false
        }
    }
    private fun candidates(results: Bundle?) = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        ?.map { it.trim().take(36_000) }?.filter { it.isNotBlank() }?.distinct().orEmpty()
    private fun terminal() {
        trace("terminal_release", lease)
        active = false; ready = false; stopping = false
        partialHypotheses.clear()
        timeout?.let(main::removeCallbacks); timeout = null
        runCatching { recognizer?.destroy() }; recognizer = null
        val callbacks = releases.toList(); releases.clear()
        callbacks.forEach { it(true) }
    }
    fun stop(done: (Boolean) -> Unit) {
        check(Looper.myLooper() == Looper.getMainLooper())
        trace("stop_requested", lease)
        if (poisoned) { done(false); return }
        if (!active) { done(true); return }
        releases.add(done)
        if (stopping) return
        stopping = true; ready = false
        timeout = Runnable {
            trace("stop_timeout", lease)
            // Missing terminal acknowledgement: destroy and fail closed, never start
            // Vosk/TTS by pretending the microphone has been released.
            poisoned = true; active = false; stopping = false; revision++
            runCatching { recognizer?.cancel() }; runCatching { recognizer?.destroy() }; recognizer = null
            partialHypotheses.clear()
            val callbacks = releases.toList(); releases.clear(); callbacks.forEach { it(false) }
        }.also { main.postDelayed(it, 3500) }
        runCatching { recognizer?.stopListening() }
    }
    fun close() {
        revision++; timeout?.let(main::removeCallbacks); timeout = null
        runCatching { recognizer?.cancel() }; runCatching { recognizer?.destroy() }; recognizer = null
        active = false; ready = false; stopping = false
        partialHypotheses.clear()
        val callbacks = releases.toList(); releases.clear(); callbacks.forEach { it(false) }
    }
}
