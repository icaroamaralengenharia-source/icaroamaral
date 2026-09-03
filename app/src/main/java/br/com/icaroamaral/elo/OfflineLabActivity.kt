package br.com.icaroamaral.elo

import android.app.Activity
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

class OfflineLabActivity : Activity() {
    private lateinit var router: EloOfflineRouter
    private lateinit var player: EloOfflineMusicPlayer
    private lateinit var output: TextView
    private lateinit var status: TextView
    @Volatile private var destroyed = false
    @Volatile private var commandGeneration = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        router = EloOfflineRouter(this)
        player = EloOfflineMusicPlayer(this)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 56, 40, 40)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        val title = TextView(this).apply {
            text = "ELO Offline Lab"
            textSize = 24f
        }
        val note = TextView(this).apply {
            text = "LAB MEMORY != PRODUÇÃO"
            textSize = 13f
        }
        val input = EditText(this).apply {
            hint = "toque Beethoven, pare, lembre que meu cachorro se chama Thor"
            singleLine = false
            minLines = 2
        }
        val send = Button(this).apply { text = "EXECUTAR OFFLINE" }
        status = TextView(this).apply { text = "Connectivity: ${EloConnectivity.snapshot(this@OfflineLabActivity)}" }
        output = TextView(this).apply {
            text = "Aguardando comando."
            textSize = 16f
        }

        root.addView(title)
        root.addView(note)
        root.addView(input)
        root.addView(send)
        root.addView(status)
        root.addView(output)
        setContentView(root)

        send.setOnClickListener {
            val command = input.text.toString()
            val runId = commandGeneration + 1
            commandGeneration = runId
            send.isEnabled = false
            output.text = "Processando..."
            Thread {
                val connectivity = EloConnectivity.snapshot(this)
                val result = runCatching { router.route(command) }.getOrElse {
                    EloOfflineRouteResult(
                        handled = false,
                        intent = EloOfflineIntent.NONE,
                        message = "Falha no lab offline: ${it.message ?: it.javaClass.simpleName}"
                    )
                }
                runOnUiThread {
                    if (destroyed || runId != commandGeneration) return@runOnUiThread
                    status.text = "Connectivity: $connectivity"
                    if (result.localStop) {
                        player.stop()
                    }
                    if (result.localPlay && result.track != null) {
                        player.play(result.track)
                    }
                    output.text = result.message
                    send.isEnabled = true
                }
            }.start()
        }
    }

    override fun onDestroy() {
        destroyed = true
        commandGeneration += 1
        player.release()
        super.onDestroy()
    }
}