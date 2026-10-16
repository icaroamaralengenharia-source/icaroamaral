package br.com.icaroamaral.elo

import java.text.Normalizer
import java.util.Locale

/** Shared normalization and aliases for voice commands that control active music. */
object EloVoiceMediaCommand {
    private val pauseCommands = setOf(
        "pausa", "pausar", "pause",
        "pausa musica", "pausa a musica", "pausar musica", "pausar a musica",
        "pause musica", "pause a musica", "da uma pausa", "de uma pausa"
    )

    private val resumeCommands = setOf(
        "retome", "retomar", "retoma", "resume", "resumir",
        "continuar musica", "continuar a musica", "continue musica", "continue a musica",
        "volta a tocar", "volte a tocar", "retome a musica", "retomar a musica"
    )

    private val nextCommands = setOf(
        "proxima", "proximo", "next", "pula", "pular", "pule",
        "proxima musica", "proximo musica", "pula musica", "pular musica",
        "troca", "troque", "troca a musica", "troque a musica"
    )

    private val previousCommands = setOf(
        "anterior", "previous", "volta uma", "voltar uma", "faixa anterior", "musica anterior"
    )

    private val stopCommands = setOf(
        "parar", "pare", "stop",
        "parar musica", "parar a musica", "pare a musica",
        "stop musica", "stop a musica"
    )

    fun normalizeVoiceCommand(value: String): String = Normalizer.normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
        .replace("\\p{Mn}+".toRegex(), "")
        .replace("[^a-z0-9\\s]".toRegex(), " ")
        .replace("\\s+".toRegex(), " ")
        .trim()

    fun isStopCommand(value: String): Boolean = normalizeVoiceCommand(value) in stopCommands

    fun isPauseCommand(value: String): Boolean = normalizeVoiceCommand(value) in pauseCommands

    /** Bare "continue" is intentionally contextual; explicit media phrases are deterministic. */
    fun isResumeCommand(value: String, mediaActive: Boolean = false): Boolean {
        val normalized = normalizeVoiceCommand(value)
        return normalized in resumeCommands || (mediaActive && normalized in setOf("continue", "continua", "volta", "volte"))
    }

    fun isNextCommand(value: String): Boolean = normalizeVoiceCommand(value) in nextCommands

    fun isPreviousCommand(value: String): Boolean = normalizeVoiceCommand(value) in previousCommands

    /** Accepts the common speech-recognition drop of the final R only while music is active. */
    fun isStopCommandForActiveMusic(value: String): Boolean =
        isStopCommand(value) || normalizeVoiceCommand(value) == "para"
}
