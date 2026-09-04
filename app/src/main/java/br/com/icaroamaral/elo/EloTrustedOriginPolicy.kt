package br.com.icaroamaral.elo

import java.net.URI

class EloTrustedOriginPolicy(
    private val trustedOrigins: Set<String> = setOf("https://www.icaroamaral.com.br")
) {
    fun isTrustedUrl(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val uri = runCatching { URI(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase() ?: return false
        val host = uri.host?.lowercase() ?: return false
        val port = if (uri.port == -1) "" else ":" + uri.port
        val origin = "$scheme://$host$port"
        return origin in trustedOrigins
    }
}
