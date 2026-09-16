package br.com.icaroamaral.elo

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
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
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import android.widget.Toast

class MainActivity : ComponentActivity() {
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
    @Volatile private var currentPageUrl: String? = null
    private var pendingWebAudioRequest: PermissionRequest? = null
    private lateinit var fileChooserController: EloFileChooserController

    private val connectivityTicker = object : Runnable {
        override fun run() {
            renderConnectivityState()
            mainHandler.postDelayed(this, CONNECTIVITY_TICK_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        fileChooserController = EloFileChooserController(this)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        wakeController = EloWakeController(this)
        offlineController = EloOfflineController(
            context = this,
            playbackUiCallback = { event -> mainHandler.post { renderPlaybackEvent(event) } },
            routeResultCallback = { result -> mainHandler.post { showOfflineRouteResult(result) } }
        )
        bridge = EloNativeBridge(
            context = this,
            originPolicy = originPolicy,
            currentUrlProvider = { currentPageUrl },
            wakeController = wakeController,
            offlineController = offlineController,
            wakePermissionRequester = { enabled -> requestMicThenSetWake(enabled) }
        )
        buildShell()
        if (!restoreWebViewState(savedInstanceState)) {
            webView.loadUrl(ELO_WEB_URL)
        }
        mainHandler.post(connectivityTicker)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::webView.isInitialized) {
            webView.saveState(outState)
            outState.putBoolean(KEY_WEBVIEW_STATE_SAVED, true)
        }
        super.onSaveInstanceState(outState)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        rootFrame.post {
            clampMusicPanel()
            notifyWebViewportChanged()
        }
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(connectivityTicker)
        pendingWebAudioRequest?.deny()
        pendingWebAudioRequest = null
        fileChooserController.cancelPending()
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

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        when (requestCode) {
            REQ_AUDIO -> {
                if (granted) {
                    mainHandler.post { wakeController.setWakeEnabled(true) }
                } else {
                    Toast.makeText(this, "O microfone é necessário para ativar a voz do ELO.", Toast.LENGTH_LONG).show()
                }
            }
            REQ_WEB_AUDIO -> completePendingWebAudioPermission(granted)
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
            webChromeClient = secureChromeClient()
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
        settings.mediaPlaybackRequiresUserGesture = false
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

    private fun restoreWebViewState(savedInstanceState: Bundle?): Boolean {
        if (savedInstanceState?.getBoolean(KEY_WEBVIEW_STATE_SAVED) != true) return false
        val restoredHistory = webView.restoreState(savedInstanceState) ?: return false
        if (restoredHistory.size <= 0) return false
        return true
    }

    private fun secureChromeClient(): WebChromeClient {
        return object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: android.webkit.ValueCallback<Array<Uri>>?,
                fileChooserParams: WebChromeClient.FileChooserParams?
            ): Boolean = fileChooserController.onShowFileChooser(webView, filePathCallback, fileChooserParams)

            override fun onPermissionRequest(request: PermissionRequest) {
                mainHandler.post { handleWebPermissionRequest(request) }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                mainHandler.post {
                    if (pendingWebAudioRequest === request) pendingWebAudioRequest = null
                }
            }
        }
    }

    private fun handleWebPermissionRequest(request: PermissionRequest) {
        val audioResources = request.resources.filter {
            it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
        }.toTypedArray()
        if (audioResources.isEmpty() || !originPolicy.isTrustedUrl(request.origin?.toString())) {
            request.deny()
            return
        }

        pendingWebAudioRequest?.takeUnless { it === request }?.deny()
        pendingWebAudioRequest = null
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            request.grant(audioResources)
            return
        }

        pendingWebAudioRequest = request
        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_WEB_AUDIO)
    }

    private fun completePendingWebAudioPermission(granted: Boolean) {
        val request = pendingWebAudioRequest
        pendingWebAudioRequest = null
        if (request == null) return
        if (granted) {
            request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
        } else {
            request.deny()
            Toast.makeText(this, "O microfone é necessário para usar a voz do ELO.", Toast.LENGTH_LONG).show()
        }
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
                currentPageUrl = url
                loading.visibility = View.VISIBLE
                if (originPolicy.isTrustedUrl(url)) {
                    view.addJavascriptInterface(bridge, BRIDGE_NAME)
                } else {
                    view.removeJavascriptInterface(BRIDGE_NAME)
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                currentPageUrl = url
                loading.visibility = View.GONE
                if (originPolicy.isTrustedUrl(url)) {
                    view.visibility = View.VISIBLE
                    installOfflineChatBridge(view)
                    installEloAppHotfixes(view)
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
        notifyWebConnectivityState()
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
            is EloOfflinePlaybackUiEvent.Playing -> {
                showMusicPanel(event.track)
                notifyWebPlaybackState("PLAYING", event.track.id, event.track.title)
            }
            is EloOfflinePlaybackUiEvent.PlayingV2 -> {
                showMusicPanel(event.track.title)
                notifyWebPlaybackState("PLAYING", event.track.id, event.track.title)
            }
            is EloOfflinePlaybackUiEvent.PausedV2 -> {
                showMusicPanel(event.track.title)
                notifyWebPlaybackState("PAUSED", event.track.id, event.track.title)
            }
            is EloOfflinePlaybackUiEvent.ErrorV2 -> {
                event.track?.let { showMusicPanel(it.title) }
                notifyWebPlaybackState("ERROR", event.track?.id.orEmpty(), event.track?.title.orEmpty(), event.error)
                Toast.makeText(this, event.error, Toast.LENGTH_LONG).show()
            }
            EloOfflinePlaybackUiEvent.Stopped -> {
                hideMusicPanel()
                notifyWebPlaybackState("STOPPED")
            }
        }
    }

    private fun showMusicPanel(track: EloOfflineTrack) = showMusicPanel(track.title)

    private fun showMusicPanel(title: String) {
        val existing = musicPanel
        if (existing != null) {
            existing.findViewWithTag<TextView>(PLAYER_TITLE_TAG)?.text = title
            existing.visibility = View.VISIBLE
            clampMusicPanel()
            return
        }

        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(31, 34, 40))
            elevation = dp(8).toFloat()
            setPadding(dp(8), dp(6), dp(8), dp(8))
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
            text = title
            textSize = 12f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(8))
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        fun addControl(label: String, description: String, action: () -> Unit) {
            controls.addView(Button(this).apply {
                text = label
                contentDescription = description
                minHeight = dp(34)
                minWidth = 0
                textSize = 10f
                setPadding(dp(2), 0, dp(2), 0)
                setOnClickListener { action() }
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        }
        addControl("ANTERIOR", "Faixa anterior", { offlineController.previousOfflineTrack() })
        addControl("PARAR", "Parar música", { offlineController.stopMedia() })
        addControl("PRÓXIMA", "Próxima faixa", { offlineController.nextOfflineTrack() })
        panel.addView(controls, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        installDragHandle(handle, panel)
        musicPanel = panel
        rootFrame.addView(panel, FrameLayout.LayoutParams(dp(210), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.RIGHT).apply {
            setMargins(dp(12), dp(72), dp(12), dp(12))
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
            val y = dp(72).toFloat()
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

    private fun notifyWebViewportChanged() {
        if (!::webView.isInitialized || !originPolicy.isTrustedUrl(webView.url ?: return)) return
        webView.evaluateJavascript(
            """
(function(){
  window.dispatchEvent(new Event('resize'));
  if (window.visualViewport) {
    window.visualViewport.dispatchEvent(new Event('resize'));
    window.visualViewport.dispatchEvent(new Event('scroll'));
  }
})();
            """.trimIndent(),
            null
        )
    }

    private fun persistMusicPanel(panel: View) {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_PLAYER_MOVED, true)
            .putFloat(KEY_PLAYER_X, panel.x)
            .putFloat(KEY_PLAYER_Y, panel.y)
            .apply()
    }

    private fun installEloAppHotfixes(view: WebView) {
        view.evaluateJavascript(EloWebViewHotfix.installScript(), null)
        notifyWebConnectivityState()
    }

    private fun installOfflineChatBridge(view: WebView) {
        val js = """
(function(){
  if (window.__eloOfflineChatBridgeV1) return;
  window.__eloOfflineChatBridgeV1 = true;
  function candidateText(form){
    var active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT') && active.value) return active.value;
    var fields = form && form.querySelectorAll
      ? form.querySelectorAll('textarea,input[type=text],input:not([type])')
      : document.querySelectorAll('textarea,input[type=text],input:not([type])');
    for (var i = fields.length - 1; i >= 0; i--) if (fields[i].value) return fields[i].value;
    return '';
  }
  function trace(stage, command, online, engine, handled, requiresInternet, action, reason){
    try {
      if (window.EloNativeBridge && window.EloNativeBridge.traceRouting) {
        window.EloNativeBridge.traceRouting(stage, String(command || ''), 'TEXT', String(online || ''), String(engine || ''), !!handled, !!requiresInternet, String(action || ''), String(reason || ''));
      }
    } catch (_) {}
  }
  function renderLocalMessage(role, text){
    var messages = document.querySelector('.elo-messages');
    if (!messages) throw new Error('ELO_RENDER_MESSAGES_NOT_FOUND');
    var item = document.createElement('article');
    item.className = 'elo-message ' + String(role || 'assistant');
    var bubble = document.createElement('div');
    bubble.className = 'elo-message-bubble';
    bubble.textContent = String(text || '');
    item.appendChild(bubble);
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    if (document.body) {
      document.body.classList.add('elo-chat-state');
      document.body.classList.remove('elo-empty-state');
    }
  }
  function clearLocalComposer(){
    var input = document.querySelector('.elo-input');
    if (!input) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function route(command){
    try {
      if (!command || !window.EloNativeBridge || !window.EloNativeBridge.routeOfflineChat) return false;
      trace('ELO_TRACE_01_COMPOSER_INPUT', command, '', '', false, false, '', 'composer_route');
      trace('ELO_TRACE_03_WEB_ROUTE_LOCAL', command, '', '', false, false, '', 'before_native_bridge');
      var raw = window.EloNativeBridge.routeOfflineChat(String(command));
      var result = JSON.parse(raw || '{}');
      trace('ELO_TRACE_09_RESPONSE_TO_WEBVIEW', command, '', result.route || '', !!result.handled, !!result.requiresInternet, result.action || result.state || '', 'native_result');
      if (!result.handled) {
        trace('ELO_TRACE_10_BACKEND_FALLBACK', command, '', result.route || '', false, !!result.requiresInternet, '', result.requiresInternet ? 'requires_internet' : 'native_not_handled');
        return false;
      }
      try {
        renderLocalMessage('user', command);
        renderLocalMessage('assistant', result.text || result.message || '');
        clearLocalComposer();
      } catch (err) {
        trace('ELO_TRACE_RENDER_ERROR', command, '', result.route || '', true, !!result.requiresInternet, '', (err.name || 'Error') + ':' + (err.message || 'render_failed'));
      }
      return true;
    } catch (err) {
      trace('ELO_TRACE_10_BACKEND_FALLBACK', command, '', '', false, false, '', 'route_exception');
      return false;
    }
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
  document.addEventListener('click', function(event){
    var target = event.target;
    var button = target && target.closest ? target.closest('button,[role="button"]') : null;
    if (!button || button.getAttribute('data-elo-native-no-chat-submit') === 'true') return;
    var form = button.closest ? button.closest('form') : null;
    var command = candidateText(form);
    if (command && route(command)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
        """.trimIndent()
        view.evaluateJavascript(js, null)
    }

    private fun notifyWebPlaybackState(
        state: String,
        trackId: String = "",
        title: String = "",
        error: String? = null
    ) {
        if (!::webView.isInitialized || !originPolicy.isTrustedUrl(webView.url ?: return)) return
        webView.evaluateJavascript(EloWebViewHotfix.playbackScript(state, trackId, title, error), null)
    }

    private fun notifyWebConnectivityState() {
        if (!::webView.isInitialized || !originPolicy.isTrustedUrl(webView.url ?: return)) return
        webView.evaluateJavascript(EloWebViewHotfix.connectivityScript(EloConnectivity.snapshot(this).name), null)
    }

    private fun requestMicThenSetWake(enabled: Boolean): Boolean {
        if (!enabled) {
            wakeController.setWakeEnabled(false)
            return true
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            wakeController.setWakeEnabled(true)
            return true
        }
        mainHandler.post { requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_AUDIO) }
        return false
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        const val ELO_WEB_URL = "https://www.icaroamaral.com.br/elo.html"
        const val BRIDGE_NAME = "EloNativeBridge"
        private const val OFFLINE_STATUS_TEXT = "Offline"
        private const val CONNECTIVITY_TICK_MS = 1500L
        private const val REQ_AUDIO = 10
        private const val REQ_WEB_AUDIO = 11
        private const val PREFS = "elo_shell"
        private const val KEY_PLAYER_MOVED = "player_moved"
        private const val KEY_PLAYER_X = "player_x"
        private const val KEY_PLAYER_Y = "player_y"
        private const val KEY_WEBVIEW_STATE_SAVED = "webview_state_saved"
        private const val PLAYER_TITLE_TAG = "elo_player_title"
    }
}
