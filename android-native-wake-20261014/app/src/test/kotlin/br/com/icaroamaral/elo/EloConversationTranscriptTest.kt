package br.com.icaroamaral.elo

import org.junit.Assert.assertEquals
import org.junit.Test

class EloConversationTranscriptTest {
    @Test fun restoresQuestionOpeningOnlyFromSameUtteranceHypothesis() {
        assertEquals(
            "Qual é a capital da Bahia?",
            preserveQuestionOpening("a capital da bahia", listOf("Qual é a capital da Bahia?"))
        )
    }

    @Test fun doesNotAddUnrecognizedNonQuestionWords() {
        assertEquals(
            "a capital da bahia",
            preserveQuestionOpening("a capital da bahia", listOf("diga a capital da bahia"))
        )
    }

    @Test fun doesNotJoinDifferentRecognitionHypotheses() {
        assertEquals(
            "a capital da bahia",
            preserveQuestionOpening("a capital da bahia", listOf("qual e a capital de recife"))
        )
    }
}
