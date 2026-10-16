package br.com.icaroamaral.elo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class EloQaShellContractTest {
    @Test
    fun `local HTML and CSS are selected by exact secure origin and path including query strings`() {
        assertEquals(
            EloQaWebResource.HTML,
            EloQaWebResourcePolicy.match(true, "https://www.icaroamaral.com.br/elo.html?v=qa-20261008")
        )
        assertEquals(
            EloQaWebResource.CSS,
            EloQaWebResourcePolicy.match(true, "https://www.icaroamaral.com.br/elo.css?cache=1")
        )
        assertEquals(
            EloQaWebResource.SERVICE_WORKER,
            EloQaWebResourcePolicy.match(true, "https://www.icaroamaral.com.br/elo-sw.js?cache=1")
        )
        assertEquals("elo-qa/elo.html", EloQaWebResource.HTML.assetPath)
        assertEquals("text/html", EloQaWebResource.HTML.mimeType)
        assertEquals("elo-qa/elo.css", EloQaWebResource.CSS.assetPath)
        assertEquals("text/css", EloQaWebResource.CSS.mimeType)
    }

    @Test
    fun `resource policy fails closed outside QA debug origin and exact assets`() {
        val htmlUrl = "https://www.icaroamaral.com.br/elo.html"
        assertNull(EloQaWebResourcePolicy.match(false, htmlUrl))
        assertNull(EloQaWebResourcePolicy.match(true, "http://www.icaroamaral.com.br/elo.html"))
        assertNull(EloQaWebResourcePolicy.match(true, "https://evil.example/elo.html"))
        assertNull(EloQaWebResourcePolicy.match(true, "https://sub.www.icaroamaral.com.br/elo.html"))
        assertNull(EloQaWebResourcePolicy.match(true, "https://www.icaroamaral.com.br:444/elo.html"))
        assertNull(EloQaWebResourcePolicy.match(true, "https://www.icaroamaral.com.br/api/items"))
        assertNull(EloQaWebResourcePolicy.match(true, "not a URL"))
    }

    @Test
    fun `QA injection keeps one online marker menu logout and EDU-REX while leaving actions layout to web CSS`() {
        val script = EloWebViewHotfix.installScript()

        assertTrue(script.contains("window.__eloAndroid021PhysicalHotfixV1"))
        assertTrue(script.contains("window.__eloAndroidHeaderQaOverridesV1"))
        assertTrue(script.contains("if (isQaBuild || pageHasOnlineIndicator())"))
        assertTrue(script.contains("if (state !== 'AUTHENTICATED' || isQaBuild)"))
        assertTrue(script.contains("data-elo-qa-edurex-menu-item"))
        assertTrue(script.contains("[data-elo-qa-edurex-menu-item],[data-elo-mobile-menu-action=\"edurex\"]"))
        assertTrue(script.contains("if (!eduItem.__eloQaEduRexBound)"))
        assertTrue(script.contains("data-elo-mobile-menu-action=\"logout\""))
        assertTrue(script.contains("var logoutItems = menu.querySelectorAll"))
        assertTrue(script.contains("closeCompactMenu()"))
        assertTrue(script.contains("window.EloPauseGame"))
        assertTrue(script.contains("setFallbackEduRex(true)"))
        assertFalse(script.contains("body[data-elo-product=\"chat\"] .elo-core-actions{display:flex"))
        assertFalse(script.contains("body[data-elo-product=\"chat\"] .elo-core-actions{grid-column"))
        assertFalse(script.contains("nativeStyle.textContent = nativeStyle.textContent"))
    }
}
