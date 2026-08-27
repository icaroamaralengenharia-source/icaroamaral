package br.com.icaroamaral.elo

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var statusText: TextView

    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != EloWakeService.ACTION_STATUS) return
            renderStatus(
                service = intent.getStringExtra(EloWakeService.EXTRA_SERVICE) ?: "-",
                recognition = intent.getStringExtra(EloWakeService.EXTRA_RECOGNITION) ?: "-",
                state = intent.getStringExtra(EloWakeService.EXTRA_STATE) ?: "-",
                recognitionRunning = intent.getStringExtra(EloWakeService.EXTRA_RECOGNITION_RUNNING) ?: "-",
                restartPending = intent.getStringExtra(EloWakeService.EXTRA_RESTART_PENDING) ?: "-",
                wakeStartCount = intent.getStringExtra(EloWakeService.EXTRA_WAKE_START_COUNT) ?: "-",
                wakeRestartCount = intent.getStringExtra(EloWakeService.EXTRA_WAKE_RESTART_COUNT) ?: "-",
                wakeLastRestartReason = intent.getStringExtra(EloWakeService.EXTRA_WAKE_LAST_RESTART_REASON) ?: "-",
                wakeRestartIntervalMs = intent.getStringExtra(EloWakeService.EXTRA_WAKE_RESTART_INTERVAL_MS) ?: "-",
                wakeConcurrentStartCount = intent.getStringExtra(EloWakeService.EXTRA_WAKE_CONCURRENT_START_COUNT) ?: "-",
                mediaState = intent.getStringExtra(EloWakeService.EXTRA_MEDIA_STATE) ?: "-",
                transcript = intent.getStringExtra(EloWakeService.EXTRA_TRANSCRIPT) ?: "-",
                command = intent.getStringExtra(EloWakeService.EXTRA_COMMAND) ?: "-",
                answer = intent.getStringExtra(EloWakeService.EXTRA_ANSWER) ?: "-",
                wake = intent.getStringExtra(EloWakeService.EXTRA_WAKE) ?: "-",
                error = intent.getStringExtra(EloWakeService.EXTRA_ERROR) ?: "none",
                onDevice = intent.getStringExtra(EloWakeService.EXTRA_ON_DEVICE) ?: "-",
                chatHttp = intent.getStringExtra(EloWakeService.EXTRA_CHAT_HTTP) ?: "-",
                chatBody = intent.getStringExtra(EloWakeService.EXTRA_CHAT_BODY) ?: "-",
                ttsHttp = intent.getStringExtra(EloWakeService.EXTRA_TTS_HTTP) ?: "-",
                ttsContentType = intent.getStringExtra(EloWakeService.EXTRA_TTS_CONTENT_TYPE) ?: "-",
                ttsBytes = intent.getStringExtra(EloWakeService.EXTRA_TTS_BYTES) ?: "-",
                voice = intent.getStringExtra(EloWakeService.EXTRA_VOICE) ?: "-",
                voiceStage = intent.getStringExtra(EloWakeService.EXTRA_VOICE_STAGE) ?: "-",
                dataSource = intent.getStringExtra(EloWakeService.EXTRA_DATA_SOURCE) ?: "-",
                isPlaying = intent.getStringExtra(EloWakeService.EXTRA_IS_PLAYING) ?: "-",
                duration = intent.getStringExtra(EloWakeService.EXTRA_DURATION) ?: "-",
                playerError = intent.getStringExtra(EloWakeService.EXTRA_PLAYER_ERROR) ?: "-",
                streamMusic = intent.getStringExtra(EloWakeService.EXTRA_STREAM_MUSIC) ?: "-",
                audioAttributes = intent.getStringExtra(EloWakeService.EXTRA_AUDIO_ATTRIBUTES) ?: "-",
                answerLength = intent.getStringExtra(EloWakeService.EXTRA_ANSWER_LENGTH) ?: "-",
                latency = intent.getStringExtra(EloWakeService.EXTRA_LATENCY) ?: "-",
                rawPartial = intent.getStringExtra(EloWakeService.EXTRA_RAW_PARTIAL) ?: "-",
                rawFinal = intent.getStringExtra(EloWakeService.EXTRA_RAW_FINAL) ?: "-",
                wakeCandidate = intent.getStringExtra(EloWakeService.EXTRA_WAKE_CANDIDATE) ?: "-",
                commandAfterWake = intent.getStringExtra(EloWakeService.EXTRA_COMMAND_AFTER_WAKE) ?: "-",
                commandBuffer = intent.getStringExtra(EloWakeService.EXTRA_COMMAND_BUFFER) ?: "-",
                dispatchedCommand = intent.getStringExtra(EloWakeService.EXTRA_DISPATCHED_COMMAND) ?: "-",
                rawCommand = intent.getStringExtra(EloWakeService.EXTRA_RAW_COMMAND) ?: "-",
                normalizedCommand = intent.getStringExtra(EloWakeService.EXTRA_NORMALIZED_COMMAND) ?: "-",
                router = intent.getStringExtra(EloWakeService.EXTRA_ROUTER) ?: "-",
                routerAction = intent.getStringExtra(EloWakeService.EXTRA_ROUTER_ACTION) ?: "-",
                backendAnswer = intent.getStringExtra(EloWakeService.EXTRA_BACKEND_ANSWER) ?: "-",
                ttsText = intent.getStringExtra(EloWakeService.EXTRA_TTS_TEXT) ?: "-",
                historySize = intent.getStringExtra(EloWakeService.EXTRA_HISTORY_SIZE) ?: "-",
                lastHistoryUser = intent.getStringExtra(EloWakeService.EXTRA_LAST_HISTORY_USER) ?: "-",
                lastHistoryAssistant = intent.getStringExtra(EloWakeService.EXTRA_LAST_HISTORY_ASSISTANT) ?: "-",
                followupDetected = intent.getStringExtra(EloWakeService.EXTRA_FOLLOWUP_DETECTED) ?: "-",
                followupTopic = intent.getStringExtra(EloWakeService.EXTRA_FOLLOWUP_TOPIC) ?: "-",
                mediaTitle = intent.getStringExtra(EloWakeService.EXTRA_MEDIA_TITLE) ?: "-",
                mediaArtist = intent.getStringExtra(EloWakeService.EXTRA_MEDIA_ARTIST) ?: "-",
                mediaVideoId = intent.getStringExtra(EloWakeService.EXTRA_MEDIA_VIDEO_ID) ?: "-"
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 56, 40, 40)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }

        val title = TextView(this).apply {
            text = "ELO Android Wake Test"
            textSize = 24f
        }
        val activate = Button(this).apply { text = "ATIVAR ELO" }
        val testLocalTts = Button(this).apply { text = "TESTAR TTS LOCAL" }
        val battery = Button(this).apply { text = "BATERIA / SEGUNDO PLANO" }
        val deactivate = Button(this).apply { text = "DESATIVAR" }
        statusText = TextView(this).apply {
            textSize = 14f
            text = initialStatusText()
        }

        root.addView(title)
        root.addView(activate)
        root.addView(testLocalTts)
        root.addView(battery)
        root.addView(deactivate)
        root.addView(statusText)
        setContentView(root)

        activate.setOnClickListener { requestMicThenStart() }
        testLocalTts.setOnClickListener { startTestLocalTts() }
        battery.setOnClickListener { openBatterySettings() }
        deactivate.setOnClickListener { startService(Intent(this, EloWakeService::class.java).setAction(EloWakeService.ACTION_STOP)) }
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(EloWakeService.ACTION_STATUS)
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED) else {
            @Suppress("DEPRECATION")
            registerReceiver(statusReceiver, filter)
        }
    }

    override fun onStop() {
        super.onStop()
        runCatching { unregisterReceiver(statusReceiver) }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_AUDIO && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            startWakeService()
        } else {
            statusText.text = "Service: STOPPED\nLast error: RECORD_AUDIO denied"
        }
    }

    private fun requestMicThenStart() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            startWakeService()
            return
        }
        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_AUDIO)
    }

    private fun startWakeService() {
        val intent = Intent(this, EloWakeService::class.java).setAction(EloWakeService.ACTION_START)
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent) else startService(intent)
    }

    private fun startTestLocalTts() {
        val intent = Intent(this, EloWakeService::class.java).setAction(EloWakeService.ACTION_TEST_LOCAL_TTS)
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent) else startService(intent)
    }

    private fun openBatterySettings() {
        val ignored = EloServiceSettings.isBatteryOptimizationIgnored(this)
        val guidance = "Para manter o ELO ativo com a tela bloqueada, permita execucao em segundo plano e remova restricoes de bateria para o app."
        statusText.text = initialStatusText() + "\nBattery optimization ignored: " + ignored + "\n" + guidance
        runCatching {
            startActivity(EloServiceSettings.batteryOptimizationSettingsIntent())
        }.onFailure {
            statusText.text = statusText.text.toString() + "\nBattery settings error: " + (it.message ?: it.javaClass.simpleName)
        }
    }

    private fun renderStatus(
        service: String,
        recognition: String,
        state: String,
        recognitionRunning: String,
        restartPending: String,
        wakeStartCount: String,
        wakeRestartCount: String,
        wakeLastRestartReason: String,
        wakeRestartIntervalMs: String,
        wakeConcurrentStartCount: String,
        mediaState: String,
        transcript: String,
        command: String,
        answer: String,
        wake: String,
        error: String,
        onDevice: String,
        chatHttp: String,
        chatBody: String,
        ttsHttp: String,
        ttsContentType: String,
        ttsBytes: String,
        voice: String,
        voiceStage: String,
        dataSource: String,
        isPlaying: String,
        duration: String,
        playerError: String,
        streamMusic: String,
        audioAttributes: String,
        answerLength: String,
        latency: String,
        rawPartial: String,
        rawFinal: String,
        wakeCandidate: String,
        commandAfterWake: String,
        commandBuffer: String,
        dispatchedCommand: String,
        rawCommand: String,
        normalizedCommand: String,
        router: String,
        routerAction: String,
        backendAnswer: String,
        ttsText: String,
        historySize: String,
        lastHistoryUser: String,
        lastHistoryAssistant: String,
        followupDetected: String,
        followupTopic: String,
        mediaTitle: String,
        mediaArtist: String,
        mediaVideoId: String
    ) {
        statusText.text = "Service: " + service +
            "\nState: " + state +
            "\nrecognitionRunning: " + recognitionRunning +
            "\nrestartPending: " + restartPending +
           
            "\nwakeStartCount: " + wakeStartCount +
            "\nwakeRestartCount: " + wakeRestartCount +
            "\nwakeLastRestartReason: " + wakeLastRestartReason +
            "\nwakeRestartIntervalMs: " + wakeRestartIntervalMs +
            "\nwakeConcurrentStartCount: " + wakeConcurrentStartCount +
            "\nMEDIA_STATE: " + mediaState +
            "\nRecognition: " + recognition +
            "\nLast transcript: " + transcript +
            "\nLast command: " + command +
            "\nRAW PARTIAL: " + rawPartial +
            "\nRAW FINAL: " + rawFinal +
            "\nWAKE CANDIDATE: " + wakeCandidate +
            "\nCOMMAND AFTER WAKE: " + commandAfterWake +
            "\nCOMMAND BUFFER: " + commandBuffer +
            "\nDISPATCHED COMMAND: " + dispatchedCommand +
            "\nRAW COMMAND: " + rawCommand +
            "\nNORMALIZED COMMAND: " + normalizedCommand +
            "\nROUTER: " + router +
            "\nROUTER ACTION: " + routerAction +
            "\nBACKEND ANSWER: " + backendAnswer +
            "\nTTS TEXT: " + ttsText +
            "\nHISTORY SIZE: " + historySize +
            "\nLAST USER: " + lastHistoryUser +
            "\nLAST ASSISTANT: " + lastHistoryAssistant +
            "\nFOLLOWUP DETECTED: " + followupDetected +
            "\nFOLLOWUP TOPIC: " + followupTopic +
            "\nMEDIA TITLE: " + mediaTitle +
            "\nMEDIA ARTIST: " + mediaArtist +
            "\nMEDIA VIDEO ID: " + mediaVideoId +
            "\nCHAT HTTP: " + chatHttp +
            "\nCHAT BODY: " + chatBody +
            "\nLast answer: " + answer +
            "\nANSWER LENGTH: " + answerLength +
            "\nLATENCY: " + latency +
            "\nTTS HTTP: " + ttsHttp +
            "\nTTS CONTENT-TYPE: " + ttsContentType +
            "\nTTS BYTES: " + ttsBytes +
            "\nVOICE_STAGE: " + voiceStage +
            "\nVoice mode: " + voice +
            "\nDataSource: " + dataSource +
            "\nMediaPlayer.isPlaying: " + isPlaying +
            "\nDuration: " + duration +
            "\nPlayer error: " + playerError +
            "\nSTREAM_MUSIC: " + streamMusic +
            "\nAudioAttributes: " + audioAttributes +
            "\nWake: " + wake +
            "\nLast error: " + error +
            "\nON_DEVICE: " + onDevice
    }

    private fun initialStatusText(): String {
        return "Service: STOPPED\nState: -\nrecognitionRunning: -\nrestartPending: -\nwakeStartCount: -\nwakeRestartCount: -\nwakeLastRestartReason: -\nwakeRestartIntervalMs: -\nwakeConcurrentStartCount: -\nMEDIA_STATE: -\nRecognition: -\nLast transcript: -\nLast command: -\nRAW PARTIAL: -\nRAW FINAL: -\nWAKE CANDIDATE: -\nCOMMAND AFTER WAKE: -\nCOMMAND BUFFER: -\nDISPATCHED COMMAND: -\nRAW COMMAND: -\nNORMALIZED COMMAND: -\nROUTER: -\nROUTER ACTION: -\nBACKEND ANSWER: -\nTTS TEXT: -\nHISTORY SIZE: -\nLAST USER: -\nLAST ASSISTANT: -\nFOLLOWUP DETECTED: -\nFOLLOWUP TOPIC: -\nMEDIA TITLE: -\nMEDIA ARTIST: -\nMEDIA VIDEO ID: -\nCHAT HTTP: -\nCHAT BODY: -\nLast answer: -\nANSWER LENGTH: -\nLATENCY: -\nTTS HTTP: -\nTTS CONTENT-TYPE: -\nTTS BYTES: -\nVOICE_STAGE: -\nVoice mode: -\nDataSource: -\nMediaPlayer.isPlaying: -\nDuration: -\nPlayer error: -\nSTREAM_MUSIC: -\nAudioAttributes: -\nWake: -\nLast error: none\nON_DEVICE: -"
    }

    companion object {
        private const val REQ_AUDIO = 10
    }
}
