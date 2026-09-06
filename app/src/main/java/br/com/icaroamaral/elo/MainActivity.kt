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
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.view.WindowManager
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
import android.widget.Toast

class MainActivity : Activity() {
    private val originPolicy = EloTrustedOriginPolicy()
    private val mainHandler = Handler(Looper.getMainLooper())
    private lateinit var rootFrame: FrameLayout
    private lateinit var webView: WebView
    private lateinit var loading: ProgressBar
    private lateinit var offlineStatus: TextView
    private var musicPanel: LinearLayout? = null
    private lateinit var bridge: EloNativeBridge
    private lateinit var wakeController: EloWakeController
    private lateinit var offlineController: EloOfflineController
    private var lastConnectivityState: EloConnectivityState? = null

    private val connectivityTicker = object : Runnable {
        override fun run() {
            renderConnectivityState()
            mainHandler.postDelayed(this, CONNECTIVITY_TICK_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        wakeController = EloWakeController(this)
        offlineController = EloOfflineController(
            context = this,
            playbackUiCallback = { event -> mainHandler.post { renderPlaybackEvent(event) } },
            routeResultCallback = { result -> mainHandler.post { showOfflineRouteResult(result) } }
        )
        bridge = EloNativeBridge(
            originPolicy = originPolicy,
            currentUrlProvider = { if (::webView.isInitialized) webView.url else null },
            wakeController = wakeController,
            offlineController = offlineController
        )
        buildShell()
        webView.loadUrl(ELO_WEB_URL)
        mainHandler.post(connectivityTicker)
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(connectivityTicker)
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
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildShell() {
        loading = ProgressBar(this).apply { visibility = View.VISIBLE }
        offlineStatus = TextView(this).apply {
            text = OFFLINE_STATUS_TEXT
            textSize = 13f
            setTextColor(Color.rgb(32, 32, 32))
            setBackgroundColor(Color.rgb(245, 247, 250))
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(6), dp(12), dp(6))
            visibility = View.GONE
            isClickable = false
            isFocusable = false
        }

        webView = WebView(this).apply {
            configureSecureSettings(settings)
            CookieManager.getInstance().setAcceptCookie(true)
            if (Build.VERSION.SDK_INT >= 26) CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            addJavascriptInterface(bridge, BRIDGE_NAME)
            webViewClient = secureClient()
        }

        val verticalRoot = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
            addView(offlineStatus, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }

        rootFrame = FrameLayout(this).apply {
            addView(verticalRoot, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            addView(loading, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
            viewTreeObserver.addOnGlobalLayoutListener { clampMusicPanel() }
        }
        setContentView(rootFrame)
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
                if (originPolicy.isTrustedUrl(url)) {
                    view.visibility = View.VISIBLE
                    installOfflineChatBridge(view)
                    renderConnectivityState()
                } else {
                    showCompactOfflineStatus()
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    loading.visibility = View.GONE
                    view.visibility = View.VISIBLE
                    showCompactOfflineStatus()
                }
            }
        }
    }

    private fun handleNavigation(uri: Uri): Boolean {
        if (originPolicy.isTrustedUrl(uri.toString())) return false
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
        return true
    }

    private fun renderConnectivityState() {
        val state = EloConnectivity.snapshot(this)
        if (state == lastConnectivityState) return
        lastConnectivityState = state
        if (state == EloConnectivityState.ONLINE_VALIDATED) {
            offlineStatus.visibility = View.GONE
        } else {
            showCompactOfflineStatus()
        }
        clampMusicPanel()
    }

    private fun showCompactOfflineStatus() {
        offlineStatus.text = OFFLINE_STATUS_TEXT
        offlineStatus.visibility = View.VISIBLE
    }

    private fun showOfflineRouteResult(result: EloOfflineRouteResult) {
        if (result.message.isNotBlank()) {
            Toast.makeText(this, result.message, Toast.LENGTH_SHORT).show()
        }
        showCompactOfflineStatus()
    }

    private fun renderPlaybackEvent(event: EloOfflinePlaybackUiEvent) {
        when (event) {
            is EloOfflinePlaybackUiEvent.Playing -> showMusicPanel(event.track)
            EloOfflinePlaybackUiEvent.Stopped -> hideMusicPanel()
        }
    }

    private fun showMusicPanel(track: EloOfflineTrack) {
        val existing = musicPanel
        if (existing != null) {
            existing.findViewWithTag<TextView>(PLAYER_TITLE_TAG)?.text = track.title
            existing.visibility = View.VISIBLE
            clampMusicPanel()
            return
        }

        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(31, 34, 40))
            elevation = dp(8).toFloat()
            setPadding(dp(12), dp(8), dp(12), dp(10))
            isClickable = true
            isFocusable = false
        }

        val handle = TextView(this).apply {
            text = ""
            setBackgroundColor(Color.rgb(128, 136, 148))
            minHeight = dp(10)
            contentDescription = "Arrastar player"
        }
        panel.addView(handle, LinearLayout.LayoutParams(dp(72), dp(5)).apply { gravity = Gravity.CENTER_HORIZONTAL })
        panel.addView(TextView(this).apply {
            tag = PLAYER_TITLE_TAG
            text = track.title
            textSize = 14f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(8))
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        panel.addView(Button(this).apply {
            text = "PARAR"
            setOnClickListener { offlineController.stopMedia() }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        installDragHandle(handle, panel)
        musicPanel = panel
        rootFrame.addView(panel, FrameLayout.LayoutParams(dp(300), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply {
            setMargins(dp(12), dp(12), dp(12), dp(24))
        })
        panel.post { restoreOrPlaceMusicPanel(panel) }
    }

    private fun hideMusicPanel() {
        musicPanel?.visibility = View.GONE
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun installDragHandle(handle: View, panel: View) {
        val slop = ViewConfiguration.get(this).scaledTouchSlop
        var downRawX = 0f
        var downRawY = 0f
        var startX = 0f
        var startY = 0f
        var dragging = false

        handle.setOnTouchListener { view, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downRawX = event.rawX
                    downRawY = event.rawY
                    startX = panel.x
                    startY = panel.y
                    dragging = false
                    view.parent?.requestDisallowInterceptTouchEvent(true)
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - downRawX
                    val dy = event.rawY - downRawY
                    if (!dragging && dx * dx + dy * dy > slop.toFloat() * slop.toFloat()) dragging = true
                    if (dragging) {
                        moveMusicPanel(panel, startX + dx, startY + dy, persist = false)
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (dragging) persistMusicPanel(panel)
                    view.parent?.requestDisallowInterceptTouchEvent(false)
                    true
                }
                else -> false
            }
        }
    }

    private fun restoreOrPlaceMusicPanel(panel: View) {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_PLAYER_MOVED, false)) {
            moveMusicPanel(panel, prefs.getFloat(KEY_PLAYER_X, panel.x), prefs.getFloat(KEY_PLAYER_Y, panel.y), persist = false)
        } else {
            val x = (rootFrame.width - panel.width) / 2f
            val y = (rootFrame.height - panel.height - dp(24)).toFloat()
            moveMusicPanel(panel, x, y, persist = false)
        }
    }

    private fun moveMusicPanel(panel: View, x: Float, y: Float, persist: Boolean) {
        val point = EloDragBounds.clamp(x, y, rootFrame.width, rootFrame.height, panel.width, panel.height, dp(8))
        panel.x = point.x
        panel.y = point.y
        if (persist) persistMusicPanel(panel)
    }

    private fun clampMusicPanel() {
        val panel = musicPanel ?: return
        if (panel.width <= 0 || panel.height <= 0 || rootFrame.width <= 0 || rootFrame.height <= 0) return
        moveMusicPanel(panel, panel.x, panel.y, persist = false)
    }

    private fun persistMusicPanel(panel: View) {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_PLAYER_MOVED, true)
            .putFloat(KEY_PLAYER_X, panel.x)
            .putFloat(KEY_PLAYER_Y, panel.y)
            .apply()
    }

    private fun installOfflineChatBridge(view: WebView) {
        val js = """
(function(){
  if (window.__eloOfflineChatBridgeV1) return;
  window.__eloOfflineChatBridgeV1 = true;
  function candidateText(form){
    var active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT') && active.value) return active.value;
    var fields = form && form.querySelectorAll ? form.querySelectorAll('textarea,input[type=text],input:not([type])') : [];
    for (var i = fields.length - 1; i >= 0; i--) if (fields[i].value) return fields[i].value;
    return '';
  }
  function route(command){
    try {
      if (!command || !window.EloNativeBridge || !window.EloNativeBridge.routeOfflineChat) return false;
      var raw = window.EloNativeBridge.routeOfflineChat(String(command));
      var result = JSON.parse(raw || '{}');
      return !!result.handled;
    } catch (err) { return false; }
  }
  document.addEventListener('submit', function(event){
    if (route(candidateText(event.target))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('keydown', function(event){
    if (event.defaultPrevented || event.key !== 'Enter' || event.shiftKey) return;
    var target = event.target;
    if (!target || (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT')) return;
    if (route(target.value || '')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
        """.trimIndent()
        view.evaluateJavascript(js, null)
    }

    private fun requestMicThenSetWake(enabled: Boolean) {
        if (!enabled) {
            wakeController.setWakeEnabled(false)
            return
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            wakeController.setWakeEnabled(true)
            return
        }
        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_AUDIO)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        const val ELO_WEB_URL = "https://www.icaroamaral.com.br/elo.html"
        const val BRIDGE_NAME = "EloNativeBridge"
        private const val OFFLINE_STATUS_TEXT = "ELO offline - recursos locais disponiveis"
        private const val CONNECTIVITY_TICK_MS = 1500L
        private const val REQ_AUDIO = 10
        private const val PREFS = "elo_shell"
        private const val KEY_PLAYER_MOVED = "player_moved"
        private const val KEY_PLAYER_X = "player_x"
        private const val KEY_PLAYER_Y = "player_y"
        private const val PLAYER_TITLE_TAG = "elo_player_title"
    }
}
