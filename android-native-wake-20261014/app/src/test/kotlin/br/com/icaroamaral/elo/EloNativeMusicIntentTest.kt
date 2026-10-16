package br.com.icaroamaral.elo

import org.junit.Assert.*
import org.junit.Test

class EloNativeMusicIntentTest {
    @Test fun naturalMusicCommandsAreIndependentOfTitleAndArtist() {
        listOf("Toque Sultans of Swing", "ELO, toque Clair de Lune", "Coloque uma música de Maria Bethânia", "Reproduza Take on Me", "Ponha Für Elise", "play qualquer título").forEach { assertTrue(it, EloNativeMusicIntent.matches(it)) }
    }
    @Test fun generalConversationDoesNotBecomeMusic() {
        listOf("O projeto se chama Aurora", "O que significa toque sutil?", "Qual será a primeira etapa?", "Bom dia").forEach { assertFalse(it, EloNativeMusicIntent.matches(it)) }
    }
    @Test fun musicControlsReuseExistingAliases() {
        listOf("pause a música", "próxima música", "retome a música", "pare a música").forEach { assertTrue(it, EloNativeMusicIntent.matches(it)) }
    }
    @Test fun wakingPausesExistingMusicAndPreservesItsOwner() {
        val c=EloMusicPlayerCoordinator();var pauses=0;var stops=0
        c.attachOnlineStopper { stops++ };c.attachOnlinePauser { pauses++ }
        c.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.ONLINE);c.pauseActivePlayer()
        assertEquals(1,pauses);assertEquals(0,stops);assertEquals(EloMusicPlayerCoordinator.ActivePlayer.ONLINE,c.currentPlayer())
    }
}
