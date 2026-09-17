package br.com.icaroamaral.elo

/** Owns the single playback slot shared by the native and WebView music players. */
class EloMusicPlayerCoordinator {
    enum class ActivePlayer {
        NONE,
        OFFLINE,
        ONLINE
    }

    private var activePlayer = ActivePlayer.NONE
    private var transitionGeneration = 0L
    private var offlineStopper: (() -> Unit)? = null
    private var onlineStopper: (() -> Unit)? = null

    @Synchronized
    fun attachOfflineStopper(stopper: () -> Unit) {
        offlineStopper = stopper
    }

    @Synchronized
    fun attachOnlineStopper(stopper: () -> Unit) {
        onlineStopper = stopper
    }

    /** Stops the opposite engine before making [target] the owner. */
    fun activatePlayer(target: ActivePlayer) {
        val stoppers = synchronized(this) {
            if (activePlayer == target) return
            transitionGeneration += 1
            val generation = transitionGeneration
            val selected = when (target) {
                ActivePlayer.OFFLINE -> listOfNotNull(onlineStopper)
                ActivePlayer.ONLINE -> listOfNotNull(offlineStopper)
                ActivePlayer.NONE -> listOfNotNull(offlineStopper, onlineStopper)
            }
            activePlayer = ActivePlayer.NONE
            selected to generation
        }
        stoppers.first.forEach { it.invoke() }
        if (target != ActivePlayer.NONE) {
            synchronized(this) {
                if (stoppers.second == transitionGeneration && activePlayer == ActivePlayer.NONE) {
                    activePlayer = target
                }
            }
        }
    }

    fun switchPlayer(target: ActivePlayer) = activatePlayer(target)

    fun stopActivePlayer() {
        val stopper = synchronized(this) {
            transitionGeneration += 1
            val selected = when (activePlayer) {
                ActivePlayer.OFFLINE -> offlineStopper
                ActivePlayer.ONLINE -> onlineStopper
                ActivePlayer.NONE -> null
            }
            activePlayer = ActivePlayer.NONE
            selected
        }
        stopper?.invoke()
    }

    @Synchronized
    fun deactivatePlayer(player: ActivePlayer) {
        if (activePlayer == player) {
            transitionGeneration += 1
            activePlayer = ActivePlayer.NONE
        }
    }

    @Synchronized
    fun currentPlayer(): ActivePlayer = activePlayer
}
