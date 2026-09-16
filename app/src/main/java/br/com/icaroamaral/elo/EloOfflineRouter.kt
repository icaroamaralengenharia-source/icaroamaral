package br.com.icaroamaral.elo

import android.content.Context
import java.text.Normalizer

data class EloOfflineTrackFile(
    val path: String,
    val format: String = "",
    val duration: String = ""
)

data class EloOfflineTrack(
    val id: String,
    val title: String,
    val composer: String,
    val aliases: List<String>,
    val files: List<EloOfflineTrackFile>,
    val offlineAllowed: Boolean
)

enum class EloOfflineIntent {
    CALCULATOR,
    CONVERSION,
    ENGINEERING,
    MUSIC_PLAY,
    MUSIC_STOP,
    MEMORY_WRITE,
    MEMORY_READ,
    NONE
}

data class EloOfflineRouteResult(
    val handled: Boolean,
    val intent: EloOfflineIntent,
    val message: String,
    val track: EloOfflineTrack? = null,
    val localPlay: Boolean = false,
    val localStop: Boolean = false,
    val unavailableOffline: Boolean = false,
    val providerCalls: Int = 0,
    val chatCalls: Int = 0
)

private fun loadOfflineTracksFromAssets(context: Context): List<EloOfflineTrack> {
    return runCatching {
        context.assets.open(EloOfflineRouter.LIBRARY_ASSET_PATH).bufferedReader().use {
            EloOfflineRouter.parseLibrary(it.readText())
        }
    }.getOrElse { emptyList() }
}
class EloOfflineRouter(
    private val memory: EloOfflineMemoryContract,
    private val tracks: List<EloOfflineTrack>
) {
    constructor(context: Context) : this(
        memory = EloOfflineMemory(context),
        tracks = loadOfflineTracksFromAssets(context)
    )

    fun route(command: String): EloOfflineRouteResult {
        EloLocalToolEngine.handle(command)?.let { return it }
        return when (val intent = detectIntent(command)) {
            EloOfflineIntent.CALCULATOR,
            EloOfflineIntent.CONVERSION,
            EloOfflineIntent.ENGINEERING ->
                EloLocalToolEngine.handle(command)
                    ?: error("Local tool intent was not handled: $intent")
            EloOfflineIntent.MUSIC_STOP -> EloOfflineRouteResult(
                handled = true,
                intent = intent,
                message = "Música offline interrompida.",
                localStop = true
            )
            EloOfflineIntent.MUSIC_PLAY -> {
                val track = findTrack(tracks, command)
                if (track == null) {
                    EloOfflineRouteResult(
                        handled = true,
                        intent = intent,
                        message = "Essa música não está disponível na biblioteca offline.",
                        unavailableOffline = true
                    )
                } else {
                    EloOfflineRouteResult(
                        handled = true,
                        intent = intent,
                        message = "Tocando offline: ${track.title}.",
                        track = track,
                        localPlay = true
                    )
                }
            }
            EloOfflineIntent.MEMORY_WRITE -> {
                val answer = memory.remember(command)
                EloOfflineRouteResult(
                    handled = answer != null,
                    intent = intent,
                    message = answer ?: "Não consegui registrar essa memória offline."
                )
            }
            EloOfflineIntent.MEMORY_READ -> {
                val answer = memory.answer(command)
                EloOfflineRouteResult(
                    handled = answer != null,
                    intent = intent,
                    message = answer ?: "Não encontrei essa memória no lab offline."
                )
            }
            EloOfflineIntent.NONE -> EloOfflineRouteResult(
                handled = false,
                intent = intent,
                message = "Comando encaminhável ao fluxo online existente."
            )
        }
    }

    companion object {
        const val LIBRARY_ASSET_PATH = "offline-media/classical/library.json"

        fun normalize(value: String): String {
            val plain = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
            return plain.lowercase().replace(Regex("\\s+"), " ").trim()
        }

        fun detectIntent(command: String): EloOfflineIntent {
            val lower = normalize(command)
            EloLocalToolEngine.handle(command)?.let { return it.intent }
            return when {
                Regex("^(pare|parar|stop|interrompa|pause)\\b").containsMatchIn(lower) -> EloOfflineIntent.MUSIC_STOP
                Regex("^(toque|toca|tocar|coloque|reproduza|play)\\b").containsMatchIn(lower) -> EloOfflineIntent.MUSIC_PLAY
                Regex("^(lembre|memorize)\\b").containsMatchIn(lower) -> EloOfflineIntent.MEMORY_WRITE
                Regex("(qual|como|o que|lembra).{0,60}(cachorro|projeto|photo bridge|memoria)").containsMatchIn(lower) -> EloOfflineIntent.MEMORY_READ
                else -> EloOfflineIntent.NONE
            }
        }

        fun findTrack(tracks: List<EloOfflineTrack>, command: String): EloOfflineTrack? {
            val query = normalize(command).replace(Regex("^(toque|toca|tocar|coloque|reproduza|play)\\s+"), "")
            return tracks.firstOrNull { track ->
                if (!track.offlineAllowed) return@firstOrNull false
                val queryTokens = query.split(" ").filter { it.length > 2 }
                val terms = listOf(track.title, track.composer) + track.aliases
                terms.map(::normalize).any { alias ->
                    if (alias.isBlank()) return@any false
                    query == alias ||
                        (queryTokens.size <= 1 && query.contains(alias)) ||
                        (queryTokens.size > 1 && alias.split(" ").filter { it.length > 2 }.size > 1 && (query.contains(alias) || alias.contains(query)))
                }
            }
        }

        fun parseLibrary(json: String): List<EloOfflineTrack> {
            return topLevelObjects(json).mapNotNull outer@ { objectJson ->
                val id = readString(objectJson, "id") ?: return@outer null
                val title = readString(objectJson, "title") ?: return@outer null
                val composer = readString(objectJson, "composer") ?: ""
                val aliases = readStringArray(objectJson, "aliases")
                val files = readObjectArray(objectJson, "files").mapNotNull files@ { fileJson ->
                    val path = readString(fileJson, "path") ?: return@files null
                    EloOfflineTrackFile(
                        path = path,
                        format = readString(fileJson, "format") ?: "",
                        duration = readString(fileJson, "duration") ?: ""
                    )
                }
                EloOfflineTrack(
                    id = id,
                    title = title,
                    composer = composer,
                    aliases = aliases,
                    files = files,
                    offlineAllowed = readBoolean(objectJson, "offlineAllowed") ?: true
                )
            }
        }

        private fun topLevelObjects(json: String): List<String> {
            val result = mutableListOf<String>()
            var depth = 0
            var start = -1
            var inString = false
            var escaped = false
            json.forEachIndexed { index, char ->
                if (escaped) {
                    escaped = false
                    return@forEachIndexed
                }
                if (char == '\\' && inString) {
                    escaped = true
                    return@forEachIndexed
                }
                if (char == '"') inString = !inString
                if (inString) return@forEachIndexed
                if (char == '{') {
                    if (depth == 0) start = index
                    depth += 1
                } else if (char == '}') {
                    depth -= 1
                    if (depth == 0 && start >= 0) result.add(json.substring(start, index + 1))
                }
            }
            return result
        }

        private fun readString(json: String, key: String): String? {
            val match = Regex("\"${Regex.escape(key)}\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"").find(json)
            return match?.groupValues?.get(1)?.replace("\\\"", "\"")?.replace("\\/", "/")
        }

        private fun readBoolean(json: String, key: String): Boolean? {
            val match = Regex("\"${Regex.escape(key)}\"\\s*:\\s*(true|false)").find(json)
            return match?.groupValues?.get(1)?.toBooleanStrictOrNull()
        }

        private fun readStringArray(json: String, key: String): List<String> {
            val body = readArrayBody(json, key) ?: return emptyList()
            return Regex("\"((?:\\\\.|[^\"])*)\"").findAll(body).map { it.groupValues[1] }.toList()
        }

        private fun readObjectArray(json: String, key: String): List<String> {
            val body = readArrayBody(json, key) ?: return emptyList()
            return topLevelObjects(body)
        }

        private fun readArrayBody(json: String, key: String): String? {
            val marker = Regex("\"${Regex.escape(key)}\"\\s*:\\s*\\[").find(json) ?: return null
            var depth = 1
            var inString = false
            var escaped = false
            val start = marker.range.last + 1
            for (index in start until json.length) {
                val char = json[index]
                if (escaped) {
                    escaped = false
                    continue
                }
                if (char == '\\' && inString) {
                    escaped = true
                    continue
                }
                if (char == '"') inString = !inString
                if (inString) continue
                if (char == '[') depth += 1
                if (char == ']') {
                    depth -= 1
                    if (depth == 0) return json.substring(start, index)
                }
            }
            return null
        }
    }
}
