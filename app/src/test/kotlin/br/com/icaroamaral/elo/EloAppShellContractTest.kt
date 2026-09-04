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
    fun nativeCapabilitiesV1ExposePhotoBridgeDisabled() {
        val json = EloNativeCapabilities().toJson()

        assertTrue(json.contains("\"version\":1"))
        assertTrue(json.contains("\"wake\":true"))
        assertTrue(json.contains("\"nativeTts\":true"))
        assertTrue(json.contains("\"offlineMusic\":true"))
        assertTrue(json.contains("\"offlineCore\":true"))
        assertTrue(json.contains("\"photoBridge\":false"))
    }
}
