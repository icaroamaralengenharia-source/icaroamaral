package br.com.icaroamaral.elo

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

interface EloPreferenceStore {
    fun getBoolean(key: String, defaultValue: Boolean): Boolean
    fun putBoolean(key: String, value: Boolean)
}

class EloServiceState(private val store: EloPreferenceStore) {
    fun isEnabled(): Boolean = store.getBoolean(EloServiceSettings.KEY_SERVICE_ENABLED, false)

    fun setEnabled(enabled: Boolean) {
        store.putBoolean(EloServiceSettings.KEY_SERVICE_ENABLED, enabled)
    }
}

class AndroidEloPreferenceStore(context: Context) : EloPreferenceStore {
    private val prefs = context.applicationContext.getSharedPreferences(EloServiceSettings.PREFS_NAME, Context.MODE_PRIVATE)

    override fun getBoolean(key: String, defaultValue: Boolean): Boolean = prefs.getBoolean(key, defaultValue)

    override fun putBoolean(key: String, value: Boolean) {
        prefs.edit().putBoolean(key, value).apply()
    }
}

object EloServiceSettings {
    const val PREFS_NAME = "elo_service_settings"
    const val KEY_SERVICE_ENABLED = "elo_service_enabled"

    fun state(context: Context): EloServiceState = EloServiceState(AndroidEloPreferenceStore(context))

    fun isServiceEnabled(context: Context): Boolean = state(context).isEnabled()

    fun setServiceEnabled(context: Context, enabled: Boolean) {
        state(context).setEnabled(enabled)
    }

    fun shouldRestoreAfterBoot(action: String?, serviceEnabled: Boolean): Boolean {
        return serviceEnabled && action == Intent.ACTION_BOOT_COMPLETED
    }

    fun isBatteryOptimizationIgnored(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < 23) return true
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun batteryOptimizationSettingsIntent(): Intent {
        return Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
}
