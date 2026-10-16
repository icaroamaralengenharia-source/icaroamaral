package br.com.icaroamaral.elo

import org.junit.Assert.*
import org.junit.Test

class EloBundledWebResourcePolicyTest {
    @Test fun canonicalPathsResolveWithVersionQueryOnlyUnderOfficialOrigin() {
        EloBundledWebResourcePolicy.paths.forEach {
            assertEquals(it, EloBundledWebResourcePolicy.match("https://www.icaroamaral.com.br$it?v=final"))
        }
    }
    @Test fun foreignOriginTraversalAndOtherRoutesNeverResolve() {
        listOf("http://www.icaroamaral.com.br/elo.html", "https://example.com/elo.html",
            "https://www.icaroamaral.com.br:444/elo.html", "https://user@www.icaroamaral.com.br/elo.html",
            "https://www.icaroamaral.com.br/%65lo.html", "https://www.icaroamaral.com.br/../elo.html",
            "https://www.icaroamaral.com.br/api/elo/chat").forEach { assertNull(EloBundledWebResourcePolicy.match(it)) }
    }
}
