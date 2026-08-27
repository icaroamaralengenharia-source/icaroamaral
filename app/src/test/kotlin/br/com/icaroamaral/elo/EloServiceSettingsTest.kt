package br.com.icaroamaral.elo

import android.content.Intent
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EloServiceSettingsTest {
    private class FakePreferenceStore : EloPreferenceStore {
        private val values = mutableMapOf<String, Boolean>()

        override fun getBoolean(key: String, defaultValue: Boolean): Boolean = values[key] ?: defaultValue

        override fun putBoolean(key: String, value: Boolean) {
            values[key] = value
        }
    }

    @Test
    fun serviceEnabledPreferenceDefaultsToFalseAndPersists() {
        val state = EloServiceState(FakePreferenceStore())

        assertFalse(state.isEnabled())
        state.setEnabled(true)
        assertTrue(state.isEnabled())
        state.setEnabled(false)
        assertFalse(state.isEnabled())
    }

    @Test
    fun bootRestoreIsIgnoredWhenServiceWasDisabled() {
        assertFalse(EloServiceSettings.shouldRestoreAfterBoot(Intent.ACTION_BOOT_COMPLETED, serviceEnabled = false))
    }

    @Test
    fun bootRestoreStartsOnlyForBootCompletedWhenEnabled() {
        assertTrue(EloServiceSettings.shouldRestoreAfterBoot(Intent.ACTION_BOOT_COMPLETED, serviceEnabled = true))
        assertFalse(EloServiceSettings.shouldRestoreAfterBoot(Intent.ACTION_LOCKED_BOOT_COMPLETED, serviceEnabled = true))
        assertFalse(EloServiceSettings.shouldRestoreAfterBoot("unexpected", serviceEnabled = true))
        assertFalse(EloServiceSettings.shouldRestoreAfterBoot(null, serviceEnabled = true))
    }
}
