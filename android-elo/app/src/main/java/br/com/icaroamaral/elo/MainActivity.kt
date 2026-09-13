package br.com.icaroamaral.elo

import android.app.Activity
import android.media.MediaPlayer
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import java.time.Clock

/** Native offline shell. UI delegates language and intent handling to EloOfflineEngine. */
class MainActivity : Activity() {
    private val tracks = mutableListOf<EloOfflineTrack>()
    private var currentIndex = -1
    private var currentFileIndex = 0
    private var player: MediaPlayer? = null
    private lateinit var musicStore: OfflineMusicStore
    private lateinit var engine: EloOfflineEngine
    private var musicReady = false
    private lateinit var command: EditText
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        musicStore = OfflineMusicStore(this)
        loadCatalog()
        engine = EloOfflineEngine(tracks, loadTechnicalKnowledge(), Clock.systemDefaultZone())
        currentIndex = tracks.indexOfFirst { it.id == getPreferences(0).getString("track", "") }
        buildUi()
        status.text = "Instalando pacote musical local..."
        Thread {
            val installed = musicStore.installBundledCatalog()
            runOnUiThread {
                val expected = tracks.sumOf { it.files.size }
                musicReady = installed == expected && expected > 0
                status.text = "Offline Core Android pronto: $installed/$expected arquivos locais\nRede: não utilizada"
            }
        }.start()
    }

    override fun onDestroy() {
        player?.release()
        player = null
        super.onDestroy()
    }

    private fun loadCatalog() {
        val json = assets.open("offline-media/catalog.json").bufferedReader().use { it.readText() }
        val items = JSONArray(json)
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val files = item.optJSONArray("files") ?: JSONArray()
            val paths = (0 until files.length()).mapNotNull { j ->
                files.optJSONObject(j)?.optString("optimizedPath").orEmpty().ifBlank { null }
            }
            if (item.optBoolean("offlineAvailable", false) && paths.isNotEmpty()) {
                val aliases = item.optJSONArray("aliases")?.let { values ->
                    (0 until values.length()).map { values.optString(it) }
                }.orEmpty()
                tracks += EloOfflineTrack(
                    id = item.optString("id"),
                    title = item.optString("title"),
                    composer = item.optString("composer", item.optString("artist")),
                    genre = item.optString("genre", "instrumental"),
                    aliases = aliases,
                    files = paths,
                )
            }
        }
    }

    private fun loadTechnicalKnowledge(): TechnicalKnowledgeEngine = runCatching {
        val json = assets.open("offline-knowledge/engineering.json").bufferedReader().use { it.readText() }
        TechnicalKnowledgeEngine.fromJson(json)
    }.getOrElse { TechnicalKnowledgeEngine.defaults() }

    private fun buildUi() {
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 42, 32, 32)
        }
        content.addView(TextView(this).apply { text = "ELO Offline Core V2"; textSize = 24f })
        command = EditText(this).apply {
            hint = "Ex.: toque Für Elise / amanhã / 2+2"
            setSingleLine()
        }
        content.addView(command)
        content.addView(button("EXECUTAR") { execute(command.text.toString()) })
        content.addView(button("PRÓXIMA") { execute("próxima") })
        content.addView(button("ANTERIOR") { execute("anterior") })
        content.addView(button("PAUSE") { execute("pause") })
        content.addView(button("CONTINUE") { execute("continue") })
        content.addView(button("EMBARALHAR") { execute("embaralhe") })
        status = TextView(this).apply { textSize = 16f }
        content.addView(status)
        setContentView(ScrollView(this).apply { addView(content) })
    }

    private fun button(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        setOnClickListener { action() }
    }

    private fun execute(raw: String) {
        val result = engine.handle(raw)
        show(result.text)
        executeAction(result.action)
    }

    private fun executeAction(action: EloOfflineAction) {
        when (action) {
            is EloOfflineAction.PlayTrack -> {
                val index = tracks.indexOfFirst { it.id == action.trackId }
                if (index >= 0) playAt(index)
            }
            EloOfflineAction.Pause -> player?.pause()
            EloOfflineAction.Resume -> player?.start()
            EloOfflineAction.NextTrack -> step(1)
            EloOfflineAction.PreviousTrack -> step(-1)
            EloOfflineAction.Shuffle -> if (tracks.isNotEmpty()) playAt(tracks.indices.random())
            EloOfflineAction.CurrentTrack, EloOfflineAction.None -> Unit
        }
    }

    private fun playAt(index: Int) {
        if (index !in tracks.indices) return
        currentIndex = index
        currentFileIndex = 0
        engine.context.lastMusicTrackId = tracks[index].id
        getPreferences(0).edit().putString("track", tracks[index].id).apply()
        playCurrentFile()
    }

    private fun playCurrentFile() {
        if (!musicReady) {
            show("Pacote musical ainda está sendo validado")
            return
        }
        val track = tracks.getOrNull(currentIndex) ?: return
        val path = track.files.getOrNull(currentFileIndex) ?: return
        player?.release()
        player = runCatching {
            val localFile = musicStore.resolve(path) ?: error("faixa não instalada: $path")
            MediaPlayer().apply {
                setDataSource(localFile.absolutePath)
                setOnCompletionListener {
                    if (currentFileIndex + 1 < track.files.size) {
                        currentFileIndex++
                        playCurrentFile()
                    } else {
                        step(1)
                    }
                }
                prepare()
                start()
            }
        }.onFailure { show("Falha ao abrir áudio local: ${it.message}") }.getOrNull()
        if (player != null) show("TOCANDO OFFLINE: ${track.title} — ${track.composer}")
    }

    private fun step(delta: Int) {
        if (tracks.isNotEmpty()) playAt((currentIndex + delta + tracks.size) % tracks.size)
    }

    private fun show(message: String) {
        status.text = "$message\nRequests externos: 0"
    }
}
