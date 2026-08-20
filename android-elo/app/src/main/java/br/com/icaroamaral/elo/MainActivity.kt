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
                transcript = intent.getStringExtra(EloWakeService.EXTRA_TRANSCRIPT) ?: "-",
                wake = intent.getStringExtra(EloWakeService.EXTRA_WAKE) ?: "-",
                error = intent.getStringExtra(EloWakeService.EXTRA_ERROR) ?: "none",
                onDevice = intent.getStringExtra(EloWakeService.EXTRA_ON_DEVICE) ?: "-"
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 56, 40, 40)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        val title = TextView(this).apply {
            text = "ELO Android Wake Test"
            textSize = 24f
        }
        val activate = Button(this).apply { text = "ATIVAR ELO" }
        val deactivate = Button(this).apply { text = "DESATIVAR" }
        statusText = TextView(this).apply {
            textSize = 16f
            text = "Service: STOPPED\nRecognition: -\nLast transcript: -\nWake: -\nError: none\nON_DEVICE: -"
        }

        root.addView(title)
        root.addView(activate)
        root.addView(deactivate)
        root.addView(statusText)
        setContentView(root)

        activate.setOnClickListener { requestMicThenStart() }
        deactivate.setOnClickListener {
            startService(Intent(this, EloWakeService::class.java).setAction(EloWakeService.ACTION_STOP))
        }
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(EloWakeService.ACTION_STATUS)
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
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
            renderStatus("STOPPED", "-", "-", "-", "RECORD_AUDIO denied", "-")
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

    private fun renderStatus(service: String, recognition: String, transcript: String, wake: String, error: String, onDevice: String) {
        statusText.text = "Service: $service\nRecognition: $recognition\nLast transcript: $transcript\nWake: $wake\nError: $error\nON_DEVICE: $onDevice"
    }

    companion object {
        private const val REQ_AUDIO = 10
    }
}
