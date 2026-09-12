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
import java.text.Normalizer
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Native offline shell. It reuses the validated catalog/manifest and does not load elo.html. */
class MainActivity : Activity() {
    private data class Track(val id: String, val title: String, val composer: String, val genre: String, val aliases: List<String>, val files: List<String>)
    private val tracks = mutableListOf<Track>()
    private var currentIndex = -1
    private var currentFileIndex = 0
    private var player: MediaPlayer? = null
    private lateinit var musicStore: OfflineMusicStore
    private var musicReady = false
    private lateinit var command: EditText
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        musicStore = OfflineMusicStore(this)
        loadCatalog()
        currentIndex = tracks.indexOfFirst { it.id == getPreferences(0).getString("track", "") }
        buildUi()
        status.text = "Instalando pacote musical local..."
        Thread {
            val installed = musicStore.installBundledCatalog()
            runOnUiThread {
                musicReady = installed > 0
                status.text = "Offline Core Android pronto: $installed/${tracks.sumOf { it.files.size }} arquivos locais\nRede: não utilizada"
            }
        }.start()
    }

    override fun onDestroy() { player?.release(); player = null; super.onDestroy() }

    private fun loadCatalog() {
        val json = assets.open("offline-media/catalog.json").bufferedReader().use { it.readText() }
        val items = JSONArray(json)
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val files = item.optJSONArray("files") ?: JSONArray()
            val paths = (0 until files.length()).mapNotNull { j -> files.optJSONObject(j)?.optString("optimizedPath").orEmpty().ifBlank { null } }
            if (item.optBoolean("offlineAvailable", false) && paths.isNotEmpty()) {
                val aliases = mutableListOf<String>()
                item.optJSONArray("aliases")?.let { a -> for (j in 0 until a.length()) aliases += a.optString(j) }
                tracks += Track(item.optString("id"), item.optString("title"), item.optString("composer", item.optString("artist")), item.optString("genre", "instrumental"), aliases, paths)
            }
        }
    }

    private fun buildUi() {
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(32, 42, 32, 32) }
        content.addView(TextView(this).apply { text = "ELO Offline Core V2"; textSize = 24f })
        command = EditText(this).apply { hint = "Ex.: toque Für Elise / amanhã / 2+2"; setSingleLine() }
        content.addView(command)
        content.addView(button("EXECUTAR") { execute(command.text.toString()) })
        content.addView(button("PRÓXIMA") { step(1) })
        content.addView(button("ANTERIOR") { step(-1) })
        content.addView(button("PAUSE") { player?.pause(); show("Pausado") })
        content.addView(button("CONTINUE") { player?.start(); show("Continuando: ${currentTitle()}") })
        content.addView(button("EMBARALHAR") { if (tracks.isNotEmpty()) playAt(tracks.indices.random()) })
        status = TextView(this).apply { textSize = 16f }
        content.addView(status)
        setContentView(ScrollView(this).apply { addView(content) })
    }

    private fun button(label: String, action: () -> Unit) = Button(this).apply { text = label; setOnClickListener { action() } }

    private fun execute(raw: String) {
        val text = normalize(raw)
        when {
            text.contains("amanha") -> show("Amanhã: ${date(1)}")
            text.contains("ontem") -> show("Ontem: ${date(-1)}")
            text == "hoje" || text.contains("data de hoje") -> show("Hoje: ${date(0)}")
            isCalculation(raw) -> show("Resultado: ${calculate(raw)}")
            text.contains("laje") || text.contains("portao") || text.contains("engenharia") -> show("Consulta técnica offline: orientação preliminar sobre laje, treliçada e dimensionamento.")
            text.startsWith("oi") || text.contains("ola") || text.contains("conversa") -> show("Olá! Estou funcionando offline no ELO.")
            else -> findTrack(raw)?.let { playAt(tracks.indexOf(it)) } ?: show("Não encontrei uma ação local para: $raw")
        }
    }

    private fun playAt(index: Int) {
        if (index !in tracks.indices) return
        currentIndex = index; currentFileIndex = 0; playCurrentFile()
        getPreferences(0).edit().putString("track", tracks[index].id).apply()
    }

    private fun playCurrentFile() {
        if (!musicReady) { show("Pacote musical ainda está sendo validado"); return }
        val track = tracks.getOrNull(currentIndex) ?: return
        val path = track.files.getOrNull(currentFileIndex) ?: return
        player?.release()
        player = runCatching {
            val localFile = musicStore.resolve(path)
                ?: error("faixa não instalada: $path")
            MediaPlayer().apply {
                setDataSource(localFile.absolutePath)
                setOnCompletionListener {
                    if (currentFileIndex + 1 < track.files.size) { currentFileIndex++; playCurrentFile() } else step(1)
                }
                prepare(); start()
            }
        }.onFailure { show("Falha ao abrir áudio local: ${it.message}") }.getOrNull()
        if (player != null) show("TOCANDO OFFLINE: ${track.title} — ${track.composer}")
    }

    private fun step(delta: Int) { if (tracks.isNotEmpty()) playAt((currentIndex + delta + tracks.size) % tracks.size) }

    private fun findTrack(query: String): Track? {
        val normalized = normalize(query)
        val candidate = tracks.maxByOrNull { track ->
            listOf(track.title, track.composer, track.genre).plus(track.aliases).maxOfOrNull { value ->
                val text = normalize(value)
                when { text == normalized -> 100; text.contains(normalized) || normalized.contains(text) -> 80; normalized.split(" ").count { it in text.split(" ") } > 0 -> 20; else -> 0 }
            } ?: 0
        }
        return candidate?.takeIf { normalize(it.title) in normalized || normalized.contains("fur elise") || it.aliases.any { alias -> normalize(alias) in normalized } }
    }

    private fun normalize(value: String) = Normalizer.normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "").replace("[^a-z0-9+*/., -]".toRegex(), " ")
        .replace("\\b(toque|tocar|musica|uma|um|a|o|elo)\\b".toRegex(), " ").replace("\\s+".toRegex(), " ").trim()

    private fun isCalculation(value: String) = "^\\s*-?\\d+(?:[.,]\\d+)?\\s*[+*/-]\\s*-?\\d+(?:[.,]\\d+)?\\s*$".toRegex().matches(value)
    private fun calculate(value: String): String {
        val m = "^\\s*(-?\\d+(?:[.,]\\d+)?)\\s*([+*/-])\\s*(-?\\d+(?:[.,]\\d+)?)\\s*$".toRegex().find(value) ?: return "indisponível"
        val a = m.groupValues[1].replace(',', '.').toDouble(); val b = m.groupValues[3].replace(',', '.').toDouble()
        return when (m.groupValues[2]) { "+" -> a + b; "-" -> a - b; "*" -> a * b; else -> a / b }.toString()
    }
    private fun date(offset: Long) = LocalDate.now().plusDays(offset).format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
    private fun currentTitle() = tracks.getOrNull(currentIndex)?.title ?: "nenhuma faixa"
    private fun show(message: String) { status.text = "$message\nRequests externos: 0" }
}
