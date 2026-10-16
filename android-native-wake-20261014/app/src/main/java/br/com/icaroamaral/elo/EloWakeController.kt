package br.com.icaroamaral.elo

import android.content.Context
import android.content.Intent
import android.os.Build

class EloWakeController(private val context: Context) {
    fun isWakeEnabled(): Boolean = EloNativeBrainRegistry.enabled || EloNativeBrainRegistry.preparing

    fun setWakeEnabled(enabled: Boolean): Boolean {
        if (!enabled) {
            EloNativeBrainRegistry.clearContext()
            EloServiceSettings.setServiceEnabled(context, false)
            if (EloNativeBrainRegistry.command == null) context.stopService(Intent(context, EloWakeService::class.java))
            return true
        }
        if (!EloNativeBrainRegistry.activityVisible || EloNativeVoiceSession.current() == null) return false
        val intent = Intent(context, EloWakeService::class.java).setAction(
            if (enabled) EloWakeService.ACTION_START else EloWakeService.ACTION_STOP
        )
        intent.putExtra(EloWakeService.EXTRA_VISIBLE_ACTIVATION, true)
        if (enabled && Build.VERSION.SDK_INT >= 26) {
            try { context.startForegroundService(intent) } catch (_: RuntimeException) { return false }
        } else {
            context.startService(intent)
        }
        return true
    }
}
