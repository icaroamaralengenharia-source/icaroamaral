package br.com.icaroamaral.elo

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.webkit.JavascriptInterface
import org.json.JSONObject
import java.text.Normalizer
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

class EloNativeBridge(
    private val context: Context,
    private val originPolicy: EloTrustedOriginPolicy,
    private val currentUrlProvider: () -> String?,
    private val wakeController: EloWakeController,
    private val offlineController: EloOfflineController,
    private val wakePermissionRequester: ((Boolean) -> Boolean)? = null,
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
    fun getDiagnostics(): String {
        if (!isTrustedCaller()) return "{\"trusted\":false}"
        return "{" +
            "\"trusted\":true," +
            "\"package\":\"" + escape(BuildConfig.APPLICATION_ID) + "\"," +
            "\"versionName\":\"" + escape(BuildConfig.VERSION_NAME) + "\"," +
            "\"versionCode\":" + BuildConfig.VERSION_CODE + "," +
            "\"gitSha\":\"" + escape(BuildConfig.ELO_BUILD_GIT_SHA) + "\"," +
            "\"timestamp\":\"" + escape(BuildConfig.ELO_BUILD_TIMESTAMP) + "\"," +
            "\"channel\":\"" + escape(BuildConfig.ELO_BUILD_CHANNEL) + "\"," +
            "\"shellSchema\":\"" + escape(BuildConfig.ELO_SHELL_SCHEMA_VERSION) + "\"," +
            "\"webEntrypoint\":\"" + escape(BuildConfig.ELO_WEB_ENTRYPOINT) + "\"," +
            "\"offlineCatalog\":\"" + escape(BuildConfig.ELO_OFFLINE_CATALOG_VERSION) + "\"," +
            "\"capabilities\":" + capabilities.toJson() +
            "}"
    }

    @JavascriptInterface
    fun getDiagnosticsJson(): String {
        if (!isTrustedCaller()) return "{\"trusted\":false}"

        val packageInfo =
            runCatching {
                context.packageManager.getPackageInfo(context.packageName, 0)
            }.getOrNull()

        val json = JSONObject()
        json.put("trusted", true)
        json.put("packageName", context.packageName)
        json.put("versionName", packageInfo?.versionName ?: "unknown")
        json.put(
            "versionCode",
            if (Build.VERSION.SDK_INT >= 28) {
                packageInfo?.longVersionCode ?: -1L
            } else {
                @Suppress("DEPRECATION")
                (packageInfo?.versionCode ?: -1).toLong()
            }
        )
        json.put("gitSha", BuildConfig.ELO_BUILD_GIT_SHA.ifBlank { "unknown" })
        json.put("buildTimestamp", BuildConfig.ELO_BUILD_TIMESTAMP.ifBlank { "unknown" })
        json.put("webEntrypoint", BuildConfig.ELO_WEB_ENTRYPOINT.ifBlank { "unknown" })
        json.put("online", isNetworkAvailable())
        json.put("localTools", true)
        json.put("fileChooser", true)
        json.put("music", true)
        json.put("eduRex", false)
        return json.toString()
    }

    @JavascriptInterface
    fun playOfflineMusic(command: String): String {
        if (!isTrustedCaller()) return "{\"trusted\":false,\"handled\":false}"
        return routeTrustedOfflineCommand(command)
    }

    @JavascriptInterface
    fun playOfflineTrack(trackId: String): String {
        if (!isTrustedCaller()) return "{\"trusted\":false,\"handled\":false}"
        return offlineController.playOfflineTrack(trackId)
    }

    @JavascriptInterface
    fun pauseOfflineTrack(): String {
        if (!isTrustedCaller()) return "{\"trusted\":false,\"handled\":false}"
        return offlineController.pauseOfflineTrack()
    }

    @JavascriptInterface
    fun resumeOfflineTrack(): String {
        if (!isTrustedCaller()) return "{\"trusted\":false,\"handled\":false}"
        return offlineController.resumeOfflineTrack()
    }

    @JavascriptInterface
    fun nextOfflineTrack(): String {
        if (!isTrustedCaller()) return "{\"trusted\":false,\"handled\":false}"
        return offlineController.nextOfflineTrack()
    }

    @JavascriptInterface
    fun previousOfflineTrack(): String {
        if (!isTrustedCaller()) return "{\"trusted\":false,\"handled\":false}"
        return offlineController.previousOfflineTrack()
    }

    @JavascriptInterface
    fun playResolvedOfflineMusic(command: String): String {
        if (!isTrustedCaller()) return "{\"trusted\":false,\"handled\":false}"
        return offlineController.playOfflineMusic(command)
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
        return wakePermissionRequester?.invoke(enabled) ?: wakeController.setWakeEnabled(enabled)
    }

    @JavascriptInterface
    fun getLocalDateTimeAnswer(command: String): String {
        if (!isTrustedCaller()) return ""
        val locale = Locale("pt", "BR")
        val normalized = Normalizer.normalize(command, Normalizer.Form.NFD)
            .replace("\\p{Mn}+".toRegex(), "")
            .lowercase(locale)
        val now = ZonedDateTime.now()
        val date = now.format(DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", locale))
        val time = now.format(DateTimeFormatter.ofPattern("HH:mm", locale))
        val weekday = now.format(DateTimeFormatter.ofPattern("EEEE", locale))
        return when {
            normalized.contains("hora") || normalized.contains("horas") -> "Agora são $time."
            normalized.contains("dia da semana") -> "Hoje é $weekday, $date."
            normalized.contains("dia") || normalized.contains("data") || normalized.contains("hoje") || normalized.contains("pesquise") -> "Hoje é $date."
            else -> ""
        }
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

    private fun isNetworkAvailable(): Boolean {
        val cm =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as?
                ConnectivityManager
                ?: return false

        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false

        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun unavailableJson(): String {
        return "{\"version\":2,\"wake\":false,\"nativeTts\":false,\"offlineMusic\":false,\"offlineCore\":false,\"fileChooser\":false,\"calculator\":false,\"conversions\":false,\"engineeringTools\":false,\"photoBridge\":false}"
    }

    private fun escape(value: String): String {
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r")
    }
}
