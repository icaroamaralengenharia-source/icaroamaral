package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EloAuthUxContractTest {
    private val source by lazy {
        java.io.File("src/main/java/br/com/icaroamaral/elo/EloWebViewHotfix.kt").readText()
    }

    @Test
    fun t01PersistedSessionUsesAuthenticatedState() {
        assertTrue(source.contains("ELO_AUTH_SESSION_VALIDATED === true"))
        assertTrue(source.contains("'AUTHENTICATED'"))
        assertTrue(source.contains("elo-authenticated"))
    }

    @Test
    fun t02MissingSessionKeepsLoginAvailable() {
        assertTrue(source.contains("'LOGGED_OUT'"))
        assertTrue(source.contains(".elo-local-auth"))
        assertFalse(source.contains("elo-chat-state .elo-local-auth{display:none!important;}"))
    }

    @Test
    fun t03LoginIsHiddenOnlyAfterAuthentication() {
        assertTrue(source.contains(".elo-authenticated .elo-local-auth{display:none!important;}"))
        assertTrue(source.contains("state === 'AUTHENTICATED'"))
    }

    @Test
    fun t04AuthenticationSuccessHasVisibleIndicator() {
        assertTrue(source.contains("elo-native-auth-chip"))
        assertTrue(source.contains("Sessão ativa"))
        assertTrue(source.contains("Sessão autenticada"))
    }

    @Test
    fun t05RestoringAndAuthenticatingStatesAreExplicit() {
        assertTrue(source.contains("AUTH_RESTORING"))
        assertTrue(source.contains("AUTHENTICATING"))
        assertTrue(source.contains("elo-auth-restoring"))
    }

    @Test
    fun t06FailureStateDoesNotHideLogin() {
        assertTrue(source.contains("AUTH_ERROR"))
        assertTrue(source.contains("elo-auth-error"))
        assertTrue(source.contains("if (state !== 'AUTHENTICATED')"))
    }

    @Test
    fun t07TransientOfflineStateIsExplicit() {
        assertTrue(source.contains("TRANSIENT_OFFLINE"))
        assertTrue(source.contains("elo-transient-offline"))
    }

    @Test
    fun t08AuthStateIsSynchronizedWithChatLayout() {
        assertTrue(source.contains("function syncAuthLayout()"))
        assertTrue(source.contains("syncAuthLayout();"))
        assertTrue(source.contains("data-elo-auth-state"))
    }

    @Test
    fun t09AuthStateDoesNotUseArtificialPolling() {
        assertFalse(source.contains("setInterval(syncAuthLayout"))
        assertTrue(source.contains("MutationObserver(scheduleDynamicSurface)"))
    }

    @Test
    fun t10ChatStateCannotCreateAuthLimbo() {
        assertFalse(source.contains("elo-chat-state .elo-local-auth{display:none!important;}"))
        assertTrue(source.contains("elo-native-auth-chip"))
    }
}
