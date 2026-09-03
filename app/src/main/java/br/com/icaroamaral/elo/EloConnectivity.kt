package br.com.icaroamaral.elo

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

enum class EloConnectivityState {
    OFFLINE,
    ONLINE_UNVERIFIED,
    ONLINE_VALIDATED,
    BACKEND_UNAVAILABLE
}

object EloConnectivity {
    fun snapshot(context: Context): EloConnectivityState {
        val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return EloConnectivityState.ONLINE_UNVERIFIED
        val network = manager.activeNetwork ?: return EloConnectivityState.OFFLINE
        val capabilities = manager.getNetworkCapabilities(network) ?: return EloConnectivityState.OFFLINE
        if (!capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
            return EloConnectivityState.OFFLINE
        }
        return if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) {
            EloConnectivityState.ONLINE_VALIDATED
        } else {
            EloConnectivityState.ONLINE_UNVERIFIED
        }
    }

    fun classifyBackendHttpStatus(status: Int): EloConnectivityState {
        return when (status) {
            502, 503, 504 -> EloConnectivityState.BACKEND_UNAVAILABLE
            400, 401, 403, 404 -> EloConnectivityState.ONLINE_VALIDATED
            in 200..499 -> EloConnectivityState.ONLINE_VALIDATED
            else -> EloConnectivityState.ONLINE_UNVERIFIED
        }
    }

    fun classifyBackendThrowable(_: Throwable): EloConnectivityState {
        return EloConnectivityState.BACKEND_UNAVAILABLE
    }
}
