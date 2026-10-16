package br.com.icaroamaral.elo

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.ServiceWorkerClient
import android.webkit.ServiceWorkerController
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
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
import java.io.ByteArrayInputStream
import androidx.activity.ComponentActivity
import android.widget.Toast

class MainActivity : ComponentActivity() {
    private val originPolicy = EloTrustedOriginPolicy()
    private val mainHandler = Handler(Looper.getMainLooper())
    private lateinit var performanceTimeline: EloPerformanceTimeline
    private lateinit var rootFrame: FrameLayout
    private lateinit var verticalRoot: LinearLayout
    private lateinit var musicPanelSlot: FrameLayout
    private lateinit var webView: WebView
    private lateinit var loading: ProgressBar
    private lateinit var offlineStatus: TextView
    private var musicPanel: LinearLayout? = null
    private var statusBarInsetTop = 0
    private lateinit var bridge: EloNativeBridge
    private lateinit var wakeController: EloWakeController
    private lateinit var offlineController: EloOfflineController
    private val playerCoordinator = EloMusicPlayerCoordinator()
    private var lastConnectivityState: EloConnectivityState? = null
    @Volatile private var currentPageUrl: String? = null
    private var pendingWebAudioRequest: PermissionRequest? = null
    private var brainWebChannel: EloNativeBrainWebChannel? = null
    private lateinit var fileChooserController: EloFileChooserController

    private val connectivityTicker = object : Runnable {
        override fun run() {
            renderConnectivityState()
            mainHandler.postDelayed(this, CONNECTIVITY_TICK_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        performanceTimeline = (application as? EloApplication)?.performanceTimeline
            ?: EloPerformanceTimeline().also { it.mark(EloPerformanceTimeline.APP_PROCESS_START) }
        performanceTimeline.mark(EloPerformanceTimeline.ACTIVITY_CREATE)
        fileChooserController = EloFileChooserController(this)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        wakeController = EloWakeController(this)
        offlineController = EloOfflineController(
            context = this,
            playbackUiCallback = { event -> mainHandler.post { renderPlaybackEvent(event) } },
            routeResultCallback = { result -> mainHandler.post { showOfflineRouteResult(result) } },
            playerCoordinator = playerCoordinator
        )
        bridge = EloNativeBridge(
            context = this,
            originPolicy = originPolicy,
            currentUrlProvider = { currentPageUrl },
            wakeController = wakeController,
            offlineController = offlineController,
            playerCoordinator = playerCoordinator,
            wakePermissionRequester = { enabled -> requestMicThenSetWake(enabled) },
            performanceTimeline = performanceTimeline
        )
        playerCoordinator.attachOfflineStopper { offlineController.stopForArbitration() }
        playerCoordinator.attachOnlineStopper { stopOnlinePlayerForArbitration() }
        playerCoordinator.attachOfflinePauser { offlineController.pauseOfflineTrack() }
        playerCoordinator.attachOnlinePauser {
            if (::webView.isInitialized && originPolicy.isTrustedUrl(webView.url.orEmpty()))
                webView.evaluateJavascript("window.EloMediaPlayer?.getSource?.()?.pause?.()", null)
        }
        EloMusicPlayerCoordinatorRegistry.register(playerCoordinator)
        configureQaServiceWorker()
        buildShell()
        brainWebChannel = EloNativeBrainWebChannel(webView) { requestMicThenSetWake(true) }
        if (!restoreWebViewState(savedInstanceState)) {
            webView.loadUrl(ELO_WEB_URL)
        }
    }

    override fun onStart() {
        super.onStart()
        EloNativeBrainRegistry.activityVisible = true
        performanceTimeline.mark(EloPerformanceTimeline.RESUME_START)
        mainHandler.removeCallbacks(connectivityTicker)
        mainHandler.post(connectivityTicker)
    }

    override fun onStop() {
        EloNativeBrainRegistry.activityVisible = false
        mainHandler.removeCallbacks(connectivityTicker)
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        mainHandler.postDelayed({ brainWebChannel?.resume() }, 350)
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
        brainWebChannel?.close()
        brainWebChannel = null
        mainHandler.removeCallbacks(connectivityTicker)
        pendingWebAudioRequest?.deny()
        pendingWebAudioRequest = null
        fileChooserController.cancelPending()
        EloMusicPlayerCoordinatorRegistry.unregister(playerCoordinator)
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
                val complete = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED &&
                    (Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
                if (complete && EloNativeVoiceSession.current() != null) {
                    mainHandler.post { wakeController.setWakeEnabled(true) }
                } else {
                    Toast.makeText(this, "Autorize microfone e notificações para ativar o chamado ELO.", Toast.LENGTH_LONG).show()
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
            if (isQaDebugBuild()) settings.cacheMode = WebSettings.LOAD_NO_CACHE
            CookieManager.getInstance().setAcceptCookie(true)
            if (Build.VERSION.SDK_INT >= 26) CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            addJavascriptInterface(bridge, BRIDGE_NAME)
            webViewClient = secureClient()
            webChromeClient = secureChromeClient()
        }
        performanceTimeline.mark(EloPerformanceTimeline.WEBVIEW_CREATED)

        musicPanelSlot = FrameLayout(this).apply {
            visibility = View.GONE
            setPadding(dp(12), dp(8), dp(12), dp(12))
            clipChildren = true
            clipToPadding = true
        }

        verticalRoot = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(musicPanelSlot, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
            addView(offlineStatus, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }

        rootFrame = FrameLayout(this).apply {
            addView(verticalRoot, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            addView(loading, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
            viewTreeObserver.addOnGlobalLayoutListener { clampMusicPanel() }
        }
        rootFrame.setOnApplyWindowInsetsListener { _, insets ->
            val topInset = if (Build.VERSION.SDK_INT >= 30) {
                insets.getInsets(WindowInsets.Type.statusBars()).top
            } else {
                insets.systemWindowInsetTop
            }
            if (topInset != statusBarInsetTop) {
                statusBarInsetTop = topInset
                verticalRoot.setPadding(
                    verticalRoot.paddingLeft,
                    topInset,
                    verticalRoot.paddingRight,
                    verticalRoot.paddingBottom
                )
            }
            insets
        }
        setContentView(rootFrame)
        rootFrame.requestApplyInsets()
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
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
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
        if (wakeController.isWakeEnabled()) {
            request.deny()
            return
        }
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
        if (granted && !wakeController.isWakeEnabled()) {
            request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
        } else {
            request.deny()
            Toast.makeText(this, "O microfone é necessário para usar a voz do ELO.", Toast.LENGTH_LONG).show()
        }
    }

    private fun secureClient(): WebViewClient {
        return object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                return interceptQaWebResource(request.url) ?: super.shouldInterceptRequest(view, request)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return handleNavigation(request.url)
            }

            @Suppress("DEPRECATION")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return handleNavigation(Uri.parse(url))
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                brainWebChannel?.close()
                if (!originPolicy.isTrustedUrl(url) || Uri.parse(url).path != "/elo.html") EloNativeBrainRegistry.clearContext()
                currentPageUrl = url
                performanceTimeline.mark(EloPerformanceTimeline.PAGE_NAVIGATION_START)
                loading.visibility = View.VISIBLE
                if (originPolicy.isTrustedUrl(url)) {
                    view.addJavascriptInterface(bridge, BRIDGE_NAME)
                } else {
                    view.removeJavascriptInterface(BRIDGE_NAME)
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                currentPageUrl = url
                performanceTimeline.mark(EloPerformanceTimeline.DOM_READY)
                loading.visibility = View.GONE
                if (originPolicy.isTrustedUrl(url)) {
                    view.visibility = View.VISIBLE
                    installOfflineChatBridge(view)
                    installEloAppHotfixes(view)
                    brainWebChannel?.install()
                    performanceTimeline.mark(EloPerformanceTimeline.APP_INTERACTIVE)
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

    private fun configureQaServiceWorker() {
        val controller = ServiceWorkerController.getInstance()
        controller.serviceWorkerWebSettings.cacheMode = WebSettings.LOAD_NO_CACHE
        controller.setServiceWorkerClient(object : ServiceWorkerClient() {
            override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? {
                return interceptQaWebResource(request.url)
            }
        })
    }

    private fun interceptQaWebResource(uri: Uri): WebResourceResponse? {
        EloBundledWebResourcePolicy.match(uri.toString())?.let { path ->
            return qaAssetResponse("elo-web" + path, EloBundledWebResourcePolicy.mime(path))
        }
        return when (EloQaWebResourcePolicy.match(isQaDebugBuild(), uri.toString())) {
            EloQaWebResource.HTML -> qaAssetResponse(
                checkNotNull(EloQaWebResource.HTML.assetPath),
                checkNotNull(EloQaWebResource.HTML.mimeType)
            )
            EloQaWebResource.CSS -> qaAssetResponse(
                checkNotNull(EloQaWebResource.CSS.assetPath),
                checkNotNull(EloQaWebResource.CSS.mimeType)
            )
            EloQaWebResource.SERVICE_WORKER -> qaNoOpServiceWorkerResponse()
            null -> null
        }
    }

    private fun qaAssetResponse(assetPath: String, mimeType: String): WebResourceResponse {
        return runCatching {
            WebResourceResponse(mimeType, "UTF-8", 200, "OK", QA_NO_CACHE_HEADERS, assets.open(assetPath))
        }.getOrElse {
            qaTextResponse("QA asset unavailable: $assetPath", 404, "Not Found")
        }
    }

    private fun qaNoOpServiceWorkerResponse(): WebResourceResponse {
        val source = QA_NO_OP_SERVICE_WORKER.toByteArray(Charsets.UTF_8)
        return WebResourceResponse(
            "application/javascript",
            "UTF-8",
            200,
            "OK",
            QA_NO_CACHE_HEADERS,
            ByteArrayInputStream(source)
        )
    }

    private fun qaTextResponse(body: String, statusCode: Int, reason: String): WebResourceResponse {
        return WebResourceResponse(
            "text/plain",
            "UTF-8",
            statusCode,
            reason,
            QA_NO_CACHE_HEADERS,
            ByteArrayInputStream(body.toByteArray(Charsets.UTF_8))
        )
    }

    private fun handleNavigation(uri: Uri): Boolean {
        if (originPolicy.isTrustedUrl(uri.toString())) return false
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
        return true
    }

    private fun isQaDebugBuild(): Boolean = BuildConfig.FLAVOR == "qa" && BuildConfig.BUILD_TYPE == "debug"

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
                showMusicPanel(event.track.title, "Tocando")
                notifyWebPlaybackState("PLAYING", event.track.id, event.track.title)
            }
            is EloOfflinePlaybackUiEvent.PlayingV2 -> {
                showMusicPanel(event.track.title, "Tocando")
                notifyWebPlaybackState("PLAYING", event.track.id, event.track.title)
            }
            is EloOfflinePlaybackUiEvent.PausedV2 -> {
                showMusicPanel(event.track.title, "Pausada")
                notifyWebPlaybackState("PAUSED", event.track.id, event.track.title)
            }
            is EloOfflinePlaybackUiEvent.ErrorV2 -> {
                event.track?.let { showMusicPanel(it.title, "Erro") }
                notifyWebPlaybackState("ERROR", event.track?.id.orEmpty(), event.track?.title.orEmpty(), event.error)
                Toast.makeText(this, event.error, Toast.LENGTH_LONG).show()
            }
            EloOfflinePlaybackUiEvent.Stopped -> {
                hideMusicPanel()
                notifyWebPlaybackState("STOPPED")
            }
        }
    }

    private fun showMusicPanel(track: EloOfflineTrack) = showMusicPanel(track.title, "Tocando")

    private fun showMusicPanel(title: String, state: String = "Tocando") {
        val existing = musicPanel
        if (existing != null) {
            existing.findViewWithTag<TextView>(PLAYER_TITLE_TAG)?.text = title
            existing.findViewWithTag<TextView>(PLAYER_STATE_TAG)?.text = state
            existing.visibility = View.VISIBLE
            musicPanelSlot.visibility = View.VISIBLE
            clampMusicPanel()
            musicPanelSlot.post {
                clampMusicPanel()
                notifyWebViewportChanged()
            }
            return
        }

        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            background = GradientDrawable().apply {
                cornerRadius = dp(18).toFloat()
                setColor(Color.rgb(31, 34, 40))
                setStroke(dp(1), Color.rgb(76, 86, 102))
            }
            elevation = dp(8).toFloat()
            setPadding(dp(8), dp(6), dp(8), dp(6))
            isClickable = true
            isFocusable = false
        }

        val metadata = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8), 0, dp(6), 0)
        }
        metadata.addView(TextView(this).apply {
            tag = PLAYER_TITLE_TAG
            text = title
            textSize = 11f
            setTextColor(Color.WHITE)
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        metadata.addView(TextView(this).apply {
            tag = PLAYER_STATE_TAG
            text = state
            textSize = 9f
            setTextColor(Color.rgb(148, 163, 184))
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        panel.addView(metadata, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        fun addControl(label: String, description: String, action: () -> Unit) {
            controls.addView(Button(this).apply {
                text = label
                contentDescription = description
                minHeight = dp(30)
                minWidth = 0
                textSize = 12f
                setPadding(0, 0, 0, 0)
                setOnClickListener { action() }
            }, LinearLayout.LayoutParams(dp(30), dp(30)).apply { marginStart = dp(2) })
        }
        addControl("‹", "Faixa anterior", { offlineController.previousOfflineTrack() })
        addControl("▶", "Continuar música", { offlineController.resumeOfflineTrack() })
        addControl("Ⅱ", "Pausar música", { offlineController.pauseOfflineTrack() })
        addControl("›", "Próxima faixa", { offlineController.nextOfflineTrack() })
        addControl("■", "Parar música", { offlineController.stopMedia() })
        panel.addView(controls, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        musicPanel = panel
        musicPanelSlot.addView(panel, FrameLayout.LayoutParams(dp(330), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL))
        musicPanelSlot.visibility = View.VISIBLE
        musicPanelSlot.post {
            clampMusicPanel()
            notifyWebViewportChanged()
        }
    }

    private fun hideMusicPanel() {
        musicPanel?.visibility = View.GONE
        musicPanelSlot.visibility = View.GONE
        musicPanelSlot.post { notifyWebViewportChanged() }
    }

    private fun stopOnlinePlayerForArbitration() {
        if (!::webView.isInitialized || !originPolicy.isTrustedUrl(webView.url ?: return)) return
        val completed = java.util.concurrent.CountDownLatch(1)
        webView.post {
            try {
                if (originPolicy.isTrustedUrl(webView.url.orEmpty())) {
                    webView.evaluateJavascript(EloWebViewHotfix.stopOnlinePlayerScript()) {
                        completed.countDown()
                    }
                } else {
                    completed.countDown()
                }
            } catch (_: Throwable) {
                completed.countDown()
            }
        }
        if (android.os.Looper.myLooper() != android.os.Looper.getMainLooper()) {
            completed.await(800, java.util.concurrent.TimeUnit.MILLISECONDS)
        }
    }

    private fun clampMusicPanel() {
        val panel = musicPanel ?: return
        val availableWidth = musicPanelSlot.width - musicPanelSlot.paddingLeft - musicPanelSlot.paddingRight
        if (availableWidth <= 0) return
        val targetWidth = minOf(dp(330), availableWidth)
        val layoutParams = panel.layoutParams ?: return
        if (layoutParams.width != targetWidth) {
            layoutParams.width = targetWidth
            panel.layoutParams = layoutParams
        }
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
  function stopOnlineBeforeMusicRoute(command){
    if (!/\b(toque|toca|tocar|coloque|reproduza|play)\b/i.test(String(command || ''))) return;
    try {
      if (window.__eloNativeStopOnlinePlayer) window.__eloNativeStopOnlinePlayer();
    } catch (_) {}
  }
  function route(command){
    try {
      if (!command || !window.EloNativeBridge || !window.EloNativeBridge.routeOfflineChat) return false;
      stopOnlineBeforeMusicRoute(command);
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
        if (!EloNativeBrainRegistry.activityVisible || EloNativeVoiceSession.current() == null) return false
        val required = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33) required.add(Manifest.permission.POST_NOTIFICATIONS)
        val missing = required.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) {
            wakeController.setWakeEnabled(true)
            return true
        }
        mainHandler.post { if (EloNativeBrainRegistry.activityVisible) requestPermissions(missing.toTypedArray(), REQ_AUDIO) }
        return false
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        const val ELO_WEB_URL = "https://www.icaroamaral.com.br/elo.html?elo-apk=brain-v11"
        const val BRIDGE_NAME = "EloNativeBridge"
        private const val QA_NO_OP_SERVICE_WORKER = "self.addEventListener('install', function(event) { event.waitUntil(self.skipWaiting()); });\nself.addEventListener('activate', function(event) { event.waitUntil(self.clients.claim()); });"
        private val QA_NO_CACHE_HEADERS = mapOf(
            "Cache-Control" to "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma" to "no-cache",
            "Expires" to "0"
        )
        private const val OFFLINE_STATUS_TEXT = "Offline"
        private const val CONNECTIVITY_TICK_MS = 1500L
        private const val REQ_AUDIO = 10
        private const val REQ_WEB_AUDIO = 11
        private const val KEY_WEBVIEW_STATE_SAVED = "webview_state_saved"
        private const val PLAYER_TITLE_TAG = "elo_player_title"
        private const val PLAYER_STATE_TAG = "elo_player_state"
    }
}
