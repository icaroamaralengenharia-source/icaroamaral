package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class EloPhysicalOfflineContractTest {

    @Test
    fun gradleVersionMatchesHotfixApk() {
        val gradle = java.io.File("build.gradle.kts").readText()

        assertTrue(gradle.contains("versionCode = 3"))
        assertTrue(gradle.contains("versionName = \"0.3.0\""))
    }

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

        assertEquals(EloOfflineDispatchDecision.DispatchNative, gate.evaluate("oi", EloConnectivityState.OFFLINE))
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
        assertTrue(source.contains("OFFLINE_STATUS_TEXT = \"Offline\""))
        assertTrue(source.contains("isClickable = false"))
        assertTrue(source.contains("SOFT_INPUT_ADJUST_RESIZE"))
        assertTrue(source.contains("mediaPlaybackRequiresUserGesture = false"))
        assertTrue(source.contains("addView(offlineStatus, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))"))
        assertTrue(source.contains("addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))"))
    }
    @Test
    fun mainActivityPreservesWebViewAcrossRotationAndRestore() {
        val manifest = java.io.File("src/main/AndroidManifest.xml").readText()
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/MainActivity.kt").readText()

        assertTrue(manifest.contains("android:configChanges=\"keyboard|keyboardHidden|orientation|screenSize|smallestScreenSize\""))
        assertTrue(source.contains("override fun onSaveInstanceState(outState: Bundle)"))
        assertTrue(source.contains("webView.saveState(outState)"))
        assertTrue(source.contains("private fun restoreWebViewState(savedInstanceState: Bundle?): Boolean"))
        assertTrue(source.contains("webView.restoreState(savedInstanceState)"))
        assertTrue(source.contains("if (!restoreWebViewState(savedInstanceState))"))
        assertTrue(source.contains("webView.loadUrl(ELO_WEB_URL)"))
    }

    @Test
    fun orientationChangeRefreshesViewportWithoutDuplicatingBridge() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/MainActivity.kt").readText()

        assertTrue(source.contains("override fun onConfigurationChanged(newConfig: Configuration)"))
        assertTrue(source.contains("clampMusicPanel()"))
        assertTrue(source.contains("notifyWebViewportChanged()"))
        assertTrue(source.contains("window.dispatchEvent(new Event('resize'))"))
        assertTrue(source.contains("window.visualViewport.dispatchEvent(new Event('resize'))"))
        assertTrue(source.contains("if (window.__eloOfflineChatBridgeV1) return;"))
    }
    @Test
    fun appInjectsWebHotfixesForHeaderHistoryDateAndConnectivity() {
        val main = java.io.File("src/main/java/br/com/icaroamaral/elo/MainActivity.kt").readText()
        val bridge = java.io.File("src/main/java/br/com/icaroamaral/elo/EloNativeBridge.kt").readText()
        val hotfix = java.io.File("src/main/java/br/com/icaroamaral/elo/EloWebViewHotfix.kt").readText()

        assertTrue(main.contains("installEloAppHotfixes(view)"))
        assertTrue(main.contains("notifyWebConnectivityState()"))
        assertTrue(main.contains("wakePermissionRequester = { enabled -> requestMicThenSetWake(enabled) }"))
        assertTrue(main.contains("mainHandler.post { wakeController.setWakeEnabled(true) }"))
        assertTrue(main.contains("mainHandler.post { requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_AUDIO) }"))
        assertTrue(bridge.contains("fun getLocalDateTimeAnswer(command: String): String"))
        assertTrue(bridge.contains("fun playResolvedOfflineMusic(command: String): String"))
        assertTrue(bridge.contains("offlineController.playOfflineMusic(command)"))
        assertTrue(bridge.contains("ZonedDateTime.now()"))
        assertTrue(hotfix.contains("elo-native-status-chip"))
        assertTrue(hotfix.contains("elo-native-pause-button"))
        assertTrue(hotfix.contains("EDU-REX"))
        assertTrue(hotfix.contains("window.EloPauseGame.open()"))
        assertTrue(hotfix.contains("playResolvedOfflineMusic"))
        assertTrue(hotfix.contains("ELO_NATIVE_LOCAL_MUSIC_FALLBACK"))
        assertTrue(hotfix.contains("normalizeActionButtons"))
        assertTrue(hotfix.contains("data-elo-native-no-chat-submit"))
        assertTrue(hotfix.contains("Carregando histórico..."))
        assertTrue(hotfix.contains("sem resumo salvo"))
        assertTrue(hotfix.contains("removeIntrusiveOfflineNotices"))
        assertTrue(hotfix.contains("data-elo-native-hidden-offline-notice"))
        assertTrue(hotfix.contains("getLocalDateTimeAnswer"))
        assertTrue(hotfix.contains("que dia e hoje"))
        assertTrue(hotfix.contains("qual e a data de hoje"))
        assertTrue(hotfix.contains("qual o horario"))
        assertTrue(hotfix.contains("que horas sao"))
        assertTrue(hotfix.contains("grid-template-columns:repeat(auto-fit"))
        assertTrue(hotfix.contains("data-elo-history-panel"))
        assertTrue(hotfix.contains("__eloAndroid021PhysicalHotfixV1"))
    }

    @Test
    fun wakeServiceHandlesDateTimeAndWakeOnlyLocally() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/EloWakeService.kt").readText()

        assertTrue(source.contains("handleLocalDateTimeCommand(cleanCommand)"))
        assertTrue(source.contains("resolveLocalDateTimeAnswer(command: String)"))
        assertTrue(source.contains("LOCAL_DEVICE_TIME"))
        assertTrue(source.contains("SKIPPED_LOCAL_DEVICE_TIME"))
        assertTrue(source.contains("acknowledgeWakeOnly()"))
        assertTrue(source.contains("WAKE_LOCAL"))
        assertTrue(source.contains("Bom dia. Pode falar."))
        assertTrue(source.contains("Boa tarde. Pode falar."))
        assertTrue(source.contains("Boa noite. Pode falar."))
    }
    @Test
    fun nativePlayerStartsCompactAwayFromComposer() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/MainActivity.kt").readText()

        assertTrue(source.contains("FrameLayout.LayoutParams(dp(250), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.RIGHT)"))
        assertTrue(source.contains("setMargins(dp(12), dp(72), dp(12), dp(12))"))
        assertTrue(source.contains("val y = dp(72).toFloat()"))
        assertTrue(source.contains("textSize = 12f"))
    }
}
