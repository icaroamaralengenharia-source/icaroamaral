package br.com.icaroamaral.elo

import java.net.URI

/** Canonical web sources packaged at build time, served under the existing trusted origin. */
internal object EloBundledWebResourcePolicy {
    val paths = setOf(
        "/elo.html", "/elo.css", "/elo-sw.js",
        "/relatorio-qualidade-obras/elo-viewport.js",
        "/relatorio-qualidade-obras/elo-voice-session.js",
        "/relatorio-qualidade-obras/elo-assistente.js",
        "/relatorio-qualidade-obras/elo-media-player.js",
        "/relatorio-qualidade-obras/elo-music-resolver.js",
        "/relatorio-qualidade-obras/elo-offline-media-library.js",
        "/relatorio-qualidade-obras/elo-communication-policy.js",
        "/relatorio-qualidade-obras/elo-proactive-reasoning-policy.js",
        "/relatorio-qualidade-obras/elo-technical-validator.js",
        "/relatorio-qualidade-obras/elo-brain-router.js",
        "/relatorio-qualidade-obras/elo-offline-core-v2.js"
    )
    fun match(rawUrl: String): String? {
        val uri = runCatching { URI(rawUrl) }.getOrNull() ?: return null
        if (uri.scheme != "https" || uri.host != "www.icaroamaral.com.br" || uri.port !in setOf(-1, 443) || uri.userInfo != null) return null
        return uri.rawPath.takeIf { it in paths }
    }
    fun mime(path: String) = when {
        path.endsWith(".html") -> "text/html"
        path.endsWith(".css") -> "text/css"
        else -> "application/javascript"
    }
}
