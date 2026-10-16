package br.com.icaroamaral.elo

import java.text.Normalizer

/** Session state only. The ports use the existing official chat, TTS and player. */
class EloVoiceCoordinator(
    private val ports: Ports,
    private val silenceMs: Long = 30_000,
    private val releaseTailMs: Long = 650
) {
    enum class State {
        WAKE_DISABLED, WAKE_LISTENING, WAKE_DETECTED, BRAIN_LISTENING,
        PROCESSING, BRAIN_SPEAKING, BRAIN_ENDING, RETURN_TO_WAKE, SUSPENDED
    }
    enum class Owner { NONE, WAKE, BRAIN, INTERRUPT }
    data class Snapshot(
        val state: State, val enabled: Boolean, val owner: Owner,
        val generation: Long, val captureLease: Long, val turn: Long, val reason: String
    )
    fun interface Cancel { fun cancel() }
    interface Ports {
        fun sessionReady(): Boolean
        fun startCapture(owner: Owner, lease: Long): Boolean
        /** True means the recording worker has actually stopped. */
        fun stopCapture(): Boolean
        fun stopCaptureAsync(done: (Boolean) -> Unit) { done(stopCapture()) }
        fun waitsForCaptureReady(): Boolean = false
        fun elapsedMs(): Long = System.nanoTime() / 1_000_000
        fun stopOutput()
        fun cancelRequest()
        fun pauseMusic()
        /** Audio focus is held only while ELO is producing speech, never while a recognizer captures. */
        fun acquireOutputFocus(): Boolean
        fun releaseOutputFocus(reason: String)
        fun request(turn: Long, generation: Long, text: String)
        fun speak(generation: Long, text: String)
        fun later(ms: Long, action: () -> Unit): Cancel
        fun changed(snapshot: Snapshot)
    }

    private var state = State.WAKE_DISABLED
    private var enabled = false
    private var owner = Owner.NONE
    private var generation = 0L
    private var captureLease = 0L
    private var turn = 0L
    private var reason = ""
    private var failures = 0
    private var timer: Cancel? = null
    private var deadline: Cancel? = null
    private var greeting = false
    private var manualReading = false
    private var releaseRevision = 0L
    private var quietDeadline = 0L
    private var outgoingText = ""
    private var renewalOwner = Owner.WAKE
    private var interruptAttempted = false

    fun snapshot() = Snapshot(state, enabled, owner, generation, captureLease, turn, reason)
    private fun publish(next: State, why: String = "") {
        state = next; reason = why; ports.changed(snapshot())
    }
    private fun cancelTimers() {
        timer?.cancel(); timer = null
        deadline?.cancel(); deadline = null
    }
    private fun releaseCapture(then: () -> Unit) {
        captureLease += 1 // Invalidate partial/final callbacks before stopping the worker.
        val revision = ++releaseRevision
        if (owner != Owner.NONE) publish(state, "CAPTURE_RELEASING")
        ports.stopCaptureAsync { released ->
            if (revision != releaseRevision) return@stopCaptureAsync
            if (!released) {
                enabled = false; ports.stopOutput(); ports.cancelRequest()
                ports.releaseOutputFocus("CAPTURE_NOT_RELEASED")
                publish(State.WAKE_DISABLED, "CAPTURE_NOT_RELEASED")
            } else {
                owner = Owner.NONE
                then()
            }
        }
    }
    private fun invalidate(then: () -> Unit) {
        generation += 1
        quietDeadline = 0
        manualReading = false
        outgoingText = ""
        cancelTimers()
        ports.cancelRequest()
        ports.stopOutput()
        releaseCapture(then)
    }
    private fun listen(nextOwner: Owner) {
        if (!enabled) return
        if (!ports.sessionReady()) { sessionRenewalRequired(); return }
        releaseCapture {
        if (!enabled) return@releaseCapture
        val lease = ++captureLease
        owner = nextOwner
        publish(if (nextOwner == Owner.WAKE) State.WAKE_LISTENING else State.BRAIN_LISTENING, "CAPTURE_STARTING")
        if (!ports.startCapture(nextOwner, lease)) {
            captureFailed(lease, "CAPTURE_START_FAILED")
            return@releaseCapture
        }
        if (!ports.waitsForCaptureReady()) captureReady(lease)
        else deadline = ports.later(10_000) {
            if (captureLease == lease && reason == "CAPTURE_STARTING") captureFailed(lease, "CAPTURE_READY_TIMEOUT")
        }
        }
    }
    fun captureReady(lease: Long) {
        if (enabled && state == State.BRAIN_SPEAKING && owner == Owner.INTERRUPT && captureLease == lease) {
            publish(state, "INTERRUPT_READY"); return
        }
        if (!enabled || captureLease != lease || reason != "CAPTURE_STARTING") return
        deadline?.cancel(); deadline = null
        publish(state)
        if (owner == Owner.BRAIN) {
            armSilence(lease)
            deadline = ports.later(45_000) {
                if (enabled && owner == Owner.BRAIN && captureLease == lease) retryCapture(lease, "CAPTURE_WATCHDOG_RETRY")
            }
        }
    }
    private fun armSilence(lease: Long) {
        timer?.cancel()
        if (quietDeadline == 0L) quietDeadline = ports.elapsedMs() + silenceMs.coerceIn(10_000, 120_000)
        timer = ports.later((quietDeadline - ports.elapsedMs()).coerceAtLeast(1)) {
            if (enabled && owner == Owner.BRAIN && captureLease == lease) retryCapture(lease, "SILENCE_RETRY")
        }
    }
    fun enable(): Boolean {
        if (enabled) return true
        if (!ports.sessionReady()) { publish(State.WAKE_DISABLED, "SESSION_REQUIRED"); return false }
        enabled = true; failures = 0
        invalidate { if (enabled) listen(Owner.WAKE) }
        return enabled
    }
    fun wakeDetected(lease: Long, continuationConsumed: Boolean = false) {
        if (!enabled || state != State.WAKE_LISTENING || owner != Owner.WAKE || lease != captureLease) return
        cancelTimers()
        releaseCapture {
        publish(State.WAKE_DETECTED)
        ports.pauseMusic()
        if (!ports.acquireOutputFocus()) { suspend("AUDIO_FOCUS_DENIED"); return@releaseCapture }
        greeting = true
        publish(State.BRAIN_SPEAKING, "WAKE_ACK")
        ports.speak(generation, if (continuationConsumed) "Ouvi ELO. Repita o pedido após esta mensagem." else "Pronto.")
        armOutputTimeout()
        }
    }
    fun partial(lease: Long, hasSpeech: Boolean) {
        if (enabled && state == State.BRAIN_LISTENING && owner == Owner.BRAIN &&
            lease == captureLease && hasSpeech) {
            quietDeadline = ports.elapsedMs() + silenceMs.coerceIn(10_000, 120_000)
            armSilence(lease)
        }
    }
    fun captureEmpty(lease: Long) {
        retryCapture(lease, "NO_SPEECH_RETRY")
    }
    private fun retryCapture(lease: Long, why: String) {
        if (!enabled || state != State.BRAIN_LISTENING || owner != Owner.BRAIN || lease != captureLease) return
        cancelTimers()
        quietDeadline = 0L
        releaseCapture {
            publish(State.BRAIN_LISTENING, why)
            val expected = generation
            timer = ports.later(releaseTailMs) {
                if (enabled && generation == expected && state == State.BRAIN_LISTENING) {
                    listen(Owner.BRAIN)
                }
            }
        }
    }
    fun heard(lease: Long, raw: String) {
        if (!enabled || state != State.BRAIN_LISTENING || owner != Owner.BRAIN || lease != captureLease) return
        val text = raw.trim().take(36_000)
        if (text.isBlank()) return
        val normalized = Normalizer.normalize(text.lowercase(), Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "").replace(Regex("[^a-z0-9 ]"), " ")
            .replace(Regex("\\s+"), " ").trim().removePrefix("elo ").trim()
        if (normalized in setOf("desativar assistente", "desative o assistente", "desativar elo", "desligar assistente",
                "pare de escutar", "parar de escutar", "pare de ouvir", "desliguei", "desligue", "desligue o elo")) {
            disable("SPOKEN_DISABLE"); return
        }
        if (normalized in setOf("encerrar conversa", "encerre a conversa", "encerrar a conversa", "finalizar conversa", "parar conversa")) {
            endConversation("SPOKEN_END"); return
        }
        cancelTimers()
        releaseCapture {
        if (!ports.sessionReady()) { sessionRenewalRequired(); return@releaseCapture }
        turn += 1
        quietDeadline = 0
        greeting = false
        publish(State.PROCESSING)
        val myTurn = turn; val myGeneration = generation
        deadline = ports.later(60_000) {
            if (state == State.PROCESSING && generation == myGeneration && turn == myTurn)
                requestFailed(myTurn, myGeneration, "REQUEST_TIMEOUT")
        }
        ports.request(myTurn, myGeneration, text)
        }
    }
    fun answerReady(expectedTurn: Long, expectedGeneration: Long, answer: String) {
        if (!enabled || state != State.PROCESSING || turn != expectedTurn || generation != expectedGeneration) return
        deadline?.cancel(); deadline = null
        if (answer.isBlank()) { requestFailed(expectedTurn, expectedGeneration, "EMPTY_ANSWER"); return }
        failures = 0; greeting = false
        outgoingText = answer
        interruptAttempted = false
        if (!ports.acquireOutputFocus()) { suspend("AUDIO_FOCUS_DENIED"); return }
        publish(State.BRAIN_SPEAKING)
        ports.speak(generation, answer)
        armOutputTimeout()
    }
    fun yieldForMusic(expectedTurn: Long, expectedGeneration: Long): Boolean {
        if (!enabled || state != State.PROCESSING || turn != expectedTurn || generation != expectedGeneration) return false
        ports.releaseOutputFocus("MUSIC_HANDOFF")
        deadline?.cancel()
        deadline = ports.later(90_000) {
            if (enabled && state == State.PROCESSING && turn == expectedTurn && generation == expectedGeneration)
                requestFailed(expectedTurn, expectedGeneration, "MUSIC_REQUEST_TIMEOUT")
        }
        publish(State.PROCESSING, "MUSIC_RESOLVING")
        return true
    }
    fun mediaReady(expectedTurn: Long, expectedGeneration: Long) {
        if (!enabled || state != State.PROCESSING || turn != expectedTurn || generation != expectedGeneration) return
        endConversation("MUSIC_PLAY_CONFIRMED")
    }
    fun sessionRenewalRequired() {
        if (!enabled || state == State.SUSPENDED && reason == "SESSION_RENEWAL_REQUIRED") return
        renewalOwner = if (state in setOf(State.BRAIN_LISTENING, State.BRAIN_SPEAKING, State.PROCESSING)) Owner.BRAIN else Owner.WAKE
        suspend("SESSION_RENEWAL_REQUIRED")
    }
    fun sessionRenewed() {
        if (!enabled || state != State.SUSPENDED || reason != "SESSION_RENEWAL_REQUIRED" || !ports.sessionReady()) return
        cancelTimers()
        listen(renewalOwner)
    }
    private fun armOutputTimeout() {
        val expected = generation
        deadline?.cancel()
        deadline = ports.later(180_000) {
            if (generation == expected && state == State.BRAIN_SPEAKING) suspend("OUTPUT_TIMEOUT")
        }
    }
    /** Arm the existing local engine only after real neural playback starts. */
    fun outputStarted(expectedGeneration: Long) {
        if (!enabled || state != State.BRAIN_SPEAKING || generation != expectedGeneration || greeting || owner != Owner.NONE || interruptAttempted) return
        interruptAttempted = true
        if (listOf("espere", "calma").none { EloSpeechInterruptDecision.allowed(it, outgoingText) }) {
            publish(state, "INTERRUPT_UNAVAILABLE"); return
        }
        val lease = ++captureLease
        owner = Owner.INTERRUPT
        publish(state, "INTERRUPT_STARTING")
        if (!ports.startCapture(Owner.INTERRUPT, lease)) interruptCaptureFailed(lease)
    }
    private fun interruptCaptureFailed(lease: Long) {
        if (owner != Owner.INTERRUPT || lease != captureLease) return
        releaseCapture { if (enabled && state == State.BRAIN_SPEAKING) publish(state, "INTERRUPT_UNAVAILABLE") }
    }
    fun interruption(lease: Long, command: String) {
        if (!enabled || state != State.BRAIN_SPEAKING || owner != Owner.INTERRUPT || lease != captureLease ||
            !EloSpeechInterruptDecision.allowed(command, outgoingText)) return
        interrupt(spoken = true)
    }
    fun outputDone(expectedGeneration: Long, ok: Boolean) {
        if (!enabled || state != State.BRAIN_SPEAKING || expectedGeneration != generation) return
        deadline?.cancel(); deadline = null
        if (!ok) { suspend("NEURAL_OUTPUT_FAILED"); return }
        releaseCapture {
        ports.releaseOutputFocus("OUTPUT_COMPLETED")
        if (manualReading) { endConversation("MANUAL_READING_DONE"); return@releaseCapture }
        greeting = false
        val expected = generation
        timer = ports.later(releaseTailMs) {
            if (enabled && generation == expected && state == State.BRAIN_SPEAKING) listen(Owner.BRAIN)
        }
        }
    }
    fun interrupt(spoken: Boolean = false) {
        if (!enabled || state !in setOf(State.PROCESSING, State.BRAIN_SPEAKING)) return
        if (manualReading && !spoken) { endConversation("MANUAL_READING_INTERRUPTED"); return }
        invalidate {
        greeting = false
        ports.releaseOutputFocus("OUTPUT_INTERRUPTED")
        publish(State.BRAIN_LISTENING, "INTERRUPTED")
        val expected = generation
        timer = ports.later(releaseTailMs) {
            if (enabled && generation == expected && state == State.BRAIN_LISTENING) listen(Owner.BRAIN)
        }
        }
    }
    fun endConversation(why: String = "EXPLICIT_END") {
        if (!enabled || state == State.WAKE_LISTENING) return
        publish(State.BRAIN_ENDING, why)
        invalidate {
        ports.releaseOutputFocus(why)
        greeting = false
        publish(State.RETURN_TO_WAKE, why)
        val expected = generation
        timer = ports.later(releaseTailMs) {
            if (enabled && generation == expected && state == State.RETURN_TO_WAKE) listen(Owner.WAKE)
        }
        }
    }
    /** Existing message read-aloud shares this same output and microphone owner. */
    fun readMessage(text: String): Boolean {
        if (!enabled || text.isBlank() || !ports.sessionReady()) return false
        invalidate {
        ports.pauseMusic()
        if (!ports.acquireOutputFocus()) { suspend("AUDIO_FOCUS_DENIED"); return@invalidate }
        manualReading = true
        outgoingText = text
        interruptAttempted = false
        publish(State.BRAIN_SPEAKING, "MANUAL_READING")
        ports.speak(generation, text.take(12_000))
        armOutputTimeout()
        }
        return true
    }
    fun requestFailed(expectedTurn: Long, expectedGeneration: Long, why: String) {
        if (!enabled || state != State.PROCESSING || turn != expectedTurn || generation != expectedGeneration) return
        // POST ambiguity is not retried: canonical history must be checked before another turn.
        suspend(why)
    }
    fun captureFailed(lease: Long, why: String) {
        if (!enabled || lease != captureLease) return
        if (owner == Owner.INTERRUPT && state == State.BRAIN_SPEAKING) { interruptCaptureFailed(lease); return }
        failures += 1
        val recoverable = why in setOf("CAPTURE_READY_TIMEOUT", "SYSTEM_STT_ERROR_1", "SYSTEM_STT_ERROR_2", "SYSTEM_STT_ERROR_8", "SYSTEM_STT_ERROR_10", "SYSTEM_STT_ERROR_11")
        if ((!recoverable && failures >= 3) || why in setOf("PERMISSION_REVOKED", "CLIENT_SILENCED")) { suspend(why); return }
        val resumeOwner = owner
        releaseCapture {
        publish(State.SUSPENDED, why)
        val expected = generation
        timer?.cancel()
        timer = ports.later((failures * 1500L).coerceAtMost(5000)) {
            if (enabled && generation == expected && state == State.SUSPENDED) listen(resumeOwner.takeUnless { it == Owner.NONE } ?: Owner.WAKE)
        }
        }
    }
    fun suspend(why: String) {
        if (!enabled) return
        invalidate {
        ports.releaseOutputFocus(why)
        publish(State.SUSPENDED, why)
        }
    }
    /** Keep the current focus request only to receive its matching GAIN callback. */
    fun suspendForTransientAudioFocusLoss(why: String = "AUDIO_FOCUS_LOST") {
        if (!enabled) return
        invalidate { publish(State.SUSPENDED, why) }
    }
    /** Audio focus gain may resume only wake waiting, never an old conversational turn. */
    fun focusReturned() {
        if (enabled && state == State.SUSPENDED && reason == "AUDIO_FOCUS_LOST") {
            failures = 0
            ports.releaseOutputFocus("FOCUS_GAIN_RECOVERY")
            listen(Owner.WAKE)
        }
    }
    fun disable(why: String = "EXPLICIT_DISABLE") {
        enabled = false
        invalidate {
        ports.releaseOutputFocus(why)
        greeting = false
        publish(State.WAKE_DISABLED, why)
        }
    }
    fun resumeWake() {
        if (!enabled || state != State.SUSPENDED) return
        invalidate { failures = 0; ports.releaseOutputFocus("EXPLICIT_RESUME"); listen(Owner.WAKE) }
    }
}
