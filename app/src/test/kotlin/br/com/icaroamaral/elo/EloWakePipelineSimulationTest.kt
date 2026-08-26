package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EloWakePipelineSimulationTest {
    private class FakeWakePipeline {
        var commandListening = false
            private set
        var dispatchStarted = false
            private set
        var restartScheduled = false
            private set
        var concurrentStarts = 0
            private set
        var mediaTouched = false
            private set
        var commandBuffer = ""
            private set
        val events = mutableListOf<String>()

        fun onBeginningOfSpeech() {
            events += "WAKE_ON_BEGINNING_OF_SPEECH"
        }

        fun onErrorNoMatch() {
            events += "ERROR_NO_MATCH"
            scheduleRestart()
        }

        fun onResults(results: List<String>) {
            events += "WAKE_ON_RESULTS"
            val selected = EloWakeParser.selectBestWakeHypothesis(results)
            events += "NORMALIZED=${selected.normalized}"
            events += "WAKE_ALIAS=${selected.aliasMatched}"
            events += "WAKE_MATCH=${selected.wakeMatched}"
            events += "COMMAND_AFTER_WAKE=${selected.commandAfterWake}"
            events += "WAKE_DECISION=${selected.decision.name}"

            when (selected.decision) {
                EloWakeParser.WakeDecision.NO_WAKE -> scheduleRestart()
                EloWakeParser.WakeDecision.WAKE_ONLY -> commandListening = true
                EloWakeParser.WakeDecision.WAKE_WITH_COMMAND -> {
                    commandBuffer = selected.commandAfterWake
                    dispatchStarted = true
                    events += "COMMAND_DISPATCH_START"
                }
            }
        }

        fun onEndOfSpeech() {
            events += "WAKE_ON_END"
        }

        private fun scheduleRestart() {
            if (!restartScheduled) {
                restartScheduled = true
                events += "WAKE_RESTART_SCHEDULED"
            } else {
                concurrentStarts += 1
            }
        }
    }

    @Test
    fun errorNoMatchSchedulesRestartWithoutDispatchOrMediaChange() {
        val pipeline = FakeWakePipeline()
        pipeline.onBeginningOfSpeech()
        pipeline.onErrorNoMatch()

        assertFalse(pipeline.dispatchStarted)
        assertFalse(pipeline.mediaTouched)
        assertTrue(pipeline.restartScheduled)
        assertEquals(0, pipeline.concurrentStarts)
        assertEquals(listOf("WAKE_ON_BEGINNING_OF_SPEECH", "ERROR_NO_MATCH", "WAKE_RESTART_SCHEDULED"), pipeline.events)
    }

    @Test
    fun validResultsDispatchBeforeOnEndCanRestartAnything() {
        val pipeline = FakeWakePipeline()
        pipeline.onResults(listOf("elo toque sultans of swing"))
        pipeline.onEndOfSpeech()

        assertEquals("toque sultans of swing", pipeline.commandBuffer)
        assertTrue(pipeline.dispatchStarted)
        assertFalse(pipeline.restartScheduled)
        assertTrue(pipeline.events.indexOf("COMMAND_DISPATCH_START") < pipeline.events.indexOf("WAKE_ON_END"))
    }

    @Test
    fun wakeOnlyEntersCommandListeningWithoutDispatch() {
        val pipeline = FakeWakePipeline()
        pipeline.onResults(listOf("elo"))

        assertTrue(pipeline.commandListening)
        assertFalse(pipeline.dispatchStarted)
        assertFalse(pipeline.restartScheduled)
    }
}
