package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class EloPhysicalOfflineContractTest {
    @Test
    fun offlineSupportedMusicCommandsDispatchNativeOnce() {
        var now = 10_000L
        val gate = EloOfflineDispatchGate(clock = { now })

        for (command in listOf(
            "toque Beethoven",
            "toque Debussy",
            "toque Vivaldi",
            "toque Pachelbel",
            "toque Chopin",
            "pare"
        )) {
            now += 2_000L
            assertEquals(
                EloOfflineDispatchDecision.DispatchNative,
                gate.evaluate(command, EloConnectivityState.OFFLINE),
                command
            )
        }
    }

    @Test
    fun onlineValidatedKeepsWebFlow() {
        val gate = EloOfflineDispatchGate(clock = { 1_000L })

        assertEquals(
            EloOfflineDispatchDecision.RouteWeb,
            gate.evaluate("toque Beethoven", EloConnectivityState.ONLINE_VALIDATED)
        )
    }

    @Test
    fun unsupportedOfflineTextKeepsWebFlowUnlessItIsHonestMusicMiss() {
        val gate = EloOfflineDispatchGate(clock = { 1_000L })

        assertEquals(EloOfflineDispatchDecision.RouteWeb, gate.evaluate("oi", EloConnectivityState.OFFLINE))
        assertEquals(EloOfflineDispatchDecision.DispatchNative, gate.evaluate("toque Take On Me", EloConnectivityState.OFFLINE))
    }

    @Test
    fun duplicateOfflineCommandDoesNotDispatchAgainInsideWindow() {
        var now = 1_000L
        val gate = EloOfflineDispatchGate(clock = { now })

        assertEquals(EloOfflineDispatchDecision.DispatchNative, gate.evaluate("toque Beethoven", EloConnectivityState.OFFLINE))
        now += 400L
        assertEquals(EloOfflineDispatchDecision.Duplicate, gate.evaluate("toque Beethoven", EloConnectivityState.OFFLINE))
        now += 2_000L
        assertEquals(EloOfflineDispatchDecision.DispatchNative, gate.evaluate("toque Beethoven", EloConnectivityState.OFFLINE))
    }

    @Test
    fun dragClampKeepsPlayerVisible() {
        val topLeft = EloDragBounds.clamp(-500f, -300f, 1080, 1920, 320, 180, 16)
        assertEquals(16f, topLeft.x)
        assertEquals(16f, topLeft.y)

        val bottomRight = EloDragBounds.clamp(2_000f, 3_000f, 1080, 1920, 320, 180, 16)
        assertEquals(744f, bottomRight.x)
        assertEquals(1724f, bottomRight.y)
    }

    @Test
    fun mainActivityKeepsOfflineStatusCompactAndNonBlocking() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/MainActivity.kt").readText()
        assertTrue(source.contains("ELO offline - recursos locais disponiveis"))
        assertTrue(source.contains("isClickable = false"))
        assertTrue(source.contains("SOFT_INPUT_ADJUST_RESIZE"))
        assertTrue(source.contains("addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))"))
    }
}
