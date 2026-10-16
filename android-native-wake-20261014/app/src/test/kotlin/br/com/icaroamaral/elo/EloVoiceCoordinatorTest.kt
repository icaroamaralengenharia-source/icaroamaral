package br.com.icaroamaral.elo

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONArray
import org.json.JSONObject

private class VoicePorts : EloVoiceCoordinator.Ports {
    var ready = true
    var release = true
    var capture = EloVoiceCoordinator.Owner.NONE
    var peak = 0
    var requests = 0
    var speaks = 0
    var output = false
    var now = 0L
    var focus = true
    var focusHeld = false
    var asyncRelease = false
    var awaitReady = false
    private val releases = mutableListOf<(Boolean) -> Unit>()
    override fun waitsForCaptureReady() = awaitReady
    override fun elapsedMs() = now
    override fun stopCaptureAsync(done: (Boolean) -> Unit) {
        if (asyncRelease) releases.add(done) else done(stopCapture())
    }
    fun acknowledgeRelease() {
        val callbacks = releases.toList(); releases.clear()
        val released = stopCapture(); callbacks.forEach { it(released) }
    }
    val states = mutableListOf<EloVoiceCoordinator.Snapshot>()
    val events = mutableListOf<String>()
    data class Job(val at: Long, val action: () -> Unit, var cancelled: Boolean = false)
    val jobs = mutableListOf<Job>()
    override fun sessionReady() = ready
    override fun startCapture(owner: EloVoiceCoordinator.Owner, lease: Long): Boolean {
        check(capture == EloVoiceCoordinator.Owner.NONE)
        check(!output || owner == EloVoiceCoordinator.Owner.INTERRUPT)
        check(!focusHeld || owner == EloVoiceCoordinator.Owner.INTERRUPT) { "Output focus must be released before conversational capture starts" }
        events.add("capture-start-${owner.name}")
        capture = owner; peak = maxOf(peak, 1)
        return true
    }
    override fun stopCapture(): Boolean { if (release) capture = EloVoiceCoordinator.Owner.NONE; return release }
    override fun stopOutput() { output = false }
    override fun cancelRequest() {}
    override fun pauseMusic() {}
    override fun acquireOutputFocus(): Boolean {
        events.add("focus-acquire")
        if (!focus) return false
        focusHeld = true
        return true
    }
    override fun releaseOutputFocus(reason: String) {
        events.add("focus-release-$reason")
        focusHeld = false
    }
    override fun request(turn: Long, generation: Long, text: String) { check(capture == EloVoiceCoordinator.Owner.NONE); requests++ }
    override fun speak(generation: Long, text: String) { check(capture == EloVoiceCoordinator.Owner.NONE); check(focusHeld); output = true; speaks++ }
    override fun later(ms: Long, action: () -> Unit): EloVoiceCoordinator.Cancel {
        val job = Job(now + ms, action); jobs.add(job)
        return EloVoiceCoordinator.Cancel { job.cancelled = true }
    }
    override fun changed(snapshot: EloVoiceCoordinator.Snapshot) { states.add(snapshot) }
    fun advance(ms: Long) {
        val end = now + ms
        while (true) {
            val job = jobs.filter { !it.cancelled && it.at <= end }.minByOrNull { it.at } ?: break
            jobs.remove(job); now = job.at; job.action()
        }
        now = end
    }
}

class EloVoiceCoordinatorTest {
    @Test fun isolatedSpeechInterruptionStopsOutputBeforeOpeningAnotherTurn() {
        val (c,p)=talking();c.heard(c.snapshot().captureLease,"Receita de coxinha")
        val generation=c.snapshot().generation;c.answerReady(c.snapshot().turn,generation,"Primeiro prepare a massa e o recheio.")
        c.outputStarted(generation);val lease=c.snapshot().captureLease
        assertEquals(EloVoiceCoordinator.Owner.INTERRUPT,p.capture)
        c.interruption(lease,"espere");assertFalse(p.output);p.advance(650)
        assertEquals(EloVoiceCoordinator.Owner.BRAIN,p.capture);assertEquals(1,p.peak)
        c.outputDone(generation,true);assertEquals(EloVoiceCoordinator.State.BRAIN_LISTENING,c.snapshot().state)
    }
    @Test fun outgoingKeywordCannotInterruptItself() {
        val(c,p)=talking();c.heard(c.snapshot().captureLease,"Como devo agir?")
        val s=c.snapshot();c.answerReady(s.turn,s.generation,"Espere um minuto e mantenha a calma.");c.outputStarted(s.generation)
        c.interruption(c.snapshot().captureLease,"espere");c.interruption(c.snapshot().captureLease,"calma")
        assertTrue(p.output);assertEquals(EloVoiceCoordinator.State.BRAIN_SPEAKING,c.snapshot().state)
    }
    @Test fun unsupportedEchoCancellationLeavesOutputAndButtonAvailable() {
        val(c,p)=talking();c.heard(c.snapshot().captureLease,"Explique")
        val s=c.snapshot();c.answerReady(s.turn,s.generation,"Resposta longa");c.outputStarted(s.generation)
        c.captureFailed(c.snapshot().captureLease,"ECHO_CANCELLATION_UNAVAILABLE")
        assertTrue(p.output);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture)
        assertEquals("INTERRUPT_UNAVAILABLE",c.snapshot().reason)
        c.interrupt();p.advance(650);assertEquals(EloVoiceCoordinator.Owner.BRAIN,p.capture)
    }
    @Test fun lateSpeechInterruptionCannotRestartAfterOff() {
        val(c,p)=talking();c.heard(c.snapshot().captureLease,"Explique")
        val s=c.snapshot();c.answerReady(s.turn,s.generation,"Resposta");c.outputStarted(s.generation)
        val lease=c.snapshot().captureLease;c.disable();c.interruption(lease,"calma");p.advance(300_000)
        assertFalse(c.snapshot().enabled);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture)
    }
    @Test fun greetingDoesNotOpenAnInterruptOrConversationRecognizer() {
        val(c,p)=started();c.wakeDetected(c.snapshot().captureLease);c.outputStarted(c.snapshot().generation)
        assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture);assertTrue(p.output)
    }
    @Test fun normalOutputReleasesInterruptOwnerBeforeConversationRecognizer() {
        val(c,p)=talking();c.heard(c.snapshot().captureLease,"Explique")
        val s=c.snapshot();c.answerReady(s.turn,s.generation,"Resposta");c.outputStarted(s.generation)
        p.output=false;c.outputDone(s.generation,true);p.advance(650)
        assertEquals(EloVoiceCoordinator.Owner.BRAIN,p.capture);assertEquals(1,p.peak)
    }
    @Test fun explicitStopListeningPhrasesDisableWithoutCallingBackend() {
        for(text in listOf("Pare de escutar","ELO, pare de ouvir","desliguei","desligue")) {
            val(c,p)=talking();c.heard(c.snapshot().captureLease,text);p.advance(90_000)
            assertFalse(text,c.snapshot().enabled);assertEquals(0,p.requests);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture)
        }
    }
    @Test fun sessionRenewalRecoversContinuousListeningWithoutAnotherWakeWord() {
        val(c,p)=talking();p.ready=false;c.sessionRenewalRequired();assertTrue(c.snapshot().enabled)
        assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture);assertEquals("SESSION_RENEWAL_REQUIRED",c.snapshot().reason)
        p.advance(60_000);p.ready=true;c.sessionRenewed();assertEquals(EloVoiceCoordinator.Owner.BRAIN,p.capture)
    }
    @Test fun sessionRenewalCannotOverrideExplicitOff() {
        val(c,p)=talking();p.ready=false;c.sessionRenewalRequired();c.disable();p.ready=true;c.sessionRenewed();p.advance(90_000)
        assertFalse(c.snapshot().enabled);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture)
    }
    @Test fun renewalFromWakeWaitingReturnsOnlyToWake() {
        val(c,p)=started();p.ready=false;c.sessionRenewalRequired();p.ready=true;c.sessionRenewed()
        assertEquals(EloVoiceCoordinator.Owner.WAKE,p.capture)
    }
    @Test fun outputFocusIsReleasedBeforeAndroidRecognizerStarts() {
        val (c, p) = started()
        c.wakeDetected(c.snapshot().captureLease)
        assertTrue(p.focusHeld)
        p.output = false
        c.outputDone(c.snapshot().generation, true)
        assertFalse(p.focusHeld)
        p.advance(650)
        val release = p.events.indexOf("focus-release-OUTPUT_COMPLETED")
        val recognizer = p.events.indexOf("capture-start-BRAIN")
        assertTrue("focus release must precede the next microphone owner", release >= 0 && recognizer > release)
        assertEquals(EloVoiceCoordinator.Owner.BRAIN, p.capture)
    }
    @Test fun emptyRecognizerTurnKeepsExplicitConversationActiveAcrossSilence() {
        val(c,p)=talking();p.advance(7000);c.captureEmpty(c.snapshot().captureLease);p.advance(650)
        assertEquals(EloVoiceCoordinator.Owner.BRAIN,p.capture);assertEquals(0,p.requests)
        p.advance(7000);c.captureEmpty(c.snapshot().captureLease);p.advance(650)
        p.advance(65_000);assertEquals(EloVoiceCoordinator.Owner.BRAIN,p.capture)
        assertTrue(c.snapshot().enabled)
    }
    @Test fun wakeGreetingWaitsForActualRelease() {
        val(c,p)=started();p.asyncRelease=true;c.wakeDetected(c.snapshot().captureLease)
        assertEquals(0,p.speaks);assertEquals(EloVoiceCoordinator.Owner.WAKE,p.capture)
        p.acknowledgeRelease();assertEquals(1,p.speaks);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture)
    }
    @Test fun requestWaitsForActualRelease() {
        val(c,p)=talking();p.asyncRelease=true;c.heard(c.snapshot().captureLease,"Toque uma música")
        assertEquals(0,p.requests);p.acknowledgeRelease();assertEquals(1,p.requests)
    }
    @Test fun disableInvalidatesPendingWakeRelease() {
        val(c,p)=started();p.asyncRelease=true;c.wakeDetected(c.snapshot().captureLease);c.disable()
        p.acknowledgeRelease();p.advance(200_000);assertEquals(0,p.speaks);assertFalse(c.snapshot().enabled)
    }
    @Test fun failedAsyncReleaseCannotStartOutput() {
        val(c,p)=started();p.asyncRelease=true;p.release=false;c.wakeDetected(c.snapshot().captureLease)
        p.acknowledgeRelease();assertFalse(c.snapshot().enabled);assertEquals(0,p.speaks)
    }
    @Test fun listeningLabelWaitsForRecognizerReadyAndRejectsOldReady() {
        val p=VoicePorts();p.awaitReady=true;val c=EloVoiceCoordinator(p);c.enable();val s=c.snapshot()
        assertEquals("CAPTURE_STARTING",s.reason);c.captureReady(s.captureLease-1);assertEquals("CAPTURE_STARTING",c.snapshot().reason)
        c.captureReady(s.captureLease);assertEquals("",c.snapshot().reason)
    }
    @Test fun confirmedMusicReturnsToWakeWithoutNeuralOverMusic() {
        val(c,p)=talking();c.heard(c.snapshot().captureLease,"Toque música");val s=c.snapshot()
        assertTrue(c.yieldForMusic(s.turn,s.generation));c.mediaReady(s.turn,s.generation);p.advance(650)
        assertEquals(EloVoiceCoordinator.Owner.WAKE,p.capture);assertEquals(1,p.speaks)
        c.answerReady(s.turn,s.generation,"Tocando");assertEquals(1,p.speaks)
    }
    @Test fun staleMusicCannotChangeCurrentSession() {
        val(c,p)=talking();c.heard(c.snapshot().captureLease,"Toque música");val s=c.snapshot();c.interrupt()
        assertFalse(c.yieldForMusic(s.turn,s.generation));c.mediaReady(s.turn,s.generation);p.advance(650)
        assertEquals(EloVoiceCoordinator.Owner.BRAIN,p.capture)
    }
    private fun started(): Pair<EloVoiceCoordinator, VoicePorts> {
        val p = VoicePorts(); val c = EloVoiceCoordinator(p); assertTrue(c.enable()); return c to p
    }
    private fun talking(): Pair<EloVoiceCoordinator, VoicePorts> {
        val (c, p) = started(); c.wakeDetected(c.snapshot().captureLease)
        p.output = false; c.outputDone(c.snapshot().generation, true); p.advance(650)
        return c to p
    }
    @Test fun noCaptureAtConstruction() { val p = VoicePorts(); EloVoiceCoordinator(p); assertEquals(EloVoiceCoordinator.Owner.NONE, p.capture) }
    @Test fun explicitEnableStartsOnlyWake() { val (c,p)=started(); assertEquals(EloVoiceCoordinator.State.WAKE_LISTENING,c.snapshot().state); assertEquals(EloVoiceCoordinator.Owner.WAKE,p.capture); assertEquals(0,p.requests) }
    @Test fun missingSessionCannotEnable() { val p=VoicePorts();p.ready=false;assertFalse(EloVoiceCoordinator(p).enable());assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture) }
    @Test fun duplicateEnableDoesNotStartSecondCapture() { val (c,p)=started();val lease=c.snapshot().captureLease;c.enable();assertEquals(lease,c.snapshot().captureLease);assertEquals(1,p.peak) }
    @Test fun staleWakeCannotStartConversation() { val (c,p)=started();c.wakeDetected(c.snapshot().captureLease-1);assertEquals(0,p.speaks) }
    @Test fun wakeReleasesCaptureBeforeGreeting() { val (c,p)=started();c.wakeDetected(c.snapshot().captureLease);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture);assertTrue(p.output) }
    @Test fun echoCannotWakeWhileOutputIsActive() { val (c,p)=started();val lease=c.snapshot().captureLease;c.wakeDetected(lease);c.wakeDetected(lease);assertEquals(1,p.speaks);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture) }
    @Test fun greetingCompletionResumesBrain() { val (c,p)=talking();assertEquals(EloVoiceCoordinator.State.BRAIN_LISTENING,c.snapshot().state);assertEquals(EloVoiceCoordinator.Owner.BRAIN,p.capture) }
    @Test fun finalTextSubmittedOnlyOnce() { val (c,p)=talking();val lease=c.snapshot().captureLease;c.heard(lease,"projeto Aurora");c.heard(lease,"projeto Aurora");assertEquals(1,p.requests);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture) }
    @Test fun tenTurnsNeedNoNewWake() {
        val (c,p)=talking()
        repeat(10) { c.heard(c.snapshot().captureLease,"etapa "+it);val s=c.snapshot();c.answerReady(s.turn,s.generation,"planejamento");assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture);p.output=false;c.outputDone(s.generation,true);p.advance(650);assertEquals(EloVoiceCoordinator.State.BRAIN_LISTENING,c.snapshot().state) }
        assertEquals(10,p.requests);assertEquals(1,p.peak)
    }
    @Test fun spokenEndReturnsToWake() { val (c,p)=talking();c.heard(c.snapshot().captureLease,"ELO, encerrar conversa.");p.advance(650);assertEquals(EloVoiceCoordinator.State.WAKE_LISTENING,c.snapshot().state);assertEquals(0,p.requests) }
    @Test fun manualReadingReleasesMicAndReturnsToWakeWithoutChat() {
        val(c,p)=started();assertTrue(c.readMessage("Mensagem existente."));assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture)
        p.output=false;c.outputDone(c.snapshot().generation,true);p.advance(650)
        assertEquals(EloVoiceCoordinator.State.WAKE_LISTENING,c.snapshot().state);assertEquals(0,p.requests)
    }
    @Test fun interruptingManualReadingDoesNotStartConversation() {
        val(c,p)=started();c.readMessage("Mensagem existente.");c.interrupt();p.advance(650)
        assertEquals(EloVoiceCoordinator.Owner.WAKE,p.capture);assertEquals(0,p.requests)
    }
    @Test fun manualReadingCannotActivateDisabledAssistant() {
        val p=VoicePorts();val c=EloVoiceCoordinator(p);assertFalse(c.readMessage("Mensagem."));assertEquals(0,p.speaks)
    }
    @Test fun spokenDisableStopsEveryCapture() { val (c,p)=talking();c.heard(c.snapshot().captureLease,"Desativar assistente");p.advance(200_000);assertFalse(c.snapshot().enabled);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture) }
    @Test fun silenceRecyclesCaptureWithoutEndingConversation() { val (c,p)=talking();p.advance(61_300);assertEquals(EloVoiceCoordinator.State.BRAIN_LISTENING,c.snapshot().state);assertEquals(1,p.peak) }
    @Test fun interruptRejectsLateAnswerAndRestartsBrain() { val(c,p)=talking();c.heard(c.snapshot().captureLease,"projeto");val old=c.snapshot();c.interrupt();c.answerReady(old.turn,old.generation,"atrasada");p.advance(650);assertEquals(1,p.speaks);assertEquals(EloVoiceCoordinator.State.BRAIN_LISTENING,c.snapshot().state) }
    @Test fun outputFailureSuspendsWithoutCapture() { val(c,p)=talking();c.heard(c.snapshot().captureLease,"projeto");val s=c.snapshot();c.answerReady(s.turn,s.generation,"resposta");p.output=false;c.outputDone(s.generation,false);p.advance(200_000);assertEquals(EloVoiceCoordinator.State.SUSPENDED,c.snapshot().state);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture) }
    @Test fun networkFailureDoesNotRetryPost() { val(c,p)=talking();c.heard(c.snapshot().captureLease,"projeto");val s=c.snapshot();c.requestFailed(s.turn,s.generation,"HTTP_TIMEOUT");p.advance(200_000);assertEquals(1,p.requests);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture) }
    @Test fun transientFocusLossWaitsForGainAndResumesOnlyWakeOnce() {
        val(c,p)=talking();c.heard(c.snapshot().captureLease,"segunda pergunta");val answer=c.snapshot()
        c.answerReady(answer.turn,answer.generation,"resposta neural")
        assertTrue(p.focusHeld)
        c.suspendForTransientAudioFocusLoss()
        assertEquals(EloVoiceCoordinator.State.SUSPENDED,c.snapshot().state)
        assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture)
        assertTrue(p.focusHeld)
        val speaks=p.speaks
        c.focusReturned()
        assertFalse(p.focusHeld)
        assertEquals(EloVoiceCoordinator.Owner.WAKE,p.capture)
        assertEquals(speaks,p.speaks)
        assertEquals(2,p.events.count { it == "focus-acquire" })
    }
    @Test fun permissionRevocationDoesNotLoop() { val(c,p)=started();c.captureFailed(c.snapshot().captureLease,"PERMISSION_REVOKED");p.advance(200_000);assertEquals(EloVoiceCoordinator.State.SUSPENDED,c.snapshot().state);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture) }
    @Test fun disableCancelsDelayedResume() { val(c,p)=started();c.wakeDetected(c.snapshot().captureLease);p.output=false;c.outputDone(c.snapshot().generation,true);c.disable();p.advance(200_000);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture);assertFalse(c.snapshot().enabled) }
    @Test fun captureMustConfirmRelease() { val(c,p)=started();p.release=false;c.wakeDetected(c.snapshot().captureLease);assertFalse(c.snapshot().enabled);assertEquals(0,p.speaks) }
    @Test fun configuredSilenceRearmRemainsBounded() { val p=VoicePorts();val c=EloVoiceCoordinator(p,1);c.enable();c.wakeDetected(c.snapshot().captureLease);p.output=false;c.outputDone(c.snapshot().generation,true);p.advance(650+9_999);assertEquals(EloVoiceCoordinator.State.BRAIN_LISTENING,c.snapshot().state);p.advance(651);assertEquals(EloVoiceCoordinator.Owner.BRAIN,p.capture) }
    @Test fun fifteenTurnsAcrossNoMatchAndLongSilenceKeepOneOwner() {
        val(c,p)=talking()
        repeat(15) {
            if(it==3 || it==8) p.advance(if(it==3) 30_650 else 61_300)
            c.captureEmpty(c.snapshot().captureLease);p.advance(650)
            c.heard(c.snapshot().captureLease,"pergunta $it");val s=c.snapshot()
            c.answerReady(s.turn,s.generation,"resposta $it");p.output=false;c.outputDone(s.generation,true);p.advance(650)
            assertEquals(EloVoiceCoordinator.Owner.BRAIN,p.capture)
        }
        assertEquals(15,p.requests);assertEquals(1,p.peak)
        c.endConversation();p.advance(200_000);assertEquals(EloVoiceCoordinator.Owner.WAKE,p.capture)
        c.disable();p.advance(200_000);assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture)
    }
    @Test fun recoverableRecognizerErrorsKeepRetryingButOffCancelsBackoff() {
        val(c,p)=talking()
        repeat(5) { c.captureFailed(c.snapshot().captureLease,"SYSTEM_STT_ERROR_2");p.advance(5000) }
        assertEquals(EloVoiceCoordinator.Owner.BRAIN,p.capture)
        c.captureFailed(c.snapshot().captureLease,"SYSTEM_STT_ERROR_8");c.disable();p.advance(200_000)
        assertEquals(EloVoiceCoordinator.Owner.NONE,p.capture)
    }
    @Test fun brainFinalBeforeWakeIsIgnored() { val(c,p)=started();c.heard(c.snapshot().captureLease,"fala ambiente");assertEquals(0,p.requests) }
    @Test fun keywordNeedsConfidenceAndLeadingPosition() {
        fun word(text:String,word:String,confidence:Double)=JSONObject().put("text",text).put("result",JSONArray().put(JSONObject().put("word",word).put("start",0.1).put("end",0.5).put("conf",confidence)))
        assertTrue(EloWakeWordDecision.matches(word("elo","elo",0.99)))
        assertFalse(EloWakeWordDecision.matches(word("elo","elo",0.2)))
        assertFalse(EloWakeWordDecision.matches(word("[unk] elo","[unk]",0.99)))
        assertFalse(EloWakeWordDecision.matches(word("cabelo","cabelo",0.99)))
    }
}
