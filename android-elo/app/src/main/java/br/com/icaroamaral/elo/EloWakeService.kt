package br.com.icaroamaral.elo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.text.Normalizer
import java.util.Locale

class EloWakeService : Service(), RecognitionListener {
    private val handler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var serviceEnabled = false
    private var recognitionRunning = false
    private var restartPending = false
    private var onDevice = false
    private var lastTranscript = "-"
    private var wakeStatus = "-"
    private var lastError = "none"

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopWake()
            else -> startWake()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopWake()
        super.onDestroy()
    }

    private fun startWake() {
        serviceEnabled = true
        lastError = "none"
        startForeground(NOTIFICATION_ID, notification())
        ensureRecognizer()
        broadcast("RUNNING", "STARTING")
        scheduleRestart(150)
    }

    private fun stopWake() {
        serviceEnabled = false
        restartPending = false
        handler.removeCallbacksAndMessages(null)
        recognitionRunning = false
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
        broadcast("STOPPED", "STOPPED")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun ensureRecognizer() {
        if (recognizer != null) return
        onDevice = Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(this)
        recognizer = if (onDevice && Build.VERSION.SDK_INT >= 31) {
            SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
        } else {
            SpeechRecognizer.createSpeechRecognizer(this)
        }
        recognizer?.setRecognitionListener(this)
    }

    private fun startListening() {
        if (!serviceEnabled || recognitionRunning) return
        ensureRecognizer()
        recognitionRunning = true
        restartPending = false
        wakeStatus = "-"
        lastError = "none"
        broadcast("RUNNING", "LISTENING")
        recognizer?.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
        })
    }

    private fun scheduleRestart(delayMs: Long = 350) {
        if (!serviceEnabled || restartPending) return
        restartPending = true
        handler.postDelayed({
            restartPending = false
            startListening()
        }, delayMs)
    }

    override fun onReadyForSpeech(params: android.os.Bundle?) {
        recognitionRunning = true
        broadcast("RUNNING", "LISTENING")
    }

    override fun onBeginningOfSpeech() {
        broadcast("RUNNING", "PROCESSING")
    }

    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit

    override fun onEndOfSpeech() {
        recognitionRunning = false
        broadcast("RUNNING", "PROCESSING")
    }

    override fun onError(error: Int) {
        recognitionRunning = false
        lastError = errorName(error)
        broadcast("RUNNING", "ERROR")
        if (error in recoverableErrors) scheduleRestart()
    }

    override fun onResults(results: android.os.Bundle?) {
        recognitionRunning = false
        handleTexts(results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION))
        scheduleRestart()
    }

    override fun onPartialResults(partialResults: android.os.Bundle?) {
        handleTexts(partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION))
    }

    override fun onEvent(eventType: Int, params: android.os.Bundle?) = Unit

    private fun handleTexts(texts: List<String>?) {
        val text = texts?.firstOrNull().orEmpty()
        if (text.isBlank()) return
        lastTranscript = text
        if (containsWake(text)) {
            wakeStatus = "DETECTED"
        }
        broadcast("RUNNING", if (recognitionRunning) "LISTENING" else "PROCESSING")
    }

    private fun containsWake(text: String): Boolean {
        val normalized = Normalizer.normalize(text.lowercase(Locale.ROOT), Normalizer.Form.NFD)
            .replace("\\p{Mn}+".toRegex(), "")
            .replace("[^a-z0-9\\s]".toRegex(), " ")
            .replace("\\s+".toRegex(), " ")
            .trim()
        return normalized.split(" ").any { it == "elo" || it == "hello" }
    }

    private fun broadcast(service: String, recognition: String) {
        sendBroadcast(Intent(ACTION_STATUS).setPackage(packageName).apply {
            putExtra(EXTRA_SERVICE, service)
            putExtra(EXTRA_RECOGNITION, recognition)
            putExtra(EXTRA_TRANSCRIPT, lastTranscript)
            putExtra(EXTRA_WAKE, wakeStatus)
            putExtra(EXTRA_ERROR, lastError)
            putExtra(EXTRA_ON_DEVICE, if (onDevice) "SIM" else "NAO")
        })
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < 26) return
        val channel = NotificationChannel(CHANNEL_ID, "ELO Wake", NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
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
            .setContentText("Microfone aguardando comando")
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Desativar", stopPendingIntent)
            .build()
    }

    private fun errorName(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_NO_MATCH -> "ERROR_NO_MATCH"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "ERROR_SPEECH_TIMEOUT"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "ERROR_RECOGNIZER_BUSY"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "ERROR_INSUFFICIENT_PERMISSIONS"
        SpeechRecognizer.ERROR_NETWORK -> "ERROR_NETWORK"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "ERROR_NETWORK_TIMEOUT"
        else -> "ERROR_$error"
    }

    companion object {
        const val ACTION_START = "br.com.icaroamaral.elo.START"
        const val ACTION_STOP = "br.com.icaroamaral.elo.STOP"
        const val ACTION_STATUS = "br.com.icaroamaral.elo.STATUS"
        const val EXTRA_SERVICE = "service"
        const val EXTRA_RECOGNITION = "recognition"
        const val EXTRA_TRANSCRIPT = "transcript"
        const val EXTRA_WAKE = "wake"
        const val EXTRA_ERROR = "error"
        const val EXTRA_ON_DEVICE = "onDevice"
        private const val CHANNEL_ID = "elo_wake"
        private const val NOTIFICATION_ID = 1001
        private val recoverableErrors = setOf(
            SpeechRecognizer.ERROR_NO_MATCH,
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY
        )
    }
}
