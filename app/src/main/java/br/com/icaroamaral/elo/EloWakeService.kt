package br.com.icaroamaral.elo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.PowerManager
import android.os.Looper
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import android.view.KeyEvent
import android.media.AudioManager
import java.text.Normalizer
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

private enum class WakeRecognizerState { IDLE, STARTING, LISTENING }

private enum class MediaPlaybackState { MEDIA_IDLE, MEDIA_PLAYING, MEDIA_PAUSED }

class EloWakeService : Service(), RecognitionListener {
    private val handler = Handler(Looper.getMainLooper())
    private val apiClient = EloApiClient()
    private val commandStabilizer = EloCommandStabilizer()
    private val conversationHistory = mutableListOf<EloConversationMessage>()
    private var voicePlayer: EloVoicePlayer? = null
    private var recognizer: SpeechRecognizer? = null
    private val audioManager by lazy { getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    private var serviceEnabled = false
    private var recognitionRunning = false
    private var restartPending = false
    private var returnToWakePending = false
    private var recognizerState = WakeRecognizerState.IDLE
    private var wakeStartCount = 0
    private var wakeRestartCount = 0
    private var wakeConsecutiveRestartCount = 0
    private var wakeLastRestartReason = "-"
    private var wakeRestartIntervalMs = 0L
    private var wakeConcurrentStartCount = 0
    private var mediaState = MediaPlaybackState.MEDIA_IDLE
    private var onDevice = false
    private var state = EloConversationState.WAKE_LISTENING
    private var lastTranscript = "-"
    private var lastCommand = "-"
    private var lastAnswer = "-"
    private var wakeStatus = "-"
    private var lastError = "none"
    private var lastChatHttp = "-"
    private var lastChatBody = "-"
    private var lastTtsHttp = "-"
    private var lastTtsContentType = "-"
    private var lastTtsBytes = "-"
    private var lastVoice = "-"
    private var lastVoiceStage = "-"
    private var lastDataSource = "-"
    private var lastIsPlaying = "-"
    private var lastDuration = "-"
    private var lastPlayerError = "-"
    private var lastStreamMusic = "-"
    private var lastAudioAttributes = "-"
    private var lastAnswerLength = "-"
    private var lastLatency = "-"
    private var wakeDetectedAtMs = 0L
    private var commandAcceptedAtMs = 0L
    private var chatStartedAtMs = 0L
    private var ttsStartedAtMs = 0L
    private var wakeCandidate = false
    private var lastRawPartial = "-"
    private var lastRawFinal = "-"
    private var lastWakeCandidate = "false"
    private var lastCommandAfterWake = "-"
    private var lastCommandBuffer = "-"
    private var lastDispatchedCommand = "-"
    private var lastRawCommand = "-"
    private var lastNormalizedCommand = "-"
    private var lastRouter = "-"
    private var lastRouterAction = "-"
    private var lastBackendAnswer = "-"
    private var lastTtsText = "-"
    private var lastHistorySize = "0"
    private var lastHistoryUser = "-"
    private var lastHistoryAssistant = "-"
    private var lastFollowupDetected = "false"
    private var lastFollowupTopic = "-"
    private var lastMediaTitle = "-"
    private var lastMediaArtist = "-"
    private var lastMediaVideoId = "-"
    private var interruptOnlyMode = false
    private var currentGeneration = 0
    private var wakeLock: PowerManager.WakeLock? = null
    private var wakeLockAcquiredAtMs = 0L
    private var lastWakeLock = "released"
    private var chatResponseAtMs = 0L
    private var answerReadyAtMs = 0L
    private var firstAudioAtMs = 0L
    private var lastStopToSilenceMs = "-"
    private var preWarmDone = false
    private var interruptReady = false
    private var stopSpeechDetectedAtMs = 0L
    private var stopMatchedAtMs = 0L
    private var stopCurrentResponseCalledAtMs = 0L
    private var audioSilencedAtMs = 0L
    private var transcriptFinalAtMs = 0L
    private var dispatchStartedAtMs = 0L
    private var httpStartedAtMs = 0L
    private var httpCompletedAtMs = 0L
    private var answerParsedAtMs = 0L
    private var processingEndedAtMs = 0L
    private var processingWatchdogGeneration = 0
    private val interruptReadyWatchdogRunnable = Runnable {
        if (serviceEnabled && interruptOnlyMode && !interruptReady && (state == EloConversationState.PROCESSING || state == EloConversationState.SPEAKING)) {
            Log.i("EloWakeService", "INTERRUPT_READY_TIMEOUT restart state=" + state.name + " recognitionRunning=" + recognitionRunning)
            recognitionRunning = false
            runCatching { recognizer?.cancel() }
            startInterruptOnlyListening(120)
        }
    }
    private val processingWatchdogRunnable = Runnable {
        val generation = processingWatchdogGeneration
        if (serviceEnabled && state == EloConversationState.PROCESSING && generation == currentGeneration) {
            handleProcessingTimeout(generation)
        }
    }
    private val commandTimeoutRunnable = Runnable {
        if (state == EloConversationState.COMMAND_LISTENING) {
            lastError = "COMMAND_TIMEOUT"
            transitionToWakeListening(350)
        }
    }

    private val dispatchCommandRunnable = Runnable {
        if (state == EloConversationState.COMMAND_LISTENING) dispatchCommand(commandStabilizer.snapshot())
    }

    private val wakeOnlySettleRunnable = Runnable {
        if (serviceEnabled && state == EloConversationState.WAKE_LISTENING && wakeCandidate && commandStabilizer.snapshot().isBlank()) {
            acknowledgeWakeOnly()
        }
    }

    private val inlineWakeDispatchRunnable = Runnable {
        if (serviceEnabled && state == EloConversationState.WAKE_LISTENING && wakeCandidate) {
            dispatchCommand(commandStabilizer.snapshot())
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.i("EloWakeService", "SERVICE_CREATED")
        createChannel()
        voicePlayer = EloVoicePlayer(this)
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ELO:ProcessingSpeaking").apply { setReferenceCounted(false) }    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.i("EloWakeService", "SERVICE_START_COMMAND action=" + (action ?: "null") + " flags=" + flags + " startId=" + startId)
        when (action) {
            ACTION_STOP -> stopWake(persistDisabled = true)
            ACTION_TEST_LOCAL_TTS -> testLocalTts()
            ACTION_RESTORE_AFTER_BOOT -> restoreWake("boot")
            null -> restoreWake("process-death")
            else -> startWake(restored = false)
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopWake(persistDisabled = false, requestStopSelf = false)
        voicePlayer?.shutdown()
        voicePlayer = null
        super.onDestroy()
    }

    private fun startWake(restored: Boolean) {
        EloServiceSettings.setServiceEnabled(this, true)
        serviceEnabled = true
        lastError = "none"
        state = EloConversationState.WAKE_LISTENING
        returnToWakePending = false
        Log.i("EloWakeService", if (restored) "SERVICE_RESTORED" else "SERVICE_STARTED")
        startForeground(NOTIFICATION_ID, notification())
        ensureRecognizer()
        broadcast("RUNNING", state.name)
        scheduleRestart(150)
        preWarmOnce()
    }

    private fun restoreWake(reason: String) {
        val enabled = EloServiceSettings.isServiceEnabled(this)
        Log.i("EloWakeService", "SERVICE_RESTORE_REQUEST reason=" + reason + " enabled=" + enabled)
        if (!enabled) {
            stopSelf()
            return
        }
        if (reason == "process-death") Log.i("EloWakeService", "WAKE_RESTART_AFTER_PROCESS_DEATH")
        startWake(restored = true)
    }

    private fun preWarmOnce() {
        if (preWarmDone) return
        preWarmDone = true
        Thread {
            val elapsed = apiClient.warmUpHealth()
            handler.post {
                if (serviceEnabled) {
                    lastLatency = latencySummary("preWarmHealthMs=" + elapsed + "; httpReuse=HttpURLConnection keep-alive")
                    broadcast("RUNNING", state.name)
                }
            }
        }.start()
    }
    private fun stopWake(persistDisabled: Boolean = true, requestStopSelf: Boolean = true) {
        if (persistDisabled) EloServiceSettings.setServiceEnabled(this, false)
        serviceEnabled = false
        restartPending = false
        returnToWakePending = false
        handler.removeCallbacksAndMessages(null)
        recognitionRunning = false
        apiClient.cancelActive()
        voicePlayer?.stop()
        cancelProcessingWatchdog()
        releaseProcessingWakeLock("service-stop")
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
        broadcast("STOPPED", "STOPPED")
        stopForeground(STOP_FOREGROUND_REMOVE)
        if (requestStopSelf) stopSelf()
    }

    private fun ensureRecognizer() {
        if (recognizer != null) return
        onDevice = Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(this)
        recognizer = if (onDevice && Build.VERSION.SDK_INT >= 31) SpeechRecognizer.createOnDeviceSpeechRecognizer(this) else SpeechRecognizer.createSpeechRecognizer(this)
        recognizer?.setRecognitionListener(this)
    }

    private fun startListening() {
        if (!serviceEnabled) return
        if (recognitionRunning || recognizerState == WakeRecognizerState.STARTING || recognizerState == WakeRecognizerState.LISTENING) {
            wakeConcurrentStartCount += 1
            Log.i("EloWakeService", "WAKE_RECOGNIZER_START_SKIPPED state=" + recognizerState.name + " recognitionRunning=" + recognitionRunning + " concurrentSkips=" + wakeConcurrentStartCount)
            return
        }
        if ((state == EloConversationState.PROCESSING || state == EloConversationState.SPEAKING) && !interruptOnlyMode) return
        ensureRecognizer()
        recognizerState = WakeRecognizerState.STARTING
        recognitionRunning = true
        restartPending = false
        returnToWakePending = false
        wakeStartCount += 1
        Log.i("EloWakeService", "WAKE_RECOGNIZER_START count=" + wakeStartCount + " state=" + state.name + " mode=" + recognizerState.name)
        if (state == EloConversationState.WAKE_LISTENING) wakeStatus = "-"
        lastError = "none"
        updateNotification()
        broadcast("RUNNING", state.name)
        recognizer?.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
        })
    }

    private fun stopRecognizer() {
        recognitionRunning = false
        recognizerState = WakeRecognizerState.IDLE
        restartPending = false
        interruptOnlyMode = false
        interruptReady = false
        handler.removeCallbacks(interruptReadyWatchdogRunnable)
        runCatching { recognizer?.cancel() }
    }

    private fun startInterruptOnlyListening(delayMs: Long = 180) {
        if (!serviceEnabled || recognitionRunning || (state != EloConversationState.PROCESSING && state != EloConversationState.SPEAKING)) return
        handler.postDelayed({
            if (!serviceEnabled || recognitionRunning || (state != EloConversationState.PROCESSING && state != EloConversationState.SPEAKING)) return@postDelayed
            interruptOnlyMode = true
            interruptReady = false
            Log.i("EloWakeService", "INTERRUPT_RECOGNIZER_START state=" + state.name)
            startListening()
            handler.removeCallbacks(interruptReadyWatchdogRunnable)
            handler.postDelayed(interruptReadyWatchdogRunnable, INTERRUPT_READY_TIMEOUT_MS)
        }, delayMs)
    }

    private fun safeRestartRecognition(delayMs: Long = 350) {
        if (!serviceEnabled || state != EloConversationState.WAKE_LISTENING) return
        if (restartPending || recognitionRunning || recognizerState == WakeRecognizerState.STARTING || recognizerState == WakeRecognizerState.LISTENING) {
            Log.i("EloWakeService", "WAKE_RESTART_SKIPPED pending=" + restartPending + " recognizerState=" + recognizerState.name + " recognitionRunning=" + recognitionRunning)
            return
        }
        restartPending = true
        val controlledDelayMs = controlledWakeRestartDelay(delayMs)
        wakeRestartCount += 1
        wakeLastRestartReason = "wake-listening"
        wakeRestartIntervalMs = controlledDelayMs
        Log.i("EloWakeService", "WAKE_RESTART_SCHEDULED count=" + wakeRestartCount + " delayMs=" + controlledDelayMs + " reason=" + wakeLastRestartReason)
        broadcast("RUNNING", state.name)
        handler.postDelayed({
            restartPending = false
            if (serviceEnabled && state == EloConversationState.WAKE_LISTENING && !recognitionRunning && recognizerState != WakeRecognizerState.STARTING && recognizerState != WakeRecognizerState.LISTENING) {
                Log.i("EloWakeService", "WAKE_RESTART_EXECUTED count=" + wakeRestartCount + " intervalMs=" + wakeRestartIntervalMs)
                startListening()
            } else {
                broadcast("RUNNING", state.name)
            }
        }, controlledDelayMs)
    }

    private fun scheduleRestart(delayMs: Long = 350) {
        safeRestartRecognition(delayMs)
    }

    private fun controlledWakeRestartDelay(requestedDelayMs: Long): Long {
        val baseDelay = requestedDelayMs.coerceAtLeast(WAKE_RESTART_BASE_DELAY_MS)
        val backoff = when {
            wakeConsecutiveRestartCount <= 0 -> baseDelay
            wakeConsecutiveRestartCount == 1 -> 1_500L
            else -> 3_000L
        }
        wakeConsecutiveRestartCount += 1
        return backoff.coerceAtMost(WAKE_RESTART_MAX_DELAY_MS)
    }

    private fun enterCommandListening() {
        state = EloConversationState.COMMAND_LISTENING
        wakeDetectedAtMs = SystemClock.elapsedRealtime()
        wakeStatus = "DETECTED"
        lastError = "none"
        resetWakeInlineState(clearDebug = false)
        commandStabilizer.reset()
        handler.removeCallbacks(dispatchCommandRunnable)
        handler.removeCallbacks(commandTimeoutRunnable)
        cancelProcessingWatchdog()
        cancelProcessingWatchdog()
        stopRecognizer()
        startInterruptOnlyListening(260)
        updateNotification()
        broadcast("RUNNING", state.name)
        handler.postDelayed({ startListening() }, 350)
        handler.postDelayed(commandTimeoutRunnable, COMMAND_TIMEOUT_MS)
    }

    private fun transitionToWakeListening(delayMs: Long = 350) {
        state = EloConversationState.WAKE_LISTENING
        resetWakeInlineState(clearDebug = false)
        commandStabilizer.reset()
        handler.removeCallbacks(dispatchCommandRunnable)
        handler.removeCallbacks(commandTimeoutRunnable)
        cancelProcessingWatchdog()
        cancelProcessingWatchdog()
        updateNotification()
        broadcast("RUNNING", state.name)
        scheduleRestart(delayMs)
    }

    private fun returnToWakeListening_(reason: String, delayMs: Long = 450) {
        if (!serviceEnabled) return
        if (returnToWakePending) {
            broadcast("RUNNING", state.name)
            return
        }

        returnToWakePending = true
        handler.removeCallbacks(dispatchCommandRunnable)
        handler.removeCallbacks(commandTimeoutRunnable)
        cancelProcessingWatchdog()
        cancelProcessingWatchdog()
        resetWakeInlineState(clearDebug = false)
        commandStabilizer.reset()
        apiClient.cancelActive()
        voicePlayer?.stop()
        releaseProcessingWakeLock(reason)
        recognitionRunning = false
        restartPending = false
        state = EloConversationState.WAKE_LISTENING
        interruptOnlyMode = false
        lastPlayerError = if (lastPlayerError == "-") "return=" + reason else lastPlayerError + "; return=" + reason
        updateNotification()
        broadcast("RUNNING", state.name)
        safeRestartRecognition(delayMs)
    }

    private fun scheduleProcessingWatchdog(generation: Int) {
        processingWatchdogGeneration = generation
        handler.removeCallbacks(processingWatchdogRunnable)
        handler.postDelayed(processingWatchdogRunnable, PROCESSING_TIMEOUT_MS)
    }

    private fun cancelProcessingWatchdog() {
        handler.removeCallbacks(processingWatchdogRunnable)
        processingWatchdogGeneration = 0
    }

    private fun handleProcessingTimeout(generation: Int) {
        if (!serviceEnabled || generation != currentGeneration || state != EloConversationState.PROCESSING) {
            Log.i("EloWakeService", "STALE_CALLBACK_IGNORED handleBackendResult generation=" + generation + " current=" + currentGeneration)
            return
        }
        cancelProcessingWatchdog()
        processingEndedAtMs = SystemClock.elapsedRealtime()
        currentGeneration += 1
        val fallbackGeneration = currentGeneration
        apiClient.cancelActive()
        cancelProcessingWatchdog()
        lastError = "PROCESSING_TIMEOUT"
        lastChatHttp = "TIMEOUT / " + PROCESSING_TIMEOUT_MS + "ms"
        lastChatBody = "PROCESSING_TIMEOUT"
        lastBackendAnswer = "-"
        lastAnswer = PROCESSING_TIMEOUT_FALLBACK
        lastTtsText = PROCESSING_TIMEOUT_FALLBACK
        lastAnswerLength = PROCESSING_TIMEOUT_FALLBACK.length.toString()
        lastRouter = "PROCESSING_TIMEOUT"
        lastRouterAction = "local_fallback"
        lastPlayerError = "FINAL_STATE=PROCESSING_TIMEOUT"
        lastLatency = latencySummary("PROCESSING_TIMEOUT; stale callbacks blocked")
        state = EloConversationState.SPEAKING
        returnToWakePending = false
        stopRecognizer()
        updateNotification()
        broadcast("RUNNING", state.name)
        voicePlayer?.speak(
            PROCESSING_TIMEOUT_FALLBACK,
            preferLocalFastPath = true,
            onStatus = { report ->
                if (fallbackGeneration == currentGeneration) {
                    applyVoiceReport(report)
                    broadcast("RUNNING", state.name)
                }
            },
            onDone = {
                if (fallbackGeneration == currentGeneration) returnToWakeListening_("processing-timeout", 150)
            }
        ) ?: returnToWakeListening_("processing-timeout-no-player", 150)
    }
    private fun acquireProcessingWakeLock(reason: String) {
        val lock = wakeLock ?: return
        if (!lock.isHeld) {
            runCatching {
                lock.acquire(PROCESSING_WAKELOCK_TIMEOUT_MS)
                wakeLockAcquiredAtMs = SystemClock.elapsedRealtime()
                lastWakeLock = "held:" + reason
            }.onFailure { error ->
                lastWakeLock = "acquire-fail:" + (error.message ?: error.javaClass.simpleName)
            }
        }
    }

    private fun releaseProcessingWakeLock(reason: String) {
        val lock = wakeLock ?: return
        if (lock.isHeld) {
            val heldMs = if (wakeLockAcquiredAtMs > 0L) SystemClock.elapsedRealtime() - wakeLockAcquiredAtMs else 0L
            runCatching { lock.release() }
            lastWakeLock = "released:" + reason + "; heldMs=" + heldMs
        } else {
            lastWakeLock = "released:" + reason
        }
        wakeLockAcquiredAtMs = 0L
    }

    private fun isStopIntent(text: String): Boolean {
        val normalized = normalizeStopText(text)
        val tokens = normalized.split(" ").filter { it.isNotBlank() }
        val relevant = tokens.filterNot { it == "ei" || it == "oi" || it == "ola" || it == "alo" }
        val withoutWake = relevant.dropWhile { it == "elo" || it == "hello" }
        val matched = withoutWake.size == 1 && withoutWake.firstOrNull() in stopWords
        Log.i("EloWakeService", "INTERRUPT_MATCH raw=\"" + text + "\" normalized=\"" + normalized + "\" matched=" + matched)
        return matched
    }

    private fun normalizeStopText(text: String): String {
        return Normalizer.normalize(text.lowercase(), Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun handleLocalDateTimeCommand(command: String): Boolean {
        val answer = resolveLocalDateTimeAnswer(command) ?: return false
        val now = SystemClock.elapsedRealtime()
        handler.removeCallbacks(inlineWakeDispatchRunnable)
        handler.removeCallbacks(wakeOnlySettleRunnable)
        handler.removeCallbacks(commandTimeoutRunnable)
        cancelProcessingWatchdog()
        wakeCandidate = false
        lastWakeCandidate = "false"
        lastDispatchedCommand = command
        lastRawCommand = command
        lastNormalizedCommand = normalizeStopText(command)
        lastRouter = "LOCAL_DEVICE_TIME"
        lastRouterAction = "date_time"
        lastBackendAnswer = answer
        lastTtsText = answer
        lastAnswer = answer
        lastAnswerLength = answer.length.toString()
        lastCommand = command
        lastTranscript = command
        lastError = "none"
        lastChatHttp = "SKIPPED_LOCAL_DEVICE_TIME"
        lastChatBody = "-"
        commandAcceptedAtMs = now
        dispatchStartedAtMs = now
        chatStartedAtMs = 0L
        httpStartedAtMs = 0L
        httpCompletedAtMs = 0L
        answerParsedAtMs = now
        answerReadyAtMs = now
        processingEndedAtMs = now
        chatResponseAtMs = now
        currentGeneration += 1
        val generation = currentGeneration
        resetAudioTelemetry()
        stopRecognizer()
        rememberConversation(command, answer)
        speakAnswer(answer, generation, preferLocalFastPath = true)
        return true
    }

    private fun resolveLocalDateTimeAnswer(command: String): String? {
        val normalized = normalizeStopText(command).removePrefix("pesquise ").trim()
        val asksTime = Regex("\\b(que horas sao|qual a hora|hora local|horario local|me diga as horas)\\b").containsMatchIn(normalized)
        val asksWeekday = Regex("\\b(qual o dia da semana|hoje e que dia da semana)\\b").containsMatchIn(normalized)
        val asksDate = Regex("\\b(que dia e hoje|qual a data de hoje|data de hoje|hoje e que dia|qual e a data)\\b").containsMatchIn(normalized)
        if (!asksTime && !asksWeekday && !asksDate) return null
        val now = ZonedDateTime.now()
        return when {
            asksTime -> "Agora são " + now.format(DateTimeFormatter.ofPattern("HH:mm", Locale("pt", "BR"))) + "."
            asksWeekday -> {
                val weekday = now.format(DateTimeFormatter.ofPattern("EEEE", Locale("pt", "BR")))
                val date = now.format(DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", Locale("pt", "BR")))
                "Hoje é " + weekday + ", " + date + "."
            }
            else -> "Hoje é " + now.format(DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", Locale("pt", "BR"))) + "."
        }
    }

    private fun acknowledgeWakeOnly() {
        if (!serviceEnabled || state != EloConversationState.WAKE_LISTENING || !wakeCandidate) return
        val greeting = localWakeGreeting()
        val now = SystemClock.elapsedRealtime()
        currentGeneration += 1
        val generation = currentGeneration
        state = EloConversationState.SPEAKING
        lastCommand = "ELO"
        lastTranscript = "ELO"
        lastAnswer = greeting
        lastAnswerLength = greeting.length.toString()
        lastRouter = "WAKE_LOCAL"
        lastRouterAction = "wake_ack"
        lastBackendAnswer = "-"
        lastTtsText = greeting
        lastError = "none"
        wakeStatus = "DETECTED"
        commandAcceptedAtMs = now
        ttsStartedAtMs = now
        resetAudioTelemetry()
        resetWakeInlineState(clearDebug = false)
        commandStabilizer.reset()
        handler.removeCallbacks(dispatchCommandRunnable)
        handler.removeCallbacks(commandTimeoutRunnable)
        cancelProcessingWatchdog()
        stopRecognizer()
        updateNotification()
        broadcast("RUNNING", state.name)
        voicePlayer?.speak(
            greeting,
            preferLocalFastPath = true,
            onStatus = { report ->
                if (generation == currentGeneration) {
                    applyVoiceReport(report)
                    broadcast("RUNNING", state.name)
                }
            },
            onDone = {
                if (generation == currentGeneration && serviceEnabled) enterCommandListening()
            }
        ) ?: enterCommandListening()
    }

    private fun localWakeGreeting(): String {
        return when (ZonedDateTime.now().hour) {
            in 5..11 -> "Bom dia. Pode falar."
            in 12..17 -> "Boa tarde. Pode falar."
            else -> "Boa noite. Pode falar."
        }
    }

    private fun stopCurrentResponse(reason: String = "stop-command") {
        stopCurrentResponseCalledAtMs = SystemClock.elapsedRealtime()
        val detectedAtMs = if (stopMatchedAtMs > 0L) stopMatchedAtMs else stopCurrentResponseCalledAtMs
        currentGeneration += 1
        lastError = "STOP_COMMAND"
        lastVoiceStage = "STOP_REQUESTED"
        cancelProcessingWatchdog()
        lastPlayerError = "FINAL_STATE=CANCELLED_BY_USER"
        apiClient.cancelActive()
        voicePlayer?.stop()
        handler.removeCallbacks(dispatchCommandRunnable)
        handler.removeCallbacks(commandTimeoutRunnable)
        cancelProcessingWatchdog()
        cancelProcessingWatchdog()
        stopRecognizer()
        audioSilencedAtMs = SystemClock.elapsedRealtime()
        lastStopToSilenceMs = (audioSilencedAtMs - detectedAtMs).toString()
        lastLatency = latencySummary("stopDetectionToSilenceMs=" + lastStopToSilenceMs)
        releaseProcessingWakeLock(reason)
        returnToWakeListening_(reason, 150)
    }
    private fun dispatchCommand(command: String) {
        val cleanCommand = stripLeadingWake(command).trim()
        if (cleanCommand.isBlank()) {
            transitionToWakeListening(350)
            return
        }

        if (handleMediaControlCommand(cleanCommand)) return
        if (handleLocalDateTimeCommand(cleanCommand)) return

        handler.removeCallbacks(inlineWakeDispatchRunnable)
        handler.removeCallbacks(wakeOnlySettleRunnable)
        wakeCandidate = false
        lastWakeCandidate = "false"
        lastDispatchedCommand = cleanCommand
        lastRawCommand = cleanCommand
        lastNormalizedCommand = "PENDING"
        lastRouter = "PENDING"
        lastRouterAction = "PENDING"
        lastBackendAnswer = "-"
        lastTtsText = "-"
        state = EloConversationState.PROCESSING
        currentGeneration += 1
        val generation = currentGeneration
        dispatchStartedAtMs = SystemClock.elapsedRealtime()
        commandAcceptedAtMs = dispatchStartedAtMs
        if (transcriptFinalAtMs == 0L) transcriptFinalAtMs = dispatchStartedAtMs
        chatStartedAtMs = commandAcceptedAtMs
        httpStartedAtMs = chatStartedAtMs
        httpCompletedAtMs = 0L
        answerParsedAtMs = 0L
        processingEndedAtMs = 0L
        chatResponseAtMs = 0L
        answerReadyAtMs = 0L
        ttsStartedAtMs = 0L
        firstAudioAtMs = 0L
        acquireProcessingWakeLock("processing")
        lastCommand = cleanCommand
        lastTranscript = cleanCommand
        lastAnswer = "-"
        lastError = "none"
        lastChatHttp = "COMMAND_DISPATCH_START"
        lastLatency = latencySummary("COMMAND_DISPATCH_START; COMMAND_HTTP_START")
        lastChatBody = "-"
        lastAnswerLength = "-"
        resetAudioTelemetry()
        stopRecognizer()
        startInterruptOnlyListening(220)
        handler.removeCallbacks(commandTimeoutRunnable)
        scheduleProcessingWatchdog(generation)
        updateNotification()
        broadcast("RUNNING", state.name)

        Thread {
            val result = apiClient.ask(cleanCommand, historySnapshot())
            handler.post {
                httpCompletedAtMs = SystemClock.elapsedRealtime()
                if (generation != currentGeneration) {
                    Log.i("EloWakeService", "STALE_CALLBACK_IGNORED generation=" + generation + " current=" + currentGeneration)
                    return@post
                }
                lastChatHttp = "COMMAND_HTTP_RESPONSE"
                handleBackendResult(result, generation)
            }
        }.start()
    }

    private data class LocalMathAnswer(val answer: String, val normalized: String)

    private fun resolveLocalMath(command: String): LocalMathAnswer? {
        val text = command.lowercase()
            .replace("quanto e", "")
            .replace("quanto é", "")
            .replace("?", "")
            .replace(",", " ")
            .replace(Regex("\\s+"), " ")
            .trim()
        val pattern = Regex("""(menos|zero|um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|\d+)\s*(mais|\+|menos|-|vezes|x|×|multiplicado por)\s*(menos|zero|um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|\d+)""")
        val match = pattern.find(text) ?: return null
        val left = parseSmallNumber(match.groupValues[1]) ?: return null
        val op = match.groupValues[2]
        val right = parseSmallNumber(match.groupValues[3]) ?: return null
        val value = when (op) {
            "mais", "+" -> left + right
            "menos", "-" -> left - right
            "vezes", "x", "×", "multiplicado por" -> left * right
            else -> return null
        }
        if (value !in -99..200) return null
        val answer = numberPt(left) + " " + opText(op) + " " + numberPt(right) + " é " + numberPt(value) + "."
        return LocalMathAnswer(answer.replaceFirstChar { it.uppercase() }, left.toString() + op + right.toString())
    }

    private fun parseSmallNumber(raw: String): Int? {
        return when (raw.trim().lowercase()) {
            "zero" -> 0
            "um", "uma" -> 1
            "dois", "duas" -> 2
            "tres", "três" -> 3
            "quatro" -> 4
            "cinco" -> 5
            "seis" -> 6
            "sete" -> 7
            "oito" -> 8
            "nove" -> 9
            "dez" -> 10
            "onze" -> 11
            "doze" -> 12
            "treze" -> 13
            "quatorze", "catorze" -> 14
            "quinze" -> 15
            "dezesseis" -> 16
            "dezessete" -> 17
            "dezoito" -> 18
            "dezenove" -> 19
            "vinte" -> 20
            else -> raw.toIntOrNull()
        }
    }

    private fun opText(op: String): String = when (op) {
        "mais", "+" -> "mais"
        "menos", "-" -> "menos"
        else -> "vezes"
    }

    private fun numberPt(value: Int): String {
        return when (value) {
            0 -> "zero"
            1 -> "um"
            2 -> "dois"
            3 -> "três"
            4 -> "quatro"
            5 -> "cinco"
            6 -> "seis"
            7 -> "sete"
            8 -> "oito"
            9 -> "nove"
            10 -> "dez"
            11 -> "onze"
            12 -> "doze"
            13 -> "treze"
            14 -> "quatorze"
            15 -> "quinze"
            16 -> "dezesseis"
            17 -> "dezessete"
            18 -> "dezoito"
            19 -> "dezenove"
            20 -> "vinte"
            30 -> "trinta"
            40 -> "quarenta"
            50 -> "cinquenta"
            60 -> "sessenta"
            70 -> "setenta"
            80 -> "oitenta"
            90 -> "noventa"
            in 21..99 -> numberPt(value / 10 * 10) + " e " + numberPt(value % 10)
            in -99..-1 -> "menos " + numberPt(-value)
            else -> value.toString()
        }
    }
    private fun handleBackendResult(result: EloChatResult, generation: Int) {
        if (!serviceEnabled || generation != currentGeneration || state != EloConversationState.PROCESSING) {
            Log.i("EloWakeService", "STALE_CALLBACK_IGNORED handleBackendResult generation=" + generation + " current=" + currentGeneration)
            return
        }
        cancelProcessingWatchdog()
        chatResponseAtMs = SystemClock.elapsedRealtime()
        lastChatHttp = result.statusCode.toString() + " / " + result.elapsedMs + "ms"
        lastChatBody = result.bodySummary
        lastRawCommand = result.rawCommand.ifBlank { lastRawCommand }
        lastNormalizedCommand = result.normalizedCommand.ifBlank { lastRawCommand }
        lastRouter = result.router.ifBlank { "-" }
        lastRouterAction = result.routerAction.ifBlank { result.type }
        val answer = if (result.ok && result.answer.isNotBlank()) result.answer else if (result.statusCode == 0) "Estou sem conexão no momento." else result.answer.ifBlank { "Não consegui acessar minha inteligência online agora." }
        val ttsText = if (result.ok && result.ttsText.isNotBlank() && result.ttsText != "-") result.ttsText else answer
        lastBackendAnswer = answer
        lastTtsText = ttsText
        lastAnswer = answer
        lastAnswerLength = ttsText.length.toString()
        answerReadyAtMs = SystemClock.elapsedRealtime()
        answerParsedAtMs = answerReadyAtMs
        processingEndedAtMs = answerReadyAtMs
        lastFollowupDetected = result.followupDetected.toString()
        lastFollowupTopic = result.followupTopic
        lastMediaTitle = result.mediaTitle
        lastMediaArtist = result.mediaArtist
        lastMediaVideoId = result.mediaVideoId
        lastHistorySize = result.historySize.toString()
        lastLatency = latencySummary(chatMs = result.elapsedMs)
        if (!result.ok) lastError = result.error ?: "CHAT_HTTP_ERROR"
        if (result.ok && result.router == "MUSIC" && result.routerAction == "play") {
            handleMediaDirective(result, answer)
            return
        }
        rememberConversation(lastCommand, answer)
        speakAnswer(ttsText, generation)
    }

    private fun handleMediaDirective(result: EloChatResult, answer: String) {
        lastVoice = "MEDIA_DIRECTIVE"
        lastVoiceStage = "MEDIA_PLAY"
        lastTtsText = "-"
        lastAnswer = answer
        rememberConversation(lastCommand, "MUSIC/play: " + result.mediaTitle + " - " + result.mediaArtist)
        updateNotification()
        broadcast("RUNNING", state.name)

        if (result.mediaVideoId.isBlank() || result.mediaVideoId == "-") {
            lastError = "MEDIA_VIDEO_ID_MISSING"
            returnToWakeListening_("media-error")
            return
        }

        runCatching {
            EloMusicPlayerCoordinatorRegistry.stopActivePlayer()
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/watch?v=" + result.mediaVideoId)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            mediaState = MediaPlaybackState.MEDIA_PLAYING
            lastPlayerError = "MEDIA_STATE=MEDIA_PLAYING"
        }.onFailure { error ->
            lastError = "MEDIA_PLAY_ERROR: " + (error.message ?: "sem player")
            mediaState = MediaPlaybackState.MEDIA_IDLE
        }
        returnToWakeListening_("media-directive")
    }

    private fun handleMediaControlCommand(command: String): Boolean {
        val normalized = normalizeStopText(command)
        return when {
            mediaState != MediaPlaybackState.MEDIA_IDLE && isMediaStopIntent(normalized) -> {
                stopExternalMedia(normalized)
                true
            }
            mediaState == MediaPlaybackState.MEDIA_PLAYING && isMediaPauseIntent(normalized) -> {
                pauseExternalMedia(normalized)
                true
            }
            mediaState == MediaPlaybackState.MEDIA_PAUSED && isMediaResumeIntent(normalized) -> {
                resumeExternalMedia(normalized)
                true
            }
            else -> false
        }
    }

    private fun pauseExternalMedia(reason: String) {
        sendMediaKey(KeyEvent.KEYCODE_MEDIA_PAUSE)
        mediaState = MediaPlaybackState.MEDIA_PAUSED
        lastRouter = "MEDIA_LOCAL"
        lastRouterAction = "pause"
        lastBackendAnswer = "-"
        lastTtsText = "-"
        lastAnswer = "Música pausada."
        lastPlayerError = "MEDIA_STATE=MEDIA_PAUSED; command=" + reason
        rememberConversation(lastCommand, "MEDIA/pause")
        transitionToWakeListening(750)
    }

    private fun resumeExternalMedia(reason: String) {
        sendMediaKey(KeyEvent.KEYCODE_MEDIA_PLAY)
        mediaState = MediaPlaybackState.MEDIA_PLAYING
        lastRouter = "MEDIA_LOCAL"
        lastRouterAction = "resume"
        lastBackendAnswer = "-"
        lastTtsText = "-"
        lastAnswer = "Continuando a música."
        lastPlayerError = "MEDIA_STATE=MEDIA_PLAYING; command=" + reason
        rememberConversation(lastCommand, "MEDIA/resume")
        transitionToWakeListening(750)
    }

    private fun stopExternalMedia(reason: String) {
        sendMediaKey(KeyEvent.KEYCODE_MEDIA_STOP)
        mediaState = MediaPlaybackState.MEDIA_IDLE
        lastRouter = "MEDIA_LOCAL"
        lastRouterAction = "stop"
        lastBackendAnswer = "-"
        lastTtsText = "-"
        lastAnswer = "Música encerrada."
        lastPlayerError = "MEDIA_STATE=MEDIA_IDLE; command=" + reason
        rememberConversation(lastCommand, "MEDIA/stop")
        transitionToWakeListening(750)
    }

    private fun sendMediaKey(keyCode: Int) {
        val eventTime = SystemClock.uptimeMillis()
        audioManager.dispatchMediaKeyEvent(KeyEvent(eventTime, eventTime, KeyEvent.ACTION_DOWN, keyCode, 0))
        audioManager.dispatchMediaKeyEvent(KeyEvent(eventTime, eventTime, KeyEvent.ACTION_UP, keyCode, 0))
    }

    private fun isMediaPauseIntent(normalized: String): Boolean = normalized in mediaPauseWords

    private fun isMediaResumeIntent(normalized: String): Boolean = normalized in mediaResumeWords

    private fun isMediaStopIntent(normalized: String): Boolean =
        EloVoiceMediaCommand.isStopCommandForActiveMusic(normalized)

    private fun historySnapshot(): List<EloConversationMessage> {
        return conversationHistory.takeLast(10).toList()
    }

    private fun rememberConversation(user: String, assistant: String) {
        val cleanUser = user.trim().take(700)
        val cleanAssistant = assistant.trim().take(700)
        if (cleanUser.isNotBlank()) conversationHistory.add(EloConversationMessage("user", cleanUser))
        if (cleanAssistant.isNotBlank()) conversationHistory.add(EloConversationMessage("assistant", cleanAssistant))
        while (conversationHistory.size > 10) conversationHistory.removeAt(0)
        lastHistorySize = conversationHistory.size.toString()
        lastHistoryUser = conversationHistory.lastOrNull { it.role == "user" }?.content ?: "-"
        lastHistoryAssistant = conversationHistory.lastOrNull { it.role == "assistant" }?.content ?: "-"
    }

    private fun speakAnswer(answer: String, generation: Int, preferLocalFastPath: Boolean = false) {
        state = EloConversationState.SPEAKING
        ttsStartedAtMs = SystemClock.elapsedRealtime()
        lastLatency = latencySummary("t4-tts-start")
        returnToWakePending = false
        stopRecognizer()
        startInterruptOnlyListening(260)
        updateNotification()
        broadcast("RUNNING", state.name)
        voicePlayer?.speak(
            answer,
            preferLocalFastPath = preferLocalFastPath,
            onStatus = { report ->
                if (generation == currentGeneration) {
                    applyVoiceReport(report)
                    broadcast("RUNNING", state.name)
                }
            },
            onDone = {
                if (generation == currentGeneration) returnToWakeListening_("voice-done")
            }
        ) ?: returnToWakeListening_("voice-player-null")
    }

    private fun testLocalTts() {
        serviceEnabled = true
        state = EloConversationState.SPEAKING
        returnToWakePending = false
        lastCommand = "TESTAR TTS LOCAL"
        lastAnswer = "Teste de voz do ELO"
        lastAnswerLength = lastAnswer.length.toString()
        commandAcceptedAtMs = SystemClock.elapsedRealtime()
        ttsStartedAtMs = commandAcceptedAtMs
        lastLatency = latencySummary()
        lastError = "none"
        resetAudioTelemetry()
        stopRecognizer()
        startInterruptOnlyListening(260)
        updateNotification()
        broadcast("RUNNING", state.name)
        voicePlayer?.testLocalTts(
            onStatus = { report ->
                applyVoiceReport(report)
                broadcast("RUNNING", state.name)
            },
            onDone = {
                returnToWakeListening_("local-tts-done")
            }
        ) ?: returnToWakeListening_("voice-player-null")
    }

    private fun applyVoiceReport(report: EloVoiceReport) {
        lastVoice = report.voiceMode
        lastVoiceStage = report.voiceStage
        if (report.ttsHttp != "-") lastTtsHttp = report.ttsHttp
        if (report.ttsContentType != "-") lastTtsContentType = report.ttsContentType
        if (report.ttsBytes != "-") lastTtsBytes = report.ttsBytes
        if (report.dataSource != "-") lastDataSource = report.dataSource
        if (report.isPlaying != "-") lastIsPlaying = report.isPlaying
        if (report.durationMs != "-") lastDuration = report.durationMs
        if (report.playerError != "-") lastPlayerError = report.playerError
        if (report.streamMusic != "-") lastStreamMusic = report.streamMusic
        if (report.audioAttributes != "-") lastAudioAttributes = report.audioAttributes
        if (report.voiceStage == "PLAYING") lastPlayerError = "FINAL_STATE=SPOKEN_NEURAL"
        if (report.voiceStage == "ANDROID_TTS_ON_START" || report.voiceStage == "FAST_LOCAL_TTS" || report.voiceStage == "WATCHDOG_LOCAL_FALLBACK") lastPlayerError = "FINAL_STATE=SPOKEN_LOCAL_FALLBACK"
        if (report.voiceStage == "PLAYING" || report.voiceStage == "ANDROID_TTS_ON_START") {
            if (firstAudioAtMs == 0L) firstAudioAtMs = SystemClock.elapsedRealtime()
        }
        if (report.latency != "-") lastLatency = latencySummary(report.latency)
        if (!report.error.isNullOrBlank() && (report.voiceStage == "ERROR" || report.voiceStage.contains("FAIL"))) lastError = report.error
    }

    private fun resetAudioTelemetry() {
        lastTtsHttp = "-"
        lastTtsContentType = "-"
        lastTtsBytes = "-"
        lastVoice = "-"
        lastVoiceStage = "-"
        lastDataSource = "-"
        lastIsPlaying = "-"
        lastDuration = "-"
        lastPlayerError = "-"
        lastStreamMusic = "-"
        lastAudioAttributes = "-"
        lastLatency = "-"
    }

    private fun latencySummary(extra: String = "-", chatMs: Long? = null): String {
        val now = SystemClock.elapsedRealtime()
        val wakeToCommand = if (wakeDetectedAtMs > 0L && commandAcceptedAtMs > 0L) commandAcceptedAtMs - wakeDetectedAtMs else 0L
        val chatElapsed = chatMs ?: if (chatStartedAtMs > 0L && ttsStartedAtMs > 0L) ttsStartedAtMs - chatStartedAtMs else 0L
        val totalUntilSpeech = if (commandAcceptedAtMs > 0L) now - commandAcceptedAtMs else 0L
        val commandToChat = if (commandAcceptedAtMs > 0L && chatStartedAtMs > 0L) chatStartedAtMs - commandAcceptedAtMs else 0L
        val answerToTtsStart = if (answerReadyAtMs > 0L && ttsStartedAtMs > 0L) ttsStartedAtMs - answerReadyAtMs else 0L
        val timeToFirstAudio = if (firstAudioAtMs > 0L && commandAcceptedAtMs > 0L) firstAudioAtMs - commandAcceptedAtMs else 0L
        val transcriptToDispatch = if (transcriptFinalAtMs > 0L && dispatchStartedAtMs > 0L) dispatchStartedAtMs - transcriptFinalAtMs else 0L
        val dispatchToHttp = if (dispatchStartedAtMs > 0L && httpStartedAtMs > 0L) httpStartedAtMs - dispatchStartedAtMs else 0L
        val backendMs = if (httpStartedAtMs > 0L && httpCompletedAtMs > 0L) httpCompletedAtMs - httpStartedAtMs else 0L
        val parseMs = if (httpCompletedAtMs > 0L && answerParsedAtMs > 0L) answerParsedAtMs - httpCompletedAtMs else 0L
        val totalProcessingMs = if (dispatchStartedAtMs > 0L && processingEndedAtMs > 0L) processingEndedAtMs - dispatchStartedAtMs else 0L
        return "processing: generation=" + currentGeneration + "; transcript=\"" + lastCommand + "\"; transcriptToDispatchMs=" + transcriptToDispatch + "; dispatchToHttpMs=" + dispatchToHttp + "; backendMs=" + backendMs + "; parseMs=" + parseMs + "; totalProcessingMs=" + totalProcessingMs + "; answerLen=" + lastAnswerLength + "; commandToChatMs=" + commandToChat + "; wakeToCommandMs=" + wakeToCommand + "; chatMs=" + chatElapsed + "; answerToTtsStartMs=" + answerToTtsStart + "; timeToFirstAudioMs=" + timeToFirstAudio + "; totalCommandToAudioMs=" + totalUntilSpeech + "; wakeLock=" + lastWakeLock + "; stopSpeechDetectedAt=" + stopSpeechDetectedAtMs + "; stopMatchedAt=" + stopMatchedAtMs + "; stopCurrentResponseCalledAt=" + stopCurrentResponseCalledAtMs + "; audioSilencedAt=" + audioSilencedAtMs + "; stopDetectionToSilenceMs=" + lastStopToSilenceMs + "; player=" + extra
    }

    override fun onReadyForSpeech(params: android.os.Bundle?) {
        recognitionRunning = true
        recognizerState = WakeRecognizerState.LISTENING
        Log.i("EloWakeService", "WAKE_ON_READY state=" + state.name + " starts=" + wakeStartCount + " restarts=" + wakeRestartCount)
        if (interruptOnlyMode) {
            interruptReady = true
            handler.removeCallbacks(interruptReadyWatchdogRunnable)
            Log.i("EloWakeService", "INTERRUPT_ON_READY state=" + state.name)
        }
        broadcast("RUNNING", state.name)
    }

    override fun onBeginningOfSpeech() {
        wakeConsecutiveRestartCount = 0
        Log.i("EloWakeService", "WAKE_ON_BEGINNING_OF_SPEECH state=" + state.name)
        if (interruptOnlyMode) {
            stopSpeechDetectedAtMs = SystemClock.elapsedRealtime()
            Log.i("EloWakeService", "INTERRUPT_ON_BEGINNING_OF_SPEECH state=" + state.name)
        }
        broadcast("RUNNING", state.name)
    }

    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit

    override fun onEndOfSpeech() {
        recognitionRunning = false
        recognizerState = WakeRecognizerState.IDLE
        Log.i("EloWakeService", "WAKE_ON_END state=" + state.name)
        if (interruptOnlyMode) Log.i("EloWakeService", "INTERRUPT_END state=" + state.name)
        broadcast("RUNNING", state.name)
    }

    override fun onError(error: Int) {
        recognitionRunning = false
        recognizerState = WakeRecognizerState.IDLE
        Log.i("EloWakeService", "WAKE_ON_ERROR error=" + errorName(error) + " state=" + state.name)
        if (interruptOnlyMode && (state == EloConversationState.PROCESSING || state == EloConversationState.SPEAKING)) {
            Log.i("EloWakeService", "INTERRUPT_ERROR error=" + errorName(error) + " state=" + state.name)
            if (error in recoverableErrors) startInterruptOnlyListening(750)
            return
        }
        if (state == EloConversationState.PROCESSING || state == EloConversationState.SPEAKING) return
        lastError = errorName(error)
        broadcast("RUNNING", "ERROR")
        if (state == EloConversationState.COMMAND_LISTENING) {
            if (error in recoverableErrors) transitionToWakeListening(350)
            return
        }
        if (error in recoverableErrors) scheduleRestart()
    }

    override fun onResults(results: android.os.Bundle?) {
        recognitionRunning = false
        recognizerState = WakeRecognizerState.IDLE
        Log.i("EloWakeService", "WAKE_ON_RESULTS state=" + state.name)
        transcriptFinalAtMs = SystemClock.elapsedRealtime()
        handleTexts(results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION), finalResult = true)
    }

    override fun onPartialResults(partialResults: android.os.Bundle?) {
        Log.i("EloWakeService", "WAKE_ON_PARTIAL state=" + state.name)
        handleTexts(partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION), finalResult = false)
    }

    override fun onEvent(eventType: Int, params: android.os.Bundle?) = Unit

    private fun handleTexts(texts: List<String>?, finalResult: Boolean) {
        logRawRecognition(texts, finalResult)
        val text = bestTranscript(texts)
        if (text.isBlank()) return
        if (finalResult) lastRawFinal = text else lastRawPartial = text
        lastTranscript = text

        when (state) {
            EloConversationState.WAKE_LISTENING -> {
                handleWakeListeningTexts(texts, finalResult)
            }
            EloConversationState.COMMAND_LISTENING -> {
                commandStabilizer.accept(texts)
                lastTranscript = commandStabilizer.snapshot()
                handler.removeCallbacks(dispatchCommandRunnable)
                handler.postDelayed(dispatchCommandRunnable, if (finalResult) COMMAND_FINAL_SETTLE_MS else COMMAND_PARTIAL_SETTLE_MS)
                broadcast("RUNNING", state.name)
            }
            EloConversationState.PROCESSING,
            EloConversationState.SPEAKING -> {
                if (interruptOnlyMode) {
                    Log.i("EloWakeService", (if (finalResult) "INTERRUPT_FINAL" else "INTERRUPT_PARTIAL") + " raw=\"" + text + "\" normalized=\"" + normalizeStopText(text) + "\"")
                }
                if (isStopIntent(text)) {
                    stopMatchedAtMs = SystemClock.elapsedRealtime()
                    if (stopSpeechDetectedAtMs == 0L) stopSpeechDetectedAtMs = stopMatchedAtMs
                    stopCurrentResponse("stop-command")
                } else if (finalResult && interruptOnlyMode) {
                    startInterruptOnlyListening(140)
                }
            }
        }
    }

    private fun handleWakeListeningTexts(texts: List<String>?, finalResult: Boolean) {
        val hypothesis = EloWakeParser.selectBestWakeHypothesis(texts)
        if (hypothesis.raw.isBlank()) return
        lastTranscript = hypothesis.raw
        if (finalResult) lastRawFinal = hypothesis.raw else lastRawPartial = hypothesis.raw
        Log.i("EloWakeService", "NORMALIZED=\"" + hypothesis.normalized + "\"")
        Log.i("EloWakeService", "WAKE_ALIAS=\"" + hypothesis.aliasMatched + "\"")
        Log.i("EloWakeService", "WAKE_MATCH=" + hypothesis.wakeMatched)
        Log.i("EloWakeService", "COMMAND_AFTER_WAKE=\"" + hypothesis.commandAfterWake + "\"")
        Log.i("EloWakeService", "WAKE_DECISION=" + hypothesis.decision.name)

        if (hypothesis.wakeMatched) {
            wakeCandidate = true
            lastWakeCandidate = "true"
            if (wakeDetectedAtMs == 0L) wakeDetectedAtMs = SystemClock.elapsedRealtime()
            wakeStatus = "CANDIDATE"

            val commandAfterWake = hypothesis.commandAfterWake
            lastCommandAfterWake = commandAfterWake.ifBlank { "-" }
            if (commandAfterWake.isNotBlank()) {
                handler.removeCallbacks(wakeOnlySettleRunnable)
                acceptInlineWakeCommand(commandAfterWake, finalResult)
            } else {
                handler.removeCallbacks(wakeOnlySettleRunnable)
                handler.postDelayed(wakeOnlySettleRunnable, WAKE_CONTINUATION_MS)
                broadcast("RUNNING", state.name)
            }
            return
        }

        if (wakeCandidate && commandStabilizer.snapshot().isNotBlank()) {
            acceptInlineWakeCommand(hypothesis.raw, finalResult)
            return
        }

        if (finalResult) scheduleRestart() else broadcast("RUNNING", state.name)
    }

    private fun acceptInlineWakeCommand(commandText: String, finalResult: Boolean) {
        val current = commandStabilizer.snapshot()
        val merged = EloWakeParser.mergeCommandContinuation(current, commandText)
        commandStabilizer.accept(listOf(merged, commandText, current))
        lastCommandBuffer = commandStabilizer.snapshot().ifBlank { "-" }
        wakeStatus = "DETECTED"
        handler.removeCallbacks(inlineWakeDispatchRunnable)
        handler.postDelayed(inlineWakeDispatchRunnable, if (finalResult) WAKE_INLINE_FINAL_SETTLE_MS else WAKE_INLINE_PARTIAL_SETTLE_MS)
        broadcast("RUNNING", state.name)
    }

    private fun resetWakeInlineState(clearDebug: Boolean) {
        wakeCandidate = false
        handler.removeCallbacks(wakeOnlySettleRunnable)
        handler.removeCallbacks(inlineWakeDispatchRunnable)
        if (clearDebug) {
            lastRawPartial = "-"
            lastRawFinal = "-"
            lastCommandAfterWake = "-"
            lastCommandBuffer = "-"
            lastDispatchedCommand = "-"
        }
        lastWakeCandidate = "false"
    }

    private fun bestTranscript(texts: List<String>?): String {
        return texts.orEmpty().map { it.trim() }.filter { it.isNotBlank() }.maxByOrNull { it.length }.orEmpty()
    }


    private fun logRawRecognition(texts: List<String>?, finalResult: Boolean) {
        texts.orEmpty().forEachIndexed { index, raw ->
            val label = if (finalResult) "WAKE_FINAL_RAW" else "WAKE_PARTIAL_RAW"
            Log.i("EloWakeService", label + "[" + index + "]=\"" + raw + "\"")
        }
    }
    private fun stripLeadingWake(text: String): String {
        return EloWakeParser.extractCommandAfterWake(text).ifBlank { text.replace(Regex("(?i)^\\s*(elo|hello)[,\\s]+"), "").trim() }
    }

    private fun broadcast(service: String, recognition: String) {
        sendBroadcast(Intent(ACTION_STATUS).setPackage(packageName).apply {
            putExtra(EXTRA_SERVICE, service)
            putExtra(EXTRA_RECOGNITION, recognition)
            putExtra(EXTRA_TRANSCRIPT, lastTranscript)
            putExtra(EXTRA_COMMAND, lastCommand)
            putExtra(EXTRA_ANSWER, lastAnswer)
            putExtra(EXTRA_WAKE, wakeStatus)
            putExtra(EXTRA_ERROR, lastError)
            putExtra(EXTRA_ON_DEVICE, if (onDevice) "SIM" else "NAO")
            putExtra(EXTRA_CHAT_HTTP, lastChatHttp)
            putExtra(EXTRA_CHAT_BODY, lastChatBody)
            putExtra(EXTRA_TTS_HTTP, lastTtsHttp)
            putExtra(EXTRA_TTS_CONTENT_TYPE, lastTtsContentType)
            putExtra(EXTRA_TTS_BYTES, lastTtsBytes)
            putExtra(EXTRA_VOICE, lastVoice)
            putExtra(EXTRA_VOICE_STAGE, lastVoiceStage)
            putExtra(EXTRA_DATA_SOURCE, lastDataSource)
            putExtra(EXTRA_IS_PLAYING, lastIsPlaying)
            putExtra(EXTRA_DURATION, lastDuration)
            putExtra(EXTRA_PLAYER_ERROR, lastPlayerError)
            putExtra(EXTRA_STREAM_MUSIC, lastStreamMusic)
            putExtra(EXTRA_AUDIO_ATTRIBUTES, lastAudioAttributes)
            putExtra(EXTRA_ANSWER_LENGTH, lastAnswerLength)
            putExtra(EXTRA_LATENCY, lastLatency)
            putExtra(EXTRA_RAW_PARTIAL, lastRawPartial)
            putExtra(EXTRA_RAW_FINAL, lastRawFinal)
            putExtra(EXTRA_WAKE_CANDIDATE, lastWakeCandidate)
            putExtra(EXTRA_COMMAND_AFTER_WAKE, lastCommandAfterWake)
            putExtra(EXTRA_COMMAND_BUFFER, lastCommandBuffer)
            putExtra(EXTRA_DISPATCHED_COMMAND, lastDispatchedCommand)
            putExtra(EXTRA_RAW_COMMAND, lastRawCommand)
            putExtra(EXTRA_NORMALIZED_COMMAND, lastNormalizedCommand)
            putExtra(EXTRA_ROUTER, lastRouter)
            putExtra(EXTRA_ROUTER_ACTION, lastRouterAction)
            putExtra(EXTRA_BACKEND_ANSWER, lastBackendAnswer)
            putExtra(EXTRA_TTS_TEXT, lastTtsText)
            putExtra(EXTRA_HISTORY_SIZE, lastHistorySize)
            putExtra(EXTRA_LAST_HISTORY_USER, lastHistoryUser)
            putExtra(EXTRA_LAST_HISTORY_ASSISTANT, lastHistoryAssistant)
            putExtra(EXTRA_FOLLOWUP_DETECTED, lastFollowupDetected)
            putExtra(EXTRA_FOLLOWUP_TOPIC, lastFollowupTopic)
            putExtra(EXTRA_MEDIA_TITLE, lastMediaTitle)
            putExtra(EXTRA_MEDIA_ARTIST, lastMediaArtist)
            putExtra(EXTRA_MEDIA_VIDEO_ID, lastMediaVideoId)
            putExtra(EXTRA_STATE, state.name)
            putExtra(EXTRA_RECOGNITION_RUNNING, recognitionRunning.toString())
            putExtra(EXTRA_RESTART_PENDING, restartPending.toString())
            putExtra(EXTRA_WAKE_START_COUNT, wakeStartCount.toString())
            putExtra(EXTRA_WAKE_RESTART_COUNT, wakeRestartCount.toString())
            putExtra(EXTRA_WAKE_LAST_RESTART_REASON, wakeLastRestartReason)
            putExtra(EXTRA_WAKE_RESTART_INTERVAL_MS, wakeRestartIntervalMs.toString())
            putExtra(EXTRA_WAKE_CONCURRENT_START_COUNT, wakeConcurrentStartCount.toString())
            putExtra(EXTRA_MEDIA_STATE, mediaState.name)
        })
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < 26) return
        val channel = NotificationChannel(CHANNEL_ID, "ELO Wake", NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun updateNotification() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification())
    }

    private fun notification(): Notification {
        val stopIntent = Intent(this, EloWakeService::class.java).setAction(ACTION_STOP)
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("ELO ativo")
            .setContentText(notificationText())
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Desativar", stopPendingIntent)
            .build()
    }

    private fun notificationText(): String = when (state) {
        EloConversationState.WAKE_LISTENING -> "ELO ativo - diga ELO para chamar"
        EloConversationState.COMMAND_LISTENING -> "ELO ouvindo..."
        EloConversationState.PROCESSING -> "ELO processando..."
        EloConversationState.SPEAKING -> "ELO respondendo..."
    }

    private fun errorName(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_NO_MATCH -> "ERROR_NO_MATCH"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "ERROR_SPEECH_TIMEOUT"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "ERROR_RECOGNIZER_BUSY"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "ERROR_INSUFFICIENT_PERMISSIONS"
        SpeechRecognizer.ERROR_NETWORK -> "ERROR_NETWORK"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "ERROR_NETWORK_TIMEOUT"
        else -> "ERROR_" + error
    }

    companion object {
        const val ACTION_START = "br.com.icaroamaral.elo.START"
        const val ACTION_STOP = "br.com.icaroamaral.elo.STOP"
        const val ACTION_TEST_LOCAL_TTS = "br.com.icaroamaral.elo.TEST_LOCAL_TTS"
        const val ACTION_RESTORE_AFTER_BOOT = "br.com.icaroamaral.elo.RESTORE_AFTER_BOOT"
        const val ACTION_STATUS = "br.com.icaroamaral.elo.STATUS"
        const val EXTRA_SERVICE = "service"
        const val EXTRA_RECOGNITION = "recognition"
        const val EXTRA_TRANSCRIPT = "transcript"
        const val EXTRA_COMMAND = "command"
        const val EXTRA_ANSWER = "answer"
        const val EXTRA_WAKE = "wake"
        const val EXTRA_ERROR = "error"
        const val EXTRA_ON_DEVICE = "onDevice"
        const val EXTRA_CHAT_HTTP = "chatHttp"
        const val EXTRA_CHAT_BODY = "chatBody"
        const val EXTRA_TTS_HTTP = "ttsHttp"
        const val EXTRA_TTS_CONTENT_TYPE = "ttsContentType"
        const val EXTRA_TTS_BYTES = "ttsBytes"
        const val EXTRA_VOICE = "voice"
        const val EXTRA_VOICE_STAGE = "voiceStage"
        const val EXTRA_DATA_SOURCE = "dataSource"
        const val EXTRA_IS_PLAYING = "isPlaying"
        const val EXTRA_DURATION = "duration"
        const val EXTRA_PLAYER_ERROR = "playerError"
        const val EXTRA_STREAM_MUSIC = "streamMusic"
        const val EXTRA_AUDIO_ATTRIBUTES = "audioAttributes"
        const val EXTRA_ANSWER_LENGTH = "answerLength"
        const val EXTRA_LATENCY = "latency"
        const val EXTRA_RAW_PARTIAL = "rawPartial"
        const val EXTRA_RAW_FINAL = "rawFinal"
        const val EXTRA_WAKE_CANDIDATE = "wakeCandidate"
        const val EXTRA_COMMAND_AFTER_WAKE = "commandAfterWake"
        const val EXTRA_COMMAND_BUFFER = "commandBuffer"
        const val EXTRA_DISPATCHED_COMMAND = "dispatchedCommand"
        const val EXTRA_RAW_COMMAND = "rawCommand"
        const val EXTRA_NORMALIZED_COMMAND = "normalizedCommand"
        const val EXTRA_ROUTER = "router"
        const val EXTRA_ROUTER_ACTION = "routerAction"
        const val EXTRA_BACKEND_ANSWER = "backendAnswer"
        const val EXTRA_TTS_TEXT = "ttsText"
        const val EXTRA_HISTORY_SIZE = "historySize"
        const val EXTRA_LAST_HISTORY_USER = "lastHistoryUser"
        const val EXTRA_LAST_HISTORY_ASSISTANT = "lastHistoryAssistant"
        const val EXTRA_FOLLOWUP_DETECTED = "followupDetected"
        const val EXTRA_FOLLOWUP_TOPIC = "followupTopic"
        const val EXTRA_MEDIA_TITLE = "mediaTitle"
        const val EXTRA_MEDIA_ARTIST = "mediaArtist"
        const val EXTRA_MEDIA_VIDEO_ID = "mediaVideoId"
        const val EXTRA_STATE = "state"
        const val EXTRA_RECOGNITION_RUNNING = "recognitionRunning"
        const val EXTRA_RESTART_PENDING = "restartPending"
        const val EXTRA_WAKE_START_COUNT = "wakeStartCount"
        const val EXTRA_WAKE_RESTART_COUNT = "wakeRestartCount"
        const val EXTRA_WAKE_LAST_RESTART_REASON = "wakeLastRestartReason"
        const val EXTRA_WAKE_RESTART_INTERVAL_MS = "wakeRestartIntervalMs"
        const val EXTRA_WAKE_CONCURRENT_START_COUNT = "wakeConcurrentStartCount"
        const val EXTRA_MEDIA_STATE = "mediaState"
        private const val CHANNEL_ID = "elo_wake"
        private const val NOTIFICATION_ID = 1001
        private const val COMMAND_TIMEOUT_MS = 8_000L
        private const val PROCESSING_WAKELOCK_TIMEOUT_MS = 120_000L
        private const val PROCESSING_TIMEOUT_MS = 8_000L
        private const val PROCESSING_TIMEOUT_FALLBACK = "Não consegui concluir essa resposta."
        private const val COMMAND_PARTIAL_SETTLE_MS = 1_100L
        private const val COMMAND_FINAL_SETTLE_MS = 450L
        private const val WAKE_CONTINUATION_MS = 900L
        private const val WAKE_INLINE_PARTIAL_SETTLE_MS = 900L
        private const val WAKE_INLINE_FINAL_SETTLE_MS = 250L
        private const val INTERRUPT_READY_TIMEOUT_MS = 1_200L
        private const val WAKE_RESTART_BASE_DELAY_MS = 750L
        private const val WAKE_RESTART_MAX_DELAY_MS = 3_000L
        private val stopWords = setOf("pare", "para", "parar", "chega", "cala")
        private val mediaPauseWords = setOf("pare", "para", "pausa", "pause")
        private val mediaResumeWords = setOf("continue", "continuar", "retome", "volte")
        private val recoverableErrors = setOf(
            SpeechRecognizer.ERROR_NO_MATCH,
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY
        )
    }
}
