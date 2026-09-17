package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EloMusicPlayerCoordinatorTest {
    @Test
    fun offlineToOnlineStopsOfflineBeforeOnlineOwnsSlot() {
        val events = mutableListOf<String>()
        val coordinator = EloMusicPlayerCoordinator()
        coordinator.attachOfflineStopper { events += "stop-offline" }
        coordinator.attachOnlineStopper { events += "stop-online" }

        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.OFFLINE)
        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.ONLINE)

        assertEquals(listOf("stop-offline"), events)
        assertEquals(EloMusicPlayerCoordinator.ActivePlayer.ONLINE, coordinator.currentPlayer())
    }

    @Test
    fun onlineToOfflineStopsOnlineBeforeOfflineOwnsSlot() {
        val events = mutableListOf<String>()
        val coordinator = EloMusicPlayerCoordinator()
        coordinator.attachOfflineStopper { events += "stop-offline" }
        coordinator.attachOnlineStopper { events += "stop-online" }

        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.ONLINE)
        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.OFFLINE)

        assertEquals(listOf("stop-online"), events)
        assertEquals(EloMusicPlayerCoordinator.ActivePlayer.OFFLINE, coordinator.currentPlayer())
    }

    @Test
    fun samePlayerIsReusedWithoutStoppingItself() {
        var stopCount = 0
        val coordinator = EloMusicPlayerCoordinator()
        coordinator.attachOfflineStopper { stopCount++ }
        coordinator.attachOnlineStopper { stopCount++ }

        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.OFFLINE)
        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.OFFLINE)
        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.ONLINE)
        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.ONLINE)

        assertEquals(1, stopCount)
    }

    @Test
    fun alternatingCyclesAlwaysHaveOneOrNoOwner() {
        val coordinator = EloMusicPlayerCoordinator()
        val sequence = listOf(
            EloMusicPlayerCoordinator.ActivePlayer.OFFLINE,
            EloMusicPlayerCoordinator.ActivePlayer.ONLINE,
            EloMusicPlayerCoordinator.ActivePlayer.OFFLINE,
            EloMusicPlayerCoordinator.ActivePlayer.ONLINE
        )

        sequence.forEach { target ->
            coordinator.activatePlayer(target)
            assertTrue(coordinator.currentPlayer() == target)
            assertFalse(coordinator.currentPlayer() == EloMusicPlayerCoordinator.ActivePlayer.NONE)
        }
    }

    @Test
    fun explicitStopReturnsToNoneWithoutChangingOtherEngineOwnership() {
        val coordinator = EloMusicPlayerCoordinator()
        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.ONLINE)
        coordinator.deactivatePlayer(EloMusicPlayerCoordinator.ActivePlayer.ONLINE)

        assertEquals(EloMusicPlayerCoordinator.ActivePlayer.NONE, coordinator.currentPlayer())
    }

    @Test
    fun stopActivePlayerStopsCurrentOwnerAndClearsOwnership() {
        val events = mutableListOf<String>()
        val coordinator = EloMusicPlayerCoordinator()
        coordinator.attachOfflineStopper { events += "offline-stop" }
        coordinator.attachOnlineStopper { events += "online-stop" }

        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.ONLINE)
        coordinator.stopActivePlayer()

        assertEquals(listOf("online-stop"), events)
        assertEquals(EloMusicPlayerCoordinator.ActivePlayer.NONE, coordinator.currentPlayer())
    }

    @Test
    fun stopDuringHandoffCannotResurrectTheTargetOwner() {
        val coordinator = EloMusicPlayerCoordinator()
        coordinator.attachOnlineStopper { coordinator.stopActivePlayer() }

        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.ONLINE)
        coordinator.activatePlayer(EloMusicPlayerCoordinator.ActivePlayer.OFFLINE)

        assertEquals(EloMusicPlayerCoordinator.ActivePlayer.NONE, coordinator.currentPlayer())
    }
}
