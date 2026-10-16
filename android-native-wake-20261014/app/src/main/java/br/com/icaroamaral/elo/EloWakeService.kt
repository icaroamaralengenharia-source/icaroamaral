package br.com.icaroamaral.elo

import android.Manifest
import android.app.*
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.*
import android.util.Log
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.UUID

/** Existing official service identity, now hosting the single native session coordinator. */
class EloWakeService : Service(), EloVoiceCoordinator.Ports, EloVoskAudioEngine.Listener, EloConversationRecognizer.Listener {
    private val main = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private val client = EloCanonicalVoiceClient()
    private var requestTask: Future<*>? = null
    private lateinit var coordinator: EloVoiceCoordinator
    private lateinit var engine: EloVoskAudioEngine
    private lateinit var conversation: EloConversationRecognizer
    private var peakCaptureOwners = 0
    private lateinit var voice: EloVoicePlayer
    private lateinit var audio: AudioManager
    private lateinit var music: EloNativeMusicGateway
    private var focusSerial = 0L
    private var focusRequestId = 0L
    private var focus: AudioFocusRequest? = null
    private val audioSessionId = UUID.randomUUID().toString().take(8)
    private var wakeLock: PowerManager.WakeLock? = null
    private var alive = true
    private var preparing = false
    private var activation = 0L
    private var lastVoiceStage = "IDLE"
    private var expiry: Runnable? = null
    private val receiver: (String) -> Unit = { action ->
        if (Looper.myLooper() == Looper.getMainLooper()) perform(action)
        else main.post { perform(action) }
    }
    private val renewWakeLock = object : Runnable {
        override fun run() {
            if (!alive || !coordinator.snapshot().enabled) return
            if (wakeLock?.isHeld != true) wakeLock?.acquire(10 * 60_000L)
            main.postDelayed(this, 5 * 60_000L)
        }
    }
    override fun onCreate() {
        super.onCreate()
        audio = getSystemService(AUDIO_SERVICE) as AudioManager
        engine = EloVoskAudioEngine(this, this)
        conversation = EloConversationRecognizer(this, this) { event, lease ->
            audioTrace("recognizer_$event", "recognizerLease" to lease)
        }
        voice = EloVoicePlayer(this, ttsClient = EloTtsClient(
            payload = { text -> EloNeuralVoiceProfile.payload(text, EloNativeVoiceSession.current()?.voice.orEmpty()) },
            accessToken = { EloNativeVoiceSession.current()?.token }
        ), neuralOnly = true, manageAudioFocus = false)
        val silence = getSharedPreferences(EloServiceSettings.PREFS_NAME, MODE_PRIVATE)
            .getLong("elo_brain_silence_ms", 30_000).coerceIn(10_000, 120_000)
        coordinator = EloVoiceCoordinator(this, silence)
        music = EloNativeMusicGateway { turn, generation -> coordinator.yieldForMusic(turn, generation) }
        EloNativeBrainRegistry.command = receiver
        EloNativeBrainRegistry.readMessage = { text -> alive && coordinator.readMessage(text) }
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
            NotificationChannel(CHANNEL, "Chamado ELO", NotificationManager.IMPORTANCE_LOW))
        wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, packageName + ":EloBrain")
            .apply { setReferenceCounted(false) }
        audioTrace("service_created")
    }
    /** Technical-only trace: no audio, transcript, credential, or message content is included. */
    private fun audioTrace(event: String, vararg fields: Pair<String, Any?>) {
        val snapshot = if (::coordinator.isInitialized) coordinator.snapshot() else null
        val entry = JSONObject()
            .put("wallTimeMs", System.currentTimeMillis())
            .put("elapsedRealtimeNanos", SystemClock.elapsedRealtimeNanos())
            .put("sessionId", audioSessionId)
            .put("event", event)
            .put("generation", snapshot?.generation)
            .put("turn", snapshot?.turn)
            .put("captureLease", snapshot?.captureLease)
            .put("state", snapshot?.state?.name)
            .put("owner", snapshot?.owner?.name)
            .put("focusRequestPresent", focus != null)
            .put("focusRequestId", focusRequestId)
        fields.forEach { entry.put(it.first, it.second) }
        Log.i(AUDIO_TRACE_TAG, entry.toString())
    }
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action != ACTION_START) {
            perform(intent?.action ?: ACTION_STOP)
            return START_NOT_STICKY
        }
        if (!EloNativeBrainRegistry.activityVisible || !intent.getBooleanExtra(EXTRA_VISIBLE_ACTIVATION, false) ||
            !sessionReady() || checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED ||
            (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)) {
            coordinator.disable("VISIBLE_ACTIVATION_AND_PERMISSIONS_REQUIRED")
            return START_NOT_STICKY
        }
        if (coordinator.snapshot().enabled || preparing) return START_NOT_STICKY
        val revision = ++activation
        preparing = true
        EloNativeBrainRegistry.preparing = true
        try {
            if (Build.VERSION.SDK_INT >= 29)
                startForeground(NOTIFICATION_ID, notification("Preparando detector local"), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            else startForeground(NOTIFICATION_ID, notification("Preparando detector local"))
        } catch (_: SecurityException) {
            preparing = false
            EloNativeBrainRegistry.preparing = false
            coordinator.disable("FOREGROUND_PERMISSION_REJECTED")
            return START_NOT_STICKY
        }
        engine.prepare { ok ->
            if (!alive || revision != activation) { engine.close(); return@prepare }
            preparing = false
            EloNativeBrainRegistry.preparing = false
            if (!ok) { coordinator.disable("LOCAL_MODEL_MISSING_OR_INVALID"); return@prepare }
            if (!coordinator.enable()) return@prepare
            EloServiceSettings.setServiceEnabled(this, true)
            main.post(renewWakeLock)
            val context = EloNativeVoiceSession.current() ?: return@prepare
            expiry = Runnable { coordinator.disable("SESSION_EXPIRED") }.also {
                main.postDelayed(it, (context.expiresAt * 1000 - System.currentTimeMillis() - 30_000).coerceAtLeast(1))
            }
        }
        // Process death, boot and force-stop never silently restart microphone capture.
        return START_NOT_STICKY
    }
    private fun perform(action: String) {
        if (!alive) return
        when (action) {
            ACTION_STOP, ACTION_RESTORE_AFTER_BOOT -> {
                activation += 1; preparing = false; coordinator.disable("EXPLICIT_DISABLE")
                EloNativeBrainRegistry.preparing = false
            }
            ACTION_END_CONVERSATION -> coordinator.endConversation()
            ACTION_INTERRUPT -> coordinator.interrupt()
            ACTION_SUSPEND -> coordinator.suspend("MANUAL_WEB_OUTPUT")
            ACTION_RESUME -> coordinator.resumeWake()
        }
    }
    override fun sessionReady() = EloNativeVoiceSession.current() != null
    override fun startCapture(owner: EloVoiceCoordinator.Owner, lease: Long): Boolean {
        audioTrace("capture_start_requested", "captureOwner" to owner.name, "lease" to lease)
        if (engine.activeWorkers() != 0 || conversation.active || conversation.isStopping()) return false
        val started = if (owner == EloVoiceCoordinator.Owner.WAKE) engine.start(owner, lease)
            else if (owner == EloVoiceCoordinator.Owner.BRAIN) conversation.start(lease) else false
        if (started) peakCaptureOwners = maxOf(peakCaptureOwners, 1)
        audioTrace("capture_start_result", "captureOwner" to owner.name, "lease" to lease, "started" to started)
        return started
    }
    override fun waitsForCaptureReady() = true
    override fun stopCapture() = !conversation.active && engine.stop()
    override fun stopCaptureAsync(done: (Boolean) -> Unit) {
        audioTrace("capture_release_requested", "wakeActive" to engine.isRecording(),
            "recognizerActive" to conversation.active, "recognizerStopping" to conversation.isStopping())
        val localReleased = engine.stop()
        conversation.stop { released ->
            audioTrace("capture_release_result", "wakeReleased" to localReleased, "recognizerReleased" to released)
            done(localReleased && released)
        }
    }
    override fun stopOutput() { voice.stop() }
    override fun cancelRequest() { client.cancel(); requestTask?.cancel(true); requestTask = null; music.cancel() }
    override fun pauseMusic() { EloMusicPlayerCoordinatorRegistry.pauseActivePlayer() }
    override fun acquireOutputFocus(): Boolean {
        if (focus != null) {
            audioTrace("focus_request_reused", "purpose" to "voice_output")
            return true
        }
        val focusRevision = ++focusSerial
        audioTrace("focus_request_begin", "requestId" to focusRevision, "purpose" to "voice_output",
            "gain" to "AUDIOFOCUS_GAIN_TRANSIENT")
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setOnAudioFocusChangeListener({ change ->
                audioTrace("focus_callback_received", "requestId" to focusRevision,
                    "change" to audioFocusChangeName(change))
                main.post {
                    if (focusRevision != focusSerial) {
                        audioTrace("focus_callback_ignored_stale", "requestId" to focusRevision,
                            "change" to audioFocusChangeName(change))
                        return@post
                    }
                    audioTrace("focus_callback_applied", "requestId" to focusRevision,
                        "change" to audioFocusChangeName(change))
                    if (change == AudioManager.AUDIOFOCUS_GAIN) coordinator.focusReturned()
                    else if (change == AudioManager.AUDIOFOCUS_LOSS) {
                        audioTrace("focus_loss_suspends_session", "requestId" to focusRevision,
                            "change" to audioFocusChangeName(change))
                        coordinator.suspend("AUDIO_FOCUS_LOST")
                    } else if (change in listOf(AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
                            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK)) {
                        audioTrace("focus_loss_waits_for_gain", "requestId" to focusRevision,
                            "change" to audioFocusChangeName(change))
                        coordinator.suspendForTransientAudioFocusLoss("AUDIO_FOCUS_LOST")
                    }
                }
            }, main).build()
        val result = audio.requestAudioFocus(request)
        audioTrace("focus_request_result", "requestId" to focusRevision,
            "result" to audioFocusResultName(result), "granted" to (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED))
        if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) return false
        focus = request
        focusRequestId = focusRevision
        return true
    }
    override fun releaseOutputFocus(reason: String) {
        val request = focus
        val requestId = focusRequestId
        focusSerial += 1
        audioTrace("focus_release_requested", "requestId" to requestId, "reason" to reason, "held" to (request != null))
        val result = request?.let { audio.abandonAudioFocusRequest(it) }
        focus = null; focusRequestId = 0L
        audioTrace("focus_release_result", "requestId" to requestId, "reason" to reason,
            "abandonResult" to result?.let(::audioFocusResultName))
    }
    private fun audioFocusChangeName(change: Int) = when (change) {
        AudioManager.AUDIOFOCUS_GAIN -> "GAIN"
        AudioManager.AUDIOFOCUS_LOSS -> "LOSS"
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> "LOSS_TRANSIENT"
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> "LOSS_TRANSIENT_CAN_DUCK"
        else -> "UNKNOWN_$change"
    }
    private fun audioFocusResultName(result: Int) = when (result) {
        AudioManager.AUDIOFOCUS_REQUEST_GRANTED -> "GRANTED"
        AudioManager.AUDIOFOCUS_REQUEST_DELAYED -> "DELAYED"
        AudioManager.AUDIOFOCUS_REQUEST_FAILED -> "FAILED"
        else -> "UNKNOWN_$result"
    }
    override fun request(turn: Long, generation: Long, text: String) {
        val context = EloNativeVoiceSession.current()
        if (context == null) { coordinator.requestFailed(turn, generation, "SESSION_REQUIRED"); return }
        requestTask = executor.submit {
            try {
                var mediaPlayed = false
                val answer = client.ask(context, text) { command ->
                    music.execute(command, turn, generation).also { mediaPlayed = it?.played == true }
                }
                main.post {
                    if (alive) {
                        if (mediaPlayed) coordinator.mediaReady(turn, generation)
                        else coordinator.answerReady(turn, generation, answer)
                    }
                }
            } catch (failure: Exception) {
                val code = (failure as? EloNativeVoiceFailure)?.code ?: "REQUEST_FAILED"
                main.post { if (alive) coordinator.requestFailed(turn, generation, code) }
            }
        }
    }
    override fun speak(generation: Long, text: String) {
        audioTrace("tts_start", "outputGeneration" to generation, "neuralOnly" to true)
        var neural = false
        var failed = false
        voice.speak(text, onStatus = { report ->
            if (alive && coordinator.snapshot().generation == generation) {
                lastVoiceStage = report.voiceStage
                audioTrace("tts_status", "outputGeneration" to generation, "voiceStage" to report.voiceStage,
                    "dataSource" to report.dataSource)
                if (report.voiceStage == "PLAYING" && report.dataSource == "CACHE_FILE") neural = true
                if (report.voiceStage in listOf("NEURAL_REQUIRED", "WATCHDOG_NEURAL_FAILED")) failed = true
                if (report.voiceStage.startsWith("AUDIO_FOCUS_LOSS")) coordinator.suspend("AUDIO_FOCUS_LOST")
            }
        }, onDone = { main.post {
            if (alive) {
                audioTrace("tts_done_callback", "outputGeneration" to generation, "neural" to neural, "failed" to failed)
                coordinator.outputDone(generation, neural && !failed)
            }
        } })
    }
    override fun later(ms: Long, action: () -> Unit): EloVoiceCoordinator.Cancel {
        val runnable = Runnable { if (alive) action() }
        main.postDelayed(runnable, ms)
        return EloVoiceCoordinator.Cancel { main.removeCallbacks(runnable) }
    }
    override fun changed(snapshot: EloVoiceCoordinator.Snapshot) {
        audioTrace("coordinator_state", "publishedState" to snapshot.state.name,
            "publishedReason" to snapshot.reason, "publishedOwner" to snapshot.owner.name)
        if (::music.isInitialized && snapshot.state in setOf(EloVoiceCoordinator.State.RETURN_TO_WAKE, EloVoiceCoordinator.State.WAKE_DISABLED)) music.clearPending()
        EloNativeBrainRegistry.publish(snapshot, engine.ready(), maxOf(peakCaptureOwners, engine.peakWorkers))
        if (snapshot.enabled) {
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
                .notify(NOTIFICATION_ID, notification(label(snapshot)))
        } else if (snapshot.state == EloVoiceCoordinator.State.WAKE_DISABLED && !preparing) {
            EloServiceSettings.setServiceEnabled(this, false)
            EloNativeVoiceSession.clear()
            expiry?.let { main.removeCallbacks(it) }; expiry = null
            main.removeCallbacks(renewWakeLock)
            if (wakeLock?.isHeld == true) wakeLock?.release()
            stopForeground(STOP_FOREGROUND_REMOVE); stopSelf()
        }
    }
    override fun wake(lease: Long, continuationConsumed: Boolean) {
        audioTrace("wake_detected", "lease" to lease, "continuationConsumed" to continuationConsumed)
        coordinator.wakeDetected(lease, continuationConsumed)
    }
    override fun ready(lease: Long) {
        audioTrace("capture_ready_callback", "lease" to lease)
        coordinator.captureReady(lease)
    }
    override fun empty(lease: Long) {
        audioTrace("recognizer_empty_callback", "lease" to lease)
        val s = coordinator.snapshot()
        if (s.owner == EloVoiceCoordinator.Owner.BRAIN && s.captureLease == lease) coordinator.captureEmpty(lease)
    }
    override fun partial(lease: Long, text: String) {
        val state = coordinator.snapshot()
        if (state.owner != EloVoiceCoordinator.Owner.BRAIN || state.captureLease != lease) return
        coordinator.partial(lease, text.isNotBlank())
        EloNativeBrainRegistry.transcript(text, false)
    }
    override fun final(lease: Long, text: String) {
        audioTrace("recognizer_final_callback", "lease" to lease, "transcriptPresent" to text.isNotBlank())
        val state = coordinator.snapshot()
        if (state.owner != EloVoiceCoordinator.Owner.BRAIN || state.captureLease != lease) return
        EloNativeBrainRegistry.transcript(text, true)
        coordinator.heard(lease, text)
    }
    override fun failed(lease: Long, reason: String) {
        audioTrace("recognizer_failed_callback", "lease" to lease, "reason" to reason)
        coordinator.captureFailed(lease, reason)
    }
    private fun label(s: EloVoiceCoordinator.Snapshot) = when (s.state) {
        EloVoiceCoordinator.State.WAKE_LISTENING -> "Aguardando você chamar ELO"
        EloVoiceCoordinator.State.BRAIN_LISTENING -> if (s.reason == "CAPTURE_STARTING") "Abrindo microfone" else if (s.reason == "CAPTURE_RELEASING") "Finalizando escuta" else "Ouvindo sua conversa"
        EloVoiceCoordinator.State.PROCESSING -> "Preparando resposta"
        EloVoiceCoordinator.State.BRAIN_SPEAKING -> "Respondendo por voz"
        EloVoiceCoordinator.State.SUSPENDED -> "Escuta suspensa. Abra o ELO para retomar"
        else -> "Chamado ELO ativo"
    }
    private fun action(label: String, action: String, request: Int): Notification.Action {
        val pending = PendingIntent.getService(this, request, Intent(this, EloWakeService::class.java).setAction(action),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return Notification.Action.Builder(android.R.drawable.ic_media_pause, label, pending).build()
    }
    private fun notification(text: String): Notification {
        val open = PendingIntent.getActivity(this, 10, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("ELO").setContentText(text).setContentIntent(open)
            .setOngoing(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PRIVATE)
            .addAction(action("Interromper", ACTION_INTERRUPT, 11))
            .addAction(action("Encerrar conversa", ACTION_END_CONVERSATION, 12))
            .addAction(action("Desativar", ACTION_STOP, 13)).build()
    }
    override fun onTaskRemoved(rootIntent: Intent?) { perform(ACTION_STOP); super.onTaskRemoved(rootIntent) }
    override fun dump(fd: java.io.FileDescriptor?, writer: java.io.PrintWriter, args: Array<String>?) {
        writer.println(EloNativeBrainRegistry.status())
        writer.println(org.json.JSONObject().put("activeCaptureWorkers", engine.activeWorkers())
            .put("recording", engine.isRecording()).put("voiceStage", lastVoiceStage)
            .put("activityVisible", EloNativeBrainRegistry.activityVisible).put("neuralRequired", true))
        writer.println(org.json.JSONObject().put("musicDecision", music.decision).put("musicPlayed", music.played))
        writer.println(org.json.JSONObject().put("conversationRecognizer", "ANDROID_SYSTEM")
            .put("conversationCaptureActive", conversation.active).put("conversationReady", conversation.ready)
            .put("conversationReleasing", conversation.isStopping()).put("peakCaptureOwners", peakCaptureOwners)
            .put("screenInteractive", (getSystemService(POWER_SERVICE) as PowerManager).isInteractive)
            .put("keyguardLocked", (getSystemService(KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked))
    }
    override fun onDestroy() {
        audioTrace("service_destroying")
        activation += 1; preparing = false
        EloNativeBrainRegistry.preparing = false
        coordinator.disable("SERVICE_DESTROYED")
        alive = false
        if (EloNativeBrainRegistry.command === receiver) EloNativeBrainRegistry.command = null
        EloNativeBrainRegistry.readMessage = null
        main.removeCallbacksAndMessages(null)
        conversation.close(); engine.close(); voice.shutdown(); client.cancel(); music.clear(); executor.shutdownNow()
        releaseOutputFocus("SERVICE_DESTROYED"); EloNativeVoiceSession.clear()
        if (wakeLock?.isHeld == true) wakeLock?.release()
        super.onDestroy()
    }
    companion object {
        const val ACTION_START = "br.com.icaroamaral.elo.START"
        const val ACTION_STOP = "br.com.icaroamaral.elo.STOP"
        const val ACTION_RESTORE_AFTER_BOOT = "br.com.icaroamaral.elo.RESTORE_AFTER_BOOT"
        const val ACTION_TEST_LOCAL_TTS = "br.com.icaroamaral.elo.TEST_LOCAL_TTS"
        const val ACTION_STATUS = "br.com.icaroamaral.elo.STATUS"
        const val ACTION_END_CONVERSATION = "br.com.icaroamaral.elo.BRAIN_END"
        const val ACTION_INTERRUPT = "br.com.icaroamaral.elo.BRAIN_INTERRUPT"
        const val ACTION_SUSPEND = "br.com.icaroamaral.elo.BRAIN_SUSPEND"
        const val ACTION_RESUME = "br.com.icaroamaral.elo.BRAIN_RESUME"
        const val EXTRA_VISIBLE_ACTIVATION = "elo_visible_activation"
        private const val CHANNEL = "elo_brain_wake_v1"
        private const val NOTIFICATION_ID = 208
        private const val AUDIO_TRACE_TAG = "ELO_AUDIO_FOCUS"
    }
}
