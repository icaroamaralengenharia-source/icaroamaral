package br.com.icaroamaral.elo.offlinev2
import java.text.Normalizer
import java.util.Locale

class MusicCommandEngine(private val tracks: List<EloOfflineTrack>) {
    fun answer(input: String, context: EloOfflineContext): EloOfflineResult? {
        val text = normalize(input)
        return when {
            isStopCommand(text) -> result("Música interrompida.", EloOfflineAction.Stop, context, "music_stop")
            text.contains("pausar") || text == "pause" || text.contains("pausa") -> result("Pausando a faixa atual.", EloOfflineAction.Pause, context, "music_pause")
            text.contains("continue") || text.contains("retome") || text.contains("retomar") -> result("Continuando a faixa atual.", EloOfflineAction.Resume, context, "music_resume")
            text == "proxima" || text.contains("proxima musica") || text.contains("seguinte") -> result("Indo para a próxima faixa.", EloOfflineAction.NextTrack, context, "music_next")
            text == "anterior" || text.contains("faixa anterior") -> result("Voltando para a faixa anterior.", EloOfflineAction.PreviousTrack, context, "music_previous")
            text.contains("embaralh") || text.contains("shuffle") -> result("Embaralhando as faixas offline.", EloOfflineAction.Shuffle, context, "music_shuffle")
            text.contains("o que esta tocando") || text.contains("qual musica esta tocando") -> {
                val track = tracks.firstOrNull { it.id == context.lastMusicTrackId }
                if (track == null) result("Nenhuma faixa está tocando agora.", EloOfflineAction.CurrentTrack, context, "music_current")
                else result("Está tocando ${track.title}.", EloOfflineAction.CurrentTrack, context, "music_current")
            }
            text.startsWith("toque ") || text.startsWith("tocar ") || text.startsWith("play ") || text == "musica" -> {
                val query = text.removePrefix("toque ").removePrefix("tocar ").removePrefix("play ").trim()
                val track = resolve(query)
                if (track == null) EloOfflineResult(true, "Essa música não está disponível offline neste aparelho.", requiresInternet = false)
                else result("Vou tocar ${track.title} offline.", EloOfflineAction.PlayTrack(track.id), context, "music_play", track.id)
            }
            else -> null
        }
    }

    private fun resolve(query: String): EloOfflineTrack? {
        val safe = normalize(query)
        if (safe.contains("algo tranquilo") || safe.contains("calma") || safe.contains("relaxante")) {
            return tracks.firstOrNull { normalize(it.genre).contains("classical") } ?: tracks.firstOrNull()
        }
        return tracks.maxByOrNull { track ->
            val candidates = listOf(track.title, track.composer, track.genre) + track.aliases
            candidates.maxOfOrNull { candidate ->
                val normalized = normalize(candidate)
                when {
                    normalized == safe -> 100
                    normalized.contains(safe) || safe.contains(normalized) -> 80
                    safe.split(" ").count { token -> token.length > 2 && normalized.contains(token) } > 0 -> 25
                    else -> 0
                }
            } ?: 0
        }?.takeIf { track ->
            val values = listOf(track.title, track.composer, track.genre) + track.aliases
            values.any { candidate -> matchesQuery(safe, normalize(candidate)) }
        }
    }

    private fun matchesQuery(query: String, candidate: String): Boolean {
        if (query.isBlank() || candidate.isBlank()) return false
        if (query == candidate || candidate.contains(query) || query.contains(candidate) && query.split(" ").size > 1 && candidate.split(" ").size > 1) return true
        val queryTokens = query.split(" ").filter { it.length > 2 }
        val candidateTokens = candidate.split(" ").filter { it.length > 2 }
        return queryTokens.size <= 1 && queryTokens.any { token -> candidateTokens.contains(token) }
    }

    private fun isStopCommand(text: String): Boolean = when (text) {
        "parar", "pare", "stop", "pare a musica", "parar musica", "parar a musica" -> true
        else -> false
    }

    private fun result(text: String, action: EloOfflineAction, context: EloOfflineContext, intent: String, trackId: String? = null): EloOfflineResult {
        context.lastTopic = "musica"
        context.lastIntent = intent
        if (trackId != null) context.lastMusicTrackId = trackId
        return EloOfflineResult(true, text, action)
    }

    private fun normalize(value: String): String = Normalizer.normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "")
        .replace("[^a-z0-9 ]".toRegex(), " ")
        .replace("\\s+".toRegex(), " ")
        .trim()
}
