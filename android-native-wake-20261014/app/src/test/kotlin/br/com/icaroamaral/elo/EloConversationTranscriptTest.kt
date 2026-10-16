package br.com.icaroamaral.elo

import org.junit.Assert.assertEquals
import org.junit.Test

class EloConversationTranscriptTest {
    @Test fun restoresQuestionOpeningOnlyFromSameUtteranceHypothesis() {
        assertEquals(
            "Qual é a capital da Bahia?",
            preserveObservedUtteranceOpening("a capital da bahia", listOf("Qual é a capital da Bahia?"))
        )
    }

    @Test fun doesNotAddUnrecognizedNonQuestionWords() {
        assertEquals(
            "a capital da bahia",
            preserveObservedUtteranceOpening("a capital da bahia", listOf("diga a capital da bahia"))
        )
    }

    @Test fun doesNotJoinDifferentRecognitionHypotheses() {
        assertEquals(
            "a capital da bahia",
            preserveObservedUtteranceOpening("a capital da bahia", listOf("qual e a capital de recife"))
        )
    }

    @Test fun restoresObservedStopVerb() {
        assertEquals("Pare de ouvir", preserveObservedUtteranceOpening("de ouvir", listOf("Pare de ouvir")))
    }
    @Test fun restoresObservedStopVerbAndPreposition() {
        assertEquals("Pare de ouvir", preserveObservedUtteranceOpening("ouvir", listOf("Pare de ouvir")))
    }
    @Test fun restoresObservedEndConversationOpening() {
        assertEquals("Encerre a conversa", preserveObservedUtteranceOpening("conversa", listOf("Encerre a conversa")))
    }
    @Test fun restoresObservedDisableOpening() {
        assertEquals("Desative o assistente", preserveObservedUtteranceOpening("o assistente", listOf("Desative o assistente")))
    }
    @Test fun neverInventsStopVerb() {
        assertEquals("de ouvir", preserveObservedUtteranceOpening("de ouvir", listOf("de ouvir")))
    }
    @Test fun laterNegatedQuestionBlocksOlderOpening() {
        assertEquals("a capital da bahia", preserveObservedUtteranceOpening("a capital da bahia", listOf("Qual é a capital da Bahia", "Não diga a capital da Bahia")))
    }
    @Test fun laterNegatedStopBlocksOlderPositiveHypothesis() {
        assertEquals("de ouvir", preserveObservedUtteranceOpening("de ouvir", listOf("Pare de ouvir", "Não pare de ouvir")))
    }
    @Test fun neverJoinsDifferentCommands() {
        assertEquals("de tocar", preserveObservedUtteranceOpening("de tocar", listOf("Pare de ouvir")))
    }
    @Test fun duplicateSuffixCallbacksDoNotEvictCompleteOpening() {
        val history = mutableListOf<String>()
        rememberUtteranceHypotheses(history, listOf("Pare de ouvir"))
        repeat(100) { rememberUtteranceHypotheses(history, listOf("de ouvir")) }
        assertEquals("Pare de ouvir", preserveObservedUtteranceOpening("de ouvir", history))
        assertEquals(2, history.size)
    }
    @Test fun latestPrimaryHasPriorityOverItsAlternatives() {
        val history = mutableListOf<String>()
        rememberUtteranceHypotheses(history, listOf("Não pare de ouvir", "Pare de ouvir"))
        assertEquals("Não pare de ouvir", history.last())
        assertEquals("de ouvir", preserveObservedUtteranceOpening("de ouvir", history))
    }
    @Test fun alternativesRemainBounded() {
        val history = mutableListOf<String>()
        repeat(100) { rememberUtteranceHypotheses(history, listOf("fixture $it")) }
        assertEquals(40, history.size)
        assertEquals("fixture 99", history.last())
    }
}
