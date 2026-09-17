package br.com.icaroamaral.elo

import java.text.Normalizer
import java.util.Locale

/** Shared normalization and aliases for voice commands that control active music. */
object EloVoiceMediaCommand {
    private val stopCommands = setOf(
        "parar", "pare", "pausa", "pausar", "pause", "stop",
        "parar musica", "parar a musica", "pare a musica",
        "pausar musica", "pausar a musica", "pause musica", "pause a musica",
        "stop musica", "stop a musica"
    )

    fun normalizeVoiceCommand(value: String): String = Normalizer.normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "")
        .replace("[^a-z0-9\\s]".toRegex(), " ")
        .replace("\\s+".toRegex(), " ")
        .trim()

    fun isStopCommand(value: String): Boolean = normalizeVoiceCommand(value) in stopCommands

    /** Accepts the common speech-recognition drop of the final R only while music is active. */
    fun isStopCommandForActiveMusic(value: String): Boolean =
        isStopCommand(value) || normalizeVoiceCommand(value) == "para"
}
