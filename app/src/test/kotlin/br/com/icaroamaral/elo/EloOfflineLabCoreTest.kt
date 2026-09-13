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
        assertEquals(EloOfflineIntent.CALCULATOR, EloOfflineRouter.detectIntent("17% de 850"))
        assertEquals(EloOfflineIntent.CONVERSION, EloOfflineRouter.detectIntent("3,5 metros em centimetros"))
        assertEquals(EloOfflineIntent.ENGINEERING, EloOfflineRouter.detectIntent("laje de 8 por 12 com 12 cm de espessura"))
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

    @Test
    fun localToolsResolveWithoutProviderOrChatCalls() {
        val router = EloOfflineRouter(FakeMemory(), emptyList())
        assertEquals("4", router.route("2 + 2").message)
        assertEquals("90", router.route("25 vezes 3,6").message)
        assertEquals("144,5", router.route("17% de 850").message)
        assertEquals("12", router.route("raiz de 144").message)
        assertEquals("144", router.route("12 elevado a 2").message)
        assertEquals("840", router.route("(35 x 18) + 210").message)
        assertEquals("10", router.route("media de 8, 10 e 12").message)
        assertEquals("350 cm", router.route("3,5 metros em centimetros").message)
        assertEquals("18.000 L", router.route("18 m3 em litros").message)
        assertEquals("25.000 kPa", router.route("25 MPa em kPa").message)
        assertEquals("20.000 m²", router.route("2 hectares em m2").message)
        assertEquals("1,5 m", router.route("1500 mm em m").message)
        val concrete = router.route("laje de 8 por 12 com 12 cm de espessura")
        assertTrue(concrete.handled)
        assertEquals(EloOfflineIntent.ENGINEERING, concrete.intent)
        assertTrue(concrete.message.contains("11,52 m³"))
        assertTrue(concrete.message.contains("8 x 12 x 0,12 = 11,52 m³"))
        assertTrue(router.route("área de 5 por 8").message.contains("40 m²"))
        assertTrue(router.route("perímetro de 5 por 8").message.contains("26 m"))
        assertTrue(router.route("rampa sobe 0,5 m em 10 m").message.contains("5%"))
        assertEquals(0, concrete.providerCalls)
        assertEquals(0, concrete.chatCalls)
    }

    @Test
    fun localCalculatorBlocksInjectionAndDivisionByZero() {
        val router = EloOfflineRouter(FakeMemory(), emptyList())
        assertFalse(router.route("alert(1)").handled)
        assertFalse(router.route("window.location").handled)
        assertFalse(router.route("fetch('https://x.test')").handled)
        assertFalse(router.route("__proto__").handled)
        assertTrue(router.route("10 / 0").message.contains("dividir por zero"))
    }

    private class FakeMemory : EloOfflineMemoryContract {
        override fun remember(command: String): String? = "ok"
        override fun answer(command: String): String? = "ok"
    }
}
