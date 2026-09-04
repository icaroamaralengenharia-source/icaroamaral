package br.com.icaroamaral.elo

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

class MainActivity : Activity() {
    private val originPolicy = EloTrustedOriginPolicy()
    private lateinit var webView: WebView
    private lateinit var loading: ProgressBar
    private lateinit var offlineView: LinearLayout
    private lateinit var wakeStatus: TextView
    private lateinit var bridge: EloNativeBridge
    private lateinit var wakeController: EloWakeController
    private lateinit var offlineController: EloOfflineController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        wakeController = EloWakeController(this)
        offlineController = EloOfflineController(this)
        bridge = EloNativeBridge(
            originPolicy = originPolicy,
            currentUrlProvider = { webView.url },
            wakeController = wakeController,
            offlineController = offlineController
        )
        buildShell()
        webView.loadUrl(ELO_WEB_URL)
    }

    override fun onDestroy() {
        offlineController.release()
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface(BRIDGE_NAME)
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
            return
        }
        super.onBackPressed()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_AUDIO && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            wakeController.setWakeEnabled(true)
        }
        renderWakeState()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildShell() {
        loading = ProgressBar(this).apply { visibility = View.VISIBLE }
        wakeStatus = TextView(this).apply {
            textSize = 14f
            setTextColor(Color.rgb(32, 32, 32))
        }

        offlineView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(40, 40, 40, 40)
            visibility = View.GONE
            addView(TextView(this@MainActivity).apply {
                text = "ELO esta offline"
                textSize = 24f
                gravity = Gravity.CENTER
            })
            addView(TextView(this@MainActivity).apply {
                text = "Capacidades locais disponiveis: wake, TTS local, pare e musica offline."
                textSize = 15f
                gravity = Gravity.CENTER
            })
            addView(Button(this@MainActivity).apply {
                text = "TENTAR CARREGAR ELO WEB"
                setOnClickListener {
                    showWeb()
                    webView.loadUrl(ELO_WEB_URL)
                }
            })
            addView(Button(this@MainActivity).apply {
                text = "ATIVAR WAKE"
                setOnClickListener { requestMicThenSetWake(true) }
            })
            addView(Button(this@MainActivity).apply {
                text = "DESATIVAR WAKE"
                setOnClickListener {
                    wakeController.setWakeEnabled(false)
                    renderWakeState()
                }
            })
            addView(Button(this@MainActivity).apply {
                text = "PARAR AUDIO"
                setOnClickListener { offlineController.stopMedia() }
            })
            addView(wakeStatus)
        }

        webView = WebView(this).apply {
            configureSecureSettings(settings)
            CookieManager.getInstance().setAcceptCookie(true)
            if (Build.VERSION.SDK_INT >= 26) CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            addJavascriptInterface(bridge, BRIDGE_NAME)
            webViewClient = secureClient()
        }

        setContentView(FrameLayout(this).apply {
            addView(webView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            addView(offlineView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            addView(loading, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
        })
        renderWakeState()
    }

    private fun configureSecureSettings(settings: WebSettings) {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false
        if (Build.VERSION.SDK_INT >= 26) settings.safeBrowsingEnabled = true
        WebView.setWebContentsDebuggingEnabled(false)
    }

    private fun secureClient(): WebViewClient {
        return object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return handleNavigation(request.url)
            }

            @Suppress("DEPRECATION")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return handleNavigation(Uri.parse(url))
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                loading.visibility = View.VISIBLE
                if (originPolicy.isTrustedUrl(url)) {
                    view.addJavascriptInterface(bridge, BRIDGE_NAME)
                } else {
                    view.removeJavascriptInterface(BRIDGE_NAME)
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                loading.visibility = View.GONE
                if (originPolicy.isTrustedUrl(url)) showWeb() else showOffline()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showOffline()
            }
        }
    }

    private fun handleNavigation(uri: Uri): Boolean {
        if (originPolicy.isTrustedUrl(uri.toString())) return false
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
        return true
    }

    private fun showWeb() {
        offlineView.visibility = View.GONE
        webView.visibility = View.VISIBLE
    }

    private fun showOffline() {
        loading.visibility = View.GONE
        webView.visibility = View.GONE
        offlineView.visibility = View.VISIBLE
        renderWakeState()
    }

    private fun requestMicThenSetWake(enabled: Boolean) {
        if (!enabled) {
            wakeController.setWakeEnabled(false)
            renderWakeState()
            return
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            wakeController.setWakeEnabled(true)
            renderWakeState()
            return
        }
        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_AUDIO)
    }

    private fun renderWakeState() {
        wakeStatus.text = "Wake: " + if (wakeController.isWakeEnabled()) "ATIVO" else "INATIVO"
    }

    companion object {
        const val ELO_WEB_URL = "https://www.icaroamaral.com.br/elo.html"
        const val BRIDGE_NAME = "EloNativeBridge"
        private const val REQ_AUDIO = 10
    }
}
