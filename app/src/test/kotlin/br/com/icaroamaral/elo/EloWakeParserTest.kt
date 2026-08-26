package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EloWakeParserTest {
    @Test
    fun partialWakeThenFinalFullCommandKeepsAllWords() {
        assertTrue(EloWakeParser.hasLeadingWake("ELO"))
        assertEquals("", EloWakeParser.extractCommandAfterWake("ELO"))
        assertEquals("que dia é hoje", EloWakeParser.extractCommandAfterWake("ELO que dia é hoje"))
    }

    @Test
    fun partialWakeThenMathCommandKeepsAllWords() {
        assertEquals("quanto é dois mais dois", EloWakeParser.extractCommandAfterWake("ELO quanto é dois mais dois"))
    }

    @Test
    fun finalWakeQuemVoceKeepsCommand() {
        assertEquals("quem é você", EloWakeParser.extractCommandAfterWake("ELO quem é você"))
    }

    @Test
    fun finalWakeMusicCommandPreservesCase() {
        assertEquals("toque Sultans of Swing", EloWakeParser.extractCommandAfterWake("ELO toque Sultans of Swing"))
    }

    @Test
    fun wakeAloneHasNoInlineCommand() {
        val selected = EloWakeParser.selectBestWakeHypothesis(listOf("elo"))
        assertTrue(selected.wakeMatched)
        assertEquals(EloWakeParser.WakeDecision.WAKE_ONLY, selected.decision)
        assertEquals("", selected.commandAfterWake)
    }

    @Test
    fun commandInSecondRecognitionHasNoWakeAndShouldRemainIntact() {
        assertFalse(EloWakeParser.hasLeadingWake("quanto é dois mais dois"))
        assertEquals("quanto é dois mais dois", EloWakeParser.mergeCommandContinuation("", "quanto é dois mais dois"))
    }

    @Test
    fun aliasesAndImmediatePunctuationAreHandled() {
        assertEquals("quanto é dois mais dois", EloWakeParser.extractCommandAfterWake("élo, quanto é dois mais dois"))
        assertEquals("toque sultans of swing", EloWakeParser.extractCommandAfterWake("hello toque sultans of swing"))
        assertEquals("toque sultans of swing", EloWakeParser.extractCommandAfterWake("ello toque sultans of swing"))
        assertEquals("toque sultans of swing", EloWakeParser.extractCommandAfterWake("é lo toque sultans of swing"))
    }

    @Test
    fun fragmentsMergeWithoutTruncationOrDuplication() {
        assertEquals("que dia é hoje", EloWakeParser.mergeCommandContinuation("que dia", "é hoje"))
        assertEquals("quanto é dois mais dois", EloWakeParser.mergeCommandContinuation("quanto é dois", "dois mais dois"))
        assertEquals("que dia é hoje", EloWakeParser.mergeCommandContinuation("que dia é hoje", "é hoje"))
    }

    @Test
    fun caseAInlineMusicDispatches() {
        val selected = EloWakeParser.selectBestWakeHypothesis(listOf("elo toque sultans of swing"))
        assertTrue(selected.wakeMatched)
        assertEquals(EloWakeParser.WakeDecision.WAKE_WITH_COMMAND, selected.decision)
        assertEquals("toque sultans of swing", selected.commandAfterWake)
    }

    @Test
    fun caseBSecondHypothesisWithWakeWins() {
        val selected = EloWakeParser.selectBestWakeHypothesis(
            listOf(
                "hello toque sultans of swing extra muito longa",
                "elo toque sultans of swing"
            )
        )
        assertTrue(selected.wakeMatched)
        assertEquals("hello", selected.aliasMatched)
        assertEquals(EloWakeParser.WakeDecision.WAKE_WITH_COMMAND, selected.decision)

        val strictSelected = EloWakeParser.selectBestWakeHypothesis(
            listOf(
                "toque sultans of swing mais palavras sem wake",
                "elo toque sultans of swing"
            )
        )
        assertEquals("elo toque sultans of swing", strictSelected.raw)
        assertEquals("toque sultans of swing", strictSelected.commandAfterWake)
    }

    @Test
    fun caseDRenatoRussoDispatches() {
        val selected = EloWakeParser.selectBestWakeHypothesis(listOf("elo quem foi renato russo"))
        assertEquals("quem foi renato russo", selected.commandAfterWake)
        assertEquals(EloWakeParser.WakeDecision.WAKE_WITH_COMMAND, selected.decision)
    }

    @Test
    fun caseEFivePlusFiveDispatches() {
        val selected = EloWakeParser.selectBestWakeHypothesis(listOf("elo quanto é cinco mais cinco"))
        assertEquals("quanto é cinco mais cinco", selected.commandAfterWake)
        assertEquals(EloWakeParser.WakeDecision.WAKE_WITH_COMMAND, selected.decision)
    }

    @Test
    fun caseFNoWakeDoesNotDispatch() {
        val selected = EloWakeParser.selectBestWakeHypothesis(listOf("toque sultans of swing"))
        assertFalse(selected.wakeMatched)
        assertEquals(EloWakeParser.WakeDecision.NO_WAKE, selected.decision)
        assertEquals("", selected.commandAfterWake)
    }

    @Test
    fun restrictedAliasesAreExplicitAndLogged() {
        val aliases = listOf("elo" to "elo", "êlo" to "elo", "é lo" to "e lo", "ello" to "ello", "hello" to "hello")
        aliases.forEach { (rawAlias, normalizedAlias) ->
            val selected = EloWakeParser.selectBestWakeHypothesis(listOf("$rawAlias toque sultans of swing"))
            assertTrue(selected.wakeMatched, rawAlias)
            assertEquals(normalizedAlias, selected.aliasMatched)
            assertEquals("toque sultans of swing", selected.commandAfterWake)
        }
    }

    @Test
    fun punctuationAndCaseNormalizeCorrectly() {
        val samples = listOf(
            "ELO, toque Sultans of Swing",
            "elo toque sultans of swing",
            "ÊLO! Toque Sultans of Swing.",
            "Elo: quanto é 5 + 5?"
        )

        samples.forEach { sample ->
            val selected = EloWakeParser.selectBestWakeHypothesis(listOf(sample))
            assertTrue(selected.wakeMatched, sample)
            assertEquals(EloWakeParser.WakeDecision.WAKE_WITH_COMMAND, selected.decision)
            assertFalse(selected.normalized.contains(","), sample)
            assertFalse(selected.normalized.contains("!"), sample)
            assertFalse(selected.normalized.contains("?"), sample)
        }
    }
}
