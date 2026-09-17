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
    private data class Transition(
        val generation: Long,
        val current: ActivePlayer,
        val target: ActivePlayer
    )
    private var transition: Transition? = null
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
        val plan = synchronized(this) {
            if (activePlayer == target || transition != null) return
            transitionGeneration += 1
            val current = activePlayer
            val next = Transition(transitionGeneration, current, target)
            transition = next
            val stopper = when (current) {
                ActivePlayer.OFFLINE -> offlineStopper
                ActivePlayer.ONLINE -> onlineStopper
                ActivePlayer.NONE -> null
            }
            stopper to next
        }
        var succeeded = false
        try {
            plan.first?.invoke()
            succeeded = true
        } finally {
            synchronized(this) {
                if (transition === plan.second && transitionGeneration == plan.second.generation) {
                    if (succeeded && activePlayer == plan.second.current) {
                        activePlayer = plan.second.target
                    }
                    transition = null
                }
            }
        }
    }

    fun switchPlayer(target: ActivePlayer) = activatePlayer(target)

    fun stopActivePlayer() {
        val plan = synchronized(this) {
            transition?.let { pending ->
                transitionGeneration += 1
                transition = null
                activePlayer = ActivePlayer.NONE
                return
            }
            if (activePlayer == ActivePlayer.NONE) return
            transitionGeneration += 1
            val current = activePlayer
            val next = Transition(transitionGeneration, current, ActivePlayer.NONE)
            transition = next
            val stopper = when (current) {
                ActivePlayer.OFFLINE -> offlineStopper
                ActivePlayer.ONLINE -> onlineStopper
                ActivePlayer.NONE -> null
            }
            stopper to next
        }
        try {
            plan.first?.invoke()
        } finally {
            synchronized(this) {
                if (transition === plan.second) {
                    activePlayer = ActivePlayer.NONE
                    transition = null
                }
            }
        }
    }

    @Synchronized
    fun deactivatePlayer(player: ActivePlayer) {
        if (transition?.current == player) return
        if (activePlayer == player) {
            transitionGeneration += 1
            activePlayer = ActivePlayer.NONE
        }
    }

    @Synchronized
    fun currentPlayer(): ActivePlayer = activePlayer
}
