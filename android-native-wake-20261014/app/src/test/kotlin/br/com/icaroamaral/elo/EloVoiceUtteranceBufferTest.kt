package br.com.icaroamaral.elo

import org.junit.Assert.*
import org.junit.Test

class EloVoiceUtteranceBufferTest {
    @Test fun partialNeverCommitsATurn() { val b=EloVoiceUtteranceBuffer();b.partial("neste teste");assertNull(b.poll(20_000));assertEquals("neste teste",b.preview()) }
    @Test fun aDecoderSegmentWaitsForTheQuietTail() { val b=EloVoiceUtteranceBuffer();b.segment("neste teste o projeto",1000);assertNull(b.poll(1649));assertEquals("neste teste o projeto",b.poll(1650)) }
    @Test fun continuedSpeechKeepsAuroraInTheSameTurn() {
        val b=EloVoiceUtteranceBuffer();b.segment("neste teste o projeto",1000);b.partial("se chama")
        assertNull(b.poll(2000));b.partial("se chama aurora");b.segment("se chama aurora responda só entendido",2500)
        assertNull(b.poll(3149));assertEquals("neste teste o projeto se chama aurora responda só entendido",b.poll(3150))
    }
    @Test fun aFinalTurnEmitsOnlyOnce() { val b=EloVoiceUtteranceBuffer();b.segment("aurora",0);assertEquals("aurora",b.poll(650));assertNull(b.poll(900));b.segment("late",1000);assertNull(b.poll(2000)) }
    @Test fun legitimateRepeatedSegmentsArePreserved() { val b=EloVoiceUtteranceBuffer();b.segment("sim",0);b.segment("sim",100);assertEquals("sim sim",b.poll(750)) }
    @Test fun previewAndOutputHaveABoundedSize() { val b=EloVoiceUtteranceBuffer(maxChars=12);b.segment("  projeto aurora  ",0);assertEquals("projeto auro",b.preview());assertEquals("projeto auro",b.poll(650)) }
}
