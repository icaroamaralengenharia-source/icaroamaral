package br.com.icaroamaral.elo

import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test

class EloSpeechInterruptDecisionTest {
    private fun result(text:String, confidence:Double=0.98)=JSONObject().put("text",text).put("result",JSONArray().put(
        JSONObject().put("word",text).put("conf",confidence).put("start",1.0).put("end",1.6)))
    @Test fun exactCommandsAreAccepted() { for(word in listOf("espere","calma")) assertEquals(word,EloSpeechInterruptDecision.command(result(word))) }
    @Test fun arbitraryOrLowConfidenceSpeechIsRejected() {
        for(word in listOf("elo","espera","tenha calma","[unk]")) assertNull(EloSpeechInterruptDecision.command(result(word)))
        assertNull(EloSpeechInterruptDecision.command(result("espere",0.6)))
    }
    @Test fun ttsKeywordIsBlockedWithoutBlockingOtherCommand() {
        assertFalse(EloSpeechInterruptDecision.allowed("calma","Tenha CALMA, depois misture."))
        assertTrue(EloSpeechInterruptDecision.allowed("espere","Tenha calma e misture."))
    }
    @Test fun malformedWordTimingIsRejected() {
        val r=result("calma");r.getJSONArray("result").getJSONObject(0).put("end",1.01)
        assertNull(EloSpeechInterruptDecision.command(r));assertNull(EloSpeechInterruptDecision.command(JSONObject().put("text","espere")))
    }
    @Test fun firstChunkIsSmallerAndEntireReplyIsPreserved() {
        val text=("Prepare a massa cuidadosamente e reserve o recheio para modelar cada coxinha. ").repeat(40).trim()
        val chunks=EloSpeechChunks.build(text)
        assertTrue(chunks.first().length<=160);assertTrue(chunks.drop(1).all{it.length<=240})
        assertEquals(text,chunks.joinToString(" "))
    }
    @Test fun shortRepliesAndUnicodeArePreserved() {
        assertEquals(listOf("Pronto."),EloSpeechChunks.build("Pronto."))
        val text="💡".repeat(180);assertEquals(text,EloSpeechChunks.build(text).joinToString(""))
    }
}
