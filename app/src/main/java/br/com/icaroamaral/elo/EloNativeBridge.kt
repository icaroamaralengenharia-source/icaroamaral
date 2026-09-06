package br.com.icaroamaral.elo

import android.webkit.JavascriptInterface

class EloNativeBridge(
    private val originPolicy: EloTrustedOriginPolicy,
    private val currentUrlProvider: () -> String?,
    private val wakeController: EloWakeController,
    private val offlineController: EloOfflineController,
    private val capabilities: EloNativeCapabilities = EloNativeCapabilities(),
    private val dispatchGate: EloOfflineDispatchGate = EloOfflineDispatchGate()
) {
    @JavascriptInterface
    fun getCapabilities(): String {
        if (!isTrustedCaller()) return unavailableJson()
        return capabilities.toJson()
    }

    @JavascriptInterface
    fun getConnectivityState(): String {
        if (!isTrustedCaller()) return "{\"trusted\":false}"
        return "{\"trusted\":true,\"state\":\"" + offlineController.connectivityState() + "\"}"
    }

    @JavascriptInterface
    fun playOfflineMusic(command: String): String {
        if (!isTrustedCaller()) return "{\"trusted\":false,\"handled\":false}"
        return routeTrustedOfflineCommand(command)
    }

    @JavascriptInterface
    fun routeOfflineChat(command: String): String {
        if (!isTrustedCaller()) return "{\"trusted\":false,\"handled\":false}"
        return routeTrustedOfflineCommand(command)
    }

    @JavascriptInterface
    fun stopMedia(): String {
        if (!isTrustedCaller()) return "{\"trusted\":false,\"ok\":false}"
        return offlineController.stopMedia()
    }

    @JavascriptInterface
    fun isWakeEnabled(): Boolean {
        return isTrustedCaller() && wakeController.isWakeEnabled()
    }

    @JavascriptInterface
    fun setWakeEnabled(enabled: Boolean): Boolean {
        if (!isTrustedCaller()) return false
        return wakeController.setWakeEnabled(enabled)
    }

    private fun routeTrustedOfflineCommand(command: String): String {
        val connectivity = EloConnectivityState.valueOf(offlineController.connectivityState())
        return when (dispatchGate.evaluate(command, connectivity)) {
            EloOfflineDispatchDecision.RouteWeb -> "{\"trusted\":true,\"handled\":false,\"route\":\"web\"}"
            EloOfflineDispatchDecision.Duplicate -> "{\"trusted\":true,\"handled\":true,\"duplicate\":true,\"route\":\"native\"}"
            EloOfflineDispatchDecision.DispatchNative -> offlineController.playOfflineMusic(command)
        }
    }

    private fun isTrustedCaller(): Boolean = originPolicy.isTrustedUrl(currentUrlProvider())

    private fun unavailableJson(): String {
        return "{\"version\":1,\"wake\":false,\"nativeTts\":false,\"offlineMusic\":false,\"offlineCore\":false,\"photoBridge\":false}"
    }
}
