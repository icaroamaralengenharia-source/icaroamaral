package br.com.icaroamaral.elo

/** Gives the in-process voice service a safe handoff to the active main-screen player. */
object EloMusicPlayerCoordinatorRegistry {
    @Volatile
    private var coordinator: EloMusicPlayerCoordinator? = null

    @Synchronized
    fun register(value: EloMusicPlayerCoordinator) {
        coordinator = value
    }

    @Synchronized
    fun unregister(value: EloMusicPlayerCoordinator) {
        if (coordinator === value) coordinator = null
    }

    fun stopActivePlayer() {
        coordinator?.stopActivePlayer()
    }
}
