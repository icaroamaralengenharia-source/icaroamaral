package br.com.icaroamaral.elo

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class EloOfflineLabCoreTest {
    private val libraryJson: String
        get() = File("src/main/assets/offline-media/classical/library.json").readText()

    @Test
    fun parsesRealOfflineLibraryFromAssets() {
        val tracks = EloOfflineRouter.parseLibrary(libraryJson)
        assertEquals(5, tracks.size)
        assertEquals(7, tracks.sumOf { it.files.size })
        assertEquals("beethoven-fur-elise", tracks.first().id)
    }

    @Test
    fun mandatoryTracksResolveOffline() {
        val tracks = EloOfflineRouter.parseLibrary(libraryJson)
        assertEquals("beethoven-fur-elise", EloOfflineRouter.findTrack(tracks, "toque Beethoven")?.id)
        assertEquals("debussy-clair-de-lune", EloOfflineRouter.findTrack(tracks, "toque Debussy")?.id)
        assertEquals("vivaldi-four-seasons-spring", EloOfflineRouter.findTrack(tracks, "toque Vivaldi")?.id)
        assertEquals("pachelbel-canon-in-d", EloOfflineRouter.findTrack(tracks, "toque Pachelbel")?.id)
        assertEquals("chopin-nocturne-op-9-no-2", EloOfflineRouter.findTrack(tracks, "toque Chopin")?.id)
    }

    @Test
    fun vivaldiKeepsThreeTrackSequence() {
        val tracks = EloOfflineRouter.parseLibrary(libraryJson)
        val vivaldi = assertNotNull(EloOfflineRouter.findTrack(tracks, "toque Vivaldi"))
        assertEquals(3, vivaldi.files.size)
        assertEquals("offline-media/classical/vivaldi/spring-mvt-1-allegro.oga", vivaldi.files[0].path)
        assertEquals("offline-media/classical/vivaldi/spring-mvt-2-largo.oga", vivaldi.files[1].path)
        assertEquals("offline-media/classical/vivaldi/spring-mvt-3-allegro.oga", vivaldi.files[2].path)
    }

    @Test
    fun takeOnMeDoesNotResolveOffline() {
        val tracks = EloOfflineRouter.parseLibrary(libraryJson)
        assertNull(EloOfflineRouter.findTrack(tracks, "toque Take On Me"))
    }

    @Test
    fun detectsOnlyExplicitOfflineIntents() {
        assertEquals(EloOfflineIntent.MUSIC_PLAY, EloOfflineRouter.detectIntent("toque Beethoven"))
        assertEquals(EloOfflineIntent.MUSIC_STOP, EloOfflineRouter.detectIntent("pare"))
        assertEquals(EloOfflineIntent.MEMORY_WRITE, EloOfflineRouter.detectIntent("lembre que meu cachorro se chama Thor"))
        assertEquals(EloOfflineIntent.MEMORY_READ, EloOfflineRouter.detectIntent("qual o nome do meu cachorro?"))

        for (phrase in listOf(
            "gosto de Beethoven",
            "quem foi Beethoven?",
            "projeto de uma casa",
            "meu cachorro latiu",
            "parede de concreto"
        )) {
            assertEquals(EloOfflineIntent.NONE, EloOfflineRouter.detectIntent(phrase), phrase)
        }
    }

    @Test
    fun connectivityBackendClassificationKeepsAuthErrorsOnline() {
        assertEquals(EloConnectivityState.BACKEND_UNAVAILABLE, EloConnectivity.classifyBackendHttpStatus(502))
        assertEquals(EloConnectivityState.BACKEND_UNAVAILABLE, EloConnectivity.classifyBackendHttpStatus(503))
        assertEquals(EloConnectivityState.BACKEND_UNAVAILABLE, EloConnectivity.classifyBackendHttpStatus(504))
        assertEquals(EloConnectivityState.ONLINE_VALIDATED, EloConnectivity.classifyBackendHttpStatus(401))
        assertEquals(EloConnectivityState.ONLINE_VALIDATED, EloConnectivity.classifyBackendHttpStatus(403))
        assertEquals(EloConnectivityState.BACKEND_UNAVAILABLE, EloConnectivity.classifyBackendThrowable(RuntimeException("dns")))
    }

    @Test
    fun routeReportsUnavailableInsteadOfPretendingMissingMusicPlayed() {
        val tracks = EloOfflineRouter.parseLibrary(libraryJson)
        val router = EloOfflineRouter(FakeMemory(), tracks)
        val result = router.route("toque Take On Me")
        assertTrue(result.handled)
        assertTrue(result.unavailableOffline)
        assertFalse(result.localPlay)
        assertEquals(0, result.providerCalls)
        assertEquals(0, result.chatCalls)
    }

    @Test
    fun stopCommandIsLocalStop() {
        val tracks = EloOfflineRouter.parseLibrary(libraryJson)
        val router = EloOfflineRouter(FakeMemory(), tracks)
        val result = router.route("pare")
        assertTrue(result.handled)
        assertTrue(result.localStop)
        assertEquals(EloOfflineIntent.MUSIC_STOP, result.intent)
    }

    private class FakeMemory : EloOfflineMemoryContract {
        override fun remember(command: String): String? = "ok"
        override fun answer(command: String): String? = "ok"
    }
}
