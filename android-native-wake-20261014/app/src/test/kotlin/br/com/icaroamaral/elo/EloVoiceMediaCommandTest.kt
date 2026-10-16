package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EloVoiceMediaCommandTest {
    @Test
    fun stopAndPauseAliasesRemainSeparate() {
        listOf(
            "parar",
            "pare",
            "stop",
            "parar música",
            "parar a música",
            "pare a música"
        ).forEach { command ->
            assertTrue(EloVoiceMediaCommand.isStopCommand("  $command  ".uppercase()), command)
        }
        listOf("pausa", "pausar", "pause", "pause a música").forEach { command ->
            assertTrue(EloVoiceMediaCommand.isPauseCommand(command), command)
            assertFalse(EloVoiceMediaCommand.isStopCommand(command), command)
        }
    }

    @Test
    fun normalizationIgnoresCaseAccentsAndWhitespace() {
        assertEquals("parar a musica", EloVoiceMediaCommand.normalizeVoiceCommand("  PARAR A MÚSICA  "))
        assertTrue(EloVoiceMediaCommand.isPauseCommand("PaUsAr Música"))
        assertFalse(EloVoiceMediaCommand.isStopCommand("PaUsAr Música"))
    }

    @Test
    fun paraIsOnlyAmbiguousStopWhenMusicIsActive() {
        assertFalse(EloVoiceMediaCommand.isStopCommand("Pará"))
        assertTrue(EloVoiceMediaCommand.isStopCommandForActiveMusic("Pará"))
        assertTrue(EloVoiceMediaCommand.isStopCommandForActiveMusic("parar"))
    }

    @Test
    fun contextualResumeDoesNotCaptureConversationContinuation() {
        assertTrue(EloVoiceMediaCommand.isResumeCommand("continue a música"))
        assertTrue(EloVoiceMediaCommand.isResumeCommand("continue", mediaActive = true))
        assertFalse(EloVoiceMediaCommand.isResumeCommand("continue"))
    }

    @Test
    fun nextAndPreviousAliasesAreDeterministic() {
        listOf("próxima", "next", "pula", "troca a música").forEach { assertTrue(EloVoiceMediaCommand.isNextCommand(it), it) }
        listOf("anterior", "previous", "volta uma").forEach { assertTrue(EloVoiceMediaCommand.isPreviousCommand(it), it) }
    }
}
