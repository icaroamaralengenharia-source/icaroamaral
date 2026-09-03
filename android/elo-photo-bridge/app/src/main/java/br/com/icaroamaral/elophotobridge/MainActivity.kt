package br.com.icaroamaral.elophotobridge

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.provider.MediaStore
import android.util.Size
import android.os.Build
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.ImageView
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class MainActivity : ComponentActivity() {
  private val config = BridgeConfig()
  private val screenModel: PhotoBridgeViewModel by viewModels()
  private lateinit var stateStore: PhotoBridgeStateStore
  private lateinit var status: TextView
  private lateinit var summary: TextView
  private lateinit var command: EditText
  private lateinit var webView: WebView
  private lateinit var jsBridge: SelectedPhotoJavascriptBridge
  private lateinit var fastTimelineButton: Button
  private lateinit var runButton: Button
  private lateinit var continueButton: Button
  private lateinit var reviewClassificationButton: Button
  private lateinit var updateButton: Button
  private lateinit var retryButton: Button
  private lateinit var cancelButton: Button
  private lateinit var clearButton: Button
  private lateinit var diagnosticButton: Button
  private var pendingPayloadJson: String? = null
  private var activeJob: Job? = null
  private var candidateGroupsById: Map<String, Pair<ParsedCommand, VisitGroup>> = emptyMap()
  private var currentTimelineCommand: ParsedCommand? = null
  private var currentTimelineGroup: VisitGroup? = null
  private var selectedTimelinePhotoIndex: Int = 0
  private var timelineCuts: MutableMap<PhotoCategory, Int> = mutableMapOf()
  private var restoringText = false

  private val permissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
    val allowed = grants.values.any { it }
    setStatus(if (allowed) "Permissao concedida. Informe o comando." else "Permissao de imagens negada.")
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    stateStore = PhotoBridgeStateStore(this)
    screenModel.state = stateStore.load()
    screenModel.isProcessing = false
    pendingPayloadJson = screenModel.state.payloadJson.takeIf(String::isNotBlank)
    buildUi()
    restoreUi(screenModel.state)
    requestNeededPermissions()
  }

  override fun onStop() {
    super.onStop()
    if (screenModel.isProcessing) {
      cancelActiveJob(PhotoBridgeFlowStatus.READY_TO_RESUME, "Fluxo pausado. Continue ou atualize a busca.")
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  private fun buildUi() {
    status = TextView(this).apply { text = "ELO Photo Bridge" }
    summary = TextView(this).apply { text = "Sem visita preparada." }
    command = EditText(this).apply {
      hint = "ELO, monte o SGTO de Malhada de Pedras"
      setSingleLine(false)
      addTextChangedListener(object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
        override fun afterTextChanged(s: Editable?) {
          if (!restoringText) saveCommandText(s?.toString().orEmpty())
        }
      })
    }
    fastTimelineButton = Button(this).apply {
      text = "ORGANIZAR RÁPIDO"
      setOnClickListener { prepareFastTimelineSearch() }
    }
    runButton = Button(this).apply {
      text = "CLASSIFICAR COM IA"
      setOnClickListener { startAiClassificationFlow() }
    }
    continueButton = Button(this).apply {
      text = "CONTINUAR"
      setOnClickListener { continueFlow() }
    }
    reviewClassificationButton = Button(this).apply {
      text = "REVISAR CLASSIFICAÇÃO"
      setOnClickListener { showClassificationReviewDialog() }
    }
    updateButton = Button(this).apply {
      text = "ATUALIZAR"
      setOnClickListener { startAiClassificationFlow(replaceActive = true) }
    }
    retryButton = Button(this).apply {
      text = "TENTAR NOVAMENTE"
      setOnClickListener { startAiClassificationFlow(replaceActive = true) }
    }
    cancelButton = Button(this).apply {
      text = "CANCELAR"
      setOnClickListener { cancelActiveJob(PhotoBridgeFlowStatus.CANCELLED, "Busca cancelada. Dados preservados.") }
    }
    clearButton = Button(this).apply {
      text = "LIMPAR"
      setOnClickListener { confirmClearState() }
    }
    diagnosticButton = Button(this).apply {
      text = "DIAGNÓSTICO DA SELEÇÃO"
      setOnClickListener { showSelectionDiagnosticPanel() }
    }
    jsBridge = SelectedPhotoJavascriptBridge(
      context = this,
      onBridgeReady = {
        runOnUiThread {
          setStatus("Enviando dados da visita...", PhotoBridgeFlowStatus.OPENING_REPORT)
          injectPayload()
        }
      },
      onPayloadAccepted = { inserted, failed ->
        runOnUiThread {
          val message = if (failed > 0) "$inserted foto(s) carregada(s). $failed apresentou/apresentaram erro." else "Relatorio pronto para revisao."
          setStatus(message, PhotoBridgeFlowStatus.DONE)
        }
      },
      onPhotoProgress = { current, total ->
        runOnUiThread { setStatus("Carregando fotos - $current de $total", PhotoBridgeFlowStatus.OPENING_REPORT) }
      },
      onBackToBridge = {
        runOnUiThread {
          webView.loadUrl("about:blank")
          setStatus("Visita preservada. Relatorio fechado para ajuste.", PhotoBridgeFlowStatus.READY_TO_REVIEW)
        }
      }
    )
    webView = WebView(this).apply {
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.loadWithOverviewMode = false
      settings.useWideViewPort = false
      settings.builtInZoomControls = false
      settings.displayZoomControls = false
      addJavascriptInterface(jsBridge, "EloPhotoBridgeAndroid")
      webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
          Log.d("EloPhotoBridge", "WEBVIEW_URL url=$url")
          return !url.startsWith(config.trustedReportUrl)
        }

        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
          Log.d("EloPhotoBridge", "WEBVIEW_PAGE_STARTED url=$url")
          Log.d("EloPhotoBridge", "WEBVIEW_URL url=$url")
        }

        override fun onPageFinished(view: WebView, url: String) {
          Log.d("EloPhotoBridge", "WEBVIEW_PAGE_FINISHED url=$url")
          Log.d("EloPhotoBridge", "WEBVIEW_URL url=$url")
          if (url.startsWith(config.trustedReportUrl)) {
            setStatus("Aguardando pagina do relatorio...", PhotoBridgeFlowStatus.OPENING_REPORT)
          }
        }
      }
    }
    setContentView(LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(24, 24, 24, 24)
      addView(status)
      addView(summary)
      addView(command)
      addView(LinearLayout(this@MainActivity).apply {
        orientation = LinearLayout.VERTICAL
        addView(fastTimelineButton)
        addView(runButton)
        addView(continueButton)
        addView(reviewClassificationButton)
        addView(updateButton)
        addView(retryButton)
        addView(cancelButton)
        addView(clearButton)
        if (isPhysicalTestBuild()) addView(diagnosticButton)
      })
      addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
    })
  }


  private fun isPhysicalTestBuild(): Boolean = packageName == "br.com.icaroamaral.elophotobridge.physicaltest"

  private fun showSelectionDiagnosticPanel() {
    if (!isPhysicalTestBuild()) return
    val snapshot = SelectionDiagnosticStore.current()
    AlertDialog.Builder(this)
      .setTitle("Diagnóstico da seleção")
      .setMessage(snapshot.toDiagnosticText())
      .setPositiveButton("COPIAR DIAGNÓSTICO") { _, _ -> copyDiagnosticToClipboard(snapshot.toDiagnosticText()) }
      .setNegativeButton("FECHAR", null)
      .show()
  }

  private fun copyDiagnosticToClipboard(text: String) {
    val clipboard = getSystemService(ClipboardManager::class.java)
    clipboard.setPrimaryClip(ClipData.newPlainText("ELO Photo Bridge diagnostic", text))
    setStatus("Diagnóstico copiado.", screenModel.state.flowStatus)
  }
  private fun restoreUi(state: PhotoBridgeUiState) {
    restoringText = true
    command.setText(state.commandText)
    command.setSelection(command.text.length)
    restoringText = false
    pendingPayloadJson = state.payloadJson.takeIf(String::isNotBlank)
    pendingPayloadJson?.let(jsBridge::setPayload)
    status.text = state.statusMessage
    renderSummary(state)
    renderActions(state)
  }

  private fun saveCommandText(value: String) {
    val parsed = CommandParser().parse(value)
    val resolvedDate = parsed.dateHint?.toString()
    val next = screenModel.state.withCommand(value).copy(
      reportType = parsed.reportType.takeUnless { it == ReportType.UNKNOWN }?.name ?: screenModel.state.reportType,
      city = parsed.cityHint ?: screenModel.state.city,
      visitDate = resolvedDate ?: screenModel.state.visitDate,
      requestedDate = resolvedDate ?: screenModel.state.requestedDate,
      dateResolved = resolvedDate != null || screenModel.state.dateResolved,
      statusMessage = screenModel.state.statusMessage
    )
    persistState(next)
  }

  private fun setStatus(message: String, flowStatus: PhotoBridgeFlowStatus = screenModel.state.flowStatus) {
    persistState(screenModel.state.copy(statusMessage = message, flowStatus = flowStatus).withEvent(message))
  }

  private fun persistState(state: PhotoBridgeUiState) {
    screenModel.state = state
    stateStore.save(state)
    status.text = state.statusMessage
    renderSummary(state)
    renderActions(state)
  }

  private fun renderSummary(state: PhotoBridgeUiState) {
    val categories = state.categoryCounts
      .filterValues { it > 0 }
      .entries
      .joinToString(" | ") { "${it.key}: ${it.value}" }
      .ifBlank { "categorias pendentes" }
    val events = state.statusEvents.joinToString("\n") { "- $it" }.ifBlank { "- Aguardando comando." }
    summary.text = listOf(
      "Comando: ${state.commandText.ifBlank { "-" }}",
      "Relatorio: ${state.reportType.ifBlank { "-" }}",
      "Cidade: ${state.city.ifBlank { "-" }}",
      "Data: ${state.visitDate.ifBlank { "-" }}",
      "Data solicitada: ${state.requestedDate.ifBlank { "-" }}",
      "Obra: ${state.workType.ifBlank { "-" }}",
      "Fotos: ${state.photoCount} ($categories)",
      "Estado: ${state.flowStatus.name}",
      "Eventos:",
      events
    ).joinToString("\n")
  }

  private fun renderActions(state: PhotoBridgeUiState) {
    val processing = screenModel.isProcessing
    fastTimelineButton.isEnabled = !processing
    runButton.isEnabled = !processing
    continueButton.text = if (state.flowStatus in setOf(PhotoBridgeFlowStatus.READY_TO_REVIEW, PhotoBridgeFlowStatus.CLASSIFICATION_REVIEW)) "ABRIR RELATÓRIO" else "CONTINUAR"
    continueButton.isEnabled = !processing && state.flowStatus in setOf(PhotoBridgeFlowStatus.WAITING_FOR_DATE, PhotoBridgeFlowStatus.WAITING_FOR_VISIT_REFINEMENT, PhotoBridgeFlowStatus.READY_TO_RESUME, PhotoBridgeFlowStatus.READY_TO_REVIEW, PhotoBridgeFlowStatus.CLASSIFICATION_REVIEW, PhotoBridgeFlowStatus.CANCELLED)
    reviewClassificationButton.isEnabled = !processing && !pendingPayloadJson.isNullOrBlank() && state.flowStatus in setOf(PhotoBridgeFlowStatus.READY_TO_REVIEW, PhotoBridgeFlowStatus.CLASSIFICATION_REVIEW)
    updateButton.isEnabled = true
    retryButton.isEnabled = !processing && state.flowStatus == PhotoBridgeFlowStatus.ERROR
    cancelButton.isEnabled = processing
    clearButton.isEnabled = !processing
  }

  private fun requestNeededPermissions() {
    val permissions = mutableListOf<String>()
    if (Build.VERSION.SDK_INT >= 33) permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
    if (Build.VERSION.SDK_INT <= 32) permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
    permissions.add(Manifest.permission.ACCESS_MEDIA_LOCATION)
    val missing = permissions.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
    if (missing.isNotEmpty()) permissionLauncher.launch(missing.toTypedArray())
  }

  private fun continueFlow() {
    if (screenModel.isProcessing) return
    if (screenModel.state.flowStatus == PhotoBridgeFlowStatus.WAITING_FOR_VISIT_REFINEMENT) {
      applyVisitRefinement(command.text.toString())
      return
    }
    if (!pendingPayloadJson.isNullOrBlank() && screenModel.state.flowStatus in setOf(PhotoBridgeFlowStatus.READY_TO_REVIEW, PhotoBridgeFlowStatus.CLASSIFICATION_REVIEW)) {
      openReportWebViewForReview()
      return
    }
    startAiClassificationFlow()
  }




  private fun logUiWindowInputs(commandText: String, parsed: ParsedCommand) {
    val refinement = VisitRefinementParser().parse(commandText)
    Log.d("EloPhotoBridge", "UI_DATE_RAW: ${refinement.date ?: parsed.dateHint ?: ""}")
    Log.d("EloPhotoBridge", "UI_START_TIME_RAW: ${refinement.rawStartTime ?: ""}")
    Log.d("EloPhotoBridge", "UI_END_TIME_RAW: ${refinement.rawEndTime ?: ""}")
  }
  private fun startAiClassificationFlow(replaceActive: Boolean = false) {
    if (screenModel.isProcessing) {
      if (!replaceActive) return
      cancelActiveJob(PhotoBridgeFlowStatus.READY_TO_RESUME, "Atualizando classificação. Execução anterior cancelada.")
    }
    ensureVisualAnalysisConsent { prepareAiClassificationSelection() }
  }

  private fun prepareAiClassificationSelection() {
    val commandText = command.text.toString()
    val parsed = CommandParser().parse(commandText)
    logUiWindowInputs(commandText, parsed)
    if (parsed.dateHint == null && UserVisitWindowFilter.fromText(parsed, commandText) == null) {
      persistState(screenModel.state.withCommand(commandText).copy(
        flowStatus = PhotoBridgeFlowStatus.WAITING_FOR_DATE,
        classificationMode = ClassificationMode.AI_CLASSIFICATION.name,
        statusMessage = "Qual a data da visita?",
        dateResolved = false
      ).withEvent("Aguardando data antes de classificar com IA."))
      return
    }
    screenModel.isProcessing = true
    persistState(screenModel.state.withCommand(commandText).copy(
      classificationMode = ClassificationMode.AI_CLASSIFICATION.name,
      flowStatus = PhotoBridgeFlowStatus.SEARCHING_PHOTOS,
      statusMessage = "Selecionando visita antes da IA..."
    ).withEvent("AI_CLASSIFICATION selecionado."))
    val cache = SimplePhotoMetadataCache(this)
    val coordinateCityCache = mutableMapOf<String, String?>()
    val cityResolver = AndroidGeocoderCityResolver(this)
    val orchestrator = PhotoBridgeOrchestrator(
      repository = MediaStorePhotoRepository(this),
      cityResolver = { photo -> resolvePhotoCity(photo, cache, coordinateCityCache, cityResolver) },
      config = config,
      visualClassifier = AndroidVisualPhotoCategoryClassifier(this, config, cache, ::isRemoteVisualAnalysisAllowed)
    )
    activeJob = lifecycleScope.launch {
      val result = orchestrator.findVisitGroups(commandText) { progress ->
        withContext(Dispatchers.Main) { applyProgress(progress) }
      }
      screenModel.isProcessing = false
      activeJob = null
      result.onSuccess { (command, groups) ->
        if (!command.latestVisit && groups.size > 1) {
          handleVisitSelectionRequired(VisitSelectionRequiredException(command, groups), commandText)
        } else {
          val group = if (command.latestVisit) groups.maxBy { it.photos.maxOf { photo -> photo.bestInstant() ?: java.time.Instant.EPOCH } } else groups.first()
          confirmAiClassification(command, group)
        }
      }.onFailure { error ->
        val message = when {
          error.message == "photos_not_found_for_date" -> "Nenhuma foto encontrada nessa data."
          error.message?.startsWith("photos_not_found_for_window") == true -> windowNotFoundMessage(error.message.orEmpty())
          error.message == "city_input_invariant_failed" -> "Erro técnico: cidade recebeu mais fotos que a janela horária."
          error.message == "invalid_time" -> "Horário inválido"
          error.message == "no_expansion_invariant_failed" -> "Erro técnico: seleção tentou expandir a janela horária."
          error.message == "visit_not_found" -> "Nenhuma visita compativel encontrada."
          else -> "Nao consegui selecionar a visita para IA."
        }
        persistState(screenModel.state.copy(flowStatus = PhotoBridgeFlowStatus.ERROR, statusMessage = message).withEvent(message))
      }
    }
  }

  private fun windowNotFoundMessage(errorMessage: String): String {
    val parts = errorMessage.split("|")
    val date = parts.getOrNull(1).orEmpty()
    val start = parts.getOrNull(2)?.take(5).orEmpty()
    val end = parts.getOrNull(3)?.take(5).orEmpty()
    return if (date.isNotBlank() && start.isNotBlank() && end.isNotBlank()) {
      "Não encontrei fotos entre $start e $end em $date."
    } else {
      "Nenhuma foto encontrada neste intervalo."
    }
  }
  private fun confirmAiClassification(parsedCommand: ParsedCommand, group: VisitGroup) {
    persistState(screenModel.state.copy(
      flowStatus = PhotoBridgeFlowStatus.AI_CONFIRMATION,
      classificationMode = ClassificationMode.AI_CLASSIFICATION.name,
      photoCount = group.photos.size,
      statusMessage = "Visita selecionada: ${group.photos.size} fotos."
    ).withEvent("PHOTOS_SENT_TO_AI_CONFIRMATION: ${group.photos.size}"))
    AlertDialog.Builder(this)
      .setTitle("Classificar com IA")
      .setMessage("Visita selecionada: ${group.photos.size} fotos.\n${group.photos.size} fotos serão analisadas.")
      .setPositiveButton("SIM") { _, _ -> classifyCandidateVisit(candidateSummary(1, group), parsedCommand, group) }
      .setNegativeButton("VOLTAR", null)
      .show()
  }

  private fun resolvePhotoCity(
    photo: PhotoMetadata,
    cache: SimplePhotoMetadataCache,
    coordinateCityCache: MutableMap<String, String?>,
    cityResolver: AndroidGeocoderCityResolver
  ): PhotoMetadata {
    val uri = photo.uri.toString()
    val cachedCity = cache.cityFor(uri)
    if (cachedCity != null) return photo.copy(city = cachedCity)
    val coordinateKey = photo.coordinateCacheKey()
    val cityFromCoordinate = coordinateKey?.let { coordinateCityCache[it] }
    if (coordinateKey != null && coordinateCityCache.containsKey(coordinateKey)) {
      return photo.copy(city = cityFromCoordinate).also { cache.saveCity(uri, it.city) }
    }
    return cityResolver.resolveCity(photo).also { resolved ->
      if (coordinateKey != null) coordinateCityCache[coordinateKey] = resolved.city
      cache.saveCity(uri, resolved.city)
    }
  }
  private fun prepareFastTimelineSearch() {
    if (screenModel.isProcessing) {
      cancelActiveJob(PhotoBridgeFlowStatus.FAST_TIMELINE, "Classificação anterior cancelada. Organizando rápido.")
    }
    val commandText = command.text.toString()
    val parsed = CommandParser().parse(commandText)
    logUiWindowInputs(commandText, parsed)
    if (parsed.dateHint == null && UserVisitWindowFilter.fromText(parsed, commandText) == null) {
      persistState(screenModel.state.withCommand(commandText).copy(
        flowStatus = PhotoBridgeFlowStatus.WAITING_FOR_DATE,
        classificationMode = ClassificationMode.FAST_TIMELINE.name,
        statusMessage = "Qual a data da visita?",
        dateResolved = false
      ).withEvent("Aguardando data para organizar rapido."))
      return
    }
    screenModel.isProcessing = true
    persistState(screenModel.state.withCommand(commandText).copy(
      reportType = parsed.reportType.takeUnless { it == ReportType.UNKNOWN }?.name ?: screenModel.state.reportType,
      city = parsed.cityHint ?: screenModel.state.city,
      requestedDate = parsed.dateHint?.toString() ?: screenModel.state.requestedDate,
      visitDate = parsed.dateHint?.toString() ?: screenModel.state.visitDate,
      dateResolved = parsed.dateHint != null || screenModel.state.dateResolved,
      flowStatus = PhotoBridgeFlowStatus.FAST_TIMELINE,
      classificationMode = ClassificationMode.FAST_TIMELINE.name,
      statusMessage = "Procurando visita para organizacao rapida..."
    ).withEvent("SGTO_FAST_TIMELINE iniciado sem IA."))
    val cache = SimplePhotoMetadataCache(this)
    val coordinateCityCache = mutableMapOf<String, String?>()
    val cityResolver = AndroidGeocoderCityResolver(this)
    val orchestrator = PhotoBridgeOrchestrator(
      repository = MediaStorePhotoRepository(this),
      cityResolver = { photo -> resolvePhotoCity(photo, cache, coordinateCityCache, cityResolver) },
      config = config
    )
    activeJob = lifecycleScope.launch {
      val result = orchestrator.findVisitGroups(commandText) { progress ->
        withContext(Dispatchers.Main) { applyProgress(progress) }
      }
      screenModel.isProcessing = false
      activeJob = null
      result.onSuccess { (command, groups) ->
        val group = if (command.latestVisit) groups.maxBy { it.photos.maxOf { photo -> photo.bestInstant() ?: java.time.Instant.EPOCH } } else groups.first()
        persistState(screenModel.state.copy(flowStatus = PhotoBridgeFlowStatus.MODE_SELECTION, classificationMode = ClassificationMode.FAST_TIMELINE.name, photoCount = group.photos.size, statusMessage = "Visita selecionada: ${group.photos.size} fotos.").withEvent("PHOTOS_SENT_TO_TIMELINE: ${group.photos.size}"))
        showFastTimelineOrganizer(command, group)
      }.onFailure { error ->
        val message = when {
          error.message == "photos_not_found_for_date" -> "Nenhuma foto encontrada nessa data."
          error.message?.startsWith("photos_not_found_for_window") == true -> windowNotFoundMessage(error.message.orEmpty())
          error.message == "city_input_invariant_failed" -> "Erro técnico: cidade recebeu mais fotos que a janela horária."
          error.message == "invalid_time" -> "Horário inválido"
          error.message == "no_expansion_invariant_failed" -> "Erro técnico: seleção tentou expandir a janela horária."
          error.message == "visit_not_found" -> "Nenhuma visita compativel encontrada."
          else -> "Nao consegui abrir a timeline rapida."
        }
        persistState(screenModel.state.copy(flowStatus = PhotoBridgeFlowStatus.ERROR, statusMessage = message).withEvent(message))
      }
    }
  }

  private fun showFastTimelineOrganizer(parsedCommand: ParsedCommand, group: VisitGroup) {
    val ordered = group.photos.sortedBy { it.bestInstant() ?: java.time.Instant.EPOCH }
    currentTimelineCommand = parsedCommand
    currentTimelineGroup = group.copy(photos = ordered)
    val ids = ordered.map { it.uri.toString() }
    val samePhotos = screenModel.state.timelinePhotoIds == ids
    timelineCuts = if (samePhotos && screenModel.state.tomadasStartIndex >= 0) {
      mutableMapOf(
        PhotoCategory.CAMERAS to screenModel.state.cameraStartIndex,
        PhotoCategory.TOMADAS to screenModel.state.tomadasStartIndex,
        PhotoCategory.RACK to screenModel.state.rackStartIndex,
        PhotoCategory.MASTRO_ANTENA to screenModel.state.mastroStartIndex,
        PhotoCategory.CAIXA_FUNDO_MADEIRA to screenModel.state.caixaStartIndex
      )
    } else {
      TimelineOrganizer.defaultCuts(ordered.size).toMutableMap()
    }
    persistTimelineState(ids, if (!samePhotos && screenModel.state.timelinePhotoIds.isNotEmpty()) "Conjunto de fotos mudou. Revise os cortes." else null)
    AlertDialog.Builder(this)
      .setTitle("Organizar fotos da visita")
      .setMessage(visitTimelineHeader(group, ordered))
      .setAdapter(TimelinePhotoAdapter(ordered)) { _, index -> showTimelineCutPicker(index) }
      .setPositiveButton("REVISAR BLOCOS") { _, _ -> confirmFastTimelinePayload() }
      .setNeutralButton("LIMPAR ORGANIZAÇÃO") { _, _ -> clearTimelineOrganization() }
      .setNegativeButton("FECHAR", null)
      .show()
  }


  private inner class TimelinePhotoAdapter(private val photos: List<PhotoMetadata>) : BaseAdapter() {
    override fun getCount(): Int = photos.size
    override fun getItem(position: Int): Any = photos[position]
    override fun getItemId(position: Int): Long = position.toLong()

    override fun getView(position: Int, convertView: android.view.View?, parent: ViewGroup?): android.view.View {
      val row = (convertView as? LinearLayout) ?: LinearLayout(this@MainActivity).apply {
        orientation = LinearLayout.HORIZONTAL
        setPadding(8, 8, 8, 8)
        addView(ImageView(this@MainActivity).apply { layoutParams = LinearLayout.LayoutParams(160, 160) })
        addView(TextView(this@MainActivity).apply { layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f) })
      }
      val image = row.getChildAt(0) as ImageView
      val label = row.getChildAt(1) as TextView
      val photo = photos[position]
      val time = photo.bestInstant()?.atZone(ZoneId.systemDefault())?.toLocalTime()?.format(DateTimeFormatter.ofPattern("HH:mm:ss")).orEmpty()
      val marker = timelineCuts.entries.firstOrNull { it.value == position }?.key?.let { "\n[${categoryLabel(it)} começa aqui]" }.orEmpty()
      val gap = photos.getOrNull(position - 1)?.bestInstant()?.let { previous ->
        photo.bestInstant()?.let { current -> java.time.Duration.between(previous, current).toMinutes().takeIf { it >= 2 }?.let { "\nGap: ${it}min" } }
      }.orEmpty()
      label.text = "#${(position + 1).toString().padStart(2, '0')}  $time$gap$marker\n${photo.displayName}"
      image.setImageDrawable(null)
      lifecycleScope.launch(Dispatchers.IO) {
        val bitmap = runCatching {
          if (Build.VERSION.SDK_INT >= 29) {
            contentResolver.loadThumbnail(photo.uri, Size(160, 160), null)
          } else {
            MediaStore.Images.Thumbnails.getThumbnail(contentResolver, android.content.ContentUris.parseId(photo.uri), MediaStore.Images.Thumbnails.MINI_KIND, null)
          }
        }.getOrNull()
        withContext(Dispatchers.Main) { if (bitmap != null) image.setImageBitmap(bitmap) }
      }
      return row
    }
  }
  private fun showTimelineCutPicker(photoIndex: Int) {
    selectedTimelinePhotoIndex = photoIndex
    val categories = TimelineOrganizer.orderedCategories.drop(1)
    val labels = categories.map { "INÍCIO ${categoryLabel(it)}" }.toTypedArray()
    AlertDialog.Builder(this)
      .setTitle("Foto #${photoIndex + 1}")
      .setItems(labels) { _, index ->
        val category = categories[index]
        val previous = TimelineOrganizer.orderedCategories.getOrNull(TimelineOrganizer.orderedCategories.indexOf(category) - 1)
        if (previous != null && (timelineCuts[previous] ?: -1) >= photoIndex) {
          setStatus("${categoryLabel(category)} deve começar depois de ${categoryLabel(previous)}.", PhotoBridgeFlowStatus.READY_TO_REVIEW)
        } else {
          timelineCuts[category] = photoIndex
          persistTimelineState(currentTimelineGroup?.photos.orEmpty().map { it.uri.toString() }, null)
          setStatus("${categoryLabel(category)} começa em #${photoIndex + 1}.", PhotoBridgeFlowStatus.READY_TO_REVIEW)
          currentTimelineCommand?.let { command -> currentTimelineGroup?.let { group -> showFastTimelineOrganizer(command, group) } }
        }
      }
      .setNegativeButton("CANCELAR", null)
      .show()
  }

  private fun confirmFastTimelinePayload() {
    val parsedCommand = currentTimelineCommand ?: return
    val group = currentTimelineGroup ?: return
    val validation = TimelineOrganizer.validateCuts(group.photos.size, timelineCuts)
    if (!validation.ok) {
      setStatus(validation.message, PhotoBridgeFlowStatus.READY_TO_REVIEW)
      showFastTimelineOrganizer(parsedCommand, group)
      return
    }
    val orchestrator = PhotoBridgeOrchestrator(MediaStorePhotoRepository(this), { photo -> photo }, config = config)
    screenModel.isProcessing = true
    persistState(screenModel.state.copy(flowStatus = PhotoBridgeFlowStatus.PREPARING_REPORT, classificationMode = ClassificationMode.FAST_TIMELINE.name, statusMessage = "Gerando payload por timeline...").withEvent("Zero IA: usando cortes manuais."))
    activeJob = lifecycleScope.launch {
      val payload = orchestrator.prepareFastTimelinePayloadForGroup(parsedCommand, group, timelineCuts, manualTimelineCategories()) { progress ->
        withContext(Dispatchers.Main) { applyProgress(progress) }
      }
      screenModel.isProcessing = false
      activeJob = null
      pendingPayloadJson = payload
      logPayloadStats("PHOTO_SELECTED_FAST_TIMELINE", payload)
      jsBridge.setPayload(payload)
      val next = stateStore.mergePayload(screenModel.state, payload).copy(
        flowStatus = PhotoBridgeFlowStatus.CLASSIFICATION_REVIEW,
        statusMessage = "Organização rápida pronta. Revise os blocos ou abra o relatório."
      ).withEvent("SGTO_FAST_TIMELINE pronto sem chamadas de IA.")
      persistState(next)
      showClassificationReviewDialog()
    }
  }

  private fun persistTimelineState(photoIds: List<String>, warning: String?) {
    val next = screenModel.state.copy(
      timelinePhotoIds = photoIds,
      cameraStartIndex = timelineCuts[PhotoCategory.CAMERAS] ?: 0,
      tomadasStartIndex = timelineCuts[PhotoCategory.TOMADAS] ?: -1,
      rackStartIndex = timelineCuts[PhotoCategory.RACK] ?: -1,
      mastroStartIndex = timelineCuts[PhotoCategory.MASTRO_ANTENA] ?: -1,
      caixaStartIndex = timelineCuts[PhotoCategory.CAIXA_FUNDO_MADEIRA] ?: -1,
      statusMessage = warning ?: screenModel.state.statusMessage
    )
    persistState(if (warning != null) next.withEvent(warning) else next)
  }

  private fun manualTimelineCategories(): Map<String, PhotoCategory> {
    val json = runCatching { JSONObject(screenModel.state.timelineManualCategoriesJson) }.getOrNull() ?: return emptyMap()
    return buildMap {
      val keys = json.keys()
      while (keys.hasNext()) {
        val uri = keys.next()
        val category = runCatching { PhotoCategory.valueOf(json.optString(uri)) }.getOrNull() ?: continue
        put(uri, category)
      }
    }
  }

  private fun clearTimelineOrganization() {
    timelineCuts = TimelineOrganizer.defaultCuts(screenModel.state.timelinePhotoIds.size).toMutableMap()
    persistState(screenModel.state.copy(
      cameraStartIndex = 0,
      tomadasStartIndex = -1,
      rackStartIndex = -1,
      mastroStartIndex = -1,
      caixaStartIndex = -1,
      timelineManualCategoriesJson = "",
      statusMessage = "Organização limpa. Data, cidade e visita preservadas."
    ).withEvent("Pontos de corte e ajustes manuais removidos."))
  }

  private fun visitTimelineHeader(group: VisitGroup, photos: List<PhotoMetadata>): String {
    val preview = TimelineOrganizer.validateCuts(photos.size, timelineCuts).let { validation ->
      if (!validation.ok) validation.message else TimelineOrganizer.orderedCategories.joinToString("\n") { category ->
        val start = timelineCuts.getValue(category)
        val end = TimelineOrganizer.orderedCategories.getOrNull(TimelineOrganizer.orderedCategories.indexOf(category) + 1)?.let { timelineCuts.getValue(it) - 1 } ?: photos.lastIndex
        "${categoryLabel(category)} - ${end - start + 1} fotos"
      }
    }
    return listOf(
      "Cidade: ${group.city ?: "UNKNOWN"}",
      "Data: ${group.date ?: "AMBIGUOUS"}",
      "Unidade: ${screenModel.state.workType.ifBlank { "-" }}",
      "Quantidade de fotos: ${photos.size}",
      preview
    ).joinToString("\n")
  }
  private fun startReportPreparation(replaceActive: Boolean) {
    startAiClassificationFlow(replaceActive)
  }

  private fun prepareReport() {
    val commandText = command.text.toString()
    val parsed = CommandParser().parse(commandText)
    logUiWindowInputs(commandText, parsed)
    val requestedDate = parsed.dateHint
    if (requestedDate == null) {
      persistState(screenModel.state.withCommand(commandText).copy(
        flowStatus = PhotoBridgeFlowStatus.WAITING_FOR_DATE,
        statusMessage = "Qual a data da visita?",
        dateResolved = false
      ).withEvent("Aguardando data da visita."))
      return
    }
    val requestedDateText = requestedDate.toString()
    persistState(screenModel.state.withCommand(commandText).copy(
      reportType = parsed.reportType.takeUnless { it == ReportType.UNKNOWN }?.name ?: screenModel.state.reportType,
      city = parsed.cityHint ?: screenModel.state.city,
      visitDate = requestedDateText,
      requestedDate = requestedDateText,
      dateResolved = true,
      flowStatus = PhotoBridgeFlowStatus.SEARCHING_PHOTOS,
      statusMessage = "Procurando fotos de $requestedDateText..."
    ).withEvent("Procurando fotos de $requestedDateText..."))
    screenModel.isProcessing = true
    renderActions(screenModel.state)

    val cache = SimplePhotoMetadataCache(this)
    val coordinateCityCache = mutableMapOf<String, String?>()
    val cityResolver = AndroidGeocoderCityResolver(this)
    val orchestrator = PhotoBridgeOrchestrator(
      repository = MediaStorePhotoRepository(this),
      cityResolver = { photo ->
        val uri = photo.uri.toString()
        val cachedCity = cache.cityFor(uri)
        if (cachedCity != null) {
          photo.copy(city = cachedCity)
        } else {
          val coordinateKey = photo.coordinateCacheKey()
          val cityFromCoordinate = coordinateKey?.let { coordinateCityCache[it] }
          if (coordinateKey != null && coordinateCityCache.containsKey(coordinateKey)) {
            photo.copy(city = cityFromCoordinate).also { resolved ->
              cache.saveCity(uri, resolved.city)
            }
          } else {
            cityResolver.resolveCity(photo).also { resolved ->
              if (coordinateKey != null) coordinateCityCache[coordinateKey] = resolved.city
              cache.saveCity(uri, resolved.city)
            }
          }
        }
      },
      config = config,
      visualClassifier = AndroidVisualPhotoCategoryClassifier(this, config, cache, ::isRemoteVisualAnalysisAllowed)
    )

    activeJob = lifecycleScope.launch {
      val result = orchestrator.run(commandText) { progress ->
        withContext(Dispatchers.Main) { applyProgress(progress) }
      }
      screenModel.isProcessing = false
      activeJob = null
      result.onSuccess { payload ->
        pendingPayloadJson = payload
        logPayloadStats("PHOTO_SELECTED", payload)
        jsBridge.setPayload(payload)
        val next = stateStore.mergePayload(screenModel.state.withCommand(commandText), payload).copy(
          flowStatus = PhotoBridgeFlowStatus.CLASSIFICATION_REVIEW,
          statusMessage = "Classificação pronta. Revise as categorias ou abra o relatório."
        ).withEvent("Classificação visual concluída; aguardando revisão.")
        persistState(next)
      }.onFailure { error ->
        if (error is VisitSelectionRequiredException) {
          handleVisitSelectionRequired(error, commandText)
        } else if (error is CancellationException) {
          persistState(screenModel.state.copy(flowStatus = PhotoBridgeFlowStatus.CANCELLED, statusMessage = "Busca cancelada. Dados preservados.").withEvent("Busca cancelada."))
        } else {
          val message = when {
            error.message == "multiple_visits" -> "Mais de uma visita encontrada nessa data. Refine horario ou cidade."
            error.message?.startsWith("photos_not_found_for_window") == true -> windowNotFoundMessage(error.message.orEmpty())
            error.message == "city_input_invariant_failed" -> "Erro técnico: cidade recebeu mais fotos que a janela horária."
            error.message == "invalid_time" -> "Horário inválido"
            error.message == "no_expansion_invariant_failed" -> "Erro técnico: seleção tentou expandir a janela horária."
            error.message == "visit_not_found" -> "Nenhuma visita compativel encontrada."
            else -> "Nao consegui concluir a busca. Voce pode tentar novamente."
          }
          val nextStatus = if (error.message == "date_required") PhotoBridgeFlowStatus.WAITING_FOR_DATE else if (error.message == "multiple_visits") PhotoBridgeFlowStatus.MULTIPLE_VISITS else PhotoBridgeFlowStatus.ERROR
          persistState(screenModel.state.copy(flowStatus = nextStatus, statusMessage = message).withEvent(message))
        }
      }
    }
  }

  private fun handleVisitSelectionRequired(error: VisitSelectionRequiredException, commandText: String) {
    val adapter = EloPhotoBridgeAdapter()
    val orderedGroups = error.groups.sortedBy { group -> group.photos.mapNotNull { it.bestInstant() }.minOrNull() }
    val summaries = orderedGroups.mapIndexed { index, group -> candidateSummary(index + 1, group) }
    candidateGroupsById = orderedGroups.mapIndexed { index, group -> summaries[index].id to (error.command to group) }.toMap()
    val payloads = JSONArray()
    orderedGroups.forEachIndexed { index, group ->
      val summary = summaries[index]
      payloads.put(JSONObject()
        .put("id", summary.id)
        .put("payload", adapter.toJson(adapter.buildPayload(error.command, group))))
    }
    val message = formatCandidateOptions(summaries)
    persistState(screenModel.state.withCommand(commandText).copy(
      flowStatus = PhotoBridgeFlowStatus.WAITING_FOR_VISIT_REFINEMENT,
      statusMessage = message,
      candidateVisits = summaries,
      candidatePayloadsJson = payloads.toString(),
      photoCount = summaries.sumOf { it.photoCount },
      requestedDate = error.command.dateHint?.toString() ?: screenModel.state.requestedDate,
      dateResolved = true
    ).withEvent("Mais de uma visita encontrada. Aguardando refinamento."))
  }

  private fun applyVisitRefinement(inputText: String) {
    val current = screenModel.state
    val refinement = VisitRefinementParser().parse(inputText)
    val candidates = current.candidateVisits
    if (candidates.isEmpty()) {
      setStatus("Atualize a busca para recarregar as visitas encontradas.", PhotoBridgeFlowStatus.READY_TO_RESUME)
      return
    }

    refinement.selectedIndex?.let { index ->
      val selected = candidates.firstOrNull { it.index == index }
      if (selected == null) {
        persistState(current.copy(
          flowStatus = PhotoBridgeFlowStatus.WAITING_FOR_VISIT_REFINEMENT,
          statusMessage = "Indice invalido. Digite uma opcao entre 1 e ${candidates.size}."
        ).withEvent("Indice de visita invalido."))
        return
      }
      selectCandidateVisit(selected)
      return
    }

    val effectiveDate = refinement.date?.toString() ?: current.requestedDate
    val filtered = candidates.filter { candidate ->
      val dateMatches = effectiveDate.isBlank() || candidate.date == effectiveDate
      val cityMatches = VisitRefinementParser.cityMatches(candidate.city, refinement.cityHint)
      val timeMatches = intervalMatches(candidate, refinement.startTime, refinement.endTime)
      dateMatches && cityMatches && timeMatches
    }

    val filteringMessage = refinementStatusMessage(refinement)
    persistState(current.copy(
      refinementStartTime = refinement.startTime?.format(TIME_FORMAT).orEmpty(),
      refinementEndTime = refinement.endTime?.format(TIME_FORMAT).orEmpty(),
      refinementCityHint = refinement.cityHint.orEmpty(),
      statusMessage = filteringMessage
    ).withEvent(filteringMessage))

    when (filtered.size) {
      0 -> persistState(screenModel.state.copy(
        flowStatus = PhotoBridgeFlowStatus.WAITING_FOR_VISIT_REFINEMENT,
        statusMessage = "Nao encontrei uma visita que corresponda ao refinamento informado. Ajuste horario, cidade ou escolha uma opcao."
      ).withEvent("Nenhuma visita correspondeu ao refinamento."))
      1 -> selectCandidateVisit(filtered.first())
      else -> {
        val renumbered = filtered.mapIndexed { index, visit -> visit.copy(index = index + 1) }
        persistState(screenModel.state.copy(
          flowStatus = PhotoBridgeFlowStatus.WAITING_FOR_VISIT_REFINEMENT,
          candidateVisits = renumbered,
          statusMessage = formatCandidateOptions(renumbered)
        ).withEvent("${filtered.size} visitas encontradas apos refinamento."))
      }
    }
  }

  private fun selectCandidateVisit(summary: CandidateVisitSummary) {
    val selectedGroup = candidateGroupsById[summary.id]
    if (selectedGroup != null) {
      when (screenModel.state.classificationMode) {
        ClassificationMode.FAST_TIMELINE.name -> showFastTimelineOrganizer(selectedGroup.first, selectedGroup.second)
        ClassificationMode.AI_CLASSIFICATION.name -> confirmAiClassification(selectedGroup.first, selectedGroup.second)
        else -> confirmAiClassification(selectedGroup.first, selectedGroup.second)
      }
      return
    }
    val payload = candidatePayloadFor(summary.id)
    if (payload.isNullOrBlank()) {
      setStatus("Nao consegui recuperar a visita selecionada. Atualize a busca.", PhotoBridgeFlowStatus.READY_TO_RESUME)
      return
    }
    pendingPayloadJson = payload
    logPayloadStats("PHOTO_SELECTED", payload)
    jsBridge.setPayload(payload)
    val next = stateStore.mergePayload(screenModel.state.copy(selectedVisitId = summary.id), payload).copy(
      flowStatus = PhotoBridgeFlowStatus.READY_TO_REVIEW,
      statusMessage = "Visita encontrada: ${summary.city}, ${summary.startTime}-${summary.endTime}.",
      selectedVisitId = summary.id
    ).withEvent("1 visita encontrada; aguardando revisão da classificação.")
    persistState(next)
  }

  private fun classifyCandidateVisit(summary: CandidateVisitSummary, parsedCommand: ParsedCommand, group: VisitGroup) {
    if (screenModel.isProcessing) return
    val cache = SimplePhotoMetadataCache(this)
    val orchestrator = PhotoBridgeOrchestrator(
      repository = MediaStorePhotoRepository(this),
      cityResolver = { photo -> photo },
      config = config,
      visualClassifier = AndroidVisualPhotoCategoryClassifier(this, config, cache, ::isRemoteVisualAnalysisAllowed)
    )
    screenModel.isProcessing = true
    persistState(screenModel.state.copy(
      flowStatus = PhotoBridgeFlowStatus.CLASSIFYING_PHOTOS,
      classificationMode = ClassificationMode.AI_CLASSIFICATION.name,
      statusMessage = "Classificando fotos da visita selecionada...",
      selectedVisitId = summary.id,
      photoCount = group.photos.size
    ).withEvent("Classificando fotos da visita selecionada."))
    activeJob = lifecycleScope.launch {
      val result = runCatching {
        orchestrator.preparePayloadForGroup(parsedCommand, group) { progress ->
          withContext(Dispatchers.Main) { applyProgress(progress) }
        }
      }
      screenModel.isProcessing = false
      activeJob = null
      result.onSuccess { payload ->
        pendingPayloadJson = payload
        logPayloadStats("PHOTO_SELECTED", payload)
        jsBridge.setPayload(payload)
        val next = stateStore.mergePayload(screenModel.state.copy(selectedVisitId = summary.id), payload).copy(
          flowStatus = PhotoBridgeFlowStatus.CLASSIFICATION_REVIEW,
          statusMessage = "Classificação pronta. Revise as categorias ou abra o relatório.",
          selectedVisitId = summary.id
        ).withEvent("Classificação visual concluída; aguardando revisão.")
        persistState(next)
      }.onFailure { error ->
        val message = if (error is CancellationException) "Busca cancelada. Dados preservados." else "Não consegui classificar essa visita. Tente novamente."
        persistState(screenModel.state.copy(flowStatus = PhotoBridgeFlowStatus.ERROR, statusMessage = message).withEvent(message))
      }
    }
  }
  private fun candidatePayloadFor(id: String): String? {
    val items = runCatching { JSONArray(screenModel.state.candidatePayloadsJson) }.getOrNull() ?: return null
    for (index in 0 until items.length()) {
      val item = items.optJSONObject(index) ?: continue
      if (item.optString("id") == id) return item.optString("payload")
    }
    return null
  }

  private fun candidateSummary(index: Int, group: VisitGroup): CandidateVisitSummary {
    val zone = ZoneId.systemDefault()
    val instants = group.photos.mapNotNull { it.bestInstant() }.sorted()
    val start = instants.firstOrNull()?.atZone(zone)?.toLocalTime()?.format(TIME_FORMAT).orEmpty()
    val end = instants.lastOrNull()?.atZone(zone)?.toLocalTime()?.format(TIME_FORMAT).orEmpty()
    val date = group.date?.toString().orEmpty()
    val city = group.city ?: "UNKNOWN"
    return CandidateVisitSummary(
      id = listOf(date, start, end, city, group.photos.size).joinToString("|"),
      index = index,
      city = city,
      date = date,
      startTime = start,
      endTime = end,
      photoCount = group.photos.size
    )
  }

  private fun intervalMatches(candidate: CandidateVisitSummary, requestedStart: LocalTime?, requestedEnd: LocalTime?): Boolean {
    if (requestedStart == null && requestedEnd == null) return true
    val candidateStart = parseFlexibleTime(candidate.startTime) ?: return false
    val candidateEnd = parseFlexibleTime(candidate.endTime) ?: candidateStart
    val start = requestedStart ?: LocalTime.MIN
    val end = requestedEnd ?: requestedStart ?: LocalTime.MAX
    return !candidateEnd.isBefore(start) && !candidateStart.isAfter(end)
  }


  private fun parseFlexibleTime(value: String): LocalTime? {
    return runCatching { LocalTime.parse(value, TIME_FORMAT) }.getOrNull()
      ?: runCatching { LocalTime.parse(value, DateTimeFormatter.ofPattern("HH:mm")) }.getOrNull()
  }
  private fun refinementStatusMessage(refinement: VisitRefinementInput): String {
    val start = refinement.startTime?.format(TIME_FORMAT)
    val end = refinement.endTime?.format(TIME_FORMAT)
    return if (start != null && end != null) {
      "Filtrando visitas entre $start e $end..."
    } else {
      "Filtrando visitas encontradas..."
    }
  }

  private fun formatCandidateOptions(candidates: List<CandidateVisitSummary>): String {
    val lines = candidates.joinToString("\n") { visit ->
      "${visit.index}. ${visit.startTime}-${visit.endTime} - ${visit.photoCount} fotos - ${visit.city}"
    }
    return "Encontrei ${candidates.size} visitas:\n$lines\nDigite 1, 2 ou refine por horario/cidade."
  }

  private fun applyProgress(progress: PhotoBridgeProgress) {
    val detail = when {
      progress.current != null && progress.total != null -> "${progress.message} (${progress.current} de ${progress.total})"
      else -> progress.message
    }
    val next = screenModel.state.copy(
      flowStatus = progress.status,
      statusMessage = detail,
      photoCount = progress.photoCount ?: screenModel.state.photoCount,
      categoryCounts = progress.categoryCounts ?: screenModel.state.categoryCounts
    ).withEvent(detail)
    persistState(next)
  }

  private fun cancelActiveJob(nextStatus: PhotoBridgeFlowStatus, message: String) {
    activeJob?.cancel()
    activeJob = null
    screenModel.isProcessing = false
    persistState(screenModel.state.copy(flowStatus = nextStatus, statusMessage = message).withEvent(message))
  }

  private fun PhotoMetadata.coordinateCacheKey(): String? {
    val lat = latitude ?: return null
    val lng = longitude ?: return null
    return "%.4f,%.4f".format(java.util.Locale.US, lat, lng)
  }
  private fun ensureVisualAnalysisConsent(onReady: () -> Unit) {
    val prefs = getSharedPreferences("elo_photo_bridge_visual_ai", android.content.Context.MODE_PRIVATE)
    if (prefs.getBoolean("answered", false)) {
      onReady()
      return
    }
    AlertDialog.Builder(this)
      .setTitle("Classificação visual por IA")
      .setMessage("Para classificar câmeras, tomadas, rack, caixa de fundo de madeira e mastro/antena, o app pode enviar versões comprimidas apenas das fotos desta visita para o backend seguro do ObraReport. Você também pode continuar sem envio e revisar manualmente.")
      .setPositiveButton("CLASSIFICAR COM IA") { _, _ ->
        prefs.edit().putBoolean("answered", true).putBoolean("remote", true).apply()
        onReady()
      }
      .setNegativeButton("SEM ENVIO") { _, _ ->
        prefs.edit().putBoolean("answered", true).putBoolean("remote", false).apply()
        onReady()
      }
      .show()
  }

  private fun isRemoteVisualAnalysisAllowed(): Boolean {
    val modeAllowsAi = screenModel.state.classificationMode == ClassificationMode.AI_CLASSIFICATION.name
    if (!modeAllowsAi) Log.d("EloPhotoBridge", "AI_SKIPPED_MODE_FAST_TIMELINE")
    return modeAllowsAi && getSharedPreferences("elo_photo_bridge_visual_ai", android.content.Context.MODE_PRIVATE).getBoolean("remote", false)
  }

  private fun showClassificationReviewDialog() {
    val payload = pendingPayloadJson
    if (payload.isNullOrBlank()) {
      setStatus("Nenhuma visita preparada para revisar.", PhotoBridgeFlowStatus.READY_TO_RESUME)
      return
    }
    val photos = flattenPayloadPhotos(payload)
    if (photos.isEmpty()) {
      setStatus("Payload sem fotos para revisar.", PhotoBridgeFlowStatus.CLASSIFICATION_REVIEW)
      return
    }
    val labels = photos.map { item -> "${item.displayName} - ${item.category.name}" }.toTypedArray()
    AlertDialog.Builder(this)
      .setTitle("Revisar classificação")
      .setItems(labels) { _, index -> showCategoryPicker(photos[index]) }
      .setPositiveButton("ABRIR RELATÓRIO") { _, _ -> openReportWebViewForReview() }
      .setNegativeButton("FECHAR", null)
      .show()
  }

  private fun showCategoryPicker(item: PayloadPhotoItem) {
    val categories = reviewCategories()
    val labels = categories.map { categoryLabel(it) }.toTypedArray()
    AlertDialog.Builder(this)
      .setTitle(item.displayName)
      .setItems(labels) { _, index -> movePayloadPhoto(item, categories[index]) }
      .setNegativeButton("CANCELAR", null)
      .show()
  }

  private fun movePayloadPhoto(item: PayloadPhotoItem, target: PhotoCategory) {
    val payload = pendingPayloadJson ?: return
    val root = runCatching { JSONObject(payload) }.getOrNull() ?: return
    val photos = root.optJSONObject("photos") ?: return
    val sourceArray = photos.optJSONArray(categoryJsonKey(item.category)) ?: photos.optJSONArray(item.category.name.lowercase()) ?: return
    val photo = sourceArray.optJSONObject(item.index) ?: return
    sourceArray.remove(item.index)
    photo.put("category", target.name)
    val classification = photo.optJSONObject("classification") ?: JSONObject()
    classification.put("source", "manual")
    classification.put("confidence", 1.0)
    classification.put("reason", "manual_category_correction")
    photo.put("classification", classification)
    val targetKey = categoryJsonKey(target)
    val targetArray = photos.optJSONArray(targetKey) ?: JSONArray().also { photos.put(targetKey, it) }
    targetArray.put(photo)
    saveManualTimelineCategory(item.uri, target)
    val updated = root.toString()
    pendingPayloadJson = updated
    jsBridge.setPayload(updated)
    val next = stateStore.mergePayload(screenModel.state, updated).copy(
      flowStatus = PhotoBridgeFlowStatus.CLASSIFICATION_REVIEW,
      statusMessage = "Classificação ajustada. Revise ou abra o relatório."
    ).withEvent("Categoria ajustada manualmente.")
    persistState(next)
  }

  private fun flattenPayloadPhotos(payload: String): List<PayloadPhotoItem> {
    val root = runCatching { JSONObject(payload) }.getOrNull() ?: return emptyList()
    val photos = root.optJSONObject("photos") ?: return emptyList()
    return buildList {
      reviewCategories().forEach { category ->
        val items = photos.optJSONArray(categoryJsonKey(category)) ?: photos.optJSONArray(category.name.lowercase()) ?: return@forEach
        for (index in 0 until items.length()) {
          val item = items.optJSONObject(index) ?: continue
          add(PayloadPhotoItem(category, index, item.optString("displayName", "foto_${index + 1}"), item.optString("uri")))
        }
      }
    }
  }



  private fun reviewCategories(): List<PhotoCategory> {
    return listOf(
      PhotoCategory.CAMERAS,
      PhotoCategory.TOMADAS,
      PhotoCategory.RACK,
      PhotoCategory.CAIXA_FUNDO_MADEIRA,
      PhotoCategory.MASTRO_ANTENA,
      PhotoCategory.UNKNOWN
    )
  }
  private fun categoryJsonKey(category: PhotoCategory): String {
    return when (category) {
      PhotoCategory.CAIXA_FUNDO_MADEIRA -> "caixaFundoMadeira"
      PhotoCategory.MASTRO_ANTENA -> "mastroAntena"
      PhotoCategory.TOMADA_DADOS -> "tomadaDados"
      PhotoCategory.TOMADA_CABO_PRETO -> "tomadaCaboPreto"
      else -> category.name.lowercase()
    }
  }

  private fun saveManualTimelineCategory(uri: String, category: PhotoCategory) {
    if (uri.isBlank()) return
    val json = runCatching { JSONObject(screenModel.state.timelineManualCategoriesJson) }.getOrNull() ?: JSONObject()
    json.put(uri, category.name)
    persistState(screenModel.state.copy(timelineManualCategoriesJson = json.toString()))
  }
  private fun categoryLabel(category: PhotoCategory): String {
    return when (category) {
      PhotoCategory.CAMERAS -> "CÂMERAS"
      PhotoCategory.TOMADAS -> "TOMADAS"
      PhotoCategory.RACK -> "RACK"
      PhotoCategory.CAIXA_FUNDO_MADEIRA -> "CAIXA FUNDO MADEIRA"
      PhotoCategory.MASTRO_ANTENA -> "MASTRO/ANTENA"
      PhotoCategory.TOMADA_DADOS -> "TOMADA DADOS"
      PhotoCategory.TOMADA_CABO_PRETO -> "TOMADA/CABO PRETO"
      PhotoCategory.UNKNOWN -> "NÃO CLASSIFICADAS"
    }
  }

  private data class PayloadPhotoItem(
    val category: PhotoCategory,
    val index: Int,
    val displayName: String,
    val uri: String
  )
  private fun confirmClearState() {
    val hasPreparedVisit = screenModel.state.photoCount > 0 || !pendingPayloadJson.isNullOrBlank()
    if (!hasPreparedVisit) {
      clearState()
      return
    }
    AlertDialog.Builder(this)
      .setTitle("Limpar dados?")
      .setMessage("A visita preparada e as fotos selecionadas serao removidas desta tela.")
      .setPositiveButton("LIMPAR") { _, _ -> clearState() }
      .setNegativeButton("CANCELAR", null)
      .show()
  }

  private fun clearState() {
    activeJob?.cancel()
    activeJob = null
    screenModel.isProcessing = false
    pendingPayloadJson = null
    jsBridge.setPayload("{}")
    stateStore.clear()
    screenModel.state = PhotoBridgeUiState()
    restoreUi(screenModel.state)
  }

  private fun openReportWebViewForReview() {
    val payload = pendingPayloadJson
    if (!payload.isNullOrBlank()) {
      logPayloadStats("PAYLOAD_READY", payload)
    }
    setStatus("Abrindo relatorio...", PhotoBridgeFlowStatus.OPENING_REPORT)
    Log.d("EloPhotoBridge", "WEBVIEW_URL target=${config.trustedReportUrl}")
    webView.loadUrl(config.trustedReportUrl)
  }
  private fun logPayloadStats(eventName: String, payload: String) {
    val root = runCatching { JSONObject(payload) }.getOrNull()
    val photos = root?.optJSONObject("photos")
    var total = 0
    val categories = mutableMapOf<String, Int>()

    if (photos != null) {
      val keys = photos.keys()
      while (keys.hasNext()) {
        val key = keys.next()
        val count = photos.optJSONArray(key)?.length() ?: 0
        categories[key] = count
        total += count
      }
    }

    val city = root?.optString("city").orEmpty()
    val date = root?.optString("visitDate").orEmpty()
    Log.d("EloPhotoBridge", "$eventName total=$total categories=$categories")
    Log.d("EloPhotoBridge", "PAYLOAD_PHOTO_COUNT total=$total")
    Log.d("EloPhotoBridge", "PAYLOAD_CITY city=$city")
    Log.d("EloPhotoBridge", "PAYLOAD_DATE date=$date")
    Log.d("EloPhotoBridge", "PAYLOAD_CATEGORY_COUNT categories=$categories")
  }
  private fun injectPayload() {
    val payload = pendingPayloadJson ?: return
    Log.d("EloPhotoBridge", "PAYLOAD_DISPATCH_STARTED")
    logPayloadStats("WEBVIEW_PAYLOAD_SENT", payload)
    val script = """
      window.EloPhotoBridgePayload = $payload;
      window.dispatchEvent(new CustomEvent('elo-photo-bridge-payload', { detail: $payload }));
    """.trimIndent()
    webView.evaluateJavascript(script, null)
  }
  companion object {
    private val TIME_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm:ss")
  }
}
