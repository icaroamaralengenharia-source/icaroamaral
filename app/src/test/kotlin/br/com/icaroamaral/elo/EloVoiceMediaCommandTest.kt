package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EloVoiceMediaCommandTest {
    @Test
    fun allRequiredAliasesNormalizeToTheSameStopCommand() {
        listOf(
            "parar",
            "pare",
            "pausa",
            "pausar",
            "pause",
            "stop",
            "parar música",
            "parar a música",
            "pare a música"
        ).forEach { command ->
            assertTrue(EloVoiceMediaCommand.isStopCommand("  $command  ".uppercase()), command)
        }
    }

    @Test
    fun normalizationIgnoresCaseAccentsAndWhitespace() {
        assertEquals("parar a musica", EloVoiceMediaCommand.normalizeVoiceCommand("  PARAR A MÚSICA  "))
        assertTrue(EloVoiceMediaCommand.isStopCommand("PaUsAr Música"))
    }

    @Test
    fun paraIsOnlyAmbiguousStopWhenMusicIsActive() {
        assertFalse(EloVoiceMediaCommand.isStopCommand("Pará"))
        assertTrue(EloVoiceMediaCommand.isStopCommandForActiveMusic("Pará"))
        assertTrue(EloVoiceMediaCommand.isStopCommandForActiveMusic("parar"))
    }
}
