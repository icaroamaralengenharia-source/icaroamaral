package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EloAppPerceivedPerformanceTest {
    @Test
    fun t01TimelineStoresMonotonicMarks() {
        var now = 100L
        val timeline = EloPerformanceTimeline { now++ }

        assertTrue(timeline.mark(EloPerformanceTimeline.APP_PROCESS_START))
        assertTrue(timeline.mark(EloPerformanceTimeline.APP_INTERACTIVE))
        assertEquals(1L, timeline.snapshot().metrics["TIME_TO_INTERACTIVE"])
    }

    @Test
    fun t02DuplicateMarkDoesNotRewriteFirstObservation() {
        var now = 100L
        val timeline = EloPerformanceTimeline { now++ }

        assertTrue(timeline.mark(EloPerformanceTimeline.CHAT_READY))
        assertFalse(timeline.mark(EloPerformanceTimeline.CHAT_READY))
        assertEquals(100L, timeline.snapshot().marks[EloPerformanceTimeline.CHAT_READY])
    }

    @Test
    fun t03UnknownMarkIsRejected() {
        val timeline = EloPerformanceTimeline { 100L }

        assertFalse(timeline.mark("PROMPT_CONTENT"))
        assertTrue(timeline.snapshot().marks.isEmpty())
    }

    @Test
    fun t04MissingMetricIsNotInvented() {
        val timeline = EloPerformanceTimeline { 100L }

        timeline.mark(EloPerformanceTimeline.USER_SEND_CLICK)
        assertFalse(timeline.snapshot().metrics.containsKey("TIME_TO_FIRST_FEEDBACK"))
    }

    @Test
    fun t05FeedbackMetricUsesOnlyObservedMarks() {
        var now = 100L
        val timeline = EloPerformanceTimeline { now += 25L; now }

        timeline.mark(EloPerformanceTimeline.USER_SEND_CLICK)
        timeline.mark(EloPerformanceTimeline.MESSAGE_RENDERED_LOCAL)
        assertEquals(25L, timeline.snapshot().metrics["TIME_TO_FIRST_FEEDBACK"])
    }

    @Test
    fun t06ResponseMetricUsesRequestAndVisibleResponse() {
        var now = 0L
        val timeline = EloPerformanceTimeline { now += 10L; now }

        timeline.mark(EloPerformanceTimeline.REQUEST_START)
        timeline.mark(EloPerformanceTimeline.FIRST_RESPONSE_DATA)
        timeline.mark(EloPerformanceTimeline.FIRST_VISIBLE_RESPONSE)
        timeline.mark(EloPerformanceTimeline.RESPONSE_COMPLETE)
        assertEquals(20L, timeline.snapshot().metrics["TIME_TO_FIRST_VISIBLE_RESPONSE"])
        assertEquals(30L, timeline.snapshot().metrics["TOTAL_RESPONSE_TIME"])
    }

    @Test
    fun t07OfflineLatencyIsSeparateFromRemoteResponse() {
        var now = 0L
        val timeline = EloPerformanceTimeline { now += 7L; now }

        timeline.mark(EloPerformanceTimeline.OFFLINE_COMMAND_START)
        timeline.mark(EloPerformanceTimeline.OFFLINE_COMMAND_COMPLETE)
        assertEquals(7L, timeline.snapshot().metrics["OFFLINE_COMMAND_LATENCY"])
    }

    @Test
    fun t08FileAndImageMetricsHaveExplicitStartMarks() {
        val timeline = EloPerformanceTimeline { 100L }

        assertTrue(timeline.mark(EloPerformanceTimeline.FILE_SELECTION_START))
        assertTrue(timeline.mark(EloPerformanceTimeline.FILE_SELECTION_TO_READY))
        assertTrue(timeline.mark(EloPerformanceTimeline.IMAGE_SELECTION_START))
        assertTrue(timeline.mark(EloPerformanceTimeline.IMAGE_SELECTION_TO_READY))
        assertTrue(timeline.snapshot().metrics.containsKey("FILE_SELECTION_TO_READY"))
        assertTrue(timeline.snapshot().metrics.containsKey("IMAGE_SELECTION_TO_READY"))
    }

    @Test
    fun t09TimelineJsonContainsOnlyMarksAndMetrics() {
        val json = EloPerformanceTimeline { 100L }.toJson()

        assertTrue(json.contains("marks"))
        assertTrue(json.contains("metrics"))
        assertFalse(json.contains("prompt", ignoreCase = true))
        assertFalse(json.contains("response", ignoreCase = true))
    }

    @Test
    fun t10TimelineJsonContainsNoIdentityOrSecretFields() {
        val json = EloPerformanceTimeline { 100L }.toJson()

        listOf("token", "password", "email", "filename", "fileContent").forEach { forbidden ->
            assertFalse(json.contains(forbidden, ignoreCase = true), forbidden)
        }
    }

    @Test
    fun t11ProcessTimelineStartsInApplication() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/EloApplication.kt").readText()

        assertTrue(source.contains("APP_PROCESS_START"))
        assertTrue(source.contains("override fun onCreate"))
    }

    @Test
    fun t12ActivityMarksCreationAndResume() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/MainActivity.kt").readText()

        assertTrue(source.contains("ACTIVITY_CREATE"))
        assertTrue(source.contains("RESUME_START"))
        assertTrue(source.contains("override fun onStart()"))
    }

    @Test
    fun t13WebViewCreationAndNavigationAreMeasured() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/MainActivity.kt").readText()

        assertTrue(source.contains("WEBVIEW_CREATED"))
        assertTrue(source.contains("PAGE_NAVIGATION_START"))
        assertTrue(source.contains("DOM_READY"))
    }

    @Test
    fun t14ConnectivityTickerIsNotStartedByOnCreate() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/MainActivity.kt").readText()
        val createBlock = source.substringBefore("override fun onStart()")

        assertFalse(createBlock.contains("post(connectivityTicker)"))
        assertTrue(source.contains("mainHandler.removeCallbacks(connectivityTicker)"))
    }

    @Test
    fun t15ConnectivityTickerStopsWhenActivityStops() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/MainActivity.kt").readText()
        val stopBlock = source.substringAfter("override fun onStop()").substringBefore("override fun onSaveInstanceState")

        assertTrue(stopBlock.contains("removeCallbacks(connectivityTicker)"))
    }

    @Test
    fun t16WebHotfixReportsObservedReadyStages() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/EloWebViewHotfix.kt").readText()

        assertTrue(source.contains("ELO_JS_READY"))
        assertTrue(source.contains("AUTH_READY"))
        assertTrue(source.contains("CHAT_READY"))
    }

    @Test
    fun t17WebHotfixReportsObservedChatLifecycle() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/EloWebViewHotfix.kt").readText()

        assertTrue(source.contains("USER_SEND_CLICK"))
        assertTrue(source.contains("MESSAGE_RENDERED_LOCAL"))
        assertTrue(source.contains("PROCESSING_INDICATOR_VISIBLE"))
        assertTrue(source.contains("FIRST_VISIBLE_RESPONSE"))
    }

    @Test
    fun t18WebHotfixUsesDebouncedDynamicSync() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/EloWebViewHotfix.kt").readText()

        assertTrue(source.contains("dynamicSyncPending"))
        assertTrue(source.contains("scheduleDynamicSurface"))
        assertTrue(source.contains("MutationObserver(scheduleDynamicSurface)"))
    }

    @Test
    fun t19WebHotfixHasNoPermanentPollingLoops() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/EloWebViewHotfix.kt").readText()

        assertFalse(source.contains("window.setInterval(syncConnectivity"))
        assertFalse(source.contains("window.setInterval(installNativeLocalMusicFallback"))
        assertTrue(source.contains("[0, 100, 300, 700, 1500, 3000, 6000]"))
    }

    @Test
    fun t20PerformanceBridgeRemainsTrustedAndSanitized() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/EloNativeBridge.kt").readText()

        assertTrue(source.contains("fun markPerformance(stage: String)"))
        assertTrue(source.contains("if (!isTrustedCaller()) return false"))
        assertTrue(source.contains("fun getPerformanceSnapshot(): String"))
    }
}
