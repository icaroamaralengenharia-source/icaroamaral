package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EloAppShellContractTest {
    @Test
    fun trustedOriginAllowsOnlyOfficialEloHost() {
        val policy = EloTrustedOriginPolicy()

        assertTrue(policy.isTrustedUrl("https://www.icaroamaral.com.br/elo.html"))
        assertTrue(policy.isTrustedUrl("https://www.icaroamaral.com.br/relatorio-qualidade-obras/"))
        assertFalse(policy.isTrustedUrl("http://www.icaroamaral.com.br/elo.html"))
        assertFalse(policy.isTrustedUrl("https://evil.example/elo.html"))
        assertFalse(policy.isTrustedUrl("https://www.icaroamaral.com.br.evil.example/elo.html"))
    }

    @Test
    fun redirectExternalOriginDoesNotRemainTrusted() {
        val policy = EloTrustedOriginPolicy()

        assertTrue(policy.isTrustedUrl("https://www.icaroamaral.com.br/elo.html?next=https://evil.example"))
        assertFalse(policy.isTrustedUrl("https://evil.example/landing"))
    }

    @Test
    fun activityRoutesWebFileChooserToExistingController() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/MainActivity.kt").readText()
        assertTrue(source.contains("class MainActivity : ComponentActivity()"))
        assertTrue(source.contains("EloFileChooserController(this)"))
        assertTrue(source.contains("override fun onShowFileChooser"))
        assertTrue(source.contains("fileChooserController.onShowFileChooser"))
        assertTrue(source.contains("fileChooserController.cancelPending()"))
    }

    @Test
    fun selectedDocumentsKeepReadableUriPermissionWhenProviderSupportsIt() {
        val source = java.io.File("src/main/java/br/com/icaroamaral/elo/EloFileChooserController.kt").readText()

        assertTrue(source.contains("ACTION_OPEN_DOCUMENT"))
        assertTrue(source.contains("takePersistableUriPermission"))
        assertTrue(source.contains("persistReadPermission(result, uris)"))
    }

    @Test
    fun nativeCapabilitiesV1ExposePhotoBridgeDisabled() {
        val json = EloNativeCapabilities().toJson()

        assertTrue(json.contains("\"version\":2"))
        assertTrue(json.contains("\"wake\":true"))
        assertTrue(json.contains("\"nativeTts\":true"))
        assertTrue(json.contains("\"offlineMusic\":true"))
        assertTrue(json.contains("\"offlineCore\":true"))
        assertTrue(json.contains("\"fileChooser\":true"))
        assertTrue(json.contains("\"calculator\":true"))
        assertTrue(json.contains("\"conversions\":true"))
        assertTrue(json.contains("\"engineeringTools\":true"))
        assertTrue(json.contains("\"photoBridge\":false"))
    }
}
