package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertTrue

class EloSingleActivePlayerContractTest {
    @Test
    fun nativeAndWebViewShareCentralArbitrationHooks() {
        val bridge = java.io.File("src/main/java/br/com/icaroamaral/elo/EloNativeBridge.kt").readText()
        val activity = java.io.File("src/main/java/br/com/icaroamaral/elo/MainActivity.kt").readText()
        val hotfix = EloWebViewHotfix.installScript()

        assertTrue(bridge.contains("activateOnlinePlayer"))
        assertTrue(bridge.contains("notifyOnlinePlayerStopped"))
        assertTrue(activity.contains("private val playerCoordinator = EloMusicPlayerCoordinator()"))
        assertTrue(activity.contains("attachOfflineStopper"))
        assertTrue(activity.contains("attachOnlineStopper"))
        assertTrue(activity.contains("stopOnlineBeforeMusicRoute"))
        assertTrue(hotfix.contains("window.__eloNativeStopOnlinePlayer"))
        assertTrue(hotfix.contains("stopOnlinePlayerDom()"))
        assertTrue(hotfix.contains("callNativeOnlinePlayer()"))
        assertTrue(hotfix.contains("removeAttribute('src')"))
        assertTrue(hotfix.contains("media.pause()"))
        assertTrue(activity.contains("stopOnlineBeforeMusicRoute(command)"))
        assertTrue(activity.contains("toque|toca|tocar|coloque|reproduza|play"))
        assertTrue(!activity.contains("toque|toca|tocar|coloque|reproduza|play|parar|pare|pausa|pausar|pause|stop|para"))
    }

    @Test
    fun voiceStopHasMediaPriorityBeforeBackendRouting() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/EloWakeService.kt").readText()

        assertTrue(source.contains("EloVoiceMediaCommand.isStopCommandForActiveMusic"))
        assertTrue(source.contains("mediaState != MediaPlaybackState.MEDIA_IDLE && isMediaStopIntent(normalized)"))
        assertTrue(source.contains("stopExternalMedia(normalized)"))
    }

    @Test
    fun staleOfflineCallbacksRequireCurrentGenerationAndOfflineOwnership() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/EloOfflineV2Controller.kt").readText()

        assertTrue(source.contains("private data class PendingAction(val generation: Long"))
        assertTrue(source.contains("private var playbackGeneration = 0L"))
        assertTrue(source.contains("pendingAction = null"))
        assertTrue(source.contains("if (!canExecute(generation)) return"))
        assertTrue(source.contains("generation == playbackGeneration"))
        assertTrue(source.contains("isOfflineOwner()"))
        assertTrue(source.contains("playCurrent(track, generation)"))
    }

    @Test
    fun externalYoutubeLaunchStopsInternalOwnerBeforeIntent() {
        val service = java.io.File("src/main/java/br/com/icaroamaral/elo/EloWakeService.kt").readText()
        val stopIndex = service.indexOf("EloMusicPlayerCoordinatorRegistry.stopActivePlayer()")
        val intentIndex = service.indexOf("Intent(Intent.ACTION_VIEW")

        assertTrue(stopIndex >= 0)
        assertTrue(intentIndex > stopIndex)
    }
}
