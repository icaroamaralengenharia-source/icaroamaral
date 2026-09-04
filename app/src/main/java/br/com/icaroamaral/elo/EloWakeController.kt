package br.com.icaroamaral.elo

import android.content.Context
import android.content.Intent
import android.os.Build

class EloWakeController(private val context: Context) {
    fun isWakeEnabled(): Boolean = EloServiceSettings.isServiceEnabled(context)

    fun setWakeEnabled(enabled: Boolean): Boolean {
        EloServiceSettings.setServiceEnabled(context, enabled)
        val intent = Intent(context, EloWakeService::class.java).setAction(
            if (enabled) EloWakeService.ACTION_START else EloWakeService.ACTION_STOP
        )
        if (enabled && Build.VERSION.SDK_INT >= 26) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        return true
    }
}
