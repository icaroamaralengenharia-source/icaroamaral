package br.com.icaroamaral.elo

import java.net.URI

internal enum class EloQaWebResource(
    val assetPath: String?,
    val mimeType: String?
) {
    HTML("elo-qa/elo.html", "text/html"),
    CSS("elo-qa/elo.css", "text/css"),
    SERVICE_WORKER(null, null)
}

internal object EloQaWebResourcePolicy {
    private const val HOST = "www.icaroamaral.com.br"

    fun match(isQaDebugBuild: Boolean, rawUrl: String): EloQaWebResource? {
        if (!isQaDebugBuild) return null

        val uri = runCatching { URI(rawUrl) }.getOrNull() ?: return null
        if (!uri.scheme.equals("https", ignoreCase = true)) return null
        if (uri.host?.equals(HOST, ignoreCase = true) != true) return null
        if (uri.port != -1 && uri.port != 443) return null

        return when (uri.rawPath) {
            "/elo.html" -> EloQaWebResource.HTML
            "/elo.css" -> EloQaWebResource.CSS
            "/elo-sw.js" -> EloQaWebResource.SERVICE_WORKER
            else -> null
        }
    }
}
