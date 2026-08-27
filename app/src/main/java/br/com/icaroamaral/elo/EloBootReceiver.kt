package br.com.icaroamaral.elo

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class EloBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action
        Log.i("EloBootReceiver", "BOOT_RECEIVED action=" + action)

        val enabled = EloServiceSettings.isServiceEnabled(context)
        Log.i("EloBootReceiver", "BOOT_ELO_ENABLED=" + enabled)
        if (!EloServiceSettings.shouldRestoreAfterBoot(action, enabled)) return

        val serviceIntent = Intent(context, EloWakeService::class.java).setAction(EloWakeService.ACTION_RESTORE_AFTER_BOOT)
        Log.i("EloBootReceiver", "BOOT_SERVICE_START_REQUEST")
        runCatching {
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(serviceIntent) else context.startService(serviceIntent)
            Log.i("EloBootReceiver", "BOOT_SERVICE_START_OK")
        }.onFailure { error ->
            Log.e("EloBootReceiver", "BOOT_SERVICE_START_FAIL " + (error.message ?: error.javaClass.simpleName), error)
        }
    }
}
