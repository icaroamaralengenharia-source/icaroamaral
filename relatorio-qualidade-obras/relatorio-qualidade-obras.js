(function () {
  "use strict";

  const config = window.RELATORIO_QUALIDADE_CONFIG || {};
  const form = document.getElementById("qualityReportForm");
  const homePanel = document.getElementById("homePanel");
  const loginPanel = document.getElementById("loginPanel");
  const dashboardPanel = document.getElementById("dashboardPanel");
  const reportPanel = document.getElementById("reportPanel");
  const openReportButton = document.getElementById("openReportButton");
  const homeActionStatus = document.getElementById("homeActionStatus");
  const loginForm = document.getElementById("loginForm");
  const loginAccessStatus = document.getElementById("loginAccessStatus");
  const logoutButton = document.getElementById("logoutButton");
  const userBadge = document.getElementById("userBadge");
  const currentPlanBadge = document.getElementById("currentPlanBadge");
  const billingAlert = document.getElementById("billingAlert");
  const localStatus = document.getElementById("localStatus");
  const editorLocalStatus = document.getElementById("editorLocalStatus");
  const cloudStatus = document.getElementById("cloudStatus");
  const editorCloudStatus = document.getElementById("editorCloudStatus");
  const saveNowButton = document.getElementById("saveNowButton");
  const saveEditorNowButton = document.getElementById("saveEditorNowButton");
  const clientForm = document.getElementById("clientForm");
  const clientsList = document.getElementById("clientsList");
  const workForm = document.getElementById("workForm");
  const workClientSelect = document.getElementById("workClientSelect");
  const worksList = document.getElementById("worksList");
  const reportCreateForm = document.getElementById("reportCreateForm");
  const reportClientSelect = document.getElementById("reportClientSelect");
  const reportWorkSelect = document.getElementById("reportWorkSelect");
  const reportsList = document.getElementById("reportsList");
  const recentReportsList = document.getElementById("recentReportsList");
  const clientMetric = document.getElementById("clientMetric");
  const workMetric = document.getElementById("workMetric");
  const reportMetric = document.getElementById("reportMetric");
  const photoMetric = document.getElementById("photoMetric");
  const pdfMetric = document.getElementById("pdfMetric");
  const exampleSalesGuide = document.getElementById("exampleSalesGuide");
  const examplePdfStatus = document.getElementById("examplePdfStatus");
  const billingDemoStatus = document.getElementById("billingDemoStatus");
  const plansGrid = document.getElementById("plansGrid");
  const usageSummary = document.getElementById("usageSummary");
  const clientPortalWorkMetric = document.getElementById("clientPortalWorkMetric");
  const clientPortalReportMetric = document.getElementById("clientPortalReportMetric");
  const clientPortalRdoMetric = document.getElementById("clientPortalRdoMetric");
  const clientPortalPdfMetric = document.getElementById("clientPortalPdfMetric");
  const clientPortalRecentDocs = document.getElementById("clientPortalRecentDocs");
  const clientPortalWorksList = document.getElementById("clientPortalWorksList");
  const clientPortalReportsList = document.getElementById("clientPortalReportsList");
  const clientPortalRdosList = document.getElementById("clientPortalRdosList");
  const clientPortalDocumentsList = document.getElementById("clientPortalDocumentsList");
  const adminUsersMetric = document.getElementById("adminUsersMetric");
  const adminClientsMetric = document.getElementById("adminClientsMetric");
  const adminWorksMetric = document.getElementById("adminWorksMetric");
  const adminReportsMetric = document.getElementById("adminReportsMetric");
  const adminRdosMetric = document.getElementById("adminRdosMetric");
  const dailyLogForm = document.getElementById("dailyLogForm");
  const dailyLogWorkSelect = document.getElementById("dailyLogWorkSelect");
  const dailyLogStatus = document.getElementById("dailyLogStatus");
  const dailyLogResetButton = document.getElementById("dailyLogResetButton");
  const dailyLogAddProductionButton = document.getElementById("dailyLogAddProduction");
  const dailyLogCalculateMaterialsButton = document.getElementById("dailyLogCalculateMaterials");
  const dailyLogEstimatePanel = document.getElementById("dailyLogEstimatePanel");
  const dailyLogAddMaterialRequestButton = document.getElementById("dailyLogAddMaterialRequest");
  const dailyLogMaterialRequestProductionSelect = document.getElementById("dailyLogMaterialRequestProductionSelect");
  const dailyLogMaterialRequestAlmoxSelect = document.getElementById("dailyLogMaterialRequestAlmoxSelect");
  const dailyLogMaterialRequestsList = document.getElementById("dailyLogMaterialRequestsList");
  const dailyLogMaterialRequestSummary = document.getElementById("dailyLogMaterialRequestSummary");
  const dailyLogAddMaterialButton = document.getElementById("dailyLogAddMaterial");
  const dailyLogAddToolButton = document.getElementById("dailyLogAddTool");
  const dailyLogAddPhotoButton = document.getElementById("dailyLogAddPhoto");
  const dailyLogProductionsList = document.getElementById("dailyLogProductionsList");
  const dailyLogProductionSummary = document.getElementById("dailyLogProductionSummary");
  const dailyLogMaterialsList = document.getElementById("dailyLogMaterialsList");
  const dailyLogToolsList = document.getElementById("dailyLogToolsList");
  const dailyLogPhotosList = document.getElementById("dailyLogPhotosList");
  const dailyLogRecordsList = document.getElementById("dailyLogRecordsList");
  const dailyLogMaterialSummary = document.getElementById("dailyLogMaterialSummary");
  const dailyLogMaterialTotal = document.getElementById("dailyLogMaterialTotal");
  const dailyLogAuditPanel = document.getElementById("dailyLogAuditPanel");
  const dailyLogIndicators = document.getElementById("dailyLogIndicators");
  const stockIaSummaryCards = document.getElementById("stockIaSummaryCards");
  const stockQuickExamplePanel = document.getElementById("stockQuickExamplePanel");
  const stockQuickExampleText = document.getElementById("stockQuickExampleText");
  const stockMasterRows = document.getElementById("stockMasterRows");
  const stockUnlinkedRows = document.getElementById("stockUnlinkedRows");
  const stockManualMovementsRows = document.getElementById("stockManualMovementsRows");
  const stockIaRows = document.getElementById("stockIaRows");
  const stockIaMovements = document.getElementById("stockIaMovements");
  const stockIaInsight = document.getElementById("stockIaInsight");
  const stockIaOperationalInsight = document.getElementById("stockIaOperationalInsight");
  const stockIaPeriodControls = document.getElementById("stockIaPeriodControls");
  const stockIaModeControls = document.getElementById("stockIaModeControls");
  const stockIaModeDescription = document.getElementById("stockIaModeDescription");
  const stockIaAlertsList = document.getElementById("stockIaAlertsList");
  const stockPurchasePanelNote = document.getElementById("stockPurchasePanelNote");
  const stockPurchaseSummaryCards = document.getElementById("stockPurchaseSummaryCards");
  const stockPurchaseRows = document.getElementById("stockPurchaseRows");
  const stockNoteSummary = document.getElementById("stockNoteSummary");
  const stockNoteRows = document.getElementById("stockNoteRows");
  const stockTopMaterialsRows = document.getElementById("stockTopMaterialsRows");
  const stockConsumptionByWorkRows = document.getElementById("stockConsumptionByWorkRows");
  const stockIaQuestionForm = document.getElementById("stockIaQuestionForm");
  const stockIaQuestionInput = document.getElementById("stockIaQuestionInput");
  const stockIaQuestionAnswer = document.getElementById("stockIaQuestionAnswer");
  const stockIaActionMessage = document.getElementById("stockIaActionMessage");
  const stockIaModal = document.getElementById("stockIaModal");
  const almoxSummaryCards = document.getElementById("almoxSummaryCards");
  const almoxItemForm = document.getElementById("almoxItemForm");
  const almoxEntryForm = document.getElementById("almoxEntryForm");
  const almoxExitForm = document.getElementById("almoxExitForm");
  const almoxEntryItemSelect = document.getElementById("almoxEntryItemSelect");
  const almoxExitItemSelect = document.getElementById("almoxExitItemSelect");
  const almoxItemsRows = document.getElementById("almoxItemsRows");
  const almoxHistoryRows = document.getElementById("almoxHistoryRows");
  const almoxSearchInput = document.getElementById("almoxSearchInput");
  const almoxItemsCards = document.getElementById("almoxItemsCards");
  const almoxHistoryList = document.getElementById("almoxHistoryList");
  const almoxSummaryText = document.getElementById("almoxSummaryText");
  const almoxFlowStatus = document.getElementById("almoxFlowStatus");
  const almoxDemoAccessPanel = document.getElementById("almoxDemoAccessPanel");
  const almoxSummaryButton = document.getElementById("almoxSummaryButton");
  const almoxAuditButton = document.getElementById("almoxAuditButton");
  const almoxViewPanelButton = document.getElementById("almoxViewPanelButton");
  const almoxManagerAuditButton = document.getElementById("almoxManagerAuditButton");
  const almoxEmailButton = document.getElementById("almoxEmailButton");
  const almoxDownloadPdfButton = document.getElementById("almoxDownloadPdfButton");
  const almoxMuteAlertsButton = document.getElementById("almoxMuteAlertsButton");
  const almoxPrepareEmailButton = document.getElementById("almoxPrepareEmailButton");
  const almoxEmailPanel = document.getElementById("almoxEmailPanel");
  const almoxEmailInput = document.getElementById("almoxEmailInput");
  const almoxManagerSummaryText = document.getElementById("almoxManagerSummaryText");
  const almoxManagerAuditText = document.getElementById("almoxManagerAuditText");
  const almoxManagerCards = document.getElementById("almoxManagerCards");
  const almoxAlertsStatus = document.getElementById("almoxAlertsStatus");
  const almoxGeneratedReport = document.getElementById("almoxGeneratedReport");
  const almoxGeneratedReportTitle = document.getElementById("almoxGeneratedReportTitle");
  const almoxGeneratedReportText = document.getElementById("almoxGeneratedReportText");
  const almoxDashboardPanel = document.getElementById("almoxDashboardPanel");
  const almoxDashboardCards = document.getElementById("almoxDashboardCards");
  const almoxDashboardPeriodControls = document.getElementById("almoxDashboardPeriodControls");
  const almoxDashboardConsumption = document.getElementById("almoxDashboardConsumption");
  const almoxDashboardRisk = document.getElementById("almoxDashboardRisk");
  const almoxDashboardExpiration = document.getElementById("almoxDashboardExpiration");
  const almoxDashboardTrend = document.getElementById("almoxDashboardTrend");
  const almoxActionMessage = document.getElementById("almoxActionMessage");
  const almoxModal = document.getElementById("almoxModal");
  const almoxNoteTextInput = document.getElementById("almoxNoteTextInput");
  const almoxChooseNoteFileButton = document.getElementById("almoxChooseNoteFileButton");
  const almoxImportXmlButton = document.getElementById("almoxImportXmlButton");
  const almoxParseNoteButton = document.getElementById("almoxParseNoteButton");
  const almoxClearNoteButton = document.getElementById("almoxClearNoteButton");
  const almoxAddNoteItemsButton = document.getElementById("almoxAddNoteItemsButton");
  const almoxXmlNoteFileInput = document.getElementById("almoxXmlNoteFileInput");
  const almoxNoteFileInput = document.getElementById("almoxNoteFileInput");
  const almoxNoteFilePreview = document.getElementById("almoxNoteFilePreview");
  const almoxNfeKeyInput = document.getElementById("almoxNfeKeyInput");
  const almoxValidateNfeKeyButton = document.getElementById("almoxValidateNfeKeyButton");
  const almoxNfeKeyStatus = document.getElementById("almoxNfeKeyStatus");
  const almoxNoteStatus = document.getElementById("almoxNoteStatus");
  const almoxFiscalOcrReview = document.getElementById("almoxFiscalOcrReview");
  const almoxNoteRows = document.getElementById("almoxNoteRows");
  const dailyLogPhotoInput = document.getElementById("dailyLogPhotoInput");
  const dailyLogSearchInput = document.getElementById("dailyLogSearchInput");
  const dailyLogPdfButton = document.getElementById("dailyLogPdfButton");
  const dailyLogShareWhatsappButton = document.getElementById("dailyLogShareWhatsapp");
  const dailyLogShareEmailButton = document.getElementById("dailyLogShareEmail");
  const compositionForm = document.getElementById("compositionForm");
  const compositionAddMaterialButton = document.getElementById("compositionAddMaterial");
  const compositionMaterialsList = document.getElementById("compositionMaterialsList");
  const compositionLibraryList = document.getElementById("compositionLibraryList");
  const compositionResetButton = document.getElementById("compositionResetButton");
  const compositionRestoreDefaultsButton = document.getElementById("compositionRestoreDefaults");
  const currentReportLabel = document.getElementById("currentReportLabel");
  const saveReportButton = document.getElementById("saveReportButton");
  const backToDashboardButton = document.getElementById("backToDashboardButton");
  const floatingPdfButton = document.getElementById("floatingPdfButton");
  const fotosUnidadeContainer = document.getElementById("fotosUnidade");
  const inconformidadesContainer = document.getElementById("inconformidades");
  const log = document.getElementById("formLog");
  const draftStatus = document.getElementById("draftStatus");
  const submitButton = document.getElementById("submitButton");
  const progressFill = document.getElementById("progressFill");
  const fotoCount = document.getElementById("fotoCount");
  const inconformidadeCount = document.getElementById("inconformidadeCount");
  const highRiskCount = document.getElementById("highRiskCount");
  const reviewSummary = document.getElementById("reviewSummary");
  const generationStatus = document.getElementById("generationStatus");
  const aiSuggestionPanel = document.getElementById("aiSuggestionPanel");
  const aiSuggestionTitle = document.getElementById("aiSuggestionTitle");
  const aiOriginalText = document.getElementById("aiOriginalText");
  const aiSuggestedText = document.getElementById("aiSuggestedText");
  const aiSuggestionNote = document.getElementById("aiSuggestionNote");
  const aiImageReview = document.getElementById("aiImageReview");
  const aiReviewedImage = document.getElementById("aiReviewedImage");
  const aiReviewedImageMeta = document.getElementById("aiReviewedImageMeta");
  const aiAcceptButton = document.getElementById("aiAcceptButton");
  const aiRejectButton = document.getElementById("aiRejectButton");
  const aiCloseButton = document.getElementById("aiCloseButton");
  const stepOrder = ["dados", "fotos", "inconformidades", "revisao", "gerar"];
  const stepPanels = Array.from(document.querySelectorAll("[data-step]"));
  const stepButtons = Array.from(document.querySelectorAll("[data-step-target]"));
  const routePanels = Array.from(document.querySelectorAll("[data-route]"));
  const routeButtons = Array.from(document.querySelectorAll("[data-route-target]"));
  const dashboardActionButtons = Array.from(document.querySelectorAll("[data-dashboard-action]"));
  const homeActionButtons = Array.from(document.querySelectorAll("[data-home-action]"));
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
  const heicExtensions = new Set(["heic", "heif"]);
  const maxFotosUnidade = config.maxFotosUnidade || 20;
  const maxInconformidades = config.maxInconformidades || 20;
  const defaultDraftId = "relatorio-fiscalizacao-draft-v2";
  const saasStoreKey = "obrareport-saas-v1";
  const localAccessSessionKey = "obrareport_local_access_granted_v1";
  const STOCK_MASTER_STORAGE_KEY = "obrareport_stock_master_v1";
  const STOCK_PURCHASE_REVIEWED_STORAGE_KEY = "obrareport_stock_purchase_reviewed_v1";
  const STOCK_NOTES_STORAGE_KEY = "obrareport_stock_notes_v1";
  const STOCK_QUICK_EXAMPLE_STORAGE_KEY = "obraReportStockIaQuickExample";
  const STOCK_MODE_STORAGE_KEY = "obrareport_stock_mode_v1";
  const ALMOX_STORAGE_KEY = "obraReportAlmoxarifadoData";
  const STOCK_AI_COMPOSITIONS_LIBRARY_VERSION = "1.2";
  const STOCK_AI_DEMO_COMPOSITION_SOURCE = "Base técnica demonstrativa/editável";
  const STOCK_AI_DEMO_COMPOSITION_WARNING = "Composição demonstrativa/editável. Validar antes de orçamento, compra oficial ou medição contratual.";
  const DEFAULT_STOCK_ENVIRONMENT_ID = "env_almox_demo";
  const STOCK_NOTE_FILE_PREVIEW_LIMIT = 1024 * 1024;
  const ALMOX_NOTE_FILE_MAX_SIZE = 10 * 1024 * 1024;
  const ALMOX_OCR_TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@2.1.5/dist/tesseract.min.js";
  const ALMOX_OCR_PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
  const ALMOX_OCR_PDF_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const ALMOX_OCR_PDF_MAX_PAGES = 3;
  const localAccessPassword = clean(config.localAccessPassword || "ObraReport2026");
  const imageCache = new Map();
  let appState = loadLocalData();
  let currentUser = getCurrentUser_();
  let activeReportId = null;
  let draftSaveTimer = null;
  let localSaveTimer = null;
  let cloudSyncTimer = null;
  let billingAlertTimer = null;
  let isApplyingCloudState = false;
  let imageProcessingQueue = Promise.resolve();
  let activeAiTarget = null;
  let dailyLogDraft = createEmptyDailyLogDraft_();
  let currentDailyLogMaterialRequests_ = [];
  let dailyLogSearchTerm = "";
  let compositionDraft = createEmptyCompositionDraft_();
  let pendingHomeAction = "";
  let localAccessGrantedInMemory = false;
  let stockIaCurrentMode = "obra";
  let stockIaCurrentPeriod = "30d";
  let stockIaLastAnswer = "";
  let almoxSearchTerm = "";
  let almoxLastSummaryText = "";
  let almoxLastAuditText = "";
  let almoxDashboardPeriod = "30d";
  let activeStockEnvironmentId = "";
  let almoxItemsVisible = false;
  let almoxHistoryVisible = false;
  let almoxHistoryFilter = "all";
  let stockDemoRole = "";
  let stockDemoUrlContextApplied = false;
  let stockDemoRemoteAvailable = false;
  let stockDemoRemoteRevision = 0;
  let stockDemoRemoteSyncTimer = null;
  let stockDemoRemoteApplying = false;
  let almoxParsedNoteItems = [];
  let almoxFiscalOcrReviewData = createEmptyFiscalOcrReviewReport_();
  let almoxLastFiscalDiscardedDuplicates = [];
  let almoxLastFiscalRejectedItems = [];
  let almoxNoteImportSource = "";
  let almoxNoteFileDraft = null;
  let almoxNoteOcrReady = false;
  let almoxOcrSequence = 0;
  const externalScriptPromises = {};
  let dailyLogEstimateDraft = {
    items: [],
    audit: [],
    missing: [],
    purchasePlan: null,
    editable: false
  };

  const todayInput = document.querySelector("[name='dataVistoria']");
  if (todayInput) {
    todayInput.valueAsDate = new Date();
  }

  renderFotoUnidadeFields();
  renderInconformidadeFields();
  initializeWizard_();
  initializeDraft_();
  initializeAiAssistant_();
  initializeDailyLogModule_();
  initializeSaas_();

  if (openReportButton && homePanel && reportPanel) {
    openReportButton.addEventListener("click", function () {
      if (currentUser && hasLocalAccessSession_()) {
        showDashboardPanel_("dashboard");
        return;
      }

      showLoginPanel_();
    });
  }

  homeActionButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      handleHomeAction_(button.dataset.homeAction);
    });
  });

  initializeHomeQueryActions_();

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    try {
      if (!validateAllRequired_()) {
        return;
      }

      setBusy(true);
      setGenerationStatus_("Processando imagens...");
      setLog("Processando imagens...");

      if (!config.appsScriptUrl || config.appsScriptUrl.includes("COLE_AQUI")) {
        throw new Error("Configure a URL do Web App em relatorio-config.js.");
      }

      const formData = new FormData(form);
      const fotosUnidade = await collectFotosUnidade_(formData);
      const inconformidades = await collectInconformidades_(formData);

      if (!fotosUnidade.length && !inconformidades.length) {
        throw new Error("Envie pelo menos uma foto da unidade ou uma inconformidade.");
      }

      const payload = {
        submittedAt: new Date().toISOString(),
        source: window.location.href,
        tipoRelatorio: "fiscalizacao",
        report: {
          obra: clean(formData.get("obra")),
          cliente: getActiveReportClientName_(),
          dataVistoria: clean(formData.get("dataVistoria")),
          responsavelTecnico: clean(formData.get("responsavelTecnico")),
          nomeEmpresa: clean(formData.get("nomeEmpresa")),
          creaCau: clean(formData.get("creaCau") || formData.get("registroProfissional")),
          logoEmpresaUrl: clean(formData.get("logoEmpresaUrl")),
          logoEmpresaBase64: clean(formData.get("logoEmpresaBase64")),
          assinaturaUrl: clean(formData.get("assinaturaUrl")),
          assinaturaBase64: clean(formData.get("assinaturaBase64")),
          local: clean(formData.get("local")),
          dataInicioObra: clean(formData.get("dataInicioObra")),
          linkCameras: clean(formData.get("linkCameras")),
          tipoObra: clean(formData.get("tipoObra")),
          avancoFisico: clean(formData.get("avancoFisico")),
          avancoFinanceiro: clean(formData.get("avancoFinanceiro")),
          funcionariosCampo: clean(formData.get("funcionariosCampo")),
          utilizacaoEpi: clean(formData.get("utilizacaoEpi")),
          controleConcreto: clean(formData.get("controleConcreto")),
          observacoes: clean(formData.get("observacoes")),
          conclusaoTecnica: clean(formData.get("conclusaoTecnica")),
          revisaoTecnicaIa: clean(formData.get("revisaoTecnicaIa")),
          emailDestino: clean(formData.get("emailDestino"))
        },
        fotosUnidade: fotosUnidade,
        inconformidades: inconformidades,
        billing: buildBillingExportSnapshot_()
      };

      setGenerationStatus_("Enviando PDF...");
      setLog("Enviando PDF...");

      const response = await fetch(config.appsScriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch (error) {
        throw new Error("Resposta inválida do Apps Script: " + text.slice(0, 180));
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Falha ao gerar relatório.");
      }

      saveActiveReportExport_(result.pdfUrl, payload);
      setGenerationStatus_("Relatório gerado com sucesso.");
      setLog("Relatório enviado com sucesso. PDF: " + result.pdfUrl, "success");

      if (!activeReportId) {
        form.reset();
        imageCache.clear();
        clearAllImagePreviews_();
        await clearDraft_();

        if (todayInput) {
          todayInput.valueAsDate = new Date();
        }
      } else {
        await saveDraft_();
      }
    } catch (error) {
      console.error(error);
      setGenerationStatus_("Não foi possível gerar o relatório.");
      setLog(error.message || "Erro inesperado ao enviar relatório.", "error");
    } finally {
      setBusy(false);
    }
  });

  async function collectFotosUnidade_(formData) {
    const fotos = [];

    for (let index = 1; index <= maxFotosUnidade; index += 1) {
      const number = String(index).padStart(2, "0");
      const photoInput = form.querySelector("[name='fotoUnidade" + number + "']");
      const preparedImage = await getPreparedImage_(photoInput, "UNIDADE-" + number, "Foto da Unidade " + number);
      const descricao = clean(formData.get("descricaoFotoUnidade" + number));

      if (!preparedImage && !descricao) {
        continue;
      }

      if (!preparedImage) {
        throw new Error("Anexe a Foto da Unidade " + number + ".");
      }

      if (!descricao) {
        throw new Error("Preencha a descrição da Foto da Unidade " + number + ".");
      }

      fotos.push({
        numero: number,
        descricao: descricao,
        foto: preparedImage
      });
    }

    return fotos;
  }

  async function collectInconformidades_(formData) {
    const inconformidades = [];

    for (let index = 1; index <= maxInconformidades; index += 1) {
      const number = String(index).padStart(2, "0");
      const photoInput = form.querySelector("[name='fotoInconformidade" + number + "']");
      const preparedImage = await getPreparedImage_(photoInput, "RQO-" + number, "Inconformidade " + number);
      const descricao = clean(formData.get("descricaoInconformidade" + number));
      const solucao = clean(formData.get("solucaoInconformidade" + number));
      const grauRisco = clean(formData.get("grauRisco" + number));

      if (!preparedImage && !descricao && !solucao && !grauRisco) {
        continue;
      }

      if (!preparedImage) {
        throw new Error("Anexe a foto da Inconformidade " + number + ".");
      }

      if (!descricao || !solucao || !grauRisco) {
        throw new Error("Preencha descrição, solução e grau de risco da Inconformidade " + number + ".");
      }

      inconformidades.push({
        numero: number,
        descricaoTecnica: descricao,
        solucaoRecomendada: solucao,
        grauRisco: grauRisco,
        foto: preparedImage
      });
    }

    return inconformidades;
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function getLocalStorage_() {
    try {
      return window.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function getSessionStorage_() {
    try {
      return window.sessionStorage || null;
    } catch (error) {
      return null;
    }
  }

  function isStockAiPublicDemo_() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return clean(params.get("product")).toLowerCase() === "stock-ai";
    } catch (error) {
      return false;
    }
  }

  function getStockAiPublicParam_(name) {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return clean(params.get(name));
    } catch (error) {
      return "";
    }
  }

  function isStockAiPublicRoute_(route) {
    return ["stock-ia", "almoxarifado"].indexOf(route) >= 0;
  }

  function renderStockAiPublicShell_() {
    if (!dashboardPanel || document.getElementById("stockAiPublicShell")) {
      return;
    }

    const shell = document.createElement("div");
    shell.id = "stockAiPublicShell";
    shell.className = "stock-ai-public-shell";
    shell.innerHTML = [
      "<a class=\"stock-ai-public-brand\" href=\"../stock-ai.html\" aria-label=\"Stock AI\">",
      "<span>S</span>",
      "<strong>Stock AI</strong>",
      "<small>Almoxarifado AI</small>",
      "</a>",
      "<div class=\"stock-ai-public-actions\" aria-label=\"Navegacao Stock AI\">",
      "<a href=\"?product=stock-ai#app/almoxarifado\">Almoxarifado AI</a>",
      "<a href=\"?product=stock-ai#app/stock-ia\">Stock AI Obras</a>",
      "<a href=\"../elo.html\">Elo</a>",
      "</div>"
    ].join("");

    dashboardPanel.insertBefore(shell, dashboardPanel.firstChild);
  }

  function applyStockAiPublicMode_() {
    if (!isStockAiPublicDemo_()) {
      return;
    }

    document.body.classList.add("stock-ai-public-mode");
    document.title = "Stock AI | Demonstração do Almoxarifado AI";
    applyStockAiPublicRoleParam_();
    renderStockAiPublicShell_();
  }

  function hasLocalAccessSession_() {
    const storage = getSessionStorage_();
    if (!storage) {
      return localAccessGrantedInMemory;
    }

    return Boolean(storage && storage.getItem(localAccessSessionKey) === "granted");
  }

  function grantLocalAccessSession_() {
    const storage = getSessionStorage_();
    localAccessGrantedInMemory = true;
    if (!storage) {
      return;
    }

    storage.setItem(localAccessSessionKey, "granted");
  }

  function revokeLocalAccessSession_() {
    const storage = getSessionStorage_();
    localAccessGrantedInMemory = false;
    if (!storage) {
      return;
    }

    storage.removeItem(localAccessSessionKey);
  }

  function getRestrictedAccessMessage_() {
    return loadStockQuickExample_()
      ? "Entre para salvar este exemplo no Stock IA."
      : "Informe a senha para acessar a area interna.";
  }

  function getStockDemoRole_() {
    if (stockDemoRole) {
      return stockDemoRole;
    }

    try {
      const storage = getLocalStorage_();
      stockDemoRole = clean(storage && storage.getItem("stock_ai_demo_role_v1")) || "gestor";
    } catch (error) {
      stockDemoRole = "gestor";
    }

    return stockDemoRole;
  }

  function setStockDemoRole_(role) {
    const safeRole = role === "almoxarife" ? "almoxarife" : "gestor";
    stockDemoRole = safeRole;

    try {
      const storage = getLocalStorage_();
      if (storage) {
        storage.setItem("stock_ai_demo_role_v1", safeRole);
      }
    } catch (error) {
      console.warn("Nao foi possivel salvar o perfil demo do Stock AI.", error);
    }

    renderAlmoxarifadoPanel_();
    showAlmoxToast_(safeRole === "gestor"
      ? "Perfil Gestor ativo. Aprove ou rejeite solicitacoes."
      : "Perfil Almoxarife ativo. Entradas e saidas vao para aprovacao.",
      "info");
    scrollToAlmoxSection_("almoxDemoAccessPanel");
  }

  function applyStockAiPublicRoleParam_() {
    const role = getStockAiPublicParam_("role");
    if (role !== "gestor" && role !== "almoxarife") {
      return;
    }

    stockDemoRole = role;
    try {
      const storage = getLocalStorage_();
      if (storage) {
        storage.setItem("stock_ai_demo_role_v1", role);
      }
    } catch (error) {
      console.warn("Nao foi possivel aplicar o perfil informado na URL.", error);
    }
  }

  function getStockDemoUser_() {
    const environment = getActiveStockEnvironment_();
    const role = getStockDemoRole_();
    const managerEmail = clean(environment.managerEmail) || "gestor@stock-ai.demo";

    if (role === "almoxarife") {
      return {
        id: "demo-almoxarife-" + clean(environment.id || DEFAULT_STOCK_ENVIRONMENT_ID),
        name: "Almoxarife demo",
        email: clean(environment.warehouseEmail) || "almoxarife@stock-ai.demo",
        role: "almoxarife"
      };
    }

    return {
      id: "demo-gestor-" + clean(environment.id || DEFAULT_STOCK_ENVIRONMENT_ID),
      name: clean(environment.responsible) || "Gestor demo",
      email: managerEmail,
      role: "gestor"
    };
  }

  function getStockDemoRemoteApiUrl_() {
    if (clean(config.stockDemoApiUrl)) {
      return clean(config.stockDemoApiUrl);
    }

    const protocol = window.location && window.location.protocol === "https:" ? "https:" : "http:";
    const hostname = window.location && window.location.hostname ? window.location.hostname : "localhost";
    const host = hostname === "127.0.0.1" || hostname === "localhost" ? "localhost" : hostname;
    return protocol + "//" + host + ":3000/api/stock-demo";
  }

  function getStockDemoRemoteKey_() {
    const urlOrganization = getStockAiPublicParam_("organization");
    const urlUnit = getStockAiPublicParam_("unit");
    const environment = getActiveStockEnvironment_();
    const organization = urlOrganization || clean(environment.clientName) || "stock-ai";
    const unit = urlUnit || clean(environment.unitName || environment.workName) || "demo";
    const raw = organization + "::" + unit;
    const normalized = typeof raw.normalize === "function"
      ? raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      : raw;
    return normalized.toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "stock-ai-demo";
  }

  function isStockDemoRemoteEnabled_() {
    return isStockAiPublicDemo_();
  }

  function startStockDemoRemoteSync_() {
    if (!isStockDemoRemoteEnabled_() || stockDemoRemoteSyncTimer) {
      return;
    }

    fetchStockDemoRemoteState_(true);
    stockDemoRemoteSyncTimer = window.setInterval(function () {
      fetchStockDemoRemoteState_(true);
    }, 3000);
  }

  async function fetchStockDemoRemoteState_(silent) {
    if (!isStockDemoRemoteEnabled_() || stockDemoRemoteApplying) {
      return false;
    }

    try {
      const url = getStockDemoRemoteApiUrl_() + "/state?key=" + encodeURIComponent(getStockDemoRemoteKey_());
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });
      const data = await response.json().catch(function () { return null; });

      if (!response.ok || !data || !data.ok) {
        stockDemoRemoteAvailable = false;
        return false;
      }

      stockDemoRemoteAvailable = true;
      if (data.state && Number(data.revision || 0) > stockDemoRemoteRevision) {
        stockDemoRemoteRevision = Number(data.revision || 0);
        stockDemoRemoteApplying = true;
        saveAlmoxState_(data.state);
        stockDemoRemoteApplying = false;
        renderAlmoxarifadoPanel_();
        if (!silent) {
          showAlmoxToast_("Demo remota atualizada.", "success");
        }
      }
      return true;
    } catch (error) {
      stockDemoRemoteAvailable = false;
      return false;
    }
  }

  async function pushStockDemoRemoteState_(state) {
    if (!isStockDemoRemoteEnabled_() || stockDemoRemoteApplying) {
      return false;
    }

    try {
      const response = await fetch(getStockDemoRemoteApiUrl_() + "/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          key: getStockDemoRemoteKey_(),
          state: state || loadAlmoxState_()
        })
      });
      const data = await response.json().catch(function () { return null; });

      if (!response.ok || !data || !data.ok) {
        stockDemoRemoteAvailable = false;
        return false;
      }

      stockDemoRemoteAvailable = true;
      stockDemoRemoteRevision = Math.max(stockDemoRemoteRevision, Number(data.revision || 0));
      return true;
    } catch (error) {
      stockDemoRemoteAvailable = false;
      return false;
    }
  }

  function syncStockDemoRemoteAfterLocalChange_() {
    if (!isStockDemoRemoteEnabled_()) {
      return;
    }

    pushStockDemoRemoteState_(loadAlmoxState_());
  }

  function syncStockDemoRemoteApprovalRequest_(request) {
    if (!isStockDemoRemoteEnabled_() || !request || !request.id) {
      return;
    }

    fetch(getStockDemoRemoteApiUrl_() + "/approval-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        key: getStockDemoRemoteKey_(),
        request: request,
        state: loadAlmoxState_()
      })
    }).then(function (response) {
      return response.json().then(function (data) {
        return {
          ok: response.ok && data && data.ok,
          data: data
        };
      });
    }).then(function (result) {
      stockDemoRemoteAvailable = Boolean(result.ok);
      if (result.ok && result.data) {
        stockDemoRemoteRevision = Math.max(stockDemoRemoteRevision, Number(result.data.revision || 0));
      }
    }).catch(function () {
      stockDemoRemoteAvailable = false;
    });
  }

  function syncStockDemoRemoteApprovalDecision_(requestId, action) {
    if (!isStockDemoRemoteEnabled_() || !requestId) {
      return;
    }

    const endpoint = action === "reject" ? "reject" : "approve";
    fetch(getStockDemoRemoteApiUrl_() + "/approval-requests/" + encodeURIComponent(requestId) + "/" + endpoint + "?key=" + encodeURIComponent(getStockDemoRemoteKey_()), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        key: getStockDemoRemoteKey_(),
        state: loadAlmoxState_()
      })
    }).then(function (response) {
      return response.json().then(function (data) {
        return {
          ok: response.ok && data && data.ok,
          data: data
        };
      });
    }).then(function (result) {
      stockDemoRemoteAvailable = Boolean(result.ok);
      if (result.ok && result.data) {
        stockDemoRemoteRevision = Math.max(stockDemoRemoteRevision, Number(result.data.revision || 0));
      }
    }).catch(function () {
      stockDemoRemoteAvailable = false;
    });
  }

  function ensureCompositionLibrary_(items) {
    const current = Array.isArray(items) ? items : [];
    const defaultById = {};

    getDefaultCompositions_().forEach(function (composition) {
      defaultById[composition.id] = composition;
    });

    const normalized = current
      .filter(Boolean)
      .map(normalizeComposition_)
      .map(function (composition) {
        if (!isStockAiDefaultComposition_(composition)) {
          return composition;
        }
        composition.source = STOCK_AI_DEMO_COMPOSITION_SOURCE;
        composition.note = composition.note || STOCK_AI_DEMO_COMPOSITION_WARNING;
        composition.category = composition.category || (defaultById[composition.id] && defaultById[composition.id].category) || "Geral";
        composition.aliases = composition.aliases && composition.aliases.length
          ? composition.aliases
          : ((defaultById[composition.id] && defaultById[composition.id].aliases) || []);
        composition.libraryVersion = composition.libraryVersion || STOCK_AI_COMPOSITIONS_LIBRARY_VERSION;
        return composition;
      });
    const existingIds = new Set(normalized.map(function (composition) {
      return composition.id;
    }));

    Object.keys(defaultById).forEach(function (id) {
      if (!existingIds.has(id)) {
        normalized.push(cloneComposition_(defaultById[id]));
      }
    });

    return normalized;
  }

  function getDefaultCompositions_() {
    return [
      createDefaultComposition_("std_escavacao_manual", "Escavação manual", "Fundação / Estrutura", "m³", 8, [
        ["Mão de obra de escavação", 1.2, "h", "Coeficiente demonstrativo/editável."],
        ["Remoção manual de solo", 1, "m³", "Coeficiente demonstrativo/editável."],
        ["Ferramentas manuais", 0.05, "un", "Coeficiente demonstrativo/editável."]
      ], ["escavacao", "vala", "sapata", "fundacao"]),
      createDefaultComposition_("std_lastro_concreto_magro", "Lastro de concreto magro", "Fundação / Estrutura", "m³", 5, [
        ["Cimento", 4.5, "saco", "Coeficiente demonstrativo/editável."],
        ["Areia", 0.55, "m³", "Coeficiente demonstrativo/editável."],
        ["Brita", 0.75, "m³", "Coeficiente demonstrativo/editável."]
      ], ["lastro", "concreto magro", "regularizacao de fundo"]),
      createDefaultComposition_("std_concreto_simples", "Concreto simples", "Fundação / Estrutura", "m³", 5, [
        ["Cimento", 7, "saco", "Coeficiente demonstrativo/editável."],
        ["Areia", 0.55, "m³", "Coeficiente demonstrativo/editável."],
        ["Brita", 0.8, "m³", "Coeficiente demonstrativo/editável."]
      ], ["concreto", "concreto nao armado"]),
      createDefaultComposition_("std_concreto_estrutural", "Concreto estrutural", "Fundação / Estrutura", "m³", 5, [
        ["Cimento", 8, "saco", "Coeficiente demonstrativo/editável."],
        ["Areia média", 0.52, "m³", "Coeficiente demonstrativo/editável."],
        ["Brita 1", 0.78, "m³", "Coeficiente demonstrativo/editável."],
        ["Aditivo plastificante", 0.8, "litro", "Coeficiente demonstrativo/editável."]
      ], ["concreto armado", "estrutura", "viga", "pilar", "laje"]),
      createDefaultComposition_("std_forma_madeira", "Forma de madeira", "Fundação / Estrutura", "m²", 10, [
        ["Compensado plastificado", 0.22, "m²", "Coeficiente demonstrativo/editável."],
        ["Sarrafo de madeira", 0.55, "m", "Coeficiente demonstrativo/editável."],
        ["Prego", 0.08, "kg", "Coeficiente demonstrativo/editável."],
        ["Desmoldante", 0.04, "litro", "Coeficiente demonstrativo/editável."]
      ], ["forma", "caixaria", "madeira forma"]),
      createDefaultComposition_("std_armacao_aco_ca50", "Armação de aço CA-50", "Fundação / Estrutura", "kg", 5, [
        ["Aço CA-50", 1, "kg", "Coeficiente demonstrativo/editável."],
        ["Arame recozido", 0.025, "kg", "Coeficiente demonstrativo/editável."],
        ["Espaçador plástico", 0.08, "un", "Coeficiente demonstrativo/editável."]
      ], ["armacao", "armação", "ferro", "aco", "aço", "ca50"]),
      createDefaultComposition_("std_pilar_concreto_armado", "Pilar de concreto armado", "Fundação / Estrutura", "m³", 5, [
        ["Concreto estrutural", 1, "m³", "Coeficiente demonstrativo/editável."],
        ["Aço CA-50", 95, "kg", "Coeficiente demonstrativo/editável."],
        ["Forma de madeira", 8, "m²", "Coeficiente demonstrativo/editável."]
      ], ["pilar", "coluna"]),
      createDefaultComposition_("std_viga_concreto_armado", "Viga de concreto armado", "Fundação / Estrutura", "m³", 5, [
        ["Concreto estrutural", 1, "m³", "Coeficiente demonstrativo/editável."],
        ["Aço CA-50", 85, "kg", "Coeficiente demonstrativo/editável."],
        ["Forma de madeira", 6.5, "m²", "Coeficiente demonstrativo/editável."]
      ], ["viga", "baldrame"]),
      createDefaultComposition_("std_laje_concreto", "Laje maciça ou pré-moldada", "Fundação / Estrutura", "m²", 5, [
        ["Concreto estrutural", 0.1, "m³", "Coeficiente demonstrativo/editável."],
        ["Aço CA-50", 7, "kg", "Coeficiente demonstrativo/editável."],
        ["Forma/escoramento", 1, "m²", "Coeficiente demonstrativo/editável."]
      ], ["laje", "laje macica", "laje premoldada", "pré-moldada"]),

      createDefaultComposition_("std_alvenaria", "Alvenaria de bloco cerâmico", "Alvenaria / Vedação", "m²", 5, [
        ["Bloco cerâmico", 13, "un", ""],
        ["Cimento", 0.1, "saco", ""],
        ["Areia", 0.018, "m³", ""]
      ], ["alvenaria", "parede", "bloco", "bloco ceramico", "vedacao"]),
      createDefaultComposition_("std_alvenaria_bloco_concreto", "Alvenaria de bloco de concreto", "Alvenaria / Vedação", "m²", 5, [
        ["Bloco de concreto", 12.5, "un", "Coeficiente demonstrativo/editável."],
        ["Argamassa de assentamento", 0.02, "m³", "Coeficiente demonstrativo/editável."],
        ["Cimento", 0.12, "saco", "Coeficiente demonstrativo/editável."]
      ], ["parede bloco concreto", "bloco concreto", "alvenaria estrutural"]),
      createDefaultComposition_("std_verga_contraverga", "Verga e contraverga", "Alvenaria / Vedação", "m", 5, [
        ["Concreto estrutural", 0.025, "m³", "Coeficiente demonstrativo/editável."],
        ["Aço CA-50", 1.4, "kg", "Coeficiente demonstrativo/editável."],
        ["Forma de madeira", 0.25, "m²", "Coeficiente demonstrativo/editável."]
      ], ["verga", "contraverga", "abertura"]),
      createDefaultComposition_("std_grauteamento_simples", "Grauteamento simples", "Alvenaria / Vedação", "m³", 5, [
        ["Graute", 1, "m³", "Coeficiente demonstrativo/editável."],
        ["Cimento", 7, "saco", "Coeficiente demonstrativo/editável."],
        ["Pedrisco", 0.75, "m³", "Coeficiente demonstrativo/editável."]
      ], ["graute", "grauteamento"]),

      createDefaultComposition_("std_chapisco", "Chapisco", "Revestimentos", "m²", 5, [
        ["Cimento", 0.05, "saco", ""],
        ["Areia", 0.006, "m³", ""]
      ], ["chapisco", "massa chapisco"]),
      createDefaultComposition_("std_emboco", "Emboço", "Revestimentos", "m²", 5, [
        ["Cimento", 0.07, "saco", ""],
        ["Areia", 0.018, "m³", ""]
      ], ["emboco", "emboço", "massa grossa", "massa"]),
      createDefaultComposition_("std_reboco", "Reboco", "Revestimentos", "m²", 5, [
        ["Cimento", 0.08, "saco", ""],
        ["Areia", 0.02, "m³", ""]
      ], ["reboco", "massa fina", "massa"]),
      createDefaultComposition_("std_contrapiso", "Contrapiso", "Revestimentos", "m²", 5, [
        ["Cimento", 0.12, "saco", ""],
        ["Areia", 0.025, "m³", ""]
      ], ["contrapiso", "regularizacao piso", "regularização piso"]),
      createDefaultComposition_("std_piso", "Piso cerâmico", "Revestimentos", "m²", 3, [
        ["Piso cerâmico", 1.05, "m²", ""],
        ["Argamassa colante", 0.25, "saco", ""],
        ["Rejunte", 0.2, "kg", ""]
      ], ["piso", "piso ceramico", "ceramica piso"]),
      createDefaultComposition_("std_revestimento", "Revestimento cerâmico de parede", "Revestimentos", "m²", 3, [
        ["Revestimento cerâmico", 1.05, "m²", ""],
        ["Argamassa colante", 0.25, "saco", ""],
        ["Rejunte", 0.18, "kg", ""]
      ], ["revestimento", "azulejo", "ceramica parede", "parede ceramica"]),
      createDefaultComposition_("std_rejuntamento", "Rejuntamento", "Revestimentos", "m²", 3, [
        ["Rejunte", 0.22, "kg", "Coeficiente demonstrativo/editável."],
        ["Espaçador", 0.08, "un", "Coeficiente demonstrativo/editável."],
        ["Limpeza pós-rejunte", 0.02, "litro", "Coeficiente demonstrativo/editável."]
      ], ["rejunte", "rejuntamento"]),
      createDefaultComposition_("std_pintura", "Pintura interna", "Revestimentos", "m²", 5, [
        ["Tinta", 0.12, "litro", ""],
        ["Massa corrida", 0.18, "kg", ""]
      ], ["pintura", "pintura interna", "tinta parede"]),
      createDefaultComposition_("std_pintura_externa", "Pintura externa", "Revestimentos", "m²", 5, [
        ["Tinta acrílica externa", 0.14, "litro", "Coeficiente demonstrativo/editável."],
        ["Selador acrílico", 0.08, "litro", "Coeficiente demonstrativo/editável."],
        ["Massa acrílica", 0.15, "kg", "Coeficiente demonstrativo/editável."]
      ], ["pintura externa", "fachada", "tinta externa"]),

      createDefaultComposition_("std_telhado_madeira", "Estrutura de madeira para telhado", "Cobertura", "m²", 7, [
        ["Madeiramento", 0.045, "m³", "Coeficiente demonstrativo/editável."],
        ["Prego", 0.1, "kg", "Coeficiente demonstrativo/editável."],
        ["Tratamento preservativo", 0.05, "litro", "Coeficiente demonstrativo/editável."]
      ], ["estrutura telhado", "madeiramento", "telhado madeira"]),
      createDefaultComposition_("std_telhado", "Telha cerâmica", "Cobertura", "m²", 7, [
        ["Telha cerâmica", 16, "un", "Coeficiente demonstrativo/editável."],
        ["Cumeeira cerâmica", 0.25, "un", "Coeficiente demonstrativo/editável."],
        ["Prego/arame de fixação", 0.04, "kg", "Coeficiente demonstrativo/editável."]
      ], ["telhado", "telha", "telha ceramica", "cobertura ceramica"]),
      createDefaultComposition_("std_telha_fibrocimento", "Telha fibrocimento", "Cobertura", "m²", 5, [
        ["Telha fibrocimento", 1.05, "m²", "Coeficiente demonstrativo/editável."],
        ["Parafuso de fixação", 2.5, "un", "Coeficiente demonstrativo/editável."],
        ["Arruela de vedação", 2.5, "un", "Coeficiente demonstrativo/editável."]
      ], ["fibrocimento", "telha brasilit", "cobertura fibrocimento"]),
      createDefaultComposition_("std_rufo_calha", "Rufo/calha simples", "Cobertura", "m", 5, [
        ["Chapa galvanizada", 1.05, "m", "Coeficiente demonstrativo/editável."],
        ["Selante PU", 0.08, "tubo", "Coeficiente demonstrativo/editável."],
        ["Parafuso/bucha", 2, "un", "Coeficiente demonstrativo/editável."]
      ], ["rufo", "calha", "pingadeira"]),

      createDefaultComposition_("std_ponto_eletrico", "Ponto elétrico simples", "Instalações", "un", 5, [
        ["Caixa elétrica", 1, "un", "Coeficiente demonstrativo/editável."],
        ["Eletroduto", 3, "m", "Coeficiente demonstrativo/editável."],
        ["Cabo elétrico", 9, "m", "Coeficiente demonstrativo/editável."],
        ["Tomada/interruptor", 1, "un", "Coeficiente demonstrativo/editável."]
      ], ["ponto eletrico", "ponto elétrico", "tomada", "interruptor", "fiação"]),
      createDefaultComposition_("std_eletroduto", "Eletroduto embutido", "Instalações", "m", 3, [
        ["Eletroduto", 1.03, "m", ""],
        ["Conexões elétricas", 0.15, "un", ""],
        ["Fixadores", 0.4, "un", "Coeficiente demonstrativo/editável."]
      ], ["eletroduto", "conduite", "conduíte"]),
      createDefaultComposition_("std_cabo_eletrico", "Cabo elétrico", "Instalações", "m", 3, [
        ["Cabo elétrico", 1.05, "m", "Coeficiente demonstrativo/editável."],
        ["Fita isolante", 0.01, "rolo", "Coeficiente demonstrativo/editável."],
        ["Identificador", 0.02, "un", "Coeficiente demonstrativo/editável."]
      ], ["cabo", "fio", "fiacao", "fiação", "cabo eletrico"]),
      createDefaultComposition_("std_ponto_hidraulico_agua_fria", "Ponto hidráulico água fria", "Instalações", "un", 5, [
        ["Tubo PVC água fria", 3, "m", "Coeficiente demonstrativo/editável."],
        ["Conexões PVC água fria", 3, "un", "Coeficiente demonstrativo/editável."],
        ["Registro/terminal", 1, "un", "Coeficiente demonstrativo/editável."]
      ], ["ponto hidraulico", "ponto hidráulico", "agua fria", "água fria"]),
      createDefaultComposition_("std_ponto_sanitario", "Ponto sanitário", "Instalações", "un", 5, [
        ["Tubo PVC esgoto", 3, "m", "Coeficiente demonstrativo/editável."],
        ["Conexões PVC esgoto", 3, "un", "Coeficiente demonstrativo/editável."],
        ["Caixa sifonada/terminal", 0.5, "un", "Coeficiente demonstrativo/editável."]
      ], ["ponto sanitario", "ponto sanitário", "esgoto banheiro"]),
      createDefaultComposition_("std_esgoto", "Tubulação PVC esgoto", "Instalações", "m", 3, [
        ["Tubo PVC esgoto", 1.03, "m", ""],
        ["Conexões PVC", 0.25, "un", ""]
      ], ["tubulacao esgoto", "tubulação esgoto", "esgoto", "pvc esgoto"]),
      createDefaultComposition_("std_agua", "Tubulação PVC água fria", "Instalações", "m", 3, [
        ["Tubo PVC água", 1.03, "m", ""],
        ["Conexões PVC", 0.2, "un", ""]
      ], ["tubulacao agua", "tubulação água", "agua fria", "água fria", "pvc agua"]),

      createDefaultComposition_("std_impermeabilizacao_simples", "Impermeabilização simples", "Outros serviços úteis", "m²", 5, [
        ["Primer", 0.12, "litro", "Coeficiente demonstrativo/editável."],
        ["Manta/argamassa impermeável", 1.05, "m²", "Coeficiente demonstrativo/editável."],
        ["Tela estruturante", 0.15, "m²", "Coeficiente demonstrativo/editável."]
      ], ["impermeabilizacao", "impermeabilização", "manta", "infiltracao"]),
      createDefaultComposition_("std_forro_gesso", "Forro de gesso", "Outros serviços úteis", "m²", 5, [
        ["Placa de gesso", 1.05, "m²", "Coeficiente demonstrativo/editável."],
        ["Perfil metálico", 1.8, "m", "Coeficiente demonstrativo/editável."],
        ["Parafuso", 12, "un", "Coeficiente demonstrativo/editável."],
        ["Massa para junta", 0.25, "kg", "Coeficiente demonstrativo/editável."]
      ], ["forro", "gesso", "forro gesso"]),
      createDefaultComposition_("std_drywall", "Drywall", "Outros serviços úteis", "m²", 5, [
        ["Chapa drywall", 2.1, "m²", "Coeficiente demonstrativo/editável."],
        ["Montante/guia metálica", 2.2, "m", "Coeficiente demonstrativo/editável."],
        ["Parafuso drywall", 18, "un", "Coeficiente demonstrativo/editável."],
        ["Massa e fita para junta", 0.3, "kg", "Coeficiente demonstrativo/editável."]
      ], ["drywall", "parede drywall", "gesso acartonado"]),
      createDefaultComposition_("std_pavimentacao_intertravada", "Pavimentação intertravada", "Outros serviços úteis", "m²", 5, [
        ["Paver/bloco intertravado", 1.03, "m²", "Coeficiente demonstrativo/editável."],
        ["Areia de assentamento", 0.05, "m³", "Coeficiente demonstrativo/editável."],
        ["Pó de pedra", 0.03, "m³", "Coeficiente demonstrativo/editável."]
      ], ["paver", "intertravado", "pavimentacao", "pavimentação"]),
      createDefaultComposition_("std_meio_fio", "Meio-fio", "Outros serviços úteis", "m", 5, [
        ["Meio-fio pré-moldado", 1.02, "m", "Coeficiente demonstrativo/editável."],
        ["Concreto de assentamento", 0.025, "m³", "Coeficiente demonstrativo/editável."],
        ["Argamassa de rejunte", 0.006, "m³", "Coeficiente demonstrativo/editável."]
      ], ["meio fio", "meio-fio", "guia"]),
      createDefaultComposition_("std_drenagem_simples", "Drenagem simples", "Outros serviços úteis", "m", 5, [
        ["Tubo drenante/PVC", 1.03, "m", "Coeficiente demonstrativo/editável."],
        ["Brita", 0.08, "m³", "Coeficiente demonstrativo/editável."],
        ["Manta geotêxtil", 1.1, "m²", "Coeficiente demonstrativo/editável."]
      ], ["drenagem", "dreno", "agua pluvial", "água pluvial"])
    ];
  }

  function createDefaultComposition_(id, service, category, productionUnit, lossPercent, materials, aliases) {
    return {
      id: id,
      service: service,
      category: category || "Geral",
      productionUnit: productionUnit,
      lossPercent: lossPercent,
      note: STOCK_AI_DEMO_COMPOSITION_WARNING,
      libraryVersion: STOCK_AI_COMPOSITIONS_LIBRARY_VERSION,
      aliases: Array.isArray(aliases) ? aliases : [],
      source: STOCK_AI_DEMO_COMPOSITION_SOURCE,
      sinapiCode: "",
      state: "",
      competence: "",
      externalSource: "",
      materials: materials.map(function (item, index) {
        return {
          id: id + "_mat_" + index,
          name: item[0],
          quantityPerUnit: item[1],
          unit: item[2],
          note: item[3] || ""
        };
      })
    };
  }

  function normalizeComposition_(composition) {
    const copy = cloneComposition_(composition);
    copy.id = copy.id || createId_("cmp");
    copy.service = clean(copy.service || copy.name) || "Serviço";
    copy.category = clean(copy.category) || "Geral";
    copy.productionUnit = clean(copy.productionUnit) || "m²";
    copy.lossPercent = parseNumber_(copy.lossPercent);
    copy.note = clean(copy.note);
    copy.source = clean(copy.source) || "Personalizada";
    copy.libraryVersion = clean(copy.libraryVersion);
    copy.aliases = Array.isArray(copy.aliases) ? copy.aliases.map(function (alias) {
      return clean(alias);
    }).filter(Boolean) : [];
    copy.sinapiCode = clean(copy.sinapiCode);
    copy.state = clean(copy.state);
    copy.competence = clean(copy.competence);
    copy.externalSource = clean(copy.externalSource);
    copy.materials = Array.isArray(copy.materials) ? copy.materials.map(function (material) {
      return {
        id: material.id || createId_("cmt"),
        name: clean(material.name),
        quantityPerUnit: parseNumber_(material.quantityPerUnit),
        unit: clean(material.unit) || "un",
        note: clean(material.note)
      };
    }).filter(function (material) {
      return material.name && material.quantityPerUnit > 0;
    }) : [];
    return copy;
  }

  function cloneComposition_(composition) {
    return JSON.parse(JSON.stringify(composition || {}));
  }

  function isStockAiDefaultComposition_(composition) {
    const source = clean(composition && composition.source);
    return source === "ObraReport" ||
      source === STOCK_AI_DEMO_COMPOSITION_SOURCE ||
      String(composition && composition.id || "").indexOf("std_") === 0;
  }

  function initializeSaas_() {
    bindSaasEvents_();
    applyStockAiPublicMode_();

    if (isStockAiPublicDemo_() && (!currentUser || !hasLocalAccessSession_())) {
      loginLocalFallback_("Visitante Stock AI", "demo@stock-ai.local");
      return;
    }

    if (!hasLocalAccessSession_()) {
      if (isRestrictedRouteHash_()) {
        const accessMessage = getRestrictedAccessMessage_();
        setCloudStatus_(accessMessage, "info");
        setLoginAccessStatus_(accessMessage, "info");
        showLoginPanel_();
        return;
      }

      showHomePanel_();
      return;
    }

    renderSaasState_();

    if (currentUser) {
      recoverDraft().catch(function (error) {
        console.warn("Não foi possível recuperar o estado local.", error);
        showDashboardPanel_(getRouteFromHash_());
      });

      if (appState.session && appState.session.token) {
        refreshCloudState_();
      } else {
        setCloudStatus_("Modo local ativo", "info");
      }
      return;
    }

    if (isRestrictedRouteHash_()) {
      const accessMessage = getRestrictedAccessMessage_();
      setCloudStatus_(accessMessage, "info");
      setLoginAccessStatus_(accessMessage, "info");
      showLoginPanel_();
      return;
    }

    showHomePanel_();
  }

  function bindSaasEvents_() {
    if (loginForm) {
      loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const informedName = clean(formData.get("userName"));
        const informedEmail = clean(formData.get("userEmail")).toLowerCase();
        const name = informedName || "Usuário ObraReport";
        const email = informedEmail || "local@obrareport.app";
        const password = clean(formData.get("userPassword"));

        if (!password) {
          setLoginAccessStatus_("Informe a senha para entrar.", "error");
          return;
        }

        if (!isLocalAccessPasswordValid_(password)) {
          setCloudStatus_("Senha incorreta para acesso local.", "error");
          setLoginAccessStatus_("Senha incorreta para acesso local.", "error");
          return;
        }

        if (!informedName || !informedEmail) {
          loginLocalFallback_(name, email);
          setCloudStatus_("Modo local ativo", "info");
          setLoginAccessStatus_("", "");
          runPendingHomeAction_();
          return;
        }

        try {
          setLoginAccessStatus_("Verificando acesso...", "info");
          setCloudStatus_("Conectando à nuvem...", "info");
          const result = await cloudApi_("auth.login", {
            name: name,
            email: email,
            password: password
          });

          await applyCloudLogin_(result);
          grantLocalAccessSession_();
          loginForm.reset();
          renderSaasState_();
          showDashboardPanel_(getRouteFromHash_());
          setCloudStatus_("Sincronizado na nuvem", "success");
          setLoginAccessStatus_("", "");
          runPendingHomeAction_();
        } catch (error) {
          console.error(error);
          loginLocalFallback_(name, email);
          setCloudStatus_("Modo local ativo. Publique o Apps Script novo para sincronizar na nuvem.", "error");
          setLoginAccessStatus_("", "");
          runPendingHomeAction_();
        }
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener("click", function () {
        activeReportId = null;
        revokeLocalAccessSession_();
        appState.session = null;
        setLastOpened_("dashboard");
        saveAppState_();
        currentUser = null;
        showHomePanel_();
      });
    }

    [saveNowButton, saveEditorNowButton].forEach(function (button) {
      if (!button) {
        return;
      }

      button.addEventListener("click", function () {
        saveNow_().catch(function (error) {
          console.error(error);
          setLocalStatus_("Alterações não salvas", "error");
        });
      });
    });

    if (dashboardPanel) {
      dashboardPanel.addEventListener("click", function (event) {
        const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
        const diaryRouteButton = target && target.closest ? target.closest("[data-route-target='diario']") : null;

        if (!diaryRouteButton) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        setLastOpened_("diario");
        scheduleLocalDataSave_();
        showDashboardPanel_("diario");
      }, true);
    }

    routeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setLastOpened_(button.dataset.routeTarget);
        scheduleLocalDataSave_();
        showDashboardPanel_(button.dataset.routeTarget);
      });
    });

    dashboardActionButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        handleDashboardAction_(button.dataset.dashboardAction);
      });
    });

    if (dashboardPanel) {
      dashboardPanel.addEventListener("click", function (event) {
        const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
        const periodButton = target && target.closest ? target.closest("[data-stock-period]") : null;
        const modeButton = target && target.closest ? target.closest("[data-stock-mode]") : null;
        const questionButton = target && target.closest ? target.closest("[data-stock-question]") : null;
        const actionButton = target && target.closest ? target.closest("[data-stock-action]") : null;
        const almoxDashboardPeriodButton = target && target.closest ? target.closest("[data-almox-dashboard-period]") : null;
        const almoxDashboardClick = target && target.closest ? target.closest("[data-almox-dashboard-action]") : null;

        if (modeButton) {
          event.preventDefault();
          stockIaCurrentMode = modeButton.dataset.stockMode === "almoxarifado" ? "almoxarifado" : "obra";
          saveStockIaMode_(stockIaCurrentMode);
          renderStockIaPanel_(getUserDailyLogs_());
          return;
        }

        if (periodButton) {
          event.preventDefault();
          stockIaCurrentPeriod = periodButton.dataset.stockPeriod || "30d";
          renderStockIaPanel_(getUserDailyLogs_());
          return;
        }

        if (questionButton) {
          event.preventDefault();
          handleStockIaQuestion_(questionButton.dataset.stockQuestion || "");
          return;
        }

        if (almoxDashboardPeriodButton) {
          event.preventDefault();
          handleAlmoxDashboardPeriodChange_(almoxDashboardPeriodButton.dataset.almoxDashboardPeriod || "30d");
          return;
        }

        if (almoxDashboardClick) {
          event.preventDefault();
          handleAlmoxDashboardCardClick_(almoxDashboardClick);
          return;
        }

        if (!actionButton) {
          return;
        }

        event.preventDefault();
        handleStockIaAction_(actionButton);
      });
    }

    if (stockIaQuestionForm) {
      stockIaQuestionForm.addEventListener("submit", function (event) {
        event.preventDefault();
        handleStockIaQuestion_(stockIaQuestionInput ? stockIaQuestionInput.value : "");
      });
    }

    Array.from(document.querySelectorAll("[data-almox-elo-form]")).forEach(function (eloForm) {
      eloForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const formData = new FormData(eloForm);
        const question = clean(formData.get("almoxEloQuestion"));
        if (!question) {
          showAlmoxToast_("Digite uma pergunta para o Elo.", "info");
          return;
        }
        if (askEloQuestion_(question)) {
          eloForm.reset();
          showAlmoxToast_("Pergunta enviada ao Elo Assistente.", "success");
          return;
        }
        showAlmoxToast_("Elo ainda nao carregou nesta tela. Use o botao flutuante do Elo para perguntar.", "info");
      });
    });

    Array.from(document.querySelectorAll("[data-stock-question]")).forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        handleStockIaQuestion_(button.dataset.stockQuestion || button.textContent || "");
      });
    });

    if (stockIaModal) {
      stockIaModal.addEventListener("click", function (event) {
        const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;

        if (target && target.closest && target.closest("[data-stock-modal-close]")) {
          event.preventDefault();
          closeStockIaModal_();
        }
      });

      stockIaModal.addEventListener("submit", handleStockIaFormSubmit_);
    }

    document.addEventListener("click", function (event) {
      const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
      const actionButton = target && target.closest ? target.closest("[data-almox-action]") : null;
      const flowAction = target && target.closest ? target.closest("[data-almox-flow-action]") : null;
      const demoRole = target && target.closest ? target.closest("[data-stock-demo-role]") : null;
      const demoAction = target && target.closest ? target.closest("[data-stock-demo-action]") : null;
      const approvalAction = target && target.closest ? target.closest("[data-stock-approval-action]") : null;
      const environmentCreate = target && target.closest ? target.closest("[data-almox-environment-create]") : null;
      const almoxEloAction = target && target.closest ? target.closest("[data-almox-elo-action]") : null;
      const summaryClose = target && target.closest ? target.closest("[data-almox-summary-close]") : null;
      const summaryItem = target && target.closest ? target.closest("[data-almox-summary-item]") : null;
      const summaryAction = target && target.closest ? target.closest("[data-almox-summary-action]") : null;

      if (almoxEloAction) {
        event.preventDefault();
        handleAlmoxEloAction_(almoxEloAction.dataset.almoxEloAction || "risk");
        return;
      }

      if (environmentCreate) {
        event.preventDefault();
        renderStockEnvironmentForm_();
        scrollToAlmoxSection_("almoxEnvironmentHeader");
        return;
      }

      if (approvalAction) {
        event.preventDefault();
        handleStockApprovalAction_(
          approvalAction.dataset.stockApprovalId || "",
          approvalAction.dataset.stockApprovalAction || ""
        );
        return;
      }

      if (demoRole) {
        event.preventDefault();
        setStockDemoRole_(demoRole.dataset.stockDemoRole || "gestor");
        return;
      }

      if (demoAction) {
        event.preventDefault();
        handleStockDemoAction_(demoAction.dataset.stockDemoAction || "");
        return;
      }

      if (flowAction) {
        event.preventDefault();
        handleAlmoxFlowAction_(flowAction.dataset.almoxFlowAction || "");
        return;
      }

      if (summaryClose) {
        event.preventDefault();
        closeAlmoxItemSummaryModal_();
        return;
      }

      if (summaryAction) {
        event.preventDefault();
        closeAlmoxItemSummaryModal_();
        openAlmoxModal_(summaryAction.dataset.almoxSummaryAction || "entry", {
          itemId: summaryAction.dataset.almoxItemId || ""
        });
        return;
      }

      if (summaryItem) {
        event.preventDefault();
        openAlmoxItemSummary_(summaryItem.dataset.almoxItemId || "");
        return;
      }

      if (!actionButton) {
        return;
      }

      event.preventDefault();
      openAlmoxModal_(actionButton.dataset.almoxAction || "item", {
        itemId: actionButton.dataset.almoxItemId || ""
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeAlmoxItemSummaryModal_();
      }
    });

    if (almoxModal) {
      almoxModal.addEventListener("click", function (event) {
        const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
        const submitButton = target && target.closest ? target.closest("[data-almox-modal-submit]") : null;

        if (submitButton) {
          const modalForm = submitButton.form || submitButton.closest("form");
          event.preventDefault();
          if (modalForm && (!modalForm.reportValidity || modalForm.reportValidity())) {
            submitAlmoxModalForm_(modalForm);
          }
          return;
        }

        if (target && target.closest && target.closest("[data-almox-modal-close]")) {
          event.preventDefault();
          closeAlmoxModal_();
        }
      });

      almoxModal.addEventListener("submit", handleAlmoxModalSubmit_);
    }

    if (almoxSearchInput) {
      almoxSearchInput.addEventListener("input", function () {
        almoxSearchTerm = clean(almoxSearchInput.value);
        renderAlmoxarifadoPanel_();
      });
    }

    if (almoxItemForm) {
      almoxItemForm.addEventListener("submit", handleAlmoxItemSubmit_);
    }

    if (almoxEntryForm) {
      almoxEntryForm.addEventListener("submit", handleAlmoxEntrySubmit_);
    }

    if (almoxExitForm) {
      almoxExitForm.addEventListener("submit", handleAlmoxExitSubmit_);
    }

    if (almoxSummaryButton) {
      almoxSummaryButton.addEventListener("click", function () {
        handleGenerateAlmoxSummary_();
      });
    }

    if (almoxAuditButton) {
      almoxAuditButton.addEventListener("click", function () {
        handleGenerateAlmoxAudit_();
      });
    }

    if (almoxViewPanelButton) {
      almoxViewPanelButton.addEventListener("click", function () {
        handleViewAlmoxManagerPanel_();
      });
    }

    if (almoxManagerAuditButton) {
      almoxManagerAuditButton.addEventListener("click", function () {
        handleGenerateAlmoxAudit_();
      });
    }

    if (almoxEmailButton) {
      almoxEmailButton.addEventListener("click", function () {
        if (almoxEmailPanel) {
          almoxEmailPanel.classList.toggle("is-hidden");
        }
        if (almoxEmailInput && almoxEmailPanel && !almoxEmailPanel.classList.contains("is-hidden")) {
          almoxEmailInput.focus();
        }
      });
    }

    if (almoxPrepareEmailButton) {
      almoxPrepareEmailButton.addEventListener("click", function () {
        handleSendAlmoxEmail_();
      });
    }

    if (almoxDownloadPdfButton) {
      almoxDownloadPdfButton.addEventListener("click", function () {
        handleDownloadAlmoxPdf_();
      });
    }

    if (almoxMuteAlertsButton) {
      almoxMuteAlertsButton.addEventListener("click", function () {
        handleToggleAlmoxAlerts_();
      });
    }

    if (almoxParseNoteButton) {
      almoxParseNoteButton.addEventListener("click", function () {
        handleParseAlmoxNoteText_();
      });
    }

    if (almoxClearNoteButton) {
      almoxClearNoteButton.addEventListener("click", function () {
        handleClearAlmoxNoteFile_();
      });
    }

    if (almoxChooseNoteFileButton) {
      almoxChooseNoteFileButton.addEventListener("click", function () {
        if (almoxNoteFileInput) {
          almoxNoteFileInput.click();
        }
      });
    }

    if (almoxImportXmlButton) {
      almoxImportXmlButton.addEventListener("click", function () {
        if (!almoxXmlNoteFileInput) {
          return;
        }

        if (almoxXmlNoteFileInput.files && almoxXmlNoteFileInput.files[0]) {
          handleImportAlmoxXmlNote_(almoxXmlNoteFileInput.files[0]);
          return;
        }

        almoxXmlNoteFileInput.click();
      });
    }

    if (almoxAddNoteItemsButton) {
      almoxAddNoteItemsButton.addEventListener("click", function () {
        handleAddAlmoxNoteItems_();
      });
    }

    if (almoxValidateNfeKeyButton) {
      almoxValidateNfeKeyButton.addEventListener("click", function () {
        handleValidateAlmoxNfeKey_();
      });
    }

    if (almoxNoteFileInput) {
      almoxNoteFileInput.addEventListener("change", function () {
        handleAlmoxNoteFileChange_();
      });
    }

    if (almoxXmlNoteFileInput) {
      almoxXmlNoteFileInput.addEventListener("change", function () {
        const file = almoxXmlNoteFileInput.files && almoxXmlNoteFileInput.files[0];
        if (file) {
          handleImportAlmoxXmlNote_(file);
        }
      });
    }

    if (almoxNoteRows) {
      almoxNoteRows.addEventListener("click", function (event) {
        const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
        const removeButton = target && target.closest ? target.closest("[data-almox-note-remove]") : null;

        if (!removeButton) {
          return;
        }

        event.preventDefault();
        removeAlmoxParsedNoteItem_(removeButton.dataset.almoxNoteRemove);
      });
    }

    if (almoxFiscalOcrReview) {
      almoxFiscalOcrReview.addEventListener("click", function (event) {
        const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
        const copyButton = target && target.closest ? target.closest("[data-fiscal-review-copy]") : null;
        const manualButton = target && target.closest ? target.closest("[data-fiscal-review-manual]") : null;
        const clearButton = target && target.closest ? target.closest("[data-fiscal-review-clear]") : null;
        const reprocessButton = target && target.closest ? target.closest("[data-fiscal-review-reprocess]") : null;

        if (copyButton) {
          event.preventDefault();
          handleCopyFiscalPendingLines_();
          return;
        }

        if (manualButton) {
          event.preventDefault();
          handleAddFiscalManualItem_();
          return;
        }

        if (clearButton) {
          event.preventDefault();
          handleClearAlmoxNote_();
          return;
        }

        if (reprocessButton) {
          event.preventDefault();
          handleParseAlmoxNoteText_();
        }
      });
    }

    bindAlmoxEntryCardsScroll_();
    bindAlmoxItemsToggle_();
    bindAlmoxHistoryControls_();

    window.addEventListener("hashchange", function () {
      if (currentUser && hasLocalAccessSession_() && window.location.hash.indexOf("#app/") === 0) {
        showDashboardPanel_(getRouteFromHash_());
        return;
      }

      if (isRestrictedRouteHash_() && !hasLocalAccessSession_()) {
        const accessMessage = getRestrictedAccessMessage_();
        setCloudStatus_(accessMessage, "info");
        setLoginAccessStatus_(accessMessage, "info");
        showLoginPanel_();
      }
    });

    if (clientForm) {
      clientForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const formData = new FormData(clientForm);
        const client = {
          id: createId_("cli"),
          userId: currentUser.id,
          name: clean(formData.get("clientName")),
          document: clean(formData.get("clientDocument")),
          phone: clean(formData.get("clientPhone")),
          email: clean(formData.get("clientEmail")),
          notes: clean(formData.get("clientNotes")),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (!client.name) {
          return;
        }

        if (!canCreateByBilling_("clients")) {
          return;
        }

        appState.clients.push(client);
        setLastOpened_("clientes", client.id, "", "");
        saveAppState_();
        clientForm.reset();
        renderSaasState_();
        showDashboardPanel_("clientes");
      });
    }

    if (workForm) {
      workForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const formData = new FormData(workForm);
        const clientId = clean(formData.get("workClientId"));
        const work = {
          id: createId_("obr"),
          userId: currentUser.id,
          clientId: clientId,
          name: clean(formData.get("workName")),
          address: clean(formData.get("workAddress")),
          type: clean(formData.get("workType")),
          status: clean(formData.get("workStatus")) || "Em andamento",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (!work.clientId || !work.name || !work.address || !work.type) {
          return;
        }

        if (!canCreateByBilling_("works")) {
          return;
        }

        appState.works.push(work);
        setLastOpened_("obras", work.clientId, work.id, "");
        saveAppState_();
        workForm.reset();
        renderSaasState_();
        showDashboardPanel_("obras");
      });
    }

    if (reportClientSelect) {
      reportClientSelect.addEventListener("change", function () {
        setLastOpened_("relatorios", reportClientSelect.value, "", "");
        scheduleLocalDataSave_();
        renderReportWorkOptions_(reportClientSelect.value);
      });
    }

    if (workClientSelect) {
      workClientSelect.addEventListener("change", function () {
        setLastOpened_("obras", workClientSelect.value, "", "");
        scheduleLocalDataSave_();
      });
    }

    if (reportWorkSelect) {
      reportWorkSelect.addEventListener("change", function () {
        setLastOpened_("relatorios", reportClientSelect ? reportClientSelect.value : "", reportWorkSelect.value, "");
        scheduleLocalDataSave_();
      });
    }

    if (reportCreateForm) {
      reportCreateForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const formData = new FormData(reportCreateForm);
        const workId = clean(formData.get("reportWorkId"));
        const work = findWork_(workId);
        const title = clean(formData.get("reportTitle")) || "Relatório de Fiscalização";

        if (!work) {
          return;
        }

        if (!canCreateByBilling_("reports")) {
          return;
        }

        const report = createReport_(work, title);
        appState.reports.push(report);
        setLastOpened_("editor", report.clientId, report.workId, report.id);
        saveAppState_();
        reportCreateForm.reset();
        renderSaasState_();
        openReportEditor_(report.id).catch(function (error) {
          console.error(error);
          setCloudStatus_("Não foi possível abrir o relatório.", "error");
        });
      });
    }

    if (saveReportButton) {
      saveReportButton.addEventListener("click", function () {
        saveDraft_().then(function () {
          setLastOpened_("editor");
          setDraftStatus_("Relatório salvo no histórico da obra.", "success");
        });
      });
    }

    if (backToDashboardButton) {
      backToDashboardButton.addEventListener("click", function () {
        saveDraft_().finally(function () {
          setLastOpened_("relatorios");
          saveLocalData({ syncCloud: true });
          showDashboardPanel_("relatorios");
        });
      });
    }
  }

  function handleHomeAction_(action) {
    if (!action) {
      return;
    }

    if (action === "pdf-info") {
      scrollToHomeSection_("landing-steps-title");
      setHomeActionStatus_("Veja o fluxo do campo ao PDF profissional.");
      return;
    }

    if (action === "elo-auditoria") {
      askEloFromHome_("Como funciona a auditoria de consumo?");
      return;
    }

    if (action === "elo-ia") {
      askEloFromHome_("Como funciona a IA técnica?");
      return;
    }

    if (action === "elo-nuvem") {
      askEloFromHome_("Como funciona a sincronização em nuvem?");
      return;
    }

    if (action === "elo-capabilities") {
      askEloFromHome_("O que você consegue fazer?");
      return;
    }

    if (action === "piloto" || action === "whatsapp") {
      openExampleWorkWhatsapp_();
      setHomeActionStatus_("Mensagem preparada para falar sobre o piloto do ObraReport.");
      return;
    }

    if (!currentUser || !hasLocalAccessSession_()) {
      pendingHomeAction = action;
      setHomeActionStatus_("Faça login para abrir essa ação diretamente no sistema.");
      showLoginPanel_();
      return;
    }

    runHomeAction_(action);
  }

  function runPendingHomeAction_() {
    if (!pendingHomeAction || !currentUser) {
      return;
    }

    const action = pendingHomeAction;
    pendingHomeAction = "";
    window.setTimeout(function () {
      runHomeAction_(action);
    }, 120);
  }

  function runHomeAction_(action) {
    if (action === "rdo") {
      startQuickDailyLog_();
      return;
    }

    if (action === "relatorio") {
      startQuickQualityReport_();
      return;
    }

    if (action === "materiais") {
      startQuickMaterials_();
      return;
    }

    if (action === "obra-exemplo") {
      createExampleWork_();
      return;
    }

    if (action === "stock-ia") {
      showDashboardPanel_("stock-ia");
      return;
    }

    showDashboardPanel_("dashboard");
  }

  function setHomeActionStatus_(message) {
    if (homeActionStatus) {
      homeActionStatus.textContent = message || "";
    }
  }

  function scrollToHomeSection_(id) {
    const target = document.getElementById(id);
    if (!target || !target.scrollIntoView) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function askEloFromHome_(question) {
    const cleanQuestion = clean(question);
    const sent = askEloQuestion_(cleanQuestion);
    if (!sent) {
      setHomeActionStatus_("O Elo será aberto dentro do sistema. Acesse o ObraReport para perguntar: " + cleanQuestion);
      return;
    }
    setHomeActionStatus_("Pergunta enviada ao Elo Assistente.");
  }

  function askEloQuestion_(question) {
    const cleanQuestion = clean(question);
    const floatButton = document.querySelector(".elo-float-button");
    const panel = document.querySelector(".elo-panel");
    const input = document.querySelector(".elo-input");
    const sendButton = document.querySelector(".elo-send-button");

    if (!cleanQuestion || !floatButton || !input || !sendButton) {
      return false;
    }

    if (panel && panel.classList.contains("is-hidden")) {
      floatButton.click();
    }

    input.value = cleanQuestion;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    sendButton.click();
    return true;
  }

  function initializeHomeQueryActions_() {
    let params;

    try {
      params = new URLSearchParams(window.location.search || "");
    } catch (error) {
      return;
    }

    if (params.get("elo") === "capabilities") {
      window.setTimeout(function () {
        askEloFromHome_("O que você consegue fazer?");
      }, 700);
    }
  }

  async function handleDashboardAction_(action) {
    if (action === "clientes") {
      setLastOpened_("clientes");
      scheduleLocalDataSave_();
      showDashboardPanel_("clientes");
      return;
    }

    if (action === "obras") {
      setLastOpened_("obras");
      scheduleLocalDataSave_();
      showDashboardPanel_("obras");
      return;
    }

    if (action === "relatorios" || action === "historico") {
      setLastOpened_("relatorios");
      scheduleLocalDataSave_();
      showDashboardPanel_("relatorios");
      return;
    }

    if (action === "exportar-pdf") {
      const reports = getUserReports_();
      const selectedReport = findReport_(activeReportId) || reports[0];

      if (!selectedReport) {
        setLastOpened_("relatorios");
        scheduleLocalDataSave_();
        showDashboardPanel_("relatorios");
        setCloudStatus_("Crie um relatório antes de exportar PDF.", "info");
        return;
      }

      try {
        await openReportEditor_(selectedReport.id);
        goToStep_("gerar", false);
        setGenerationStatus_("Revise o relatório e clique em Gerar relatório para exportar o PDF.");
      } catch (error) {
        console.error(error);
        setCloudStatus_("Não foi possível abrir o relatório para exportar PDF.", "error");
      }
      return;
    }

    if (action === "quick-rdo") {
      startQuickDailyLog_();
      return;
    }

    if (action === "quick-report") {
      startQuickQualityReport_();
      return;
    }

    if (action === "obra-exemplo") {
      createExampleWork_();
      return;
    }

    if (action === "obra-exemplo-pdf") {
      openExampleWorkPdf_();
      return;
    }

    if (action === "obra-exemplo-whatsapp") {
      openExampleWorkWhatsapp_();
    }
  }

  function startQuickDailyLog_() {
    const works = getUserWorks_();
    const firstWork = works[0];

    setLastOpened_("diario", firstWork ? firstWork.clientId : "", firstWork ? firstWork.id : "", "");
    scheduleLocalDataSave_();
    showDashboardPanel_("diario");
    resetDailyLogForm_();

    if (firstWork && dailyLogWorkSelect) {
      dailyLogWorkSelect.value = firstWork.id;
    }

    const identification = document.getElementById("rdo-identificacao");
    if (identification) {
      identification.open = true;
    }

    if (!works.length) {
      setDailyLogStatus_("Crie uma obra rápida para vincular este RDO.", "info");
      focusElementSoon_(dailyLogWorkSelect);
      return;
    }

    setDailyLogStatus_("Novo Diário de Obra pronto. Comece confirmando a obra, a data e o responsável.", "info");
    focusElementSoon_(dailyLogWorkSelect || (dailyLogForm && dailyLogForm.elements.date));
  }

  function startQuickQualityReport_() {
    const works = getUserWorks_();
    const firstWork = works[0];

    setLastOpened_("relatorios", firstWork ? firstWork.clientId : "", firstWork ? firstWork.id : "", "");
    scheduleLocalDataSave_();
    showDashboardPanel_("relatorios");

    if (!works.length) {
      setCloudStatus_("Crie uma obra rápida para vincular este relatório.", "info");
      focusElementSoon_(reportClientSelect);
      return;
    }

    if (reportClientSelect) {
      reportClientSelect.value = firstWork.clientId;
      renderReportWorkOptions_(firstWork.clientId);
    }

    if (reportWorkSelect) {
      reportWorkSelect.value = firstWork.id;
    }

    if (reportCreateForm && reportCreateForm.elements.reportTitle && !reportCreateForm.elements.reportTitle.value) {
      reportCreateForm.elements.reportTitle.value = "Relatório de Qualidade - " + firstWork.name;
    }

    setCloudStatus_("Novo relatório preparado. Confirme obra e nome para criar e abrir o preenchimento.", "info");
    focusElementSoon_(reportCreateForm && reportCreateForm.elements.reportTitle);
  }

  function startQuickMaterials_() {
    const works = getUserWorks_();
    const exampleWork = getExampleWork_();
    const selectedWork = exampleWork || works[0];

    setLastOpened_("diario", selectedWork ? selectedWork.clientId : "", selectedWork ? selectedWork.id : "", "");
    scheduleLocalDataSave_();
    showDashboardPanel_("diario");
    resetDailyLogForm_();

    if (selectedWork && dailyLogWorkSelect) {
      dailyLogWorkSelect.value = selectedWork.id;
    }

    const materialsSection = document.getElementById("rdo-materiais");
    const materialsForm = document.getElementById("diary-materials");
    if (materialsSection) {
      materialsSection.open = true;
    }

    if (!works.length) {
      setDailyLogStatus_("Carregue a Obra Exemplo para testar materiais.", "info");
      focusElementSoon_(dailyLogWorkSelect);
      return;
    }

    setDailyLogStatus_("Lançamento de materiais pronto. Informe material, quantidade, unidade e valor se desejar.", "info");
    window.setTimeout(function () {
      if (materialsForm && materialsForm.scrollIntoView) {
        materialsForm.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);
    focusElementSoon_(dailyLogForm && dailyLogForm.elements.materialName);
  }

  function focusElementSoon_(element) {
    if (!element || !element.focus) {
      return;
    }

    window.setTimeout(function () {
      element.focus();
    }, 80);
  }

  function getExampleWork_() {
    if (!currentUser) {
      return null;
    }

    return appState.works.find(function (work) {
      return work.userId === currentUser.id && work.demoOnly && work.name === "Obra Exemplo - Residência Modelo";
    }) || null;
  }

  function getExampleDailyLog_() {
    const exampleWork = getExampleWork_();
    if (!exampleWork) {
      return null;
    }

    return (appState.dailyLogs || []).find(function (logItem) {
      return logItem.userId === currentUser.id && logItem.demoOnly && logItem.workId === exampleWork.id;
    }) || null;
  }

  function createExampleWork_() {
    if (!currentUser) {
      return;
    }

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const existingWork = getExampleWork_();

    if (existingWork) {
      setLastOpened_("diario", existingWork.clientId, existingWork.id, "");
      renderSaasState_();
      showDashboardPanel_("diario");
      setCloudStatus_("Obra Exemplo já carregada. Ela está marcada como demonstração.", "success");
      return;
    }

    const clientId = createId_("cli_demo");
    const workId = createId_("obr_demo");
    const reportId = createId_("rep_demo");
    const dailyLogId = createId_("dia_demo");

    appState.clients.push({
      id: clientId,
      userId: currentUser.id,
      name: "Cliente Exemplo (demonstração)",
      document: "",
      phone: "",
      email: "",
      notes: "Registro demonstrativo criado para apresentação. Não misturar com dados reais.",
      demoOnly: true,
      createdAt: now,
      updatedAt: now
    });

    appState.works.push({
      id: workId,
      userId: currentUser.id,
      clientId: clientId,
      name: "Obra Exemplo - Residência Modelo",
      address: "Endereço demonstrativo",
      type: "Residencial",
      status: "Em andamento",
      notes: "Obra de demonstração para testar RDO, materiais e PDF sem usar dados reais.",
      demoOnly: true,
      createdAt: now,
      updatedAt: now
    });

    appState.reports.push({
      id: reportId,
      userId: currentUser.id,
      clientId: clientId,
      workId: workId,
      title: "Relatório Exemplo - Vistoria Inicial",
      status: "Demonstração",
      pdfUrl: "",
      demoOnly: true,
      createdAt: now,
      updatedAt: now
    });

    appState.dailyLogs.push({
      id: dailyLogId,
      userId: currentUser.id,
      workId: workId,
      date: today,
      responsible: currentUser.name || "Responsável técnico",
      weather: "Sol",
      impact: "Sem impacto",
      impactNote: "Condições adequadas para execução dos serviços previstos.",
      startTime: "07:30",
      endTime: "17:00",
      teamPresent: "Pedreiros, serventes e encarregado",
      employeeCount: "6",
      teamNotes: "Equipe completa e orientada no início das atividades.",
      services: "Execução de alvenaria, chapisco em área molhada e conferência de materiais.",
      progress: "42",
      interferences: "Sem interferências críticas registradas.",
      visits: "Visita técnica de acompanhamento no período da manhã.",
      productions: [
        { id: createId_("prd_demo"), service: "Alvenaria", quantity: 18, unit: "m²", note: "Paredes internas do pavimento térreo." },
        { id: createId_("prd_demo"), service: "Chapisco", quantity: 12, unit: "m²", note: "Área molhada preparada para revestimento." }
      ],
      materials: [
        { id: createId_("mat_demo"), name: "Bloco cerâmico", quantity: 260, unit: "un", unitValue: 1.4, totalValue: 364, note: "Consumo demonstrativo do dia." },
        { id: createId_("mat_demo"), name: "Cimento", quantity: 5, unit: "saco", unitValue: 38, totalValue: 190, note: "Uso em argamassa e chapisco." }
      ],
      tools: [
        { id: createId_("too_demo"), name: "Betoneira", status: "Em uso", note: "Operação normal." },
        { id: createId_("too_demo"), name: "Andaime", status: "Disponível", note: "Sem restrições observadas." }
      ],
      safety: {
        occurrence: "Nenhuma ocorrência",
        description: "Equipe orientada sobre organização da frente de serviço e uso de EPIs.",
        actions: "Manter sinalização e limpeza da área.",
        responsible: currentUser.name || "Responsável técnico"
      },
      occurrences: "Registro demonstrativo sem ocorrência crítica.",
      stoppedEquipment: "Nenhum equipamento parado.",
      generalNotes: "Dados de exemplo para apresentação comercial e testes internos.",
      photos: [],
      summary: "RDO demonstrativo com produção executada, materiais consumidos e auditoria simples de consumo.",
      demoOnly: true,
      createdAt: now,
      updatedAt: now
    });

    setLastOpened_("diario", clientId, workId, "");
    saveLocalData({ syncCloud: false });
    renderSaasState_();
    showDashboardPanel_("diario");
    setCloudStatus_("Obra Exemplo carregada como demonstração. Não use como dado real.", "success");
  }

  function openExampleWorkPdf_() {
    const exampleLog = getExampleDailyLog_();

    if (!exampleLog) {
      setCloudStatus_("Carregue a Obra Exemplo antes de gerar o PDF.", "info");
      return;
    }

    try {
      openDailyLogPdf_(exampleLog);
      if (examplePdfStatus) {
        examplePdfStatus.classList.remove("is-hidden");
      }
      setCloudStatus_("Pronto. Este é o padrão de documento que sua empresa pode entregar.", "success");
    } catch (error) {
      console.error(error);
      setCloudStatus_(error.message || "Não foi possível gerar o PDF da Obra Exemplo.", "error");
    }
  }

  function openExampleWorkWhatsapp_() {
    const message = [
      "*OBRAREPORT — IMPLANTAÇÃO ASSISTIDA*",
      "",
      "Olá. Acabei de visualizar o PDF da Obra Exemplo do ObraReport e gostaria de implantar o sistema na minha empresa.",
      "",
      "━━━━━━━━━━━━━━",
      "",
      "*Interesse*",
      "• Quero usar o ObraReport para organizar relatórios, RDOs, materiais e documentos técnicos da obra.",
      "",
      "*Meus dados*",
      "Nome:",
      "Empresa:",
      "Cidade:",
      "Quantidade de obras:",
      "",
      "Mensagem enviada por *ObraReport*."
    ].join("\n");
    window.open("https://wa.me/?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  }

  function loadLocalData() {
    return loadAppState_();
  }

  function loadAppState_() {
    try {
      const raw = window.localStorage.getItem(saasStoreKey);
      const parsed = raw ? JSON.parse(raw) : null;

      if (parsed && parsed.version === 1) {
        parsed.users = Array.isArray(parsed.users) ? parsed.users : [];
        parsed.clients = Array.isArray(parsed.clients) ? parsed.clients : [];
        parsed.works = Array.isArray(parsed.works) ? parsed.works : [];
        parsed.reports = Array.isArray(parsed.reports) ? parsed.reports : [];
        parsed.dailyLogs = Array.isArray(parsed.dailyLogs) ? parsed.dailyLogs : [];
        parsed.compositions = Array.isArray(parsed.compositions) ? parsed.compositions : [];
        return ensureLocalState_(parsed);
      }
    } catch (error) {
      console.warn("Não foi possível ler os dados locais do SaaS.", error);
    }

    return ensureLocalState_({
      version: 1,
      session: null,
      users: [],
      clients: [],
      works: [],
      reports: [],
      dailyLogs: [],
      compositions: [],
      billing: {}
    });
  }

  function ensureLocalState_(state) {
    state.users = Array.isArray(state.users) ? state.users : [];
    state.clients = Array.isArray(state.clients) ? state.clients : [];
    state.works = Array.isArray(state.works) ? state.works : [];
    state.reports = Array.isArray(state.reports) ? state.reports : [];
    state.dailyLogs = Array.isArray(state.dailyLogs) ? state.dailyLogs : [];
    state.compositions = ensureCompositionLibrary_(state.compositions);
    state.local = state.local || {};
    state.local.lastRoute = state.local.lastRoute || "dashboard";
    state.local.lastView = state.local.lastView || state.local.lastRoute;
    state.local.lastClientId = state.local.lastClientId || "";
    state.local.lastWorkId = state.local.lastWorkId || "";
    state.local.lastReportId = state.local.lastReportId || "";
    state.local.updatedAt = state.local.updatedAt || new Date().toISOString();

    if (window.ObraReportBillingDemo) {
      window.ObraReportBillingDemo.ensureBillingState(
        state,
        window.ObraReportPlans ? window.ObraReportPlans.defaultPlanId : "gratuito"
      );
    } else {
      state.billing = state.billing || {};
      state.billing.planId = state.billing.planId || "gratuito";
      state.billing.usageEvents = Array.isArray(state.billing.usageEvents) ? state.billing.usageEvents : [];
      state.billing.updatedAt = state.billing.updatedAt || new Date().toISOString();
    }

    return state;
  }

  function loginLocalFallback_(name, email) {
    let user = appState.users.find(function (item) {
      return item.email === email;
    });

    if (!user) {
      user = {
        id: createId_("usr"),
        name: name,
        email: email,
        role: "admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      appState.users.push(user);
    } else {
      user.name = name || user.name;
      user.updatedAt = new Date().toISOString();
    }

    appState.session = {
      userId: user.id,
      localOnly: true,
      signedInAt: new Date().toISOString()
    };
    grantLocalAccessSession_();
    saveLocalData({ syncCloud: false });
    currentUser = user;
    loginForm.reset();
    renderSaasState_();
    showDashboardPanel_(getRouteFromHash_());
  }

  function saveLocalData(options) {
    const settings = options || {};

    try {
      ensureLocalState_(appState);
      appState.local.updatedAt = new Date().toISOString();
      window.localStorage.setItem(saasStoreKey, JSON.stringify(appState));
      setLocalStatus_("Salvo localmente", "success");
    } catch (error) {
      console.error("Não foi possível salvar a estrutura SaaS local.", error);
      setLocalStatus_("Alterações não salvas", "error");
      throw new Error("Não foi possível salvar os dados locais do SaaS neste navegador.");
    }

    if (settings.syncCloud !== false) {
      scheduleCloudSync_(settings.fullDraft);
    }
  }

  function saveAppState_() {
    saveLocalData({ syncCloud: true });
  }

  function scheduleLocalDataSave_(options) {
    window.clearTimeout(localSaveTimer);
    setLocalStatus_("Alterações não salvas", "info");
    localSaveTimer = window.setTimeout(function () {
      try {
        saveLocalData(options);
      } catch (error) {
        console.warn("Não foi possível salvar localmente.", error);
      }
    }, 600);
  }

  async function saveNow_() {
    if (activeReportId && !reportPanel.classList.contains("is-hidden")) {
      await saveDraft_();
      return;
    }

    saveLocalData({ syncCloud: true });
  }

  async function recoverDraft() {
    ensureLocalState_(appState);

    const last = appState.local;
    const hashReportId = getReportIdFromHash_();
    const hasAppRouteHash = window.location.hash.indexOf("#app/") === 0;
    const reportIdToRecover = hashReportId || (!hasAppRouteHash && last.lastView === "editor" ? last.lastReportId : "");
    const shouldRecoverEditor =
      reportIdToRecover &&
      Boolean(findReport_(reportIdToRecover));

    if (shouldRecoverEditor) {
      await openReportEditor_(reportIdToRecover);
      setLocalStatus_("Salvo localmente", "success");
      return;
    }

    const routeFromHash = getRouteFromHash_();
    const route = window.location.hash.indexOf("#app/") === 0 ? routeFromHash : last.lastRoute;
    showDashboardPanel_(route || "dashboard");
    restoreLastSelections_();
    setLocalStatus_("Salvo localmente", "success");
  }

  function restoreLastSelections_() {
    const last = appState.local || {};

    if (workClientSelect && last.lastClientId) {
      workClientSelect.value = last.lastClientId;
    }

    if (reportClientSelect && last.lastClientId) {
      reportClientSelect.value = last.lastClientId;
      renderReportWorkOptions_(last.lastClientId);
    }

    if (reportWorkSelect && last.lastWorkId) {
      reportWorkSelect.value = last.lastWorkId;
    }
  }

  function setLastOpened_(view, clientId, workId, reportId) {
    ensureLocalState_(appState);
    appState.local.lastView = view || appState.local.lastView || "dashboard";
    appState.local.lastRoute = view === "editor" ? "relatorios" : (view || appState.local.lastRoute || "dashboard");
    appState.local.lastClientId = clientId !== undefined ? clientId : appState.local.lastClientId;
    appState.local.lastWorkId = workId !== undefined ? workId : appState.local.lastWorkId;
    appState.local.lastReportId = reportId !== undefined ? reportId : appState.local.lastReportId;
    appState.local.updatedAt = new Date().toISOString();
  }

  function setLocalStatus_(message, kind) {
    [localStatus, editorLocalStatus].forEach(function (target) {
      if (!target) {
        return;
      }

      target.textContent = message;
      target.className = "local-status" + (kind ? " " + kind : "");
    });
  }

  function setLoginAccessStatus_(message, kind) {
    if (!loginAccessStatus) {
      return;
    }

    loginAccessStatus.textContent = message || "";
    loginAccessStatus.className = "auth-note login-access-status" + (kind ? " " + kind : "");
    loginAccessStatus.classList.toggle("is-hidden", !message);
  }

  function scheduleCloudSync_(fullDraft) {
    if (isApplyingCloudState || !appState.session || !appState.session.token) {
      return;
    }

    window.clearTimeout(cloudSyncTimer);
    setCloudStatus_("Salvando na nuvem...", "info");
    cloudSyncTimer = window.setTimeout(function () {
      syncCloudState_(fullDraft).catch(function (error) {
        console.warn("Não foi possível sincronizar com a nuvem.", error);
        setCloudStatus_(error.message || "Falha ao sincronizar nuvem.", "error");
      });
    }, 700);
  }

  async function syncCloudState_(fullDraft) {
    if (!appState.session || !appState.session.token) {
      return;
    }

    const state = buildCloudState_(fullDraft);
    const result = await cloudApi_("sync.save", {
      token: appState.session.token,
      state: state
    });

    await applyCloudState_(result.state, appState.session.token);
    setCloudStatus_("Sincronizado na nuvem", "success");
  }

  async function refreshCloudState_() {
    if (!appState.session || !appState.session.token) {
      return;
    }

    try {
      setCloudStatus_("Atualizando dados da nuvem...", "info");
      const result = await cloudApi_("sync.get", {
        token: appState.session.token
      });
      await applyCloudState_(result.state, appState.session.token);
      renderSaasState_();
      setCloudStatus_("Sincronizado na nuvem", "success");
    } catch (error) {
      console.warn("Não foi possível atualizar a nuvem.", error);
      setCloudStatus_(error.message || "Nuvem indisponível.", "error");
    }
  }

  function buildCloudState_(fullDraft) {
    const reports = appState.reports.map(function (report) {
      const copy = JSON.parse(JSON.stringify(report));

      if (fullDraft && activeReportId && copy.id === activeReportId) {
        copy.draft = fullDraft;
      }

      return copy;
    });

    return {
      version: 1,
      clients: appState.clients,
      works: appState.works,
      reports: reports,
      dailyLogs: getDailyLogsForCloud_(),
      compositions: getCompositionsForCloud_(),
      billing: appState.billing || {}
    };
  }

  function getDailyLogsForCloud_() {
    return (appState.dailyLogs || []).map(sanitizeDailyLogForCloud_);
  }

  function sanitizeDailyLogForCloud_(logItem) {
    const copy = JSON.parse(JSON.stringify(logItem || {}));
    copy.photos = Array.isArray(copy.photos) ? copy.photos.map(sanitizeDailyLogPhotoForCloud_) : [];
    return copy;
  }

  function sanitizeDailyLogPhotoForCloud_(photo) {
    const payload = photo && photo.payload ? photo.payload : {};
    return {
      id: photo && photo.id ? photo.id : createId_("fot"),
      caption: clean(photo && photo.caption),
      updatedAt: photo && photo.updatedAt ? photo.updatedAt : new Date().toISOString(),
      hasLocalImage: Boolean((photo && photo.previewDataUrl) || payload.base64),
      payload: {
        originalName: clean(payload.originalName),
        fileName: clean(payload.fileName),
        mimeType: clean(payload.mimeType),
        width: Number(payload.width || 0),
        height: Number(payload.height || 0)
      }
    };
  }

  function getCompositionsForCloud_() {
    return ensureCompositionLibrary_(appState.compositions).map(function (composition) {
      return normalizeComposition_(composition);
    });
  }

  async function cloudApi_(action, payload) {
    if (!config.appsScriptUrl || config.appsScriptUrl.includes("COLE_AQUI")) {
      throw new Error("Configure a URL do Apps Script para usar a nuvem.");
    }

    const response = await fetch(config.appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(Object.assign({
        app: "ObraReport",
        action: action
      }, payload || {}))
    });

    const text = await response.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error("Resposta inválida da nuvem: " + text.slice(0, 160));
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Falha na API do ObraReport.");
    }

    return result;
  }

  async function applyCloudLogin_(result) {
    if (!result || !result.user || !result.token) {
      throw new Error("Login em nuvem retornou dados incompletos.");
    }

    await applyCloudState_(result.state, result.token);
  }

  async function applyCloudState_(state, token) {
    if (!state || !Array.isArray(state.users)) {
      return;
    }

    isApplyingCloudState = true;

    try {
      const localState = {
        version: 1,
        session: {
          userId: state.users[0].id,
          token: token || (appState.session && appState.session.token) || "",
          signedInAt: new Date().toISOString(),
          syncedAt: state.syncedAt || new Date().toISOString()
        },
        users: state.users,
        clients: state.clients || [],
        works: state.works || [],
        reports: [],
        dailyLogs: mergeDailyLogsFromCloud_(appState.dailyLogs, state.dailyLogs || []),
        compositions: mergeCompositionsFromCloud_(appState.compositions, state.compositions || []),
        billing: state.billing || appState.billing || {},
        local: Object.assign({}, appState.local || {}, {
          updatedAt: new Date().toISOString()
        })
      };

      for (let index = 0; index < (state.reports || []).length; index += 1) {
        const report = JSON.parse(JSON.stringify(state.reports[index]));

        if (report.draft && report.draft.images && Object.keys(report.draft.images).length) {
          await putDraftRecordById_(getDraftIdForReport_(report.id), report.draft);
          report.draft = cloneDraftWithoutImages_(report.draft);
        }

        localState.reports.push(report);
      }

      appState = localState;
      currentUser = getCurrentUser_();
      window.localStorage.setItem(saasStoreKey, JSON.stringify(appState));
    } finally {
      isApplyingCloudState = false;
    }
  }

  function mergeDailyLogsFromCloud_(localItems, cloudItems) {
    return mergeItemsByUpdatedAt_(localItems, cloudItems, function (localItem, cloudItem) {
      return mergeDailyLogPhotoPayloads_(localItem, cloudItem);
    });
  }

  function mergeCompositionsFromCloud_(localItems, cloudItems) {
    return ensureCompositionLibrary_(mergeItemsByUpdatedAt_(localItems, cloudItems));
  }

  function mergeItemsByUpdatedAt_(localItems, cloudItems, mergeSelected) {
    const byId = {};

    (Array.isArray(localItems) ? localItems : []).forEach(function (item) {
      if (item && item.id) {
        byId[item.id] = JSON.parse(JSON.stringify(item));
      }
    });

    (Array.isArray(cloudItems) ? cloudItems : []).forEach(function (item) {
      if (!item || !item.id) {
        return;
      }

      const cloudCopy = JSON.parse(JSON.stringify(item));
      const localCopy = byId[item.id];
      const selected = !localCopy || isCloudItemNewer_(cloudCopy, localCopy)
        ? cloudCopy
        : localCopy;

      byId[item.id] = mergeSelected ? mergeSelected(localCopy, selected) : selected;
    });

    return Object.keys(byId).map(function (id) {
      return byId[id];
    }).sort(function (a, b) {
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
    });
  }

  function isCloudItemNewer_(cloudItem, localItem) {
    return getItemTime_(cloudItem) > getItemTime_(localItem);
  }

  function getItemTime_(item) {
    const value = item && (item.updatedAt || item.createdAt);
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }

  function mergeDailyLogPhotoPayloads_(localLog, selectedLog) {
    const merged = JSON.parse(JSON.stringify(selectedLog || {}));
    const localPhotos = {};

    ((localLog && localLog.photos) || []).forEach(function (photo) {
      if (photo && photo.id) {
        localPhotos[photo.id] = photo;
      }
    });

    merged.photos = Array.isArray(merged.photos) ? merged.photos.map(function (photo) {
      const localPhoto = localPhotos[photo.id];

      if (
        localPhoto &&
        (!photo.previewDataUrl && localPhoto.previewDataUrl) &&
        (!photo.payload || !photo.payload.base64) &&
        localPhoto.payload &&
        localPhoto.payload.base64
      ) {
        return Object.assign({}, photo, {
          previewDataUrl: localPhoto.previewDataUrl,
          payload: Object.assign({}, photo.payload || {}, localPhoto.payload)
        });
      }

      return photo;
    }) : [];

    return merged;
  }

  function setCloudStatus_(message, kind) {
    [cloudStatus, editorCloudStatus].forEach(function (target) {
      if (!target) {
        return;
      }

      target.textContent = message;
      target.className = "cloud-status" + (kind ? " " + kind : "");
    });
  }

  function getCurrentUser_() {
    if (!appState.session || !appState.session.userId) {
      return null;
    }

    return appState.users.find(function (user) {
      return user.id === appState.session.userId;
    }) || null;
  }

  function createId_(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function getRouteFromHash_() {
    const value = String(window.location.hash || "").replace("#app/", "").split("/")[0];
    const route = getAllRoutes_().indexOf(value) >= 0 ? value : getDefaultRouteForRole_();
    return isStockAiPublicDemo_() && !isStockAiPublicRoute_(route) ? "almoxarifado" : route;
  }

  function isRestrictedRouteHash_() {
    const hash = String(window.location.hash || "");
    return hash.indexOf("#app/") === 0 || hash.indexOf("#report/") === 0;
  }

  function isLocalAccessPasswordValid_(password) {
    return clean(password).toLowerCase() === localAccessPassword.toLowerCase();
  }

  function getReportIdFromHash_() {
    const hash = String(window.location.hash || "");
    return hash.indexOf("#report/") === 0 ? hash.replace("#report/", "") : "";
  }

  function getAllRoutes_() {
    return ["dashboard", "clientes", "obras", "relatorios", "diario", "stock-ia", "almoxarifado", "planos", "administracao", "cliente", "minha-obra", "meus-relatorios", "meus-rdos", "documentos", "suporte"];
  }

  function getAdminRoutes_() {
    return ["dashboard", "clientes", "obras", "relatorios", "diario", "stock-ia", "almoxarifado", "planos", "administracao"];
  }

  function getClientRoutes_() {
    return ["cliente", "minha-obra", "meus-relatorios", "meus-rdos", "documentos", "suporte"];
  }

  function getUserRole_(user) {
    const role = String(user && user.role || "").toLowerCase();
    return role === "client" ? "client" : "admin";
  }

  function isAdminUser_() {
    return getUserRole_(currentUser) === "admin";
  }

  function getDefaultRouteForRole_() {
    return isAdminUser_() ? "dashboard" : "cliente";
  }

  function coerceRouteForRole_(route) {
    if (isStockAiPublicDemo_()) {
      return isStockAiPublicRoute_(route) ? route : "almoxarifado";
    }

    const allowedRoutes = isAdminUser_() ? getAdminRoutes_() : getClientRoutes_();
    return allowedRoutes.indexOf(route) >= 0 ? route : getDefaultRouteForRole_();
  }

  function showHomePanel_() {
    showOnlyPanel_(homePanel);
    window.location.hash = "";
  }

  function showLoginPanel_() {
    showOnlyPanel_(loginPanel);
    if (loginForm) {
      const firstField = loginForm.querySelector("input");
      if (firstField) {
        firstField.focus();
      }
    }
  }

  function showDashboardPanel_(route) {
    if (!hasLocalAccessSession_()) {
      const accessMessage = getRestrictedAccessMessage_();
      setCloudStatus_(accessMessage, "info");
      setLoginAccessStatus_(accessMessage, "info");
      showLoginPanel_();
      return;
    }

    const safeRoute = coerceRouteForRole_(route || getDefaultRouteForRole_());
    showOnlyPanel_(dashboardPanel);
    window.location.hash = "#app/" + safeRoute;
    renderRoute_(safeRoute);
    renderSaasState_();
  }

  function showOnlyPanel_(panel) {
    [homePanel, loginPanel, dashboardPanel, reportPanel].forEach(function (item) {
      if (item) {
        item.classList.toggle("is-hidden", item !== panel);
      }
    });
  }

  function renderRoute_(route) {
    const safeRoute = coerceRouteForRole_(route || getDefaultRouteForRole_());

    routePanels.forEach(function (panel) {
      panel.classList.toggle("active", panel.dataset.route === safeRoute);
    });

    routeButtons.forEach(function (button) {
      button.classList.toggle("active", button.dataset.routeTarget === safeRoute);
    });

    if (safeRoute === "almoxarifado") {
      renderAlmoxarifadoPanel_();
    }
  }

  function renderRoleNavigation_() {
    const role = getUserRole_(currentUser);

    routeButtons.forEach(function (button) {
      const navRole = button.dataset.navRole || "admin";
      button.classList.toggle("is-hidden", navRole !== role);
    });

    if (dashboardPanel) {
      dashboardPanel.dataset.userRole = role;
    }
  }

  function getUserClients_() {
    if (!currentUser) {
      return [];
    }

    if (isAdminUser_()) {
      return appState.clients.slice();
    }

    return appState.clients.filter(function (client) {
      return isClientLinkedToCurrentUser_(client);
    });
  }

  function getUserWorks_() {
    if (!currentUser) {
      return [];
    }

    if (isAdminUser_()) {
      return appState.works.slice();
    }

    const clientIds = getClientScopeIds_();
    return appState.works.filter(function (work) {
      return work.userId === currentUser.id || clientIds.indexOf(work.clientId) >= 0;
    });
  }

  function getUserReports_() {
    if (!currentUser) {
      return [];
    }

    if (isAdminUser_()) {
      return appState.reports
        .slice()
        .sort(function (a, b) {
          return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
        });
    }

    const clientIds = getClientScopeIds_();
    const workIds = getUserWorks_().map(function (work) {
      return work.id;
    });

    return appState.reports
      .filter(function (report) {
        return report.userId === currentUser.id ||
          clientIds.indexOf(report.clientId) >= 0 ||
          workIds.indexOf(report.workId) >= 0;
      })
      .sort(function (a, b) {
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }

  function getUserDailyLogs_() {
    if (!currentUser) {
      return [];
    }

    if (isAdminUser_()) {
      return (appState.dailyLogs || [])
        .slice()
        .sort(function (a, b) {
          return String(b.date || b.updatedAt || "").localeCompare(String(a.date || a.updatedAt || ""));
        });
    }

    const workIds = getUserWorks_().map(function (work) {
      return work.id;
    });

    return (appState.dailyLogs || [])
      .filter(function (logItem) {
        return logItem.userId === currentUser.id || workIds.indexOf(logItem.workId) >= 0;
      })
      .sort(function (a, b) {
        return String(b.date || b.updatedAt || "").localeCompare(String(a.date || a.updatedAt || ""));
      });
  }

  function getClientScopeIds_() {
    return (appState.clients || [])
      .filter(isClientLinkedToCurrentUser_)
      .map(function (client) {
        return client.id;
      });
  }

  function isClientLinkedToCurrentUser_(client) {
    if (!client || !currentUser) {
      return false;
    }

    const userEmail = clean(currentUser.email).toLowerCase();
    const clientEmail = clean(client.email).toLowerCase();
    return client.userId === currentUser.id || (userEmail && clientEmail && userEmail === clientEmail);
  }

  function renderSaasState_() {
    if (!currentUser) {
      return;
    }

    renderRoleNavigation_();
    const clients = getUserClients_();
    const works = getUserWorks_();
    const reports = getUserReports_();
    const dailyLogs = getUserDailyLogs_();
    const activeWorks = works.filter(function (work) {
      return String(work.status || "").toLowerCase().indexOf("andamento") >= 0;
    });
    const totalPhotos = reports.reduce(function (total, report) {
      return total + getReportPhotoCount_(report);
    }, 0);
    const exportedPdfs = reports.filter(function (report) {
      return Boolean(report.pdfUrl);
    });

    if (userBadge) {
      userBadge.textContent = currentUser.name + " · " + currentUser.email + " · " + (isAdminUser_() ? "Admin" : "Cliente");
    }

    if (clientMetric) {
      clientMetric.textContent = String(clients.length);
    }

    if (workMetric) {
      workMetric.textContent = String(activeWorks.length);
    }

    if (reportMetric) {
      reportMetric.textContent = String(reports.length);
    }

    if (photoMetric) {
      photoMetric.textContent = String(totalPhotos);
    }

    if (pdfMetric) {
      pdfMetric.textContent = String(exportedPdfs.length);
    }

    renderClientOptions_(workClientSelect, clients);
    renderClientOptions_(reportClientSelect, clients);
    renderReportWorkOptions_(reportClientSelect ? reportClientSelect.value : "");
    renderDailyLogWorkOptions_(works);
    renderClientsList_(clients);
    renderWorksList_(works);
    renderReportsList_(reportsList, reports);
    renderReportsList_(recentReportsList, reports.slice(0, 5));
    renderDailyLogModule_(dailyLogs);
    renderStockIaPanel_(dailyLogs);
    renderExampleSalesGuide_();
    renderClientPortal_(works, reports, dailyLogs, exportedPdfs);
    renderAdminOverview_();
    renderBillingState_();
    updateReportContext_();
  }

  function renderExampleSalesGuide_() {
    if (!exampleSalesGuide) {
      return;
    }

    exampleSalesGuide.classList.toggle("is-hidden", !getExampleWork_());

    if (examplePdfStatus) {
      examplePdfStatus.classList.add("is-hidden");
    }
  }

  function renderClientPortal_(works, reports, dailyLogs, exportedPdfs) {
    if (clientPortalWorkMetric) {
      clientPortalWorkMetric.textContent = String(works.length);
    }

    if (clientPortalReportMetric) {
      clientPortalReportMetric.textContent = String(reports.length);
    }

    if (clientPortalRdoMetric) {
      clientPortalRdoMetric.textContent = String(dailyLogs.length);
    }

    if (clientPortalPdfMetric) {
      clientPortalPdfMetric.textContent = String(exportedPdfs.length);
    }

    renderClientWorksList_(clientPortalWorksList, works);
    renderClientReportsList_(clientPortalReportsList, reports);
    renderClientRdosList_(clientPortalRdosList, dailyLogs);
    renderClientDocumentsList_(clientPortalDocumentsList, exportedPdfs);
    renderClientDocumentsList_(clientPortalRecentDocs, exportedPdfs.slice(0, 5));
  }

  function renderAdminOverview_() {
    if (adminUsersMetric) {
      adminUsersMetric.textContent = String((appState.users || []).length);
    }

    if (adminClientsMetric) {
      adminClientsMetric.textContent = String((appState.clients || []).length);
    }

    if (adminWorksMetric) {
      adminWorksMetric.textContent = String((appState.works || []).length);
    }

    if (adminReportsMetric) {
      adminReportsMetric.textContent = String((appState.reports || []).length);
    }

    if (adminRdosMetric) {
      adminRdosMetric.textContent = String((appState.dailyLogs || []).length);
    }
  }

  function getPlansApi_() {
    return window.ObraReportPlans || null;
  }

  function getUsageApi_() {
    return window.ObraReportUsageLimits || null;
  }

  function getBillingApi_() {
    return window.ObraReportBillingDemo || null;
  }

  function getCurrentPlan_() {
    const plans = getPlansApi_();
    const billing = getBillingApi_();
    const defaultPlanId = plans ? plans.defaultPlanId : "gratuito";
    const planId = billing ? billing.getCurrentPlanId(appState, defaultPlanId) : ((appState.billing && appState.billing.planId) || defaultPlanId);

    return plans ? plans.getPlan(planId) : {
      id: "gratuito",
      name: "Gratuito",
      priceLabel: "R$ 0/mês",
      limits: {
        clients: 2,
        works: 2,
        reportsPerMonth: 5,
        photosPerReport: 10,
        aiCallsPerMonth: 10
      },
      features: []
    };
  }

  function getCurrentUsage_() {
    const usage = getUsageApi_();

    if (!currentUser || !usage) {
      return {
        monthKey: "",
        clients: 0,
        works: 0,
        reportsThisMonth: 0,
        aiCallsThisMonth: 0
      };
    }

    return usage.getUsage(appState, currentUser.id);
  }

  function renderBillingState_() {
    if (!currentUser) {
      return;
    }

    const plan = getCurrentPlan_();
    const usage = getCurrentUsage_();

    if (currentPlanBadge) {
      currentPlanBadge.textContent = "Plano " + plan.name;
    }

    renderPlansGrid_(plan);
    renderUsageSummary_(plan, usage);
  }

  function renderPlansGrid_(currentPlan) {
    const plans = getPlansApi_();
    if (!plansGrid || !plans) {
      return;
    }

    plansGrid.innerHTML = "";

    if (billingDemoStatus) {
      billingDemoStatus.textContent = "Pagamento e ativação feitos de forma assistida nesta fase inicial.";
    }

    plans.listPlans().forEach(function (plan) {
      const card = document.createElement("article");
      card.className = "plan-card" + (plan.id === currentPlan.id ? " current" : "");

      const title = document.createElement("h4");
      title.textContent = plan.name;

      const price = document.createElement("p");
      price.className = "plan-price";
      price.textContent = plan.priceLabel;

      const features = document.createElement("ul");
      features.className = "plan-features";
      (plan.features || []).forEach(function (feature) {
        const item = document.createElement("li");
        item.textContent = feature;
        features.appendChild(item);
      });

      const button = document.createElement("button");
      button.type = "button";
      button.className = plan.id === currentPlan.id ? "secondary-action" : "next-action";
      button.textContent = plan.cta || "Falar no WhatsApp";
      button.addEventListener("click", function () {
        openPlanWhatsapp_(plan);
      });

      card.appendChild(title);
      card.appendChild(price);
      card.appendChild(features);
      card.appendChild(button);
      plansGrid.appendChild(card);
    });
  }

  function openPlanWhatsapp_(plan) {
    const planName = plan && plan.name ? plan.name : "Gratuito";
    const message = [
      "🏗️ *OBRAREPORT — CONTRATAÇÃO ASSISTIDA*",
      "",
      "Olá. Quero contratar o ObraReport no plano *" + planName + "*.",
      "",
      "━━━━━━━━━━━━━━",
      "",
      "👤 *Dados para atendimento*",
      "Nome:",
      "Empresa:",
      "Cidade:",
      "Quantidade de obras:",
      "Principal necessidade:",
      "",
      "Mensagem enviada por *ObraReport*."
    ].join("\n");
    const url = "https://wa.me/?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function renderUsageSummary_(plan, usage) {
    const plans = getPlansApi_();
    const formatLimit = plans ? plans.formatLimit : function (value) {
      return value === null ? "Ilimitado" : String(value);
    };

    if (!usageSummary || !plan.limits) {
      return;
    }

    usageSummary.innerHTML = "";
    usageSummary.appendChild(createUsageItem_("Clientes", usage.clients, formatLimit(plan.limits.clients)));
    usageSummary.appendChild(createUsageItem_("Obras", usage.works, formatLimit(plan.limits.works)));
    usageSummary.appendChild(createUsageItem_("Relatórios no mês", usage.reportsThisMonth, formatLimit(plan.limits.reportsPerMonth)));
    usageSummary.appendChild(createUsageItem_("Usos de IA no mês", usage.aiCallsThisMonth, formatLimit(plan.limits.aiCallsPerMonth)));
    usageSummary.appendChild(createUsageItem_("Fotos por relatório", imageCache.size, formatLimit(plan.limits.photosPerReport)));
  }

  function createUsageItem_(label, current, limit) {
    const item = document.createElement("div");
    item.className = "usage-item";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    const valueElement = document.createElement("strong");
    valueElement.textContent = String(current) + " / " + limit;

    item.appendChild(labelElement);
    item.appendChild(valueElement);
    return item;
  }

  function setDemoPlan_(planId) {
    const plans = getPlansApi_();
    const billing = getBillingApi_();

    if (!plans || !billing || !billing.isDemoEnabled()) {
      showBillingAlert_("A troca de plano demo só fica ativa em ambiente local de desenvolvimento.");
      return;
    }

    const plan = plans.getPlan(planId);
    billing.setPlan(appState, plan.id, plans.defaultPlanId);
    saveAppState_();
    renderSaasState_();
    showBillingAlert_("Plano demo alterado para " + plan.name + ".");
  }

  function canCreateByBilling_(type) {
    const usage = getUsageApi_();

    if (!usage || !currentUser) {
      return true;
    }

    const plan = getCurrentPlan_();
    const result = usage.checkLimit(plan, getCurrentUsage_(), type);

    if (result.ok) {
      return true;
    }

    showBillingAlert_(result.message);
    return false;
  }

  function canUseAi_() {
    return canCreateByBilling_("ai");
  }

  function registerBillingUsage_(type, meta) {
    const billing = getBillingApi_();

    if (!billing || !currentUser) {
      return;
    }

    billing.registerUsage(appState, type, currentUser.id, meta || {});
    saveLocalData({ syncCloud: true });
    renderBillingState_();
  }

  function canAddPhotoToReport_(inputName) {
    const usage = getUsageApi_();

    if (!usage) {
      return true;
    }

    const plan = getCurrentPlan_();
    const isReplacing = imageCache.has(inputName);
    const result = usage.checkPhotoLimit(plan, imageCache.size, isReplacing);

    if (result.ok) {
      return true;
    }

    showBillingAlert_(result.message);
    setDraftStatus_(result.message, "error");
    renderImageError_(inputName, result.message);
    return false;
  }

  function buildBillingExportSnapshot_() {
    const plan = getCurrentPlan_();

    return {
      planId: plan.id,
      planName: plan.name,
      pdfWatermark: Boolean(plan.pdfWatermark),
      companyLogo: Boolean(plan.companyLogo)
    };
  }

  function showBillingAlert_(message) {
    if (!billingAlert) {
      setCloudStatus_(message, "error");
      return;
    }

    billingAlert.textContent = message;
    billingAlert.classList.remove("is-hidden");
    window.clearTimeout(billingAlertTimer);
    billingAlertTimer = window.setTimeout(function () {
      billingAlert.classList.add("is-hidden");
    }, 7000);
  }

  function getReportPhotoCount_(report) {
    const imageCount = Number(report && report.imageCount);

    if (Number.isFinite(imageCount) && imageCount > 0) {
      return imageCount;
    }

    if (report && report.lastExport) {
      return Number(report.lastExport.fotosUnidade || 0) + Number(report.lastExport.inconformidades || 0);
    }

    if (report && report.summary) {
      return Number(report.summary.fotos || 0) + Number(report.summary.inconformidades || 0);
    }

    return 0;
  }

  function renderClientOptions_(select, clients) {
    if (!select) {
      return;
    }

    const previous = select.value;
    select.innerHTML = "";
    select.appendChild(createOption_("", clients.length ? "Escolher cliente" : "Cadastre um cliente primeiro"));

    clients.forEach(function (client) {
      select.appendChild(createOption_(client.id, client.name));
    });

    if (clients.some(function (client) { return client.id === previous; })) {
      select.value = previous;
    }
  }

  function renderReportWorkOptions_(clientId) {
    if (!reportWorkSelect) {
      return;
    }

    const safeClientId = clientId || (reportClientSelect && reportClientSelect.value) || "";
    const works = getUserWorks_().filter(function (work) {
      return !safeClientId || work.clientId === safeClientId;
    });

    reportWorkSelect.innerHTML = "";
    reportWorkSelect.appendChild(createOption_("", works.length ? "Escolher obra" : "Cadastre uma obra para este cliente"));

    works.forEach(function (work) {
      reportWorkSelect.appendChild(createOption_(work.id, work.name));
    });
  }

  function createOption_(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function renderClientsList_(clients) {
    if (!clientsList) {
      return;
    }

    clientsList.innerHTML = "";
    if (!clients.length) {
      clientsList.textContent = "Nenhum cliente cadastrado.";
      clientsList.className = "entity-list empty-list";
      return;
    }

    clientsList.className = "entity-list";
    clients.forEach(function (client) {
      const item = createEntityItem_(
        client.name,
        [client.document, client.phone, client.email].filter(Boolean).join(" · ") || "Cliente sem contato informado",
        [
          createMiniButton_("Nova obra", "primary", function () {
            showDashboardPanel_("obras");
            if (workClientSelect) {
              workClientSelect.value = client.id;
            }
          })
        ]
      );
      clientsList.appendChild(item);
    });
  }

  function renderWorksList_(works) {
    if (!worksList) {
      return;
    }

    worksList.innerHTML = "";
    if (!works.length) {
      worksList.textContent = "Nenhuma obra cadastrada.";
      worksList.className = "entity-list empty-list";
      return;
    }

    worksList.className = "entity-list";
    works.forEach(function (work) {
      const client = findClient_(work.clientId);
      const item = createEntityItem_(
        work.name,
        (client ? client.name + " · " : "") + work.address + " · " + work.status,
        [
          createMiniButton_("Novo relatório", "primary", function () {
            showDashboardPanel_("relatorios");
            if (reportClientSelect) {
              reportClientSelect.value = work.clientId;
              renderReportWorkOptions_(work.clientId);
            }
            if (reportWorkSelect) {
              reportWorkSelect.value = work.id;
            }
          }),
          createMiniButton_("Novo diário", "", function () {
            showDashboardPanel_("diario");
            if (dailyLogWorkSelect) {
              dailyLogWorkSelect.value = work.id;
            }
            setLastOpened_("diario", work.clientId, work.id, "");
          })
        ]
      );
      worksList.appendChild(item);
    });
  }

  function renderReportsList_(target, reports) {
    if (!target) {
      return;
    }

    target.innerHTML = "";
    if (!reports.length) {
      target.textContent = "Nenhum relatório criado ainda.";
      target.className = "entity-list empty-list";
      return;
    }

    target.className = "entity-list";
    reports.forEach(function (report) {
      const work = findWork_(report.workId);
      const client = findClient_(report.clientId);
      const detail = [
        client && client.name,
        work && work.name,
        report.status,
        "Atualizado em " + formatDateTime_(report.updatedAt)
      ].filter(Boolean).join(" · ");
      const item = createEntityItem_(
        report.title,
        detail,
        [
          createMiniButton_("Abrir", "primary", function () {
            openReportEditor_(report.id).catch(function (error) {
              console.error(error);
              setCloudStatus_("Não foi possível abrir o relatório.", "error");
            });
          }),
          report.pdfUrl ? createMiniButton_("PDF", "", function () {
            window.open(report.pdfUrl, "_blank", "noopener");
          }) : null
        ].filter(Boolean)
      );
      target.appendChild(item);
    });
  }

  function renderClientWorksList_(target, works) {
    if (!target) {
      return;
    }

    target.innerHTML = "";
    if (!works.length) {
      target.textContent = "Nenhuma obra vinculada com segurança ao seu acesso.";
      target.className = "entity-list empty-list";
      return;
    }

    target.className = "entity-list";
    works.forEach(function (work) {
      const client = findClient_(work.clientId);
      target.appendChild(createEntityItem_(
        work.name,
        [client && client.name, work.address, work.status].filter(Boolean).join(" · "),
        []
      ));
    });
  }

  function renderClientReportsList_(target, reports) {
    if (!target) {
      return;
    }

    target.innerHTML = "";
    if (!reports.length) {
      target.textContent = "Nenhum relatório vinculado com segurança ao seu acesso.";
      target.className = "entity-list empty-list";
      return;
    }

    target.className = "entity-list";
    reports.forEach(function (report) {
      const work = findWork_(report.workId);
      const actions = report.pdfUrl ? [
        createMiniButton_("PDF", "primary", function () {
          window.open(report.pdfUrl, "_blank", "noopener");
        })
      ] : [];

      target.appendChild(createEntityItem_(
        report.title,
        [work && work.name, report.status, "Atualizado em " + formatDateTime_(report.updatedAt)].filter(Boolean).join(" · "),
        actions
      ));
    });
  }

  function renderClientRdosList_(target, dailyLogs) {
    if (!target) {
      return;
    }

    target.innerHTML = "";
    if (!dailyLogs.length) {
      target.textContent = "Nenhum RDO vinculado com segurança ao seu acesso.";
      target.className = "entity-list empty-list";
      return;
    }

    target.className = "entity-list";
    dailyLogs.forEach(function (logItem) {
      const work = findWork_(logItem.workId);
      target.appendChild(createEntityItem_(
        logItem.summary || logItem.services || "RDO",
        [work && work.name, formatDateOnly_(logItem.date), logItem.weather].filter(Boolean).join(" · "),
        [
          createMiniButton_("PDF", "primary", function () {
            openDailyLogPdf_(decorateDailyLogForExport_(logItem));
          })
        ]
      ));
    });
  }

  function renderClientDocumentsList_(target, reports) {
    if (!target) {
      return;
    }

    target.innerHTML = "";
    if (!reports.length) {
      target.textContent = "Nenhum PDF vinculado com segurança ao seu acesso.";
      target.className = "entity-list empty-list";
      return;
    }

    target.className = "entity-list";
    reports.forEach(function (report) {
      const work = findWork_(report.workId);
      target.appendChild(createEntityItem_(
        report.title,
        [work && work.name, "PDF disponível", "Atualizado em " + formatDateTime_(report.updatedAt)].filter(Boolean).join(" · "),
        [
          createMiniButton_("Abrir PDF", "primary", function () {
            window.open(report.pdfUrl, "_blank", "noopener");
          })
        ]
      ));
    });
  }

  function createEntityItem_(title, detail, actions) {
    const item = document.createElement("article");
    const content = document.createElement("div");
    const titleElement = document.createElement("strong");
    const detailElement = document.createElement("span");
    const actionsElement = document.createElement("div");

    item.className = "entity-item";
    titleElement.textContent = title;
    detailElement.textContent = detail;
    actionsElement.className = "entity-actions";

    actions.forEach(function (action) {
      actionsElement.appendChild(action);
    });

    content.appendChild(titleElement);
    content.appendChild(detailElement);
    item.appendChild(content);
    item.appendChild(actionsElement);
    return item;
  }

  function createMiniButton_(label, kind, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-button" + (kind ? " " + kind : "");
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function initializeDailyLogModule_() {
    if (!dailyLogForm) {
      return;
    }

    const dailyLogRouteButton = document.querySelector("[data-route-target='diario']");

    if (dailyLogRouteButton) {
      dailyLogRouteButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setLastOpened_("diario");
        scheduleLocalDataSave_();
        showDashboardPanel_("diario");
      }, true);
    }

    dailyLogForm.addEventListener("submit", function (event) {
      event.preventDefault();
      saveDailyLogFromForm_();
    });

    dailyLogForm.addEventListener("click", function (event) {
      const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
      const actionButton = target && target.closest ? target.closest("[data-diary-action]") : null;
      const aiButton = target && target.closest ? target.closest("[data-diary-ai-action]") : null;
      const pdfButton = target && target.closest ? target.closest("#dailyLogPdfButton") : null;

      if (pdfButton) {
        event.preventDefault();
        try {
          openDailyLogPdf_(collectDailyLogSnapshot_());
        } catch (error) {
          console.error(error);
          setDailyLogStatus_(error.message || "Não foi possível gerar o PDF do diário.", "error");
        }
        return;
      }

      if (aiButton) {
        event.preventDefault();
        handleDiaryAiAction_(aiButton).catch(function (error) {
          console.error(error);
          setDailyLogStatus_(error.message || "Não foi possível gerar o texto com IA.", "error");
        });
        return;
      }

      if (!actionButton) {
        return;
      }

      event.preventDefault();
      handleDailyLogDraftAction_(actionButton);
    });

    if (dailyLogResetButton) {
      dailyLogResetButton.addEventListener("click", function () {
        resetDailyLogForm_();
      });
    }

    if (dailyLogAddProductionButton) {
      dailyLogAddProductionButton.addEventListener("click", function () {
        addDailyLogProduction_();
      });
    }

    if (dailyLogCalculateMaterialsButton) {
      dailyLogCalculateMaterialsButton.addEventListener("click", function () {
        calculateDailyLogEstimatedMaterials_();
      });
    }

    bindRdoMaterialRequestEvents_();

    if (dailyLogEstimatePanel) {
      dailyLogEstimatePanel.addEventListener("click", function (event) {
        const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
        const button = target && target.closest ? target.closest("[data-estimate-action]") : null;

        if (!button) {
          return;
        }

        event.preventDefault();
        handleEstimateAction_(button);
      });
    }

    if (dailyLogAddMaterialButton) {
      dailyLogAddMaterialButton.addEventListener("click", function () {
        addDailyLogMaterial_();
      });
    }

    if (dailyLogAddToolButton) {
      dailyLogAddToolButton.addEventListener("click", function () {
        addDailyLogTool_();
      });
    }

    if (dailyLogAddPhotoButton) {
      dailyLogAddPhotoButton.addEventListener("click", function () {
        addDailyLogPhoto_().catch(function (error) {
          console.error(error);
          setDailyLogStatus_(error.message || "Não foi possível adicionar a foto.", "error");
        });
      });
    }

    if (dailyLogPdfButton) {
      dailyLogPdfButton.addEventListener("click", function (event) {
        event.stopPropagation();
        try {
          openDailyLogPdf_(collectDailyLogSnapshot_());
        } catch (error) {
          console.error(error);
          setDailyLogStatus_(error.message || "Não foi possível gerar o PDF do diário.", "error");
        }
      });
    }

    if (dailyLogShareWhatsappButton) {
      dailyLogShareWhatsappButton.addEventListener("click", function () {
        shareDailyLogSummary_("whatsapp");
      });
    }

    if (dailyLogShareEmailButton) {
      dailyLogShareEmailButton.addEventListener("click", function () {
        shareDailyLogSummary_("email");
      });
    }

    if (dailyLogWorkSelect) {
      dailyLogWorkSelect.addEventListener("change", function () {
        const work = findWork_(dailyLogWorkSelect.value);
        setLastOpened_("diario", work ? work.clientId : "", dailyLogWorkSelect.value, "");
        scheduleLocalDataSave_({ syncCloud: false });
      });
    }

    if (dailyLogRecordsList) {
      dailyLogRecordsList.addEventListener("click", function (event) {
        const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
        const button = target && target.closest ? target.closest("[data-daily-log-record-action]") : null;

        if (!button) {
          return;
        }

        event.preventDefault();
        if (button.dataset.dailyLogRecordAction === "pdf") {
          const logItem = findDailyLog_(button.dataset.dailyLogId);
          if (logItem) {
            try {
              openDailyLogPdf_(decorateDailyLogForExport_(logItem));
            } catch (error) {
              console.error(error);
              setDailyLogStatus_(error.message || "Não foi possível gerar o PDF do diário.", "error");
            }
          }
        }

        if (button.dataset.dailyLogRecordAction === "edit") {
          loadDailyLogIntoForm_(button.dataset.dailyLogId);
          showDashboardPanel_("diario");
        }

        if (button.dataset.dailyLogRecordAction === "remove") {
          removeDailyLog_(button.dataset.dailyLogId);
        }
      });
    }

    if (dailyLogSearchInput) {
      dailyLogSearchInput.addEventListener("input", function () {
        dailyLogSearchTerm = clean(dailyLogSearchInput.value).toLowerCase();
        renderDailyLogRecords_(getUserDailyLogs_());
      });
    }

    initializeCompositionLibrary_();
    resetDailyLogForm_();
  }

  function createEmptyDailyLogDraft_() {
    return {
      productions: [],
      materials: [],
      tools: [],
      photos: [],
      editingProductionId: "",
      editingMaterialId: "",
      editingToolId: ""
    };
  }

  function createEmptyCompositionDraft_() {
    return {
      materials: [],
      editingMaterialId: ""
    };
  }

  function initializeCompositionLibrary_() {
    if (!compositionForm) {
      return;
    }

    compositionForm.addEventListener("submit", function (event) {
      event.preventDefault();
      saveCompositionFromForm_();
    });

    if (compositionAddMaterialButton) {
      compositionAddMaterialButton.addEventListener("click", function () {
        addCompositionMaterial_();
      });
    }

    if (compositionResetButton) {
      compositionResetButton.addEventListener("click", function () {
        resetCompositionForm_();
      });
    }

    if (compositionRestoreDefaultsButton) {
      compositionRestoreDefaultsButton.addEventListener("click", function () {
        restoreDefaultCompositions_();
      });
    }

    if (compositionMaterialsList) {
      compositionMaterialsList.addEventListener("click", function (event) {
        const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
        const button = target && target.closest ? target.closest("[data-composition-material-action]") : null;

        if (!button) {
          return;
        }

        event.preventDefault();
        handleCompositionMaterialAction_(button);
      });
    }

    if (compositionLibraryList) {
      compositionLibraryList.addEventListener("click", function (event) {
        const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
        const button = target && target.closest ? target.closest("[data-composition-action]") : null;

        if (!button) {
          return;
        }

        event.preventDefault();
        handleCompositionAction_(button);
      });
    }

    resetCompositionForm_();
  }

  function renderCompositionModule_() {
    renderCompositionMaterialsDraft_();
    renderCompositionLibraryList_();
  }

  function saveCompositionFromForm_() {
    if (!compositionForm) {
      return;
    }

    const formData = new FormData(compositionForm);
    const id = clean(formData.get("compositionId")) || createId_("cmp");
    const composition = normalizeComposition_({
      id: id,
      service: clean(formData.get("compositionService")),
      productionUnit: clean(formData.get("compositionProductionUnit")) || "m²",
      lossPercent: parseNumber_(formData.get("compositionLossPercent")),
      source: clean(formData.get("compositionSource")) || "Personalizada",
      sinapiCode: clean(formData.get("compositionSinapiCode")),
      state: clean(formData.get("compositionState")),
      competence: clean(formData.get("compositionCompetence")),
      externalSource: clean(formData.get("compositionExternalSource")),
      note: clean(formData.get("compositionNote")),
      materials: cloneDailyLogItems_(compositionDraft.materials)
    });

    if (!composition.service || !composition.materials.length) {
      setDailyLogStatus_("Informe serviço e pelo menos um material da composição.", "error");
      return;
    }

    const existingIndex = appState.compositions.findIndex(function (item) {
      return item.id === composition.id;
    });

    if (existingIndex >= 0) {
      appState.compositions[existingIndex] = composition;
    } else {
      appState.compositions.push(composition);
    }

    saveLocalData({ syncCloud: true });
    resetCompositionForm_();
    renderCompositionModule_();
    setDailyLogStatus_("Composição salva localmente e enviada para sincronização.", "success");
  }

  function addCompositionMaterial_() {
    if (!compositionForm) {
      return;
    }

    const name = clean(compositionForm.elements.compositionMaterialName && compositionForm.elements.compositionMaterialName.value);
    const quantityPerUnit = parseNumber_(compositionForm.elements.compositionMaterialQuantity && compositionForm.elements.compositionMaterialQuantity.value);
    const unit = clean(compositionForm.elements.compositionMaterialUnit && compositionForm.elements.compositionMaterialUnit.value) || "un";
    const note = clean(compositionForm.elements.compositionMaterialNote && compositionForm.elements.compositionMaterialNote.value);

    if (!name || quantityPerUnit <= 0) {
      setDailyLogStatus_("Informe material e quantidade por unidade.", "error");
      return;
    }

    const item = {
      id: compositionDraft.editingMaterialId || createId_("cmt"),
      name: name,
      quantityPerUnit: quantityPerUnit,
      unit: unit,
      note: note
    };
    const existingIndex = compositionDraft.materials.findIndex(function (material) {
      return material.id === item.id;
    });

    if (existingIndex >= 0) {
      compositionDraft.materials[existingIndex] = item;
    } else {
      compositionDraft.materials.push(item);
    }

    compositionDraft.editingMaterialId = "";
    compositionForm.elements.compositionMaterialName.value = "";
    compositionForm.elements.compositionMaterialQuantity.value = "";
    compositionForm.elements.compositionMaterialUnit.value = "un";
    compositionForm.elements.compositionMaterialNote.value = "";
    if (compositionAddMaterialButton) {
      compositionAddMaterialButton.textContent = "Adicionar material da composição";
    }
    renderCompositionMaterialsDraft_();
  }

  function resetCompositionForm_() {
    if (!compositionForm) {
      return;
    }

    compositionForm.reset();
    compositionDraft = createEmptyCompositionDraft_();
    compositionForm.elements.compositionId.value = "";
    compositionForm.elements.compositionSource.value = "Personalizada";
    compositionForm.elements.compositionProductionUnit.value = "m²";
    compositionForm.elements.compositionMaterialUnit.value = "un";
    if (compositionAddMaterialButton) {
      compositionAddMaterialButton.textContent = "Adicionar material da composição";
    }
    renderCompositionMaterialsDraft_();
  }

  function restoreDefaultCompositions_() {
    const custom = appState.compositions.filter(function (composition) {
      return !isStockAiDefaultComposition_(composition);
    });

    appState.compositions = getDefaultCompositions_().concat(custom);
    saveLocalData({ syncCloud: true });
    resetCompositionForm_();
    renderCompositionModule_();
    setDailyLogStatus_("Composições demonstrativas/editáveis restauradas e enviadas para sincronização.", "success");
  }

  function renderCompositionMaterialsDraft_() {
    if (!compositionMaterialsList) {
      return;
    }

    compositionMaterialsList.innerHTML = "";
    if (!compositionDraft.materials.length) {
      compositionMaterialsList.textContent = "Nenhum material na composição.";
      compositionMaterialsList.className = "diary-item-list empty-list";
      return;
    }

    compositionMaterialsList.className = "diary-item-list";
    compositionDraft.materials.forEach(function (material) {
      compositionMaterialsList.appendChild(createDiaryListItem_(
        material.name,
        formatQuantity_(material.quantityPerUnit) + " " + material.unit + " por unidade",
        material.note,
        [
          createCompositionMaterialButton_("Editar", "edit", material.id),
          createCompositionMaterialButton_("Remover", "remove", material.id)
        ]
      ));
    });
  }

  function renderCompositionLibraryList_() {
    if (!compositionLibraryList) {
      return;
    }

    const compositions = ensureCompositionLibrary_(appState.compositions).sort(function (a, b) {
      return String(a.service || "").localeCompare(String(b.service || ""));
    });

    appState.compositions = compositions;
    compositionLibraryList.innerHTML = "";

    if (!compositions.length) {
      compositionLibraryList.textContent = "Nenhuma composição cadastrada.";
      compositionLibraryList.className = "diary-item-list empty-list";
      return;
    }

    compositionLibraryList.className = "diary-item-list";
    compositions.forEach(function (composition) {
      const actions = [
        createCompositionButton_("Editar", "edit", composition.id),
        createCompositionButton_("Duplicar", "duplicate", composition.id)
      ];

      if (!isStockAiDefaultComposition_(composition)) {
        actions.push(createCompositionButton_("Remover", "remove", composition.id));
      }

      compositionLibraryList.appendChild(createDiaryListItem_(
        composition.service,
        [
          composition.productionUnit,
          "Perda " + formatQuantity_(composition.lossPercent || 0) + "%",
          composition.source
        ].join(" · "),
        composition.materials.length + " material(is) · " + (composition.note || "Sem observação."),
        actions
      ));
    });
  }

  function createCompositionMaterialButton_(label, action, materialId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action === "remove" ? "mini-button danger" : "mini-button";
    button.textContent = label;
    button.dataset.compositionMaterialAction = action;
    button.dataset.materialId = materialId;
    return button;
  }

  function createCompositionButton_(label, action, compositionId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action === "remove" ? "mini-button danger" : "mini-button";
    button.textContent = label;
    button.dataset.compositionAction = action;
    button.dataset.compositionId = compositionId;
    return button;
  }

  function handleCompositionMaterialAction_(button) {
    const materialId = button.dataset.materialId;

    if (button.dataset.compositionMaterialAction === "remove") {
      compositionDraft.materials = compositionDraft.materials.filter(function (material) {
        return material.id !== materialId;
      });
      renderCompositionMaterialsDraft_();
      return;
    }

    const material = compositionDraft.materials.find(function (item) {
      return item.id === materialId;
    });

    if (!material || !compositionForm) {
      return;
    }

    compositionDraft.editingMaterialId = material.id;
    compositionForm.elements.compositionMaterialName.value = material.name || "";
    compositionForm.elements.compositionMaterialQuantity.value = material.quantityPerUnit || "";
    compositionForm.elements.compositionMaterialUnit.value = material.unit || "un";
    compositionForm.elements.compositionMaterialNote.value = material.note || "";
    if (compositionAddMaterialButton) {
      compositionAddMaterialButton.textContent = "Atualizar material da composição";
    }
  }

  function handleCompositionAction_(button) {
    const composition = findComposition_(button.dataset.compositionId);

    if (!composition) {
      return;
    }

    if (button.dataset.compositionAction === "edit") {
      loadCompositionIntoForm_(composition);
      return;
    }

    if (button.dataset.compositionAction === "duplicate") {
      loadCompositionIntoForm_(Object.assign(cloneComposition_(composition), {
        id: "",
        service: composition.service + " personalizada",
        source: "Personalizada"
      }));
      setDailyLogStatus_("Composição duplicada para personalização. Revise e salve.", "info");
      return;
    }

    if (button.dataset.compositionAction === "remove" && !isStockAiDefaultComposition_(composition)) {
      appState.compositions = appState.compositions.filter(function (item) {
        return item.id !== composition.id;
      });
      saveLocalData({ syncCloud: true });
      renderCompositionModule_();
      setDailyLogStatus_("Composição personalizada removida e alteração enviada para sincronização.", "success");
    }
  }

  function loadCompositionIntoForm_(composition) {
    if (!compositionForm) {
      return;
    }

    compositionForm.reset();
    compositionForm.elements.compositionId.value = composition.id || "";
    compositionForm.elements.compositionService.value = composition.service || "";
    compositionForm.elements.compositionProductionUnit.value = composition.productionUnit || "m²";
    compositionForm.elements.compositionLossPercent.value = composition.lossPercent || "";
    compositionForm.elements.compositionSource.value = composition.source || "Personalizada";
    compositionForm.elements.compositionSinapiCode.value = composition.sinapiCode || "";
    compositionForm.elements.compositionState.value = composition.state || "";
    compositionForm.elements.compositionCompetence.value = composition.competence || "";
    compositionForm.elements.compositionExternalSource.value = composition.externalSource || "";
    compositionForm.elements.compositionNote.value = composition.note || "";
    compositionDraft = createEmptyCompositionDraft_();
    compositionDraft.materials = cloneDailyLogItems_(composition.materials);
    renderCompositionMaterialsDraft_();
    compositionForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function findComposition_(compositionId) {
    return ensureCompositionLibrary_(appState.compositions).find(function (composition) {
      return composition.id === compositionId;
    }) || null;
  }

  function clearDailyLogEstimate_() {
    dailyLogEstimateDraft = {
      items: [],
      audit: [],
      missing: [],
      purchasePlan: null,
      editable: false
    };
    renderEstimatePanel_();
  }

  function calculateDailyLogEstimatedMaterials_() {
    if (!dailyLogDraft.productions.length) {
      setDailyLogStatus_("Adicione produção executada antes de calcular materiais estimados.", "error");
      return;
    }

    const result = buildEstimatedMaterialsForProductions_(dailyLogDraft.productions, dailyLogDraft.materials);
    dailyLogEstimateDraft = {
      items: result.items,
      audit: result.audit,
      missing: result.missing,
      purchasePlan: result.purchasePlan,
      editable: false
    };
    renderEstimatePanel_();

    if (!result.items.length) {
      setDailyLogStatus_("Nenhuma composição encontrada para a produção registrada.", "error");
      return;
    }

    setDailyLogStatus_("Consumo estimado calculado. Revise antes de aplicar ao diário.", "success");
  }

  function buildEstimatedMaterialsForProductions_(productions, registeredMaterials) {
    const grouped = {};
    const missing = [];
    const predictions = [];

    productions.forEach(function (production) {
      const prediction = calculateStockAiPredictedConsumption(production);

      if (!prediction.composition || prediction.executedQuantity <= 0) {
        missing.push(production);
        return;
      }

      predictions.push(prediction);
      prediction.predictedItems.forEach(function (material) {
        const key = normalizeCompositionKey_(material.name) + "|" + (material.unit || "un");

        if (!grouped[key]) {
          grouped[key] = {
            id: createId_("est"),
            name: material.name,
            quantity: 0,
            unit: material.unit || "un",
            note: "Consumo previsto por composição técnica demonstrativa/editável.",
            sources: []
          };
        }

        grouped[key].quantity += parseNumber_(material.quantity);
        grouped[key].sources = grouped[key].sources.concat(material.sources || []);
      });
    });

    const items = Object.keys(grouped).map(function (key) {
      const item = grouped[key];
      item.quantity = roundQuantity_(item.quantity);
      item.note += " Origem: " + item.sources.join("; ") + ".";
      return item;
    }).sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    return {
      items: items,
      missing: missing,
      audit: comparePredictedVsActualConsumption(items, registeredMaterials || dailyLogDraft.materials),
      predictions: predictions,
      purchasePlan: buildStockAiPurchasePlan(productions, calculateRealStockBalances_(), {
        predictedItems: items
      }),
      warning: STOCK_AI_DEMO_COMPOSITION_WARNING
    };
  }

  function buildStockAiPurchasePlan(productions, stockItems, options) {
    const settings = options || {};
    const predicted = settings.predictedItems || buildEstimatedMaterialsForProductions_(productions || [], []).items;
    const stock = Array.isArray(stockItems) ? stockItems : calculateRealStockBalances_();
    const items = predicted.map(function (material) {
      const stockMatch = matchPredictedMaterialToStockItem(material, stock);
      const stockItem = stockMatch && stockMatch.item ? stockMatch.item : null;
      const requiredQuantity = roundQuantity_(parseNumber_(material.quantity || material.predictedQuantity || material.estimated));
      const currentBalance = stockMatch ? roundQuantity_(parseNumber_(stockMatch.realBalance)) : 0;
      const purchaseQuantity = roundQuantity_(Math.max(requiredQuantity - currentBalance, 0));
      const status = getStockAiPurchasePlanStatus_(requiredQuantity, currentBalance, stockMatch);

      return {
        id: "purchase_plan_" + normalizeCompositionKey_(material.name) + "_" + normalizeUnitKey_(material.unit || "un"),
        material: material.name || material.material || "Material",
        materialName: material.name || material.material || "Material",
        unit: material.unit || "un",
        predictedQuantity: requiredQuantity,
        requiredQuantity: requiredQuantity,
        currentBalance: currentBalance,
        purchaseQuantity: purchaseQuantity,
        status: status,
        stockItemId: stockItem ? stockItem.id : null,
        stockItemName: stockItem ? stockItem.name : "",
        note: buildStockAiPurchasePlanNote_(status, stockItem, stockMatch)
      };
    }).sort(function (a, b) {
      return getStockAiPurchasePlanStatusRank_(b.status) - getStockAiPurchasePlanStatusRank_(a.status) ||
        String(a.materialName || "").localeCompare(String(b.materialName || ""));
    });

    const summary = {
      totalPredicted: items.length,
      sufficient: items.filter(function (item) { return item.status === "suficiente"; }).length,
      toBuy: items.filter(function (item) { return item.status === "comprar"; }).length,
      critical: items.filter(function (item) { return item.status === "crítico"; }).length,
      notFound: items.filter(function (item) { return item.status === "sem item no estoque"; }).length
    };

    return {
      items: items,
      summary: summary,
      warning: "Lista de compra gerada a partir de composições demonstrativas/editáveis e saldo local. Validar antes de compra oficial."
    };
  }

  function matchPredictedMaterialToStockItem(predictedMaterial, stockItems) {
    const materialName = clean(predictedMaterial && (predictedMaterial.name || predictedMaterial.material));
    const materialUnit = normalizeUnitKey_(predictedMaterial && predictedMaterial.unit || "un");
    const materialKeys = buildStockAiMaterialMatchKeys_(materialName);
    const candidates = (stockItems || []).map(function (entry) {
      return entry && entry.item ? entry : {
        item: entry,
        realBalance: entry && entry.realBalance !== undefined ? entry.realBalance : entry && entry.balance
      };
    }).filter(function (entry) {
      return entry && entry.item;
    });

    return candidates.find(function (entry) {
      const item = entry.item || {};
      return normalizeUnitKey_(item.unit || "un") === materialUnit &&
        normalizeCompositionKey_(item.name) === normalizeCompositionKey_(materialName);
    }) || candidates.find(function (entry) {
      const item = entry.item || {};
      const itemKeys = buildStockAiMaterialMatchKeys_(item.name);
      return normalizeUnitKey_(item.unit || "un") === materialUnit &&
        materialKeys.some(function (key) { return itemKeys.indexOf(key) >= 0; });
    }) || candidates.find(function (entry) {
      const item = entry.item || {};
      const itemKeys = buildStockAiMaterialMatchKeys_(item.name);
      return materialKeys.some(function (key) {
        return itemKeys.some(function (itemKey) {
          return key.length >= 4 && itemKey.length >= 4 && (key.indexOf(itemKey) >= 0 || itemKey.indexOf(key) >= 0);
        });
      });
    }) || null;
  }

  function buildStockAiMaterialMatchKeys_(name) {
    const normalized = normalizeCompositionKey_(name);
    const aliases = {
      "bloco ceramico": ["bloco", "tijolo", "tijolo ceramico"],
      "bloco": ["bloco ceramico", "tijolo", "tijolo ceramico", "bloco concreto"],
      "cimento": ["cimento cp ii", "cimento cp iv", "cimento portland"],
      "argamassa": ["argamassa colante", "massa", "cimento areia"],
      "areia": ["areia media", "areia fina", "areia lavada"],
      "brita": ["brita 1", "pedrisco"],
      "tinta": ["tinta acrilica", "tinta acrilica externa", "tinta parede"],
      "tubo pvc esgoto": ["esgoto", "pvc esgoto", "tubulacao esgoto"],
      "tubo pvc agua": ["agua fria", "pvc agua", "tubulacao agua", "tubo pvc agua fria"],
      "cabo eletrico": ["fio", "fiacao", "fiação", "cabo"],
      "eletroduto": ["conduite", "conduíte"],
      "telha ceramica": ["telha", "telhado", "cobertura ceramica"],
      "telha fibrocimento": ["fibrocimento", "telha brasilit"],
      "aco ca 50": ["aco", "aço", "ferro", "armacao", "armação"]
    };
    const words = normalized.split(" ").filter(function (word) {
      return word.length >= 4;
    });
    const keys = [normalized].concat(words);

    Object.keys(aliases).forEach(function (key) {
      if (normalized.indexOf(key) >= 0 || aliases[key].some(function (alias) { return normalized.indexOf(normalizeCompositionKey_(alias)) >= 0; })) {
        keys.push(key);
        keys.push.apply(keys, aliases[key].map(normalizeCompositionKey_));
      }
    });

    return keys.filter(Boolean).filter(function (key, index, list) {
      return list.indexOf(key) === index;
    });
  }

  function getStockAiPurchasePlanStatus_(requiredQuantity, currentBalance, stockMatch) {
    if (!stockMatch) {
      return "sem item no estoque";
    }

    if (currentBalance >= requiredQuantity) {
      return "suficiente";
    }

    if (currentBalance <= 0) {
      return "crítico";
    }

    if (requiredQuantity > 0 && currentBalance / requiredQuantity <= 0.25) {
      return "crítico";
    }

    return "comprar";
  }

  function getStockAiPurchasePlanStatusRank_(status) {
    if (status === "crítico") {
      return 4;
    }
    if (status === "sem item no estoque") {
      return 3;
    }
    if (status === "comprar") {
      return 2;
    }
    return 1;
  }

  function buildStockAiPurchasePlanNote_(status, stockItem, stockMatch) {
    if (status === "sem item no estoque") {
      return "Material previsto sem item correspondente no estoque local.";
    }
    if (status === "crítico") {
      return "Saldo insuficiente para a produção prevista. Revisar compra antes da execução.";
    }
    if (status === "comprar") {
      return "Comprar a diferença entre consumo previsto e saldo local.";
    }
    return "Saldo local atende ao consumo previsto.";
  }

  function isStockAiCompositionRequest_(message) {
    const normalized = normalizeCompositionKey_(message);
    const centralEngine = window.StockAiCompositionEngine || {};
    if (typeof centralEngine.isCompositionRequest === "function" && centralEngine.isCompositionRequest(message)) {
      return true;
    }
    const intentTerms = [
      "composicao",
      "compor",
      "calcular materiais",
      "calcule materiais",
      "materiais para",
      "qual material",
      "quantas telhas",
      "qual o madeiramento",
      "vou fazer",
      "vou executar",
      "quero fazer",
      "preciso fazer",
      "consumo previsto"
    ];
    const serviceTerms = [
      "alvenaria",
      "parede",
      "bloco",
      "chapisco",
      "reboco",
      "emboco",
      "massa",
      "pintura",
      "telhado",
      "cobertura",
      "telha",
      "telha ceramica",
      "telha fibrocimento",
      "madeiramento",
      "caibro",
      "ripa",
      "terca",
      "estrutura de madeira",
      "concreto"
    ];

    return intentTerms.some(function (term) { return normalized.indexOf(term) >= 0; }) &&
      serviceTerms.some(function (term) { return normalized.indexOf(term) >= 0; });
  }

  function parseStockAiCompositionRequest(message) {
    const text = clean(message);
    const normalized = normalizeCompositionKey_(text);
    const quantityMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(m²|m2|m³|m3|metro quadrado|metros quadrados|metro cubico|metros cubicos|metro cúbico|metros cúbicos|m\b|un\b)/i);
    const hasCompositionIntent = isStockAiCompositionRequest_(text);
    const quantity = quantityMatch ? parseNumber_(quantityMatch[1]) : (hasCompositionIntent ? 1 : 0);
    const unit = quantityMatch ? normalizeStockAiRequestedUnit_(quantityMatch[2]) : "";
    const serviceRules = [
      {
        service: "Alvenaria de bloco cerâmico",
        unit: "m²",
        terms: ["alvenaria", "parede", "bloco ceramico", "tijolo ceramico"]
      },
      {
        service: "Chapisco",
        unit: "m²",
        terms: ["chapisco"]
      },
      {
        service: "Emboço",
        unit: "m²",
        terms: ["emboco", "massa grossa"]
      },
      {
        service: "Reboco",
        unit: "m²",
        terms: ["reboco", "massa fina"]
      },
      {
        service: "Pintura interna",
        unit: "m²",
        terms: ["pintura", "tinta"]
      },
      {
        service: "Telha cerâmica",
        unit: "m²",
        terms: ["telhado", "telha ceramica", "cobertura"]
      },
      {
        service: "Telha fibrocimento",
        unit: "m²",
        terms: ["telha fibrocimento", "fibrocimento"]
      },
      {
        service: "Estrutura de madeira para telhado",
        unit: "m²",
        terms: ["madeiramento", "caibro", "ripa", "terca", "estrutura de madeira"]
      },
      {
        service: "Concreto simples",
        unit: "m³",
        terms: ["concreto simples", "concreto"]
      },
      {
        service: "Concreto estrutural",
        unit: "m³",
        terms: ["concreto estrutural", "concreto armado"]
      }
    ];
    const services = [];

    serviceRules.forEach(function (rule) {
      const matched = rule.terms.some(function (term) {
        return normalized.indexOf(term) >= 0;
      });
      if (!matched) {
        return;
      }
      if (rule.service === "Emboço" && normalized.indexOf("reboco") >= 0 && normalized.indexOf("emboco") < 0 && normalized.indexOf("massa grossa") < 0) {
        return;
      }
      if (rule.service === "Concreto simples" && (normalized.indexOf("concreto estrutural") >= 0 || normalized.indexOf("concreto armado") >= 0)) {
        return;
      }
      if (rule.service === "Telha cerâmica" && normalized.indexOf("fibrocimento") >= 0) {
        return;
      }
      services.push({
        service: rule.service,
        quantity: quantity,
        unit: unit || rule.unit,
        requestedUnit: unit,
        materialHint: rule.terms.find(function (term) { return normalized.indexOf(term) >= 0; }) || ""
      });
    });

    if (normalized.indexOf("massa") >= 0 && !services.some(function (item) { return item.service === "Emboço"; }) && !services.some(function (item) { return item.service === "Reboco"; })) {
      services.push({ service: "Emboço", quantity: quantity, unit: unit || "m²", requestedUnit: unit, materialHint: "massa" });
      services.push({ service: "Reboco", quantity: quantity, unit: unit || "m²", requestedUnit: unit, materialHint: "massa" });
    }

    return {
      originalMessage: text,
      quantity: quantity,
      unit: unit,
      assumedBaseQuantity: !quantityMatch && quantity > 0,
      services: services.filter(function (item, index, list) {
        return list.findIndex(function (candidate) { return candidate.service === item.service; }) === index;
      })
    };
  }

  function normalizeStockAiRequestedUnit_(unit) {
    const normalized = normalizeCompositionKey_(unit);
    if (normalized === "m2" || normalized.indexOf("quadrado") >= 0) {
      return "m²";
    }
    if (normalized === "m3" || normalized.indexOf("cubico") >= 0) {
      return "m³";
    }
    if (normalized === "m") {
      return "m";
    }
    return normalized || "un";
  }

  function buildStockAiCompositionAnswerFromMessage(message) {
    const centralEngine = window.StockAiCompositionEngine || {};
    if (typeof centralEngine.buildAnswerFromMessage === "function") {
      const centralAnswer = clean(centralEngine.buildAnswerFromMessage(message, {
        stockItems: calculateRealStockBalances_()
      }));
      if (centralAnswer) {
        return centralAnswer;
      }
    }

    const request = parseStockAiCompositionRequest(message);
    if (!request.quantity || !request.services.length) {
      return "";
    }

    const predictions = request.services.map(function (service) {
      const prediction = calculateStockAiPredictedConsumption({
        service: service.service,
        quantity: service.quantity,
        unit: service.unit
      });
      return prediction.predictedItems && prediction.predictedItems.length ? prediction : null;
    }).filter(Boolean);

    if (!predictions.length) {
      return "";
    }

    const materialsByKey = {};
    predictions.forEach(function (prediction) {
      (prediction.predictedItems || []).forEach(function (material) {
        const key = normalizeStockMaterialKey_(material.name, material.unit);
        if (!materialsByKey[key]) {
          materialsByKey[key] = {
            name: material.name,
            unit: material.unit || "un",
            quantity: 0,
            sources: []
          };
        }
        materialsByKey[key].quantity += parseNumber_(material.quantity);
        materialsByKey[key].sources.push(prediction.service);
      });
    });

    const consolidated = Object.keys(materialsByKey).map(function (key) {
      const item = materialsByKey[key];
      item.quantity = roundQuantity_(item.quantity);
      return item;
    }).sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    const purchasePlan = buildStockAiPurchasePlan(request.services, calculateRealStockBalances_(), {
      predictedItems: consolidated
    });
    const purchaseItems = (purchasePlan.items || []).filter(function (item) {
      return item.status !== "suficiente";
    }).slice(0, 6);
    const lines = [
      "Entendi o planejamento:"
    ];

    if (request.assumedBaseQuantity) {
      lines.push("- Área total não informada; usei uma base demonstrativa de 1 m² para listar a composição.");
    }

    predictions.forEach(function (prediction) {
      lines.push("- " + formatQuantity_(prediction.executedQuantity) + " " + prediction.unit + " de " + prediction.service);
    });

    lines.push("");
    lines.push("Composição estimada:");
    consolidated.slice(0, 12).forEach(function (material) {
      lines.push("- " + material.name + ": " + formatQuantity_(material.quantity) + " " + material.unit);
    });

    if (consolidated.length > 12) {
      lines.push("- +" + (consolidated.length - 12) + " material(is) consolidado(s).");
    }

    if (purchaseItems.length) {
      lines.push("");
      lines.push("Planejamento de compra pelo saldo local:");
      purchaseItems.forEach(function (item) {
        lines.push("- " + item.materialName + ": saldo " + formatQuantity_(item.currentBalance) + " " + item.unit +
          ", comprar " + formatQuantity_(item.purchaseQuantity) + " " + item.unit + " (" + item.status + ")");
      });
    }

    lines.push("");
    lines.push("Observação:");
    lines.push(STOCK_AI_DEMO_COMPOSITION_WARNING);
    return lines.join("\n");
  }

  function calculateStockAiPredictedConsumption(serviceInput) {
    const input = serviceInput || {};
    const composition = input.composition || input.selectedComposition || findCompositionForProduction_(input);
    const centralEngine = window.StockAiCompositionEngine || {};
    if (!composition && typeof centralEngine.calculatePredictedConsumption === "function") {
      const centralResult = centralEngine.calculatePredictedConsumption(input);
      if (centralResult && centralResult.composition) {
        return centralResult;
      }
    }
    const executedQuantity = parseNumber_(input.quantity || input.executedQuantity);
    const service = clean(input.service || input.serviceName || (composition && composition.service));
    const unit = clean(input.unit || (composition && composition.productionUnit)) || "un";
    const result = {
      service: service,
      executedQuantity: roundQuantity_(executedQuantity),
      unit: unit,
      composition: composition ? {
        id: composition.id,
        service: composition.service,
        productionUnit: composition.productionUnit,
        source: composition.source || STOCK_AI_DEMO_COMPOSITION_SOURCE,
        lossPercent: parseNumber_(composition.lossPercent),
        note: composition.note || STOCK_AI_DEMO_COMPOSITION_WARNING
      } : null,
      predictedItems: [],
      technicalNotes: [],
      warning: STOCK_AI_DEMO_COMPOSITION_WARNING
    };

    if (!composition || executedQuantity <= 0) {
      result.technicalNotes.push("Sem composição compatível ou quantidade executada inválida.");
      return result;
    }

    const lossMultiplier = 1 + (parseNumber_(composition.lossPercent) / 100);
    result.predictedItems = (composition.materials || []).map(function (material) {
      const coefficient = parseNumber_(material.quantityPerUnit);
      const quantity = roundQuantity_(executedQuantity * coefficient * lossMultiplier);
      return {
        id: material.id || createId_("pred"),
        name: material.name,
        material: material.name,
        coefficient: coefficient,
        quantity: quantity,
        predictedQuantity: quantity,
        unit: material.unit || "un",
        note: material.note || STOCK_AI_DEMO_COMPOSITION_WARNING,
        sources: [
          service + " " + formatQuantity_(executedQuantity) + " " + unit +
            " · composição: " + composition.service +
            " · fonte: " + (composition.source || STOCK_AI_DEMO_COMPOSITION_SOURCE)
        ]
      };
    }).filter(function (item) {
      return item.name && parseNumber_(item.quantity) > 0;
    });

    result.technicalNotes.push("Perda aplicada: " + formatQuantity_(parseNumber_(composition.lossPercent)) + "%.");
    result.technicalNotes.push(STOCK_AI_DEMO_COMPOSITION_WARNING);
    return result;
  }

  function findCompositionForProduction_(production) {
    const serviceKey = normalizeCompositionKey_(production.service);
    const unitKey = normalizeUnitKey_(production.unit);
    const compositions = ensureCompositionLibrary_(appState.compositions).filter(function (composition) {
      return compositionMatchesProduction_(composition, serviceKey);
    });

    if (!compositions.length) {
      return null;
    }

    return compositions.find(function (composition) {
      return !isStockAiDefaultComposition_(composition) && normalizeUnitKey_(composition.productionUnit) === unitKey;
    }) || compositions.find(function (composition) {
      return normalizeUnitKey_(composition.productionUnit) === unitKey;
    }) || compositions.find(function (composition) {
      return !isStockAiDefaultComposition_(composition);
    }) || compositions[0];
  }

  function compositionMatchesProduction_(composition, serviceKey) {
    if (!serviceKey) {
      return false;
    }

    const keys = [composition.service].concat(composition.aliases || []).map(normalizeCompositionKey_).filter(Boolean);
    return keys.some(function (key) {
      return key === serviceKey ||
        key.indexOf(serviceKey) >= 0 ||
        serviceKey.indexOf(key) >= 0;
    });
  }

  function buildEstimatedConsumptionAudit_(estimatedItems, registeredMaterials) {
    return comparePredictedVsActualConsumption(estimatedItems, registeredMaterials || dailyLogDraft.materials);
  }

  function comparePredictedVsActualConsumption(predictedItems, actualItems) {
    const predicted = {};
    const actual = {};

    (predictedItems || []).forEach(function (item) {
      const name = clean(item.name || item.material);
      const unit = clean(item.unit) || "un";
      const key = normalizeCompositionKey_(name) + "|" + unit;
      if (!name) {
        return;
      }
      if (!predicted[key]) {
        predicted[key] = {
          name: name,
          quantity: 0,
          unit: unit
        };
      }
      predicted[key].quantity += parseNumber_(item.quantity || item.predictedQuantity || item.estimated);
    });

    (actualItems || []).forEach(function (material) {
      const name = clean(material.name || material.material);
      const unit = clean(material.unit) || "un";
      const key = normalizeCompositionKey_(name) + "|" + unit;
      if (!name) {
        return;
      }
      if (!actual[key]) {
        actual[key] = {
          name: name,
          quantity: 0,
          unit: unit
        };
      }

      actual[key].quantity += parseNumber_(material.quantity || material.actualQuantity || material.registered);
    });

    return Object.keys(Object.assign({}, predicted, actual)).map(function (key) {
      const predictedItem = predicted[key];
      const actualItem = actual[key];
      const estimated = roundQuantity_(predictedItem ? predictedItem.quantity : 0);
      const registered = roundQuantity_(actualItem ? actualItem.quantity : 0);
      const difference = roundQuantity_(registered - estimated);
      const differencePercent = estimated > 0 ? roundQuantity_((difference / estimated) * 100) : 0;

      return {
        name: (predictedItem && predictedItem.name) || (actualItem && actualItem.name) || "Material",
        material: (predictedItem && predictedItem.name) || (actualItem && actualItem.name) || "Material",
        unit: (predictedItem && predictedItem.unit) || (actualItem && actualItem.unit) || "un",
        estimated: estimated,
        predicted: estimated,
        registered: registered,
        actual: registered,
        difference: difference,
        differencePercent: differencePercent,
        status: classifyStockAiConsumptionStatus_(estimated, registered, differencePercent)
      };
    }).sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function classifyStockAiConsumptionStatus_(estimated, registered, differencePercent) {
    if (estimated <= 0 && registered > 0) {
      return "sem previsão";
    }

    if (estimated > 0 && registered <= 0) {
      return "sem consumo real";
    }

    if (differencePercent < -25) {
      return "abaixo do previsto";
    }

    if (Math.abs(differencePercent) <= 10) {
      return "dentro do previsto";
    }

    if (differencePercent > 25) {
      return "crítico";
    }

    return "atenção";
  }

  function renderEstimatePanel_() {
    if (!dailyLogEstimatePanel) {
      return;
    }

    const items = dailyLogEstimateDraft.items || [];
    const missing = dailyLogEstimateDraft.missing || [];
    const purchasePlan = dailyLogEstimateDraft.purchasePlan || null;

    dailyLogEstimatePanel.innerHTML = "";
    if (!items.length && !missing.length && !(purchasePlan && purchasePlan.items && purchasePlan.items.length)) {
      dailyLogEstimatePanel.className = "estimate-panel is-hidden";
      return;
    }

    dailyLogEstimatePanel.className = "estimate-panel";
    dailyLogEstimatePanel.appendChild(createEstimateTitle_("Consumo estimado"));
    dailyLogEstimatePanel.appendChild(createEstimateWarning_());

    if (items.length) {
      const list = document.createElement("div");
      list.className = dailyLogEstimateDraft.editable ? "estimate-edit-list" : "diary-item-list";

      items.forEach(function (item, index) {
        if (dailyLogEstimateDraft.editable) {
          list.appendChild(createEstimateEditRow_(item, index));
        } else {
          list.appendChild(createDiaryListItem_(
            item.name,
            formatQuantity_(item.quantity) + " " + item.unit,
            item.note,
            []
          ));
        }
      });

      dailyLogEstimatePanel.appendChild(list);
      dailyLogEstimatePanel.appendChild(createEstimateTitle_("Auditoria simples"));
      dailyLogEstimatePanel.appendChild(createEstimateAuditList_(dailyLogEstimateDraft.audit || []));
      dailyLogEstimatePanel.appendChild(createEstimateTitle_("Planejamento de compra"));
      dailyLogEstimatePanel.appendChild(createStockAiPurchasePlanList_(purchasePlan));
    }

    if (missing.length) {
      const missingNote = document.createElement("p");
      missingNote.className = "estimate-warning";
      missingNote.textContent = "Sem composição para: " + missing.map(function (production) {
        return production.service;
      }).join(", ") + ".";
      dailyLogEstimatePanel.appendChild(missingNote);
    }

    const actions = document.createElement("div");
    actions.className = "button-row";
    actions.appendChild(createEstimateActionButton_("Aplicar ao diário", "apply", "next-action compact"));
    actions.appendChild(createEstimateActionButton_("Editar antes de aplicar", "edit", "secondary-action compact"));
    actions.appendChild(createEstimateActionButton_("Copiar lista de compras", "copy-purchase-plan", "secondary-action compact"));
    actions.appendChild(createEstimateActionButton_("Cancelar", "cancel", "mini-button danger"));
    dailyLogEstimatePanel.appendChild(actions);
  }

  function createEstimateTitle_(text) {
    const title = document.createElement("h5");
    title.textContent = text;
    return title;
  }

  function createEstimateWarning_() {
    const warning = document.createElement("p");
    warning.className = "estimate-warning";
    warning.textContent = STOCK_AI_DEMO_COMPOSITION_WARNING;
    return warning;
  }

  function createEstimateEditRow_(item, index) {
    const row = document.createElement("div");
    row.className = "inline-editor-grid estimate-edit-grid";

    row.appendChild(createEstimateInput_("estimateName", "Material", item.name, index, "text"));
    row.appendChild(createEstimateInput_("estimateQuantity", "Quantidade", item.quantity, index, "number"));
    row.appendChild(createEstimateInput_("estimateUnit", "Unidade", item.unit, index, "text"));
    row.appendChild(createEstimateInput_("estimateNote", "Observação", item.note, index, "text"));
    return row;
  }

  function createEstimateInput_(name, label, value, index, type) {
    const wrapper = document.createElement("label");
    const caption = document.createElement("span");
    const input = document.createElement("input");

    caption.textContent = label;
    input.name = name;
    input.value = value || "";
    input.type = type;
    input.dataset.estimateIndex = index;
    if (type === "number") {
      input.min = "0";
      input.step = "0.10";
    }

    wrapper.appendChild(caption);
    wrapper.appendChild(input);
    return wrapper;
  }

  function createEstimateAuditList_(auditItems) {
    const list = document.createElement("div");
    list.className = "diary-item-list";

    if (!auditItems.length) {
      list.className = "diary-item-list empty-list";
      list.textContent = "Nenhum item para comparar.";
      return list;
    }

    auditItems.forEach(function (item) {
      list.appendChild(createDiaryListItem_(
        item.name,
        "Estimado: " + formatQuantity_(item.estimated) + " " + item.unit +
          " · Registrado: " + formatQuantity_(item.registered) + " " + item.unit +
          " · " + formatAuditDifference_(item) +
          " · Status: " + formatStockAiConsumptionStatus_(item.status),
        "",
        []
      ));
    });

    return list;
  }

  function createStockAiPurchasePlanList_(purchasePlan) {
    const wrapper = document.createElement("div");
    const list = document.createElement("div");
    const summary = purchasePlan && purchasePlan.summary ? purchasePlan.summary : null;
    wrapper.className = "diary-item-list";

    if (!purchasePlan || !purchasePlan.items || !purchasePlan.items.length) {
      wrapper.className = "diary-item-list empty-list";
      wrapper.textContent = "Nenhum material previsto para planejar compra.";
      return wrapper;
    }

    const summaryText = document.createElement("p");
    summaryText.className = "estimate-warning";
    summaryText.textContent = "Previstos: " + summary.totalPredicted +
      " · Suficientes: " + summary.sufficient +
      " · Comprar: " + summary.toBuy +
      " · Críticos: " + summary.critical +
      " · Sem item: " + summary.notFound + ".";
    wrapper.appendChild(summaryText);

    list.className = "diary-item-list";
    purchasePlan.items.forEach(function (item) {
      list.appendChild(createDiaryListItem_(
        item.materialName,
        "Previsto: " + formatQuantity_(item.predictedQuantity) + " " + item.unit +
          " · Saldo: " + formatQuantity_(item.currentBalance) + " " + item.unit +
          " · Comprar: " + formatQuantity_(item.purchaseQuantity) + " " + item.unit +
          " · Status: " + item.status,
        item.note,
        []
      ));
    });

    wrapper.appendChild(list);
    const warning = document.createElement("p");
    warning.className = "estimate-warning";
    warning.textContent = purchasePlan.warning;
    wrapper.appendChild(warning);
    return wrapper;
  }

  function createEstimateActionButton_(label, action, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.dataset.estimateAction = action;
    return button;
  }

  function handleEstimateAction_(button) {
    const action = button.dataset.estimateAction;

    if (action === "cancel") {
      clearDailyLogEstimate_();
      setDailyLogStatus_("Estimativa cancelada. Nenhum material foi alterado.", "info");
      return;
    }

    if (action === "edit") {
      dailyLogEstimateDraft.editable = true;
      renderEstimatePanel_();
      setDailyLogStatus_("Ajuste os materiais estimados antes de aplicar ao diário.", "info");
      return;
    }

    if (action === "copy-purchase-plan") {
      copyStockAiPurchasePlanText_();
      return;
    }

    if (action === "apply") {
      applyEstimatedMaterialsToDailyLog_();
    }
  }

  function copyStockAiPurchasePlanText_() {
    const purchasePlan = dailyLogEstimateDraft.purchasePlan;
    if (!purchasePlan || !purchasePlan.items || !purchasePlan.items.length) {
      setDailyLogStatus_("Nenhuma lista de compra gerada para copiar.", "error");
      return;
    }

    const copied = copyTextFallback_(buildStockAiPurchasePlanText_(purchasePlan));
    setDailyLogStatus_(copied ? "Lista de compras copiada." : "Não foi possível copiar automaticamente.", copied ? "success" : "error");
  }

  function buildStockAiPurchasePlanText_(purchasePlan) {
    const summary = purchasePlan && purchasePlan.summary ? purchasePlan.summary : {};
    const lines = [
      "Stock AI Obras - Planejamento de compra",
      "",
      "Resumo: " + (summary.totalPredicted || 0) + " material(is) previsto(s), " +
        (summary.toBuy || 0) + " para comprar, " +
        (summary.critical || 0) + " crítico(s), " +
        (summary.notFound || 0) + " sem item no estoque.",
      "",
      "Itens:"
    ];

    (purchasePlan.items || []).forEach(function (item) {
      lines.push("- " + item.materialName + ": previsto " + formatQuantity_(item.predictedQuantity) + " " + item.unit +
        ", saldo " + formatQuantity_(item.currentBalance) + " " + item.unit +
        ", comprar " + formatQuantity_(item.purchaseQuantity) + " " + item.unit +
        " (" + item.status + ").");
    });

    lines.push("");
    lines.push(purchasePlan.warning || "Lista de compra gerada a partir de saldo local. Validar antes de compra oficial.");
    return lines.join("\n");
  }

  function applyEstimatedMaterialsToDailyLog_() {
    const items = dailyLogEstimateDraft.editable ? collectEstimatedItemsFromPanel_() : cloneDailyLogItems_(dailyLogEstimateDraft.items);

    if (!items.length) {
      setDailyLogStatus_("Nenhum material estimado para aplicar.", "error");
      return;
    }

    items.forEach(function (item) {
      dailyLogDraft.materials.push({
        id: createId_("mat"),
        name: item.name,
        quantity: roundQuantity_(item.quantity),
        unit: item.unit || "un",
        unitValue: 0,
        totalValue: 0,
        note: item.note || "Consumo calculado por composição estimada. Revise antes de aplicar."
      });
    });

    clearDailyLogEstimate_();
    renderDailyLogDraftLists_();
    setDailyLogStatus_("Materiais estimados aplicados ao diário. Revise e salve o registro.", "success");
  }

  function collectEstimatedItemsFromPanel_() {
    if (!dailyLogEstimatePanel) {
      return [];
    }

    return (dailyLogEstimateDraft.items || []).map(function (item, index) {
      const name = dailyLogEstimatePanel.querySelector("[name='estimateName'][data-estimate-index='" + index + "']");
      const quantity = dailyLogEstimatePanel.querySelector("[name='estimateQuantity'][data-estimate-index='" + index + "']");
      const unit = dailyLogEstimatePanel.querySelector("[name='estimateUnit'][data-estimate-index='" + index + "']");
      const note = dailyLogEstimatePanel.querySelector("[name='estimateNote'][data-estimate-index='" + index + "']");

      return {
        name: clean(name && name.value) || item.name,
        quantity: parseNumber_(quantity && quantity.value),
        unit: clean(unit && unit.value) || item.unit || "un",
        note: clean(note && note.value) || item.note
      };
    }).filter(function (item) {
      return item.name && item.quantity > 0;
    });
  }

  function normalizeCompositionKey_(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function normalizeUnitKey_(value) {
    return normalizeCompositionKey_(value);
  }

  function roundQuantity_(value) {
    return Math.round(Number(value || 0) * 1000) / 1000;
  }

  function formatSignedQuantity_(value) {
    const number = Number(value || 0);
    return (number > 0 ? "+" : "") + formatQuantity_(number);
  }

  function formatAuditDifference_(item) {
    const difference = Number(item && item.difference || 0);
    const unit = item && item.unit ? " " + item.unit : "";
    const percent = Number(item && item.differencePercent || 0);
    const percentText = item && Number.isFinite(percent) && percent !== 0 ? " (" + formatSignedQuantity_(percent) + "%)" : "";

    if (difference < 0) {
      return "Falta registrar: " + formatQuantity_(Math.abs(difference)) + unit + percentText;
    }

    if (difference > 0) {
      return "Excedente registrado: " + formatQuantity_(difference) + unit + percentText;
    }

    return "Sem diferença";
  }

  function formatStockAiConsumptionStatus_(status) {
    const normalized = clean(status).toLowerCase();
    if (normalized === "critico") {
      return "crítico";
    }
    return normalized || "dentro do previsto";
  }

  function renderDailyLogWorkOptions_(works) {
    if (!dailyLogWorkSelect) {
      return;
    }

    const previous = dailyLogWorkSelect.value || (appState.local && appState.local.lastWorkId) || "";
    dailyLogWorkSelect.innerHTML = "";
    dailyLogWorkSelect.appendChild(createOption_("", works.length ? "Escolher obra" : "Cadastre uma obra primeiro"));

    works.forEach(function (work) {
      dailyLogWorkSelect.appendChild(createOption_(work.id, work.name));
    });

    if (works.some(function (work) { return work.id === previous; })) {
      dailyLogWorkSelect.value = previous;
    }
  }

  function renderDailyLogModule_(dailyLogs) {
    renderDailyLogDraftLists_();
    renderCompositionModule_();
    renderDailyLogRecords_(dailyLogs);
    renderDailyLogAudit_(dailyLogs);
    renderDailyLogIndicators_(dailyLogs);

    if (dailyLogStatus) {
      const syncLabel = appState.session && appState.session.token
        ? "com cache local e sincronização na nuvem"
        : "salvos neste navegador";
      dailyLogStatus.textContent = dailyLogs.length
        ? dailyLogs.length + " diário(s) " + syncLabel
        : "Diários " + syncLabel;
    }
  }

  function saveDailyLogFromForm_() {
    if (!currentUser || !dailyLogForm) {
      return;
    }

    const logItem = collectDailyLogForm_();

    if (!logItem.workId || !logItem.date || !logItem.responsible) {
      setDailyLogStatus_("Informe obra, data e responsável pelo registro.", "error");
      return;
    }

    ensureLocalState_(appState);
    const existingIndex = appState.dailyLogs.findIndex(function (item) {
      return item.id === logItem.id;
    });

    if (existingIndex >= 0) {
      logItem.createdAt = appState.dailyLogs[existingIndex].createdAt || logItem.createdAt;
      appState.dailyLogs[existingIndex] = logItem;
    } else {
      appState.dailyLogs.push(logItem);
    }

    const work = findWork_(logItem.workId);
    setLastOpened_("diario", work ? work.clientId : "", logItem.workId, "");
    saveLocalData({ syncCloud: true });
    renderSaasState_();
    resetDailyLogForm_();
    setDailyLogStatus_("Diário salvo localmente e enviado para sincronização.", "success");
  }

  function collectDailyLogForm_() {
    const formData = new FormData(dailyLogForm);
    const id = clean(formData.get("dailyLogId")) || createId_("dia");
    const now = new Date().toISOString();
    const existingDailyLog = findDailyLog_(id);

    return {
      id: id,
      userId: currentUser.id,
      workId: clean(formData.get("workId")),
      date: clean(formData.get("date")),
      responsible: clean(formData.get("responsible")),
      weather: clean(formData.get("weather")) || "Sol",
      impact: clean(formData.get("impact")) || "Sem impacto",
      impactNote: clean(formData.get("impactNote")),
      startTime: clean(formData.get("startTime")),
      endTime: clean(formData.get("endTime")),
      teamPresent: clean(formData.get("teamPresent")),
      employeeCount: clean(formData.get("employeeCount")),
      teamNotes: clean(formData.get("teamNotes")),
      services: clean(formData.get("services")),
      progress: clean(formData.get("progress")),
      interferences: clean(formData.get("interferences")),
      visits: clean(formData.get("visits")),
      productions: cloneDailyLogItems_(dailyLogDraft.productions),
      materials: cloneDailyLogItems_(dailyLogDraft.materials),
      materialRequests: mergeRdoMaterialRequests_(
        Array.isArray(existingDailyLog && existingDailyLog.materialRequests) ? existingDailyLog.materialRequests : [],
        Array.isArray(currentDailyLogMaterialRequests_) ? currentDailyLogMaterialRequests_ : []
      ),
      tools: cloneDailyLogItems_(dailyLogDraft.tools),
      safety: {
        occurrence: clean(formData.get("safetyOccurrence")) || "Nenhuma ocorrência",
        description: clean(formData.get("safetyDescription")),
        actions: clean(formData.get("safetyActions")),
        responsible: clean(formData.get("safetyResponsible"))
      },
      occurrences: clean(formData.get("occurrences")),
      stoppedEquipment: clean(formData.get("stoppedEquipment")),
      generalNotes: clean(formData.get("generalNotes")),
      photos: cloneDailyLogItems_(dailyLogDraft.photos),
      summary: clean(formData.get("summary")),
      createdAt: now,
      updatedAt: now
    };
  }

  function cloneDailyLogItems_(items) {
    return JSON.parse(JSON.stringify(items || []));
  }

  function resetDailyLogForm_() {
    if (!dailyLogForm) {
      return;
    }

    dailyLogForm.reset();
    dailyLogForm.elements.dailyLogId.value = "";
    dailyLogDraft = createEmptyDailyLogDraft_();
    currentDailyLogMaterialRequests_ = [];
    clearDailyLogEstimate_();

    if (dailyLogForm.elements.date) {
      dailyLogForm.elements.date.value = new Date().toISOString().slice(0, 10);
    }

    if (dailyLogForm.elements.responsible && currentUser) {
      dailyLogForm.elements.responsible.value = currentUser.name || "";
    }

    if (dailyLogForm.elements.materialRequestRequestedBy && currentUser) {
      dailyLogForm.elements.materialRequestRequestedBy.value = currentUser.name || "";
    }

    if (dailyLogWorkSelect && appState.local && appState.local.lastWorkId) {
      dailyLogWorkSelect.value = appState.local.lastWorkId;
    }

    if (dailyLogAddProductionButton) {
      dailyLogAddProductionButton.textContent = "Adicionar produção";
    }

    if (dailyLogAddMaterialButton) {
      dailyLogAddMaterialButton.textContent = "Adicionar material";
    }

    if (dailyLogAddToolButton) {
      dailyLogAddToolButton.textContent = "Adicionar equipamento";
    }

    renderDailyLogDraftLists_();
  }

  function loadDailyLogIntoForm_(dailyLogId) {
    const logItem = findDailyLog_(dailyLogId);

    if (!logItem || !dailyLogForm) {
      return;
    }

    dailyLogForm.reset();
    dailyLogForm.elements.dailyLogId.value = logItem.id;
    setDailyLogField_("workId", logItem.workId);
    setDailyLogField_("date", logItem.date);
    setDailyLogField_("responsible", logItem.responsible);
    setDailyLogField_("weather", logItem.weather);
    setDailyLogField_("impact", logItem.impact);
    setDailyLogField_("impactNote", logItem.impactNote);
    setDailyLogField_("startTime", logItem.startTime);
    setDailyLogField_("endTime", logItem.endTime);
    setDailyLogField_("teamPresent", logItem.teamPresent);
    setDailyLogField_("employeeCount", logItem.employeeCount);
    setDailyLogField_("teamNotes", logItem.teamNotes);
    setDailyLogField_("services", logItem.services);
    setDailyLogField_("progress", logItem.progress);
    setDailyLogField_("interferences", logItem.interferences);
    setDailyLogField_("visits", logItem.visits);
    setDailyLogField_("safetyOccurrence", logItem.safety && logItem.safety.occurrence);
    setDailyLogField_("safetyDescription", logItem.safety && logItem.safety.description);
    setDailyLogField_("safetyActions", logItem.safety && logItem.safety.actions);
    setDailyLogField_("safetyResponsible", logItem.safety && logItem.safety.responsible);
    setDailyLogField_("occurrences", logItem.occurrences);
    setDailyLogField_("stoppedEquipment", logItem.stoppedEquipment);
    setDailyLogField_("generalNotes", logItem.generalNotes);
    setDailyLogField_("summary", logItem.summary);

    dailyLogDraft = createEmptyDailyLogDraft_();
    dailyLogDraft.productions = cloneDailyLogItems_(logItem.productions);
    dailyLogDraft.materials = cloneDailyLogItems_(logItem.materials);
    dailyLogDraft.tools = cloneDailyLogItems_(logItem.tools);
    dailyLogDraft.photos = cloneDailyLogItems_(logItem.photos);
    currentDailyLogMaterialRequests_ = cloneDailyLogItems_(logItem.materialRequests);
    clearDailyLogEstimate_();
    renderDailyLogDraftLists_();
    setDailyLogStatus_("Diário carregado para edição.", "info");
    dailyLogForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setDailyLogField_(name, value) {
    if (dailyLogForm && dailyLogForm.elements[name]) {
      dailyLogForm.elements[name].value = value || "";
    }
  }

  function syncProductionSummaryToServicesField_() {
    if (!dailyLogForm || !dailyLogForm.elements.services) {
      return;
    }

    const servicesField = dailyLogForm.elements.services;
    const currentText = String(servicesField.value || "").trim();
    const productionSummary = formatProductionCollection_(dailyLogDraft.productions);
    const marker = "Produção executada:";
    const markerPattern = /(?:^|\n)Produção executada:[^\n]*(?:\n|$)/i;

    if (!productionSummary) {
      servicesField.value = currentText.replace(markerPattern, "\n").trim();
      servicesField.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    const nextLine = marker + " " + productionSummary + ".";
    servicesField.value = markerPattern.test(currentText)
      ? currentText.replace(markerPattern, "\n" + nextLine + "\n").trim()
      : [currentText, nextLine].filter(Boolean).join("\n");
    servicesField.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function addDailyLogProduction_() {
    if (!dailyLogForm) {
      return;
    }

    const service = clean(dailyLogForm.elements.productionService && dailyLogForm.elements.productionService.value) || "Outro";
    const quantity = parseNumber_(dailyLogForm.elements.productionQuantity && dailyLogForm.elements.productionQuantity.value);
    const unit = clean(dailyLogForm.elements.productionUnit && dailyLogForm.elements.productionUnit.value) || "m²";
    const note = clean(dailyLogForm.elements.productionNote && dailyLogForm.elements.productionNote.value);

    if (!service || quantity <= 0) {
      setDailyLogStatus_("Informe o serviço produzido e uma quantidade válida.", "error");
      return;
    }

    const item = {
      id: dailyLogDraft.editingProductionId || createId_("prd"),
      service: service,
      quantity: quantity,
      unit: unit,
      note: note
    };
    const existingIndex = dailyLogDraft.productions.findIndex(function (production) {
      return production.id === item.id;
    });

    if (existingIndex >= 0) {
      dailyLogDraft.productions[existingIndex] = item;
    } else {
      dailyLogDraft.productions.push(item);
    }

    dailyLogDraft.editingProductionId = "";
    dailyLogForm.elements.productionService.value = "Alvenaria";
    dailyLogForm.elements.productionQuantity.value = "";
    dailyLogForm.elements.productionUnit.value = "m²";
    dailyLogForm.elements.productionNote.value = "";
    if (dailyLogAddProductionButton) {
      dailyLogAddProductionButton.textContent = "Adicionar produção";
    }
    clearDailyLogEstimate_();
    syncProductionSummaryToServicesField_();
    renderDailyLogDraftLists_();
    setDailyLogStatus_("Produção adicionada ao diário.", "success");
  }

  function addDailyLogMaterial_() {
    if (!dailyLogForm) {
      return;
    }

    const name = clean(dailyLogForm.elements.materialName && dailyLogForm.elements.materialName.value);
    const quantity = parseNumber_(dailyLogForm.elements.materialQuantity && dailyLogForm.elements.materialQuantity.value);
    const unit = clean(dailyLogForm.elements.materialUnit && dailyLogForm.elements.materialUnit.value) || "un";
    const unitValue = parseNumber_(dailyLogForm.elements.materialUnitValue && dailyLogForm.elements.materialUnitValue.value);
    const note = clean(dailyLogForm.elements.materialNote && dailyLogForm.elements.materialNote.value);

    if (!name || quantity <= 0) {
      setDailyLogStatus_("Informe o material e uma quantidade válida.", "error");
      return;
    }

    const item = {
      id: dailyLogDraft.editingMaterialId || createId_("mat"),
      name: name,
      quantity: quantity,
      unit: unit,
      unitValue: unitValue,
      totalValue: quantity * unitValue,
      note: note
    };
    const existingIndex = dailyLogDraft.materials.findIndex(function (material) {
      return material.id === item.id;
    });

    if (existingIndex >= 0) {
      dailyLogDraft.materials[existingIndex] = item;
    } else {
      dailyLogDraft.materials.push(item);
    }

    dailyLogDraft.editingMaterialId = "";
    dailyLogForm.elements.materialName.value = "";
    dailyLogForm.elements.materialQuantity.value = "";
    dailyLogForm.elements.materialUnit.value = "un";
    dailyLogForm.elements.materialUnitValue.value = "";
    dailyLogForm.elements.materialNote.value = "";
    if (dailyLogAddMaterialButton) {
      dailyLogAddMaterialButton.textContent = "Adicionar material";
    }
    clearDailyLogEstimate_();
    renderDailyLogDraftLists_();
    setDailyLogStatus_("Material adicionado ao diário.", "success");
  }

  function createRdoMaterialRequestDraft_() {
    const now = new Date().toISOString();
    const productionId = clean(dailyLogForm.elements.materialRequestProductionId && dailyLogForm.elements.materialRequestProductionId.value);
    const almoxItemId = clean(dailyLogForm.elements.materialRequestAlmoxItemId && dailyLogForm.elements.materialRequestAlmoxItemId.value);
    const requestedName = clean(dailyLogForm.elements.materialRequestName && dailyLogForm.elements.materialRequestName.value);
    const requestedQuantity = parseNumber_(dailyLogForm.elements.materialRequestQuantity && dailyLogForm.elements.materialRequestQuantity.value);
    const requestedUnit = clean(dailyLogForm.elements.materialRequestUnit && dailyLogForm.elements.materialRequestUnit.value) || "un";
    const requestedBy = clean(dailyLogForm.elements.materialRequestRequestedBy && dailyLogForm.elements.materialRequestRequestedBy.value) ||
      (currentUser && (currentUser.name || currentUser.id)) || "";
    const notes = clean(dailyLogForm.elements.materialRequestNotes && dailyLogForm.elements.materialRequestNotes.value);

    return {
      id: createId_("req"),
      productionId: productionId,
      materialId: "",
      stockItemId: "",
      almoxItemId: almoxItemId,
      requestedName: requestedName,
      requestedQuantity: requestedQuantity,
      requestedUnit: requestedUnit,
      predictedQuantity: null,
      availableQuantity: null,
      approvedQuantity: 0,
      deliveredQuantity: 0,
      status: "pendente",
      decision: "pendente",
      approvalStatus: "",
      requestedBy: requestedBy,
      approvedBy: "",
      approvedAt: "",
      rejectedBy: "",
      rejectedAt: "",
      rejectionReason: "",
      approvalNote: "",
      almoxExitId: "",
      deliveredAt: "",
      deliveredBy: "",
      deliveryStatus: "",
      deliveryNote: "",
      notes: notes,
      createdAt: now,
      updatedAt: now
    };
  }

  function mergeRdoMaterialRequests_(existingRequests, currentRequests) {
    const grouped = {};

    (existingRequests || []).concat(currentRequests || []).forEach(function (request) {
      if (!request || !request.id) {
        return;
      }
      grouped[request.id] = Object.assign({}, request);
    });

    return Object.keys(grouped).map(function (id) {
      return grouped[id];
    }).sort(function (a, b) {
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
  }

  function getRdoProductionOptions_() {
    return (dailyLogDraft.productions || []).map(function (production) {
      return {
        id: production.id,
        label: formatProductionSummary_(production),
        production: production
      };
    });
  }

  function getAlmoxBalanceForMaterialRequest_(request) {
    try {
      if (request.almoxItemId && typeof getAlmoxItemBalance_ === "function") {
        return {
          almoxItemId: request.almoxItemId,
          availableQuantity: roundQuantity_(getAlmoxItemBalance_(request.almoxItemId))
        };
      }

      if (typeof calculateAlmoxBalances_ !== "function") {
        return { almoxItemId: request.almoxItemId || "", availableQuantity: null };
      }

      const requestName = normalizeCompositionKey_(request.requestedName);
      const requestUnit = normalizeUnitKey_(request.requestedUnit || "un");
      const match = calculateAlmoxBalances_().find(function (balance) {
        const item = balance.item || {};
        return normalizeCompositionKey_(item.name) === requestName &&
          normalizeUnitKey_(item.unit || "un") === requestUnit;
      });

      if (!match) {
        return { almoxItemId: request.almoxItemId || "", availableQuantity: null };
      }

      return {
        almoxItemId: match.item.id,
        availableQuantity: roundQuantity_(match.balance)
      };
    } catch (error) {
      console.warn("Nao foi possivel consultar saldo do almoxarifado para a solicitacao.", error);
      return { almoxItemId: request.almoxItemId || "", availableQuantity: null };
    }
  }

  function buildRdoMaterialRequestDecision_(request) {
    const production = (dailyLogDraft.productions || []).find(function (item) {
      return item.id === request.productionId;
    }) || null;
    const predicted = findPredictedMaterialForRdoRequest_(request, production);
    const balance = getAlmoxBalanceForMaterialRequest_(request);
    const requestedQuantity = parseNumber_(request.requestedQuantity);
    const predictedQuantity = predicted ? roundQuantity_(parseNumber_(predicted.quantity || predicted.predictedQuantity || predicted.estimated)) : null;
    const availableQuantity = balance.availableQuantity;
    const missingQuantity = availableQuantity === null ? null : roundQuantity_(Math.max(requestedQuantity - parseNumber_(availableQuantity), 0));
    let status = "pendente";
    let decision = "Informe material e quantidade para analisar.";
    let decisionStatus = "ATENÇÃO";
    let managerMessage = "";

    if (!request.requestedName || requestedQuantity <= 0) {
      status = "pendente";
      decisionStatus = "ATENÇÃO";
    } else if (!balance.almoxItemId) {
      status = "sem_item_almoxarifado";
      decision = "Material sem item correspondente no Almoxarifado.";
      decisionStatus = "CRÍTICO";
    } else if (!request.productionId) {
      status = "aprovacao_recomendada";
      decision = "Solicitacao sem producao vinculada.";
      decisionStatus = "ATENÇÃO";
    } else if (!production) {
      status = "aprovacao_recomendada";
      decision = "Producao vinculada nao encontrada.";
      decisionStatus = "ATENÇÃO";
    } else if (availableQuantity !== null && availableQuantity <= 0) {
      status = "saldo_insuficiente";
      decision = "Saldo indisponivel no almoxarifado.";
      decisionStatus = "CRÍTICO";
    } else if (availableQuantity !== null && availableQuantity < requestedQuantity) {
      status = "saldo_insuficiente";
      decision = "Saldo menor que a quantidade solicitada.";
      decisionStatus = "CRÍTICO";
    } else if (!predicted) {
      status = "aprovacao_recomendada";
      decision = "Sem previsao tecnica do Stock AI para este material. Avaliar pelo saldo e exigir validacao do gestor.";
      decisionStatus = "ATENÇÃO";
    } else if (predictedQuantity > 0 && requestedQuantity > predictedQuantity * 1.15) {
      status = "acima_do_previsto";
      decision = "Pedido mais de 15% acima do previsto pelo Stock AI.";
      decisionStatus = "CRÍTICO";
    } else if (predictedQuantity > 0 && requestedQuantity > predictedQuantity) {
      status = "acima_do_previsto";
      decision = "Pedido acima do previsto pelo Stock AI. Exigir confirmacao do gestor antes da entrega.";
      decisionStatus = "ATENÇÃO";
    } else if (predictedQuantity > 0) {
      status = "coerente";
      decision = "Pedido coerente com a previsao tecnica.";
      decisionStatus = "OK";
    } else {
      status = "aprovacao_recomendada";
      decision = "Sem previsao tecnica suficiente para liberar automaticamente.";
      decisionStatus = "ATENÇÃO";
    }

    managerMessage = buildRdoMaterialRequestManagerMessage_({
      requestedName: request.requestedName,
      requestedQuantity: requestedQuantity,
      requestedUnit: request.requestedUnit || "un",
      predictedQuantity: predictedQuantity,
      availableQuantity: availableQuantity,
      missingQuantity: missingQuantity,
      decisionStatus: decisionStatus,
      reason: decision
    });

    return Object.assign({}, request, {
      almoxItemId: balance.almoxItemId || request.almoxItemId || "",
      predictedQuantity: predictedQuantity,
      availableQuantity: availableQuantity,
      missingQuantity: missingQuantity,
      status: status,
      decision: decision,
      decisionStatus: decisionStatus,
      managerMessage: managerMessage,
      updatedAt: new Date().toISOString()
    });
  }

  function buildRdoMaterialRequestManagerMessage_(data) {
    const info = data || {};
    const unit = clean(info.requestedUnit) || "un";
    const requestedQuantity = parseNumber_(info.requestedQuantity);
    const predictedQuantity = info.predictedQuantity === null || info.predictedQuantity === undefined
      ? null
      : roundQuantity_(parseNumber_(info.predictedQuantity));
    const availableQuantity = info.availableQuantity === null || info.availableQuantity === undefined
      ? null
      : roundQuantity_(parseNumber_(info.availableQuantity));
    const missingQuantity = info.missingQuantity === null || info.missingQuantity === undefined
      ? null
      : roundQuantity_(parseNumber_(info.missingQuantity));
    const status = clean(info.decisionStatus) || "ATENÇÃO";
    const reason = clean(info.reason) || "Solicitacao pendente de conferencia.";
    let action = "Revisar a solicitacao antes da entrega.";

    if (status === "OK") {
      action = "Pode liberar apos confirmacao operacional do responsavel.";
    } else if (status === "CRÍTICO") {
      action = missingQuantity > 0
        ? "Nao liberar agora. Comprar ou transferir material antes da entrega."
        : "Nao liberar automaticamente. Exigir revisao do gestor.";
    } else if (predictedQuantity === null) {
      action = "Validar tecnicamente com o gestor, pois nao ha previsao do Stock AI.";
    } else {
      action = "Exigir confirmacao do gestor antes da entrega.";
    }

    return [
      "Conferencia de material",
      "",
      "Material: " + (clean(info.requestedName) || "Material"),
      "Solicitado: " + formatQuantity_(requestedQuantity) + " " + unit,
      "Previsto pelo Stock AI: " + (predictedQuantity === null ? "sem previsao tecnica" : formatQuantity_(predictedQuantity) + " " + unit),
      "Saldo no Almoxarifado: " + (availableQuantity === null ? "item nao encontrado" : formatQuantity_(availableQuantity) + " " + unit),
      "",
      "Status: " + status,
      "",
      "Motivo:",
      reason + (missingQuantity > 0 ? " Faltam " + formatQuantity_(missingQuantity) + " " + unit + "." : ""),
      "",
      "Acao recomendada:",
      action
    ].join("\n");
  }

  function findPredictedMaterialForRdoRequest_(request, production) {
    if (!production || !request || !request.requestedName) {
      return null;
    }

    const prediction = calculateStockAiPredictedConsumption(production);
    const predictedItems = prediction && Array.isArray(prediction.predictedItems) ? prediction.predictedItems : [];
    const requestName = normalizeCompositionKey_(request.requestedName);
    const requestUnit = normalizeUnitKey_(request.requestedUnit || "un");
    let match = predictedItems.find(function (item) {
      return normalizeCompositionKey_(item.name || item.material) === requestName &&
        normalizeUnitKey_(item.unit || "un") === requestUnit;
    });

    if (!match) {
      match = predictedItems.find(function (item) {
        const itemName = normalizeCompositionKey_(item.name || item.material);
        return itemName.indexOf(requestName) >= 0 || requestName.indexOf(itemName) >= 0;
      });
    }

    if (match || typeof buildEstimatedMaterialsForProductions_ !== "function") {
      return match || null;
    }

    const estimated = buildEstimatedMaterialsForProductions_([production], []);
    return (estimated.items || []).find(function (item) {
      return normalizeCompositionKey_(item.name || item.material) === requestName &&
        normalizeUnitKey_(item.unit || "un") === requestUnit;
    }) || null;
  }

  function addRdoMaterialRequestToState_() {
    if (!dailyLogForm) {
      return;
    }

    const request = buildRdoMaterialRequestDecision_(createRdoMaterialRequestDraft_());
    currentDailyLogMaterialRequests_.push(request);
    dailyLogForm.elements.materialRequestProductionId.value = "";
    dailyLogForm.elements.materialRequestName.value = "";
    dailyLogForm.elements.materialRequestQuantity.value = "";
    dailyLogForm.elements.materialRequestUnit.value = "un";
    dailyLogForm.elements.materialRequestAlmoxItemId.value = "";
    dailyLogForm.elements.materialRequestRequestedBy.value = currentUser && currentUser.name ? currentUser.name : "";
    dailyLogForm.elements.materialRequestNotes.value = "";
    renderDailyLogDraftLists_();
    setDailyLogStatus_("Solicitacao analisada e salva no RDO em modo simulacao.", "success");
  }

  function approveRdoMaterialRequest_(requestId) {
    updateRdoMaterialRequestApproval_(requestId, {
      approvalStatus: "aprovado",
      approvedBy: currentUser && (currentUser.name || currentUser.id) || "Responsavel",
      approvedAt: new Date().toISOString(),
      rejectedBy: "",
      rejectedAt: "",
      rejectionReason: "",
      approvalNote: "Aprovacao leve no RDO. Nao gera saida nem baixa estoque."
    });
    setDailyLogStatus_("Solicitacao aprovada no RDO. Nenhuma saida de estoque foi criada.", "success");
  }

  function rejectRdoMaterialRequest_(requestId) {
    const rawReason = window.prompt("Motivo da rejeicao da solicitacao de material:", "");
    if (rawReason === null) {
      return;
    }

    const reason = clean(rawReason);
    updateRdoMaterialRequestApproval_(requestId, {
      approvalStatus: "rejeitado",
      approvedBy: "",
      approvedAt: "",
      rejectedBy: currentUser && (currentUser.name || currentUser.id) || "Responsavel",
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason || "Rejeitada pelo responsavel.",
      approvalNote: ""
    });
    setDailyLogStatus_("Solicitacao rejeitada no RDO. Nenhuma saida de estoque foi criada.", "info");
  }

  function collectRdoMaterialRequestDeliveryData_(request) {
    const defaultQuantity = request.approvedQuantity > 0 ? request.approvedQuantity : request.requestedQuantity;
    const quantityText = window.prompt("Quantidade entregue:", String(defaultQuantity || ""));
    if (quantityText === null) {
      return null;
    }

    const responsibleText = window.prompt("Responsavel pela entrega:", currentUser && currentUser.name ? currentUser.name : "");
    if (responsibleText === null) {
      return null;
    }

    const recipientText = window.prompt("Destinatario/retirante:", request.requestedBy || "");
    if (recipientText === null) {
      return null;
    }

    const sectorText = window.prompt("Setor/destino:", "Obra");
    if (sectorText === null) {
      return null;
    }

    const purposeText = window.prompt("Finalidade:", "Entrega vinculada ao RDO");
    if (purposeText === null) {
      return null;
    }

    const notesText = window.prompt("Observacao da entrega:", "");
    if (notesText === null) {
      return null;
    }

    return {
      deliveredQuantity: parseNumber_(quantityText),
      responsible: clean(responsibleText),
      recipient: clean(recipientText),
      sector: clean(sectorText),
      purpose: clean(purposeText),
      notes: clean(notesText)
    };
  }

  function confirmRdoMaterialRequestDelivery_(requestId, deliveryData) {
    const request = (currentDailyLogMaterialRequests_ || []).find(function (item) {
      return item && item.id === requestId;
    });

    if (!request) {
      setDailyLogStatus_("Solicitacao nao encontrada para entrega.", "error");
      return { ok: false, message: "Solicitacao nao encontrada." };
    }

    const state = loadAlmoxState_();
    const environmentId = getActiveStockEnvironmentId_();
    const itemExists = (state.items || []).some(function (item) {
      return item.id === request.almoxItemId && clean(item.environmentId) === environmentId;
    });
    const balance = request.almoxItemId && itemExists ? getAlmoxItemBalance_(request.almoxItemId, state) : 0;
    const validation = validateRdoMaterialRequestDelivery_(request, deliveryData, {
      itemExists: itemExists,
      availableQuantity: balance
    });

    if (!validation.ok) {
      setDailyLogStatus_(validation.message, "error");
      return validation;
    }

    if (dailyLogForm && dailyLogForm.elements.dailyLogId && !clean(dailyLogForm.elements.dailyLogId.value)) {
      dailyLogForm.elements.dailyLogId.value = createId_("dia");
    }

    const dailyLogId = dailyLogForm && dailyLogForm.elements.dailyLogId ? clean(dailyLogForm.elements.dailyLogId.value) : "";
    const workId = dailyLogForm && dailyLogForm.elements.workId ? clean(dailyLogForm.elements.workId.value) : "";
    const movement = buildRdoMaterialRequestAlmoxExitMovement_(request, deliveryData, {
      id: createId_("almmov"),
      environmentId: environmentId,
      dailyLogId: dailyLogId,
      workId: workId,
      now: new Date().toISOString(),
      movementDate: dailyLogForm && dailyLogForm.elements.date ? clean(dailyLogForm.elements.date.value) : "",
      movementTime: getDefaultAlmoxMovementTime_()
    });

    state.movements.push(movement);
    saveAlmoxState_(state);
    syncStockDemoRemoteAfterLocalChange_();
    markRdoMaterialRequestAsDelivered_(requestId, movement, deliveryData);
    renderDailyLogDraftLists_();
    renderAlmoxarifadoPanel_();
    setDailyLogStatus_("Entrega confirmada e saida oficial criada no Almoxarifado. Materiais consumidos do RDO nao foram alterados.", "success");

    return {
      ok: true,
      movement: movement
    };
  }

  function validateRdoMaterialRequestDelivery_(request, deliveryData, stockData) {
    const quantity = parseNumber_(deliveryData && deliveryData.deliveredQuantity);
    const settings = stockData || {};

    if (!request) {
      return { ok: false, message: "Solicitacao nao encontrada." };
    }

    if (request.approvalStatus !== "aprovado") {
      return { ok: false, message: "Apenas solicitacoes aprovadas podem ser entregues." };
    }

    if (request.almoxExitId) {
      return { ok: false, message: "Esta solicitacao ja possui entrega confirmada." };
    }

    if (!request.almoxItemId) {
      return { ok: false, message: "Vincule um item do Almoxarifado antes de confirmar a entrega." };
    }

    if (settings.itemExists === false) {
      return { ok: false, message: "Item do Almoxarifado nao encontrado no ambiente ativo." };
    }

    if (quantity <= 0) {
      return { ok: false, message: "Informe uma quantidade entregue maior que zero." };
    }

    if (quantity > parseNumber_(settings.availableQuantity)) {
      return { ok: false, message: "Saldo insuficiente no Almoxarifado para confirmar a entrega." };
    }

    return {
      ok: true,
      deliveredQuantity: quantity
    };
  }

  function buildRdoMaterialRequestAlmoxExitMovement_(request, deliveryData, settings) {
    const data = deliveryData || {};
    const options = settings || {};
    const movementDate = clean(data.movementDate || options.movementDate) || getDefaultAlmoxMovementDate_();
    const movementTime = clean(data.movementTime || options.movementTime) || getDefaultAlmoxMovementTime_();
    const deliveredQuantity = parseNumber_(data.deliveredQuantity);
    const movementId = clean(options.id) || createId_("almmov");

    return {
      id: movementId,
      environmentId: clean(options.environmentId),
      itemId: request.almoxItemId,
      almoxItemId: request.almoxItemId,
      almoxExitId: movementId,
      type: "saida",
      quantity: deliveredQuantity,
      recipient: clean(data.recipient),
      sector: clean(data.sector),
      purpose: clean(data.purpose),
      responsible: clean(data.responsible),
      date: movementDate,
      movementDate: movementDate,
      movementTime: movementTime,
      movementDateTime: buildAlmoxMovementDateTime_(movementDate, movementTime),
      notes: clean(data.notes),
      source: "rdo_material_request",
      dailyLogId: clean(options.dailyLogId),
      materialRequestId: request.id,
      workId: clean(options.workId),
      productionId: clean(request.productionId),
      requestedQuantity: parseNumber_(request.requestedQuantity),
      approvedQuantity: parseNumber_(request.approvedQuantity),
      createdAt: clean(options.now) || new Date().toISOString()
    };
  }

  function getRdoMaterialRequestDeliveryStatus_(request, deliveredQuantity) {
    const delivered = parseNumber_(deliveredQuantity);
    const reference = parseNumber_(request && request.approvedQuantity) > 0
      ? parseNumber_(request.approvedQuantity)
      : parseNumber_(request && request.requestedQuantity);

    return delivered > 0 && reference > 0 && delivered < reference ? "entregue_parcial" : "entregue";
  }

  function markRdoMaterialRequestAsDelivered_(requestId, movement, deliveryData) {
    currentDailyLogMaterialRequests_ = (currentDailyLogMaterialRequests_ || []).map(function (request) {
      if (!request || request.id !== requestId) {
        return request;
      }

      const deliveredQuantity = parseNumber_(movement && movement.quantity);
      return Object.assign({}, request, {
        almoxExitId: movement.id,
        deliveredQuantity: deliveredQuantity,
        deliveredAt: movement.createdAt,
        deliveredBy: clean(deliveryData && deliveryData.responsible),
        deliveryStatus: getRdoMaterialRequestDeliveryStatus_(request, deliveredQuantity),
        deliveryNote: clean(deliveryData && deliveryData.notes),
        updatedAt: new Date().toISOString()
      });
    });
  }

  function getRdoMaterialRequestDeliveryLabel_(request) {
    if (!request || !request.almoxExitId) {
      return "Entrega: pendente";
    }

    const status = request.deliveryStatus === "entregue_parcial" ? "Entrega parcial" : "Entregue";
    return status + " - " + formatQuantity_(request.deliveredQuantity) + " " + (request.requestedUnit || "un") +
      " por " + (request.deliveredBy || "-") +
      (request.deliveredAt ? " em " + formatDateTime_(request.deliveredAt) : "") +
      " - saida " + request.almoxExitId;
  }

  function renderRdoMaterialRequestDeliveryActions_(request) {
    if (!request || request.approvalStatus !== "aprovado" || request.almoxExitId) {
      return [];
    }

    return [
      createDiaryActionButton_("Confirmar entrega", "confirm-material-request-delivery", request.id)
    ];
  }

  function updateRdoMaterialRequestApproval_(requestId, updates) {
    currentDailyLogMaterialRequests_ = (currentDailyLogMaterialRequests_ || []).map(function (request) {
      if (!request || request.id !== requestId) {
        return request;
      }

      return Object.assign({}, request, updates || {}, {
        deliveredQuantity: request.deliveredQuantity || 0,
        updatedAt: new Date().toISOString()
      });
    });
    renderDailyLogDraftLists_();
  }

  function getRdoMaterialRequestApprovalLabel_(request) {
    const status = clean(request && request.approvalStatus);

    if (status === "aprovado") {
      return "Aprovada por " + (request.approvedBy || "-") +
        (request.approvedAt ? " em " + formatDateTime_(request.approvedAt) : "");
    }

    if (status === "rejeitado") {
      return "Rejeitada por " + (request.rejectedBy || "-") +
        (request.rejectedAt ? " em " + formatDateTime_(request.rejectedAt) : "");
    }

    return "Aprovacao: pendente";
  }

  function renderRdoMaterialRequestApprovalActions_(request) {
    const actions = [];
    const approvalStatus = clean(request && request.approvalStatus);

    if (approvalStatus !== "aprovado" && approvalStatus !== "rejeitado") {
      actions.push(createDiaryActionButton_("Aprovar", "approve-material-request", request.id));
      actions.push(createDiaryActionButton_("Rejeitar", "reject-material-request", request.id));
    }

    return actions;
  }

  function buildRdoMaterialRequestApprovalSummary_(request) {
    const approvalLabel = getRdoMaterialRequestApprovalLabel_(request);
    const reason = request && request.rejectionReason ? " Motivo: " + request.rejectionReason + "." : "";
      const note = request && request.approvalNote ? " Observacao: " + request.approvalNote + "." : "";
    return approvalLabel + "." + reason + note;
  }

  function renderRdoMaterialRequestsList_() {
    renderRdoMaterialRequestProductionOptions_();
    renderRdoMaterialRequestAlmoxOptions_();

    if (dailyLogMaterialRequestSummary) {
      if (!currentDailyLogMaterialRequests_.length) {
        dailyLogMaterialRequestSummary.textContent = "Nenhuma solicitacao registrada.";
        dailyLogMaterialRequestSummary.className = "material-summary empty-list";
      } else {
        dailyLogMaterialRequestSummary.className = "material-summary";
        dailyLogMaterialRequestSummary.textContent = buildDailyLogMaterialRequestsAuditText_({
          materialRequests: currentDailyLogMaterialRequests_
        });
      }
    }

    if (!dailyLogMaterialRequestsList) {
      return;
    }

    dailyLogMaterialRequestsList.innerHTML = "";
    if (!currentDailyLogMaterialRequests_.length) {
      dailyLogMaterialRequestsList.className = "diary-item-list empty-list";
      dailyLogMaterialRequestsList.textContent = "Nenhuma solicitacao de material registrada.";
      return;
    }

    dailyLogMaterialRequestsList.className = "diary-item-list";
    currentDailyLogMaterialRequests_.forEach(function (request) {
      const production = (dailyLogDraft.productions || []).find(function (item) {
        return item.id === request.productionId;
      });
      const productionLabel = production ? formatProductionSummary_(production) : "Solicitacao avulsa";
      const detail = [
        "Solicitado: " + formatQuantity_(request.requestedQuantity) + " " + (request.requestedUnit || "un"),
        "Previsto: " + (request.predictedQuantity === null ? "-" : formatQuantity_(request.predictedQuantity) + " " + (request.requestedUnit || "un")),
        "Saldo: " + (request.availableQuantity === null ? "nao consultado" : formatQuantity_(request.availableQuantity) + " " + (request.requestedUnit || "un")),
        "Faltante: " + (request.missingQuantity === null || request.missingQuantity === undefined ? "-" : formatQuantity_(request.missingQuantity) + " " + (request.requestedUnit || "un")),
        "Status: " + (request.decisionStatus || request.status),
        getRdoMaterialRequestApprovalLabel_(request),
        getRdoMaterialRequestDeliveryLabel_(request)
      ].join(" - ");
      const actions = renderRdoMaterialRequestApprovalActions_(request)
        .concat(renderRdoMaterialRequestDeliveryActions_(request))
        .concat([createDiaryActionButton_("Remover", "remove-material-request", request.id)]);

      dailyLogMaterialRequestsList.appendChild(createDiaryListItem_(
        request.requestedName || "Material solicitado",
        productionLabel + " - " + detail,
        [request.managerMessage || request.decision, request.notes, request.rejectionReason, request.deliveryNote].filter(Boolean).join(" "),
        actions
      ));
    });
  }

  function bindRdoMaterialRequestEvents_() {
    if (dailyLogAddMaterialRequestButton) {
      dailyLogAddMaterialRequestButton.addEventListener("click", function () {
        addRdoMaterialRequestToState_();
      });
    }
  }

  function buildDailyLogMaterialRequestsAuditText_(dailyLog) {
    const requests = dailyLog && Array.isArray(dailyLog.materialRequests) ? dailyLog.materialRequests : [];
    if (!requests.length) {
      return "Nenhuma solicitacao de material registrada.";
    }

    const counts = requests.reduce(function (summary, request) {
      const status = request.status || "pendente";
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    const approvalCounts = requests.reduce(function (summary, request) {
      const status = request.approvalStatus || "sem_decisao";
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    const requestLines = requests.map(function (request) {
      return [
        request.requestedName || "Material",
        "solicitado " + formatQuantity_(request.requestedQuantity) + " " + (request.requestedUnit || "un"),
        "previsto " + (request.predictedQuantity === null ? "-" : formatQuantity_(request.predictedQuantity) + " " + (request.requestedUnit || "un")),
        "saldo " + (request.availableQuantity === null ? "nao consultado" : formatQuantity_(request.availableQuantity) + " " + (request.requestedUnit || "un")),
        "status tecnico " + (request.status || "pendente"),
        buildRdoMaterialRequestApprovalSummary_(request),
        getRdoMaterialRequestDeliveryLabel_(request)
      ].join(", ");
    });

    return "Solicitacoes de material do dia: " + requests.length + ". " +
      Object.keys(counts).map(function (status) {
        return status + ": " + counts[status];
      }).join("; ") + ". Aprovacoes: " +
      Object.keys(approvalCounts).map(function (status) {
        return status + ": " + approvalCounts[status];
      }).join("; ") + ". APROVACOES DE SOLICITACOES DE MATERIAL: " + requestLines.join(" | ") + ".";
  }

  function renderRdoMaterialRequestProductionOptions_() {
    if (!dailyLogMaterialRequestProductionSelect) {
      return;
    }

    const selected = dailyLogMaterialRequestProductionSelect.value;
    dailyLogMaterialRequestProductionSelect.innerHTML = "";
    dailyLogMaterialRequestProductionSelect.appendChild(new Option("Solicitacao avulsa", ""));
    getRdoProductionOptions_().forEach(function (option) {
      dailyLogMaterialRequestProductionSelect.appendChild(new Option(option.label, option.id));
    });
    dailyLogMaterialRequestProductionSelect.value = selected;
  }

  function renderRdoMaterialRequestAlmoxOptions_() {
    if (!dailyLogMaterialRequestAlmoxSelect || typeof calculateAlmoxBalances_ !== "function") {
      return;
    }

    const selected = dailyLogMaterialRequestAlmoxSelect.value;
    dailyLogMaterialRequestAlmoxSelect.innerHTML = "";
    dailyLogMaterialRequestAlmoxSelect.appendChild(new Option("Consultar por nome", ""));

    try {
      calculateAlmoxBalances_().forEach(function (balance) {
        const item = balance.item || {};
        dailyLogMaterialRequestAlmoxSelect.appendChild(new Option(
          (item.name || "Item") + " - saldo " + formatQuantity_(balance.balance) + " " + (item.unit || "un"),
          item.id
        ));
      });
    } catch (error) {
      console.warn("Nao foi possivel listar itens do almoxarifado para o RDO.", error);
    }

    dailyLogMaterialRequestAlmoxSelect.value = selected;
  }

  // TODO Fase 2:
  // Confirmar saida oficial no Almoxarifado.
  // Vincular almoxExitId a solicitacao.
  // Atualizar deliveredQuantity e status.
  // Decidir regra anti-duplicidade entre almoxExitId, materials[] e consumo_rdo.
  // Nao fazer isso na Fase 1.

  function addDailyLogTool_() {
    if (!dailyLogForm) {
      return;
    }

    const name = clean(dailyLogForm.elements.toolName && dailyLogForm.elements.toolName.value);
    const status = clean(dailyLogForm.elements.toolStatus && dailyLogForm.elements.toolStatus.value) || "Em uso";
    const note = clean(dailyLogForm.elements.toolNote && dailyLogForm.elements.toolNote.value);

    if (!name) {
      setDailyLogStatus_("Informe o nome da ferramenta ou equipamento.", "error");
      return;
    }

    const item = {
      id: dailyLogDraft.editingToolId || createId_("eqp"),
      name: name,
      status: status,
      note: note
    };
    const existingIndex = dailyLogDraft.tools.findIndex(function (tool) {
      return tool.id === item.id;
    });

    if (existingIndex >= 0) {
      dailyLogDraft.tools[existingIndex] = item;
    } else {
      dailyLogDraft.tools.push(item);
    }

    dailyLogDraft.editingToolId = "";
    dailyLogForm.elements.toolName.value = "";
    dailyLogForm.elements.toolStatus.value = "Em uso";
    dailyLogForm.elements.toolNote.value = "";
    if (dailyLogAddToolButton) {
      dailyLogAddToolButton.textContent = "Adicionar equipamento";
    }
    renderDailyLogDraftLists_();
    setDailyLogStatus_("Equipamento adicionado ao diário.", "success");
  }

  async function addDailyLogPhoto_() {
    if (!dailyLogPhotoInput || !dailyLogForm) {
      return;
    }

    const files = Array.from(dailyLogPhotoInput.files || []);
    const caption = clean(dailyLogForm.elements.dailyPhotoCaption && dailyLogForm.elements.dailyPhotoCaption.value);

    if (!files.length) {
      setDailyLogStatus_("Selecione uma ou mais fotos antes de adicionar ao diário.", "error");
      return;
    }

    if (dailyLogDraft.photos.length + files.length > 30) {
      setDailyLogStatus_("O Diário permite até 30 fotos por registro. Remova fotos ou selecione menos arquivos.", "error");
      return;
    }

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const nextNumber = dailyLogDraft.photos.length + 1;
      const record = await enqueueImageProcessing_(function () {
        return processImageFile_(file, "DIARIO-" + String(nextNumber).padStart(2, "0"));
      });

      dailyLogDraft.photos.push({
        id: createId_("fot"),
        caption: caption || "Foto do dia " + String(nextNumber).padStart(2, "0"),
        previewDataUrl: record.previewDataUrl,
        payload: record.payload,
        updatedAt: record.updatedAt
      });
    }

    dailyLogPhotoInput.value = "";
    dailyLogForm.elements.dailyPhotoCaption.value = "";
    renderDailyLogDraftLists_();
    setDailyLogStatus_(files.length + " foto(s) adicionada(s) ao diário.", "success");
  }

  function handleDailyLogDraftAction_(button) {
    const action = button.dataset.diaryAction;
    const id = button.dataset.itemId;

    if (action === "generate-pdf") {
      try {
        openDailyLogPdf_(collectDailyLogSnapshot_());
      } catch (error) {
        console.error(error);
        setDailyLogStatus_(error.message || "Não foi possível gerar o PDF do diário.", "error");
      }
    } else if (action === "edit-production") {
      editDailyLogProduction_(id);
    } else if (action === "remove-production") {
      dailyLogDraft.productions = dailyLogDraft.productions.filter(function (item) {
        return item.id !== id;
      });
      clearDailyLogEstimate_();
      syncProductionSummaryToServicesField_();
      renderDailyLogDraftLists_();
    } else if (action === "edit-material") {
      editDailyLogMaterial_(id);
    } else if (action === "remove-material") {
      dailyLogDraft.materials = dailyLogDraft.materials.filter(function (item) {
        return item.id !== id;
      });
      clearDailyLogEstimate_();
      renderDailyLogDraftLists_();
    } else if (action === "remove-material-request") {
      currentDailyLogMaterialRequests_ = currentDailyLogMaterialRequests_.filter(function (item) {
        return item.id !== id;
      });
      renderDailyLogDraftLists_();
    } else if (action === "approve-material-request") {
      approveRdoMaterialRequest_(id);
    } else if (action === "reject-material-request") {
      rejectRdoMaterialRequest_(id);
    } else if (action === "confirm-material-request-delivery") {
      const request = (currentDailyLogMaterialRequests_ || []).find(function (item) {
        return item && item.id === id;
      });
      const deliveryData = request ? collectRdoMaterialRequestDeliveryData_(request) : null;
      if (deliveryData) {
        confirmRdoMaterialRequestDelivery_(id, deliveryData);
      }
    } else if (action === "edit-tool") {
      editDailyLogTool_(id);
    } else if (action === "remove-tool") {
      dailyLogDraft.tools = dailyLogDraft.tools.filter(function (item) {
        return item.id !== id;
      });
      renderDailyLogDraftLists_();
    } else if (action === "remove-photo") {
      dailyLogDraft.photos = dailyLogDraft.photos.filter(function (item) {
        return item.id !== id;
      });
      renderDailyLogDraftLists_();
    }
  }

  function editDailyLogProduction_(id) {
    const item = dailyLogDraft.productions.find(function (production) {
      return production.id === id;
    });

    if (!item || !dailyLogForm) {
      return;
    }

    dailyLogDraft.editingProductionId = item.id;
    dailyLogForm.elements.productionService.value = item.service || "Alvenaria";
    dailyLogForm.elements.productionQuantity.value = item.quantity || "";
    dailyLogForm.elements.productionUnit.value = item.unit || "m²";
    dailyLogForm.elements.productionNote.value = item.note || "";
    if (dailyLogAddProductionButton) {
      dailyLogAddProductionButton.textContent = "Atualizar produção";
    }
  }

  function editDailyLogMaterial_(id) {
    const item = dailyLogDraft.materials.find(function (material) {
      return material.id === id;
    });

    if (!item || !dailyLogForm) {
      return;
    }

    dailyLogDraft.editingMaterialId = item.id;
    dailyLogForm.elements.materialName.value = item.name || "";
    dailyLogForm.elements.materialQuantity.value = item.quantity || "";
    dailyLogForm.elements.materialUnit.value = item.unit || "un";
    dailyLogForm.elements.materialUnitValue.value = item.unitValue || "";
    dailyLogForm.elements.materialNote.value = item.note || "";
    if (dailyLogAddMaterialButton) {
      dailyLogAddMaterialButton.textContent = "Atualizar material";
    }
  }

  function editDailyLogTool_(id) {
    const item = dailyLogDraft.tools.find(function (tool) {
      return tool.id === id;
    });

    if (!item || !dailyLogForm) {
      return;
    }

    dailyLogDraft.editingToolId = item.id;
    dailyLogForm.elements.toolName.value = item.name || "";
    dailyLogForm.elements.toolStatus.value = item.status || "Em uso";
    dailyLogForm.elements.toolNote.value = item.note || "";
    if (dailyLogAddToolButton) {
      dailyLogAddToolButton.textContent = "Atualizar equipamento";
    }
  }

  function renderDailyLogDraftLists_() {
    renderDailyLogProductionsDraft_();
    renderRdoMaterialRequestsList_();
    renderDailyLogMaterialsDraft_();
    renderEstimatePanel_();
    renderDailyLogToolsDraft_();
    renderDailyLogPhotosDraft_();
  }

  function renderDailyLogProductionsDraft_() {
    if (dailyLogProductionSummary) {
      if (!dailyLogDraft.productions.length) {
        dailyLogProductionSummary.textContent = "Nenhuma produção registrada.";
        dailyLogProductionSummary.className = "material-summary empty-list";
      } else {
        dailyLogProductionSummary.className = "material-summary";
        dailyLogProductionSummary.textContent = "Produção executada no dia: " + dailyLogDraft.productions.map(formatProductionSummary_).join("; ") + ".";
      }
    }

    if (!dailyLogProductionsList) {
      return;
    }

    dailyLogProductionsList.innerHTML = "";
    if (!dailyLogDraft.productions.length) {
      dailyLogProductionsList.className = "diary-item-list empty-list";
      dailyLogProductionsList.textContent = "Nenhuma produção executada registrada.";
      return;
    }

    dailyLogProductionsList.className = "diary-item-list";
    dailyLogDraft.productions.forEach(function (item) {
      dailyLogProductionsList.appendChild(createDiaryListItem_(
        item.service,
        formatQuantity_(item.quantity) + " " + item.unit,
        item.note,
        [
          createDiaryActionButton_("Editar", "edit-production", item.id),
          createDiaryActionButton_("Remover", "remove-production", item.id)
        ]
      ));
    });
  }

  function renderDailyLogMaterialsDraft_() {
    const total = (dailyLogDraft.materials || []).reduce(function (sum, item) {
      return sum + Number(item.totalValue || 0);
    }, 0);

    if (dailyLogMaterialTotal) {
      dailyLogMaterialTotal.textContent = formatCurrency_(total);
    }

    if (dailyLogMaterialSummary) {
      if (!dailyLogDraft.materials.length) {
        dailyLogMaterialSummary.textContent = "Nenhum material registrado.";
        dailyLogMaterialSummary.className = "material-summary empty-list";
      } else {
        dailyLogMaterialSummary.className = "material-summary";
        dailyLogMaterialSummary.textContent = "Materiais consumidos no dia: " + dailyLogDraft.materials.map(formatMaterialSummary_).join("; ") + ".";
      }
    }

    if (!dailyLogMaterialsList) {
      return;
    }

    dailyLogMaterialsList.innerHTML = "";
    dailyLogDraft.materials.forEach(function (item) {
      dailyLogMaterialsList.appendChild(createDiaryListItem_(
        item.name,
        formatQuantity_(item.quantity) + " " + item.unit + " · Total: " + formatCurrency_(item.totalValue || 0),
        item.note,
        [
          createDiaryActionButton_("Editar", "edit-material", item.id),
          createDiaryActionButton_("Remover", "remove-material", item.id)
        ]
      ));
    });
  }

  function renderDailyLogToolsDraft_() {
    if (!dailyLogToolsList) {
      return;
    }

    dailyLogToolsList.innerHTML = "";
    if (!dailyLogDraft.tools.length) {
      dailyLogToolsList.className = "diary-item-list empty-list";
      dailyLogToolsList.textContent = "Nenhuma ferramenta ou equipamento registrado.";
      return;
    }

    dailyLogToolsList.className = "diary-item-list";
    dailyLogDraft.tools.forEach(function (item) {
      dailyLogToolsList.appendChild(createDiaryListItem_(
        item.name,
        item.status,
        item.note,
        [
          createDiaryActionButton_("Editar", "edit-tool", item.id),
          createDiaryActionButton_("Remover", "remove-tool", item.id)
        ]
      ));
    });
  }

  function renderDailyLogPhotosDraft_() {
    if (!dailyLogPhotosList) {
      return;
    }

    dailyLogPhotosList.innerHTML = "";
    if (!dailyLogDraft.photos.length) {
      dailyLogPhotosList.className = "diary-photo-grid empty-list";
      dailyLogPhotosList.textContent = "Nenhuma foto adicionada ao diário.";
      return;
    }

    dailyLogPhotosList.className = "diary-photo-grid";
    dailyLogDraft.photos.forEach(function (item) {
      const card = document.createElement("article");
      const image = document.createElement("img");
      const caption = document.createElement("span");
      const remove = createDiaryActionButton_("Remover", "remove-photo", item.id);

      card.className = "diary-photo-card";
      image.src = item.previewDataUrl || ("data:image/jpeg;base64," + (item.payload && item.payload.base64 || ""));
      image.alt = item.caption || "Foto do diário";
      caption.textContent = item.caption || "Foto do dia";
      card.appendChild(image);
      card.appendChild(caption);
      card.appendChild(remove);
      dailyLogPhotosList.appendChild(card);
    });
  }

  function createDiaryListItem_(title, detail, note, actions) {
    const item = document.createElement("article");
    const content = document.createElement("div");
    const titleElement = document.createElement("strong");
    const detailElement = document.createElement("span");
    const actionsElement = document.createElement("div");

    item.className = "diary-list-item";
    titleElement.textContent = normalizeDisplayText_(title || "-");
    detailElement.textContent = normalizeDisplayText_(detail || "-");
    actionsElement.className = "entity-actions";

    content.appendChild(titleElement);
    content.appendChild(detailElement);
    if (note) {
      const noteElement = document.createElement("p");
      noteElement.textContent = normalizeDisplayText_(note);
      content.appendChild(noteElement);
    }

    actions.forEach(function (action) {
      actionsElement.appendChild(action);
    });

    item.appendChild(content);
    item.appendChild(actionsElement);
    return item;
  }

  function createDiaryActionButton_(label, action, itemId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action.indexOf("remove") === 0 ? "mini-button danger" : "mini-button";
    button.textContent = label;
    button.dataset.diaryAction = action;
    button.dataset.itemId = itemId;
    return button;
  }

  function renderDailyLogRecords_(dailyLogs) {
    if (!dailyLogRecordsList) {
      return;
    }

    const visibleLogs = filterDailyLogsByProductionSearch_(dailyLogs);

    dailyLogRecordsList.innerHTML = "";
    if (!visibleLogs.length) {
      dailyLogRecordsList.textContent = dailyLogSearchTerm ? "Nenhum diário encontrado para esta produção." : "Nenhum diário registrado.";
      dailyLogRecordsList.className = "entity-list empty-list";
      return;
    }

    dailyLogRecordsList.className = "entity-list";
    visibleLogs.forEach(function (logItem) {
      const work = findWork_(logItem.workId);
      const productionDetail = formatProductionCollection_(logItem.productions);
      const detail = [
        work && work.name,
        formatDateOnly_(logItem.date),
        logItem.weather,
        logItem.impact,
        productionDetail && "Produção: " + productionDetail
      ].filter(Boolean).join(" · ");
      const item = createEntityItem_(
        logItem.summary || logItem.services || productionDetail || "Diário de obras",
        detail,
        [
          createDailyLogRecordButton_("PDF", "pdf", logItem.id, ""),
          createDailyLogRecordButton_("Editar", "edit", logItem.id, "primary"),
          createDailyLogRecordButton_("Remover", "remove", logItem.id, "")
        ]
      );
      dailyLogRecordsList.appendChild(item);
    });
  }

  function createDailyLogRecordButton_(label, action, dailyLogId, kind) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-button" + (kind ? " " + kind : "");
    button.textContent = label;
    button.dataset.dailyLogRecordAction = action;
    button.dataset.dailyLogId = dailyLogId;
    return button;
  }

  function filterDailyLogsByProductionSearch_(dailyLogs) {
    if (!dailyLogSearchTerm) {
      return dailyLogs;
    }

    return dailyLogs.filter(function (logItem) {
      return (logItem.productions || []).some(function (production) {
        return String(production.service || "").toLowerCase().indexOf(dailyLogSearchTerm) >= 0;
      });
    });
  }

  function renderDailyLogAudit_(dailyLogs) {
    if (!dailyLogAuditPanel) {
      return;
    }

    const grouped = {};
    dailyLogs.forEach(function (logItem) {
      (logItem.materials || []).forEach(function (material) {
        const key = [String(material.name || "").toLowerCase(), material.unit || "un"].join("|");
        if (!grouped[key]) {
          grouped[key] = {
            name: material.name,
            unit: material.unit || "un",
            quantity: 0,
            totalValue: 0
          };
        }
        grouped[key].quantity += Number(material.quantity || 0);
        grouped[key].totalValue += Number(material.totalValue || 0);
      });
    });

    const items = Object.keys(grouped).map(function (key) {
      return grouped[key];
    }).sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    dailyLogAuditPanel.innerHTML = "";
    if (!items.length) {
      dailyLogAuditPanel.textContent = "Nenhum consumo registrado.";
      dailyLogAuditPanel.className = "diary-audit empty-list";
      return;
    }

    dailyLogAuditPanel.className = "diary-audit";
    items.forEach(function (item) {
      dailyLogAuditPanel.appendChild(createDiaryListItem_(
        item.name,
        formatQuantity_(item.quantity) + " " + item.unit,
        item.totalValue ? "Custo registrado: " + formatCurrency_(item.totalValue) : "",
        []
      ));
    });
  }

  function renderDailyLogIndicators_(dailyLogs) {
    if (!dailyLogIndicators) {
      return;
    }

    const totalMaterials = dailyLogs.reduce(function (sum, logItem) {
      return sum + (logItem.materials || []).reduce(function (materialSum, material) {
        return materialSum + Number(material.totalValue || 0);
      }, 0);
    }, 0);
    const photos = dailyLogs.reduce(function (sum, logItem) {
      return sum + (logItem.photos || []).length;
    }, 0);
    const safetyOccurrences = dailyLogs.filter(function (logItem) {
      return logItem.safety && logItem.safety.occurrence && logItem.safety.occurrence !== "Nenhuma ocorrência";
    }).length;
    const progressValues = dailyLogs
      .map(function (logItem) { return parseNumber_(logItem.progress); })
      .filter(function (value) { return value > 0; });
    const averageProgress = progressValues.length
      ? Math.round(progressValues.reduce(function (sum, value) { return sum + value; }, 0) / progressValues.length)
      : 0;
    const productionStats = getProductionPeriodStats_(dailyLogs);

    dailyLogIndicators.innerHTML = "";
    dailyLogIndicators.appendChild(createIndicatorItem_("Diários", dailyLogs.length));
    dailyLogIndicators.appendChild(createIndicatorItem_("Produção do dia", productionStats.day + " item(ns)"));
    dailyLogIndicators.appendChild(createIndicatorItem_("Produção da semana", productionStats.week + " item(ns)"));
    dailyLogIndicators.appendChild(createIndicatorItem_("Produção do mês", productionStats.month + " item(ns)"));
    dailyLogIndicators.appendChild(createIndicatorItem_("Materiais", formatCurrency_(totalMaterials)));
    dailyLogIndicators.appendChild(createIndicatorItem_("Fotos", photos));
    dailyLogIndicators.appendChild(createIndicatorItem_("Segurança", safetyOccurrences));
    dailyLogIndicators.appendChild(createIndicatorItem_("Avanço médio", averageProgress ? averageProgress + "%" : "-"));
  }

  function normalizeStockMaterialKey_(name, unit) {
    return normalizeCompositionKey_(name) + "|" + normalizeUnitKey_(unit || "un");
  }

  function buildStockMovementsFromDailyLogs_(dailyLogs) {
    const movements = [];

    (dailyLogs || []).forEach(function (logItem) {
      const workName = getWorkName_(logItem.workId) || "Obra nao informada";

      (logItem.materials || []).forEach(function (material) {
        const name = clean(material.name);
        const quantity = parseNumber_(material.quantity);

        if (!name || quantity <= 0) {
          return;
        }

        const unit = clean(material.unit) || "un";
        const unitValue = parseNumber_(material.unitValue);
        const totalValue = parseNumber_(material.totalValue) || quantity * unitValue;

        movements.push({
          id: createId_("stk_mov"),
          type: "consumo_rdo",
          source: "rdo",
          dailyLogId: logItem.id,
          workId: logItem.workId,
          workName: workName,
          date: logItem.date,
          materialId: material.id,
          name: name,
          key: normalizeStockMaterialKey_(name, unit),
          quantity: quantity,
          unit: unit,
          unitValue: unitValue,
          totalValue: totalValue,
          note: clean(material.note)
        });
      });
    });

    return movements.sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }

  function buildStockBalanceFromMovements_(movements) {
    const grouped = {};

    (movements || []).forEach(function (movement) {
      if (!grouped[movement.key]) {
        grouped[movement.key] = {
          key: movement.key,
          name: movement.name,
          unit: movement.unit,
          totalQuantity: 0,
          totalCost: 0,
          dailyLogIds: [],
          workNames: [],
          lastDate: "",
          movements: 0
        };
      }

      const balance = grouped[movement.key];
      balance.totalQuantity += movement.quantity;
      balance.totalCost += movement.totalValue;
      balance.movements += 1;

      if (movement.dailyLogId && balance.dailyLogIds.indexOf(movement.dailyLogId) < 0) {
        balance.dailyLogIds.push(movement.dailyLogId);
      }

      if (movement.workName && balance.workNames.indexOf(movement.workName) < 0) {
        balance.workNames.push(movement.workName);
      }

      if (!balance.lastDate || String(movement.date || "").localeCompare(balance.lastDate) > 0) {
        balance.lastDate = movement.date || "";
      }
    });

    return Object.keys(grouped).map(function (key) {
      const item = grouped[key];
      item.totalQuantity = roundQuantity_(item.totalQuantity);
      return item;
    }).sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function buildStockSummaryFromBalances_(balances, movements) {
    const dailyLogIds = [];
    const totalCost = (balances || []).reduce(function (sum, balance) {
      (balance.dailyLogIds || []).forEach(function (dailyLogId) {
        if (dailyLogIds.indexOf(dailyLogId) < 0) {
          dailyLogIds.push(dailyLogId);
        }
      });
      return sum + Number(balance.totalCost || 0);
    }, 0);

    return {
      materialCount: (balances || []).length,
      movementCount: (movements || []).length,
      totalCost: totalCost,
      dailyLogCount: dailyLogIds.length
    };
  }

  function buildStockIaInsightFromDailyLogs_(balances, movements) {
    if (!movements.length) {
      return "Ainda nao ha materiais registrados nos RDOs. Quando um diario tiver material consumido, o Stock IA vai mostrar o consumo derivado aqui.";
    }

    const topItems = balances.slice().sort(function (a, b) {
      return Number(b.totalCost || 0) - Number(a.totalCost || 0);
    }).slice(0, 3).map(function (item) {
      return item.name;
    });

    return "Com base nos diarios de obra, foram identificados " + balances.length +
      " material(is) consumido(s) em " + movements.length + " movimento(s) derivados do RDO. " +
      (topItems.length ? "Os principais itens por custo registrado sao: " + topItems.join(", ") + ". " : "") +
      "Esta ainda e uma visao derivada do RDO; para virar estoque real, o proximo passo sera criar entradas e saldo inicial.";
  }

  function appendStockIaCell_(row, text) {
    const cell = document.createElement("td");
    cell.textContent = text || "-";
    row.appendChild(cell);
  }

  function appendStockIaEmptyRow_(tbody, colSpan, text) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = colSpan;
    cell.textContent = text;
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  function appendStockIaEmptyActionRow_(tbody, colSpan, text, actionLabel, action) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    const wrapper = document.createElement("div");
    const message = document.createElement("span");

    cell.colSpan = colSpan;
    wrapper.className = "stock-ia-empty-action";
    message.textContent = text;
    wrapper.appendChild(message);

    if (actionLabel && action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mini-button compact primary";
      button.dataset.stockAction = action;
      button.textContent = actionLabel;
      wrapper.appendChild(button);
    }

    cell.appendChild(wrapper);
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  function loadStockQuickExample_() {
    try {
      const storage = getLocalStorage_();
      const raw = storage ? storage.getItem(STOCK_QUICK_EXAMPLE_STORAGE_KEY) : "";
      const parsed = raw ? JSON.parse(raw) : null;

      if (!parsed || parsed.origem !== "home_demo_stock_ia") {
        return null;
      }

      return {
        servico: clean(parsed.servico) || "Alvenaria",
        quantidadeExecutada: parseNumber_(parsed.quantidadeExecutada) || 12,
        unidadeExecutada: clean(parsed.unidadeExecutada) || "m²",
        material: clean(parsed.material) || "Bloco cerâmico",
        quantidadeMaterial: parseNumber_(parsed.quantidadeMaterial) || 30,
        unidadeMaterial: clean(parsed.unidadeMaterial) || "un",
        observacao: clean(parsed.observacao),
        origem: "home_demo_stock_ia",
        criadoEm: parsed.criadoEm || new Date().toISOString()
      };
    } catch (error) {
      console.warn("Nao foi possivel carregar o exemplo rapido do Stock IA.", error);
      return null;
    }
  }

  function clearStockQuickExample_() {
    try {
      const storage = getLocalStorage_();
      if (storage) {
        storage.removeItem(STOCK_QUICK_EXAMPLE_STORAGE_KEY);
      }
    } catch (error) {
      console.warn("Nao foi possivel descartar o exemplo rapido do Stock IA.", error);
    }
  }

  function loadStockIaMode_() {
    try {
      const storage = getLocalStorage_();
      const value = storage ? storage.getItem(STOCK_MODE_STORAGE_KEY) : "";
      return value === "almoxarifado" ? "almoxarifado" : "obra";
    } catch (error) {
      return "obra";
    }
  }

  function saveStockIaMode_(mode) {
    try {
      const storage = getLocalStorage_();
      if (storage) {
        storage.setItem(STOCK_MODE_STORAGE_KEY, mode === "almoxarifado" ? "almoxarifado" : "obra");
      }
    } catch (error) {
      console.warn("Nao foi possivel salvar o modo do Stock IA.", error);
    }
  }

  function findStockItemForQuickExample_(example) {
    const state = loadStockMasterState_();
    const key = normalizeStockMaterialKey_(example && example.material, example && example.unidadeMaterial);
    return state.items.find(function (item) {
      return normalizeStockMaterialKey_(item.name, item.unit) === key;
    }) || null;
  }

  function buildStockQuickExampleItemData_(example) {
    return {
      name: clean(example && example.material) || "Bloco cerâmico",
      unit: clean(example && example.unidadeMaterial) || "un",
      category: "Demonstração",
      initialBalance: 0,
      minimumStock: parseNumber_(example && example.quantidadeMaterial),
      unitCost: 0,
      workId: null,
      notes: "Criado a partir da demonstração rápida do Stock IA. Serviço: " + (clean(example && example.servico) || "Alvenaria") + " " + formatQuantity_(parseNumber_(example && example.quantidadeExecutada) || 12) + " " + (clean(example && example.unidadeExecutada) || "m²") + "."
    };
  }

  function renderStockQuickExamplePanel_() {
    if (!stockQuickExamplePanel) {
      return;
    }

    const example = loadStockQuickExample_();
    stockQuickExamplePanel.classList.toggle("is-hidden", !example);

    if (!example || !stockQuickExampleText) {
      return;
    }

    stockQuickExampleText.textContent = "Serviço: " + example.servico + " " + formatQuantity_(example.quantidadeExecutada) + " " + example.unidadeExecutada + ". Material: " + example.material + " " + formatQuantity_(example.quantidadeMaterial) + " " + example.unidadeMaterial + ". Escolha uma ação para transformar a demonstração em dado real do Stock IA.";
  }

  function handleStockQuickCreateMaterial_() {
    const example = loadStockQuickExample_();
    if (!example) {
      showStockIaToast_("Nenhum exemplo pendente encontrado.", "info");
      renderStockQuickExamplePanel_();
      return;
    }

    const existingItem = findStockItemForQuickExample_(example);
    if (existingItem) {
      showStockIaToast_("Este material já existe no cadastro mestre.", "info");
      return;
    }

    createStockMasterItem_(buildStockQuickExampleItemData_(example));
    renderStockIaPanel_(getUserDailyLogs_());
    showStockIaToast_("Material criado a partir da demonstração.", "success");
  }

  function handleStockQuickRegisterEntry_() {
    const example = loadStockQuickExample_();
    if (!example) {
      showStockIaToast_("Nenhum exemplo pendente encontrado.", "info");
      renderStockQuickExamplePanel_();
      return;
    }

    let item = findStockItemForQuickExample_(example);
    if (!item) {
      item = createStockMasterItem_(buildStockQuickExampleItemData_(example));
    }

    registerStockEntry_({
      stockItemId: item.id,
      quantity: example.quantidadeMaterial,
      unitCost: 0,
      date: toDateKey_(new Date()),
      workId: null,
      supplier: "Demonstração Stock IA",
      documentNumber: "HOME-DEMO",
      notes: "Entrada criada a partir da demonstração rápida da home. " + (example.observacao || ""),
      source: "manual"
    });
    renderStockIaPanel_(getUserDailyLogs_());
    showStockIaToast_("Entrada registrada a partir da demonstração.", "success");
  }

  function handleStockQuickLinkRdo_() {
    const example = loadStockQuickExample_();
    if (!example) {
      showStockIaToast_("Nenhum exemplo pendente encontrado.", "info");
      renderStockQuickExamplePanel_();
      return;
    }

    showDashboardPanel_("diario");
    if (dailyLogForm) {
      if (dailyLogForm.elements.productionService) {
        dailyLogForm.elements.productionService.value = example.servico;
      }
      if (dailyLogForm.elements.productionQuantity) {
        dailyLogForm.elements.productionQuantity.value = example.quantidadeExecutada || "";
      }
      if (dailyLogForm.elements.productionUnit) {
        dailyLogForm.elements.productionUnit.value = example.unidadeExecutada || "m²";
      }
      if (dailyLogForm.elements.materialName) {
        dailyLogForm.elements.materialName.value = example.material;
      }
      if (dailyLogForm.elements.materialQuantity) {
        dailyLogForm.elements.materialQuantity.value = example.quantidadeMaterial || "";
      }
      if (dailyLogForm.elements.materialUnit) {
        dailyLogForm.elements.materialUnit.value = example.unidadeMaterial || "un";
      }
    }
    setDailyLogStatus_("Exemplo carregado da home. Revise e adicione a produção/material ao RDO para vincular ao Stock IA.", "info");
  }

  function handleStockFirstEntry_() {
    const state = loadStockMasterState_();
    const firstItem = state.items[0];
    if (!firstItem) {
      openStockIaModal_("item", {});
      showStockIaToast_("Cadastre um material antes de registrar uma entrada.", "info");
      return;
    }

    openStockIaModal_("movement", {
      itemId: firstItem.id,
      movementType: "entrada"
    });
  }

  function appendWarehouseGuidedFields_(form) {
    const sectionOne = createStockGuidedSection_("Passo 1 — Cadastrar item", "Cadastre o item de almoxarifado que será controlado.");
    const sectionTwo = createStockGuidedSection_("Passo 2 — Registrar entrada", "Informe a quantidade recebida para formar saldo.");
    const sectionThree = createStockGuidedSection_("Passo 3 — Registrar saída", "Registre para quem saiu, o setor e a finalidade.");
    const gridOne = sectionOne.querySelector(".stock-ia-form-grid");
    const gridTwo = sectionTwo.querySelector(".stock-ia-form-grid");
    const gridThree = sectionThree.querySelector(".stock-ia-form-grid");

    appendStockIaField_(gridOne, "warehouseItemName", "Item", "text", "", true);
    appendStockIaField_(gridOne, "warehouseUnit", "Unidade", "text", "un", true);
    appendStockIaField_(gridOne, "warehouseMinimumStock", "Estoque mínimo", "number", 0, false, "0.001");
    appendStockIaField_(gridOne, "warehouseUnitCost", "Custo unitário opcional", "number", 0, false, "0.01");

    appendStockIaField_(gridTwo, "warehouseEntryQuantity", "Quantidade recebida", "number", 0, true, "0.001");
    appendStockIaField_(gridTwo, "warehouseEntryDate", "Data", "date", toDateKey_(new Date()), true);

    appendStockIaField_(gridThree, "warehouseExitQuantity", "Quantidade entregue", "number", 0, false, "0.001");
    appendStockIaField_(gridThree, "warehouseRecipientName", "Destinatário", "text", "", false);
    appendStockIaField_(gridThree, "warehouseSector", "Setor/obra/unidade", "text", "", false);
    appendStockIaField_(gridThree, "warehousePurpose", "Finalidade", "text", "", false);
    appendStockIaTextarea_(gridThree, "warehouseNotes", "Observação", "");

    form.appendChild(sectionOne);
    form.appendChild(sectionTwo);
    form.appendChild(sectionThree);
  }

  function getGuidedStockExamplePayload_() {
    const example = loadStockQuickExample_();
    if (!example) {
      return {};
    }

    return {
      useQuickExample: true,
      materialName: example.material,
      unit: example.unidadeMaterial,
      entryQuantity: example.quantidadeMaterial,
      serviceContext: example.servico + " " + formatQuantity_(example.quantidadeExecutada) + " " + example.unidadeExecutada,
      exitNotes: "Consumo relacionado a " + example.servico + " " + formatQuantity_(example.quantidadeExecutada) + " " + example.unidadeExecutada + "."
    };
  }

  function appendStockGuidedFields_(form, payload) {
    const safePayload = payload || {};
    const sectionOne = createStockGuidedSection_("Passo 1 — Cadastrar material", "Informe o material que o cliente quer controlar no estoque.");
    const sectionTwo = createStockGuidedSection_("Passo 2 — Registrar entrada", "Registre a quantidade recebida para formar saldo.");
    const sectionThree = createStockGuidedSection_("Passo 3 — Registrar consumo/saída", "Opcional: lance uma baixa para testar saldo, alerta e histórico.");
    const gridOne = sectionOne.querySelector(".stock-ia-form-grid");
    const gridTwo = sectionTwo.querySelector(".stock-ia-form-grid");
    const gridThree = sectionThree.querySelector(".stock-ia-form-grid");

    appendStockIaField_(gridOne, "guidedMaterialName", "Nome do material", "text", safePayload.materialName || "", true);
    appendStockIaField_(gridOne, "guidedUnit", "Unidade", "text", safePayload.unit || "un", true);
    appendStockIaField_(gridOne, "guidedMinimumStock", "Estoque mínimo", "number", safePayload.minimumStock || 0, false, "0.001");
    appendStockIaField_(gridOne, "guidedUnitCost", "Custo unitário opcional", "number", safePayload.unitCost || 0, false, "0.01");
    appendStockWorkSelect_(gridOne, safePayload.workId || "");

    appendStockIaField_(gridTwo, "guidedEntryQuantity", "Quantidade recebida", "number", safePayload.entryQuantity || 0, true, "0.001");
    appendStockIaField_(gridTwo, "guidedSupplier", "Fornecedor opcional", "text", safePayload.supplier || "", false);
    appendStockIaField_(gridTwo, "guidedDocumentNumber", "Nota fiscal opcional", "text", safePayload.documentNumber || "", false);
    appendStockIaField_(gridTwo, "guidedEntryDate", "Data", "date", safePayload.date || toDateKey_(new Date()), true);

    appendStockIaField_(gridThree, "guidedExitQuantity", "Quantidade consumida", "number", safePayload.exitQuantity || 0, false, "0.001");
    appendStockIaField_(gridThree, "guidedServiceContext", "Obra/serviço opcional", "text", safePayload.serviceContext || "", false);
    appendStockIaTextarea_(gridThree, "guidedExitNotes", "Observação", safePayload.exitNotes || "");

    form.appendChild(sectionOne);
    form.appendChild(sectionTwo);
    form.appendChild(sectionThree);
  }

  function createStockGuidedSection_(title, description) {
    const section = document.createElement("section");
    const heading = document.createElement("h4");
    const paragraph = document.createElement("p");
    const grid = document.createElement("div");

    section.className = "stock-guided-section";
    heading.textContent = title;
    paragraph.textContent = description;
    grid.className = "stock-ia-form-grid";
    section.appendChild(heading);
    section.appendChild(paragraph);
    section.appendChild(grid);
    return section;
  }

  function findStockItemByNameUnit_(name, unit) {
    const state = loadStockMasterState_();
    const key = normalizeStockMaterialKey_(name, unit);
    return state.items.find(function (item) {
      return normalizeStockMaterialKey_(item.name, item.unit) === key;
    }) || null;
  }

  function getStockCycleStatus_(balance) {
    const realBalance = parseNumber_(balance && balance.realBalance);
    const minimumStock = parseNumber_(balance && balance.minimumStock);

    if (realBalance <= 0) {
      return "Crítico";
    }

    if (minimumStock > 0 && realBalance < minimumStock) {
      return "Atenção";
    }

    return "OK";
  }

  function handleGuidedStockSubmit_(formData) {
    const name = clean(formData.get("guidedMaterialName"));
    const unit = clean(formData.get("guidedUnit")) || "un";
    const entryQuantity = parseNumber_(formData.get("guidedEntryQuantity"));
    const exitQuantity = parseNumber_(formData.get("guidedExitQuantity"));
    const minimumStock = parseNumber_(formData.get("guidedMinimumStock"));
    const unitCost = parseNumber_(formData.get("guidedUnitCost"));
    const workId = clean(formData.get("workId")) || null;

    if (!name || entryQuantity <= 0) {
      return {
        ok: false,
        message: "Preencha material e quantidade de entrada para concluir o assistente."
      };
    }

    let item = findStockItemByNameUnit_(name, unit);
    if (!item) {
      item = createStockMasterItem_({
        name: name,
        unit: unit,
        category: "Geral",
        initialBalance: 0,
        minimumStock: minimumStock,
        unitCost: unitCost,
        workId: workId,
        notes: "Criado pelo assistente guiado do Stock IA."
      });
    } else {
      updateStockMasterItem_(item.id, {
        name: item.name,
        unit: item.unit,
        category: item.category,
        initialBalance: item.initialBalance,
        minimumStock: minimumStock || item.minimumStock,
        unitCost: unitCost || item.unitCost,
        workId: workId || item.workId,
        notes: item.notes
      });
    }

    if (!item) {
      return {
        ok: false,
        message: "Não foi possível criar o material."
      };
    }

    registerStockEntry_({
      stockItemId: item.id,
      quantity: entryQuantity,
      unitCost: unitCost,
      date: clean(formData.get("guidedEntryDate")) || toDateKey_(new Date()),
      workId: workId,
      supplier: clean(formData.get("guidedSupplier")),
      documentNumber: clean(formData.get("guidedDocumentNumber")),
      notes: "Entrada registrada pelo assistente guiado.",
      source: "manual"
    });

    if (exitQuantity > 0) {
      registerManualStockExit_({
        stockItemId: item.id,
        quantity: exitQuantity,
        unitCost: unitCost,
        date: clean(formData.get("guidedEntryDate")) || toDateKey_(new Date()),
        workId: workId,
        notes: (clean(formData.get("guidedExitNotes")) || "Consumo registrado pelo assistente guiado.") + (clean(formData.get("guidedServiceContext")) ? " Serviço/obra: " + clean(formData.get("guidedServiceContext")) + "." : ""),
        source: "manual"
      });
    }

    const balance = calculateRealStockBalances_().find(function (candidate) {
      return candidate.item.id === item.id;
    });
    const status = getStockCycleStatus_({
      realBalance: balance ? balance.realBalance : 0,
      minimumStock: minimumStock
    });
    const message = "Material cadastrado com sucesso. Entrada registrada. " +
      (exitQuantity > 0 ? "Consumo lançado. " : "Consumo não informado. ") +
      "Saldo atual: " + formatQuantity_(balance ? balance.realBalance : 0) + " " + unit + ". Status: " + status + ".";

    stockIaLastAnswer = message;
    if (stockIaQuestionAnswer) {
      stockIaQuestionAnswer.textContent = message;
    }

    return {
      ok: true,
      message: message
    };
  }

  function handleWarehouseGuidedSubmit_(formData) {
    const name = clean(formData.get("warehouseItemName"));
    const unit = clean(formData.get("warehouseUnit")) || "un";
    const entryQuantity = parseNumber_(formData.get("warehouseEntryQuantity"));
    const exitQuantity = parseNumber_(formData.get("warehouseExitQuantity"));
    const minimumStock = parseNumber_(formData.get("warehouseMinimumStock"));
    const unitCost = parseNumber_(formData.get("warehouseUnitCost"));
    const movementDate = clean(formData.get("warehouseEntryDate")) || toDateKey_(new Date());
    const recipientName = clean(formData.get("warehouseRecipientName"));
    const sector = clean(formData.get("warehouseSector"));
    const purpose = clean(formData.get("warehousePurpose"));
    const notes = clean(formData.get("warehouseNotes"));

    if (!name || entryQuantity <= 0) {
      return {
        ok: false,
        message: "Preencha o item e a quantidade recebida para concluir o almoxarifado."
      };
    }

    let item = findStockItemByNameUnit_(name, unit);
    if (!item) {
      item = createStockMasterItem_({
        name: name,
        unit: unit,
        category: "Almoxarifado",
        initialBalance: 0,
        minimumStock: minimumStock,
        unitCost: unitCost,
        workId: null,
        notes: "Criado no Modo Almoxarifado do Stock IA."
      });
    } else {
      updateStockMasterItem_(item.id, {
        name: item.name,
        unit: item.unit,
        category: item.category || "Almoxarifado",
        initialBalance: item.initialBalance,
        minimumStock: minimumStock || item.minimumStock,
        unitCost: unitCost || item.unitCost,
        workId: item.workId,
        notes: item.notes
      });
    }

    if (!item) {
      return {
        ok: false,
        message: "Não foi possível criar o item de almoxarifado."
      };
    }

    registerStockEntry_({
      stockItemId: item.id,
      quantity: entryQuantity,
      unitCost: unitCost,
      date: movementDate,
      supplier: "Entrada de almoxarifado",
      documentNumber: "",
      notes: "Entrada registrada no Modo Almoxarifado.",
      source: "manual",
      mode: "almoxarifado"
    });

    if (exitQuantity > 0) {
      registerManualStockExit_({
        stockItemId: item.id,
        quantity: exitQuantity,
        unitCost: unitCost,
        date: movementDate,
        notes: notes || "Saída registrada no Modo Almoxarifado.",
        source: "manual",
        mode: "almoxarifado",
        recipientName: recipientName,
        sector: sector,
        purpose: purpose
      });
    }

    const balance = calculateRealStockBalances_().find(function (candidate) {
      return candidate.item.id === item.id;
    });
    const status = getStockCycleStatus_({
      realBalance: balance ? balance.realBalance : 0,
      minimumStock: minimumStock
    });
    const details = [
      recipientName ? "Destinatário: " + recipientName : "",
      sector ? "Setor: " + sector : "",
      purpose ? "Finalidade: " + purpose : ""
    ].filter(Boolean).join(". ");
    const message = "Item de almoxarifado cadastrado. Entrada registrada. " +
      (exitQuantity > 0 ? "Saída registrada. " : "Saída não informada. ") +
      "Saldo atual: " + formatQuantity_(balance ? balance.realBalance : 0) + " " + unit + ". Status: " + status + "." +
      (details ? " " + details + "." : "");

    stockIaLastAnswer = message;
    if (stockIaQuestionAnswer) {
      stockIaQuestionAnswer.textContent = message;
    }

    return {
      ok: true,
      message: message
    };
  }

  function buildStockPlainSummary_() {
    const balances = calculateRealStockBalances_();
    const totalMaterials = balances.length;
    const attentionItems = balances.filter(function (balance) {
      const status = getStockCycleStatus_({
        realBalance: balance.realBalance,
        minimumStock: balance.item.minimumStock
      });
      return status === "Atenção" || status === "Crítico";
    });
    const estimatedTotal = balances.reduce(function (sum, balance) {
      return sum + parseNumber_(balance.estimatedValue);
    }, 0);
    const topAttention = attentionItems[0];
    const itemLabel = stockIaCurrentMode === "almoxarifado" ? "itens cadastrados" : "materiais cadastrados";

    return "Hoje o estoque possui " + totalMaterials + " " + itemLabel + ", " +
      attentionItems.length + " em atenção/crítico e valor estimado de " + formatCurrency_(estimatedTotal) + ". " +
      (stockIaCurrentMode === "almoxarifado" ? "O item" : "O material") + " com maior atenção é " + (topAttention ? topAttention.item.name : "nenhum item crítico no momento") + ".";
  }

  function generateStockPlainSummary_() {
    const summary = buildStockPlainSummary_();
    stockIaLastAnswer = summary;
    if (stockIaQuestionAnswer) {
      stockIaQuestionAnswer.textContent = summary;
    }
    const copied = copyTextFallback_(summary);
    showStockIaToast_(copied ? "Resumo do estoque gerado e copiado." : "Resumo gerado. Copie o texto na resposta do assistente.", copied ? "success" : "info");
  }

  function loadAlmoxState_() {
    try {
      const storage = getLocalStorage_();
      const raw = storage ? storage.getItem(ALMOX_STORAGE_KEY) : "";
      const parsed = raw ? JSON.parse(raw) : {};
      const mutedUntil = clean(parsed.alertsMutedUntil) || (parsed.alertsMuted ? new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString() : "");
      const alertsMuted = Boolean(parsed.alertsMuted) && (!mutedUntil || new Date(mutedUntil).getTime() > Date.now());
      return normalizeAlmoxEnvironmentState_({
        items: Array.isArray(parsed.items) ? parsed.items : [],
        movements: Array.isArray(parsed.movements) ? parsed.movements : [],
        alertsMuted: alertsMuted,
        alertsMutedUntil: alertsMuted ? mutedUntil : "",
        alertHistory: Array.isArray(parsed.alertHistory) ? parsed.alertHistory : [],
        approvalRequests: Array.isArray(parsed.approvalRequests) ? parsed.approvalRequests : [],
        stockEnvironments: Array.isArray(parsed.stockEnvironments) ? parsed.stockEnvironments : [],
        activeStockEnvironmentId: clean(parsed.activeStockEnvironmentId),
        updatedAt: parsed.updatedAt || new Date().toISOString()
      });
    } catch (error) {
      console.warn("Nao foi possivel carregar o almoxarifado.", error);
      return normalizeAlmoxEnvironmentState_({
        items: [],
        movements: [],
        alertsMuted: false,
        alertsMutedUntil: "",
        alertHistory: [],
        approvalRequests: [],
        stockEnvironments: [],
        activeStockEnvironmentId: "",
        updatedAt: new Date().toISOString()
      });
    }
  }

  function saveAlmoxState_(state) {
    const normalizedState = normalizeAlmoxEnvironmentState_(state || {});
    const safeState = {
      items: Array.isArray(normalizedState.items) ? normalizedState.items : [],
      movements: Array.isArray(normalizedState.movements) ? normalizedState.movements : [],
      alertsMuted: Boolean(normalizedState.alertsMuted),
      alertsMutedUntil: clean(normalizedState.alertsMutedUntil),
      alertHistory: Array.isArray(normalizedState.alertHistory) ? normalizedState.alertHistory.slice(0, 80) : [],
      approvalRequests: Array.isArray(normalizedState.approvalRequests) ? normalizedState.approvalRequests.slice(0, 200) : [],
      stockEnvironments: Array.isArray(normalizedState.stockEnvironments) ? normalizedState.stockEnvironments : [],
      activeStockEnvironmentId: clean(normalizedState.activeStockEnvironmentId),
      updatedAt: new Date().toISOString()
    };

    try {
      const storage = getLocalStorage_();
      if (storage) {
        storage.setItem(ALMOX_STORAGE_KEY, JSON.stringify(safeState));
      }
    } catch (error) {
      console.warn("Nao foi possivel salvar o almoxarifado.", error);
    }

    activeStockEnvironmentId = safeState.activeStockEnvironmentId;
    return safeState;
  }

  function normalizeAlmoxEnvironmentState_(state) {
    const safeState = {
      items: Array.isArray(state.items) ? state.items : [],
      movements: Array.isArray(state.movements) ? state.movements : [],
      alertsMuted: Boolean(state.alertsMuted),
      alertsMutedUntil: clean(state.alertsMutedUntil),
      alertHistory: Array.isArray(state.alertHistory) ? state.alertHistory : [],
      approvalRequests: Array.isArray(state.approvalRequests) ? state.approvalRequests : [],
      stockEnvironments: Array.isArray(state.stockEnvironments) ? state.stockEnvironments : [],
      activeStockEnvironmentId: clean(state.activeStockEnvironmentId),
      updatedAt: state.updatedAt || new Date().toISOString()
    };

    safeState.stockEnvironments = safeState.stockEnvironments.filter(function (environment) {
      return environment && clean(environment.id);
    });

    if (!safeState.stockEnvironments.length) {
      safeState.stockEnvironments.push(createDefaultStockEnvironment_());
    }

    const environmentIds = new Set(safeState.stockEnvironments.map(function (environment) {
      return environment.id;
    }));

    if (!safeState.activeStockEnvironmentId || !environmentIds.has(safeState.activeStockEnvironmentId)) {
      safeState.activeStockEnvironmentId = safeState.stockEnvironments[0].id;
    }

    safeState.items = safeState.items.map(function (item) {
      const environmentId = clean(item.environmentId);
      if (environmentId && environmentIds.has(environmentId)) {
        return item;
      }

      return Object.assign({}, item, {
        environmentId: safeState.activeStockEnvironmentId
      });
    });

    safeState.movements = safeState.movements.map(function (movement) {
      const environmentId = clean(movement.environmentId);
      if (environmentId && environmentIds.has(environmentId)) {
        return movement;
      }

      const relatedItem = safeState.items.find(function (item) {
        return item.id === movement.itemId;
      });

      return Object.assign({}, movement, {
        environmentId: relatedItem && relatedItem.environmentId
          ? relatedItem.environmentId
          : safeState.activeStockEnvironmentId
      });
    });

    safeState.alertHistory = safeState.alertHistory.map(function (alert) {
      const environmentId = clean(alert.environmentId);
      if (environmentId && environmentIds.has(environmentId)) {
        return alert;
      }

      return Object.assign({}, alert, {
        environmentId: safeState.activeStockEnvironmentId
      });
    });

    safeState.approvalRequests = safeState.approvalRequests.map(function (request) {
      const environmentId = clean(request.environmentId || request.organizationId);
      if (environmentId && environmentIds.has(environmentId)) {
        return Object.assign({}, request, {
          environmentId: environmentId,
          organizationId: environmentId
        });
      }

      return Object.assign({}, request, {
        environmentId: safeState.activeStockEnvironmentId,
        organizationId: safeState.activeStockEnvironmentId
      });
    });

    activeStockEnvironmentId = safeState.activeStockEnvironmentId;
    return safeState;
  }

  function applyStockAiPublicUrlContext_() {
    if (stockDemoUrlContextApplied || !isStockAiPublicDemo_()) {
      return;
    }

    stockDemoUrlContextApplied = true;
    applyStockAiPublicRoleParam_();

    const hasAccess = getStockAiPublicParam_("access") === "1" || Boolean(getStockAiPublicParam_("demo"));
    if (!hasAccess) {
      return;
    }

    const organization = getStockAiPublicParam_("organization") || "Prefeitura Sao Joao";
    const unit = getStockAiPublicParam_("unit") || "Secretaria de Saude";
    const managerEmail = getStockAiPublicParam_("managerEmail") || "secretaria@prefeiturasaojoao.demo";
    const warehouseEmail = getStockAiPublicParam_("warehouseEmail") || "almoxarife@prefeiturasaojoao.demo";
    const state = loadAlmoxState_();
    const normalizedOrganization = normalizeStockEnvironmentTitlePart_(organization);
    const normalizedUnit = normalizeStockEnvironmentTitlePart_(unit);
    const existing = state.stockEnvironments.find(function (environment) {
      return normalizeStockEnvironmentTitlePart_(environment.clientName) === normalizedOrganization &&
        normalizeStockEnvironmentTitlePart_(environment.unitName) === normalizedUnit;
    });

    if (existing) {
      existing.unitName = unit || existing.unitName;
      existing.environmentName = existing.environmentName || "Almoxarifado Central";
      existing.responsible = existing.responsible || "Gestor";
      existing.managerEmail = managerEmail || existing.managerEmail;
      existing.warehouseEmail = warehouseEmail || existing.warehouseEmail;
      state.activeStockEnvironmentId = existing.id;
      saveAlmoxState_(state);
      return;
    }

    state.stockEnvironments.push({
      id: createId_("env"),
      mode: "almoxarifado",
      clientName: organization,
      workName: "",
      institutionType: "Prefeitura / secretaria / loja",
      unitName: unit,
      environmentName: "Almoxarifado Central",
      responsible: "Gestor",
      managerEmail: managerEmail,
      warehouseEmail: warehouseEmail,
      createdAt: new Date().toISOString()
    });
    state.activeStockEnvironmentId = state.stockEnvironments[state.stockEnvironments.length - 1].id;
    saveAlmoxState_(state);
  }

  function needsAlmoxEnvironmentMigrationPersist_(rawState, normalizedState) {
    const raw = rawState || {};
    const normalized = normalizedState || normalizeAlmoxEnvironmentState_(raw);

    if (!Array.isArray(raw.stockEnvironments) || !raw.stockEnvironments.length) {
      return true;
    }

    if (!clean(raw.activeStockEnvironmentId)) {
      return true;
    }

    if ((raw.items || []).some(function (item) { return !clean(item.environmentId); })) {
      return true;
    }

    if ((raw.movements || []).some(function (movement) { return !clean(movement.environmentId); })) {
      return true;
    }

    if ((raw.alertHistory || []).some(function (alert) { return !clean(alert.environmentId); })) {
      return true;
    }

    return JSON.stringify(raw.stockEnvironments) !== JSON.stringify(normalized.stockEnvironments) ||
      clean(raw.activeStockEnvironmentId) !== clean(normalized.activeStockEnvironmentId);
  }

  function ensureAlmoxEnvironmentMigrationPersisted_() {
    try {
      const storage = getLocalStorage_();
      if (!storage) {
        return;
      }

      const rawText = storage.getItem(ALMOX_STORAGE_KEY);
      const rawState = rawText ? JSON.parse(rawText) : {};
      const normalizedState = normalizeAlmoxEnvironmentState_(rawState);

      if (needsAlmoxEnvironmentMigrationPersist_(rawState, normalizedState)) {
        saveAlmoxState_(normalizedState);
      }
    } catch (error) {
      console.warn("Nao foi possivel persistir a migracao de ambientes do almoxarifado.", error);
    }
  }

  function createDefaultStockEnvironment_() {
    const now = new Date().toISOString();

    return {
      id: DEFAULT_STOCK_ENVIRONMENT_ID,
      mode: "almoxarifado",
      clientName: "Demonstração",
      workName: "",
      institutionType: "Prefeitura / secretaria / loja",
      unitName: "Almoxarifado",
      environmentName: "Almoxarifado demonstrativo",
      responsible: "Gestor",
      managerEmail: "",
      warehouseEmail: "",
      createdAt: now
    };
  }

  function getStockEnvironments_() {
    return loadAlmoxState_().stockEnvironments;
  }

  function saveStockEnvironment_(environment) {
    if (environment && environment.id) {
      return updateStockEnvironment_(environment.id, environment);
    }

    return createStockEnvironment_(environment || {});
  }

  function getActiveStockEnvironmentId_() {
    const state = loadAlmoxState_();
    return clean(state.activeStockEnvironmentId) || DEFAULT_STOCK_ENVIRONMENT_ID;
  }

  function getActiveStockEnvironment_() {
    const state = loadAlmoxState_();
    return state.stockEnvironments.find(function (environment) {
      return environment.id === state.activeStockEnvironmentId;
    }) || state.stockEnvironments[0] || createDefaultStockEnvironment_();
  }

  function setActiveStockEnvironment_(environmentId) {
    const state = loadAlmoxState_();
    const exists = state.stockEnvironments.some(function (environment) {
      return environment.id === environmentId;
    });

    if (!exists) {
      return false;
    }

    state.activeStockEnvironmentId = environmentId;
    saveAlmoxState_(state);
    renderAlmoxarifadoPanel_();
    return true;
  }

  function createStockEnvironment_(data) {
    const state = loadAlmoxState_();
    const now = new Date().toISOString();
    const mode = data.mode === "obra" ? "obra" : "almoxarifado";
    const environment = {
      id: createId_("env"),
      mode: mode,
      clientName: clean(data.clientName) || "Cliente sem nome",
      workName: mode === "obra" ? clean(data.workName || data.unitName) : "",
      institutionType: clean(data.institutionType),
      unitName: mode === "almoxarifado" ? clean(data.unitName || data.workName) : "",
      environmentName: clean(data.environmentName) || "Ambiente Stock IA",
      responsible: clean(data.responsible) || "Gestor",
      managerEmail: clean(data.managerEmail),
      warehouseEmail: clean(data.warehouseEmail),
      createdAt: now
    };

    state.stockEnvironments.push(environment);
    state.activeStockEnvironmentId = environment.id;
    saveAlmoxState_(state);
    syncStockDemoRemoteAfterLocalChange_();
    renderAlmoxarifadoPanel_();
    showAlmoxToast_("Ambiente Stock IA criado e ativado.", "success");
    return environment;
  }

  function updateStockEnvironment_(environmentId, data) {
    const state = loadAlmoxState_();
    const index = state.stockEnvironments.findIndex(function (environment) {
      return environment.id === environmentId;
    });

    if (index < 0) {
      return false;
    }

    const current = state.stockEnvironments[index];
    const mode = data.mode === "obra" ? "obra" : "almoxarifado";
    state.stockEnvironments[index] = Object.assign({}, current, {
      mode: mode,
      clientName: clean(data.clientName) || current.clientName,
      workName: mode === "obra" ? clean(data.workName || data.unitName) : "",
      institutionType: clean(data.institutionType),
      unitName: mode === "almoxarifado" ? clean(data.unitName || data.workName) : "",
      environmentName: clean(data.environmentName) || current.environmentName,
      responsible: clean(data.responsible) || current.responsible,
      managerEmail: clean(data.managerEmail) || current.managerEmail || "",
      warehouseEmail: clean(data.warehouseEmail) || current.warehouseEmail || "",
      updatedAt: new Date().toISOString()
    });

    saveAlmoxState_(state);
    syncStockDemoRemoteAfterLocalChange_();
    renderAlmoxarifadoPanel_();
    return true;
  }

  function filterAlmoxItemsByActiveEnvironment_(items) {
    const environmentId = getActiveStockEnvironmentId_();
    return (items || []).filter(function (item) {
      return clean(item.environmentId) === environmentId;
    });
  }

  function filterAlmoxMovementsByActiveEnvironment_(movements) {
    const environmentId = getActiveStockEnvironmentId_();
    return (movements || []).filter(function (movement) {
      return clean(movement.environmentId) === environmentId;
    });
  }

  function filterAlmoxAlertHistoryByActiveEnvironment_(alerts) {
    const environmentId = getActiveStockEnvironmentId_();
    return (alerts || []).filter(function (alert) {
      return clean(alert.environmentId) === environmentId;
    });
  }

  function filterStockApprovalRequestsByActiveEnvironment_(requests) {
    const environmentId = getActiveStockEnvironmentId_();
    return (requests || []).filter(function (request) {
      return clean(request.environmentId || request.organizationId) === environmentId;
    });
  }

  function findAlmoxItemById_(itemId) {
    const state = loadAlmoxState_();
    return filterAlmoxItemsByActiveEnvironment_(state.items).find(function (item) {
      return item.id === itemId;
    }) || {};
  }

  function calculateAlmoxBalances_() {
    const state = loadAlmoxState_();
    const activeItems = filterAlmoxItemsByActiveEnvironment_(state.items);
    const activeMovements = filterAlmoxMovementsByActiveEnvironment_(state.movements);
    return activeItems.filter(function (item) {
      return !item.archived && !item.isArchived && !item.inactive;
    }).map(function (item) {
      const movements = activeMovements.filter(function (movement) {
        return movement.itemId === item.id;
      });
      const entries = movements.filter(function (movement) {
        return movement.type === "entrada";
      }).reduce(function (sum, movement) {
        return sum + parseNumber_(movement.quantity);
      }, 0);
      const exits = movements.filter(function (movement) {
        return movement.type === "saida";
      }).reduce(function (sum, movement) {
        return sum + parseNumber_(movement.quantity);
      }, 0);
      const balance = roundQuantity_(parseNumber_(item.initialQuantity) + entries - exits);
      return {
        item: item,
        entries: roundQuantity_(entries),
        exits: roundQuantity_(exits),
        balance: balance,
        status: getStockCycleStatus_({
          realBalance: balance,
          minimumStock: item.minimumStock
        })
      };
    }).sort(function (a, b) {
      return String(a.item.name || "").localeCompare(String(b.item.name || ""));
    });
  }

  function getAlmoxItemBalance_(itemId, state) {
    const safeState = state || loadAlmoxState_();
    const item = safeState.items.find(function (candidate) {
      return candidate.id === itemId;
    });
    const environmentId = item && item.environmentId ? item.environmentId : getActiveStockEnvironmentId_();

    if (!item) {
      return 0;
    }

    const movements = safeState.movements.filter(function (movement) {
      return movement.itemId === itemId && clean(movement.environmentId) === clean(environmentId);
    });
    const entries = movements.filter(function (movement) {
      return movement.type === "entrada";
    }).reduce(function (sum, movement) {
      return sum + parseNumber_(movement.quantity);
    }, 0);
    const exits = movements.filter(function (movement) {
      return movement.type === "saida";
    }).reduce(function (sum, movement) {
      return sum + parseNumber_(movement.quantity);
    }, 0);

    return roundQuantity_(parseNumber_(item.initialQuantity) + entries - exits);
  }

  function handleAlmoxItemSubmit_(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const result = saveAlmoxItemFromFormData_(formData);
    if (!result.ok) {
      showAlmoxToast_(result.message, "error");
      return;
    }

    event.target.reset();
    if (event.target.elements.unit) {
      event.target.elements.unit.value = "un";
    }
    renderAlmoxarifadoPanel_();
    [almoxEntryItemSelect, almoxExitItemSelect].forEach(function (select) {
      if (select) {
        select.value = result.item.id;
      }
    });
    showAlmoxToast_("Item cadastrado com sucesso.", "success");
  }

  function handleAlmoxEntrySubmit_(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    if (isStockAiPublicDemo_() && getStockDemoRole_() === "almoxarife") {
      const requestResult = createStockApprovalRequestFromFormData_("entry", formData);
      if (!requestResult.ok) {
        showAlmoxToast_(requestResult.message, "error");
        return;
      }

      event.target.reset();
      renderAlmoxarifadoPanel_();
      showAlmoxToast_("Solicitacao de entrada enviada ao gestor.", "success");
      return;
    }

    const result = saveAlmoxEntryFromFormData_(formData);
    if (!result.ok) {
      showAlmoxToast_(result.message, "error");
      return;
    }

    event.target.reset();
    renderAlmoxarifadoPanel_();
    showAlmoxToast_("Entrada registrada no almoxarifado.", "success");
  }

  function handleAlmoxExitSubmit_(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    if (isStockAiPublicDemo_() && getStockDemoRole_() === "almoxarife") {
      const requestResult = createStockApprovalRequestFromFormData_("exit", formData);
      if (!requestResult.ok) {
        showAlmoxToast_(requestResult.message, "error");
        return;
      }

      event.target.reset();
      renderAlmoxarifadoPanel_();
      showAlmoxToast_("Solicitacao de saida enviada ao gestor.", "success");
      return;
    }

    const result = saveAlmoxExitFromFormData_(formData);
    if (!result.ok) {
      showAlmoxToast_(result.message, "error");
      return;
    }

    event.target.reset();
    renderAlmoxarifadoPanel_();
    showAlmoxToast_("Saída registrada com responsável e setor.", "success");
  }

  function saveAlmoxItemFromFormData_(formData) {
    const state = loadAlmoxState_();
    const environmentId = getActiveStockEnvironmentId_();
    const name = clean(formData.get("name"));
    const initialQuantity = parseNumber_(formData.get("initialQuantity"));
    const minimumStock = parseNumber_(formData.get("minimumStock"));
    const defaultMovementDate = getDefaultAlmoxMovementDate_();
    const defaultMovementTime = getDefaultAlmoxMovementTime_();

    if (!name) {
      return {
        ok: false,
        message: "Informe o nome do item."
      };
    }

    if (initialQuantity < 0 || minimumStock < 0) {
      return {
        ok: false,
        message: "Informe quantidades iguais ou maiores que zero."
      };
    }

    const item = {
      id: createId_("alm"),
      environmentId: environmentId,
      fiscalCode: clean(formData.get("fiscalCode")),
      name: name,
      category: clean(formData.get("category")) || "Geral",
      unit: clean(formData.get("unit")) || "un",
      initialQuantity: 0,
      minimumStock: minimumStock,
      location: clean(formData.get("location")),
      expirationDate: clean(formData.get("expirationDate")),
      notes: clean(formData.get("notes")),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.items.push(item);

    if (initialQuantity > 0) {
      state.movements.push({
        id: createId_("almmov"),
        environmentId: environmentId,
        itemId: item.id,
        type: "entrada",
        quantity: initialQuantity,
        responsible: "Saldo inicial",
        documentNumber: "",
        date: defaultMovementDate,
        movementDate: defaultMovementDate,
        movementTime: defaultMovementTime,
        movementDateTime: buildAlmoxMovementDateTime_(defaultMovementDate, defaultMovementTime),
        notes: "Entrada inicial do cadastro.",
        createdAt: new Date().toISOString()
      });
    }

    saveAlmoxState_(state);
    syncStockDemoRemoteAfterLocalChange_();
    return {
      ok: true,
      item: item
    };
  }

  function saveAlmoxEntryFromFormData_(formData) {
    const state = loadAlmoxState_();
    const environmentId = getActiveStockEnvironmentId_();
    const itemId = clean(formData.get("itemId"));
    const quantity = parseNumber_(formData.get("quantity"));
    const movementDate = clean(formData.get("movementDate")) || clean(formData.get("date")) || getDefaultAlmoxMovementDate_();
    const movementTime = clean(formData.get("movementTime")) || getDefaultAlmoxMovementTime_();
    const movementDateTime = buildAlmoxMovementDateTime_(movementDate, movementTime);

    if (!itemId || quantity <= 0) {
      return {
        ok: false,
        message: "Escolha um item e informe a quantidade de entrada."
      };
    }

    if (!state.items.some(function (item) { return item.id === itemId && clean(item.environmentId) === environmentId; })) {
      return {
        ok: false,
        message: "Material não encontrado no almoxarifado."
      };
    }

    state.movements.push({
      id: createId_("almmov"),
      environmentId: environmentId,
      itemId: itemId,
      type: "entrada",
      quantity: quantity,
      responsible: clean(formData.get("responsible")),
      documentNumber: clean(formData.get("documentNumber")),
      date: movementDate,
      movementDate: movementDate,
      movementTime: movementTime,
      movementDateTime: movementDateTime,
      notes: clean(formData.get("notes")),
      createdAt: new Date().toISOString()
    });
    saveAlmoxState_(state);
    syncStockDemoRemoteAfterLocalChange_();
    return {
      ok: true
    };
  }

  function saveAlmoxExitFromFormData_(formData) {
    const state = loadAlmoxState_();
    const environmentId = getActiveStockEnvironmentId_();
    const itemId = clean(formData.get("itemId"));
    const quantity = parseNumber_(formData.get("quantity"));
    const movementDate = clean(formData.get("movementDate")) || clean(formData.get("date")) || getDefaultAlmoxMovementDate_();
    const movementTime = clean(formData.get("movementTime")) || getDefaultAlmoxMovementTime_();
    const movementDateTime = buildAlmoxMovementDateTime_(movementDate, movementTime);

    if (!itemId || quantity <= 0) {
      return {
        ok: false,
        message: "Escolha um item e informe a quantidade de saída."
      };
    }

    if (!state.items.some(function (item) { return item.id === itemId && clean(item.environmentId) === environmentId; })) {
      return {
        ok: false,
        message: "Material não encontrado no almoxarifado."
      };
    }

    const balance = getAlmoxItemBalance_(itemId, state);
    if (quantity > balance) {
      return {
        ok: false,
        message: "Saldo insuficiente para esta saída."
      };
    }

    state.movements.push({
      id: createId_("almmov"),
      environmentId: environmentId,
      itemId: itemId,
      type: "saida",
      quantity: quantity,
      recipient: clean(formData.get("recipient")),
      sector: clean(formData.get("sector")),
      purpose: clean(formData.get("purpose")),
      responsible: clean(formData.get("responsible")),
      date: movementDate,
      movementDate: movementDate,
      movementTime: movementTime,
      movementDateTime: movementDateTime,
      notes: clean(formData.get("notes")),
      createdAt: new Date().toISOString()
    });
    saveAlmoxState_(state);
    syncStockDemoRemoteAfterLocalChange_();
    return {
      ok: true
    };
  }

  function handleImportAlmoxXmlNote_(file) {
    if (!file) {
      setAlmoxNoteStatus_("Selecione um arquivo XML da NF-e/NFC-e para importar.", "error");
      return;
    }

    if (!isValidAlmoxXmlFile_(file)) {
      setAlmoxNoteStatus_("Arquivo XML invalido. Selecione um arquivo .xml da NF-e/NFC-e.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const xmlText = String(event.target && event.target.result || "");
        const parsed = parseAlmoxNfeXmlText_(xmlText);

        if (!parsed.items.length) {
          almoxParsedNoteItems = [];
          almoxFiscalOcrReviewData = createEmptyFiscalOcrReviewReport_();
          renderAlmoxParsedNoteItems_();
          renderFiscalOcrReviewReport_(almoxFiscalOcrReviewData);
          setAlmoxNoteStatus_("Nenhum item encontrado no XML. Verifique se o arquivo e uma NF-e/NFC-e completa.", "error");
          return;
        }

        almoxNoteImportSource = "xml";
        almoxNoteOcrReady = false;
        almoxNoteFileDraft = null;
        almoxParsedNoteItems = parsed.items;
        almoxFiscalOcrReviewData = buildAlmoxXmlReviewReport_(parsed);
        if (almoxNoteTextInput) {
          almoxNoteTextInput.value = "";
        }
        renderAlmoxNoteFilePreview_();
        renderAlmoxParsedNoteItems_();
        renderFiscalOcrReviewReport_(almoxFiscalOcrReviewData);
        setAlmoxNoteStatus_("XML importado com seguranca. Confira os itens antes de adicionar ao estoque.", "success");
      } catch (error) {
        almoxNoteImportSource = "";
        setAlmoxNoteStatus_((error && error.message) || "Erro ao ler XML da NF-e/NFC-e.", "error");
      }
    };
    reader.onerror = function () {
      setAlmoxNoteStatus_("Nao foi possivel ler o arquivo XML selecionado.", "error");
    };
    reader.readAsText(file, "UTF-8");
  }

  function isValidAlmoxXmlFile_(file) {
    const extension = getFileExtension_(file.name);
    return extension === "xml" || file.type === "text/xml" || file.type === "application/xml";
  }

  function parseAlmoxNfeXmlText_(xmlText) {
    if (!clean(xmlText)) {
      throw new Error("O arquivo XML esta vazio.");
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    const parseError = xmlDoc.getElementsByTagName("parsererror")[0];
    if (parseError) {
      throw new Error("XML invalido. Verifique o arquivo exportado da nota fiscal.");
    }

    const dets = Array.prototype.slice.call(xmlDoc.getElementsByTagName("det"));
    const items = [];
    const skipped = [];

    dets.forEach(function (det, index) {
      const productNode = det.getElementsByTagName("prod")[0] || det;
      const code = getAlmoxXmlText_(productNode, "cProd");
      const product = cleanFiscalProductName_(getAlmoxXmlText_(productNode, "xProd"));
      const quantity = parseNumber_(getAlmoxXmlText_(productNode, "qCom"));
      const unit = normalizeAlmoxNoteUnit_(getAlmoxXmlText_(productNode, "uCom"));
      const unitValue = parseNumber_(getAlmoxXmlText_(productNode, "vUnCom"));
      const totalValue = parseNumber_(getAlmoxXmlText_(productNode, "vProd"));

      if (!product || quantity <= 0 || !unit) {
        skipped.push({
          text: "Item " + (index + 1) + " do XML",
          reason: "produto, quantidade ou unidade ausente"
        });
        return;
      }

      items.push({
        id: createId_("almnote"),
        sourceLine: index + 1,
        code: code,
        product: product,
        quantity: quantity,
        unit: unit,
        unitValue: unitValue,
        totalValue: totalValue,
        category: suggestAlmoxNoteCategory_(product),
        sourceText: [code, product, quantity, unit, unitValue, totalValue].filter(function (value) {
          return value !== "" && value !== null && value !== undefined;
        }).join(" ")
      });
    });

    return {
      items: items,
      skipped: skipped,
      issuer: getAlmoxXmlText_(xmlDoc, "xNome"),
      number: getAlmoxXmlText_(xmlDoc, "nNF"),
      accessKey: getAlmoxNfeAccessKey_(xmlDoc),
      issuedAt: getAlmoxXmlText_(xmlDoc, "dhEmi") || getAlmoxXmlText_(xmlDoc, "dEmi")
    };
  }

  function getAlmoxXmlText_(node, tagName) {
    const found = node && node.getElementsByTagName ? node.getElementsByTagName(tagName)[0] : null;
    return found && found.textContent ? clean(found.textContent) : "";
  }

  function getAlmoxNfeAccessKey_(xmlDoc) {
    const infNfe = xmlDoc.getElementsByTagName("infNFe")[0] || xmlDoc.getElementsByTagName("infNFCe")[0];
    const id = infNfe && infNfe.getAttribute ? clean(infNfe.getAttribute("Id")) : "";
    return id.replace(/^NFe/i, "");
  }

  function buildAlmoxXmlReviewReport_(parsed) {
    const skipped = parsed && parsed.skipped ? parsed.skipped : [];
    const items = parsed && parsed.items ? parsed.items : [];
    return {
      totalLines: items.length + skipped.length,
      interpretedTotal: items.length,
      rejectedItems: skipped,
      ignoredLines: [],
      pendingLines: [],
      lowConfidenceItems: [],
      discardedDuplicates: [],
      hasRisk: Boolean(skipped.length)
    };
  }

  async function handleAlmoxNoteFileChange_() {
    const file = almoxNoteFileInput && almoxNoteFileInput.files ? almoxNoteFileInput.files[0] : null;

    if (!file) {
      handleClearAlmoxNoteFile_();
      return;
    }

    const validation = validateAlmoxNoteFile_(file);
    if (!validation.ok) {
      almoxNoteFileDraft = null;
      if (almoxNoteFileInput) {
        almoxNoteFileInput.value = "";
      }
      renderAlmoxNoteFilePreview_();
      setAlmoxNoteStatus_(validation.message, "error");
      return;
    }

    almoxNoteFileDraft = {
      name: file.name || "nota-fiscal",
      type: file.type || getAlmoxNoteFileTypeFromName_(file.name),
      size: file.size || 0,
      previewDataUrl: null,
      ocrText: "",
      ocrStatus: "pending"
    };
    almoxNoteOcrReady = false;
    almoxNoteImportSource = "ocr";

    if (/^image\//.test(almoxNoteFileDraft.type)) {
      const selectedName = almoxNoteFileDraft.name;
      readAlmoxNoteImagePreview_(file, function (dataUrl) {
        if (!almoxNoteFileDraft || almoxNoteFileDraft.name !== selectedName) {
          return;
        }
        almoxNoteFileDraft.previewDataUrl = dataUrl;
        renderAlmoxNoteFilePreview_();
      });
    }

    renderAlmoxNoteFilePreview_();
    await runAlmoxNoteOcr_(file, almoxNoteFileDraft);
  }

  function handleClearAlmoxNoteFile_() {
    almoxNoteFileDraft = null;
    almoxNoteOcrReady = false;
    if (almoxNoteImportSource === "ocr") {
      almoxNoteImportSource = "";
    }
    almoxOcrSequence += 1;
    if (almoxNoteFileInput) {
      almoxNoteFileInput.value = "";
    }
    renderAlmoxNoteFilePreview_();
    setAlmoxNoteStatus_("Arquivo removido. Cole o texto extraido ou digitado da nota para interpretar os itens.", "info");
  }

  function validateAlmoxNoteFile_(file) {
    const type = file.type || getAlmoxNoteFileTypeFromName_(file.name);
    const extension = getFileExtension_(file.name);
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "pdf"];

    if (file.size > ALMOX_NOTE_FILE_MAX_SIZE) {
      return {
        ok: false,
        message: "Arquivo maior que 10 MB. Envie uma imagem ou PDF menor para anexar a nota."
      };
    }

    if (allowedTypes.indexOf(type) < 0 && allowedExtensions.indexOf(extension) < 0) {
      return {
        ok: false,
        message: "Tipo de arquivo nao aceito. Use JPG, JPEG, PNG, WEBP ou PDF."
      };
    }

    return {
      ok: true
    };
  }

  function getAlmoxNoteFileTypeFromName_(name) {
    const extension = getFileExtension_(name);
    if (["jpg", "jpeg"].indexOf(extension) >= 0) {
      return "image/jpeg";
    }
    if (extension === "png") {
      return "image/png";
    }
    if (extension === "webp") {
      return "image/webp";
    }
    if (extension === "pdf") {
      return "application/pdf";
    }
    return "";
  }

  function readAlmoxNoteImagePreview_(file, callback) {
    const reader = new FileReader();
    reader.onload = function () {
      callback(reader.result || null);
    };
    reader.onerror = function () {
      callback(null);
    };
    reader.readAsDataURL(file);
  }

  function renderAlmoxNoteFilePreview_() {
    if (!almoxNoteFilePreview) {
      return;
    }

    almoxNoteFilePreview.innerHTML = "";

    if (!almoxNoteFileDraft) {
      almoxNoteFilePreview.className = "almox-note-file-preview is-empty";
      almoxNoteFilePreview.textContent = "Nenhum arquivo carregado.";
      return;
    }

    const meta = document.createElement("p");
    const ocrMeta = document.createElement("p");
    meta.textContent = almoxNoteFileDraft.name + " | " + formatBytes_(almoxNoteFileDraft.size);
    ocrMeta.className = "almox-note-ocr-meta";
    ocrMeta.textContent = getAlmoxOcrStatusText_(almoxNoteFileDraft);
    almoxNoteFilePreview.className = "almox-note-file-preview ready";

    if (/^image\//.test(almoxNoteFileDraft.type) && almoxNoteFileDraft.previewDataUrl) {
      const image = document.createElement("img");
      image.src = almoxNoteFileDraft.previewDataUrl;
      image.alt = "Previa da nota fiscal";
      image.loading = "lazy";
      almoxNoteFilePreview.appendChild(image);
      almoxNoteFilePreview.appendChild(meta);
      almoxNoteFilePreview.appendChild(ocrMeta);
      return;
    }

    const box = document.createElement("div");
    const label = document.createElement("strong");
    const hint = document.createElement("span");
    box.className = "almox-note-file-box";
    label.textContent = almoxNoteFileDraft.type === "application/pdf" ? "PDF" : "Arquivo";
    hint.textContent = "Arquivo anexado para conferencia manual.";
    box.appendChild(label);
    box.appendChild(hint);
    almoxNoteFilePreview.appendChild(box);
    almoxNoteFilePreview.appendChild(meta);
    almoxNoteFilePreview.appendChild(ocrMeta);
  }

  function getAlmoxOcrStatusText_(fileDraft) {
    if (!fileDraft) {
      return "";
    }
    if (fileDraft.ocrStatus === "running") {
      return "OCR: extraindo texto...";
    }
    if (fileDraft.ocrStatus === "done") {
      return "OCR: texto extraido. Confira antes de adicionar ao estoque.";
    }
    if (fileDraft.ocrStatus === "empty") {
      return "OCR: nenhum texto confiavel encontrado.";
    }
    if (fileDraft.ocrStatus === "error") {
      return "OCR: nao foi possivel concluir a leitura.";
    }
    return "OCR: aguardando leitura.";
  }

  async function runAlmoxNoteOcr_(file, fileDraft) {
    const sequence = ++almoxOcrSequence;

    if (!file || !fileDraft) {
      return;
    }

    fileDraft.ocrStatus = "running";
    renderAlmoxNoteFilePreview_();
    setAlmoxNoteStatus_("Extraindo texto...", "info");

    try {
      const text = fileDraft.type === "application/pdf"
        ? await extractAlmoxTextFromPdf_(file, sequence)
        : await extractAlmoxTextFromImage_(fileDraft.previewDataUrl || file, sequence);

      if (sequence !== almoxOcrSequence || !almoxNoteFileDraft || almoxNoteFileDraft.name !== fileDraft.name) {
        return;
      }

      fileDraft.ocrText = cleanOcrText_(text);
      fileDraft.ocrStatus = fileDraft.ocrText ? "done" : "empty";
      almoxNoteOcrReady = Boolean(fileDraft.ocrText);
      renderAlmoxNoteFilePreview_();

      if (fileDraft.ocrText && almoxNoteTextInput) {
        almoxNoteTextInput.value = fileDraft.ocrText;
        almoxNoteTextInput.dispatchEvent(new Event("input", { bubbles: true }));
        setAlmoxNoteStatus_("Texto extraido da nota. Confira antes de adicionar ao estoque.", "success");
        return;
      }

      setAlmoxNoteStatus_("Nao foi possivel extrair texto com confianca. Cole o texto da nota ou confira manualmente.", "error");
    } catch (error) {
      if (sequence !== almoxOcrSequence) {
        return;
      }
      fileDraft.ocrStatus = "error";
      almoxNoteOcrReady = false;
      almoxNoteImportSource = "";
      renderAlmoxNoteFilePreview_();
      setAlmoxNoteStatus_((error && error.message) || "Nao foi possivel executar OCR neste arquivo.", "error");
    }
  }

  async function extractAlmoxTextFromImage_(imageSource, sequence) {
    const Tesseract = await loadAlmoxTesseract_();
    if (sequence !== almoxOcrSequence) {
      return "";
    }

    const result = await Tesseract.recognize(imageSource, "por+eng", {
      logger: function (info) {
        if (sequence !== almoxOcrSequence || !info || info.status !== "recognizing text") {
          return;
        }
        const progress = Math.round((info.progress || 0) * 100);
        setAlmoxNoteStatus_("Extraindo texto... " + progress + "%", "info");
      }
    });

    return result && result.data ? result.data.text : "";
  }

  async function extractAlmoxTextFromPdf_(file, sequence) {
    const pdfjsLib = await loadAlmoxPdfJs_();
    const buffer = await file.arrayBuffer();
    if (sequence !== almoxOcrSequence) {
      return "";
    }

    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pageLimit = Math.min(pdf.numPages || 0, ALMOX_OCR_PDF_MAX_PAGES);
    const texts = [];

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      if (sequence !== almoxOcrSequence) {
        return "";
      }

      setAlmoxNoteStatus_("Extraindo texto do PDF... pagina " + pageNumber + " de " + pageLimit + ".", "info");
      const imageDataUrl = await renderAlmoxPdfPageToImage_(pdf, pageNumber);
      texts.push(await extractAlmoxTextFromImage_(imageDataUrl, sequence));
    }

    return texts.join("\n");
  }

  async function renderAlmoxPdfPageToImage_(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    return canvas.toDataURL("image/png");
  }

  async function loadAlmoxTesseract_() {
    if (window.Tesseract && window.Tesseract.recognize) {
      return window.Tesseract;
    }
    await loadExternalScript_(ALMOX_OCR_TESSERACT_URL);
    if (!window.Tesseract || !window.Tesseract.recognize) {
      throw new Error("Biblioteca OCR nao carregou. Verifique a conexao e tente novamente.");
    }
    return window.Tesseract;
  }

  async function loadAlmoxPdfJs_() {
    if (window.pdfjsLib && window.pdfjsLib.getDocument) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = ALMOX_OCR_PDF_WORKER_URL;
      return window.pdfjsLib;
    }
    await loadExternalScript_(ALMOX_OCR_PDFJS_URL);
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib || !pdfjsLib.getDocument) {
      throw new Error("Biblioteca de leitura de PDF nao carregou. Verifique a conexao e tente novamente.");
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = ALMOX_OCR_PDF_WORKER_URL;
    return pdfjsLib;
  }

  function loadExternalScript_(src) {
    if (externalScriptPromises[src]) {
      return externalScriptPromises[src];
    }

    externalScriptPromises[src] = new Promise(function (resolve, reject) {
      const existing = document.querySelector("script[src='" + src + "']");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", function () {
          reject(new Error("Nao foi possivel carregar biblioteca externa."));
        }, { once: true });
        if (existing.dataset.loaded === "true") {
          resolve();
        }
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = function () {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = function () {
        reject(new Error("Nao foi possivel carregar biblioteca externa."));
      };
      document.head.appendChild(script);
    });

    return externalScriptPromises[src];
  }

  function cleanOcrText_(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map(function (line) { return clean(line).replace(/\s+/g, " "); })
      .filter(Boolean)
      .join("\n");
  }

  function handleParseAlmoxNoteText_() {
    const text = clean(almoxNoteTextInput && almoxNoteTextInput.value);

    if (!text) {
      almoxParsedNoteItems = [];
      almoxFiscalOcrReviewData = createEmptyFiscalOcrReviewReport_();
      renderAlmoxParsedNoteItems_();
      renderFiscalOcrReviewReport_(almoxFiscalOcrReviewData);
      setAlmoxNoteStatus_("Nenhum item foi reconhecido. Verifique o texto colado ou cadastre manualmente.", "error");
      return;
    }

    almoxParsedNoteItems = parseAlmoxFiscalText_(text);
    almoxNoteImportSource = almoxNoteOcrReady ? "ocr" : "text";
    almoxFiscalOcrReviewData = buildFiscalOcrReviewReport_(text, almoxParsedNoteItems);

    renderAlmoxParsedNoteItems_();
    renderFiscalOcrReviewReport_(almoxFiscalOcrReviewData);

    if (!almoxParsedNoteItems.length) {
      setAlmoxNoteStatus_("Nenhum item foi reconhecido. Verifique o texto colado ou cadastre manualmente.", "error");
      return;
    }

    if (almoxParsedNoteItems.length < 5) {
      setAlmoxNoteStatus_("Atencao: poucos itens foram interpretados. Confira o texto extraido ou ajuste manualmente antes de adicionar ao estoque.", "warning");
      return;
    }

    setAlmoxNoteStatus_("Confira os itens antes de lancar no estoque.", "success");
  }

  function handleClearAlmoxNote_() {
    almoxParsedNoteItems = [];
    almoxFiscalOcrReviewData = createEmptyFiscalOcrReviewReport_();
    almoxNoteImportSource = "";
    almoxNoteFileDraft = null;
    if (almoxNoteTextInput) {
      almoxNoteTextInput.value = "";
    }
    if (almoxNoteFileInput) {
      almoxNoteFileInput.value = "";
    }
    if (almoxXmlNoteFileInput) {
      almoxXmlNoteFileInput.value = "";
    }
    if (almoxNfeKeyInput) {
      almoxNfeKeyInput.value = "";
    }
    if (almoxNfeKeyStatus) {
      almoxNfeKeyStatus.textContent = "Consulta por chave NF-e preparada para integracao futura.";
    }
    renderAlmoxNoteFilePreview_();
    renderAlmoxParsedNoteItems_();
    renderFiscalOcrReviewReport_(almoxFiscalOcrReviewData);
    setAlmoxNoteStatus_("Cole o texto da nota para iniciar a leitura.", "info");
  }

  function handleValidateAlmoxNfeKey_() {
    const digits = clean(almoxNfeKeyInput && almoxNfeKeyInput.value).replace(/\D/g, "");
    const valid = digits.length === 44;
    const message = valid
      ? "Chave NF-e reconhecida. Consulta real via API/certificado sera ativada futuramente."
      : "Chave NF-e invalida.";

    if (almoxNfeKeyStatus) {
      almoxNfeKeyStatus.textContent = message;
    }

    setAlmoxNoteStatus_(message, valid ? "success" : "error");
  }

  function handleAddAlmoxNoteItems_() {
    syncAlmoxParsedNoteItemsFromTable_();

    const validItems = almoxParsedNoteItems.filter(function (item) {
      return clean(item.product) && parseNumber_(item.quantity) > 0 && clean(item.unit);
    });

    if (!validItems.length) {
      setAlmoxNoteStatus_("Nenhum item foi reconhecido. Verifique o texto colado ou cadastre manualmente.", "error");
      return;
    }

    if (hasFiscalOcrReviewRisk_(almoxFiscalOcrReviewData) &&
        !window.confirm("Existem linhas pendentes. Confirme que revisou antes de lancar.")) {
      setAlmoxNoteStatus_("Lancamento cancelado para conferencia das linhas pendentes.", "warning");
      return;
    }

    const movementDate = getDefaultAlmoxMovementDate_();
    const movementTime = getDefaultAlmoxMovementTime_();
    const responsible = clean(currentUser && currentUser.name) || "Sistema Stock IA";
    const entryOrigin = almoxNoteImportSource === "xml"
      ? "Nota fiscal XML"
      : (almoxNoteOcrReady
      ? "Nota fiscal por OCR"
      : (almoxNoteFileDraft ? "Nota fiscal por imagem/PDF - conferida manualmente" : "Nota fiscal interpretada"));

    if (isStockAiPublicDemo_() && getStockDemoRole_() === "almoxarife") {
      validItems.forEach(function (noteItem) {
        createStockApprovalRequestFromNoteItem_(noteItem, {
          entryOrigin: entryOrigin,
          responsible: responsible,
          movementDate: movementDate,
          movementTime: movementTime
        });
      });

      almoxParsedNoteItems = [];
      almoxFiscalOcrReviewData = createEmptyFiscalOcrReviewReport_();
      almoxNoteImportSource = "";
      almoxNoteOcrReady = false;
      renderAlmoxarifadoPanel_();
      renderFiscalOcrReviewReport_(almoxFiscalOcrReviewData);
      setAlmoxNoteStatus_("Solicitacoes enviadas ao gestor. O estoque oficial ainda nao foi alterado.", "success");
      showAlmoxToast_("Solicitacoes da nota enviadas para aprovacao.", "success");
      return;
    }

    let addedCount = 0;

    validItems.forEach(function (noteItem) {
      let state = loadAlmoxState_();
      let item = findAlmoxItemFromNote_(state, noteItem);

      if (!item) {
        const itemFormData = new FormData();
        itemFormData.append("name", clean(noteItem.product));
        itemFormData.append("fiscalCode", clean(noteItem.code));
        itemFormData.append("category", clean(noteItem.category) || suggestAlmoxNoteCategory_(noteItem.product));
        itemFormData.append("unit", normalizeAlmoxNoteUnit_(noteItem.unit));
        itemFormData.append("initialQuantity", "0");
        itemFormData.append("minimumStock", "0");
        itemFormData.append("location", "");
        itemFormData.append("expirationDate", "");
        itemFormData.append("notes", "Criado a partir de nota fiscal interpretada.");

        const itemResult = saveAlmoxItemFromFormData_(itemFormData);
        if (!itemResult.ok) {
          return;
        }
        item = itemResult.item;
      }

      const entryFormData = new FormData();
      entryFormData.append("itemId", item.id);
      entryFormData.append("quantity", String(parseNumber_(noteItem.quantity)));
      entryFormData.append("documentNumber", entryOrigin);
      entryFormData.append("responsible", responsible);
      entryFormData.append("movementDate", movementDate);
      entryFormData.append("movementTime", movementTime);
      entryFormData.append("notes", buildAlmoxNoteEntryNotes_(noteItem, entryOrigin));

      const entryResult = saveAlmoxEntryFromFormData_(entryFormData);
      if (entryResult.ok) {
        addedCount += 1;
      }
    });

    if (!addedCount) {
      setAlmoxNoteStatus_("Nenhum item foi reconhecido. Verifique o texto colado ou cadastre manualmente.", "error");
      return;
    }

    almoxParsedNoteItems = [];
    almoxFiscalOcrReviewData = createEmptyFiscalOcrReviewReport_();
    almoxNoteImportSource = "";
    almoxNoteOcrReady = false;
    renderAlmoxarifadoPanel_();
    renderFiscalOcrReviewReport_(almoxFiscalOcrReviewData);
    setAlmoxNoteStatus_("Itens adicionados ao estoque a partir da nota fiscal.", "success");
    showAlmoxToast_("Itens adicionados ao estoque a partir da nota fiscal.", "success");
  }

  function parseAlmoxFiscalText_(text) {
    almoxLastFiscalRejectedItems = [];
    almoxLastFiscalDiscardedDuplicates = [];
    return dedupeFiscalItems_(parseFiscalNoteItems_(text));
  }

  function normalizeFiscalNoteText_(text) {
    return cleanOcrText_(text)
      .split("\n")
      .map(function (line) {
        return normalizeAlmoxFiscalLine_(line)
          .replace(/[\u00A3ªº&%]+/g, " ")
          .replace(/[_]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      })
      .filter(Boolean)
      .join("\n");
  }

  function normalizeFiscalNoteLineForParsing_(line) {
    return normalizeAlmoxFiscalLine_(line)
      .replace(/[\u2014\u2013]/g, "-")
      .replace(/^[^\dA-Za-zÀ-ÿ]+(?=\S)/, "")
      .replace(/\bU[NM]\b/ig, "UN")
      .replace(/\bUNID(?:ADE)?S?\b/ig, "UN")
      .replace(/\bLT\b/ig, "L")
      .replace(/\s+/g, " ")
      .trim();
  }

  function rebuildFiscalStructuredLines_(text) {
    const lines = normalizeFiscalNoteText_(text)
      .split("\n")
      .map(normalizeFiscalNoteLineForParsing_)
      .filter(Boolean);
    const rebuilt = [];
    let pending = "";

    lines.forEach(function (line) {
      if (isFiscalNoiseLine_(line)) {
        return;
      }

      const startsWithCode = /^\d{3}\b/.test(line);
      if (startsWithCode) {
        if (pending) {
          rebuilt.push(pending);
        }
        pending = line;
      } else if (pending) {
        pending = pending + " " + line;
      } else {
        registerFiscalRejectedLine_(line, getFiscalPendingLineReason_(line));
      }

      if (pending && hasStrictFiscalItemShape_(pending)) {
        rebuilt.push(pending);
        pending = "";
      }
    });

    if (pending) {
      rebuilt.push(pending);
    }

    return rebuilt;
  }

  function hasStrictFiscalItemShape_(line) {
    return /^\d{3}\b/.test(line) &&
      /(?:\d+(?:[.,]\d{2})\b)/.test(line) &&
      /[\d.,]+\s*(UN|UND|UNID|KG|G|L|ML|LT|CX|PC|PCT|RL)\b/i.test(line);
  }

  function parseFiscalNoteItems_(text) {
    return rebuildFiscalStructuredLines_(text)
      .filter(function (line) {
        return line && !isFiscalNoiseLine_(line);
      })
      .map(parseFiscalNoteLine_)
      .filter(Boolean);
  }

  function parseFiscalNoteLine_(line, index) {
    const strictItem = parseStrictFiscalNoteLine_(line, index);
    if (strictItem) {
      return strictItem;
    }

    registerFiscalRejectedLine_(line, getFiscalPendingLineReason_(normalizeFiscalNoteLineForParsing_(line)));
    return null;

    const normalizedLine = normalizeAlmoxFiscalLine_(line).replace(/[—–]/g, "-");
    const codeMatch = normalizedLine.match(/^\s*(\d{1,8})\s+(.+)$/);
    if (!codeMatch) {
      return null;
    }

    const code = codeMatch[1];
    const rest = clean(codeMatch[2]);
    const moneyMatches = Array.from(rest.matchAll(/(?:R\$\s*)?\d+(?:[.,]\d{2})\b/g));
    if (moneyMatches.length < 2) {
      return null;
    }

    const unitValueMatch = moneyMatches[moneyMatches.length - 2];
    const totalValueMatch = moneyMatches[moneyMatches.length - 1];
    const beforeValues = clean(rest.slice(0, unitValueMatch.index));
    const quantityUnitMatch = beforeValues.match(/^(.*?)\s+([\d.,]+)\s*(UN|UND|UNID|KG|G|L|ML|M2|M3|M|CX|PC|PCT|SC|LT|RL)\s*$/i);
    if (!quantityUnitMatch) {
      return null;
    }

    const product = cleanAlmoxParsedProduct_(quantityUnitMatch[1]);
    const quantity = parseNumber_(quantityUnitMatch[2]);
    const unit = normalizeAlmoxNoteUnit_(quantityUnitMatch[3]);
    const unitValue = parseNumber_(unitValueMatch[0]);
    const totalValue = parseNumber_(totalValueMatch[0]);

    if (!isValidAlmoxParsedProduct_(product) || quantity <= 0 || !unit) {
      return null;
    }

    return {
      id: createId_("almnote"),
      sourceLine: index + 1,
      code: code,
      product: product,
      quantity: quantity,
      unit: unit,
      unitValue: unitValue,
      totalValue: totalValue,
      sourceText: normalizedLine,
      category: suggestAlmoxNoteCategory_(product)
    };
  }

  function parseStrictFiscalNoteLine_(line, index) {
    const normalizedLine = normalizeFiscalNoteLineForParsing_(line);
    const codeMatch = normalizedLine.match(/^\s*(\d{3})\b\s+(.+)$/);
    if (!codeMatch) {
      return null;
    }

    const code = codeMatch[1];
    const rest = clean(codeMatch[2]);
    const moneyMatches = Array.from(rest.matchAll(/(?:R\$\s*)?\d+(?:[.,]\d{2})\b/g));
    if (!moneyMatches.length) {
      return null;
    }

    const unitValueMatch = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 2] : moneyMatches[0];
    const totalValueMatch = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 1] : null;
    const beforeValues = clean(rest.slice(0, unitValueMatch.index));
    const quantityUnitMatch = beforeValues.match(/^(.*?)\s+([\d.,]+)\s*(UN|KG|G|L|ML|LT|CX|PC|PCT|RL)\s*$/i);
    if (!quantityUnitMatch) {
      return null;
    }

    const product = cleanFiscalProductName_(quantityUnitMatch[1]);
    const quantity = parseNumber_(quantityUnitMatch[2]);
    const unit = normalizeAlmoxNoteUnit_(quantityUnitMatch[3]);
    const unitValue = parseNumber_(unitValueMatch[0]);
    const totalValue = totalValueMatch ? parseNumber_(totalValueMatch[0]) : 0;
    const item = {
      id: createId_("almnote"),
      sourceLine: index + 1,
      code: code,
      product: product,
      quantity: quantity,
      unit: unit,
      unitValue: unitValue,
      totalValue: totalValue,
      sourceText: normalizedLine,
      category: suggestAlmoxNoteCategory_(product)
    };

    return isHighConfidenceFiscalItem_(item) ? item : null;
  }

  function isHighConfidenceFiscalItem_(item) {
    const product = clean(item && item.product);
    const letters = (product.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    return /^\d{3}$/.test(clean(item && item.code)) &&
      letters >= 4 &&
      !hasFiscalProductNoise_(product) &&
      parseNumber_(item && item.quantity) > 0 &&
      /^(un|kg|g|L|ml|caixa|pacote|rolo)$/i.test(clean(item && item.unit)) &&
      (parseNumber_(item && item.unitValue) > 0 || parseNumber_(item && item.totalValue) > 0) &&
      getFiscalItemQualityScore_(item) >= 90;
  }

  function hasFiscalProductNoise_(product) {
    const value = clean(product);
    return !value ||
      /[£ªº&%_*]+/.test(value) ||
      /^[^A-Za-zÀ-ÿ]*$/.test(value) ||
      /\b(?:danfe|nfc|cnpj|cpf|consulta|chave|troco|pago)\b/i.test(value);
  }

  function parseFlexibleFiscalNoteItems_(text, candidateLines) {
    const rawLines = normalizeFiscalNoteText_(text).split("\n");
    const lines = rawLines.concat(candidateLines || [])
      .map(normalizeFiscalNoteLineForParsing_)
      .filter(function (line, index, list) {
        return line && list.indexOf(line) === index && !isIgnoredAlmoxFiscalLine_(line);
      });

    return lines.map(parseFiscalNoteFlexibleLine_).filter(Boolean);
  }

  function parseFiscalNoteFlexibleLine_(line, index) {
    const normalizedLine = normalizeFiscalNoteLineForParsing_(line);
    const codeMatch = normalizedLine.match(/^\s*.{0,10}?\b(\d{2,8})\b\s+(.+)$/);
    if (!codeMatch) {
      return null;
    }

    const code = codeMatch[1];
    const rest = clean(codeMatch[2]);
    const moneyMatches = Array.from(rest.matchAll(/(?:R\$\s*)?\d+(?:[.,]\d{2})\b/g));
    const unitValueMatch = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 2] : (moneyMatches[0] || null);
    const totalValueMatch = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 1] : null;
    const beforeValues = clean(unitValueMatch ? rest.slice(0, unitValueMatch.index) : rest);
    const quantityInfo = extractFlexibleFiscalQuantity_(beforeValues);

    if (!quantityInfo) {
      return null;
    }

    const product = cleanFiscalProductName_(quantityInfo.product);
    const quantity = parseNumber_(quantityInfo.quantity);
    const unit = normalizeAlmoxNoteUnit_(quantityInfo.unit || "un");
    const unitValue = unitValueMatch ? parseNumber_(unitValueMatch[0]) : 0;
    const totalValue = totalValueMatch ? parseNumber_(totalValueMatch[0]) : 0;

    if (!isValidAlmoxParsedProduct_(product) || quantity <= 0 || !unit) {
      return null;
    }

    return {
      id: createId_("almnote"),
      sourceLine: index + 1,
      code: code,
      product: product,
      quantity: quantity,
      unit: unit,
      unitValue: unitValue,
      totalValue: totalValue,
      sourceText: normalizedLine,
      category: suggestAlmoxNoteCategory_(product)
    };
  }

  function extractFlexibleFiscalQuantity_(text) {
    const unitPattern = "(UN|UND|UNID|KG|G|L|ML|LT|M2|M3|M|CX|PC|PCT|SC|RL)";
    const quantityBeforeUnit = new RegExp("^(.*?)\\s+([\\d.,]+)\\s*" + unitPattern + "\\b\\s*$", "i");
    const unitBeforeQuantity = new RegExp("^(.*?)\\s+" + unitPattern + "\\s*([\\d.,]+)\\s*$", "i");
    const withQuantityBeforeUnit = text.match(quantityBeforeUnit);
    if (withQuantityBeforeUnit) {
      return {
        product: withQuantityBeforeUnit[1],
        quantity: withQuantityBeforeUnit[2],
        unit: withQuantityBeforeUnit[3]
      };
    }

    const withUnitBeforeQuantity = text.match(unitBeforeQuantity);
    if (withUnitBeforeQuantity) {
      return {
        product: withUnitBeforeQuantity[1],
        quantity: withUnitBeforeQuantity[3],
        unit: withUnitBeforeQuantity[2]
      };
    }

    const probableQuantity = text.match(/^(.*?)\s+([\d.,]+)\s*$/);
    if (!probableQuantity || !/[a-zA-ZÀ-ÿ]/.test(probableQuantity[1])) {
      return null;
    }

    return {
      product: probableQuantity[1],
      quantity: probableQuantity[2],
      unit: "un"
    };
  }

  function dedupeFiscalItems_(items) {
    const seen = {};
    const seenDetails = {};
    almoxLastFiscalDiscardedDuplicates = [];
    return items.filter(function (item) {
      const code = clean(item.code);
      const codeKey = code ? "code:" + code : "";
      const productKey = "item:" + normalizeCompositionKey_(item.product) + ":" + normalizeUnitKey_(item.unit || "un") + ":" + parseNumber_(item.quantity);
      const duplicateKey = codeKey && seen[codeKey] ? codeKey : (seen[productKey] ? productKey : "");
      if (duplicateKey) {
        const previous = seenDetails[duplicateKey] || {};
        const currentText = item.sourceText || [item.code, item.product, item.quantity, item.unit].filter(Boolean).join(" ");
        const previousText = previous.sourceText || [previous.code, previous.product, previous.quantity, previous.unit].filter(Boolean).join(" ");
        if (normalizeCompositionKey_(currentText) !== normalizeCompositionKey_(previousText)) {
          almoxLastFiscalDiscardedDuplicates.push({
            text: currentText,
            reason: "possivel duplicata",
            item: item
          });
        }
        return false;
      }
      if (codeKey) {
        seen[codeKey] = true;
        seenDetails[codeKey] = item;
      }
      seen[productKey] = true;
      seenDetails[productKey] = item;
      return true;
    });
  }

  function dedupeAlmoxFiscalNoteItems_(items) {
    return dedupeFiscalItems_(items);
  }

  function createEmptyFiscalOcrReviewReport_() {
    return {
      totalLines: 0,
      interpretedTotal: 0,
      rejectedItems: [],
      ignoredLines: [],
      pendingLines: [],
      lowConfidenceItems: [],
      discardedDuplicates: [],
      hasRisk: false
    };
  }

  function buildFiscalOcrReviewReport_(text, items) {
    const safeItems = items || [];
    const ignoredLines = [];
    const sourceLines = normalizeFiscalNoteText_(text)
      .split("\n")
      .map(function (line, index) {
        return {
          number: index + 1,
          original: line,
          normalized: normalizeFiscalNoteLineForParsing_(line)
        };
      })
      .filter(function (line) {
        return clean(line.original);
      });

    sourceLines.forEach(function (line) {
      if (isFiscalNoiseLine_(line.normalized)) {
        ignoredLines.push({
          text: line.original,
          reason: "texto de cabecalho/rodape"
        });
      }
    });

    const pendingLines = getUnparsedFiscalLines_(sourceLines, safeItems);
    const rejectedItems = (almoxLastFiscalRejectedItems || []).slice();
    const lowConfidenceItems = getLowConfidenceFiscalItems_(safeItems);
    const discardedDuplicates = (almoxLastFiscalDiscardedDuplicates || []).slice();
    return {
      totalLines: sourceLines.length,
      interpretedTotal: safeItems.length,
      rejectedItems: rejectedItems,
      ignoredLines: ignoredLines,
      pendingLines: pendingLines,
      lowConfidenceItems: lowConfidenceItems,
      discardedDuplicates: discardedDuplicates,
      hasRisk: Boolean(pendingLines.length || rejectedItems.length || discardedDuplicates.length)
    };
  }

  function getUnparsedFiscalLines_(sourceLines, items) {
    const parsedCodes = {};
    const parsedProductKeys = {};
    (items || []).forEach(function (item) {
      if (clean(item.code)) {
        parsedCodes[clean(item.code)] = true;
      }
      parsedProductKeys[normalizeCompositionKey_(item.product)] = true;
    });

    return (sourceLines || []).filter(function (line) {
      if (!line.normalized || isFiscalNoiseLine_(line.normalized)) {
        return false;
      }
      const codeMatch = line.normalized.match(/\b(\d{2,8})\b/);
      if (codeMatch && parsedCodes[codeMatch[1]]) {
        return false;
      }
      const productKey = normalizeCompositionKey_(cleanFiscalProductName_(line.normalized));
      return productKey && !parsedProductKeys[productKey];
    }).map(function (line) {
      return {
        text: line.original,
        reason: getFiscalPendingLineReason_(line.normalized)
      };
    });
  }

  function getFiscalPendingLineReason_(line) {
    if (isFiscalNoiseLine_(line)) {
      return "texto de cabecalho/rodape";
    }
    if (!/\b\d{2,8}\b/.test(line)) {
      return "linha sem codigo";
    }
    if (!/[a-zA-ZÀ-ÿ]{3,}/.test(line)) {
      return "produto incompleto";
    }
    if (!/([\d.,]+)\s*(UN|UND|UNID|KG|G|L|ML|LT|M2|M3|M|CX|PC|PCT|SC|RL)\b/i.test(line) &&
        !/\b(UN|UND|UNID|KG|G|L|ML|LT|M2|M3|M|CX|PC|PCT|SC|RL)\s*([\d.,]+)/i.test(line)) {
      return "quantidade nao identificada";
    }
    if (!/\d+(?:[.,]\d{2})\b/.test(line)) {
      return "valor nao identificado";
    }
    if (/[^0-9A-Za-zÀ-ÿ\s.,()/\-]/.test(line)) {
      return "baixa confianca do OCR";
    }
    return "produto incompleto";
  }

  function getFiscalItemQualityScore_(item) {
    let score = 0;
    const product = clean(item && item.product);
    if (clean(item && item.code)) {
      score += 20;
    }
    if (product.length >= 4 && isValidAlmoxParsedProduct_(product)) {
      score += 25;
    }
    if (parseNumber_(item && item.quantity) > 0) {
      score += 20;
    }
    if (clean(item && item.unit)) {
      score += 10;
    }
    if (parseNumber_(item && item.unitValue) > 0) {
      score += 10;
    }
    if (parseNumber_(item && item.totalValue) > 0) {
      score += 10;
    }
    if (product && !/[^0-9A-Za-zÀ-ÿ\s.,()/\-]/.test(product)) {
      score += 5;
    }
    return score;
  }

  function getUnparsedFiscalLineText_() {
    const pending = (almoxFiscalOcrReviewData.pendingLines || []).concat(almoxFiscalOcrReviewData.rejectedItems || []);
    return pending.map(function (line) {
      return line.text;
    }).join("\n");
  }

  function registerFiscalRejectedLine_(line, reason) {
    const text = clean(line);
    if (!text || isFiscalNoiseLine_(text)) {
      return;
    }
    const key = normalizeCompositionKey_(text);
    if ((almoxLastFiscalRejectedItems || []).some(function (item) {
      return normalizeCompositionKey_(item.text) === key;
    })) {
      return;
    }
    almoxLastFiscalRejectedItems.push({
      text: text,
      reason: reason || "baixa confianca do OCR"
    });
  }

  function getLowConfidenceFiscalItems_(items) {
    return (items || []).map(function (item) {
      return {
        item: item,
        score: getFiscalItemQualityScore_(item)
      };
    }).filter(function (entry) {
      return entry.score < 90;
    });
  }

  function hasFiscalOcrReviewRisk_(report) {
    return Boolean(report && report.hasRisk);
  }

  function renderFiscalOcrReviewReport_(report) {
    if (!almoxFiscalOcrReview) {
      return;
    }

    const safeReport = report || createEmptyFiscalOcrReviewReport_();
    almoxFiscalOcrReview.innerHTML = "";
    almoxFiscalOcrReview.className = "almox-ocr-review" + (!safeReport.totalLines ? " is-empty" : "") + (safeReport.hasRisk ? " has-risk" : "");

    const title = document.createElement("strong");
    title.textContent = "Conferencia da leitura da nota";
    almoxFiscalOcrReview.appendChild(title);

    if (!safeReport.totalLines) {
      const empty = document.createElement("p");
      empty.textContent = "Interprete uma nota para ver linhas pendentes, duplicatas e itens de baixa confianca.";
      almoxFiscalOcrReview.appendChild(empty);
      return;
    }

    const summary = document.createElement("div");
    summary.className = "almox-ocr-review-summary";
    [
      ["Linhas analisadas", safeReport.totalLines],
      ["Itens aceitos", safeReport.interpretedTotal],
      ["Itens rejeitados", safeReport.rejectedItems.length],
      ["Linhas ignoradas", safeReport.ignoredLines.length],
      ["Pendentes", safeReport.pendingLines.length],
      ["Duplicatas descartadas", safeReport.discardedDuplicates.length]
    ].forEach(function (item) {
      const card = document.createElement("span");
      card.innerHTML = "<small>" + item[0] + "</small><b>" + item[1] + "</b>";
      summary.appendChild(card);
    });
    almoxFiscalOcrReview.appendChild(summary);

    if (safeReport.hasRisk) {
      const warning = document.createElement("p");
      warning.className = "almox-ocr-review-warning";
      warning.textContent = "Por seguranca, itens com baixa confianca nao foram lancados na tabela principal. Revise as pendencias e adicione manualmente, se necessario.";
      almoxFiscalOcrReview.appendChild(warning);
    }

    appendFiscalReviewList_(almoxFiscalOcrReview, "Itens rejeitados", safeReport.rejectedItems.map(function (line) {
      return line.text + " - " + line.reason;
    }), "Nenhum item rejeitado.");

    appendFiscalReviewList_(almoxFiscalOcrReview, "Linhas possivelmente nao interpretadas", safeReport.pendingLines.map(function (line) {
      return line.text + " - " + line.reason;
    }), "Nenhuma linha pendente.");

    appendFiscalReviewList_(almoxFiscalOcrReview, "Duplicatas descartadas", safeReport.discardedDuplicates.map(function (line) {
      return line.text + " - " + line.reason;
    }), "Nenhuma duplicata descartada.");

    const actions = document.createElement("div");
    actions.className = "almox-ocr-review-actions";
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "mini-button";
    copyButton.dataset.fiscalReviewCopy = "true";
    copyButton.textContent = "Copiar pendencias";
    const manualButton = document.createElement("button");
    manualButton.type = "button";
    manualButton.className = "mini-button primary";
    manualButton.dataset.fiscalReviewManual = "true";
    manualButton.textContent = "Adicionar item manualmente";
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "mini-button";
    clearButton.dataset.fiscalReviewClear = "true";
    clearButton.textContent = "Limpar leitura";
    const reprocessButton = document.createElement("button");
    reprocessButton.type = "button";
    reprocessButton.className = "mini-button";
    reprocessButton.dataset.fiscalReviewReprocess = "true";
    reprocessButton.textContent = "Reprocessar texto colado";
    actions.appendChild(copyButton);
    actions.appendChild(manualButton);
    actions.appendChild(clearButton);
    actions.appendChild(reprocessButton);
    almoxFiscalOcrReview.appendChild(actions);
  }

  function appendFiscalReviewList_(container, title, items, emptyText) {
    const section = document.createElement("div");
    section.className = "almox-ocr-review-list";
    const heading = document.createElement("b");
    heading.textContent = title;
    section.appendChild(heading);
    const list = document.createElement("ul");
    (items.length ? items : [emptyText]).forEach(function (item) {
      const row = document.createElement("li");
      row.textContent = item;
      list.appendChild(row);
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  function handleCopyFiscalPendingLines_() {
    const text = getUnparsedFiscalLineText_();
    if (!text) {
      setAlmoxNoteStatus_("Nao ha linhas pendentes para copiar.", "info");
      return;
    }
    copyTextFallback_(text);
    setAlmoxNoteStatus_("Linhas pendentes copiadas para conferencia.", "success");
  }

  function handleAddFiscalManualItem_() {
    syncAlmoxParsedNoteItemsFromTable_();
    almoxParsedNoteItems.push({
      id: createId_("almnote"),
      sourceLine: 0,
      code: "",
      product: "",
      quantity: 1,
      unit: "un",
      unitValue: 0,
      totalValue: 0,
      category: "Geral",
      sourceText: "Item manual"
    });
    renderAlmoxParsedNoteItems_();
    setAlmoxNoteStatus_("Linha manual adicionada. Preencha produto, quantidade e unidade antes de lancar.", "info");
  }

  function buildAlmoxFiscalCandidateLines_(text) {
    const lines = cleanOcrText_(text).split("\n").filter(Boolean);
    const candidates = [];
    let pending = "";

    lines.forEach(function (line) {
      const normalized = normalizeAlmoxFiscalLine_(line);
      if (!normalized || isIgnoredAlmoxFiscalLine_(normalized)) {
        return;
      }

      const joined = pending ? pending + " " + normalized : normalized;
      if (hasAlmoxFiscalQuantitySignal_(normalized) || hasAlmoxFiscalQuantitySignal_(joined)) {
        candidates.push(joined);
        pending = "";
        return;
      }

      if (looksLikeAlmoxProductLine_(normalized)) {
        if (pending) {
          candidates.push(pending);
        }
        pending = normalized;
      } else if (pending) {
        pending += " " + normalized;
      }
    });

    if (pending && hasAlmoxFiscalQuantitySignal_(pending)) {
      candidates.push(pending);
    }

    return candidates.length ? candidates : lines.map(normalizeAlmoxFiscalLine_).filter(function (line) {
      return line && !isIgnoredAlmoxFiscalLine_(line);
    });
  }

  function normalizeAlmoxFiscalLine_(line) {
    return clean(line)
      .replace(/[|]+/g, " ")
      .replace(/[;]+/g, " ")
      .replace(/\b0CR\b/ig, "OCR")
      .replace(/\bQTO\b/ig, "QTD")
      .replace(/\bQTDE\b/ig, "QTD")
      .replace(/\bQUANT(?:IDADE)?\b/ig, "QTD")
      .replace(/\bV(?:AL)?\.?\s*UNIT(?:ARIO)?\b/ig, "VLR UNIT")
      .replace(/\bVL(?:R)?\.?\s*UN(?:IT)?\b/ig, "VLR UNIT")
      .replace(/\bV(?:AL)?\.?\s*TOTAL\b/ig, "VLR TOTAL")
      .replace(/\bM\s*3\b/ig, "M3")
      .replace(/\bM\s*2\b/ig, "M2")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isFiscalNoiseLine_(line) {
    const key = normalizeCompositionKey_(line);
    if (!key) {
      return true;
    }

    return [
      "danfe",
      "documento auxiliar",
      "nota fiscal",
      "chave de acesso",
      "emitente",
      "destinatario",
      "inscricao estadual",
      "cnpj",
      "cpf",
      "protocolo",
      "natureza da operacao",
      "base de calculo",
      "valor do icms",
      "valor total",
      "valor total da nota",
      "dados do produto",
      "descricao dos produtos",
      "cod descricao",
      "cod descri",
      "coddescr",
      "qtd total de itens",
      "forma de pagamento",
      "pagamento",
      "troco",
      "pago",
      "qr code",
      "consulta pela chave",
      "codigo descricao ncm",
      "ncm cst cfop"
    ].some(function (token) {
      return key.indexOf(token) >= 0;
    });
  }

  function isIgnoredAlmoxFiscalLine_(line) {
    return isFiscalNoiseLine_(line);
  }

  function hasAlmoxFiscalQuantitySignal_(line) {
    const normalized = normalizeAlmoxFiscalLine_(line);
    return /\bQTD\.?\s*:?\s*[\d.,]+/i.test(normalized) ||
      /\b(?:UN|UND|UNID|M2|M3|M|KG|G|L|LT|SC|SACO|SACOS|PCT|PC|CX)\b\s+[\d.,]+(?:\s+(?:R\$\s*)?[\d.,]+){0,3}\s*$/i.test(normalized) ||
      /[\d.,]+\s*\b(?:UN|UND|UNID|M2|M3|M|KG|G|L|LT|SC|SACO|SACOS|PCT|PC|CX)\b/i.test(normalized);
  }

  function looksLikeAlmoxProductLine_(line) {
    const key = normalizeCompositionKey_(line);
    return key.length >= 4 &&
      /[a-zA-ZÀ-ÿ]/.test(line) &&
      !/^\d{6,}/.test(line) &&
      !isIgnoredAlmoxFiscalLine_(line);
  }

  function parseAlmoxFiscalLine_(line, index) {
    const originalLine = normalizeAlmoxFiscalLine_(line);
    const parsed = parseAlmoxExplicitQuantityLine_(originalLine, index) ||
      parseAlmoxTrailingQuantityLine_(originalLine, index) ||
      parseAlmoxTableQuantityLine_(originalLine, index);

    return parsed && clean(parsed.product) && parseNumber_(parsed.quantity) > 0 && clean(parsed.unit) ? parsed : null;
  }

  function parseAlmoxExplicitQuantityLine_(line, index) {
    const quantityMatch = line.match(/\bQTD\.?\s*:?\s*([\d.,]+)\s*([a-zA-ZÀ-ÿ0-9²³]+)?/i);
    if (!quantityMatch) {
      return null;
    }

    const product = cleanAlmoxParsedProduct_(line.slice(0, quantityMatch.index));
    const quantity = parseNumber_(quantityMatch[1]);
    const unit = normalizeAlmoxNoteUnit_(quantityMatch[2] || findAlmoxUnitNearQuantity_(line, quantityMatch.index + quantityMatch[0].length) || "un");
    return createAlmoxParsedFiscalItem_(line, index, product, quantity, unit);
  }

  function parseAlmoxTableQuantityLine_(line, index) {
    const tokens = line.split(" ").filter(Boolean);
    const unitIndex = tokens.findIndex(function (token, tokenIndex) {
      return isAlmoxFiscalUnitToken_(token) && tokenIndex + 1 < tokens.length && parseNumber_(tokens[tokenIndex + 1]) > 0;
    });

    if (unitIndex <= 0) {
      return null;
    }

    const product = cleanAlmoxParsedProduct_(tokens.slice(0, unitIndex).join(" "));
    const unit = normalizeAlmoxNoteUnit_(tokens[unitIndex]);
    const quantity = parseNumber_(tokens[unitIndex + 1]);
    return createAlmoxParsedFiscalItem_(line, index, product, quantity, unit);
  }

  function parseAlmoxTrailingQuantityLine_(line, index) {
    const match = line.match(/^(.*?)\s+([\d.,]+)\s*(UN|UND|UNID|M2|M3|M|KG|G|L|LT|SC|SACO|SACOS|PCT|PC|CX)\b/i);
    if (!match) {
      return null;
    }

    const product = cleanAlmoxParsedProduct_(match[1]);
    const quantity = parseNumber_(match[2]);
    const unit = normalizeAlmoxNoteUnit_(match[3]);
    return createAlmoxParsedFiscalItem_(line, index, product, quantity, unit);
  }

  function createAlmoxParsedFiscalItem_(line, index, product, quantity, unit) {
    const unitValueMatch = line.match(/\bVLR\s*UNIT\.?\s*(?:R\$\s*)?([\d.,]+)/i) ||
      line.match(/\bUNITARIO\.?\s*(?:R\$\s*)?([\d.,]+)/i);
    const totalValueMatch = line.match(/\bVLR\s*TOTAL\.?\s*(?:R\$\s*)?([\d.,]+)/i) ||
      line.match(/\bTOTAL\.?\s*(?:R\$\s*)?([\d.,]+)\s*$/i);
    const trailingNumbers = extractAlmoxFiscalTrailingNumbers_(line);
    const unitValue = unitValueMatch ? parseNumber_(unitValueMatch[1]) : 0;
    const fallbackUnitValue = !unitValue && trailingNumbers.length >= 2
      ? trailingNumbers[trailingNumbers.length - 2]
      : (!unitValue && trailingNumbers.length === 1 ? trailingNumbers[0] : 0);
    const safeUnitValue = unitValue || fallbackUnitValue;
    const totalValue = totalValueMatch
      ? parseNumber_(totalValueMatch[1])
      : (!unitValueMatch && trailingNumbers.length >= 2 ? trailingNumbers[trailingNumbers.length - 1] : roundQuantity_(quantity * safeUnitValue));

    if (!product || quantity <= 0) {
      return null;
    }

    return {
      id: createId_("almnote"),
      sourceLine: index + 1,
      code: "",
      product: product,
      quantity: quantity,
      unit: unit,
      unitValue: safeUnitValue,
      totalValue: totalValue,
      category: suggestAlmoxNoteCategory_(product)
    };
  }

  function findAlmoxUnitNearQuantity_(line, startIndex) {
    const rest = line.slice(startIndex);
    const match = rest.match(/\b(UN|UND|UNID|M2|M3|M|KG|G|L|LT|SC|SACO|SACOS|PCT|PC|CX)\b/i);
    return match ? match[1] : "";
  }

  function isAlmoxFiscalUnitToken_(token) {
    return /^(UN|UND|UNID|M2|M3|M|KG|G|L|LT|SC|SACO|SACOS|PCT|PC|CX)$/i.test(clean(token));
  }

  function cleanFiscalProductName_(product) {
    return clean(product)
      .replace(/^[^\dA-Za-zÀ-ÿ]+/, "")
      .replace(/^[wWfij%\s-]+(?=\d{2,8}\s+)/, "")
      .replace(/^\d+\s+/, "")
      .replace(/\b(?:COD|CODIGO|CÓDIGO|NCM|CEST|CFOP|CST|CSOSN)\b.*$/i, "")
      .replace(/\b\d{7,14}\b/g, "")
      .replace(/(?:\s+\d{2,}(?:[./-]?\d+)*){2,}$/g, "")
      .replace(/[£ªº&%_]+/g, " ")
      .replace(/\s+[-:.,;]+/g, " ")
      .replace(/[-:.,;]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanAlmoxParsedProduct_(product) {
    return cleanFiscalProductName_(product);
    return clean(product)
      .replace(/^\d+\s+/, "")
      .replace(/\b(?:COD|CODIGO|CÓDIGO|NCM|CEST|CFOP|CST|CSOSN)\b.*$/i, "")
      .replace(/\b\d{7,14}\b/g, "")
      .replace(/(?:\s+\d{2,}(?:[./-]?\d+)*){2,}$/g, "")
      .replace(/[-:.,;]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isValidAlmoxParsedProduct_(product) {
    const value = clean(product);
    const key = normalizeCompositionKey_(value);
    return value.length >= 3 &&
      /[a-zA-ZÀ-ÿ]/.test(value) &&
      key.indexOf("cod descricao") < 0 &&
      key.indexOf("descricao qtd") < 0 &&
      key.indexOf("valor total") < 0 &&
      key.indexOf("pagamento") < 0 &&
      !/^[\W\d_]+$/.test(value);
  }

  function extractAlmoxFiscalTrailingNumbers_(line) {
    const matches = clean(line).match(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2}/g) || [];
    return matches.map(parseNumber_).filter(function (value) {
      return value > 0;
    });
  }

  function renderAlmoxParsedNoteItems_() {
    if (!almoxNoteRows) {
      return;
    }

    almoxNoteRows.innerHTML = "";

    if (!almoxParsedNoteItems.length) {
      appendStockIaEmptyRow_(almoxNoteRows, 6, "Nenhum item interpretado.");
      return;
    }

    almoxParsedNoteItems.forEach(function (item) {
      const row = document.createElement("tr");
      row.dataset.almoxNoteId = item.id;

      appendAlmoxNoteInputCell_(row, "code", item.code || "", "text");
      appendAlmoxNoteInputCell_(row, "product", item.product, "text");
      appendAlmoxNoteInputCell_(row, "quantity", String(item.quantity), "number", "0.001");
      appendAlmoxNoteInputCell_(row, "unit", item.unit, "text");
      appendAlmoxNoteInputCell_(row, "unitValue", item.unitValue ? String(item.unitValue).replace(".", ",") : "", "text");
      appendAlmoxNoteInputCell_(row, "totalValue", item.totalValue ? String(item.totalValue).replace(".", ",") : "", "text");

      almoxNoteRows.appendChild(row);
    });
  }

  function appendAlmoxNoteInputCell_(row, field, value, type, step) {
    const cell = document.createElement("td");
    const input = document.createElement("input");
    input.type = type || "text";
    input.value = value || "";
    input.dataset.almoxNoteField = field;
    if (step) {
      input.step = step;
    }
    cell.appendChild(input);
    row.appendChild(cell);
  }

  function syncAlmoxParsedNoteItemsFromTable_() {
    if (!almoxNoteRows) {
      return;
    }

    const rows = Array.prototype.slice.call(almoxNoteRows.querySelectorAll("tr[data-almox-note-id]"));
    almoxParsedNoteItems = rows.map(function (row) {
      const current = almoxParsedNoteItems.find(function (item) {
        return item.id === row.dataset.almoxNoteId;
      }) || {};

      return {
        id: row.dataset.almoxNoteId,
        sourceLine: current.sourceLine || 0,
        code: getAlmoxNoteFieldValue_(row, "code"),
        product: getAlmoxNoteFieldValue_(row, "product"),
        quantity: parseNumber_(getAlmoxNoteFieldValue_(row, "quantity")),
        unit: normalizeAlmoxNoteUnit_(getAlmoxNoteFieldValue_(row, "unit")),
        unitValue: parseNumber_(getAlmoxNoteFieldValue_(row, "unitValue")),
        totalValue: parseNumber_(getAlmoxNoteFieldValue_(row, "totalValue")),
        category: clean(getAlmoxNoteFieldValue_(row, "category")) || suggestAlmoxNoteCategory_(getAlmoxNoteFieldValue_(row, "product"))
      };
    }).filter(function (item) {
      return clean(item.product) && parseNumber_(item.quantity) > 0 && clean(item.unit);
    });
  }

  function getAlmoxNoteFieldValue_(row, field) {
    const input = row.querySelector("[data-almox-note-field='" + field + "']");
    return clean(input && input.value);
  }

  function removeAlmoxParsedNoteItem_(itemId) {
    syncAlmoxParsedNoteItemsFromTable_();
    almoxParsedNoteItems = almoxParsedNoteItems.filter(function (item) {
      return item.id !== itemId;
    });
    renderAlmoxParsedNoteItems_();
    setAlmoxNoteStatus_(almoxParsedNoteItems.length ? "Confira os itens antes de lancar no estoque." : "Nenhum item interpretado.", "info");
  }

  function findAlmoxItemFromNote_(state, noteItem) {
    const productKey = normalizeCompositionKey_(noteItem.product);
    const unitKey = normalizeUnitKey_(noteItem.unit || "un");
    const code = clean(noteItem.code);
    const environmentId = getActiveStockEnvironmentId_();

    return (state.items || []).find(function (item) {
      return clean(item.environmentId) === environmentId &&
        ((code && clean(item.fiscalCode) === code) ||
          (normalizeCompositionKey_(item.name) === productKey &&
            normalizeUnitKey_(item.unit || "un") === unitKey));
    }) || null;
  }

  function suggestAlmoxNoteCategory_(product) {
    const key = normalizeCompositionKey_(product);

    if (key.indexOf("cimento") >= 0) {
      return "Cimento";
    }
    if (key.indexOf("areia") >= 0 || key.indexOf("brita") >= 0) {
      return "Agregado";
    }
    if (key.indexOf("bloco") >= 0 || key.indexOf("tijolo") >= 0) {
      return "Alvenaria";
    }
    if (key.indexOf("piso") >= 0 || key.indexOf("revestimento") >= 0) {
      return "Revestimento";
    }
    if (key.indexOf("argamassa") >= 0 || key.indexOf("rejunte") >= 0) {
      return "Acabamento";
    }
    if (key.indexOf("cabo") >= 0 || key.indexOf("fio") >= 0) {
      return "Eletrica";
    }
    if (key.indexOf("tubo") >= 0 || key.indexOf("pvc") >= 0) {
      return "Hidraulica";
    }
    if (key.indexOf("telha") >= 0) {
      return "Cobertura";
    }

    return "Geral";
  }

  function normalizeAlmoxNoteUnit_(unit) {
    const key = normalizeUnitKey_(unit || "un");
    const units = {
      un: "un",
      und: "un",
      unidade: "un",
      unidades: "un",
      m: "m",
      metro: "m",
      metros: "m",
      m2: "m2",
      m3: "m3",
      kg: "kg",
      g: "g",
      l: "L",
      lt: "L",
      ml: "ml",
      saco: "saco",
      sacos: "saco",
      sc: "saco",
      pc: "un",
      pct: "pacote",
      pacote: "pacote",
      cx: "caixa",
      rl: "rolo"
    };

    return units[key] || clean(unit) || "un";
  }

  function buildAlmoxNoteEntryNotes_(noteItem, origin) {
    const parts = ["Entrada criada por " + (origin || "nota fiscal interpretada") + "."];

    if (parseNumber_(noteItem.unitValue) > 0) {
      parts.push("Valor unitario: " + formatCurrency_(noteItem.unitValue) + ".");
    }
    if (parseNumber_(noteItem.totalValue) > 0) {
      parts.push("Valor total: " + formatCurrency_(noteItem.totalValue) + ".");
    }
    if (clean(noteItem.code)) {
      parts.push("Codigo fiscal/produto: " + clean(noteItem.code) + ".");
    }
    if (clean(noteItem.category)) {
      parts.push("Categoria sugerida: " + clean(noteItem.category) + ".");
    }
    if (almoxNoteFileDraft) {
      parts.push("Arquivo: " + almoxNoteFileDraft.name + " (" + formatBytes_(almoxNoteFileDraft.size) + ").");
    }

    return parts.join(" ");
  }

  function setAlmoxNoteStatus_(message, type) {
    if (!almoxNoteStatus) {
      return;
    }

    almoxNoteStatus.textContent = message;
    almoxNoteStatus.className = "almox-note-status " + (type || "info");
  }

  function renderStockEnvironmentHome_() {
    renderActiveStockEnvironmentHeader_();
  }

  function renderActiveStockEnvironmentHeader_() {
    const container = document.getElementById("almoxEnvironmentHeader");
    if (!container) {
      return;
    }

    const environment = getActiveStockEnvironment_();
    const environments = getStockEnvironments_();
    container.innerHTML = "";

    const info = document.createElement("div");
    const eyebrow = document.createElement("p");
    const title = document.createElement("h3");
    const subtitle = document.createElement("span");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Ambiente ativo";
    title.textContent = formatStockEnvironmentTitle_(environment);
    subtitle.className = "auth-note";
    subtitle.textContent = environment.mode === "obra"
      ? "Stock IA Obra filtrando itens, histórico, dashboard e auditoria deste ambiente."
      : "Almoxarifado IA filtrando itens, histórico, dashboard e auditoria desta unidade.";
    info.appendChild(eyebrow);
    info.appendChild(title);
    info.appendChild(subtitle);

    const actions = document.createElement("div");
    const select = document.createElement("select");
    const createButton = document.createElement("button");
    actions.className = "almox-environment-actions";
    select.id = "almoxEnvironmentSelect";
    environments.forEach(function (item) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = formatStockEnvironmentTitle_(item);
      option.selected = item.id === environment.id;
      select.appendChild(option);
    });
    select.addEventListener("change", function () {
      setActiveStockEnvironment_(select.value);
    });
    createButton.type = "button";
    createButton.className = "mini-button";
    createButton.textContent = "Novo ambiente";
    createButton.addEventListener("click", function () {
      renderStockEnvironmentForm_();
    });
    actions.appendChild(select);
    actions.appendChild(createButton);

    container.appendChild(info);
    container.appendChild(actions);
  }

  function renderAlmoxDemoAccessPanel_() {
    if (!almoxDemoAccessPanel) {
      return;
    }

    if (!isStockAiPublicDemo_()) {
      almoxDemoAccessPanel.classList.add("is-hidden");
      almoxDemoAccessPanel.innerHTML = "";
      return;
    }

    const environment = getActiveStockEnvironment_();
    const role = getStockDemoRole_();
    const user = getStockDemoUser_();
    const requests = filterStockApprovalRequestsByActiveEnvironment_(loadAlmoxState_().approvalRequests);
    const pending = requests.filter(function (request) { return request.status === "pending"; });
    const approved = requests.filter(function (request) { return request.status === "approved"; });
    const rejected = requests.filter(function (request) { return request.status === "rejected"; });
    const visibleRequests = role === "gestor"
      ? pending.concat(requests.filter(function (request) { return request.status !== "pending"; }).slice(0, 4))
      : requests.filter(function (request) {
        return request.userId === user.id || request.role === "almoxarife";
      }).slice(0, 6);

    almoxDemoAccessPanel.classList.remove("is-hidden");
    almoxDemoAccessPanel.innerHTML = [
      "<div class=\"stock-demo-access-grid\">",
      "<div class=\"stock-demo-access-copy\">",
      "<p class=\"eyebrow\">Acesso Stock AI</p>",
      "<h3>" + escapeHtml_(formatStockEnvironmentTitle_(environment)) + "</h3>",
      "<p>Use a demo comercial com dois perfis: almoxarife solicita entradas/saidas e gestor aprova antes de alterar o estoque oficial.</p>",
      "<div class=\"stock-demo-access-actions\" aria-label=\"Acesso do Stock AI\">",
      "<button type=\"button\" class=\"mini-button primary\" data-stock-demo-role=\"gestor\">Entrar como gestor</button>",
      "<button type=\"button\" class=\"mini-button\" data-stock-demo-role=\"almoxarife\">Entrar como almoxarife</button>",
      "<button type=\"button\" class=\"mini-button\" data-stock-demo-action=\"create-organization\">Cadastrar organizacao</button>",
      "<button type=\"button\" class=\"mini-button\" data-stock-demo-action=\"demo-organization\">Acessar demonstracao</button>",
      "</div>",
      "</div>",
      "<div class=\"stock-demo-profile-card\">",
      "<span>Perfil ativo</span>",
      "<strong>" + escapeHtml_(role === "gestor" ? "Gestor" : "Almoxarife") + "</strong>",
      "<small>" + escapeHtml_(user.email) + "</small>",
      "<p>" + (role === "gestor"
        ? "Aprova ou rejeita solicitacoes e acompanha saldo oficial."
        : "Registra solicitacoes. O estoque so muda apos aprovacao do gestor.") + "</p>",
      "</div>",
      "</div>",
      "<div class=\"stock-demo-approval-panel\">",
      "<div class=\"stock-demo-approval-head\">",
      "<div>",
      "<span>Fluxo de aprovacao</span>",
      "<strong>" + pending.length + " pendente(s)</strong>",
      "</div>",
      "<div class=\"stock-demo-approval-metrics\">",
      "<b>" + approved.length + "</b><small>Aprovadas</small>",
      "<b>" + rejected.length + "</b><small>Rejeitadas</small>",
      "</div>",
      "</div>",
      renderStockApprovalRequestsHtml_(visibleRequests, role),
      "</div>"
    ].join("");
  }

  function renderStockApprovalRequestsHtml_(requests, role) {
    if (!requests.length) {
      return "<p class=\"stock-demo-empty\">Nenhuma solicitacao registrada neste ambiente.</p>";
    }

    return "<div class=\"stock-demo-request-list\">" + requests.map(function (request) {
      const item = findAlmoxItemById_(request.payload && request.payload.itemId);
      const itemName = item.name || (request.payload && request.payload.product) || "Item";
      const itemUnit = item.unit || (request.payload && request.payload.unit) || "un";
      const typeLabel = request.type === "entrada" ? "Entrada" : "Saida";
      const statusLabel = request.status === "approved" ? "Aprovada" : (request.status === "rejected" ? "Rejeitada" : "Pendente");
      const canApprove = role === "gestor" && request.status === "pending";
      return [
        "<article class=\"stock-demo-request " + escapeAttribute_("is-" + request.status) + "\">",
        "<div>",
        "<span>" + escapeHtml_(statusLabel) + "</span>",
        "<strong>" + escapeHtml_(typeLabel + " - " + itemName) + "</strong>",
        "<small>" + escapeHtml_(formatQuantity_(request.payload && request.payload.quantity) + " " + itemUnit + " | " + (request.createdByName || "Almoxarife")) + "</small>",
        "</div>",
        canApprove ? "<div class=\"stock-demo-request-actions\"><button type=\"button\" class=\"mini-button primary\" data-stock-approval-action=\"approve\" data-stock-approval-id=\"" + escapeAttribute_(request.id) + "\">Aprovar</button><button type=\"button\" class=\"mini-button\" data-stock-approval-action=\"reject\" data-stock-approval-id=\"" + escapeAttribute_(request.id) + "\">Rejeitar</button></div>" : "",
        "</article>"
      ].join("");
    }).join("") + "</div>";
  }

  function handleStockDemoAction_(action) {
    if (action === "create-organization") {
      renderStockEnvironmentForm_();
      scrollToAlmoxSection_("almoxEnvironmentHeader");
      return;
    }

    if (action === "demo-organization") {
      createStockDemoOrganization_();
      return;
    }
  }

  function createStockDemoOrganization_() {
    const state = loadAlmoxState_();
    const existing = state.stockEnvironments.find(function (environment) {
      return normalizeStockEnvironmentTitlePart_(environment.clientName) === "prefeitura sao joao";
    });

    if (existing) {
      setActiveStockEnvironment_(existing.id);
      setStockDemoRole_("gestor");
      showAlmoxToast_("Demonstracao Prefeitura Sao Joao carregada.", "success");
      return;
    }

    const environment = createStockEnvironment_({
      mode: "almoxarifado",
      clientName: "Prefeitura Sao Joao",
      institutionType: "Prefeitura",
      unitName: "Secretaria de Saude",
      environmentName: "Almoxarifado Central",
      responsible: "Gestor da Secretaria",
      managerEmail: "secretaria@prefeiturasaojoao.demo",
      warehouseEmail: "almoxarife@prefeiturasaojoao.demo"
    });
    setStockDemoRole_("gestor");
    showAlmoxToast_(environment ? "Organizacao demo criada." : "Demonstracao carregada.", "success");
  }

  function renderStockEnvironmentForm_() {
    const container = document.getElementById("almoxEnvironmentHeader");
    if (!container) {
      return;
    }

    const form = document.createElement("form");
    const heading = document.createElement("div");
    const eyebrow = document.createElement("p");
    const title = document.createElement("h3");
    const modeLabel = document.createElement("label");
    const modeSelect = document.createElement("select");
    const actions = document.createElement("div");
    const submit = document.createElement("button");
    const cancel = document.createElement("button");
    form.className = "almox-environment-form";
    form.id = "almoxEnvironmentForm";
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Novo ambiente";
    title.textContent = "Criar ambiente Stock IA";
    heading.appendChild(eyebrow);
    heading.appendChild(title);

    modeLabel.textContent = "Tipo";
    modeSelect.name = "mode";
    appendOption_(modeSelect, "almoxarifado", "Almoxarifado IA");
    appendOption_(modeSelect, "obra", "Stock IA Obra");
    modeLabel.appendChild(modeSelect);

    actions.className = "almox-environment-actions";
    submit.type = "submit";
    submit.className = "mini-button primary";
    submit.textContent = "Salvar ambiente";
    cancel.type = "button";
    cancel.className = "mini-button";
    cancel.textContent = "Cancelar";
    cancel.addEventListener("click", renderActiveStockEnvironmentHeader_);
    actions.appendChild(submit);
    actions.appendChild(cancel);

    form.appendChild(heading);
    form.appendChild(modeLabel);
    appendStockIaField_(form, "clientName", "Cliente / instituição", "text", "", true);
    appendStockIaField_(form, "unitName", "Obra ou unidade/setor", "text", "", false);
    appendStockIaField_(form, "environmentName", "Nome do ambiente", "text", "", true);
    appendStockIaField_(form, "responsible", "Responsável", "text", "", false);
    appendStockIaField_(form, "managerEmail", "E-mail do gestor", "email", "", false);
    appendStockIaField_(form, "warehouseEmail", "E-mail do almoxarife", "email", "", false);
    form.appendChild(actions);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const formData = new FormData(form);
      createStockEnvironment_({
        mode: formData.get("mode"),
        clientName: formData.get("clientName"),
        workName: formData.get("mode") === "obra" ? formData.get("unitName") : "",
        institutionType: "",
        unitName: formData.get("mode") === "almoxarifado" ? formData.get("unitName") : "",
        environmentName: formData.get("environmentName"),
        responsible: formData.get("responsible"),
        managerEmail: formData.get("managerEmail"),
        warehouseEmail: formData.get("warehouseEmail")
      });
    });

    container.innerHTML = "";
    container.appendChild(form);
  }

  function formatStockEnvironmentTitle_(environment) {
    const main = clean(environment && environment.clientName) || "Cliente";
    const location = environment && environment.mode === "obra"
      ? clean(environment.workName)
      : clean(environment && environment.unitName);
    const name = clean(environment && environment.environmentName);
    const normalizedLocation = normalizeStockEnvironmentTitlePart_(location);
    const normalizedName = normalizeStockEnvironmentTitlePart_(name);
    const shouldShowLocation = Boolean(
      location &&
      normalizeStockEnvironmentTitlePart_(main) !== normalizedLocation &&
      normalizedName !== normalizedLocation &&
      normalizedName.indexOf(normalizedLocation + " ") !== 0 &&
      normalizedLocation !== "almoxarifado"
    );

    return [main, shouldShowLocation ? location : "", name].filter(Boolean).join(" - ");
  }

  function normalizeStockEnvironmentTitlePart_(value) {
    const text = clean(value).toLowerCase();
    if (!text) {
      return "";
    }

    return typeof text.normalize === "function"
      ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      : text;
  }

  function renderAlmoxarifadoPanel_() {
    ensureAlmoxEnvironmentMigrationPersisted_();
    applyStockAiPublicUrlContext_();
    startStockDemoRemoteSync_();
    renderActiveStockEnvironmentHeader_();
    renderAlmoxDemoAccessPanel_();
    renderAlmoxSelects_();
    renderAlmoxSummaryCards_();
    renderAlmoxFlowStatus_();
    renderAlmoxDashboard_();
    renderAlmoxTopManagerPanel_();
    renderAlmoxItems_();
    renderAlmoxHistory_();
    renderAlmoxParsedNoteItems_();

    if (almoxSummaryText) {
      almoxSummaryText.textContent = buildAlmoxSummaryText_();
    }

    [almoxEntryForm, almoxExitForm].forEach(function (form) {
      if (form && form.elements.date && !form.elements.date.value) {
        form.elements.date.value = getDefaultAlmoxMovementDate_();
      }
      if (form && form.elements.movementDate && !form.elements.movementDate.value) {
        form.elements.movementDate.value = getDefaultAlmoxMovementDate_();
      }
      if (form && form.elements.movementTime && !form.elements.movementTime.value) {
        form.elements.movementTime.value = getDefaultAlmoxMovementTime_();
      }
    });
  }

  function openAlmoxModal_(type, payload) {
    if (type === "history") {
      const state = loadAlmoxState_();
      const item = state.items.find(function (candidate) {
        return candidate.id === (payload && payload.itemId);
      });

      if (item) {
        almoxSearchTerm = item.name || "";
        if (almoxSearchInput) {
          almoxSearchInput.value = almoxSearchTerm;
        }
        renderAlmoxarifadoPanel_();
        showAlmoxToast_("Histórico filtrado por " + item.name + ".", "info");
      }
      return;
    }

    if (!almoxModal) {
      return;
    }

    almoxModal.dataset.almoxModalType = type;
    almoxModal.dataset.almoxPayload = JSON.stringify(payload || {});
    renderAlmoxModal_(type, payload || {});
    almoxModal.classList.remove("is-hidden");

    const firstField = almoxModal.querySelector("input, select, textarea, button");
    if (firstField) {
      firstField.focus();
    }
  }

  function closeAlmoxModal_() {
    if (!almoxModal) {
      return;
    }

    almoxModal.classList.add("is-hidden");
    almoxModal.innerHTML = "";
    almoxModal.dataset.almoxModalType = "";
    almoxModal.dataset.almoxPayload = "";
  }

  function renderAlmoxModal_(type, payload) {
    const state = loadAlmoxState_();
    const activeItems = filterAlmoxItemsByActiveEnvironment_(state.items);
    const title = type === "entry" ? "Registrar entrada" : (type === "exit" ? "Registrar saída" : "Cadastrar item");
    const content = document.createElement("div");
    const card = document.createElement("div");
    const header = document.createElement("div");
    const heading = document.createElement("h3");
    const closeButton = document.createElement("button");
    const form = document.createElement("form");

    almoxModal.innerHTML = "";
    content.className = "stock-ia-modal-backdrop";
    card.className = "stock-ia-modal-card";
    header.className = "stock-ia-modal-header";
    heading.id = "almoxModalTitle";
    heading.textContent = title;
    closeButton.type = "button";
    closeButton.className = "mini-button compact";
    closeButton.dataset.almoxModalClose = "true";
    closeButton.textContent = "Fechar";
    form.className = "stock-ia-form";
    form.dataset.almoxFormType = type;

    header.appendChild(heading);
    header.appendChild(closeButton);
    card.appendChild(header);

    if (type === "entry") {
      appendAlmoxItemSelect_(form, activeItems, payload.itemId);
      appendStockIaField_(form, "quantity", "Quantidade", "number", "", true, "0.001");
      appendStockIaField_(form, "documentNumber", "Origem/fornecedor/nota fiscal", "text", "", false);
      appendStockIaField_(form, "responsible", "Responsavel pelo recebimento", "text", "", false);
      appendStockIaField_(form, "movementDate", "Data da movimentacao", "date", getDefaultAlmoxMovementDate_(), true);
      appendStockIaField_(form, "movementTime", "Hora da movimentacao", "time", getDefaultAlmoxMovementTime_(), true);
      appendStockIaTextarea_(form, "notes", "Observação", "");
    } else if (type === "exit") {
      appendAlmoxItemSelect_(form, activeItems, payload.itemId);
      appendStockIaField_(form, "quantity", "Quantidade", "number", "", true, "0.001");
      appendStockIaField_(form, "recipient", "Pessoa que retirou", "text", "", true);
      appendStockIaField_(form, "sector", "Setor/destino", "text", "", false);
      appendStockIaField_(form, "purpose", "Finalidade/uso", "text", "", false);
      appendStockIaField_(form, "responsible", "Responsável pela entrega", "text", "", false);
      appendStockIaField_(form, "movementDate", "Data da movimentacao", "date", getDefaultAlmoxMovementDate_(), true);
      appendStockIaField_(form, "movementTime", "Hora da movimentacao", "time", getDefaultAlmoxMovementTime_(), true);
      appendStockIaTextarea_(form, "notes", "Observação", "");
    } else {
      appendStockIaField_(form, "name", "Nome do item", "text", "", true);
      appendStockIaField_(form, "category", "Categoria", "text", "", false);
      appendStockIaField_(form, "unit", "Unidade", "text", "un", true);
      appendStockIaField_(form, "initialQuantity", "Quantidade inicial", "number", "", false, "0.001");
      appendStockIaField_(form, "minimumStock", "Estoque mínimo", "number", "", false, "0.001");
      appendStockIaField_(form, "location", "Local/almoxarifado", "text", "", false);
      appendStockIaField_(form, "expirationDate", "Data de vencimento", "date", "", false);
      appendStockIaTextarea_(form, "notes", "Observação", "");
    }

    appendAlmoxFormActions_(form, type === "entry" ? "Registrar entrada" : (type === "exit" ? "Registrar saída" : "Cadastrar item"));
    card.appendChild(form);
    content.appendChild(card);
    almoxModal.appendChild(content);
  }

  function appendAlmoxItemSelect_(form, items, selectedItemId) {
    const wrapper = document.createElement("label");
    const select = document.createElement("select");
    wrapper.textContent = "Item";
    select.name = "itemId";
    select.required = true;
    appendOption_(select, "", items.length ? "Escolha um item" : "Cadastre um item primeiro");
    items.forEach(function (item) {
      appendOption_(select, item.id, item.name + " (" + (item.unit || "un") + ")");
    });
    select.value = selectedItemId || (items.length === 1 ? items[0].id : "");
    wrapper.appendChild(select);
    form.appendChild(wrapper);
  }

  function appendAlmoxFormActions_(form, submitText) {
    const actions = document.createElement("div");
    const submit = document.createElement("button");
    const cancel = document.createElement("button");
    const formType = form.dataset.almoxFormType || "item";
    actions.className = "stock-ia-form-actions full-width";
    submit.type = "submit";
    submit.className = "mini-button primary";
    submit.dataset.almoxModalSubmit = "true";
    submit.id = formType === "exit"
      ? "almoxModalExitSubmitButton"
      : (formType === "entry" ? "almoxModalEntrySubmitButton" : "almoxModalItemSubmitButton");
    submit.textContent = submitText;
    cancel.type = "button";
    cancel.className = "mini-button";
    cancel.dataset.almoxModalClose = "true";
    cancel.textContent = "Cancelar";
    actions.appendChild(submit);
    actions.appendChild(cancel);
    form.appendChild(actions);
  }

  function handleAlmoxModalSubmit_(event) {
    event.preventDefault();
    submitAlmoxModalForm_(event.target);
  }

  function submitAlmoxModalForm_(form) {
    if (!form) {
      return;
    }

    const type = form.dataset.almoxFormType || "item";
    const formData = new FormData(form);

    if (isStockAiPublicDemo_() && getStockDemoRole_() === "almoxarife" && (type === "entry" || type === "exit")) {
      const requestResult = createStockApprovalRequestFromFormData_(type, formData);
      if (!requestResult.ok) {
        showAlmoxToast_(requestResult.message, "error");
        return;
      }

      closeAlmoxModal_();
      renderAlmoxarifadoPanel_();
      showAlmoxToast_("Solicitacao enviada ao gestor. O estoque oficial ainda nao foi alterado.", "success");
      scrollToAlmoxSection_("almoxDemoAccessPanel");
      return;
    }

    const result = type === "entry"
      ? saveAlmoxEntryFromFormData_(formData)
      : (type === "exit" ? saveAlmoxExitFromFormData_(formData) : saveAlmoxItemFromFormData_(formData));

    if (!result.ok) {
      showAlmoxToast_(result.message, "error");
      return;
    }

    closeAlmoxModal_();
    renderAlmoxarifadoPanel_();
    if (type === "entry") {
      showAlmoxToast_("Entrada registrada no almoxarifado.", "success");
    } else if (type === "exit") {
      showAlmoxToast_("Saída registrada com responsável e setor.", "success");
    } else {
      showAlmoxToast_("Item cadastrado com sucesso.", "success");
    }
  }

  function createStockApprovalRequestFromFormData_(type, formData) {
    const state = loadAlmoxState_();
    const environmentId = getActiveStockEnvironmentId_();
    const user = getStockDemoUser_();
    const itemId = clean(formData.get("itemId"));
    const quantity = parseNumber_(formData.get("quantity"));
    const movementType = type === "entry" ? "entrada" : "saida";
    const movementDate = clean(formData.get("movementDate")) || clean(formData.get("date")) || getDefaultAlmoxMovementDate_();
    const movementTime = clean(formData.get("movementTime")) || getDefaultAlmoxMovementTime_();

    if (!itemId || quantity <= 0) {
      return {
        ok: false,
        message: "Escolha um item e informe uma quantidade valida."
      };
    }

    if (!state.items.some(function (item) { return item.id === itemId && clean(item.environmentId) === environmentId; })) {
      return {
        ok: false,
        message: "Material nao encontrado neste ambiente."
      };
    }

    const request = {
      id: createId_("apv"),
      organizationId: environmentId,
      environmentId: environmentId,
      userId: user.id,
      role: user.role,
      createdByName: user.name,
      createdByEmail: user.email,
      type: movementType,
      status: "pending",
      payload: {
        itemId: itemId,
        quantity: quantity,
        responsible: clean(formData.get("responsible")),
        documentNumber: clean(formData.get("documentNumber")),
        recipient: clean(formData.get("recipient")),
        sector: clean(formData.get("sector")),
        purpose: clean(formData.get("purpose")),
        notes: clean(formData.get("notes")),
        movementDate: movementDate,
        movementTime: movementTime,
        movementDateTime: buildAlmoxMovementDateTime_(movementDate, movementTime)
      },
      createdAt: new Date().toISOString(),
      approvedAt: "",
      approvedBy: "",
      rejectedAt: "",
      rejectedBy: ""
    };
    state.approvalRequests = Array.isArray(state.approvalRequests) ? state.approvalRequests : [];
    state.approvalRequests.unshift(request);
    saveAlmoxState_(state);
    syncStockDemoRemoteApprovalRequest_(request);

    return {
      ok: true,
      request: request
    };
  }

  function createStockApprovalRequestFromNoteItem_(noteItem, options) {
    const state = loadAlmoxState_();
    const environmentId = getActiveStockEnvironmentId_();
    const user = getStockDemoUser_();
    const settings = options || {};
    const item = findAlmoxItemFromNote_(state, noteItem);
    const movementDate = clean(settings.movementDate) || getDefaultAlmoxMovementDate_();
    const movementTime = clean(settings.movementTime) || getDefaultAlmoxMovementTime_();
    const request = {
      id: createId_("apv"),
      organizationId: environmentId,
      environmentId: environmentId,
      userId: user.id,
      role: user.role,
      createdByName: user.name,
      createdByEmail: user.email,
      type: "entrada",
      status: "pending",
      payload: {
        itemId: item ? item.id : "",
        product: clean(noteItem.product),
        fiscalCode: clean(noteItem.code),
        category: clean(noteItem.category) || suggestAlmoxNoteCategory_(noteItem.product),
        unit: normalizeAlmoxNoteUnit_(noteItem.unit),
        quantity: parseNumber_(noteItem.quantity),
        responsible: clean(settings.responsible) || "Almoxarife demo",
        documentNumber: clean(settings.entryOrigin) || "Nota fiscal",
        notes: buildAlmoxNoteEntryNotes_(noteItem, clean(settings.entryOrigin) || "Nota fiscal"),
        movementDate: movementDate,
        movementTime: movementTime,
        movementDateTime: buildAlmoxMovementDateTime_(movementDate, movementTime)
      },
      createdAt: new Date().toISOString(),
      approvedAt: "",
      approvedBy: "",
      rejectedAt: "",
      rejectedBy: ""
    };
    state.approvalRequests = Array.isArray(state.approvalRequests) ? state.approvalRequests : [];
    state.approvalRequests.unshift(request);
    saveAlmoxState_(state);
    syncStockDemoRemoteApprovalRequest_(request);

    return {
      ok: true,
      request: request
    };
  }

  function handleStockApprovalAction_(requestId, action) {
    if (action === "approve") {
      approveStockApprovalRequest_(requestId);
      return;
    }

    if (action === "reject") {
      rejectStockApprovalRequest_(requestId);
    }
  }

  function approveStockApprovalRequest_(requestId) {
    const state = loadAlmoxState_();
    const request = (state.approvalRequests || []).find(function (item) {
      return item.id === requestId;
    });
    const user = getStockDemoUser_();

    if (!request || request.status !== "pending") {
      showAlmoxToast_("Solicitacao pendente nao encontrada.", "error");
      return;
    }

    const preparedRequest = ensureStockApprovalRequestItem_(request);
    if (!preparedRequest.ok) {
      showAlmoxToast_(preparedRequest.message, "error");
      return;
    }

    const formData = buildFormDataFromStockApprovalRequest_(preparedRequest.request);
    const result = request.type === "entrada"
      ? saveAlmoxEntryFromFormData_(formData)
      : saveAlmoxExitFromFormData_(formData);

    if (!result.ok) {
      showAlmoxToast_(result.message || "Nao foi possivel aprovar a solicitacao.", "error");
      return;
    }

    const updatedState = loadAlmoxState_();
    const updatedRequest = (updatedState.approvalRequests || []).find(function (item) {
      return item.id === requestId;
    });
    if (updatedRequest) {
      updatedRequest.status = "approved";
      updatedRequest.approvedAt = new Date().toISOString();
      updatedRequest.approvedBy = user.id;
      updatedRequest.approvedByName = user.name;
      updatedRequest.approvedByRole = user.role;
      saveAlmoxState_(updatedState);
    }

    renderAlmoxarifadoPanel_();
    syncStockDemoRemoteApprovalDecision_(requestId, "approve");
    showAlmoxToast_("Solicitacao aprovada. Estoque oficial atualizado.", "success");
  }

  function rejectStockApprovalRequest_(requestId) {
    const state = loadAlmoxState_();
    const request = (state.approvalRequests || []).find(function (item) {
      return item.id === requestId;
    });
    const user = getStockDemoUser_();

    if (!request || request.status !== "pending") {
      showAlmoxToast_("Solicitacao pendente nao encontrada.", "error");
      return;
    }

    request.status = "rejected";
    request.rejectedAt = new Date().toISOString();
    request.rejectedBy = user.id;
    request.rejectedByName = user.name;
    request.rejectedByRole = user.role;
    saveAlmoxState_(state);
    renderAlmoxarifadoPanel_();
    syncStockDemoRemoteApprovalDecision_(requestId, "reject");
    showAlmoxToast_("Solicitacao rejeitada. O estoque oficial nao foi alterado.", "info");
  }

  function ensureStockApprovalRequestItem_(request) {
    if (request.payload && request.payload.itemId) {
      return {
        ok: true,
        request: request
      };
    }

    const product = clean(request.payload && request.payload.product);
    const unit = clean(request.payload && request.payload.unit) || "un";
    if (!product) {
      return {
        ok: false,
        message: "A solicitacao nao possui item suficiente para aprovacao."
      };
    }

    const state = loadAlmoxState_();
    const environmentId = clean(request.environmentId || request.organizationId) || getActiveStockEnvironmentId_();
    const storedRequest = (state.approvalRequests || []).find(function (item) {
      return item.id === request.id;
    });
    const item = {
      id: createId_("alm"),
      environmentId: environmentId,
      fiscalCode: clean(request.payload.fiscalCode),
      name: product,
      category: clean(request.payload.category) || "Geral",
      unit: unit,
      initialQuantity: 0,
      minimumStock: 0,
      location: "",
      expirationDate: "",
      notes: "Criado apos aprovacao de nota fiscal pelo gestor.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.items.push(item);
    if (storedRequest) {
      storedRequest.payload = Object.assign({}, storedRequest.payload || {}, {
        itemId: item.id
      });
      saveAlmoxState_(state);
      return {
        ok: true,
        request: storedRequest
      };
    }

    return {
      ok: false,
      message: "Solicitacao nao encontrada para aprovacao."
    };
  }

  function buildFormDataFromStockApprovalRequest_(request) {
    const payload = request.payload || {};
    const formData = new FormData();
    Object.keys(payload).forEach(function (key) {
      formData.set(key, payload[key]);
    });
    formData.set("itemId", payload.itemId || "");
    formData.set("quantity", payload.quantity || 0);
    return formData;
  }

  function renderAlmoxSelects_() {
    const state = loadAlmoxState_();
    const activeItems = filterAlmoxItemsByActiveEnvironment_(state.items);
    [almoxEntryItemSelect, almoxExitItemSelect].forEach(function (select) {
      if (!select) {
        return;
      }

      const current = select.value;
      select.innerHTML = "";
      appendOption_(select, "", activeItems.length ? "Escolha um item" : "Cadastre um item primeiro");
      activeItems.forEach(function (item) {
        appendOption_(select, item.id, item.name + " (" + (item.unit || "un") + ")");
      });
      select.value = activeItems.some(function (item) { return item.id === current; })
        ? current
        : (activeItems.length === 1 ? activeItems[0].id : "");
    });
  }

  function renderAlmoxSummaryCards_() {
    if (!almoxSummaryCards) {
      return;
    }

    const state = loadAlmoxState_();
    const balances = calculateAlmoxBalances_();
    const belowMinimum = balances.filter(function (balance) {
      return parseNumber_(balance.item.minimumStock) > 0 &&
        parseNumber_(balance.balance) > 0 &&
        parseNumber_(balance.balance) < parseNumber_(balance.item.minimumStock);
    }).length;
    const zeroItems = balances.filter(function (balance) {
      return parseNumber_(balance.balance) <= 0;
    }).length;
    const recentMovements = filterAlmoxMovementsByActiveEnvironment_(state.movements).length;

    almoxSummaryCards.innerHTML = "";
    [
      ["Itens cadastrados", balances.length],
      ["Itens abaixo do minimo", belowMinimum],
      ["Itens zerados", zeroItems],
      ["Movimentacoes recentes", recentMovements]
    ].forEach(function (item) {
      const card = document.createElement("article");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      card.className = "stock-ia-card";
      label.textContent = item[0];
      value.textContent = String(item[1]);
      card.appendChild(label);
      card.appendChild(value);
      almoxSummaryCards.appendChild(card);
    });
  }

  function renderAlmoxFlowStatus_() {
    if (!almoxFlowStatus) {
      return;
    }

    const state = loadAlmoxState_();
    const balances = calculateAlmoxBalances_();
    const movements = filterAlmoxMovementsByActiveEnvironment_(state.movements).slice().sort(function (a, b) {
      return String(getAlmoxMovementSortKey_(b) || "").localeCompare(String(getAlmoxMovementSortKey_(a) || ""));
    });
    const itemsById = {};
    filterAlmoxItemsByActiveEnvironment_(state.items).forEach(function (item) {
      itemsById[item.id] = item;
    });
    const zeroItems = balances.filter(function (balance) {
      return parseNumber_(balance.balance) <= 0;
    });
    const belowMinimum = balances.filter(function (balance) {
      return parseNumber_(balance.item.minimumStock) > 0 &&
        parseNumber_(balance.balance) > 0 &&
        parseNumber_(balance.balance) < parseNumber_(balance.item.minimumStock);
    });
    const lastMovement = movements[0] || null;
    const lastItem = lastMovement ? (itemsById[lastMovement.itemId] || {}) : {};
    const recommendation = zeroItems.length
      ? "Priorize reposicao dos itens zerados antes de novas retiradas."
      : (belowMinimum.length
        ? "Revise os itens abaixo do minimo e planeje reposicao."
        : (balances.length ? "Estoque sem alerta critico neste ambiente." : "Comece cadastrando item ou importando XML da nota."));

    almoxFlowStatus.innerHTML = [
      "<div class=\"almox-flow-status-head\">",
      "<span>Status do ambiente</span>",
      "<strong>" + (zeroItems.length ? "Atencao critica" : (belowMinimum.length ? "Monitorar" : "Pronto para operar")) + "</strong>",
      "</div>",
      "<div class=\"almox-flow-metrics\" aria-label=\"Resumo rapido do ambiente\">",
      "<span><b>" + balances.length + "</b><small>Itens</small></span>",
      "<span><b>" + belowMinimum.length + "</b><small>Abaixo minimo</small></span>",
      "<span><b>" + zeroItems.length + "</b><small>Zerados</small></span>",
      "</div>",
      "<p>" + escapeHtml_(recommendation) + "</p>",
      "<div class=\"almox-flow-last\">",
      "<small>Ultima movimentacao</small>",
      "<strong>" + (lastMovement ? escapeHtml_((lastMovement.type === "entrada" ? "Entrada" : "Saida") + " - " + (lastItem.name || "Item")) : "Nenhuma movimentacao") + "</strong>",
      "<span>" + (lastMovement ? escapeHtml_(getAlmoxMovementDisplayDateTime_(lastMovement)) : "Registre entrada ou saida para iniciar o historico.") + "</span>",
      "</div>",
      "<div class=\"almox-flow-actions\" aria-label=\"Atalhos do ambiente\">",
      "<button type=\"button\" class=\"mini-button\" data-almox-flow-action=\"dashboard\">Ver dashboard</button>",
      "<button type=\"button\" class=\"mini-button\" data-almox-flow-action=\"history\">Ver historico</button>",
      "<button type=\"button\" class=\"mini-button primary\" data-almox-flow-action=\"summary\">Gerar resumo</button>",
      "</div>"
    ].join("");
  }

  function handleAlmoxFlowAction_(action) {
    if (action === "summary") {
      handleGenerateAlmoxSummary_();
      scrollToAlmoxSection_("almoxManagerPanel");
      return;
    }

    if (action === "history") {
      const section = document.getElementById("almoxHistorySection");
      if (section && section.classList.contains("almox-history-collapsed")) {
        toggleAlmoxHistoryVisibility_();
      }
      scrollToAlmoxSection_("almoxHistorySection");
      return;
    }

    scrollToAlmoxSection_("almoxDashboardPanel");
  }

  function scrollToAlmoxSection_(id) {
    const target = document.getElementById(id);
    if (!target || !target.scrollIntoView) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function renderAlmoxDashboard_() {
    if (!almoxDashboardPanel) {
      return;
    }

    const viewModel = buildAlmoxDashboardViewModel_();
    renderAlmoxDashboardPeriodControls_(viewModel.period);
    renderAlmoxDashboardCards_(viewModel);
    renderAlmoxDashboardConsumption_(viewModel);
    renderAlmoxDashboardRisk_(viewModel);
    renderAlmoxDashboardExpiration_(viewModel);
    renderAlmoxDashboardTrend_(viewModel);
  }

  function buildAlmoxDashboardViewModel_() {
    const data = collectAlmoxManagerData_();
    const periodMovements = getAlmoxMovementsByPeriod_(data.movements, almoxDashboardPeriod);
    const periodEntries = periodMovements.filter(function (movement) {
      return movement.type === "entrada";
    });
    const periodExits = periodMovements.filter(function (movement) {
      return movement.type === "saida";
    });
    const totalBalance = data.balances.reduce(function (sum, balance) {
      return sum + parseNumber_(balance.balance);
    }, 0);
    const shortage = getAlmoxShortageRisk_(data.balances);
    const expiration = getAlmoxExpirationSummary_(data.balances);
    const topMovedItems = getAlmoxTopMovedItems_(periodMovements, data.itemsById);
    const trend = getAlmoxOperationalTrend_({
      shortage: shortage,
      periodExits: periodExits,
      activeAlerts: data.activeAlerts,
      topMovedItems: topMovedItems
    });

    return {
      period: almoxDashboardPeriod,
      periodLabel: getAlmoxDashboardPeriodLabel_(almoxDashboardPeriod),
      data: data,
      totalBalance: totalBalance,
      periodMovements: periodMovements,
      periodEntries: periodEntries,
      periodExits: periodExits,
      topMovedItems: topMovedItems,
      shortage: shortage,
      expiration: expiration,
      trend: trend,
      cards: [
        { label: "Total de itens cadastrados", value: data.balances.length, className: "status-muted" },
        { label: "Saldo total", value: formatQuantity_(totalBalance), suffix: "unidades", className: "status-muted" },
        { label: "Itens abaixo do minimo", value: shortage.belowMinimum.length, className: shortage.belowMinimum.length ? "status-warning" : "status-ok", action: "filtered", filter: "below" },
        { label: "Itens zerados", value: shortage.zeroItems.length, className: shortage.zeroItems.length ? "status-danger" : "status-ok", action: "filtered", filter: "zero" },
        { label: "Itens proximos do vencimento", value: expiration.expired.length + expiration.until30.length + expiration.until60.length, className: expiration.expired.length || expiration.until30.length ? "status-danger" : (expiration.until60.length ? "status-warning" : "status-ok"), action: "filtered", filter: "expiration" },
        { label: "Movimentacoes recentes", value: periodMovements.length, suffix: getAlmoxDashboardPeriodLabel_(almoxDashboardPeriod), className: "status-muted" },
        { label: "Saidas no periodo", value: periodExits.length, className: periodExits.length ? "status-warning" : "status-muted" },
        { label: "Entradas no periodo", value: periodEntries.length, className: periodEntries.length ? "status-ok" : "status-muted" },
        { label: "Risco geral do almoxarifado", value: shortage.label, className: shortage.className, action: "filtered", filter: "shortage" }
      ]
    };
  }

  function getAlmoxMovementsByPeriod_(movements, period) {
    const safePeriod = period || "30d";
    const list = Array.isArray(movements) ? movements : [];
    if (safePeriod === "all") {
      return list.slice();
    }

    const now = new Date();
    const todayKey = toDateKey_(now);
    const days = safePeriod === "today" ? 1 : (safePeriod === "7d" ? 7 : 30);
    const cutoff = new Date(todayKey + "T00:00:00");
    cutoff.setDate(cutoff.getDate() - (days - 1));

    return list.filter(function (movement) {
      const sortKey = getAlmoxMovementSortKey_(movement);
      if (!sortKey) {
        return false;
      }
      if (safePeriod === "today") {
        return String(sortKey).slice(0, 10) === todayKey;
      }

      const movementDate = new Date(sortKey);
      return !Number.isNaN(movementDate.getTime()) && movementDate.getTime() >= cutoff.getTime();
    });
  }

  function getAlmoxTopMovedItems_(movements, itemsById) {
    const grouped = {};
    (movements || []).forEach(function (movement) {
      if (movement.type !== "saida") {
        return;
      }
      const item = (itemsById || {})[movement.itemId] || {};
      const key = movement.itemId || item.name || "item";
      grouped[key] = grouped[key] || {
        item: item,
        quantity: 0,
        movements: 0
      };
      grouped[key].quantity += parseNumber_(movement.quantity);
      grouped[key].movements += 1;
    });

    const ranked = Object.keys(grouped).map(function (key) {
      return grouped[key];
    }).sort(function (a, b) {
      return b.quantity - a.quantity;
    }).slice(0, 5);
    const maxQuantity = ranked.reduce(function (max, item) {
      return Math.max(max, item.quantity);
    }, 0);

    return ranked.map(function (entry, index) {
      return {
        position: index + 1,
        itemId: entry.item.id || "",
        name: entry.item.name || "Item sem cadastro",
        unit: entry.item.unit || "un",
        quantity: roundQuantity_(entry.quantity),
        movements: entry.movements,
        percent: maxQuantity > 0 ? Math.max(8, Math.round((entry.quantity / maxQuantity) * 100)) : 0
      };
    });
  }

  function getAlmoxShortageRisk_(balances) {
    const zeroItems = buildAlmoxZeroItems_(balances);
    const belowMinimum = buildAlmoxCriticalItems_(balances);
    const okItems = (balances || []).filter(function (balance) {
      return zeroItems.indexOf(balance) < 0 && belowMinimum.indexOf(balance) < 0;
    });

    if (zeroItems.length) {
      return {
        label: "Critico",
        className: "status-danger",
        message: "Ha item(ns) com saldo zerado.",
        recommendation: "Priorize a reposicao dos itens criticos antes de novas retiradas.",
        zeroItems: zeroItems,
        belowMinimum: belowMinimum,
        okItems: okItems
      };
    }

    if (belowMinimum.length) {
      return {
        label: "Atencao",
        className: "status-warning",
        message: "Ha item(ns) abaixo do estoque minimo.",
        recommendation: "Reponha os itens em atencao antes que cheguem a saldo zero.",
        zeroItems: zeroItems,
        belowMinimum: belowMinimum,
        okItems: okItems
      };
    }

    return {
      label: "OK",
      className: "status-ok",
      message: "Saldos acima do minimo cadastrado.",
      recommendation: "Almoxarifado dentro do controle.",
      zeroItems: zeroItems,
      belowMinimum: belowMinimum,
      okItems: okItems
    };
  }

  function getAlmoxExpirationSummary_(balances) {
    const result = {
      expired: [],
      until30: [],
      until60: [],
      noDate: []
    };

    (balances || []).forEach(function (balance) {
      const info = getAlmoxExpirationInfo_(balance.item);
      if (!info) {
        result.noDate.push(balance);
        return;
      }
      if (info.days < 0) {
        result.expired.push({ balance: balance, info: info });
      } else if (info.days <= 30) {
        result.until30.push({ balance: balance, info: info });
      } else if (info.days <= 60) {
        result.until60.push({ balance: balance, info: info });
      }
    });

    return result;
  }

  function getAlmoxOperationalTrend_(data) {
    if (data.shortage && data.shortage.zeroItems.length) {
      return {
        label: "Reposicao urgente.",
        className: "status-danger",
        message: "Existe saldo zerado. Priorize compra, transferencia ou bloqueio de novas retiradas."
      };
    }

    if (data.shortage && data.shortage.belowMinimum.length && data.periodExits && data.periodExits.length >= 3) {
      return {
        label: "Tendencia de falta nos proximos dias.",
        className: "status-warning",
        message: "Ha muitas saidas recentes e saldo baixo em item(ns) critico(s)."
      };
    }

    if (!data.activeAlerts || !data.activeAlerts.length) {
      return {
        label: "Almoxarifado dentro do controle.",
        className: "status-ok",
        message: "Sem alertas criticos no periodo analisado."
      };
    }

    return {
      label: "Acompanhar alertas.",
      className: "status-warning",
      message: "Existem alertas ativos. Revise reposicao, validade e retiradas recentes."
    };
  }

  function handleAlmoxDashboardPeriodChange_(period) {
    almoxDashboardPeriod = period || "30d";
    renderAlmoxDashboard_();
  }

  function renderAlmoxDashboardPeriodControls_(period) {
    if (!almoxDashboardPeriodControls) {
      return;
    }

    Array.from(almoxDashboardPeriodControls.querySelectorAll("[data-almox-dashboard-period]")).forEach(function (button) {
      button.classList.toggle("active", button.dataset.almoxDashboardPeriod === period);
    });
  }

  function renderAlmoxDashboardCards_(viewModel) {
    if (!almoxDashboardCards) {
      return;
    }

    almoxDashboardCards.innerHTML = "";
    viewModel.cards.forEach(function (cardData) {
      const card = document.createElement("article");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      const suffix = document.createElement("small");
      card.className = "almox-dashboard-card " + (cardData.className || "status-muted");
      if (cardData.action) {
        card.className += " almox-clickable-card";
        card.dataset.almoxDashboardAction = cardData.action;
        card.dataset.almoxDashboardFilter = cardData.filter || "";
        card.setAttribute("role", "button");
        card.tabIndex = 0;
      }
      label.textContent = cardData.label;
      value.textContent = String(cardData.value);
      suffix.textContent = cardData.suffix || "";
      card.appendChild(label);
      card.appendChild(value);
      if (cardData.suffix) {
        card.appendChild(suffix);
      }
      if (cardData.action) {
        const hint = document.createElement("small");
        hint.textContent = "Clique para ver detalhes";
        card.appendChild(hint);
      }
      almoxDashboardCards.appendChild(card);
    });
  }

  function renderAlmoxDashboardConsumption_(viewModel) {
    if (!almoxDashboardConsumption) {
      return;
    }

    almoxDashboardConsumption.innerHTML = "";
    appendAlmoxDashboardBlockHeader_(almoxDashboardConsumption, "Materiais mais movimentados", "Ranking por saidas em " + viewModel.periodLabel + ".");
    if (!viewModel.topMovedItems.length) {
      appendAlmoxDashboardEmpty_(almoxDashboardConsumption, "Nenhuma saida registrada neste periodo.");
      return;
    }

    const list = document.createElement("div");
    list.className = "almox-dashboard-ranking";
    viewModel.topMovedItems.forEach(function (entry) {
      const row = document.createElement("div");
      const text = document.createElement("span");
      const bar = document.createElement("i");
      row.className = "almox-dashboard-bar-row almox-clickable-row";
      row.dataset.almoxDashboardAction = "item";
      row.dataset.almoxItemId = entry.itemId || "";
      row.setAttribute("role", "button");
      row.tabIndex = 0;
      text.textContent = entry.position + ". " + entry.name + " - " + formatQuantity_(entry.quantity) + " " + entry.unit + " retiradas";
      bar.style.width = entry.percent + "%";
      row.appendChild(text);
      row.appendChild(bar);
      list.appendChild(row);
    });
    almoxDashboardConsumption.appendChild(list);
  }

  function renderAlmoxDashboardRisk_(viewModel) {
    if (!almoxDashboardRisk) {
      return;
    }

    const shortage = viewModel.shortage;
    const total = Math.max(1, viewModel.data.balances.length);
    almoxDashboardRisk.innerHTML = "";
    appendAlmoxDashboardBlockHeader_(almoxDashboardRisk, "Risco de falta", shortage.message);
    [
      ["Critico", shortage.zeroItems.length, "status-danger"],
      ["Atencao", shortage.belowMinimum.length, "status-warning"],
      ["OK", shortage.okItems.length, "status-ok"]
    ].forEach(function (item) {
      almoxDashboardRisk.appendChild(createAlmoxDashboardMetricBar_(item[0], item[1], Math.round((item[1] / total) * 100), item[2], "shortage"));
    });
    appendAlmoxDashboardNote_(almoxDashboardRisk, shortage.recommendation, shortage.className);
  }

  function renderAlmoxDashboardExpiration_(viewModel) {
    if (!almoxDashboardExpiration) {
      return;
    }

    const expiration = viewModel.expiration;
    const total = Math.max(1, viewModel.data.balances.length);
    almoxDashboardExpiration.innerHTML = "";
    appendAlmoxDashboardBlockHeader_(almoxDashboardExpiration, "Itens por vencimento", "Controle de validade dos itens cadastrados.");
    [
      ["Vencidos", expiration.expired.length, "status-danger"],
      ["Vencem em ate 30 dias", expiration.until30.length, "status-danger"],
      ["Vencem em ate 60 dias", expiration.until60.length, "status-warning"],
      ["Sem data de vencimento", expiration.noDate.length, "status-muted"]
    ].forEach(function (item) {
      almoxDashboardExpiration.appendChild(createAlmoxDashboardMetricBar_(item[0], item[1], Math.round((item[1] / total) * 100), item[2], "expiration"));
    });
  }

  function renderAlmoxDashboardTrend_(viewModel) {
    if (!almoxDashboardTrend) {
      return;
    }

    const topItem = viewModel.topMovedItems[0];
    almoxDashboardTrend.innerHTML = "";
    appendAlmoxDashboardBlockHeader_(almoxDashboardTrend, "Tendencia operacional", "Leitura simples por regra de negocio.");
    appendAlmoxDashboardNote_(almoxDashboardTrend, viewModel.trend.label, viewModel.trend.className);
    appendAlmoxDashboardNote_(almoxDashboardTrend, viewModel.trend.message, "status-muted");
    appendAlmoxDashboardNote_(almoxDashboardTrend, "Periodo analisado: " + viewModel.periodLabel + ".", "status-muted");
    appendAlmoxDashboardNote_(almoxDashboardTrend, topItem ? ("Material mais movimentado: " + topItem.name + " - " + formatQuantity_(topItem.quantity) + " " + topItem.unit + ".") : "Material mais movimentado: sem saidas no periodo.", "status-muted");
  }

  function appendAlmoxDashboardBlockHeader_(container, title, subtitle) {
    const heading = document.createElement("h4");
    const text = document.createElement("p");
    heading.textContent = title;
    text.textContent = subtitle;
    container.appendChild(heading);
    container.appendChild(text);
  }

  function appendAlmoxDashboardEmpty_(container, message) {
    const empty = document.createElement("p");
    empty.className = "almox-dashboard-empty";
    empty.textContent = message;
    container.appendChild(empty);
  }

  function appendAlmoxDashboardNote_(container, message, className) {
    const note = document.createElement("p");
    note.className = "almox-dashboard-note " + (className || "status-muted");
    note.textContent = message;
    container.appendChild(note);
  }

  function createAlmoxDashboardMetricBar_(label, value, percent, className, filter) {
    const row = document.createElement("div");
    const header = document.createElement("div");
    const text = document.createElement("span");
    const number = document.createElement("strong");
    const track = document.createElement("div");
    const fill = document.createElement("i");
    row.className = "almox-dashboard-metric";
    if (filter) {
      row.className += " almox-clickable-row";
      row.dataset.almoxDashboardAction = "filtered";
      row.dataset.almoxDashboardFilter = filter;
      row.setAttribute("role", "button");
      row.tabIndex = 0;
    }
    header.className = "almox-dashboard-metric-header";
    track.className = "almox-dashboard-track";
    fill.className = className || "status-muted";
    text.textContent = label;
    number.textContent = String(value);
    fill.style.width = Math.max(4, Math.min(100, percent || 0)) + "%";
    header.appendChild(text);
    header.appendChild(number);
    track.appendChild(fill);
    row.appendChild(header);
    row.appendChild(track);
    return row;
  }

  function handleAlmoxDashboardCardClick_(target) {
    if (!target) {
      return;
    }

    if (target.dataset.almoxDashboardAction === "item") {
      openAlmoxItemSummary_(target.dataset.almoxItemId || "");
      return;
    }

    if (target.dataset.almoxDashboardAction === "filtered") {
      openAlmoxFilteredItemsSummary_(target.dataset.almoxDashboardFilter || "shortage");
    }
  }

  function openAlmoxItemSummary_(itemId) {
    const viewModel = buildAlmoxItemSummaryViewModel_(itemId);
    if (!viewModel) {
      showAlmoxToast_("Item nao encontrado no almoxarifado.", "error");
      return;
    }
    renderAlmoxItemSummaryModal_({
      mode: "item",
      title: viewModel.item.name || "Resumo do item",
      item: viewModel
    });
  }

  function openAlmoxFilteredItemsSummary_(filter) {
    const data = collectAlmoxManagerData_();
    const shortage = getAlmoxShortageRisk_(data.balances);
    const expiration = getAlmoxExpirationSummary_(data.balances);
    let title = "Itens do almoxarifado";
    let groups = [];

    if (filter === "zero") {
      title = "Itens zerados";
      groups = [{ title: "Critico", items: shortage.zeroItems }];
    } else if (filter === "below") {
      title = "Itens abaixo do minimo";
      groups = [{ title: "Atencao", items: shortage.belowMinimum }];
    } else if (filter === "expiration") {
      title = "Itens proximos do vencimento";
      groups = [
        { title: "Vencidos", items: expiration.expired.map(function (entry) { return entry.balance; }) },
        { title: "Vencem em ate 30 dias", items: expiration.until30.map(function (entry) { return entry.balance; }) },
        { title: "Vencem em ate 60 dias", items: expiration.until60.map(function (entry) { return entry.balance; }) }
      ];
    } else {
      title = "Risco de falta";
      groups = [
        { title: "Critico", items: shortage.zeroItems },
        { title: "Atencao", items: shortage.belowMinimum },
        { title: "OK", items: shortage.okItems }
      ];
    }

    renderAlmoxItemSummaryModal_({
      mode: "list",
      title: title,
      groups: groups
    });
  }

  function buildAlmoxItemSummaryViewModel_(itemId) {
    const data = collectAlmoxManagerData_();
    const item = data.itemsById[itemId];
    if (!item) {
      return null;
    }

    const balance = data.balances.find(function (entry) {
      return entry.item.id === itemId;
    }) || {
      item: item,
      entries: 0,
      exits: 0,
      balance: getAlmoxItemBalance_(itemId, data.state),
      status: "OK"
    };
    const movements = data.movements.filter(function (movement) {
      return movement.itemId === itemId;
    });
    const lastMovements = movements.slice(0, 8);
    return {
      item: item,
      balance: balance,
      currentBalance: balance.balance,
      totalEntries: balance.entries,
      totalExits: balance.exits,
      risk: balance.status,
      lastMovements: lastMovements,
      movements: movements
    };
  }

  function renderAlmoxItemSummaryModal_(viewModel) {
    closeAlmoxItemSummaryModal_();

    const modal = document.createElement("div");
    const backdrop = document.createElement("div");
    const card = document.createElement("section");
    const header = document.createElement("header");
    const title = document.createElement("h3");
    const closeButton = document.createElement("button");

    modal.className = "almox-item-summary-modal";
    modal.dataset.almoxSummaryModal = "true";
    backdrop.className = "almox-item-summary-backdrop";
    card.className = "almox-item-summary-card";
    header.className = "stock-ia-modal-header";
    title.textContent = viewModel.title || "Resumo do item";
    closeButton.type = "button";
    closeButton.className = "mini-button compact";
    closeButton.dataset.almoxSummaryClose = "true";
    closeButton.textContent = "Fechar";

    header.appendChild(title);
    header.appendChild(closeButton);
    card.appendChild(header);

    if (viewModel.mode === "item") {
      renderAlmoxItemSummaryDetails_(card, viewModel.item);
    } else {
      renderAlmoxFilteredItemsSummary_(card, viewModel.groups || []);
    }

    backdrop.appendChild(card);
    modal.appendChild(backdrop);
    document.body.appendChild(modal);
    closeButton.focus();
  }

  function renderAlmoxItemSummaryDetails_(container, viewModel) {
    const item = viewModel.item;
    const grid = document.createElement("div");
    const actions = document.createElement("div");
    const history = document.createElement("div");
    grid.className = "almox-item-summary-grid";
    actions.className = "almox-item-summary-actions";
    history.className = "almox-item-summary-history";

    [
      ["Codigo", item.fiscalCode || item.code || "-"],
      ["Saldo atual", formatQuantity_(viewModel.currentBalance) + " " + (item.unit || "un")],
      ["Total de entradas", formatQuantity_(viewModel.totalEntries) + " " + (item.unit || "un")],
      ["Total de saidas", formatQuantity_(viewModel.totalExits) + " " + (item.unit || "un")],
      ["Estoque minimo", formatQuantity_(item.minimumStock || 0) + " " + (item.unit || "un")],
      ["Risco atual", viewModel.risk || "-"]
    ].forEach(function (entry) {
      const cell = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      label.textContent = entry[0];
      value.textContent = entry[1];
      cell.appendChild(label);
      cell.appendChild(value);
      grid.appendChild(cell);
    });

    ["entry", "exit"].forEach(function (type) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mini-button" + (type === "entry" ? " primary" : "");
      button.dataset.almoxSummaryAction = type;
      button.dataset.almoxItemId = item.id;
      button.textContent = type === "entry" ? "Registrar entrada" : "Registrar saida";
      actions.appendChild(button);
    });

    const historyTitle = document.createElement("h4");
    historyTitle.textContent = "Ultimas movimentacoes";
    history.appendChild(historyTitle);
    if (!viewModel.lastMovements.length) {
      const empty = document.createElement("p");
      empty.textContent = "Nenhuma movimentacao registrada para este item.";
      history.appendChild(empty);
    } else {
      viewModel.lastMovements.forEach(function (movement) {
        const row = document.createElement("article");
        const main = document.createElement("strong");
        const meta = document.createElement("p");
        row.className = "almox-summary-history-row";
        main.textContent = getAlmoxMovementDisplayDateTime_(movement) + " - " + (movement.type === "entrada" ? "Entrada" : "Saida") + " - " + formatQuantity_(movement.quantity) + " " + (item.unit || "un");
        meta.textContent = [
          movement.responsible ? "Responsavel: " + movement.responsible : "",
          movement.recipient ? "Destino/pessoa: " + movement.recipient : "",
          movement.sector ? "Setor: " + movement.sector : "",
          movement.documentNumber ? "Origem/nota: " + movement.documentNumber : ""
        ].filter(Boolean).join(" | ") || "Sem detalhes adicionais.";
        row.appendChild(main);
        row.appendChild(meta);
        history.appendChild(row);
      });
    }

    container.appendChild(grid);
    container.appendChild(actions);
    container.appendChild(history);
  }

  function renderAlmoxFilteredItemsSummary_(container, groups) {
    const wrapper = document.createElement("div");
    wrapper.className = "almox-item-summary-history";
    (groups || []).forEach(function (group) {
      const title = document.createElement("h4");
      title.textContent = group.title + " (" + (group.items || []).length + ")";
      wrapper.appendChild(title);

      if (!group.items || !group.items.length) {
        const empty = document.createElement("p");
        empty.textContent = "Nenhum item nesta classificacao.";
        wrapper.appendChild(empty);
        return;
      }

      group.items.forEach(function (balance) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "almox-clickable-row almox-summary-list-row";
        row.dataset.almoxSummaryItem = "true";
        row.dataset.almoxItemId = balance.item.id;
        row.textContent = (balance.item.name || "Item") + " - saldo " + formatQuantity_(balance.balance) + " " + (balance.item.unit || "un") + " - " + (balance.status || "OK");
        wrapper.appendChild(row);
      });
    });
    container.appendChild(wrapper);
  }

  function closeAlmoxItemSummaryModal_() {
    const existing = document.querySelector("[data-almox-summary-modal]");
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
  }

  function getAlmoxDashboardPeriodLabel_(period) {
    if (period === "today") {
      return "hoje";
    }
    if (period === "7d") {
      return "7 dias";
    }
    if (period === "all") {
      return "todo o historico";
    }
    return "30 dias";
  }

  function renderAlmoxManagerPanel_() {
    if (!almoxManagerCards && !almoxManagerSummaryText && !almoxManagerAuditText) {
      return;
    }

    checkAlmoxAlertStatus_();
    const state = loadAlmoxState_();
    const data = collectAlmoxManagerData_();
    const alertHistory = (data.alertHistory || []).slice(0, 6);

    if (almoxManagerSummaryText) {
      almoxManagerSummaryText.textContent = almoxLastSummaryText || "Clique em Gerar resumo para registrar uma visao gerencial.";
    }

    if (almoxManagerAuditText) {
      almoxManagerAuditText.textContent = almoxLastAuditText || "Clique em Gerar auditoria para registrar uma analise critica.";
    }

    if (almoxAlertsStatus) {
      almoxAlertsStatus.textContent = state.alertsMuted
        ? "Alertas silenciados ate " + formatAlmoxAlertMuteUntil_(state.alertsMutedUntil)
        : "Alertas ativos";
      almoxAlertsStatus.classList.toggle("muted", Boolean(state.alertsMuted));
    }

    if (almoxMuteAlertsButton) {
      almoxMuteAlertsButton.textContent = state.alertsMuted ? "Reativar alertas" : "Silenciar alertas";
    }

    if (!almoxManagerCards) {
      return;
    }

    almoxManagerCards.innerHTML = "";
    [
      {
        title: "Itens criticos para acabar",
        value: data.criticalItems.length,
        className: data.criticalItems.length ? "status-danger" : "status-ok",
        lines: data.criticalItems.length ? data.criticalItems.map(function (balance) {
          return balance.item.name + " esta abaixo do minimo. Saldo: " + formatQuantity_(balance.balance) + " " + (balance.item.unit || "un") + ".";
        }) : ["Nenhum item critico no momento."]
      },
      {
        title: "Itens zerados",
        value: data.zeroItems.length,
        className: data.zeroItems.length ? "status-danger" : "status-ok",
        lines: data.zeroItems.length ? data.zeroItems.map(function (balance) {
          return balance.item.name + " esta zerado. Reposicao urgente.";
        }) : ["Nenhum item zerado."]
      },
      {
        title: "Itens proximos do vencimento",
        value: data.expiringItems.length,
        className: data.expiringItems.length ? "status-warning" : "status-ok",
        lines: data.expiringItems.length ? data.expiringItems.map(function (info) {
          return info.item.name + " " + info.message;
        }) : ["Nenhum vencimento critico cadastrado."]
      },
      {
        title: "Ultimas saidas",
        value: data.recentExits.length,
        className: "status-muted",
        lines: data.recentExits.length ? data.recentExits.map(function (movement) {
          return formatAlmoxMovementText_(movement, data.itemsById[movement.itemId] || {});
        }) : ["Nenhuma saida recente."]
      },
      {
        title: "Entradas recentes",
        value: data.recentEntries.length,
        className: "status-muted",
        lines: data.recentEntries.length ? data.recentEntries.map(function (movement) {
          return formatAlmoxMovementText_(movement, data.itemsById[movement.itemId] || {});
        }) : ["Nenhuma entrada recente."]
      },
      {
        title: "Resumo atual",
        value: data.balances.length,
        className: data.zeroItems.length ? "status-danger" : (data.criticalItems.length || data.expiringItems.length ? "status-warning" : "status-ok"),
        lines: [
          data.balances.length + " item(ns) cadastrado(s).",
          data.zeroItems.length + " zerado(s), " + data.criticalItems.length + " abaixo do minimo.",
          state.alertsMuted ? "Alertas silenciados temporariamente." : "Alertas ativos para acompanhamento."
        ]
      },
      {
        title: "Historico de alertas",
        value: alertHistory.length,
        className: alertHistory.length ? "status-warning" : "status-ok",
        lines: alertHistory.length ? alertHistory.map(function (alert) {
          return formatDateTime_(alert.createdAt) + " - " + alert.message;
        }) : ["Nenhum alerta disparado nesta sessao."]
      }
    ].forEach(function (cardData) {
      almoxManagerCards.appendChild(createAlmoxManagerCard_(cardData));
    });
  }

  function createAlmoxManagerCard_(cardData) {
    const card = document.createElement("article");
    const header = document.createElement("div");
    const title = document.createElement("strong");
    const value = document.createElement("span");
    const list = document.createElement("ul");
    card.className = "almox-manager-card " + (cardData.className || "status-muted");
    if (loadAlmoxState_().alertsMuted) {
      card.classList.add("is-muted");
    }
    header.className = "almox-manager-card-header";
    title.textContent = cardData.title;
    value.textContent = String(cardData.value);
    header.appendChild(title);
    header.appendChild(value);
    card.appendChild(header);
    (cardData.lines || []).slice(0, 4).forEach(function (line) {
      const item = document.createElement("li");
      item.textContent = line;
      list.appendChild(item);
    });
    card.appendChild(list);
    return card;
  }

  function renderAlmoxTopManagerPanel_() {
    renderAlmoxManagerPanel_();
  }

  function renderAlmoxAlertCards_() {
    renderAlmoxManagerPanel_();
  }

  function checkAlmoxAlertStatus_() {
    const state = loadAlmoxState_();
    const alerts = generateAlmoxAlerts_();
    const addedAlerts = [];

    alerts.forEach(function (alert) {
      const added = addAlmoxAlertHistory_(state, alert);
      if (added) {
        addedAlerts.push(added);
      }
    });

    if (addedAlerts.length) {
      saveAlmoxState_(state);
      addedAlerts.forEach(function (alert) {
        sendAlmoxAlertNotification_(alert, state);
      });
    }

    return {
      alerts: alerts,
      addedAlerts: addedAlerts,
      muted: Boolean(state.alertsMuted)
    };
  }

  function generateAlmoxAlerts_() {
    const balances = calculateAlmoxBalances_();
    const alerts = [];

    balances.forEach(function (balance) {
      const item = balance.item || {};
      const itemId = item.id || normalizeCompositionKey_(item.name);
      const expiration = getAlmoxExpirationInfo_(item);

      if (parseNumber_(balance.balance) <= 0) {
        alerts.push({
          key: "zero:" + itemId,
          type: "zerado",
          severity: "critical",
          itemId: item.id || "",
          itemName: item.name || "Item",
          message: formatAlmoxAlertMessage_("zero", balance, expiration)
        });
      } else if (parseNumber_(item.minimumStock) > 0 && parseNumber_(balance.balance) < parseNumber_(item.minimumStock)) {
        alerts.push({
          key: "critical:" + itemId,
          type: "critico",
          severity: "warning",
          itemId: item.id || "",
          itemName: item.name || "Item",
          message: formatAlmoxAlertMessage_("critical", balance, expiration)
        });
      }

      if (expiration && expiration.status !== "valid") {
        alerts.push({
          key: "expiration:" + itemId + ":" + (item.expirationDate || ""),
          type: "vencimento",
          severity: expiration.status === "expired" || expiration.status === "near" ? "critical" : "warning",
          itemId: item.id || "",
          itemName: item.name || "Item",
          message: formatAlmoxAlertMessage_("expiration", balance, expiration)
        });
      }
    });

    return alerts;
  }

  function addAlmoxAlertHistory_(state, alert) {
    const now = new Date().toISOString();
    const history = Array.isArray(state.alertHistory) ? state.alertHistory : [];
    const environmentId = getActiveStockEnvironmentId_();
    const recentCutoff = Date.now() - (12 * 60 * 60 * 1000);
    const alreadyRecent = history.some(function (item) {
      return item.key === alert.key &&
        clean(item.environmentId) === environmentId &&
        new Date(item.createdAt || 0).getTime() >= recentCutoff;
    });

    if (alreadyRecent) {
      state.alertHistory = history;
      return null;
    }

    const record = {
      id: createId_("almalert"),
      environmentId: environmentId,
      key: alert.key,
      type: alert.type,
      severity: alert.severity,
      itemId: alert.itemId || "",
      itemName: alert.itemName || "",
      message: alert.message,
      createdAt: now
    };
    state.alertHistory = [record].concat(history).slice(0, 80);
    return record;
  }

  function sendAlmoxAlertNotification_(alert, state) {
    if (!alert || state.alertsMuted) {
      return;
    }

    showAlmoxToast_(alert.message, alert.severity === "critical" ? "error" : "info");

    if (!("Notification" in window)) {
      return;
    }

    const title = "Alerta Stock IA";
    const options = {
      body: alert.message.replace(/^Alerta Stock IA:\s*/i, ""),
      tag: alert.key
    };

    try {
      if (Notification.permission === "granted") {
        new Notification(title, options);
      }
    } catch (error) {
      console.warn("Nao foi possivel disparar notificacao do almoxarifado.", error);
    }
  }

  function formatAlmoxAlertMessage_(kind, balance, expiration) {
    const item = balance && balance.item ? balance.item : {};
    const name = item.name || "Item";

    if (kind === "zero") {
      return "Alerta Stock IA: " + name + " esta zerado. Reposicao urgente.";
    }
    if (kind === "critical") {
      return "Alerta Stock IA: " + name + " esta abaixo do estoque minimo. Saldo atual: " +
        formatQuantity_(balance.balance) + " " + (item.unit || "un") + ".";
    }
    if (kind === "expiration" && expiration) {
      return "Alerta Stock IA: " + name + " " + expiration.message;
    }

    return "Alerta Stock IA: verificar item critico no almoxarifado.";
  }

  function formatAlmoxAlertMuteUntil_(value) {
    if (!value) {
      return "reativacao manual";
    }

    return formatDateTime_(value);
  }

  function collectAlmoxManagerData_() {
    const state = loadAlmoxState_();
    const balances = calculateAlmoxBalances_();
    const activeItems = filterAlmoxItemsByActiveEnvironment_(state.items);
    const activeMovements = filterAlmoxMovementsByActiveEnvironment_(state.movements);
    const activeAlertHistory = filterAlmoxAlertHistoryByActiveEnvironment_(state.alertHistory);
    const itemsById = {};
    activeItems.forEach(function (item) {
      itemsById[item.id] = item;
    });
    const movements = activeMovements.slice().sort(function (a, b) {
      return String(getAlmoxMovementSortKey_(b)).localeCompare(String(getAlmoxMovementSortKey_(a)));
    });
    const zeroItems = buildAlmoxZeroItems_(balances);
    const criticalItems = buildAlmoxCriticalItems_(balances);
    const expiringItems = buildAlmoxExpirationItems_(balances);
    const activeAlerts = generateAlmoxAlerts_();

    return {
      state: Object.assign({}, state, {
        items: activeItems,
        movements: activeMovements,
        alertHistory: activeAlertHistory
      }),
      profile: getAlmoxReportProfile_(),
      balances: balances,
      itemsById: itemsById,
      movements: movements,
      zeroItems: zeroItems,
      criticalItems: criticalItems,
      expiringItems: expiringItems,
      activeAlerts: activeAlerts,
      alertHistory: activeAlertHistory,
      recentMovements: buildAlmoxRecentMovements_(movements, itemsById),
      recentExits: movements.filter(function (movement) { return movement.type === "saida"; }).slice(0, 5),
      recentEntries: movements.filter(function (movement) { return movement.type === "entrada"; }).slice(0, 5)
    };
  }

  function handleAlmoxEloAction_(action) {
    const data = collectAlmoxManagerData_();
    const profile = data.profile || {};
    const lastMovement = data.recentMovements && data.recentMovements[0] ? data.recentMovements[0] : null;
    const criticalNames = data.criticalItems.map(function (balance) {
      return balance.item.name + " (" + formatQuantity_(balance.balance) + " " + (balance.item.unit || "un") + ")";
    });
    const zeroNames = data.zeroItems.map(function (balance) {
      return balance.item.name;
    });
    const expiringNames = data.expiringItems.map(function (entry) {
      return entry.balance.item.name + " - " + entry.expiration.message;
    });
    const baseContext = [
      "Contexto do Almoxarifado ObraReport:",
      "Ambiente: " + (profile.unitName || profile.workName || "Almoxarifado atual") + ".",
      "Itens cadastrados: " + data.balances.length + ".",
      "Itens zerados: " + data.zeroItems.length + (zeroNames.length ? " (" + summarizeStockIaList_(zeroNames, 4) + ")" : "") + ".",
      "Itens abaixo do minimo: " + data.criticalItems.length + (criticalNames.length ? " (" + summarizeStockIaList_(criticalNames, 4) + ")" : "") + ".",
      "Itens proximos do vencimento: " + data.expiringItems.length + (expiringNames.length ? " (" + summarizeStockIaList_(expiringNames, 3) + ")" : "") + ".",
      "Entradas recentes: " + data.recentEntries.length + ". Saidas recentes: " + data.recentExits.length + ".",
      "Ultima movimentacao: " + (lastMovement ? lastMovement.type + " de " + lastMovement.material + " (" + lastMovement.quantity + ") em " + lastMovement.dateTime : "nenhuma movimentacao recente") + "."
    ].join("\n");
    let question = "Elo, analise os riscos deste almoxarifado e diga as proximas acoes prioritarias. Nao altere estoque, apenas oriente.\n\n" + baseContext;

    if (action === "purchase") {
      question = "Elo, sugira uma lista de compras ou reposicao para este almoxarifado com base nos itens zerados, abaixo do minimo e proximos do vencimento. Nao altere estoque, apenas recomende.\n\n" + baseContext;
    } else if (action === "movement") {
      question = "Elo, resuma as movimentacoes deste almoxarifado e destaque pontos de atencao operacional para o gestor. Nao altere estoque, apenas analise.\n\n" + baseContext;
    }

    if (askEloQuestion_(question)) {
      showAlmoxToast_("Pergunta enviada ao Elo Assistente.", "success");
      return;
    }

    showAlmoxToast_("Elo ainda nao carregou nesta tela. Use o botao flutuante do Elo para perguntar.", "info");
  }

  function buildAlmoxCriticalItems_(balances) {
    return (balances || []).filter(function (balance) {
      return parseNumber_(balance.item.minimumStock) > 0 &&
        parseNumber_(balance.balance) > 0 &&
        parseNumber_(balance.balance) < parseNumber_(balance.item.minimumStock);
    });
  }

  function buildAlmoxZeroItems_(balances) {
    return (balances || []).filter(function (balance) {
      return parseNumber_(balance.balance) <= 0;
    });
  }

  function buildAlmoxExpirationItems_(balances) {
    return (balances || []).map(function (balance) {
      const expiration = getAlmoxExpirationInfo_(balance.item);
      return expiration && expiration.status !== "valid" ? {
        item: balance.item,
        balance: balance.balance,
        expirationDate: balance.item.expirationDate,
        days: expiration.days,
        status: expiration.status,
        label: expiration.label,
        message: expiration.message
      } : null;
    }).filter(Boolean);
  }

  function buildAlmoxRecentMovements_(movements, itemsById) {
    return (movements || []).slice(0, 8).map(function (movement) {
      const item = (itemsById || {})[movement.itemId] || {};
      return {
        movement: movement,
        item: item,
        dateTime: formatAlmoxDateTime_(movement),
        type: movement.type === "entrada" ? "Entrada" : "Saida",
        material: item.name || "Item",
        quantity: formatQuantity_(movement.quantity) + " " + (item.unit || "un"),
        responsible: movement.responsible || movement.recipient || "-",
        sectorOrOrigin: movement.type === "entrada"
          ? (movement.documentNumber || "Origem/nota nao informada")
          : (movement.sector || "Setor/destino nao informado")
      };
    });
  }

  function buildAlmoxRiskLevel_(data) {
    if (data && data.zeroItems && data.zeroItems.length) {
      return {
        label: "Critico",
        className: "status-danger",
        message: "Ha item(ns) zerado(s). Reposicao urgente."
      };
    }

    if (data && data.criticalItems && data.criticalItems.length) {
      return {
        label: "Atencao",
        className: "status-warning",
        message: "Ha item(ns) abaixo do estoque minimo."
      };
    }

    return {
      label: "Baixo",
      className: "status-ok",
      message: "Sem itens zerados ou abaixo do minimo."
    };
  }

  function buildAlmoxReportViewModel_() {
    const data = collectAlmoxManagerData_();
    const totalBalance = data.balances.reduce(function (sum, balance) {
      return sum + parseNumber_(balance.balance);
    }, 0);
    const risk = buildAlmoxRiskLevel_(data);
    const dashboard = buildAlmoxDashboardViewModel_();
    const dashboardTopMoved = dashboard.topMovedItems[0];
    const exits = data.movements.filter(function (movement) { return movement.type === "saida"; });
    const entries = data.movements.filter(function (movement) { return movement.type === "entrada"; });
    const exitsWithoutResponsible = exits.filter(function (movement) {
      return !clean(movement.responsible) && !clean(movement.recipient);
    });
    const exitsWithoutSector = exits.filter(function (movement) {
      return !clean(movement.sector);
    });
    const entriesWithoutOrigin = entries.filter(function (movement) {
      return !clean(movement.documentNumber);
    });
    const invalidMovements = data.movements.filter(function (movement) {
      return parseNumber_(movement.quantity) <= 0 || !data.itemsById[movement.itemId];
    });
    const lastEntry = entries[0];
    const lastExit = exits[0];
    const describeMovement = function (movement) {
      if (!movement) {
        return "Nenhuma registrada.";
      }

      return getAlmoxMovementDisplayDateTime_(movement) + ": " +
        formatAlmoxMovementText_(movement, data.itemsById[movement.itemId] || {});
    };

    return {
      type: "Relatorio",
      profile: data.profile,
      stats: [
        { label: "Itens cadastrados", value: data.balances.length, className: "status-muted" },
        { label: "Saldo total", value: formatQuantity_(totalBalance), suffix: "unidades", className: "status-muted" },
        { label: "Itens abaixo do minimo", value: data.criticalItems.length, className: data.criticalItems.length ? "status-warning" : "status-ok" },
        { label: "Itens zerados", value: data.zeroItems.length, className: data.zeroItems.length ? "status-danger" : "status-ok" },
        { label: "Movimentacoes recentes", value: data.movements.length, className: "status-muted" },
        { label: "Saidas no periodo", value: dashboard.periodExits.length, suffix: dashboard.periodLabel, className: dashboard.periodExits.length ? "status-warning" : "status-muted" },
        { label: "Entradas no periodo", value: dashboard.periodEntries.length, suffix: dashboard.periodLabel, className: dashboard.periodEntries.length ? "status-ok" : "status-muted" },
        { label: "Alertas ativos", value: data.activeAlerts.length, className: data.activeAlerts.some(function (alert) { return alert.severity === "critical"; }) ? "status-danger" : (data.activeAlerts.length ? "status-warning" : "status-ok") },
        { label: "Risco geral", value: risk.label, className: risk.className }
      ],
      risk: risk,
      summaryItems: [
        ["Itens cadastrados", data.balances.length],
        ["Saldo total", formatQuantity_(totalBalance) + " unidades"],
        ["Itens abaixo do minimo", data.criticalItems.length],
        ["Itens zerados", data.zeroItems.length],
        ["Alertas ativos", data.activeAlerts.length ? summarizeStockIaList_(data.activeAlerts.map(function (alert) { return alert.message; }), 3) : "Nenhum alerta ativo."],
        ["Material mais movimentado", dashboardTopMoved ? dashboardTopMoved.name + " - " + formatQuantity_(dashboardTopMoved.quantity) + " " + dashboardTopMoved.unit + " em " + dashboard.periodLabel : "Nenhuma saida no periodo."],
        ["Tendencia operacional", dashboard.trend.label],
        ["Ultima entrada", describeMovement(lastEntry)],
        ["Ultima saida", describeMovement(lastExit)],
        ["Recomendacao", data.zeroItems.length || data.criticalItems.length ? "Priorizar reposicao e revisar retiradas recentes." : "Manter acompanhamento periodico do estoque."]
      ],
      auditItems: [
        ["Risco de falta", risk.message],
        ["Risco geral do dashboard", dashboard.shortage.label],
        ["Itens zerados", data.zeroItems.length ? summarizeStockIaList_(data.zeroItems.map(function (balance) { return balance.item.name; }), 6) : "Nenhum item zerado."],
        ["Itens abaixo do minimo", data.criticalItems.length ? summarizeStockIaList_(data.criticalItems.map(function (balance) { return balance.item.name; }), 6) : "Nenhum item abaixo do minimo."],
        ["Entradas sem origem/nota", entriesWithoutOrigin.length],
        ["Saidas sem responsavel", exitsWithoutResponsible.length],
        ["Saidas sem setor/destino", exitsWithoutSector.length],
        ["Movimentacoes invalidas", invalidMovements.length],
        ["Alertas gerados", data.alertHistory.length ? summarizeStockIaList_(data.alertHistory.slice(0, 4).map(function (alert) { return alert.message; }), 4) : "Nenhum alerta registrado."],
        ["Recomendacao de reposicao", data.zeroItems.length ? "Comprar/repor itens zerados imediatamente." : (data.criticalItems.length ? "Repor itens abaixo do minimo antes da proxima retirada." : "Nao ha reposicao urgente no momento.")],
        ["Recomendacao de controle", "Bloquear retiradas sem identificacao, exigir setor/destino e registrar origem ou nota em toda entrada."]
      ],
      tables: {
        criticalItems: data.criticalItems.map(function (balance) {
          return [
            balance.item.name || "Item",
            formatQuantity_(balance.balance) + " " + (balance.item.unit || "un"),
            formatQuantity_(balance.item.minimumStock) + " " + (balance.item.unit || "un"),
            "Atencao",
            "Repor ate o estoque minimo e revisar consumo recente."
          ];
        }),
        zeroItems: data.zeroItems.map(function (balance) {
          return [
            balance.item.name || "Item",
            "Zerado",
            "Reposicao urgente antes de nova retirada."
          ];
        }),
        expirationItems: data.expiringItems.map(function (info) {
          return [
            info.item.name || "Item",
            formatDateOnly_(info.expirationDate),
            String(info.days),
            info.label
          ];
        }),
        recentMovements: data.recentMovements.map(function (entry) {
          return [
            entry.dateTime,
            entry.type,
            entry.material,
            entry.quantity,
            entry.responsible,
            entry.sectorOrOrigin
          ];
        }),
        alerts: data.activeAlerts.map(function (alert) {
          return [
            alert.severity === "critical" ? "Critico" : "Atencao",
            alert.itemName || "Item",
            alert.type || "alerta",
            alert.message
          ];
        }),
        alertHistory: data.alertHistory.slice(0, 8).map(function (alert) {
          return [
            formatDateTime_(alert.createdAt),
            alert.severity === "critical" ? "Critico" : "Atencao",
            alert.itemName || "Item",
            alert.message
          ];
        })
      }
    };
  }

  function getAlmoxReportProfile_() {
    const environment = getActiveStockEnvironment_();
    const client = (appState.clients || [])[0] || {};
    const work = (appState.works || [])[0] || {};
    const environmentUnit = environment.mode === "obra"
      ? clean(environment.workName)
      : clean(environment.unitName);
    return {
      clientName: clean(environment.clientName) || clean(client.name) || "Cliente demonstrativo",
      unitName: environmentUnit || clean(work.name) || clean(work.address) || "Almoxarifado Central",
      environmentName: clean(environment.environmentName) || "Ambiente Stock IA",
      responsibleName: clean(environment.responsible) || clean(currentUser && currentUser.name) || "Gestor responsavel",
      systemName: "Stock IA / ObraReport",
      emittedAt: formatDateTime_(new Date().toISOString())
    };
  }

  function buildAlmoxReportIntro_() {
    const profile = getAlmoxReportProfile_();
    return "Relatorio gerado pelo Stock IA para " + profile.clientName +
      ", unidade " + profile.unitName + ", ambiente " + profile.environmentName + ", em " + profile.emittedAt + ".";
  }

  function getAlmoxExpirationInfo_(item) {
    const expirationDate = clean(item && item.expirationDate);
    if (!expirationDate) {
      return null;
    }

    const today = new Date(toDateKey_(new Date()) + "T00:00:00");
    const target = new Date(expirationDate + "T00:00:00");
    if (Number.isNaN(target.getTime())) {
      return null;
    }

    const days = Math.ceil((target.getTime() - today.getTime()) / 86400000);
    if (days < 0) {
      return {
        status: "expired",
        label: "vencido",
        days: days,
        message: "esta vencido ha " + Math.abs(days) + " dia(s)."
      };
    }

    if (days <= 30) {
      return {
        status: "near",
        label: "proximo do vencimento",
        days: days,
        message: "vence em " + days + " dia(s)."
      };
    }

    if (days <= 60) {
      return {
        status: "attention",
        label: "atencao",
        days: days,
        message: "vence em " + days + " dia(s)."
      };
    }

    return {
      status: "valid",
      label: "valido",
      days: days,
      message: "validade em " + formatDateOnly_(expirationDate) + "."
    };
  }

  function handleViewAlmoxManagerPanel_() {
    renderAlmoxTopManagerPanel_();
    if (almoxManagerCards) {
      almoxManagerCards.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    showAlmoxToast_("Painel do gestor atualizado para visualizacao.", "info");
  }

  function handleToggleAlmoxAlerts_() {
    const state = loadAlmoxState_();
    const nextMuted = !state.alertsMuted;
    state.alertsMuted = nextMuted;
    state.alertsMutedUntil = nextMuted ? new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString() : "";
    saveAlmoxState_(state);
    renderAlmoxTopManagerPanel_();
    showAlmoxToast_(
      state.alertsMuted ? "Alertas silenciados por 2 horas. O gestor ainda pode consultar a Central quando quiser." : "Alertas ativos novamente.",
      "info"
    );
  }

  function renderAlmoxItems_() {
    if (!almoxItemsCards && !almoxItemsRows) {
      return;
    }

    updateAlmoxItemsCount_();
    const balances = filterAlmoxBalances_(calculateAlmoxBalances_());
    if (almoxItemsCards) {
      almoxItemsCards.innerHTML = "";
      if (!balances.length) {
        almoxItemsCards.appendChild(createAlmoxEmptyAction_(
          almoxSearchTerm ? "Nenhum item encontrado para esta busca." : "Nenhum item cadastrado ainda.",
          "Cadastrar item",
          "item"
        ));
        return;
      }

      balances.forEach(function (balance) {
        almoxItemsCards.appendChild(createAlmoxItemCard_(balance));
      });
      return;
    }

    almoxItemsRows.innerHTML = "";
    if (!balances.length) {
      appendStockIaEmptyRow_(almoxItemsRows, 7, "Nenhum item cadastrado.");
      return;
    }

    balances.forEach(function (balance) {
      const row = document.createElement("tr");
      appendStockIaCell_(row, balance.item.name);
      appendStockIaCell_(row, balance.item.category || "Geral");
      appendStockIaCell_(row, balance.item.unit || "un");
      appendStockIaCell_(row, balance.item.location || "-");
      appendStockIaCell_(row, formatQuantity_(balance.balance));
      appendStockIaCell_(row, formatQuantity_(balance.item.minimumStock));
      appendStockIaCell_(row, balance.status);
      almoxItemsRows.appendChild(row);
    });
  }

  function toggleAlmoxItemsVisibility_() {
    almoxItemsVisible = !almoxItemsVisible;

    const section = document.getElementById("almoxItemsSection");
    const button = document.getElementById("almoxToggleItemsButton");

    if (!section || !button) {
      return;
    }

    section.classList.toggle("almox-items-expanded", almoxItemsVisible);
    section.classList.toggle("almox-items-collapsed", !almoxItemsVisible);
    button.textContent = almoxItemsVisible ? "Ocultar itens" : "Ver itens";
  }

  function bindAlmoxItemsToggle_() {
    const toggleButton = document.getElementById("almoxToggleItemsButton");

    if (toggleButton) {
      toggleButton.addEventListener("click", toggleAlmoxItemsVisibility_);
    }
  }

  function updateAlmoxItemsCount_() {
    const counter = document.getElementById("almoxItemsCount");
    const state = loadAlmoxState_();
    const total = state && Array.isArray(state.items) ? filterAlmoxItemsByActiveEnvironment_(state.items).length : 0;

    if (!counter) {
      return;
    }

    counter.textContent = total === 1 ? "1 item cadastrado" : total + " itens cadastrados";
  }

  function toggleAlmoxHistoryVisibility_() {
    almoxHistoryVisible = !almoxHistoryVisible;

    const section = document.getElementById("almoxHistorySection");
    const button = document.getElementById("almoxToggleHistoryButton");

    if (!section || !button) {
      return;
    }

    section.classList.toggle("almox-history-expanded", almoxHistoryVisible);
    section.classList.toggle("almox-history-collapsed", !almoxHistoryVisible);
    button.textContent = almoxHistoryVisible ? "Ocultar histórico" : "Ver histórico";
  }

  function bindAlmoxEntryCardsScroll_() {
    Array.from(document.querySelectorAll("[data-almox-entry-target]")).forEach(function (card) {
      const scrollToTarget = function () {
        const targetId = card.getAttribute("data-almox-entry-target");
        const target = targetId ? document.getElementById(targetId) : null;

        if (!target) {
          return;
        }

        const scrollTarget = target.closest ? target.closest("label") || target : target;
        const rect = scrollTarget.getBoundingClientRect();
        const targetTop = window.scrollY + rect.top - (window.innerHeight / 2) + (rect.height / 2);
        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth"
        });

        if (typeof target.focus === "function") {
          window.setTimeout(function () {
            target.focus({ preventScroll: true });
          }, 350);
        }
      };

      card.addEventListener("click", scrollToTarget);
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          scrollToTarget();
        }
      });
    });
  }

  function bindAlmoxHistoryControls_() {
    const toggleButton = document.getElementById("almoxToggleHistoryButton");

    if (toggleButton) {
      toggleButton.addEventListener("click", toggleAlmoxHistoryVisibility_);
    }

    Array.from(document.querySelectorAll("[data-almox-history-filter]")).forEach(function (button) {
      button.addEventListener("click", function () {
        almoxHistoryFilter = button.getAttribute("data-almox-history-filter") || "all";

        Array.from(document.querySelectorAll("[data-almox-history-filter]")).forEach(function (item) {
          item.classList.toggle("active", item === button);
        });

        renderAlmoxHistory_();
      });
    });
  }

  function filterAlmoxMovementsByType_(movements) {
    if (almoxHistoryFilter === "entrada" || almoxHistoryFilter === "saida") {
      return movements.filter(function (movement) {
        return movement.type === almoxHistoryFilter;
      });
    }

    return movements;
  }

  function updateAlmoxHistoryCount_(movements) {
    const counter = document.getElementById("almoxHistoryCount");
    const total = Array.isArray(movements) ? movements.length : 0;

    if (!counter) {
      return;
    }

    counter.textContent = total === 1 ? "1 movimentação" : total + " movimentações";
  }

  function renderAlmoxHistory_() {
    if (!almoxHistoryList && !almoxHistoryRows) {
      return;
    }

    const state = loadAlmoxState_();
    const itemsById = {};
    filterAlmoxItemsByActiveEnvironment_(state.items).forEach(function (item) {
      itemsById[item.id] = item;
    });
    const activeMovements = filterAlmoxMovementsByActiveEnvironment_(state.movements);
    const movements = filterAlmoxMovementsByType_(filterAlmoxMovements_(activeMovements.slice().sort(function (a, b) {
      return String(getAlmoxMovementSortKey_(b)).localeCompare(String(getAlmoxMovementSortKey_(a)));
    }), itemsById));
    updateAlmoxHistoryCount_(movements);

    if (almoxHistoryList) {
      almoxHistoryList.innerHTML = "";
      if (!movements.length) {
        almoxHistoryList.appendChild(createAlmoxEmptyAction_(
          almoxSearchTerm ? "Nenhuma movimentação encontrada para esta busca." : "As entradas, saídas e entregas aparecerão aqui.",
          "Registrar entrada",
          "entry"
        ));
        return;
      }

      movements.forEach(function (movement) {
        almoxHistoryList.appendChild(createAlmoxHistoryCard_(movement, itemsById[movement.itemId] || {}));
      });
      return;
    }

    almoxHistoryRows.innerHTML = "";
    if (!movements.length) {
      appendStockIaEmptyRow_(almoxHistoryRows, 4, "Nenhuma movimentação registrada.");
      return;
    }

    movements.forEach(function (movement) {
      const item = itemsById[movement.itemId] || {};
      const row = document.createElement("tr");
      appendStockIaCell_(row, formatAlmoxDateTime_(movement));
      appendStockIaCell_(row, formatAlmoxMovementText_(movement, item));
      appendStockIaCell_(row, movement.responsible || "-");
      appendStockIaCell_(row, movement.notes || "-");
      almoxHistoryRows.appendChild(row);
    });
  }

  function filterAlmoxBalances_(balances) {
    const term = normalizeCompositionKey_(almoxSearchTerm);
    if (!term) {
      return balances;
    }

    const state = loadAlmoxState_();
    const matchingItemIds = {};
    filterAlmoxMovementsByActiveEnvironment_(state.movements).forEach(function (movement) {
      const haystack = normalizeCompositionKey_([
        movement.recipient,
        movement.sector,
        movement.purpose,
        movement.responsible,
        movement.movementDate,
        movement.movementTime,
        movement.movementDateTime,
        movement.notes
      ].join(" "));
      if (haystack.indexOf(term) >= 0) {
        matchingItemIds[movement.itemId] = true;
      }
    });

    return balances.filter(function (balance) {
      const haystack = normalizeCompositionKey_([
        balance.item.name,
        balance.item.category,
        balance.item.location,
        balance.item.notes
      ].join(" "));
      return haystack.indexOf(term) >= 0 || matchingItemIds[balance.item.id];
    });
  }

  function filterAlmoxMovements_(movements, itemsById) {
    const term = normalizeCompositionKey_(almoxSearchTerm);
    if (!term) {
      return movements;
    }

    return movements.filter(function (movement) {
      const item = itemsById[movement.itemId] || {};
      const haystack = normalizeCompositionKey_([
        item.name,
        item.category,
        item.location,
        movement.recipient,
        movement.sector,
        movement.purpose,
        movement.responsible,
        movement.documentNumber,
        movement.movementDate,
        movement.movementTime,
        movement.movementDateTime,
        movement.notes
      ].join(" "));
      return haystack.indexOf(term) >= 0;
    });
  }

  function createAlmoxEmptyAction_(message, buttonText, action) {
    const empty = document.createElement("div");
    const text = document.createElement("p");
    const button = document.createElement("button");
    empty.className = "stock-ia-empty-action";
    text.textContent = message;
    button.type = "button";
    button.className = "mini-button primary";
    button.dataset.almoxAction = action;
    button.textContent = buttonText;
    empty.appendChild(text);
    empty.appendChild(button);
    return empty;
  }

  function getAlmoxAlertMessage_(balance) {
    const current = parseNumber_(balance && balance.balance);
    const minimum = parseNumber_(balance && balance.item && balance.item.minimumStock);

    if (current <= 0) {
      return "Item zerado. Reposicao urgente.";
    }

    if (minimum > 0 && current < minimum) {
      return "Item abaixo do estoque minimo.";
    }

    return "Saldo dentro do previsto.";
  }

  function getDefaultAlmoxMovementDate_() {
    return toDateKey_(new Date());
  }

  function getDefaultAlmoxMovementTime_() {
    const now = new Date();
    return [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0")
    ].join(":");
  }

  function buildAlmoxMovementDateTime_(dateValue, timeValue) {
    const movementDate = clean(dateValue) || getDefaultAlmoxMovementDate_();
    const movementTime = clean(timeValue) || getDefaultAlmoxMovementTime_();
    return movementDate + "T" + movementTime + ":00";
  }

  function formatAlmoxMovementDateTime_(dateTimeValue) {
    if (!dateTimeValue) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(new Date(dateTimeValue));
    } catch (error) {
      return String(dateTimeValue);
    }
  }

  function getAlmoxMovementDisplayDateTime_(movement) {
    if (!movement) {
      return "-";
    }

    if (movement.movementDateTime) {
      return formatAlmoxMovementDateTime_(movement.movementDateTime);
    }

    if (movement.movementDate && movement.movementTime) {
      return formatAlmoxMovementDateTime_(buildAlmoxMovementDateTime_(movement.movementDate, movement.movementTime));
    }

    if (movement.movementDate || movement.date) {
      return formatDateOnly_(movement.movementDate || movement.date) + ", horario nao informado";
    }

    if (movement.createdAt) {
      return formatDateTime_(movement.createdAt);
    }

    return "-";
  }

  function getAlmoxMovementSortKey_(movement) {
    if (!movement) {
      return "";
    }

    if (movement.movementDateTime) {
      return movement.movementDateTime;
    }

    if (movement.movementDate && movement.movementTime) {
      return buildAlmoxMovementDateTime_(movement.movementDate, movement.movementTime);
    }

    if (movement.movementDate || movement.date) {
      return (movement.movementDate || movement.date) + "T00:00:00";
    }

    return movement.createdAt || "";
  }

  function formatAlmoxDateTime_(movement) {
    return getAlmoxMovementDisplayDateTime_(movement);
  }

  function createAlmoxItemCard_(balance) {
    const card = document.createElement("article");
    const header = document.createElement("header");
    const title = document.createElement("h4");
    const status = document.createElement("span");
    const meta = document.createElement("div");
    const actions = document.createElement("div");

    card.className = "almox-item-card";
    title.textContent = balance.item.name || "Item";
    status.className = "almox-status " + (balance.status === "Crítico" ? "critical" : (balance.status === "Atenção" ? "warning" : ""));
    status.textContent = balance.status;
    header.appendChild(title);
    header.appendChild(status);
    card.appendChild(header);

    meta.className = "almox-meta-grid";
    const expiration = getAlmoxExpirationInfo_(balance.item);
    [
      "Categoria: " + (balance.item.category || "Geral"),
      "Local: " + (balance.item.location || "Não informado"),
      "Saldo atual: " + formatQuantity_(balance.balance) + " " + (balance.item.unit || "un"),
      "Estoque mínimo: " + formatQuantity_(balance.item.minimumStock) + " " + (balance.item.unit || "un"),
      expiration ? "Validade: " + formatDateOnly_(balance.item.expirationDate) + " - " + expiration.label : "",
      getAlmoxAlertMessage_(balance)
    ].filter(Boolean).forEach(function (text) {
      const item = document.createElement("span");
      item.textContent = text;
      meta.appendChild(item);
    });
    card.appendChild(meta);

    actions.className = "stock-ia-actions";
    [
      ["Entrada", "entry"],
      ["Saída", "exit"],
      ["Histórico", "history"]
    ].forEach(function (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mini-button";
      button.dataset.almoxAction = action[1];
      button.dataset.almoxItemId = balance.item.id;
      button.textContent = action[0];
      actions.appendChild(button);
    });
    card.appendChild(actions);
    return card;
  }

  function createAlmoxHistoryCard_(movement, item) {
    const card = document.createElement("article");
    const header = document.createElement("header");
    const title = document.createElement("h4");
    const date = document.createElement("span");
    const details = document.createElement("div");

    card.className = "almox-history-item " + (movement.type === "entrada" ? "is-entry" : "is-exit");
    title.textContent = movement.type === "entrada" ? "Entrada" : "Saída";
    date.className = "auth-note";
    date.textContent = formatAlmoxDateTime_(movement);
    header.appendChild(title);
    header.appendChild(date);
    card.appendChild(header);

    details.appendChild(createAlmoxHistoryLine_(formatAlmoxMovementText_(movement, item)));
    if (movement.recipient) {
      details.appendChild(createAlmoxHistoryLine_("Para: " + movement.recipient));
    }
    if (movement.sector) {
      details.appendChild(createAlmoxHistoryLine_("Setor: " + movement.sector));
    }
    if (movement.purpose) {
      details.appendChild(createAlmoxHistoryLine_("Finalidade: " + movement.purpose));
    }
    if (movement.responsible) {
      details.appendChild(createAlmoxHistoryLine_("Responsável: " + movement.responsible));
    }
    if (movement.documentNumber) {
      details.appendChild(createAlmoxHistoryLine_("Origem/nota: " + movement.documentNumber));
    }
    if (movement.notes) {
      details.appendChild(createAlmoxHistoryLine_("Observação: " + movement.notes));
    }
    card.appendChild(details);
    return card;
  }

  function createAlmoxHistoryLine_(text) {
    const line = document.createElement("p");
    line.textContent = text;
    return line;
  }

  function formatAlmoxMovementText_(movement, item) {
    const quantity = formatQuantity_(movement.quantity) + " " + (item.unit || "un");
    if (movement.type === "entrada") {
      return "Entrada — " + quantity + " de " + (item.name || "item") + (movement.documentNumber ? " — origem/nota: " + movement.documentNumber : "") + ".";
    }

    return "Saída — " + quantity + " de " + (item.name || "item") +
      (movement.recipient ? " para " + movement.recipient : "") +
      (movement.sector ? " — " + movement.sector : "") +
      (movement.purpose ? " — " + movement.purpose : "") + ".";
  }

  function buildAlmoxSummaryText_() {
    const state = loadAlmoxState_();
    const balances = calculateAlmoxBalances_();
    const critical = balances.filter(function (balance) {
      return balance.status === "Crítico" || balance.status === "Atenção";
    });
    const activeItems = filterAlmoxItemsByActiveEnvironment_(state.items);
    const activeMovements = filterAlmoxMovementsByActiveEnvironment_(state.movements);
    const exits = activeMovements.filter(function (movement) {
      return movement.type === "saida";
    });

    if (!balances.length) {
      return "Cadastre um item para iniciar o controle do almoxarifado.";
    }

    const mainBalance = critical[0] || balances[0];
    const itemsById = {};
    activeItems.forEach(function (item) {
      itemsById[item.id] = item;
    });
    const activeAlerts = generateAlmoxAlerts_();
    const lastExit = exits.slice().sort(function (a, b) {
      return String(getAlmoxMovementSortKey_(b)).localeCompare(String(getAlmoxMovementSortKey_(a)));
    })[0];

    let summary = "O almoxarifado possui " + balances.length + " item(ns) cadastrado(s). " +
      "O item " + mainBalance.item.name + " possui saldo atual de " +
      formatQuantity_(mainBalance.balance) + " " + (mainBalance.item.unit || "un") + ".";

    if (lastExit) {
      const item = itemsById[lastExit.itemId] || {};
      summary += " A última entrega foi de " + formatQuantity_(lastExit.quantity) + " " +
        (item.unit || "un") + " de " + (item.name || "item") +
        (lastExit.recipient ? " para " + lastExit.recipient : "") +
        (lastExit.sector ? ", setor " + lastExit.sector : "") +
        (lastExit.purpose ? ", finalidade " + lastExit.purpose : "") + ".";
      summary += " Data/hora da ultima saida: " + getAlmoxMovementDisplayDateTime_(lastExit) + ".";
    } else if (critical.length) {
      summary += " Existem " + critical.length + " item(ns) em atenção ou crítico.";
    } else {
      summary += " Nenhuma entrega foi registrada ainda.";
    }

    if (activeAlerts.length) {
      summary += " Alertas ativos: " + summarizeStockIaList_(activeAlerts.map(function (alert) { return alert.message; }), 3) + ".";
    }

    return summary;
  }

  function generateAlmoxSummary_() {
    const summary = buildAlmoxSummaryText_();
    if (almoxSummaryText) {
      almoxSummaryText.textContent = summary;
    }
    const copied = copyTextFallback_(summary);
    showAlmoxToast_(copied ? "Resumo do almoxarifado gerado e copiado." : "Resumo gerado.", copied ? "success" : "info");
  }

  function buildAlmoxGeneratedSummaryText_() {
    const state = loadAlmoxState_();
    const balances = calculateAlmoxBalances_();
    const activeItems = filterAlmoxItemsByActiveEnvironment_(state.items);
    const activeMovements = filterAlmoxMovementsByActiveEnvironment_(state.movements);

    if (!balances.length) {
      return "Nenhum item cadastrado ainda. Cadastre materiais para gerar um resumo do almoxarifado.";
    }

    const itemsById = {};
    activeItems.forEach(function (item) {
      itemsById[item.id] = item;
    });
    const totalBalance = balances.reduce(function (sum, balance) {
      return sum + parseNumber_(balance.balance);
    }, 0);
    const belowMinimum = balances.filter(function (balance) {
      return parseNumber_(balance.item.minimumStock) > 0 &&
        parseNumber_(balance.balance) > 0 &&
        parseNumber_(balance.balance) < parseNumber_(balance.item.minimumStock);
    }).length;
    const zeroItems = balances.filter(function (balance) {
      return parseNumber_(balance.balance) <= 0;
    }).length;
    const movements = activeMovements.slice().sort(function (a, b) {
      return String(getAlmoxMovementSortKey_(b)).localeCompare(String(getAlmoxMovementSortKey_(a)));
    });
    const activeAlerts = generateAlmoxAlerts_();
    const lastEntry = movements.find(function (movement) {
      return movement.type === "entrada";
    });
    const lastExit = movements.find(function (movement) {
      return movement.type === "saida";
    });
    const describeMovement = function (movement) {
      if (!movement) {
        return "nenhuma";
      }

      const item = itemsById[movement.itemId] || {};
      const base = formatQuantity_(movement.quantity) + " " + (item.unit || "un") + " de " + (item.name || "item");
      const datePrefix = "em " + getAlmoxMovementDisplayDateTime_(movement) + ": ";
      if (movement.type === "entrada") {
        return datePrefix + base + (movement.documentNumber ? " com origem/nota " + movement.documentNumber : "");
      }

      return datePrefix + base +
        (movement.recipient ? " para " + movement.recipient : "") +
        (movement.sector ? ", setor " + movement.sector : "") +
        (movement.responsible ? ", responsavel " + movement.responsible : "");
    };
    const dashboard = buildAlmoxDashboardViewModel_();
    const topMoved = dashboard.topMovedItems[0];

    return buildAlmoxReportIntro_() + " O almoxarifado possui " + balances.length + " item(ns) cadastrado(s), com saldo total de " +
      formatQuantity_(totalBalance) + " unidade(s). Ha " + belowMinimum + " item(ns) abaixo do minimo e " +
      zeroItems + " item(ns) zerado(s). Foram registradas " + activeMovements.length +
      " movimentacao(oes) recentes. A ultima entrada foi " + describeMovement(lastEntry) +
      ". A ultima saida foi " + describeMovement(lastExit) +
      ". No dashboard, o material mais movimentado em " + dashboard.periodLabel + " e " +
      (topMoved ? topMoved.name + " (" + formatQuantity_(topMoved.quantity) + " " + topMoved.unit + ")" : "nenhum item com saida no periodo") +
      ". Risco geral: " + dashboard.shortage.label + ". Tendencia: " + dashboard.trend.label +
      ". Alertas ativos: " + (activeAlerts.length ? summarizeStockIaList_(activeAlerts.map(function (alert) { return alert.message; }), 3) : "nenhum alerta ativo") +
      ". Mensagem ao gestor: acompanhe os itens criticos e programe reposicao antes da falta em campo.";
  }

  function buildAlmoxAuditText_() {
    const state = loadAlmoxState_();
    const balances = calculateAlmoxBalances_();
    const activeItems = filterAlmoxItemsByActiveEnvironment_(state.items);
    const activeMovements = filterAlmoxMovementsByActiveEnvironment_(state.movements);

    if (!balances.length) {
      return "Nenhum item cadastrado ainda. Nao ha dados suficientes para auditar o almoxarifado.";
    }

    const itemsById = {};
    activeItems.forEach(function (item) {
      itemsById[item.id] = item;
    });
    const zeroItems = balances.filter(function (balance) {
      return parseNumber_(balance.balance) <= 0;
    });
    const belowMinimum = balances.filter(function (balance) {
      return parseNumber_(balance.item.minimumStock) > 0 &&
        parseNumber_(balance.balance) > 0 &&
        parseNumber_(balance.balance) < parseNumber_(balance.item.minimumStock);
    });
    const exits = activeMovements.filter(function (movement) {
      return movement.type === "saida";
    });
    const entries = activeMovements.filter(function (movement) {
      return movement.type === "entrada";
    });
    const exitsWithoutResponsible = exits.filter(function (movement) {
      return !clean(movement.responsible) && !clean(movement.recipient);
    });
    const exitsWithoutSector = exits.filter(function (movement) {
      return !clean(movement.sector);
    });
    const entriesWithoutOrigin = entries.filter(function (movement) {
      return !clean(movement.documentNumber);
    });
    const invalidMovements = activeMovements.filter(function (movement) {
      return parseNumber_(movement.quantity) <= 0 || !itemsById[movement.itemId];
    });
    const expirationIssues = balances.map(function (balance) {
      const expiration = getAlmoxExpirationInfo_(balance.item);
      return expiration && expiration.status !== "valid" ? balance.item.name + " " + expiration.message : "";
    }).filter(Boolean);
    const activeAlerts = generateAlmoxAlerts_();
    const dashboard = buildAlmoxDashboardViewModel_();
    const topMoved = dashboard.topMovedItems[0];
    const issues = [];

    if (zeroItems.length) {
      issues.push(zeroItems.length + " item(ns) zerado(s) exigem reposicao urgente: " + summarizeStockIaList_(zeroItems.map(function (balance) { return balance.item.name; }), 5) + ".");
    }

    if (belowMinimum.length) {
      issues.push(belowMinimum.length + " item(ns) abaixo do estoque minimo: " + summarizeStockIaList_(belowMinimum.map(function (balance) { return balance.item.name; }), 5) + ".");
    }

    if (exitsWithoutResponsible.length) {
      issues.push("Foram identificadas " + exitsWithoutResponsible.length + " saida(s) sem responsavel ou pessoa que retirou.");
    }

    if (exitsWithoutSector.length) {
      issues.push("Foram identificadas " + exitsWithoutSector.length + " saida(s) sem setor/destino.");
    }

    if (entriesWithoutOrigin.length) {
      issues.push("Foram identificadas " + entriesWithoutOrigin.length + " entrada(s) sem origem, fornecedor ou nota.");
    }

    if (invalidMovements.length) {
      issues.push("Foram identificadas " + invalidMovements.length + " movimentacao(oes) com quantidade invalida ou item inexistente.");
    }

    if (expirationIssues.length) {
      issues.push("Itens com vencimento critico ou em atencao: " + summarizeStockIaList_(expirationIssues, 5) + ".");
    }

    if (activeAlerts.length) {
      issues.push("Alertas automaticos ativos: " + summarizeStockIaList_(activeAlerts.map(function (alert) { return alert.message; }), 5) + ".");
    }

    const dashboardInsight = " Dashboard: risco geral " + dashboard.shortage.label +
      ", tendencia operacional: " + dashboard.trend.label +
      ", material mais movimentado em " + dashboard.periodLabel + ": " +
      (topMoved ? topMoved.name + " com " + formatQuantity_(topMoved.quantity) + " " + topMoved.unit + " retiradas." : "sem saidas no periodo.");

    if (!issues.length) {
      return buildAlmoxReportIntro_() + " Nao foram encontradas inconsistencias criticas. O almoxarifado esta dentro dos parametros cadastrados. Tendencia operacional: " + dashboard.trend.label;
    }

    return buildAlmoxReportIntro_() + " Auditoria do almoxarifado: " + issues.join(" ") +
      dashboardInsight +
      " Risco de falta: " + (zeroItems.length || belowMinimum.length ? "alto para itens criticos." : "baixo no momento.") +
      " Recomendacao de reposicao: priorize itens zerados e abaixo do minimo." +
      " Recomendacao de controle: bloquear retiradas sem identificacao, exigir setor/destino e registrar origem ou nota em toda entrada.";
  }

  function renderAlmoxGeneratedReport_(type, data) {
    if (!almoxGeneratedReport) {
      return;
    }

    const viewModel = data && data.stats ? data : buildAlmoxReportViewModel_();
    const header = document.createElement("div");
    const titleBlock = document.createElement("div");
    const eyebrow = document.createElement("p");
    const title = document.createElement("h3");
    const subtitle = document.createElement("p");
    const risk = document.createElement("span");

    almoxGeneratedReport.innerHTML = "";
    almoxGeneratedReport.classList.remove("is-hidden");
    almoxGeneratedReport.classList.add("almox-generated-report");

    header.className = "almox-report-header";
    eyebrow.className = "eyebrow";
    eyebrow.textContent = type || "Relatorio gerencial";
    title.textContent = "Relatorio Stock IA - Almoxarifado";
    subtitle.textContent = viewModel.profile.clientName + " | " +
      viewModel.profile.unitName + " | " +
      viewModel.profile.emittedAt + " | " +
      viewModel.profile.responsibleName;
    risk.className = "almox-report-risk " + viewModel.risk.className;
    risk.textContent = "Risco geral: " + viewModel.risk.label;

    titleBlock.appendChild(eyebrow);
    titleBlock.appendChild(title);
    titleBlock.appendChild(subtitle);
    header.appendChild(titleBlock);
    header.appendChild(risk);
    almoxGeneratedReport.appendChild(header);
    almoxGeneratedReport.appendChild(createAlmoxGeneratedReportActions_(type));
    almoxGeneratedReport.appendChild(createAlmoxReportStats_(viewModel.stats));
    almoxGeneratedReport.appendChild(createAlmoxDefinitionSection_("Resumo gerencial", viewModel.summaryItems));
    almoxGeneratedReport.appendChild(createAlmoxDefinitionSection_("Auditoria", viewModel.auditItems));
    almoxGeneratedReport.appendChild(createAlmoxTableSection_(
      "Itens criticos",
      ["Material", "Saldo", "Minimo", "Status", "Acao recomendada"],
      viewModel.tables.criticalItems,
      "Nenhum item critico encontrado."
    ));
    almoxGeneratedReport.appendChild(createAlmoxTableSection_(
      "Itens zerados",
      ["Material", "Status", "Acao recomendada"],
      viewModel.tables.zeroItems,
      "Nenhum item zerado encontrado."
    ));
    almoxGeneratedReport.appendChild(createAlmoxTableSection_(
      "Itens proximos do vencimento",
      ["Material", "Vencimento", "Dias restantes", "Status"],
      viewModel.tables.expirationItems,
      "Nenhum vencimento critico cadastrado."
    ));
    almoxGeneratedReport.appendChild(createAlmoxTableSection_(
      "Alertas ativos",
      ["Status", "Material", "Tipo", "Mensagem"],
      viewModel.tables.alerts,
      "Nenhum alerta ativo."
    ));
    almoxGeneratedReport.appendChild(createAlmoxTableSection_(
      "Historico de alertas",
      ["Data/hora", "Status", "Material", "Mensagem"],
      viewModel.tables.alertHistory,
      "Nenhum alerta disparado."
    ));
    almoxGeneratedReport.appendChild(createAlmoxTableSection_(
      "Ultimas movimentacoes",
      ["Data/hora", "Tipo", "Material", "Quantidade", "Responsavel", "Setor/origem"],
      viewModel.tables.recentMovements,
      "Nenhuma movimentacao recente registrada."
    ));
    almoxGeneratedReport.appendChild(createAlmoxReportFooter_());
  }

  function createAlmoxReportStats_(stats) {
    const grid = document.createElement("div");
    grid.className = "almox-report-stats";
    (stats || []).forEach(function (stat) {
      const card = document.createElement("article");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      const suffix = document.createElement("small");
      card.className = "almox-report-stat " + (stat.className || "status-muted");
      label.textContent = stat.label;
      value.textContent = String(stat.value);
      suffix.textContent = stat.suffix || "";
      card.appendChild(label);
      card.appendChild(value);
      if (stat.suffix) {
        card.appendChild(suffix);
      }
      grid.appendChild(card);
    });
    return grid;
  }

  function createAlmoxDefinitionSection_(title, items) {
    const section = document.createElement("section");
    const heading = document.createElement("h4");
    const list = document.createElement("dl");
    section.className = "almox-report-section";
    heading.textContent = title;
    list.className = "almox-report-list";
    (items || []).forEach(function (item) {
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = item[0];
      detail.textContent = item[1];
      list.appendChild(term);
      list.appendChild(detail);
    });
    section.appendChild(heading);
    section.appendChild(list);
    return section;
  }

  function createAlmoxTableSection_(title, headers, rows, emptyText) {
    const section = document.createElement("section");
    const heading = document.createElement("h4");
    const wrap = document.createElement("div");
    section.className = "almox-report-section";
    heading.textContent = title;
    wrap.className = "almox-report-table-wrap";
    section.appendChild(heading);

    if (!rows || !rows.length) {
      const empty = document.createElement("p");
      empty.className = "almox-report-empty";
      empty.textContent = emptyText;
      section.appendChild(empty);
      return section;
    }

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    const headerRow = document.createElement("tr");
    table.className = "almox-report-table";
    headers.forEach(function (header) {
      const th = document.createElement("th");
      th.textContent = header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      row.forEach(function (cell, index) {
        const td = document.createElement("td");
        td.textContent = cell;
        if (headers[index] && normalizeCompositionKey_(headers[index]).indexOf("status") >= 0) {
          td.className = getAlmoxStatusClass_(cell);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    section.appendChild(wrap);
    return section;
  }

  function createAlmoxReportFooter_() {
    const footer = document.createElement("p");
    footer.className = "almox-report-footer";
    footer.textContent = "Gerado por Stock IA / ObraReport.";
    return footer;
  }

  function createAlmoxGeneratedReportActions_(type) {
    const actions = document.createElement("div");
    const context = document.createElement("p");
    const downloadButton = document.createElement("button");
    const emailWrap = document.createElement("label");
    const emailInput = document.createElement("input");
    const emailButton = document.createElement("button");

    actions.className = "almox-generated-actions";
    context.textContent = (type || "Relatorio gerencial") + " pronto para baixar ou enviar.";

    downloadButton.type = "button";
    downloadButton.className = "mini-button primary";
    downloadButton.textContent = "Baixar PDF";
    downloadButton.addEventListener("click", function () {
      handleDownloadAlmoxPdf_();
    });

    emailWrap.textContent = "E-mail de destino";
    emailInput.type = "email";
    emailInput.placeholder = "gestor@empresa.com.br";
    emailInput.value = almoxEmailInput ? almoxEmailInput.value : "";
    emailWrap.appendChild(emailInput);

    emailButton.type = "button";
    emailButton.className = "mini-button";
    emailButton.textContent = "Enviar por e-mail";
    emailButton.addEventListener("click", function () {
      handlePrepareAlmoxEmail_(emailInput.value);
    });

    actions.appendChild(context);
    actions.appendChild(downloadButton);
    actions.appendChild(emailWrap);
    actions.appendChild(emailButton);
    return actions;
  }

  function getAlmoxStatusClass_(status) {
    const key = normalizeCompositionKey_(status);
    if (key.indexOf("zerado") >= 0 || key.indexOf("critico") >= 0 || key.indexOf("vencido") >= 0) {
      return "status-danger";
    }
    if (key.indexOf("atencao") >= 0 || key.indexOf("proximo") >= 0) {
      return "status-warning";
    }
    if (key.indexOf("baixo") >= 0 || key.indexOf("ok") >= 0 || key.indexOf("valido") >= 0) {
      return "status-ok";
    }
    return "status-muted";
  }

  function handleGenerateAlmoxSummary_() {
    const summary = buildAlmoxGeneratedSummaryText_();
    almoxLastSummaryText = summary;
    if (almoxSummaryText) {
      almoxSummaryText.textContent = summary;
    }

    renderAlmoxGeneratedReport_("Resumo gerencial", buildAlmoxReportViewModel_());
    renderAlmoxTopManagerPanel_();
    if (almoxGeneratedReport) {
      almoxGeneratedReport.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    showAlmoxToast_("Resumo gerencial gerado.", "success");
  }

  function handleGenerateAlmoxAudit_() {
    const audit = buildAlmoxAuditText_();
    almoxLastAuditText = audit;
    renderAlmoxGeneratedReport_("Auditoria do almoxarifado", buildAlmoxReportViewModel_());
    renderAlmoxTopManagerPanel_();
    if (almoxGeneratedReport) {
      almoxGeneratedReport.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    showAlmoxToast_("Auditoria do almoxarifado gerada.", "success");
  }

  function handleDownloadAlmoxPdf_() {
    printAlmoxReport_();
  }

  function handleSendAlmoxEmail_() {
    handlePrepareAlmoxEmail_();
  }

  function handlePrepareAlmoxEmail_(emailOverride) {
    const email = clean(emailOverride || (almoxEmailInput && almoxEmailInput.value));
    if (!isValidEmail_(email)) {
      showAlmoxToast_("Informe um e-mail valido para enviar o relatorio.", "error");
      return;
    }

    if (almoxEmailInput) {
      almoxEmailInput.value = email;
    }

    if (!almoxLastSummaryText) {
      almoxLastSummaryText = buildAlmoxGeneratedSummaryText_();
    }
    if (!almoxLastAuditText) {
      almoxLastAuditText = buildAlmoxAuditText_();
    }

    renderAlmoxTopManagerPanel_();
    const subject = buildAlmoxEmailSubject_();
    const body = buildAlmoxEmailBody_();
    const url = "mailto:" + encodeURIComponent(email) +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    copyTextFallback_(body);
    window.location.href = url;
    showAlmoxToast_("E-mail aberto no seu aplicativo. Confirme o envio para finalizar.", "success");
  }

  function buildAlmoxEmailSubject_() {
    return "Relatorio Stock IA - Almoxarifado";
  }

  function buildAlmoxEmailBody_() {
    const data = collectAlmoxManagerData_();
    const dashboard = buildAlmoxDashboardViewModel_();
    const topMoved = dashboard.topMovedItems[0];
    const profile = data.profile;
    return [
      "Relatorio Stock IA - Almoxarifado",
      "",
      "Cliente/unidade: " + profile.clientName + " - " + profile.unitName,
      "Responsavel: " + profile.responsibleName,
      "Data/hora: " + profile.emittedAt,
      "",
      "Resumo:",
      limitShareText_(almoxLastSummaryText || buildAlmoxGeneratedSummaryText_(), 900),
      "",
      "Auditoria:",
      limitShareText_(almoxLastAuditText || buildAlmoxAuditText_(), 1100),
      "",
      "Dashboard inteligente:",
      "Periodo: " + dashboard.periodLabel,
      "Risco geral: " + dashboard.shortage.label,
      "Tendencia: " + dashboard.trend.label,
      "Material mais movimentado: " + (topMoved ? topMoved.name + " - " + formatQuantity_(topMoved.quantity) + " " + topMoved.unit : "sem saidas no periodo"),
      "Entradas no periodo: " + dashboard.periodEntries.length,
      "Saidas no periodo: " + dashboard.periodExits.length,
      "",
      "Itens criticos:",
      formatAlmoxPlainList_(data.criticalItems, function (balance) {
        return balance.item.name + " - saldo " + formatQuantity_(balance.balance) + " " + (balance.item.unit || "un") + ", minimo " + formatQuantity_(balance.item.minimumStock) + ".";
      }, "Nenhum item critico."),
      "",
      "Itens zerados:",
      formatAlmoxPlainList_(data.zeroItems, function (balance) {
        return balance.item.name + " - reposicao urgente.";
      }, "Nenhum item zerado."),
      "",
      "Itens proximos do vencimento:",
      formatAlmoxPlainList_(data.expiringItems, function (info) {
        return info.item.name + " - " + info.message;
      }, "Nenhum vencimento critico cadastrado."),
      "",
      "Alertas ativos:",
      formatAlmoxPlainList_(data.activeAlerts, function (alert) {
        return alert.message;
      }, "Nenhum alerta ativo."),
      "",
      "Historico de alertas:",
      formatAlmoxPlainList_(data.alertHistory.slice(0, 6), function (alert) {
        return formatDateTime_(alert.createdAt) + " - " + alert.message;
      }, "Nenhum alerta disparado."),
      "",
      "Ultimas movimentacoes:",
      formatAlmoxPlainList_(data.movements.slice(0, 6), function (movement) {
        return formatAlmoxDateTime_(movement) + " - " + formatAlmoxMovementText_(movement, data.itemsById[movement.itemId] || {});
      }, "Nenhuma movimentacao registrada."),
      "",
      "Gerado por Stock IA / ObraReport."
    ].join("\n");
  }

  function isValidEmail_(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(email));
  }

  function printAlmoxReport_() {
    if (!almoxLastSummaryText) {
      almoxLastSummaryText = buildAlmoxGeneratedSummaryText_();
    }
    if (!almoxLastAuditText) {
      almoxLastAuditText = buildAlmoxAuditText_();
    }

    renderAlmoxTopManagerPanel_();
    const html = buildAlmoxReportPdfHtml_();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.location.href = url;
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    showAlmoxToast_("PDF do almoxarifado aberto. Use Imprimir/Salvar como PDF no navegador.", "success");
  }

  function buildAlmoxReportPdfHtml_() {
    const viewModel = buildAlmoxReportViewModel_();
    const profile = viewModel.profile;
    const title = "Relatorio Stock IA - Almoxarifado";
    return "<!doctype html><html><head><meta charset=\"utf-8\">" +
      "<title>" + escapeHtml_(title) + "</title>" +
      "<style>" +
      "body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#102033;background:#f6f8fb}" +
      ".page{max-width:980px;margin:0 auto;background:#fff;border:1px solid #dbe4ee;padding:28px}" +
      "h1{margin:0 0 6px;font-size:24px}h2{margin:24px 0 10px;font-size:16px;color:#0f5f8f}.sub{color:#607080;margin:0}" +
      ".meta,.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.meta div,.stat{border:1px solid #e2e8f0;padding:10px;border-radius:8px}.stat span{display:block;color:#607080;font-size:11px;text-transform:uppercase;font-weight:700}.stat strong{display:block;font-size:20px;margin-top:4px}" +
      ".section{border-top:1px solid #e2e8f0;margin-top:18px;padding-top:14px}.list{display:grid;grid-template-columns:210px 1fr;gap:6px 12px}.list dt{font-weight:700}.list dd{margin:0;color:#405062}" +
      "table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:12px}th{background:#f6f9fc;color:#102033}.empty{color:#607080}.status-danger{color:#9f1d18;font-weight:700}.status-warning{color:#8a5a00;font-weight:700}.status-ok{color:#126c3a;font-weight:700}.status-muted{color:#607080}footer{margin-top:22px;color:#607080;font-size:12px}@media print{body{background:#fff;padding:0}.page{border:0}.section{break-inside:avoid}}" +
      "</style></head><body><main class=\"page\">" +
      "<h1>" + escapeHtml_(title) + "</h1>" +
      "<p class=\"sub\">" + escapeHtml_(profile.clientName) + " | " + escapeHtml_(profile.unitName) + " | " + escapeHtml_(profile.emittedAt) + " | " + escapeHtml_(profile.responsibleName) + "</p>" +
      "<section class=\"meta\">" +
      "<div><strong>Cliente</strong><br>" + escapeHtml_(profile.clientName) + "</div>" +
      "<div><strong>Unidade</strong><br>" + escapeHtml_(profile.unitName) + "</div>" +
      "<div><strong>Responsavel</strong><br>" + escapeHtml_(profile.responsibleName) + "</div>" +
      "</section>" +
      "<section class=\"stats\">" + viewModel.stats.map(function (stat) {
        return "<article class=\"stat " + escapeAttribute_(stat.className || "status-muted") + "\"><span>" + escapeHtml_(stat.label) + "</span><strong>" + escapeHtml_(stat.value) + "</strong>" + (stat.suffix ? "<small>" + escapeHtml_(stat.suffix) + "</small>" : "") + "</article>";
      }).join("") + "</section>" +
      "<section class=\"section\"><h2>Resumo gerencial</h2>" + formatAlmoxHtmlDefinitionList_(viewModel.summaryItems) + "</section>" +
      "<section class=\"section\"><h2>Auditoria</h2>" + formatAlmoxHtmlDefinitionList_(viewModel.auditItems) + "</section>" +
      "<section class=\"section\"><h2>Itens criticos</h2>" + formatAlmoxHtmlTable_(["Material", "Saldo", "Minimo", "Status", "Acao recomendada"], viewModel.tables.criticalItems, "Nenhum item critico encontrado.") + "</section>" +
      "<section class=\"section\"><h2>Itens zerados</h2>" + formatAlmoxHtmlTable_(["Material", "Status", "Acao recomendada"], viewModel.tables.zeroItems, "Nenhum item zerado encontrado.") + "</section>" +
      "<section class=\"section\"><h2>Itens proximos do vencimento</h2>" + formatAlmoxHtmlTable_(["Material", "Vencimento", "Dias restantes", "Status"], viewModel.tables.expirationItems, "Nenhum vencimento critico cadastrado.") + "</section>" +
      "<section class=\"section\"><h2>Alertas ativos</h2>" + formatAlmoxHtmlTable_(["Status", "Material", "Tipo", "Mensagem"], viewModel.tables.alerts, "Nenhum alerta ativo.") + "</section>" +
      "<section class=\"section\"><h2>Historico de alertas</h2>" + formatAlmoxHtmlTable_(["Data/hora", "Status", "Material", "Mensagem"], viewModel.tables.alertHistory, "Nenhum alerta disparado.") + "</section>" +
      "<section class=\"section\"><h2>Ultimas movimentacoes</h2>" + formatAlmoxHtmlTable_(["Data/hora", "Tipo", "Material", "Quantidade", "Responsavel", "Setor/origem"], viewModel.tables.recentMovements, "Nenhuma movimentacao recente registrada.") + "</section>" +
      "<footer>Gerado por Stock IA / ObraReport.</footer>" +
      "<script>window.onload=function(){window.print();};</script>" +
      "</main></body></html>";
  }

  function formatAlmoxHtmlDefinitionList_(items) {
    return "<dl class=\"list\">" + (items || []).map(function (item) {
      return "<dt>" + escapeHtml_(item[0]) + "</dt><dd>" + escapeHtml_(item[1]) + "</dd>";
    }).join("") + "</dl>";
  }

  function formatAlmoxHtmlTable_(headers, rows, emptyText) {
    if (!rows || !rows.length) {
      return "<p class=\"empty\">" + escapeHtml_(emptyText) + "</p>";
    }

    return "<table><thead><tr>" + headers.map(function (header) {
      return "<th>" + escapeHtml_(header) + "</th>";
    }).join("") + "</tr></thead><tbody>" + rows.map(function (row) {
      return "<tr>" + row.map(function (cell, index) {
        const className = headers[index] && normalizeCompositionKey_(headers[index]).indexOf("status") >= 0 ? getAlmoxStatusClass_(cell) : "";
        return "<td" + (className ? " class=\"" + escapeAttribute_(className) + "\"" : "") + ">" + escapeHtml_(cell) + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody></table>";
  }

  function formatAlmoxPlainList_(items, formatter, emptyText) {
    const safeItems = (items || []).slice(0, 8);
    if (!safeItems.length) {
      return "* " + emptyText;
    }

    return safeItems.map(function (item) {
      return "* " + formatter(item);
    }).join("\n") + ((items || []).length > safeItems.length ? "\n* Outros registros disponiveis na Central do Gestor." : "");
  }

  function formatAlmoxHtmlList_(items, formatter, emptyText) {
    const safeItems = (items || []).slice(0, 8);
    if (!safeItems.length) {
      return "<p>" + escapeHtml_(emptyText) + "</p>";
    }

    return "<ul>" + safeItems.map(function (item) {
      return "<li>" + escapeHtml_(formatter(item)) + "</li>";
    }).join("") + "</ul>";
  }

  function showAlmoxToast_(message, type) {
    if (!almoxActionMessage) {
      return;
    }

    almoxActionMessage.textContent = message;
    almoxActionMessage.className = "stock-ia-toast " + (type || "info");
    window.clearTimeout(showAlmoxToast_.timer);
    showAlmoxToast_.timer = window.setTimeout(function () {
      almoxActionMessage.classList.add("is-hidden");
    }, 4200);
  }

  function summarizeStockIaList_(items, limit) {
    const safeItems = (items || []).filter(Boolean);

    if (!safeItems.length) {
      return "-";
    }

    return safeItems.slice(0, limit).join(", ") + (safeItems.length > limit ? " +" + (safeItems.length - limit) : "");
  }

  function loadStockMasterState_() {
    try {
      const storage = getLocalStorage_();
      const raw = storage ? storage.getItem(STOCK_MASTER_STORAGE_KEY) : "";
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        manualMovements: Array.isArray(parsed.manualMovements) ? parsed.manualMovements : [],
        links: Array.isArray(parsed.links) ? parsed.links : [],
        updatedAt: parsed.updatedAt || new Date().toISOString()
      };
    } catch (error) {
      console.warn("Nao foi possivel carregar o estoque local.", error);
      return {
        items: [],
        manualMovements: [],
        links: [],
        updatedAt: new Date().toISOString()
      };
    }
  }

  function saveStockMasterState_(state) {
    const storage = getLocalStorage_();
    const safeState = {
      items: Array.isArray(state.items) ? state.items : [],
      manualMovements: Array.isArray(state.manualMovements) ? state.manualMovements : [],
      links: Array.isArray(state.links) ? state.links : [],
      updatedAt: new Date().toISOString()
    };
    if (storage) {
      storage.setItem(STOCK_MASTER_STORAGE_KEY, JSON.stringify(safeState));
    }
    return safeState;
  }

  function generateStockId_(prefix) {
    return createId_(prefix || "stk");
  }

  function createStockMasterItem_(data) {
    const state = loadStockMasterState_();
    const now = new Date().toISOString();
    const name = clean(data.name);
    const unit = clean(data.unit) || "un";
    const item = {
      id: generateStockId_("sti"),
      name: name,
      normalizedKey: normalizeStockMaterialKey_(name, unit),
      unit: unit,
      category: clean(data.category) || "Geral",
      minimumStock: parseNumber_(data.minimumStock),
      initialBalance: parseNumber_(data.initialBalance),
      unitCost: parseNumber_(data.unitCost),
      workId: clean(data.workId) || null,
      notes: clean(data.notes),
      createdAt: now,
      updatedAt: now
    };

    if (!item.name) {
      return null;
    }

    state.items.push(item);
    saveStockMasterState_(state);
    return item;
  }

  function updateStockMasterItem_(itemId, data) {
    const state = loadStockMasterState_();
    const item = state.items.find(function (candidate) {
      return candidate.id === itemId;
    });

    if (!item) {
      return null;
    }

    item.name = clean(data.name) || item.name;
    item.unit = clean(data.unit) || item.unit || "un";
    item.category = clean(data.category) || item.category || "Geral";
    item.minimumStock = parseNumber_(data.minimumStock);
    item.initialBalance = parseNumber_(data.initialBalance);
    item.unitCost = parseNumber_(data.unitCost);
    item.workId = clean(data.workId) || null;
    item.notes = clean(data.notes);
    item.normalizedKey = normalizeStockMaterialKey_(item.name, item.unit);
    item.updatedAt = new Date().toISOString();
    saveStockMasterState_(state);
    return item;
  }

  function deleteStockMasterItem_(itemId) {
    const state = loadStockMasterState_();
    state.items = state.items.filter(function (item) {
      return item.id !== itemId;
    });
    state.manualMovements = state.manualMovements.filter(function (movement) {
      return movement.stockItemId !== itemId;
    });
    state.links = state.links.filter(function (link) {
      return link.stockItemId !== itemId;
    });
    saveStockMasterState_(state);
  }

  function addManualStockMovement_(data) {
    const state = loadStockMasterState_();
    const item = state.items.find(function (candidate) {
      return candidate.id === data.stockItemId;
    });

    if (!item) {
      return null;
    }

    const quantity = parseNumber_(data.quantity);
    if (quantity <= 0) {
      return null;
    }

    const unitCost = parseNumber_(data.unitCost);
    const movement = {
      id: generateStockId_("stm"),
      stockItemId: item.id,
      type: data.type === "saida" || data.type === "ajuste" ? data.type : "entrada",
      quantity: quantity,
      unitCost: unitCost,
      totalCost: quantity * unitCost,
      date: clean(data.date) || toDateKey_(new Date()),
      workId: clean(data.workId) || item.workId || null,
      supplier: clean(data.supplier),
      documentNumber: clean(data.documentNumber),
      notes: clean(data.notes),
      source: clean(data.source) || "manual",
      noteId: clean(data.noteId) || null,
      mode: clean(data.mode) || "obra",
      recipientName: clean(data.recipientName),
      sector: clean(data.sector),
      purpose: clean(data.purpose),
      createdAt: new Date().toISOString()
    };

    state.manualMovements.push(movement);
    saveStockMasterState_(state);
    return movement;
  }

  function registerStockEntry_(data) {
    return addManualStockMovement_(Object.assign({}, data, {
      type: "entrada"
    }));
  }

  function registerManualStockExit_(data) {
    return addManualStockMovement_(Object.assign({}, data, {
      type: "saida"
    }));
  }

  function buildRdoMaterialStockKey_(rdoMaterial, dailyLog) {
    const unit = clean(rdoMaterial && rdoMaterial.unit) || "un";
    return [
      dailyLog && dailyLog.id,
      rdoMaterial && rdoMaterial.id,
      normalizeStockMaterialKey_(rdoMaterial && rdoMaterial.name, unit)
    ].filter(Boolean).join("|");
  }

  function linkRdoMaterialToStockItem_(rdoMaterial, dailyLog, stockItemId) {
    const state = loadStockMasterState_();
    const rdoMaterialKey = buildRdoMaterialStockKey_(rdoMaterial, dailyLog);
    const unit = clean(rdoMaterial && rdoMaterial.unit) || "un";
    const existing = state.links.find(function (link) {
      return link.rdoMaterialKey === rdoMaterialKey;
    });
    const payload = {
      id: existing ? existing.id : generateStockId_("stl"),
      stockItemId: stockItemId,
      rdoMaterialKey: rdoMaterialKey,
      normalizedName: normalizeCompositionKey_(rdoMaterial && rdoMaterial.name),
      unit: unit,
      workId: dailyLog && dailyLog.workId ? dailyLog.workId : null,
      createdAt: existing ? existing.createdAt : new Date().toISOString()
    };

    if (existing) {
      Object.assign(existing, payload);
    } else {
      state.links.push(payload);
    }

    saveStockMasterState_(state);
    return payload;
  }

  function findLinkedStockItemForRdoMaterial_(rdoMaterial, dailyLog) {
    const state = loadStockMasterState_();
    const rdoMaterialKey = buildRdoMaterialStockKey_(rdoMaterial, dailyLog);
    const link = state.links.find(function (candidate) {
      return candidate.rdoMaterialKey === rdoMaterialKey;
    });

    if (!link) {
      return null;
    }

    return state.items.find(function (item) {
      return item.id === link.stockItemId;
    }) || null;
  }

  function findMatchingStockItemForRdoMaterial_(rdoMaterial, dailyLog) {
    const state = loadStockMasterState_();
    const key = normalizeStockMaterialKey_(rdoMaterial && rdoMaterial.name, rdoMaterial && rdoMaterial.unit);
    const workId = dailyLog && dailyLog.workId ? dailyLog.workId : null;

    return state.items.find(function (item) {
      return item.normalizedKey === key && item.workId && workId && item.workId === workId;
    }) || state.items.find(function (item) {
      return item.normalizedKey === key && !item.workId;
    }) || state.items.find(function (item) {
      return item.normalizedKey === key;
    }) || null;
  }

  function buildUnlinkedRdoMaterials_() {
    const dailyLogs = getUserDailyLogs_();
    const items = [];

    dailyLogs.forEach(function (logItem) {
      (logItem.materials || []).forEach(function (material) {
        const linked = findLinkedStockItemForRdoMaterial_(material, logItem);
        const matched = findMatchingStockItemForRdoMaterial_(material, logItem);

        if (linked || matched) {
          return;
        }

        items.push({
          rdoMaterialKey: buildRdoMaterialStockKey_(material, logItem),
          material: material,
          dailyLog: logItem,
          date: logItem.date,
          workName: getWorkName_(logItem.workId) || "Obra nao informada"
        });
      });
    });

    return items.sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }

  function buildRealStockMovements_() {
    const state = loadStockMasterState_();
    const movements = [];

    state.manualMovements.forEach(function (movement) {
      if (movement.mode === "almoxarifado") {
        return;
      }

      const item = state.items.find(function (candidate) {
        return candidate.id === movement.stockItemId;
      });

      if (!item) {
        return;
      }

      movements.push(Object.assign({}, movement, {
        source: movement.source || "manual",
        itemName: item.name,
        unit: item.unit
      }));
    });

    getUserDailyLogs_().forEach(function (logItem) {
      (logItem.materials || []).forEach(function (material) {
        const stockItem = findLinkedStockItemForRdoMaterial_(material, logItem) || findMatchingStockItemForRdoMaterial_(material, logItem);

        if (!stockItem) {
          return;
        }

        const quantity = parseNumber_(material.quantity);
        const unitCost = parseNumber_(material.unitValue);
        movements.push({
          id: buildRdoMaterialStockKey_(material, logItem),
          stockItemId: stockItem.id,
          type: "consumo_rdo",
          source: "rdo",
          itemName: stockItem.name,
          quantity: quantity,
          unit: clean(material.unit) || stockItem.unit,
          unitCost: unitCost,
          totalCost: parseNumber_(material.totalValue) || quantity * unitCost,
          date: logItem.date,
          workId: logItem.workId || null,
          dailyLogId: logItem.id,
          notes: clean(material.note),
          createdAt: logItem.updatedAt || logItem.createdAt || ""
        });
      });
    });

    return movements.sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }

  function calculateRealStockBalances_() {
    const state = loadStockMasterState_();
    const movements = buildRealStockMovements_();

    return state.items.filter(function (item) {
      return String(item.category || "").toLowerCase() !== "almoxarifado" &&
        String(item.notes || "").toLowerCase().indexOf("modo almoxarifado") < 0;
    }).map(function (item) {
      const itemMovements = movements.filter(function (movement) {
        return movement.stockItemId === item.id;
      });
      const entries = itemMovements.filter(function (movement) {
        return movement.type === "entrada" || movement.type === "ajuste";
      }).reduce(function (sum, movement) {
        return sum + parseNumber_(movement.quantity);
      }, 0);
      const exits = itemMovements.filter(function (movement) {
        return movement.type === "saida";
      }).reduce(function (sum, movement) {
        return sum + parseNumber_(movement.quantity);
      }, 0);
      const rdoConsumption = itemMovements.filter(function (movement) {
        return movement.type === "consumo_rdo";
      }).reduce(function (sum, movement) {
        return sum + parseNumber_(movement.quantity);
      }, 0);
      const realBalance = roundQuantity_(parseNumber_(item.initialBalance) + entries - exits - rdoConsumption);

      return {
        item: item,
        entries: roundQuantity_(entries),
        manualExits: roundQuantity_(exits),
        rdoConsumption: roundQuantity_(rdoConsumption),
        realBalance: realBalance,
        estimatedValue: Math.max(realBalance, 0) * parseNumber_(item.unitCost),
        movements: itemMovements,
        status: getRealStockStatus_({
          realBalance: realBalance,
          minimumStock: parseNumber_(item.minimumStock)
        })
      };
    }).sort(function (a, b) {
      return String(a.item.name || "").localeCompare(String(b.item.name || ""));
    });
  }

  function buildRealStockSummary_() {
    const balances = calculateRealStockBalances_();
    const movements = buildRealStockMovements_();
    const unlinked = buildUnlinkedRdoMaterials_();

    return {
      itemCount: balances.length,
      estimatedStockValue: balances.reduce(function (sum, balance) {
        return sum + balance.estimatedValue;
      }, 0),
      lowStockCount: balances.filter(function (balance) {
        return balance.status === "Baixo";
      }).length,
      criticalCount: balances.filter(function (balance) {
        return balance.status === "Negativo" || balance.status === "Zerado";
      }).length,
      negativeCount: balances.filter(function (balance) {
        return balance.status === "Negativo";
      }).length,
      rdoConsumptionCount: movements.filter(function (movement) {
        return movement.type === "consumo_rdo";
      }).length,
      manualEntriesCount: movements.filter(function (movement) {
        return movement.type === "entrada";
      }).length,
      unlinkedCount: unlinked.length
    };
  }

  function getStockPeriodLabel_(period) {
    if (period === "7d") {
      return "nos ultimos 7 dias";
    }

    if (period === "month") {
      return "no mes atual";
    }

    if (period === "all") {
      return "em todo o historico";
    }

    return "nos ultimos 30 dias";
  }

  function getStockPeriodStartDate_(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (period === "7d") {
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    }

    if (period === "month") {
      return new Date(today.getFullYear(), today.getMonth(), 1);
    }

    if (period === "all") {
      return null;
    }

    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
  }

  function filterStockMovementsByPeriod_(movements, period) {
    const start = getStockPeriodStartDate_(period);
    if (!start) {
      return movements || [];
    }

    const startTime = start.getTime();
    return (movements || []).filter(function (movement) {
      const date = parseLocalDate_(movement.date);
      return date && date.getTime() >= startTime;
    });
  }

  function filterUnlinkedRdoMaterialsByPeriod_(items, period) {
    const start = getStockPeriodStartDate_(period);
    if (!start) {
      return items || [];
    }

    const startTime = start.getTime();
    return (items || []).filter(function (entry) {
      const date = parseLocalDate_(entry.date);
      return date && date.getTime() >= startTime;
    });
  }

  function buildStockOperationalAlerts_(balances, movements, masterState) {
    const now = new Date().toISOString();
    const alerts = [];
    const state = masterState || loadStockMasterState_();
    const unlinked = filterUnlinkedRdoMaterialsByPeriod_(buildUnlinkedRdoMaterials_(), stockIaCurrentPeriod);
    const rdoMovements = (movements || []).filter(function (movement) {
      return movement.type === "consumo_rdo" || movement.source === "rdo";
    });
    const topByQuantity = buildTopConsumedMaterials_(rdoMovements, {
      sortBy: "quantity",
      limit: 3
    });
    const topByCost = buildTopConsumedMaterials_(rdoMovements, {
      sortBy: "cost",
      limit: 3
    });
    const highQuantityLimit = topByQuantity.length ? Math.max(10, topByQuantity[0].totalQuantity * 0.7) : 0;
    const highCostLimit = topByCost.length ? Math.max(250, topByCost[0].totalCost * 0.7) : 0;

    (balances || []).forEach(function (balance) {
      const item = balance.item || {};
      const unit = item.unit || "un";

      if (balance.realBalance < 0) {
        alerts.push(createStockAlert_("negativo", "critica", item.name + " esta negativo", item.name + " ficou com saldo " + formatQuantity_(balance.realBalance) + " " + unit + ". Revise entradas, saldo inicial ou consumos do RDO.", item.id, item.workId, now));
      } else if (balance.realBalance === 0) {
        alerts.push(createStockAlert_("zerado", "alta", item.name + " esta zerado", "O saldo atual esta zerado. Registre uma entrada ou revise o consumo antes de novas saidas.", item.id, item.workId, now));
      } else if (parseNumber_(item.minimumStock) > 0 && balance.realBalance <= parseNumber_(item.minimumStock)) {
        alerts.push(createStockAlert_("baixo", "alta", item.name + " esta abaixo do minimo", "Saldo atual: " + formatQuantity_(balance.realBalance) + " " + unit + ". Minimo: " + formatQuantity_(item.minimumStock) + " " + unit + ".", item.id, item.workId, now));
      }

      if (parseNumber_(balance.entries) <= 0) {
        alerts.push(createStockAlert_("sem_entrada", "media", item.name + " ainda nao tem entrada manual", "O saldo depende do saldo inicial ou do cadastro mestre. Registre entradas para melhorar a rastreabilidade.", item.id, item.workId, now));
      }
    });

    unlinked.forEach(function (entry) {
      alerts.push(createStockAlert_("sem_vinculo", "media", "Consumo do RDO sem vinculo", entry.material.name + " foi consumido no RDO, mas ainda nao esta vinculado a um item mestre.", null, entry.dailyLog.workId || null, now));
    });

    topByQuantity.forEach(function (item) {
      if (item.totalQuantity >= highQuantityLimit && highQuantityLimit > 0) {
        alerts.push(createStockAlert_("alto_consumo", "media", "Alto consumo de " + item.name, "Foram consumidos " + formatQuantity_(item.totalQuantity) + " " + item.unit + " " + getStockPeriodLabel_(stockIaCurrentPeriod) + ".", item.stockItemId || null, item.workId || null, now));
      }
    });

    topByCost.forEach(function (item) {
      if (item.totalCost >= highCostLimit && highCostLimit > 0) {
        alerts.push(createStockAlert_("alto_custo", "media", "Custo consumido alto em " + item.name, "Custo consumido: " + formatCurrency_(item.totalCost) + " " + getStockPeriodLabel_(stockIaCurrentPeriod) + ".", item.stockItemId || null, item.workId || null, now));
      }
    });

    return alerts.sort(function (a, b) {
      return getStockAlertSeverityRank_(b.severity) - getStockAlertSeverityRank_(a.severity);
    });
  }

  function createStockAlert_(type, severity, title, message, stockItemId, workId, createdAt) {
    return {
      id: "stock_alert_" + type + "_" + normalizeCompositionKey_(title),
      type: type,
      severity: severity,
      title: title,
      message: message,
      materialName: title || null,
      stockItemId: stockItemId || null,
      workId: workId || null,
      createdAt: createdAt || new Date().toISOString()
    };
  }

  function getStockAlertSeverityRank_(severity) {
    if (severity === "critica") {
      return 4;
    }

    if (severity === "alta") {
      return 3;
    }

    if (severity === "media") {
      return 2;
    }

    return 1;
  }

  function buildStockConsumptionByWork_(movements) {
    const grouped = {};

    (movements || []).filter(function (movement) {
      return movement.type === "consumo_rdo" || movement.source === "rdo";
    }).forEach(function (movement) {
      const workId = movement.workId || "";
      const key = workId || "sem_obra";
      const name = getWorkName_(workId) || movement.workName || "Obra nao informada";

      if (!grouped[key]) {
        grouped[key] = {
          workId: workId || null,
          workName: name,
          materialKeys: [],
          materialTotals: {},
          totalCost: 0,
          dailyLogIds: []
        };
      }

      const item = grouped[key];
      const materialKey = normalizeStockMaterialKey_(movement.name || movement.itemName, movement.unit);
      item.totalCost += parseNumber_(movement.totalCost || movement.totalValue);

      if (item.materialKeys.indexOf(materialKey) < 0) {
        item.materialKeys.push(materialKey);
      }

      if (!item.materialTotals[materialKey]) {
        item.materialTotals[materialKey] = {
          name: movement.name || movement.itemName,
          quantity: 0,
          unit: movement.unit || "un",
          cost: 0
        };
      }

      item.materialTotals[materialKey].quantity += parseNumber_(movement.quantity);
      item.materialTotals[materialKey].cost += parseNumber_(movement.totalCost || movement.totalValue);

      if (movement.dailyLogId && item.dailyLogIds.indexOf(movement.dailyLogId) < 0) {
        item.dailyLogIds.push(movement.dailyLogId);
      }
    });

    return Object.keys(grouped).map(function (key) {
      const item = grouped[key];
      item.topMaterials = Object.keys(item.materialTotals).map(function (materialKey) {
        return item.materialTotals[materialKey];
      }).sort(function (a, b) {
        return parseNumber_(b.cost) - parseNumber_(a.cost);
      }).slice(0, 3);
      return item;
    }).sort(function (a, b) {
      return parseNumber_(b.totalCost) - parseNumber_(a.totalCost);
    });
  }

  function buildTopConsumedMaterials_(movements, options) {
    const settings = options || {};
    const sortBy = settings.sortBy || "cost";
    const limit = settings.limit || 10;
    const grouped = {};

    (movements || []).filter(function (movement) {
      return movement.type === "consumo_rdo" || movement.source === "rdo";
    }).forEach(function (movement) {
      const name = movement.name || movement.itemName || "Material";
      const unit = movement.unit || "un";
      const key = normalizeStockMaterialKey_(name, unit);

      if (!grouped[key]) {
        grouped[key] = {
          key: key,
          name: name,
          unit: unit,
          stockItemId: movement.stockItemId || null,
          totalQuantity: 0,
          totalCost: 0,
          dailyLogIds: [],
          lastDate: "",
          frequency: 0
        };
      }

      grouped[key].totalQuantity += parseNumber_(movement.quantity);
      grouped[key].totalCost += parseNumber_(movement.totalCost || movement.totalValue);
      grouped[key].frequency += 1;

      if (movement.dailyLogId && grouped[key].dailyLogIds.indexOf(movement.dailyLogId) < 0) {
        grouped[key].dailyLogIds.push(movement.dailyLogId);
      }

      if (!grouped[key].lastDate || String(movement.date || "").localeCompare(grouped[key].lastDate) > 0) {
        grouped[key].lastDate = movement.date || "";
      }
    });

    return Object.keys(grouped).map(function (key) {
      const item = grouped[key];
      item.totalQuantity = roundQuantity_(item.totalQuantity);
      return item;
    }).sort(function (a, b) {
      if (sortBy === "quantity") {
        return parseNumber_(b.totalQuantity) - parseNumber_(a.totalQuantity);
      }

      if (sortBy === "frequency") {
        return parseNumber_(b.frequency) - parseNumber_(a.frequency);
      }

      return parseNumber_(b.totalCost) - parseNumber_(a.totalCost);
    }).slice(0, limit);
  }

  function buildStockOperationalInsights_(summary, alerts, byWork, topMaterials, period) {
    const label = getStockPeriodLabel_(period);
    const criticalCount = (alerts || []).filter(function (alert) {
      return alert.severity === "critica";
    }).length;
    const highCount = (alerts || []).filter(function (alert) {
      return alert.severity === "alta";
    }).length;
    const topNames = (topMaterials || []).slice(0, 3).map(function (item) {
      return item.name;
    });
    const topWork = byWork && byWork.length ? byWork[0] : null;

    if (!summary.itemCount && !summary.unlinkedCount && !topNames.length) {
      return "Cadastre materiais ou registre materiais no RDO para iniciar a inteligencia operacional do Stock IA.";
    }

    return "No periodo " + label + ", " +
      (topNames.length ? "o maior consumo registrado foi de " + topNames.join(", ") + ". " : "ainda nao ha consumo suficiente para ranking. ") +
      "Existem " + criticalCount + " alerta(s) critico(s) e " + highCount + " alerta(s) alto(s). " +
      (topWork ? "A obra com maior custo consumido foi " + topWork.workName + " (" + formatCurrency_(topWork.totalCost) + "). " : "") +
      "Proximo passo recomendado: revisar itens negativos, zerados e abaixo do minimo antes de novas compras.";
  }

  function loadStockPurchaseReviewedState_() {
    try {
      const storage = getLocalStorage_();
      const raw = storage ? storage.getItem(STOCK_PURCHASE_REVIEWED_STORAGE_KEY) : "";
      const parsed = raw ? JSON.parse(raw) : [];

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Nao foi possivel carregar revisoes da lista de compras.", error);
      return [];
    }
  }

  function saveStockPurchaseReviewedState_(ids) {
    const storage = getLocalStorage_();
    const safeIds = Array.isArray(ids) ? ids.filter(Boolean) : [];

    if (storage) {
      storage.setItem(STOCK_PURCHASE_REVIEWED_STORAGE_KEY, JSON.stringify(safeIds));
    }

    return safeIds;
  }

  function getStockPurchasePriority_(balance) {
    const realBalance = parseNumber_(balance && balance.realBalance);
    const minimumStock = parseNumber_(balance && balance.item && balance.item.minimumStock);

    if (realBalance < 0) {
      return {
        priority: "critica",
        reason: "Saldo negativo apos consumos e saidas."
      };
    }

    if (realBalance === 0 && minimumStock > 0) {
      return {
        priority: "alta",
        reason: "Material zerado."
      };
    }

    if (realBalance > 0 && minimumStock > 0 && realBalance < minimumStock) {
      return {
        priority: "media",
        reason: "Material abaixo do estoque minimo."
      };
    }

    if (realBalance > 0 && minimumStock > 0 && realBalance <= minimumStock * 1.25) {
      return {
        priority: "baixa",
        reason: "Material proximo do limite minimo."
      };
    }

    return null;
  }

  function getStockPurchasePriorityRank_(priority) {
    if (priority === "critica") {
      return 4;
    }

    if (priority === "alta") {
      return 3;
    }

    if (priority === "media") {
      return 2;
    }

    return 1;
  }

  function getStockPurchasePriorityLabel_(priority) {
    if (priority === "critica") {
      return "Critica";
    }

    if (priority === "alta") {
      return "Alta";
    }

    if (priority === "media") {
      return "Media";
    }

    return "Baixa";
  }

  function buildStockPurchaseSuggestions_(balances, masterState, options) {
    const reviewedIds = loadStockPurchaseReviewedState_();
    const state = masterState || loadStockMasterState_();
    const settings = options || {};

    return (balances || []).map(function (balance) {
      const item = balance.item || {};
      const minimumStock = parseNumber_(item.minimumStock);
      const currentBalance = roundQuantity_(parseNumber_(balance.realBalance));
      const priorityInfo = getStockPurchasePriority_(balance);
      const unit = clean(item.unit) || "un";
      let suggestedQuantity = 0;

      if (!priorityInfo || minimumStock <= 0) {
        return null;
      }

      if (currentBalance < 0) {
        suggestedQuantity = minimumStock + Math.abs(currentBalance);
      } else if (currentBalance === 0) {
        suggestedQuantity = minimumStock;
      } else if (currentBalance < minimumStock) {
        suggestedQuantity = minimumStock - currentBalance;
      } else {
        suggestedQuantity = 0;
      }

      suggestedQuantity = roundQuantity_(Math.max(suggestedQuantity, 0));

      const unitCost = parseNumber_(item.unitCost);
      const estimatedTotal = suggestedQuantity * unitCost;
      const workName = item.workId ? getWorkName_(item.workId) : "Geral / sem obra";
      const suggestionId = "stock_purchase_" + item.id;

      return {
        id: suggestionId,
        stockItemId: item.id,
        materialName: item.name || "Material",
        unit: unit,
        currentBalance: currentBalance,
        minimumStock: minimumStock,
        suggestedQuantity: suggestedQuantity,
        unitCost: unitCost,
        estimatedTotal: estimatedTotal,
        priority: priorityInfo.priority,
        reason: priorityInfo.reason,
        workId: item.workId || null,
        workName: workName,
        reviewed: reviewedIds.indexOf(suggestionId) >= 0,
        statusLabel: suggestedQuantity > 0 ? "Comprar agora" : "Monitorar",
        sourceUpdatedAt: state.updatedAt || "",
        period: settings.period || stockIaCurrentPeriod
      };
    }).filter(Boolean).sort(function (a, b) {
      const priorityDiff = getStockPurchasePriorityRank_(b.priority) - getStockPurchasePriorityRank_(a.priority);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return parseNumber_(b.estimatedTotal) - parseNumber_(a.estimatedTotal);
    });
  }

  function buildStockPurchaseSummary_(suggestions) {
    const items = suggestions || [];
    const criticalItems = items.filter(function (item) {
      return item.priority === "critica";
    }).length;
    const highPriorityItems = items.filter(function (item) {
      return item.priority === "alta";
    }).length;
    const mediumPriorityItems = items.filter(function (item) {
      return item.priority === "media";
    }).length;
    const lowPriorityItems = items.filter(function (item) {
      return item.priority === "baixa";
    }).length;
    const estimatedTotal = items.reduce(function (sum, item) {
      return sum + parseNumber_(item.estimatedTotal);
    }, 0);
    const topPriorityNames = items.slice(0, 3).map(function (item) {
      return item.materialName;
    });
    const message = items.length
      ? "Existem " + items.length + " material(is) que precisam de reposicao. Valor estimado: " + formatCurrency_(estimatedTotal) + ". Itens mais urgentes: " + summarizeStockIaList_(topPriorityNames, 3) + "."
      : "Nao ha materiais criticos para compra neste momento. Continue acompanhando o consumo pelos diarios de obra.";

    return {
      totalItems: items.length,
      criticalItems: criticalItems,
      highPriorityItems: highPriorityItems,
      mediumPriorityItems: mediumPriorityItems,
      lowPriorityItems: lowPriorityItems,
      estimatedTotal: estimatedTotal,
      topPriorityNames: topPriorityNames,
      message: message
    };
  }

  function renderStockPurchasePanel_(suggestions, summary) {
    renderStockPurchaseSummaryCards_(summary);

    if (stockPurchasePanelNote) {
      stockPurchasePanelNote.textContent = summary && summary.totalItems
        ? summary.message
        : "Baseada no saldo real, estoque minimo e custo unitario.";
    }

    if (!stockPurchaseRows) {
      return;
    }

    stockPurchaseRows.innerHTML = "";

    if (!suggestions.length) {
      appendStockIaEmptyRow_(stockPurchaseRows, 12, "Nenhuma compra sugerida no momento.");
      return;
    }

    suggestions.forEach(function (suggestion) {
      const row = document.createElement("tr");
      appendStockIaCell_(row, getStockPurchasePriorityLabel_(suggestion.priority));
      appendStockIaCell_(row, suggestion.materialName);
      appendStockIaCell_(row, suggestion.unit || "un");
      appendStockIaCell_(row, formatQuantity_(suggestion.currentBalance));
      appendStockIaCell_(row, formatQuantity_(suggestion.minimumStock));
      appendStockIaCell_(row, suggestion.suggestedQuantity > 0 ? formatQuantity_(suggestion.suggestedQuantity) : "Monitorar");
      appendStockIaCell_(row, suggestion.unitCost > 0 ? formatCurrency_(suggestion.unitCost) : "Nao informado");
      appendStockIaCell_(row, suggestion.unitCost > 0 ? formatCurrency_(suggestion.estimatedTotal) : "Nao informado");
      appendStockIaCell_(row, suggestion.workName || "Geral / sem obra");
      appendStockIaCell_(row, suggestion.reason);
      appendStockIaCell_(row, suggestion.reviewed ? "Revisado" : suggestion.statusLabel);
      appendStockIaActions_(row, [
        [suggestion.reviewed ? "Revisado" : "Marcar revisado", "mark-purchase-reviewed", suggestion.id]
      ]);
      stockPurchaseRows.appendChild(row);
    });
  }

  function renderStockPurchaseSummaryCards_(summary) {
    if (!stockPurchaseSummaryCards) {
      return;
    }

    stockPurchaseSummaryCards.innerHTML = "";
    [
      ["Itens para comprar", summary.totalItems],
      ["Itens criticos", summary.criticalItems],
      ["Valor estimado", formatCurrency_(summary.estimatedTotal)],
      ["Prioridade maxima", summary.criticalItems ? "Critica" : (summary.highPriorityItems ? "Alta" : (summary.mediumPriorityItems ? "Media" : "Monitorar"))]
    ].forEach(function (item) {
      const card = document.createElement("article");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      card.className = "stock-ia-card";
      label.textContent = item[0];
      value.textContent = String(item[1]);
      card.appendChild(label);
      card.appendChild(value);
      stockPurchaseSummaryCards.appendChild(card);
    });
  }

  function buildStockPurchaseListText_(suggestions, summary) {
    const lines = [
      "LISTA DE COMPRAS - STOCK IA",
      "",
      summary.message,
      ""
    ];

    if (!suggestions.length) {
      lines.push("Nenhuma compra sugerida no momento.");
      return lines.join("\n");
    }

    suggestions.forEach(function (item, index) {
      lines.push(String(index + 1) + ". " + item.materialName);
      lines.push("   Prioridade: " + getStockPurchasePriorityLabel_(item.priority));
      lines.push("   Saldo atual: " + formatQuantity_(item.currentBalance) + " " + item.unit);
      lines.push("   Minimo: " + formatQuantity_(item.minimumStock) + " " + item.unit);
      lines.push("   Comprar: " + (item.suggestedQuantity > 0 ? formatQuantity_(item.suggestedQuantity) : "Monitorar") + " " + item.unit);
      lines.push("   Valor estimado: " + (item.unitCost > 0 ? formatCurrency_(item.estimatedTotal) : "Nao informado"));
      lines.push("   Obra: " + (item.workName || "Geral / sem obra"));
      lines.push("   Motivo: " + item.reason);
      lines.push("");
    });

    return lines.join("\n");
  }

  function getCurrentStockPurchaseSuggestions_() {
    const masterState = loadStockMasterState_();
    const balances = calculateRealStockBalances_();
    const suggestions = buildStockPurchaseSuggestions_(balances, masterState, {
      period: stockIaCurrentPeriod
    });

    return {
      suggestions: suggestions,
      summary: buildStockPurchaseSummary_(suggestions)
    };
  }

  function copyStockPurchaseList_() {
    const data = getCurrentStockPurchaseSuggestions_();
    const copied = copyTextFallback_(buildStockPurchaseListText_(data.suggestions, data.summary));

    showStockIaToast_(copied ? "Lista de compras copiada." : "Nao consegui copiar automaticamente.", copied ? "success" : "error");
  }

  function exportStockPurchaseCsv_() {
    const data = getCurrentStockPurchaseSuggestions_();
    const rows = [[
      "prioridade",
      "material",
      "unidade",
      "saldo_atual",
      "estoque_minimo",
      "quantidade_sugerida",
      "custo_unitario",
      "valor_estimado",
      "obra",
      "motivo"
    ]];

    data.suggestions.forEach(function (item) {
      rows.push([
        getStockPurchasePriorityLabel_(item.priority),
        item.materialName,
        item.unit,
        item.currentBalance,
        item.minimumStock,
        item.suggestedQuantity,
        item.unitCost,
        item.estimatedTotal,
        item.workName,
        item.reason
      ]);
    });

    const csv = rows.map(function (row) {
      return row.map(function (cell) {
        return '"' + String(cell === undefined || cell === null ? "" : cell).replace(/"/g, '""') + '"';
      }).join(",");
    }).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stock-ia-lista-compras.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showStockIaToast_("CSV da lista de compras gerado.", "success");
  }

  function buildStockPurchaseWhatsappMessage_() {
    const data = getCurrentStockPurchaseSuggestions_();
    const message = buildStockPurchaseListText_(data.suggestions, data.summary);
    const copied = copyTextFallback_(message);
    const url = "https://wa.me/?text=" + encodeURIComponent(message);
    const opened = window.open(url, "_blank", "noopener");

    if (!opened) {
      showStockIaToast_(copied ? "Mensagem copiada para WhatsApp." : "Copie a lista manualmente para enviar.", copied ? "success" : "error");
      return;
    }

    showStockIaToast_("Mensagem preparada para WhatsApp.", "success");
  }

  function markStockPurchaseItemReviewed_(suggestionId) {
    if (!suggestionId) {
      return;
    }

    const reviewed = loadStockPurchaseReviewedState_();
    if (reviewed.indexOf(suggestionId) < 0) {
      reviewed.push(suggestionId);
      saveStockPurchaseReviewedState_(reviewed);
    }

    renderStockIaPanel_(getUserDailyLogs_());
    showStockIaToast_("Item marcado como revisado.", "success");
  }

  function markAllStockPurchaseReviewed_() {
    const data = getCurrentStockPurchaseSuggestions_();
    const reviewed = loadStockPurchaseReviewedState_();

    data.suggestions.forEach(function (item) {
      if (reviewed.indexOf(item.id) < 0) {
        reviewed.push(item.id);
      }
    });

    saveStockPurchaseReviewedState_(reviewed);
    renderStockIaPanel_(getUserDailyLogs_());
    showStockIaToast_("Lista marcada como revisada.", "success");
  }

  function loadStockNotesState_() {
    try {
      const storage = getLocalStorage_();
      const raw = storage ? storage.getItem(STOCK_NOTES_STORAGE_KEY) : "";
      const parsed = raw ? JSON.parse(raw) : {};

      return {
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        updatedAt: parsed.updatedAt || new Date().toISOString()
      };
    } catch (error) {
      console.warn("Nao foi possivel carregar notas do Stock IA.", error);
      return {
        notes: [],
        updatedAt: new Date().toISOString()
      };
    }
  }

  function saveStockNotesState_(state) {
    const storage = getLocalStorage_();
    const safeState = {
      notes: Array.isArray(state.notes) ? state.notes : [],
      updatedAt: new Date().toISOString()
    };

    if (storage) {
      storage.setItem(STOCK_NOTES_STORAGE_KEY, JSON.stringify(safeState));
    }

    return safeState;
  }

  function createStockNoteDraft_(data) {
    const state = loadStockNotesState_();
    const now = new Date().toISOString();
    const note = {
      id: generateStockId_("stn"),
      supplier: clean(data.supplier),
      documentNumber: clean(data.documentNumber),
      date: clean(data.date) || toDateKey_(new Date()),
      workId: clean(data.workId) || null,
      fileName: clean(data.fileName),
      fileType: clean(data.fileType),
      filePreviewDataUrl: data.filePreviewDataUrl || null,
      status: "rascunho",
      items: [],
      createdAt: now,
      updatedAt: now
    };

    state.notes.push(note);
    saveStockNotesState_(state);
    return note;
  }

  function updateStockNoteDraft_(noteId, data) {
    const state = loadStockNotesState_();
    const note = findStockNoteInState_(state, noteId);

    if (!note || note.status !== "rascunho") {
      return null;
    }

    note.supplier = clean(data.supplier);
    note.documentNumber = clean(data.documentNumber);
    note.date = clean(data.date) || note.date || toDateKey_(new Date());
    note.workId = clean(data.workId) || null;

    if (data.fileName !== undefined) {
      note.fileName = clean(data.fileName);
      note.fileType = clean(data.fileType);
      note.filePreviewDataUrl = data.filePreviewDataUrl || null;
    }

    note.updatedAt = new Date().toISOString();
    saveStockNotesState_(state);
    return note;
  }

  function deleteStockNoteDraft_(noteId) {
    const state = loadStockNotesState_();
    state.notes = state.notes.filter(function (note) {
      return note.id !== noteId || note.status !== "rascunho";
    });
    saveStockNotesState_(state);
  }

  function addStockNoteItem_(noteId, itemData) {
    const state = loadStockNotesState_();
    const note = findStockNoteInState_(state, noteId);

    if (!note || note.status !== "rascunho") {
      return null;
    }

    const quantity = parseNumber_(itemData.quantity);
    const unitCost = parseNumber_(itemData.unitCost);
    const totalCost = parseNumber_(itemData.totalCost) || quantity * unitCost;
    const materialName = clean(itemData.materialName);
    const unit = clean(itemData.unit) || "un";
    let stockItemId = clean(itemData.stockItemId) || null;

    if (!stockItemId && itemData.createMaster === "on") {
      const newItem = createStockMasterItem_({
        name: materialName,
        unit: unit,
        category: clean(itemData.category) || "Geral",
        initialBalance: 0,
        minimumStock: 0,
        unitCost: unitCost,
        workId: note.workId || "",
        notes: "Criado a partir de item de nota."
      });
      stockItemId = newItem ? newItem.id : null;
    }

    if (!stockItemId) {
      const suggested = suggestStockItemForNoteItem_({
        materialName: materialName,
        unit: unit
      });
      stockItemId = suggested ? suggested.id : null;
    }

    if (!materialName || quantity <= 0) {
      return null;
    }

    note.items.push({
      id: generateStockId_("sni"),
      stockItemId: stockItemId,
      materialName: materialName,
      unit: unit,
      quantity: quantity,
      unitCost: unitCost,
      totalCost: totalCost,
      category: clean(itemData.category) || "Geral",
      notes: clean(itemData.notes),
      linked: Boolean(stockItemId)
    });
    note.updatedAt = new Date().toISOString();
    saveStockNotesState_(state);
    return note;
  }

  function updateStockNoteItem_(noteId, itemId, itemData) {
    const state = loadStockNotesState_();
    const note = findStockNoteInState_(state, noteId);
    const item = note && note.items ? note.items.find(function (candidate) {
      return candidate.id === itemId;
    }) : null;

    if (!note || note.status !== "rascunho" || !item) {
      return null;
    }

    item.materialName = clean(itemData.materialName) || item.materialName;
    item.unit = clean(itemData.unit) || item.unit || "un";
    item.quantity = parseNumber_(itemData.quantity);
    item.unitCost = parseNumber_(itemData.unitCost);
    item.totalCost = parseNumber_(itemData.totalCost) || item.quantity * item.unitCost;
    item.category = clean(itemData.category) || item.category || "Geral";
    item.notes = clean(itemData.notes);
    item.stockItemId = clean(itemData.stockItemId) || null;
    item.linked = Boolean(item.stockItemId);
    note.updatedAt = new Date().toISOString();
    saveStockNotesState_(state);
    return item;
  }

  function removeStockNoteItem_(noteId, itemId) {
    const state = loadStockNotesState_();
    const note = findStockNoteInState_(state, noteId);

    if (!note || note.status !== "rascunho") {
      return null;
    }

    note.items = (note.items || []).filter(function (item) {
      return item.id !== itemId;
    });
    note.updatedAt = new Date().toISOString();
    saveStockNotesState_(state);
    return note;
  }

  function confirmStockNoteEntry_(noteId) {
    const noteState = loadStockNotesState_();
    const note = findStockNoteInState_(noteState, noteId);

    if (!note) {
      return {
        ok: false,
        message: "Nota nao encontrada."
      };
    }

    if (note.status === "confirmada") {
      return {
        ok: false,
        message: "Esta nota ja foi confirmada. Nenhuma entrada foi duplicada."
      };
    }

    if (note.status !== "rascunho") {
      return {
        ok: false,
        message: "Apenas notas em rascunho podem virar entrada."
      };
    }

    if (!clean(note.supplier) || !clean(note.date) || !(note.items || []).length) {
      return {
        ok: false,
        message: "Preencha fornecedor, data e pelo menos um item antes de confirmar."
      };
    }

    const unlinked = (note.items || []).filter(function (item) {
      return !item.stockItemId;
    });
    const linkedItems = (note.items || []).filter(function (item) {
      return item.stockItemId;
    });

    if (!linkedItems.length) {
      return {
        ok: false,
        message: "Nenhum item esta vinculado ao cadastro mestre. Vincule ou crie item mestre antes de confirmar."
      };
    }

    linkedItems.forEach(function (item) {
      registerStockEntry_({
        stockItemId: item.stockItemId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        supplier: note.supplier,
        documentNumber: note.documentNumber,
        date: note.date,
        workId: note.workId || null,
        notes: "Entrada por nota" + (item.notes ? ": " + item.notes : ""),
        source: "nota",
        noteId: note.id
      });
    });

    note.status = "confirmada";
    note.updatedAt = new Date().toISOString();
    saveStockNotesState_(noteState);

    return {
      ok: true,
      message: "Nota confirmada. " + linkedItems.length + " entrada(s) adicionada(s) ao estoque." + (unlinked.length ? " " + unlinked.length + " item(ns) sem vinculo foram ignorados." : "")
    };
  }

  function cancelStockNote_(noteId) {
    const state = loadStockNotesState_();
    const note = findStockNoteInState_(state, noteId);

    if (!note || note.status === "confirmada") {
      return null;
    }

    note.status = "cancelada";
    note.updatedAt = new Date().toISOString();
    saveStockNotesState_(state);
    return note;
  }

  function renderStockNotePanel_() {
    renderStockNoteList_();
  }

  function renderStockNoteList_() {
    const state = loadStockNotesState_();
    const notes = state.notes.slice().sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
    const confirmed = notes.filter(function (note) {
      return note.status === "confirmada";
    });
    const totalConfirmed = confirmed.reduce(function (sum, note) {
      return sum + getStockNoteTotal_(note);
    }, 0);

    if (stockNoteSummary) {
      stockNoteSummary.textContent = notes.length
        ? notes.length + " nota(s) registrada(s). " + confirmed.length + " confirmada(s). Valor confirmado: " + formatCurrency_(totalConfirmed) + "."
        : "Nenhuma nota cadastrada.";
    }

    if (!stockNoteRows) {
      return;
    }

    stockNoteRows.innerHTML = "";
    if (!notes.length) {
      appendStockIaEmptyRow_(stockNoteRows, 9, "Nenhuma nota cadastrada.");
      return;
    }

    notes.forEach(function (note) {
      const row = document.createElement("tr");
      appendStockIaCell_(row, getStockNoteStatusLabel_(note.status));
      appendStockIaCell_(row, note.supplier || "-");
      appendStockIaCell_(row, note.documentNumber || "-");
      appendStockIaCell_(row, note.date ? formatDateOnly_(note.date) : "-");
      appendStockIaCell_(row, note.workId ? getWorkName_(note.workId) : "Geral / sem obra");
      appendStockIaCell_(row, String((note.items || []).length));
      appendStockIaCell_(row, formatCurrency_(getStockNoteTotal_(note)));
      appendStockIaCell_(row, note.fileName || "-");
      appendStockIaActions_(row, getStockNoteActions_(note));
      stockNoteRows.appendChild(row);
    });
  }

  function renderStockNoteItems_(note) {
    const wrapper = document.createElement("div");
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.className = "stock-ia-table compact";
    thead.innerHTML = "<tr><th>Material</th><th>Qtd.</th><th>Un.</th><th>Custo un.</th><th>Total</th><th>Vinculo</th><th>Acoes</th></tr>";
    table.appendChild(thead);

    if (!note || !(note.items || []).length) {
      appendStockIaEmptyRow_(tbody, 7, "Nenhum item lancado nesta nota.");
    } else {
      (note.items || []).forEach(function (item) {
        const row = document.createElement("tr");
        const linkedItem = getStockItemById_(item.stockItemId);
        appendStockIaCell_(row, item.materialName);
        appendStockIaCell_(row, formatQuantity_(item.quantity));
        appendStockIaCell_(row, item.unit || "un");
        appendStockIaCell_(row, formatCurrency_(item.unitCost));
        appendStockIaCell_(row, formatCurrency_(item.totalCost));
        appendStockIaCell_(row, linkedItem ? linkedItem.name : "Sem vinculo");
        appendStockIaActions_(row, note.status === "rascunho" ? [
          ["Remover", "remove-note-item", note.id + "|" + item.id]
        ] : []);
        tbody.appendChild(row);
      });
    }

    table.appendChild(tbody);
    wrapper.className = "stock-note-items full-width";
    wrapper.appendChild(table);
    return wrapper;
  }

  function renderStockNoteFilePreview_(note) {
    const wrapper = document.createElement("div");
    wrapper.className = "stock-note-preview full-width";

    if (!note || !note.fileName) {
      wrapper.textContent = "Nenhum arquivo anexado.";
      return wrapper;
    }

    if (note.filePreviewDataUrl && /^image\//.test(note.fileType || "")) {
      const image = document.createElement("img");
      image.src = note.filePreviewDataUrl;
      image.alt = "Preview da nota " + note.fileName;
      wrapper.appendChild(image);
      return wrapper;
    }

    wrapper.textContent = note.fileType === "application/pdf"
      ? "PDF anexado: " + note.fileName
      : "Arquivo registrado como referencia: " + note.fileName;
    return wrapper;
  }

  function handleStockNoteFileUpload_(file) {
    return new Promise(function (resolve) {
      if (!file) {
        resolve({
          fileName: "",
          fileType: "",
          filePreviewDataUrl: null,
          oversized: false
        });
        return;
      }

      const payload = {
        fileName: file.name || "",
        fileType: file.type || "",
        filePreviewDataUrl: null,
        oversized: file.size > STOCK_NOTE_FILE_PREVIEW_LIMIT
      };

      if (payload.oversized || !/^image\//.test(file.type || "")) {
        resolve(payload);
        return;
      }

      const reader = new FileReader();
      reader.onload = function () {
        payload.filePreviewDataUrl = reader.result || null;
        resolve(payload);
      };
      reader.onerror = function () {
        resolve(payload);
      };
      reader.readAsDataURL(file);
    });
  }

  function suggestStockItemForNoteItem_(item) {
    const key = normalizeStockMaterialKey_(item && item.materialName, item && item.unit);
    return loadStockMasterState_().items.find(function (candidate) {
      return candidate.normalizedKey === key;
    }) || null;
  }

  function linkStockNoteItemToMaster_(noteId, itemId, stockItemId) {
    const state = loadStockNotesState_();
    const note = findStockNoteInState_(state, noteId);
    const item = note && note.items ? note.items.find(function (candidate) {
      return candidate.id === itemId;
    }) : null;

    if (!note || note.status !== "rascunho" || !item) {
      return null;
    }

    item.stockItemId = stockItemId || null;
    item.linked = Boolean(stockItemId);
    note.updatedAt = new Date().toISOString();
    saveStockNotesState_(state);
    return item;
  }

  function findStockNoteInState_(state, noteId) {
    return (state.notes || []).find(function (note) {
      return note.id === noteId;
    }) || null;
  }

  function findStockNote_(noteId) {
    return findStockNoteInState_(loadStockNotesState_(), noteId);
  }

  function getStockItemById_(stockItemId) {
    return loadStockMasterState_().items.find(function (item) {
      return item.id === stockItemId;
    }) || null;
  }

  function getStockNoteTotal_(note) {
    return (note && note.items || []).reduce(function (sum, item) {
      return sum + parseNumber_(item.totalCost);
    }, 0);
  }

  function getStockNoteStatusLabel_(status) {
    if (status === "confirmada") {
      return "Confirmada";
    }

    if (status === "cancelada") {
      return "Cancelada";
    }

    return "Rascunho";
  }

  function getStockNoteActions_(note) {
    if (note.status === "confirmada") {
      return [
        ["Visualizar", "edit-note", note.id]
      ];
    }

    if (note.status === "cancelada") {
      return [
        ["Visualizar", "edit-note", note.id]
      ];
    }

    return [
      ["Editar", "edit-note", note.id],
      ["Adicionar item", "add-note-item", note.id],
      ["Confirmar", "confirm-note", note.id],
      ["Cancelar", "cancel-note", note.id],
      ["Excluir", "delete-note", note.id]
    ];
  }

  function buildStockNotesInsight_() {
    const notes = loadStockNotesState_().notes.filter(function (note) {
      return note.status === "confirmada";
    }).sort(function (a, b) {
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
    });

    if (!notes.length) {
      return "Ainda nao ha notas confirmadas. Use Nova nota para registrar fornecedor, anexar arquivo e lancar itens manualmente.";
    }

    const last = notes[0];
    const topItems = (last.items || []).slice(0, 3).map(function (item) {
      return item.materialName;
    });

    return "A ultima nota registrada foi de " + (last.supplier || "fornecedor nao informado") +
      ", com " + (last.items || []).length + " item(ns) e valor total de " + formatCurrency_(getStockNoteTotal_(last)) + ". " +
      (topItems.length ? "Principais materiais: " + topItems.join(", ") + "." : "");
  }

  function buildRealStockIaInsight_() {
    const summary = buildRealStockSummary_();

    if (!summary.itemCount && !summary.unlinkedCount) {
      return "Cadastre materiais ou registre materiais no RDO para iniciar o Stock IA. O saldo real sera calculado com saldo inicial, entradas, saidas manuais e consumo vindo do RDO.";
    }

    return "Seu estoque possui " + summary.itemCount + " item(ns) cadastrado(s). " +
      summary.lowStockCount + " estao abaixo do minimo e " + summary.negativeCount + " ficaram negativos. " +
      "Existem " + summary.unlinkedCount + " consumo(s) do RDO ainda nao vinculado(s). " +
      "Proximo passo recomendado: revisar itens negativos, vincular consumos pendentes e registrar entradas iniciais.";
  }

  function getRealStockStatus_(balance) {
    const realBalance = parseNumber_(balance.realBalance);
    const minimumStock = parseNumber_(balance.minimumStock);

    if (realBalance < 0) {
      return "Negativo";
    }

    if (realBalance === 0) {
      return "Zerado";
    }

    if (minimumStock > 0 && realBalance < minimumStock) {
      return "Baixo";
    }

    return "OK";
  }

  function renderStockIaPanel_(dailyLogs) {
    const rdoMovements = buildStockMovementsFromDailyLogs_(dailyLogs || getUserDailyLogs_());
    const rdoBalances = buildStockBalanceFromMovements_(rdoMovements);
    const summary = buildRealStockSummary_();
    const realMovements = buildRealStockMovements_();
    const unlinked = buildUnlinkedRdoMaterials_();
    const masterState = loadStockMasterState_();
    const realBalances = calculateRealStockBalances_();
    const periodRdoMovements = filterStockMovementsByPeriod_(rdoMovements, stockIaCurrentPeriod);
    const alerts = buildStockOperationalAlerts_(realBalances, periodRdoMovements, masterState);
    const byWork = buildStockConsumptionByWork_(periodRdoMovements);
    const topMaterials = buildTopConsumedMaterials_(periodRdoMovements, {
      sortBy: "cost",
      limit: 8
    });
    const purchaseSuggestions = buildStockPurchaseSuggestions_(realBalances, masterState, {
      period: stockIaCurrentPeriod
    });
    const purchaseSummary = buildStockPurchaseSummary_(purchaseSuggestions);

    renderStockIaSummaryCards_(summary);
    renderStockIaModeControls_();
    renderStockQuickExamplePanel_();
    renderStockPeriodControls_();
    renderStockOperationalAlerts_(alerts);
    renderStockPurchasePanel_(purchaseSuggestions, purchaseSummary);
    renderStockNotePanel_();
    renderTopConsumedMaterials_(topMaterials);
    renderStockConsumptionByWork_(byWork);
    renderStockIaQuestionAnswer_();
    renderStockMasterItems_();
    renderUnlinkedRdoMaterials_(unlinked);
    renderManualStockMovements_();
    renderStockIaRows_(rdoBalances);
    renderStockIaMovements_(rdoMovements);
    renderStockIaActionMessage_();

    if (stockIaInsight) {
      stockIaInsight.textContent = buildRealStockIaInsight_(realMovements);
    }

    if (stockIaOperationalInsight) {
      stockIaOperationalInsight.textContent = buildStockOperationalInsights_(summary, alerts, byWork, topMaterials, stockIaCurrentPeriod);
    }
  }

  function renderStockIaSummaryCards_(summary) {
    if (!stockIaSummaryCards) {
      return;
    }

    stockIaSummaryCards.innerHTML = "";
    [
      ["Itens cadastrados", summary.itemCount],
      ["Valor estimado em estoque", formatCurrency_(summary.estimatedStockValue)],
      ["Abaixo do minimo", summary.lowStockCount],
      ["Materiais críticos", summary.criticalCount],
      ["Consumo vindo do RDO", summary.rdoConsumptionCount],
      ["Entradas manuais", summary.manualEntriesCount]
    ].forEach(function (item) {
      const card = document.createElement("article");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      card.className = "stock-ia-card";
      label.textContent = item[0];
      value.textContent = String(item[1]);
      card.appendChild(label);
      card.appendChild(value);
      stockIaSummaryCards.appendChild(card);
    });
  }

  function renderStockPeriodControls_() {
    if (!stockIaPeriodControls) {
      return;
    }

    Array.from(stockIaPeriodControls.querySelectorAll("[data-stock-period]")).forEach(function (button) {
      button.classList.toggle("active", button.dataset.stockPeriod === stockIaCurrentPeriod);
    });
  }

  function renderStockIaModeControls_() {
    if (stockIaModeControls) {
      Array.from(stockIaModeControls.querySelectorAll("[data-stock-mode]")).forEach(function (button) {
        button.classList.toggle("active", button.dataset.stockMode === stockIaCurrentMode);
      });
    }

    if (stockIaModeDescription) {
      stockIaModeDescription.textContent = stockIaCurrentMode === "almoxarifado"
        ? "Modo Almoxarifado: controle itens entregues para pessoas, setores e finalidades, usando o mesmo saldo real do Stock IA."
        : "Modo Obra: controle materiais usados em obras, RDOs e serviços executados.";
    }
  }

  function renderStockOperationalAlerts_(alerts) {
    if (!stockIaAlertsList) {
      return;
    }

    stockIaAlertsList.innerHTML = "";
    if (!alerts.length) {
      const empty = document.createElement("p");
      empty.className = "auth-note";
      empty.textContent = "Nenhum alerta operacional encontrado no periodo selecionado.";
      stockIaAlertsList.appendChild(empty);
      return;
    }

    alerts.slice(0, 10).forEach(function (alert) {
      const card = document.createElement("article");
      const title = document.createElement("strong");
      const badge = document.createElement("span");
      const message = document.createElement("p");
      card.className = "stock-ia-alert severity-" + alert.severity;
      title.textContent = alert.title;
      badge.className = "stock-ia-alert-badge";
      badge.textContent = alert.severity;
      message.textContent = alert.message;
      card.appendChild(badge);
      card.appendChild(title);
      card.appendChild(message);
      stockIaAlertsList.appendChild(card);
    });
  }

  function renderTopConsumedMaterials_(items) {
    if (!stockTopMaterialsRows) {
      return;
    }

    stockTopMaterialsRows.innerHTML = "";
    if (!items.length) {
      appendStockIaEmptyRow_(stockTopMaterialsRows, 7, "Nenhum consumo encontrado no periodo.");
      return;
    }

    items.forEach(function (item, index) {
      const row = document.createElement("tr");
      appendStockIaCell_(row, String(index + 1));
      appendStockIaCell_(row, item.name);
      appendStockIaCell_(row, item.unit);
      appendStockIaCell_(row, formatQuantity_(item.totalQuantity));
      appendStockIaCell_(row, formatCurrency_(item.totalCost));
      appendStockIaCell_(row, String(item.dailyLogIds.length));
      appendStockIaCell_(row, item.lastDate ? formatDateOnly_(item.lastDate) : "-");
      stockTopMaterialsRows.appendChild(row);
    });
  }

  function renderStockConsumptionByWork_(items) {
    if (!stockConsumptionByWorkRows) {
      return;
    }

    stockConsumptionByWorkRows.innerHTML = "";
    if (!items.length) {
      appendStockIaEmptyRow_(stockConsumptionByWorkRows, 5, "Nenhum consumo por obra encontrado no periodo.");
      return;
    }

    items.forEach(function (item) {
      const row = document.createElement("tr");
      appendStockIaCell_(row, item.workName || "Obra nao informada");
      appendStockIaCell_(row, String(item.materialKeys.length));
      appendStockIaCell_(row, formatCurrency_(item.totalCost));
      appendStockIaCell_(row, summarizeStockIaList_(item.topMaterials.map(function (material) {
        return material.name;
      }), 3));
      appendStockIaCell_(row, String(item.dailyLogIds.length));
      stockConsumptionByWorkRows.appendChild(row);
    });
  }

  function handleStockIaQuestion_(question) {
    const cleanQuestion = clean(question);
    if (!cleanQuestion) {
      return;
    }

    stockIaLastAnswer = answerStockIaQuestion_(cleanQuestion);
    if (stockIaQuestionInput) {
      stockIaQuestionInput.value = "";
    }
    renderStockIaQuestionAnswer_();
  }

  function renderStockIaQuestionAnswer_() {
    if (!stockIaQuestionAnswer) {
      return;
    }

    stockIaQuestionAnswer.textContent = stockIaLastAnswer || "Faça uma pergunta para receber uma orientação local do estoque.";
  }

  function answerStockIaQuestion_(question) {
    const normalized = normalizeCompositionKey_(question);
    const balances = calculateRealStockBalances_();
    const summary = buildRealStockSummary_();
    const rdoMovements = filterStockMovementsByPeriod_(buildStockMovementsFromDailyLogs_(getUserDailyLogs_()), stockIaCurrentPeriod);
    const alerts = buildStockOperationalAlerts_(balances, rdoMovements, loadStockMasterState_());
    const topMaterials = buildTopConsumedMaterials_(rdoMovements, {
      sortBy: "cost",
      limit: 5
    });
    const byWork = buildStockConsumptionByWork_(rdoMovements);
    const lowItems = balances.filter(function (balance) {
      return balance.status === "Baixo";
    });
    const zeroItems = balances.filter(function (balance) {
      return balance.status === "Zerado";
    });
    const negativeItems = balances.filter(function (balance) {
      return balance.status === "Negativo";
    });
    const purchaseSuggestions = buildStockPurchaseSuggestions_(balances, loadStockMasterState_(), {
      period: stockIaCurrentPeriod
    });
    const purchaseSummary = buildStockPurchaseSummary_(purchaseSuggestions);

    if (isStockAiCompositionRequest_(question)) {
      const compositionAnswer = buildStockAiCompositionAnswerFromMessage(question);
      if (compositionAnswer) {
        return compositionAnswer;
      }
    }

    if (normalized.indexOf("nota") >= 0 || normalized.indexOf("notas") >= 0 || normalized.indexOf("ultima entrada") >= 0 || normalized.indexOf("o que entrou") >= 0 || normalized.indexOf("quanto entrou") >= 0) {
      return buildStockNotesInsight_();
    }

    if (normalized.indexOf("valor") >= 0 && (normalized.indexOf("reposicao") >= 0 || normalized.indexOf("compra") >= 0)) {
      return purchaseSuggestions.length
        ? "O valor estimado da reposição é " + formatCurrency_(purchaseSummary.estimatedTotal) + " para " + purchaseSummary.totalItems + " item(ns). Itens urgentes: " + summarizeStockIaList_(purchaseSummary.topPriorityNames, 3) + "."
        : purchaseSummary.message;
    }

    if ((normalized.indexOf("lista") >= 0 && normalized.indexOf("compra") >= 0) || normalized.indexOf("preciso comprar") >= 0 || normalized.indexOf("materiais comprar") >= 0 || normalized.indexOf("em falta") >= 0 || normalized.indexOf("reposicao") >= 0 || normalized.indexOf("repor") >= 0) {
      return purchaseSuggestions.length
        ? "Reposição sugerida: " + purchaseSummary.message + " Comprar primeiro: " + summarizeStockIaList_(purchaseSummary.topPriorityNames, 3) + "."
        : purchaseSummary.message;
    }

    if (normalized.indexOf("critico") >= 0 || normalized.indexOf("critica") >= 0) {
      const critical = purchaseSuggestions.filter(function (item) {
        return item.priority === "critica";
      });
      return critical.length
        ? "Prioridade crítica: " + summarizeStockIaList_(critical.map(function (item) { return item.materialName; }), 6) + ". Esses itens estão negativos e devem ser resolvidos primeiro."
        : "Não encontrei itens críticos na lista de compras neste momento.";
    }

    if (normalized.indexOf("acabando") >= 0 || normalized.indexOf("baixo") >= 0 || normalized.indexOf("comprar") >= 0) {
      return purchaseSuggestions.length
        ? "Itens que precisam de atenção para compra: " + summarizeStockIaList_(purchaseSuggestions.map(function (item) { return item.materialName + " (" + getStockPurchasePriorityLabel_(item.priority) + ")"; }), 6) + ". Valor estimado: " + formatCurrency_(purchaseSummary.estimatedTotal) + "."
        : "Não encontrei itens abaixo do mínimo, zerados ou negativos. Próximo passo: revisar consumos sem vínculo e manter entradas atualizadas.";
    }

    if (normalized.indexOf("zerado") >= 0) {
      return zeroItems.length
        ? "Itens zerados: " + summarizeStockIaList_(zeroItems.map(function (balance) { return balance.item.name; }), 6) + "."
        : "Nenhum item zerado encontrado no estoque real.";
    }

    if (normalized.indexOf("negativo") >= 0) {
      return negativeItems.length
        ? "Itens negativos: " + summarizeStockIaList_(negativeItems.map(function (balance) { return balance.item.name; }), 6) + ". Revise saldo inicial, entradas e consumos do RDO."
        : "Nenhum item negativo encontrado no estoque real.";
    }

    if (normalized.indexOf("material") >= 0 && (normalized.indexOf("mais") >= 0 || normalized.indexOf("consumiu") >= 0)) {
      return topMaterials.length
        ? "Material com maior consumo por custo " + getStockPeriodLabel_(stockIaCurrentPeriod) + ": " + topMaterials[0].name + " (" + formatCurrency_(topMaterials[0].totalCost) + ", " + formatQuantity_(topMaterials[0].totalQuantity) + " " + topMaterials[0].unit + ")."
        : "Ainda não há consumo suficiente no período para apontar o material mais consumido.";
    }

    if (normalized.indexOf("obra") >= 0 && (normalized.indexOf("mais") >= 0 || normalized.indexOf("consumiu") >= 0)) {
      return byWork.length
        ? "Obra com maior custo consumido " + getStockPeriodLabel_(stockIaCurrentPeriod) + ": " + byWork[0].workName + " (" + formatCurrency_(byWork[0].totalCost) + ")."
        : "Ainda não há consumo por obra suficiente no período selecionado.";
    }

    if (normalized.indexOf("proximo") >= 0 || normalized.indexOf("passo") >= 0 || normalized.indexOf("resumo") >= 0) {
      return buildStockOperationalInsights_(summary, alerts, byWork, topMaterials, stockIaCurrentPeriod);
    }

    return "Posso responder sobre itens acabando, zerados, negativos, material mais consumido, obra que mais consumiu, compras e próximo passo do estoque.";
  }

  function renderStockMasterItems_() {
    if (!stockMasterRows) {
      return;
    }

    const balances = calculateRealStockBalances_();
    stockMasterRows.innerHTML = "";

    if (!balances.length) {
      appendStockIaEmptyActionRow_(stockMasterRows, 11, "Você ainda não tem materiais cadastrados.", "Começar agora", "start-guided-stock");
      return;
    }

    balances.forEach(function (balance) {
      const item = balance.item;
      const row = document.createElement("tr");
      appendStockIaCell_(row, item.name);
      appendStockIaCell_(row, item.unit);
      appendStockIaCell_(row, item.category || "Geral");
      appendStockIaCell_(row, formatQuantity_(item.initialBalance));
      appendStockIaCell_(row, formatQuantity_(balance.entries));
      appendStockIaCell_(row, formatQuantity_(balance.rdoConsumption));
      appendStockIaCell_(row, formatQuantity_(balance.manualExits));
      appendStockIaCell_(row, formatQuantity_(balance.realBalance));
      appendStockIaCell_(row, formatQuantity_(item.minimumStock));
      appendStockIaCell_(row, balance.status);
      appendStockIaActions_(row, [
        ["Editar", "edit-item", item.id],
        ["Excluir", "delete-item", item.id],
        ["Entrada", "entry", item.id],
        ["Saida", "exit", item.id]
      ]);
      stockMasterRows.appendChild(row);
    });
  }

  function renderManualStockMovements_() {
    if (!stockManualMovementsRows) {
      return;
    }

    const state = loadStockMasterState_();
    stockManualMovementsRows.innerHTML = "";

    const visibleMovements = state.manualMovements.filter(function (movement) {
      return movement.mode !== "almoxarifado";
    });

    if (!visibleMovements.length) {
      appendStockIaEmptyActionRow_(stockManualMovementsRows, 8, "Registre uma entrada para formar saldo.", "Registrar entrada", "first-entry");
      return;
    }

    visibleMovements.slice().sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    }).forEach(function (movement) {
      const item = state.items.find(function (candidate) {
        return candidate.id === movement.stockItemId;
      });
      const row = document.createElement("tr");
      appendStockIaCell_(row, movement.date ? formatDateOnly_(movement.date) : "-");
      appendStockIaCell_(row, item ? item.name : "Item removido");
      appendStockIaCell_(row, movement.type);
      appendStockIaCell_(row, formatQuantity_(movement.quantity));
      appendStockIaCell_(row, formatCurrency_(movement.totalCost));
      appendStockIaCell_(row, movement.supplier || "-");
      appendStockIaCell_(row, movement.documentNumber || "-");
      appendStockIaCell_(row, formatStockMovementNotes_(movement));
      stockManualMovementsRows.appendChild(row);
    });
  }

  function formatStockMovementNotes_(movement) {
    const parts = [];

    if (movement.recipientName) {
      parts.push("Destinatário: " + movement.recipientName);
    }

    if (movement.sector) {
      parts.push("Setor: " + movement.sector);
    }

    if (movement.purpose) {
      parts.push("Finalidade: " + movement.purpose);
    }

    if (movement.notes) {
      parts.push(movement.notes);
    }

    return parts.length ? parts.join(" | ") : "-";
  }

  function renderUnlinkedRdoMaterials_(items) {
    if (!stockUnlinkedRows) {
      return;
    }

    stockUnlinkedRows.innerHTML = "";

    if (!items.length) {
      appendStockIaEmptyRow_(stockUnlinkedRows, 8, "Nenhum consumo do RDO pendente de vinculo.");
      return;
    }

    items.forEach(function (entry) {
      const material = entry.material;
      const row = document.createElement("tr");
      appendStockIaCell_(row, entry.date ? formatDateOnly_(entry.date) : "-");
      appendStockIaCell_(row, material.name);
      appendStockIaCell_(row, material.unit || "un");
      appendStockIaCell_(row, formatQuantity_(material.quantity));
      appendStockIaCell_(row, formatCurrency_(material.totalValue || 0));
      appendStockIaCell_(row, entry.workName);
      appendStockIaCell_(row, entry.dailyLog.id || "-");
      appendStockIaActions_(row, [
        ["Criar item", "create-from-rdo", entry.rdoMaterialKey],
        ["Vincular", "link-rdo", entry.rdoMaterialKey]
      ]);
      stockUnlinkedRows.appendChild(row);
    });
  }

  function renderStockIaRows_(balances) {
    if (!stockIaRows) {
      return;
    }

    stockIaRows.innerHTML = "";
    if (!balances.length) {
      appendStockIaEmptyRow_(stockIaRows, 7, "Comece registrando materiais no RDO para acompanhar o consumo por obra.");
      return;
    }

    balances.forEach(function (balance) {
      const row = document.createElement("tr");
      appendStockIaCell_(row, balance.name);
      appendStockIaCell_(row, balance.unit);
      appendStockIaCell_(row, formatQuantity_(balance.totalQuantity));
      appendStockIaCell_(row, formatCurrency_(balance.totalCost));
      appendStockIaCell_(row, String((balance.dailyLogIds || []).length));
      appendStockIaCell_(row, summarizeStockIaList_(balance.workNames || [], 3));
      appendStockIaCell_(row, balance.lastDate ? formatDateOnly_(balance.lastDate) : "-");
      stockIaRows.appendChild(row);
    });
  }

  function renderStockIaMovements_(movements) {
    if (!stockIaMovements) {
      return;
    }

    stockIaMovements.innerHTML = "";
    if (!movements.length) {
      appendStockIaEmptyActionRow_(stockIaMovements, 8, "As entradas, saídas e consumos aparecerão aqui.", "Registrar movimentação", "first-movement");
      return;
    }

    movements.slice(0, 100).forEach(function (movement) {
      const row = document.createElement("tr");
      appendStockIaCell_(row, movement.date ? formatDateOnly_(movement.date) : "-");
      appendStockIaCell_(row, movement.name);
      appendStockIaCell_(row, formatQuantity_(movement.quantity));
      appendStockIaCell_(row, movement.unit);
      appendStockIaCell_(row, formatCurrency_(movement.totalValue));
      appendStockIaCell_(row, "RDO");
      appendStockIaCell_(row, movement.dailyLogId || "-");
      appendStockIaCell_(row, movement.workName || "-");
      stockIaMovements.appendChild(row);
    });
  }

  function appendStockIaActions_(row, actions) {
    const cell = document.createElement("td");
    const wrapper = document.createElement("div");
    wrapper.className = "stock-ia-actions";
    actions.forEach(function (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mini-button compact";
      button.dataset.stockAction = action[1];
      button.dataset.stockId = action[2];
      button.textContent = action[0];
      wrapper.appendChild(button);
    });
    cell.appendChild(wrapper);
    row.appendChild(cell);
  }

  function handleStockIaAction_(button) {
    const action = button.dataset.stockAction;
    const stockId = button.dataset.stockId || "";

    if (action === "new-item") {
      openStockIaModal_("item", {});
    } else if (action === "start-guided-stock") {
      openStockIaModal_("guided-stock", {});
    } else if (action === "view-stock-obras") {
      if (stockIaSummaryCards) {
        stockIaSummaryCards.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else if (action === "quick-use-guided") {
      openStockIaModal_("guided-stock", getGuidedStockExamplePayload_());
    } else if (action === "generate-stock-summary") {
      generateStockPlainSummary_();
    } else if (action === "first-entry" || action === "first-movement") {
      handleStockFirstEntry_();
    } else if (action === "quick-create-material") {
      handleStockQuickCreateMaterial_();
    } else if (action === "quick-register-entry") {
      handleStockQuickRegisterEntry_();
    } else if (action === "quick-link-rdo") {
      handleStockQuickLinkRdo_();
    } else if (action === "quick-dismiss") {
      clearStockQuickExample_();
      renderStockQuickExamplePanel_();
      showStockIaToast_("Exemplo da demonstração descartado.", "success");
    } else if (action === "edit-item") {
      openStockIaModal_("item", {
        itemId: stockId
      });
    } else if (action === "delete-item") {
      openStockIaModal_("delete-item", {
        itemId: stockId
      });
    } else if (action === "entry") {
      openStockIaModal_("movement", {
        itemId: stockId,
        movementType: "entrada"
      });
    } else if (action === "exit") {
      openStockIaModal_("movement", {
        itemId: stockId,
        movementType: "saida"
      });
    } else if (action === "create-from-rdo") {
      openStockIaModal_("create-from-rdo", {
        rdoMaterialKey: stockId
      });
    } else if (action === "link-rdo") {
      openStockIaModal_("link-rdo", {
        rdoMaterialKey: stockId
      });
    } else if (action === "generate-purchase-list") {
      renderStockIaPanel_(getUserDailyLogs_());
      showStockIaToast_("Lista de compras recalculada.", "success");
    } else if (action === "copy-purchase-list") {
      copyStockPurchaseList_();
    } else if (action === "export-purchase-csv") {
      exportStockPurchaseCsv_();
    } else if (action === "whatsapp-purchase-list") {
      buildStockPurchaseWhatsappMessage_();
    } else if (action === "mark-purchase-reviewed") {
      markStockPurchaseItemReviewed_(stockId);
    } else if (action === "mark-all-purchase-reviewed") {
      markAllStockPurchaseReviewed_();
    } else if (action === "new-note") {
      openStockIaModal_("note", {});
    } else if (action === "edit-note") {
      openStockIaModal_("note", {
        noteId: stockId
      });
    } else if (action === "add-note-item") {
      openStockIaModal_("note-item", {
        noteId: stockId
      });
    } else if (action === "confirm-note") {
      openStockIaModal_("confirm-note", {
        noteId: stockId
      });
    } else if (action === "cancel-note") {
      openStockIaModal_("cancel-note", {
        noteId: stockId
      });
    } else if (action === "delete-note") {
      openStockIaModal_("delete-note", {
        noteId: stockId
      });
    } else if (action === "remove-note-item") {
      const parts = stockId.split("|");
      removeStockNoteItem_(parts[0], parts[1]);
      renderStockIaPanel_(getUserDailyLogs_());
      showStockIaToast_("Item removido da nota.", "success");
    }
  }

  function openStockIaModal_(type, payload) {
    if (!stockIaModal) {
      return;
    }

    stockIaModal.dataset.stockModalType = type;
    stockIaModal.dataset.stockPayload = JSON.stringify(payload || {});
    renderStockIaModal_(type, payload || {});
    stockIaModal.classList.remove("is-hidden");

    const firstField = stockIaModal.querySelector("input, select, textarea, button");
    if (firstField) {
      firstField.focus();
    }
  }

  function closeStockIaModal_() {
    if (!stockIaModal) {
      return;
    }

    stockIaModal.classList.add("is-hidden");
    stockIaModal.innerHTML = "";
    stockIaModal.dataset.stockModalType = "";
    stockIaModal.dataset.stockPayload = "";
  }

  function renderStockIaModal_(type, payload) {
    const state = loadStockMasterState_();
    const item = payload.itemId ? state.items.find(function (candidate) {
      return candidate.id === payload.itemId;
    }) : null;
    const rdoEntry = payload.rdoMaterialKey ? findUnlinkedRdoEntryByKey_(payload.rdoMaterialKey) : null;
    const note = payload.noteId ? findStockNote_(payload.noteId) : null;
    const title = getStockIaModalTitle_(type, item, payload);
    const content = document.createElement("div");
    const card = document.createElement("div");
    const header = document.createElement("div");
    const heading = document.createElement("h3");
    const closeButton = document.createElement("button");
    const form = document.createElement("form");

    stockIaModal.innerHTML = "";
    content.className = "stock-ia-modal-backdrop";
    card.className = "stock-ia-modal-card";
    header.className = "stock-ia-modal-header";
    heading.id = "stockIaModalTitle";
    heading.textContent = title;
    closeButton.type = "button";
    closeButton.className = "mini-button compact";
    closeButton.dataset.stockModalClose = "true";
    closeButton.textContent = "Fechar";
    form.className = "stock-ia-form";
    form.dataset.stockFormType = type;

    header.appendChild(heading);
    header.appendChild(closeButton);
    card.appendChild(header);

    if (type === "item") {
      appendStockItemFields_(form, item);
    } else if (type === "guided-stock") {
      appendStockGuidedFields_(form, payload);
    } else if (type === "warehouse-guided") {
      appendWarehouseGuidedFields_(form);
    } else if (type === "movement") {
      appendStockMovementFields_(form, state, item, payload.movementType);
    } else if (type === "delete-item") {
      appendStockIaNotice_(form, "Confirma excluir este item e suas movimentacoes locais?");
    } else if (type === "create-from-rdo") {
      appendStockItemFields_(form, null, rdoEntry);
    } else if (type === "link-rdo") {
      appendStockLinkFields_(form, state, rdoEntry);
    } else if (type === "note") {
      appendStockNoteFields_(form, note);
      if (note) {
        form.appendChild(renderStockNoteFilePreview_(note));
        form.appendChild(renderStockNoteItems_(note));
      }
    } else if (type === "note-item") {
      appendStockNoteItemFields_(form, state, note);
    } else if (type === "confirm-note") {
      appendStockIaNotice_(form, "Confirmar esta nota vai gerar entradas no estoque para os itens vinculados. Esta acao nao duplica se a nota ja estiver confirmada.");
      if (note) {
        form.appendChild(renderStockNoteItems_(note));
      }
    } else if (type === "cancel-note") {
      appendStockIaNotice_(form, "Confirma cancelar esta nota? Notas canceladas ficam apenas para consulta.");
    } else if (type === "delete-note") {
      appendStockIaNotice_(form, "Confirma excluir este rascunho de nota? Notas confirmadas nao sao excluidas nesta fase.");
    }

    appendHiddenField_(form, "itemId", payload.itemId || "");
    appendHiddenField_(form, "rdoMaterialKey", payload.rdoMaterialKey || "");
    appendHiddenField_(form, "movementType", payload.movementType || "");
    appendHiddenField_(form, "noteId", payload.noteId || "");
    appendStockIaFormActions_(form, type === "delete-item" || type === "delete-note" ? "Excluir" : (type === "confirm-note" ? "Confirmar entrada" : (type === "cancel-note" ? "Cancelar nota" : (type === "guided-stock" || type === "warehouse-guided" ? "Concluir assistente" : "Salvar"))));
    card.appendChild(form);
    content.appendChild(card);
    stockIaModal.appendChild(content);
  }

  function getStockIaModalTitle_(type, item, payload) {
    if (type === "item") {
      return item ? "Editar material" : "Novo material";
    }

    if (type === "guided-stock") {
      return "Começar agora";
    }

    if (type === "warehouse-guided") {
      return "Começar Almoxarifado";
    }

    if (type === "movement") {
      return payload.movementType === "saida" ? "Registrar saida" : "Registrar entrada";
    }

    if (type === "delete-item") {
      return "Excluir material";
    }

    if (type === "create-from-rdo") {
      return "Criar item a partir do RDO";
    }

    if (type === "link-rdo") {
      return "Vincular consumo do RDO";
    }

    if (type === "note") {
      return payload.noteId ? "Editar nota" : "Nova nota";
    }

    if (type === "note-item") {
      return "Adicionar item da nota";
    }

    if (type === "confirm-note") {
      return "Confirmar entrada por nota";
    }

    if (type === "cancel-note") {
      return "Cancelar nota";
    }

    if (type === "delete-note") {
      return "Excluir rascunho de nota";
    }

    return "Stock IA";
  }

  function appendStockItemFields_(form, item, rdoEntry) {
    const material = rdoEntry ? rdoEntry.material : null;
    appendStockIaField_(form, "name", "Nome", "text", item ? item.name : (material ? material.name : ""), true);
    appendStockIaField_(form, "unit", "Unidade", "text", item ? item.unit : (material ? material.unit || "un" : "un"), true);
    appendStockIaField_(form, "category", "Categoria", "text", item ? item.category : "Geral", false);
    appendStockIaField_(form, "initialBalance", "Saldo inicial", "number", item ? item.initialBalance : 0, false, "0.001");
    appendStockIaField_(form, "minimumStock", "Estoque minimo", "number", item ? item.minimumStock : 0, false, "0.001");
    appendStockIaField_(form, "unitCost", "Custo unitario", "number", item ? item.unitCost : (material ? material.unitValue || 0 : 0), false, "0.01");
    appendStockWorkSelect_(form, item ? item.workId : (rdoEntry && rdoEntry.dailyLog ? rdoEntry.dailyLog.workId : ""));
    appendStockIaTextarea_(form, "notes", "Observacoes", item ? item.notes : (rdoEntry ? "Criado a partir de consumo do RDO." : ""));
  }

  function appendStockMovementFields_(form, state, selectedItem, type) {
    appendStockItemSelect_(form, state.items, selectedItem ? selectedItem.id : "");
    appendStockIaField_(form, "quantity", "Quantidade", "number", 0, true, "0.001");
    if (type !== "saida") {
      appendStockIaField_(form, "unitCost", "Custo unitario", "number", selectedItem ? selectedItem.unitCost || 0 : 0, false, "0.01");
      appendStockIaField_(form, "supplier", "Fornecedor", "text", "", false);
      appendStockIaField_(form, "documentNumber", "Numero do documento", "text", "", false);
    }
    appendStockIaField_(form, "date", "Data", "date", toDateKey_(new Date()), true);
    if (stockIaCurrentMode === "almoxarifado" && type === "saida") {
      appendStockIaField_(form, "recipientName", "Destinatário", "text", "", false);
      appendStockIaField_(form, "sector", "Setor/obra/unidade", "text", "", false);
      appendStockIaField_(form, "purpose", "Finalidade", "text", "", false);
    }
    appendHiddenField_(form, "mode", stockIaCurrentMode);
    appendStockIaTextarea_(form, "notes", "Observacao", "");
  }

  function appendStockLinkFields_(form, state, rdoEntry) {
    if (rdoEntry) {
      appendStockIaNotice_(form, "Material do RDO: " + rdoEntry.material.name + " | " + formatQuantity_(rdoEntry.material.quantity) + " " + (rdoEntry.material.unit || "un"));
    }
    appendStockItemSelect_(form, state.items, "");
  }

  function appendStockNoteFields_(form, note) {
    const locked = note && note.status !== "rascunho";
    appendStockIaField_(form, "supplier", "Fornecedor", "text", note ? note.supplier : "", true);
    appendStockIaField_(form, "documentNumber", "Numero da nota", "text", note ? note.documentNumber : "", false);
    appendStockIaField_(form, "date", "Data", "date", note ? note.date : toDateKey_(new Date()), true);
    appendStockWorkSelect_(form, note ? note.workId : "");
    appendStockIaFileField_(form, "noteFile", "Foto ou PDF da nota", locked);

    if (locked) {
      appendStockIaNotice_(form, "Nota " + getStockNoteStatusLabel_(note.status) + ". A edicao fica bloqueada nesta fase.");
      Array.from(form.querySelectorAll("input, select, textarea")).forEach(function (field) {
        if (field.type !== "hidden") {
          field.disabled = true;
        }
      });
    } else if (note && note.fileName) {
      appendStockIaNotice_(form, "Arquivo atual: " + note.fileName + ". Envie outro arquivo apenas se quiser substituir a referencia.");
    }
  }

  function appendStockNoteItemFields_(form, state, note) {
    if (!note || note.status !== "rascunho") {
      appendStockIaNotice_(form, "Abra uma nota em rascunho para adicionar itens.");
      return;
    }

    appendStockIaField_(form, "materialName", "Material", "text", "", true);
    appendStockIaField_(form, "unit", "Unidade", "text", "un", true);
    appendStockIaField_(form, "quantity", "Quantidade", "number", 1, true, "0.001");
    appendStockIaField_(form, "unitCost", "Custo unitario", "number", 0, false, "0.01");
    appendStockIaField_(form, "totalCost", "Custo total", "number", 0, false, "0.01");
    appendStockIaField_(form, "category", "Categoria", "text", "Geral", false);
    appendStockItemSelect_(form, state.items, "", false);
    appendStockIaCheckbox_(form, "createMaster", "Criar item mestre se nao houver vinculo");
    appendStockIaTextarea_(form, "notes", "Observacao", "");
  }

  function appendStockIaField_(form, name, label, type, value, required, step) {
    const wrapper = document.createElement("label");
    const input = document.createElement("input");
    wrapper.textContent = label;
    input.name = name;
    input.type = type;
    input.value = value === undefined || value === null ? "" : String(value);
    input.required = Boolean(required);
    if (step) {
      input.step = step;
    }
    if (type === "number") {
      input.min = "0";
    }
    wrapper.appendChild(input);
    form.appendChild(wrapper);
  }

  function appendStockIaFileField_(form, name, label, disabled) {
    const wrapper = document.createElement("label");
    const input = document.createElement("input");
    wrapper.className = "full-width";
    wrapper.textContent = label;
    input.name = name;
    input.type = "file";
    input.accept = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";
    input.disabled = Boolean(disabled);
    wrapper.appendChild(input);
    form.appendChild(wrapper);
  }

  function appendStockIaCheckbox_(form, name, label) {
    const wrapper = document.createElement("label");
    const input = document.createElement("input");
    wrapper.className = "stock-ia-checkbox full-width";
    input.name = name;
    input.type = "checkbox";
    wrapper.appendChild(input);
    wrapper.appendChild(document.createTextNode(label));
    form.appendChild(wrapper);
  }

  function appendStockIaTextarea_(form, name, label, value) {
    const wrapper = document.createElement("label");
    const textarea = document.createElement("textarea");
    wrapper.className = "full-width";
    wrapper.textContent = label;
    textarea.name = name;
    textarea.rows = 3;
    textarea.value = value || "";
    wrapper.appendChild(textarea);
    form.appendChild(wrapper);
  }

  function appendStockWorkSelect_(form, selectedWorkId) {
    const wrapper = document.createElement("label");
    const select = document.createElement("select");
    wrapper.textContent = "Obra";
    select.name = "workId";
    appendOption_(select, "", "Geral / sem obra");
    getUserWorks_().forEach(function (work) {
      appendOption_(select, work.id, work.name);
    });
    select.value = selectedWorkId || "";
    wrapper.appendChild(select);
    form.appendChild(wrapper);
  }

  function appendStockItemSelect_(form, items, selectedItemId, required) {
    const wrapper = document.createElement("label");
    const select = document.createElement("select");
    wrapper.textContent = "Item de estoque";
    select.name = "stockItemId";
    select.required = required !== false;
    appendOption_(select, "", "Escolha um item");
    items.forEach(function (item) {
      appendOption_(select, item.id, item.name + " (" + item.unit + ")");
    });
    select.value = selectedItemId || "";
    wrapper.appendChild(select);
    form.appendChild(wrapper);
  }

  function appendOption_(select, value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  }

  function appendHiddenField_(form, name, value) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value || "";
    form.appendChild(input);
  }

  function appendStockIaNotice_(form, text) {
    const note = document.createElement("p");
    note.className = "stock-ia-modal-note full-width";
    note.textContent = text;
    form.appendChild(note);
  }

  function appendStockIaFormActions_(form, submitText) {
    const actions = document.createElement("div");
    const submit = document.createElement("button");
    const cancel = document.createElement("button");
    actions.className = "stock-ia-form-actions full-width";
    submit.type = "submit";
    submit.className = "mini-button primary";
    submit.textContent = submitText;
    cancel.type = "button";
    cancel.className = "mini-button";
    cancel.dataset.stockModalClose = "true";
    cancel.textContent = "Cancelar";
    actions.appendChild(submit);
    actions.appendChild(cancel);
    form.appendChild(actions);
  }

  async function handleStockIaFormSubmit_(event) {
    event.preventDefault();
    const form = event.target;
    const type = form.dataset.stockFormType;
    const formData = new FormData(form);
    const itemId = clean(formData.get("itemId"));
    const rdoMaterialKey = clean(formData.get("rdoMaterialKey"));
    const movementType = clean(formData.get("movementType"));
    const noteId = clean(formData.get("noteId"));

    if (type === "item") {
      if (itemId) {
        updateStockMasterItem_(itemId, Object.fromEntries(formData.entries()));
        showStockIaToast_("Material atualizado.", "success");
      } else {
        createStockMasterItem_(Object.fromEntries(formData.entries()));
        showStockIaToast_("Material cadastrado.", "success");
      }
    } else if (type === "guided-stock") {
      const result = handleGuidedStockSubmit_(formData);
      showStockIaToast_(result.message, result.ok ? "success" : "error");
      if (!result.ok) {
        return;
      }
    } else if (type === "warehouse-guided") {
      const result = handleWarehouseGuidedSubmit_(formData);
      showStockIaToast_(result.message, result.ok ? "success" : "error");
      if (!result.ok) {
        return;
      }
    } else if (type === "movement") {
      const data = Object.fromEntries(formData.entries());
      if (movementType === "saida") {
        registerManualStockExit_(data);
        showStockIaToast_("Saida registrada.", "success");
      } else {
        registerStockEntry_(data);
        showStockIaToast_("Entrada registrada.", "success");
      }
    } else if (type === "delete-item") {
      deleteStockMasterItem_(itemId);
      showStockIaToast_("Material excluido.", "success");
    } else if (type === "create-from-rdo") {
      const entry = findUnlinkedRdoEntryByKey_(rdoMaterialKey);
      const item = createStockMasterItem_(Object.fromEntries(formData.entries()));
      if (entry && item) {
        linkRdoMaterialToStockItem_(entry.material, entry.dailyLog, item.id);
      }
      showStockIaToast_("Item criado e vinculado ao RDO.", "success");
    } else if (type === "link-rdo") {
      const entry = findUnlinkedRdoEntryByKey_(rdoMaterialKey);
      const stockItemId = clean(formData.get("stockItemId"));
      if (entry && stockItemId) {
        linkRdoMaterialToStockItem_(entry.material, entry.dailyLog, stockItemId);
        showStockIaToast_("Consumo do RDO vinculado.", "success");
      } else {
        showStockIaToast_("Escolha um item para vincular.", "error");
        return;
      }
    } else if (type === "note") {
      const file = form.querySelector("input[type='file']") && form.querySelector("input[type='file']").files[0];
      const filePayload = await handleStockNoteFileUpload_(file);
      const payload = Object.assign({}, Object.fromEntries(formData.entries()));
      if (file) {
        Object.assign(payload, filePayload);
      }
      if (noteId) {
        updateStockNoteDraft_(noteId, payload);
        showStockIaToast_(filePayload.oversized ? "Nota atualizada. Arquivo grande salvo apenas como referencia." : "Nota atualizada.", "success");
      } else {
        createStockNoteDraft_(payload);
        showStockIaToast_(filePayload.oversized ? "Nota criada. Arquivo grande salvo apenas como referencia." : "Nota criada.", "success");
      }
    } else if (type === "note-item") {
      const note = addStockNoteItem_(noteId, Object.fromEntries(formData.entries()));
      if (!note) {
        showStockIaToast_("Preencha material e quantidade para adicionar o item.", "error");
        return;
      }
      showStockIaToast_("Item adicionado a nota.", "success");
    } else if (type === "confirm-note") {
      const result = confirmStockNoteEntry_(noteId);
      showStockIaToast_(result.message, result.ok ? "success" : "error");
      if (!result.ok) {
        return;
      }
    } else if (type === "cancel-note") {
      cancelStockNote_(noteId);
      showStockIaToast_("Nota cancelada.", "success");
    } else if (type === "delete-note") {
      deleteStockNoteDraft_(noteId);
      showStockIaToast_("Rascunho de nota excluido.", "success");
    }

    closeStockIaModal_();
    renderStockIaPanel_(getUserDailyLogs_());
  }

  function showStockIaToast_(message, type) {
    if (!stockIaActionMessage) {
      return;
    }

    stockIaActionMessage.textContent = message;
    stockIaActionMessage.className = "stock-ia-toast " + (type || "info");
    window.clearTimeout(showStockIaToast_.timer);
    showStockIaToast_.timer = window.setTimeout(function () {
      stockIaActionMessage.classList.add("is-hidden");
    }, 3600);
  }

  function renderStockIaActionMessage_() {
    if (stockIaActionMessage && !stockIaActionMessage.textContent) {
      stockIaActionMessage.classList.add("is-hidden");
    }
  }

  function findUnlinkedRdoEntryByKey_(rdoMaterialKey) {
    return buildUnlinkedRdoMaterials_().find(function (entry) {
      return entry.rdoMaterialKey === rdoMaterialKey;
    }) || null;
  }

  function createIndicatorItem_(label, value) {
    const item = document.createElement("div");
    const labelElement = document.createElement("span");
    const valueElement = document.createElement("strong");

    item.className = "indicator-item";
    labelElement.textContent = label;
    valueElement.textContent = String(value);
    item.appendChild(labelElement);
    item.appendChild(valueElement);
    return item;
  }

  function getProductionPeriodStats_(dailyLogs) {
    const referenceDate = getProductionReferenceDate_(dailyLogs);
    const referenceEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 23, 59, 59, 999);
    const referenceKey = toDateKey_(referenceDate);
    const weekStart = getWeekStart_(referenceDate);
    const monthKey = referenceKey.slice(0, 7);
    const stats = {
      day: 0,
      week: 0,
      month: 0
    };

    dailyLogs.forEach(function (logItem) {
      const logDate = parseLocalDate_(logItem.date);
      const productionCount = (logItem.productions || []).length;

      if (!logDate || !productionCount) {
        return;
      }

      const logKey = toDateKey_(logDate);

      if (logKey === referenceKey) {
        stats.day += productionCount;
      }

      if (logDate >= weekStart && logDate <= referenceEnd) {
        stats.week += productionCount;
      }

      if (logKey.slice(0, 7) === monthKey) {
        stats.month += productionCount;
      }
    });

    return stats;
  }

  function getProductionReferenceDate_(dailyLogs) {
    const dates = dailyLogs
      .map(function (logItem) {
        return parseLocalDate_(logItem.date);
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return b.getTime() - a.getTime();
      });

    return dates[0] || new Date();
  }

  function parseLocalDate_(value) {
    if (!value) {
      return null;
    }

    const date = new Date(String(value) + "T12:00:00");
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toDateKey_(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function getWeekStart_(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return start;
  }

  function findDailyLog_(dailyLogId) {
    return (appState.dailyLogs || []).find(function (logItem) {
      return logItem.id === dailyLogId;
    }) || null;
  }

  function removeDailyLog_(dailyLogId) {
    ensureLocalState_(appState);
    appState.dailyLogs = appState.dailyLogs.filter(function (logItem) {
      return logItem.id !== dailyLogId;
    });
    saveLocalData({ syncCloud: true });
    renderSaasState_();
    setDailyLogStatus_("Diário removido localmente e alteração enviada para sincronização.", "success");
  }

  async function handleDiaryAiAction_(button) {
    const target = dailyLogForm && dailyLogForm.elements[button.dataset.diaryAiTarget];

    if (!target) {
      return;
    }

    const action = button.dataset.diaryAiAction;
    const snapshot = collectDailyLogSnapshot_();

    if (action === "summary") {
      target.value = buildDailyLogSummary_(snapshot);
      target.dispatchEvent(new Event("input", { bubbles: true }));
      setDailyLogStatus_("Resumo do dia gerado apenas com os dados preenchidos. Revise antes de salvar.", "success");
      return;
    }

    const assistant = window.ObraReportAI;

    if (!assistant || !assistant.improveTechnicalText) {
      throw new Error("Assistente de IA de texto não foi carregado.");
    }

    if (!canUseAi_()) {
      return;
    }

    const original = clean(target.value);
    const context = buildDailyLogAiContext_(button, snapshot);
    let result;

    setAiButtonBusy_(button, true);
    try {
      result = await assistant.improveTechnicalText(original, context);
    } finally {
      setAiButtonBusy_(button, false);
    }

    target.value = result && result.suggestion ? result.suggestion : original;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    setDailyLogStatus_("Texto gerado com IA. Revise antes de salvar o diário.", "success");
    registerBillingUsage_("ai", {
      action: "diario-" + action,
      target: button.dataset.diaryAiTarget || ""
    });
  }

  function collectDailyLogSnapshot_() {
    const snapshot = collectDailyLogForm_();
    return decorateDailyLogForExport_(snapshot);
  }

  function decorateDailyLogForExport_(logItem) {
    const snapshot = cloneDailyLogItems_([logItem])[0] || {};
    snapshot.work = findWork_(snapshot.workId);
    snapshot.client = snapshot.work ? findClient_(snapshot.work.clientId) : null;
    return snapshot;
  }

  function buildDailyLogAiContext_(button, snapshot) {
    return {
      kind: button.dataset.diaryAiKind || "technical",
      targetName: button.dataset.diaryAiTarget || "",
      report: {
        obra: snapshot.work ? snapshot.work.name : "",
        local: snapshot.work ? snapshot.work.address : "",
        dataVistoria: snapshot.date,
        responsavelTecnico: snapshot.responsible,
        tipoObra: snapshot.work ? snapshot.work.type : "",
        observacoes: snapshot.generalNotes
      },
      diary: snapshot
    };
  }

  function buildDailyLogSummary_(logItem) {
    const workName = logItem.work ? logItem.work.name : getWorkName_(logItem.workId);
    const parts = [];
    const intro = "No dia " + formatDateOnly_(logItem.date) +
      (workName ? ", na obra " + workName : "") +
      ", foi registrado diário de obra";

    parts.push(intro + ".");

    if (logItem.services) {
      parts.push("Serviços executados: " + logItem.services + ".");
    }

    if (logItem.productions && logItem.productions.length) {
      parts.push("Produção executada: " + formatProductionCollection_(logItem.productions) + ".");
    }

    if (logItem.employeeCount || logItem.teamPresent) {
      parts.push("A equipe contou com " + [logItem.employeeCount && logItem.employeeCount + " funcionário(s)", logItem.teamPresent].filter(Boolean).join(" e ") + ".");
    }

    if (logItem.weather || logItem.impact) {
      parts.push("Condição climática: " + (logItem.weather || "-") + "; impacto informado: " + (logItem.impact || "Sem impacto") + ".");
    }

    if (logItem.materials && logItem.materials.length) {
      parts.push("Materiais consumidos: " + logItem.materials.map(formatMaterialSummary_).join("; ") + ".");
    }

    if (logItem.materialRequests && logItem.materialRequests.length) {
      parts.push("SOLICITACOES DE MATERIAL DO DIA: " + buildDailyLogMaterialRequestsAuditText_(logItem));
    }

    if (logItem.tools && logItem.tools.length) {
      parts.push("Ferramentas e equipamentos registrados: " + logItem.tools.map(function (tool) {
        return tool.name + " (" + tool.status + ")";
      }).join("; ") + ".");
    }

    if (logItem.occurrences) {
      parts.push("Ocorrências do dia: " + logItem.occurrences + ".");
    }

    if (logItem.safety && logItem.safety.occurrence && logItem.safety.occurrence !== "Nenhuma ocorrência") {
      parts.push("Segurança do trabalho: " + logItem.safety.occurrence + ".");
    }

    if (logItem.generalNotes) {
      parts.push("Observações gerais: " + logItem.generalNotes + ".");
    }

    return parts.join(" ");
  }

  function shareDailyLogSummary_(channel) {
    const snapshot = collectDailyLogSnapshot_();
    const message = channel === "email" ? buildDailyLogEmailBody_(snapshot) : buildDailyLogWhatsappMessage_(snapshot);
    const subject = buildDailyLogShareSubject_(snapshot);

    if (channel === "whatsapp") {
      const url = "https://wa.me/?text=" + encodeURIComponent(message);
      const opened = window.open(url, "_blank", "noopener");

      if (!opened) {
        window.location.href = url;
      }

      setDailyLogStatus_("Resumo executivo aberto para envio no WhatsApp.", "success");
      return;
    }

    if (channel === "email") {
      const recipient = snapshot.client && snapshot.client.email ? snapshot.client.email : "";
      const url = "mailto:" + encodeURIComponent(recipient) +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(message);

      copyTextFallback_(message);
      window.location.href = url;
      setDailyLogStatus_("O e-mail será aberto no aplicativo de e-mail do dispositivo para revisão e envio. Se o app não abrir, confira a configuração; o texto foi copiado para colar manualmente.", "success");
    }
  }

  function copyTextFallback_(text) {
    if (!text) {
      return false;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {
        copyTextWithTemporaryField_(text);
      });
      return true;
    }

    return copyTextWithTemporaryField_(text);
  }

  function copyTextWithTemporaryField_(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand("copy");
    } catch (error) {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  function openDailyLogPdf_(logItem) {
    const snapshot = decorateDailyLogForExport_(logItem);

    if (!snapshot.workId) {
      setDailyLogStatus_("Escolha uma obra antes de gerar o PDF do diário.", "error");
      return;
    }

    setDailyLogStatus_("Preparando PDF do diário...", "info");
    const html = buildDailyLogPdfHtml_(snapshot);
    const pdfWindow = window.open("", "_blank");

    if (!pdfWindow) {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.location.href = url;
      return;
    }

    pdfWindow.document.open();
    pdfWindow.document.write(html);
    pdfWindow.document.close();
    setDailyLogStatus_("PDF do diário aberto. Use Imprimir/Salvar como PDF no navegador.", "success");
  }

  function buildDailyLogPdfHtml_(logItem) {
    const workName = logItem.work ? logItem.work.name : getWorkName_(logItem.workId);
    const clientName = logItem.client ? logItem.client.name : "";
    const estimated = buildEstimatedMaterialsForProductions_(logItem.productions || [], logItem.materials || []);
    const title = "RDO - " + (workName || "Diário de Obras") + " - " + formatDateOnly_(logItem.date);
    const sections = [
      buildDailyLogPdfExecutiveSummary_(logItem, estimated),
      buildDailyLogPdfInfoSection_(logItem, workName, clientName),
      buildDailyLogPdfTextSection_("Clima e impactos", [
        ["Condição climática", logItem.weather],
        ["Impacto do dia", logItem.impact],
        ["Observação sobre impactos", logItem.impactNote]
      ]),
      buildDailyLogPdfTextSection_("Equipe e horários", [
        ["Horário de início", logItem.startTime],
        ["Horário de término", logItem.endTime],
        ["Equipe presente", logItem.teamPresent],
        ["Quantidade de funcionários", logItem.employeeCount],
        ["Observações da equipe", logItem.teamNotes]
      ]),
      buildDailyLogPdfTextSection_("Serviços executados", [
        ["Serviços", logItem.services],
        ["Avanço físico estimado", logItem.progress ? logItem.progress + "%" : ""],
        ["Interferências", logItem.interferences],
        ["Visitas recebidas", logItem.visits]
      ]),
      buildDailyLogPdfTableSection_("Produção executada", ["Serviço", "Quantidade", "Unidade", "Observação"], (logItem.productions || []).map(function (item) {
        return [item.service, formatQuantity_(item.quantity), item.unit, item.note];
      })),
      buildDailyLogPdfTableSection_("Materiais consumidos", ["Material", "Quantidade", "Unidade", "Valor total", "Observação"], (logItem.materials || []).map(function (item) {
        return [item.name, formatQuantity_(item.quantity), item.unit, formatCurrency_(item.totalValue || 0), item.note];
      })),
      buildDailyLogPdfTableSection_("Consumo estimado por composição", ["Material", "Quantidade estimada", "Unidade", "Origem"], estimated.items.map(function (item) {
        return [item.name, formatQuantity_(item.quantity), item.unit, item.sources ? item.sources.join("; ") : ""];
      })),
      buildDailyLogPdfTableSection_("Auditoria simples", ["Material", "Estimado", "Registrado", "Diferença", "Status"], estimated.audit.map(function (item) {
        return [
          item.name,
          formatQuantity_(item.estimated) + " " + item.unit,
          formatQuantity_(item.registered) + " " + item.unit,
          formatAuditDifference_(item),
          formatStockAiConsumptionStatus_(item.status)
        ];
      })),
      buildDailyLogPdfTableSection_("Planejamento de compra", ["Material", "Previsto", "Saldo", "Comprar", "Status"], ((estimated.purchasePlan && estimated.purchasePlan.items) || []).map(function (item) {
        return [
          item.materialName,
          formatQuantity_(item.predictedQuantity) + " " + item.unit,
          formatQuantity_(item.currentBalance) + " " + item.unit,
          formatQuantity_(item.purchaseQuantity) + " " + item.unit,
          item.status
        ];
      })),
      buildDailyLogPdfTableSection_("Ferramentas e equipamentos", ["Nome", "Situação", "Observação"], (logItem.tools || []).map(function (item) {
        return [item.name, item.status, item.note];
      })),
      buildDailyLogPdfTextSection_("Segurança do trabalho", [
        ["Ocorrência", logItem.safety && logItem.safety.occurrence],
        ["Descrição", logItem.safety && logItem.safety.description],
        ["Providências adotadas", logItem.safety && logItem.safety.actions],
        ["Responsável pela orientação", logItem.safety && logItem.safety.responsible]
      ]),
      buildDailyLogPdfTextSection_("Ocorrências e observações", [
        ["Ocorrências do dia", logItem.occurrences],
        ["Equipamentos parados ou com problema", logItem.stoppedEquipment],
        ["Observações gerais", logItem.generalNotes]
      ]),
      buildDailyLogPdfPhotosSection_(logItem.photos || []),
      buildDailyLogPdfTextSection_("Resumo executivo", [
        ["Resumo do dia", logItem.summary || buildDailyLogSummary_(logItem)]
      ])
    ];

    if (estimated.missing && estimated.missing.length) {
      sections.splice(7, 0, buildDailyLogPdfNotice_("Sem composição cadastrada para: " + estimated.missing.map(function (item) {
        return item.service;
      }).join(", ") + "."));
    }

    return [
      "<!doctype html>",
      "<html lang=\"pt-BR\">",
      "<head>",
      "<meta charset=\"utf-8\">",
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
      "<title>" + escapeHtml_(title) + "</title>",
      "<style>" + buildDailyLogPdfCss_() + "</style>",
      "</head>",
      "<body>",
      "<main class=\"rdo-page\">",
      buildDailyLogPdfCover_(logItem, workName, clientName),
      sections.join(""),
      "</main>",
      "<footer class=\"rdo-footer\">ObraReport | " + escapeHtml_(workName || "Diário de Obras") + " | " + escapeHtml_(formatDateOnly_(logItem.date)) + "</footer>",
      "<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},350);});</script>",
      "</body>",
      "</html>"
    ].join("");
  }

  function buildDailyLogPdfCover_(logItem, workName, clientName) {
    return [
      "<section class=\"rdo-cover\">",
      "<div class=\"rdo-brand\">",
      "<strong>ObraReport</strong>",
      "<span>Relatório Diário de Obra</span>",
      "</div>",
      "<div class=\"rdo-cover-main\">",
      "<p class=\"rdo-kicker\">Documento técnico profissional</p>",
      "<h1>Diário de Obras</h1>",
      "<p>Registro técnico diário para acompanhamento executivo, produção, consumo de materiais, segurança e ocorrências da obra.</p>",
      "</div>",
      "<div class=\"rdo-cover-grid\">",
      buildDailyLogPdfInfoItem_("Obra", workName),
      buildDailyLogPdfInfoItem_("Proprietário", clientName),
      buildDailyLogPdfInfoItem_("Data", formatDateOnly_(logItem.date)),
      buildDailyLogPdfInfoItem_("Responsável", logItem.responsible),
      "</div>",
      "<div class=\"rdo-seal\">Gerado com ObraReport</div>",
      "</section>"
    ].join("");
  }

  function buildDailyLogPdfExecutiveSummary_(logItem, estimated) {
    const productions = logItem.productions || [];
    const materials = logItem.materials || [];
    const auditItems = estimated && estimated.audit ? estimated.audit : [];
    const differentItems = auditItems.filter(function (item) {
      return Number(item.difference || 0) !== 0;
    }).length;

    return [
      "<section class=\"rdo-summary-panel\">",
      "<div>",
      "<span>Resumo executivo</span>",
      "<strong>" + escapeHtml_(safePdfText_(logItem.summary || buildDailyLogSummary_(logItem))) + "</strong>",
      "</div>",
      "<ul>",
      "<li><span>Produção</span><strong>" + productions.length + "</strong></li>",
      "<li><span>Materiais</span><strong>" + materials.length + "</strong></li>",
      "<li><span>Auditoria</span><strong>" + differentItems + "</strong></li>",
      "</ul>",
      "</section>"
    ].join("");
  }

  function buildDailyLogPdfInfoSection_(logItem, workName, clientName) {
    return [
      "<section class=\"rdo-section\">",
      "<h2>Identificação do diário</h2>",
      "<div class=\"rdo-info-grid\">",
      buildDailyLogPdfInfoItem_("Obra", workName),
      buildDailyLogPdfInfoItem_("Proprietário", clientName),
      buildDailyLogPdfInfoItem_("Data", formatDateOnly_(logItem.date)),
      buildDailyLogPdfInfoItem_("Responsável", logItem.responsible),
      buildDailyLogPdfInfoItem_("Local", logItem.work && logItem.work.address),
      buildDailyLogPdfInfoItem_("Tipo de obra", logItem.work && logItem.work.type),
      "</div>",
      "</section>"
    ].join("");
  }

  function buildDailyLogPdfTextSection_(title, rows) {
    const visibleRows = rows.filter(function (row) {
      return safePdfText_(row[1]) !== "-";
    });

    return [
      "<section class=\"rdo-section\">",
      "<h2>" + escapeHtml_(title) + "</h2>",
      visibleRows.length ? "<div class=\"rdo-info-grid\">" + visibleRows.map(function (row) {
        return buildDailyLogPdfInfoItem_(row[0], row[1]);
      }).join("") + "</div>" : "<p class=\"rdo-empty\">Sem registros nesta seção.</p>",
      "</section>"
    ].join("");
  }

  function buildDailyLogPdfTableSection_(title, headers, rows) {
    return [
      "<section class=\"rdo-section\">",
      "<h2>" + escapeHtml_(title) + "</h2>",
      rows.length ? [
        "<table>",
        "<thead><tr>" + headers.map(function (header) {
          return "<th>" + escapeHtml_(header) + "</th>";
        }).join("") + "</tr></thead>",
        "<tbody>" + rows.map(function (row) {
          return "<tr>" + row.map(function (cell) {
            return "<td>" + escapeHtml_(safePdfText_(cell)) + "</td>";
          }).join("") + "</tr>";
        }).join("") + "</tbody>",
        "</table>"
      ].join("") : "<p class=\"rdo-empty\">Sem registros nesta seção.</p>",
      "</section>"
    ].join("");
  }

  function buildDailyLogPdfPhotosSection_(photos) {
    return [
      "<section class=\"rdo-section\">",
      "<h2>Fotos do dia</h2>",
      photos.length ? "<div class=\"rdo-photo-grid\">" + photos.map(function (photo) {
        const source = getDailyLogPhotoSource_(photo);
        return [
          "<figure>",
          source ? "<img src=\"" + escapeAttribute_(source) + "\" alt=\"" + escapeAttribute_(photo.caption || "Foto do diário") + "\">" : "<div class=\"rdo-photo-placeholder\">Foto indisponível</div>",
          "<figcaption>" + escapeHtml_(photo.caption || "Foto do dia") + "</figcaption>",
          "</figure>"
        ].join("");
      }).join("") + "</div>" : "<p class=\"rdo-empty\">Nenhuma foto registrada.</p>",
      "</section>"
    ].join("");
  }

  function buildDailyLogPdfNotice_(text) {
    return "<section class=\"rdo-notice\">" + escapeHtml_(text) + "</section>";
  }

  function buildDailyLogPdfInfoItem_(label, value) {
    return [
      "<div class=\"rdo-info-item\">",
      "<span>" + escapeHtml_(label) + "</span>",
      "<strong>" + escapeHtml_(safePdfText_(value)) + "</strong>",
      "</div>"
    ].join("");
  }

  function getDailyLogPhotoSource_(photo) {
    if (photo.previewDataUrl) {
      return photo.previewDataUrl;
    }

    if (photo.payload && photo.payload.base64) {
      return "data:" + (photo.payload.mimeType || "image/jpeg") + ";base64," + photo.payload.base64;
    }

    return "";
  }

  function buildDailyLogPdfCss_() {
    return [
      "@page{size:A4;margin:16mm 14mm 18mm;}",
      "*{box-sizing:border-box;}",
      "body{margin:0;background:#eef2f6;color:#17202c;font-family:Arial,'Segoe UI',sans-serif;line-height:1.45;}",
      ".rdo-page{max-width:920px;margin:0 auto;background:#fff;min-height:100vh;padding:28px 32px 72px;}",
      ".rdo-cover{min-height:92vh;display:flex;flex-direction:column;justify-content:space-between;border:1px solid #cbd8e6;padding:36px;background:radial-gradient(circle at top right,rgba(15,118,110,.14),transparent 18rem),linear-gradient(180deg,#ffffff 0%,#f7fafc 100%);page-break-after:always;}",
      ".rdo-brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #0f766e;padding-bottom:18px;color:#0b1724;}",
      ".rdo-brand strong{font-size:26px;letter-spacing:.02em;}",
      ".rdo-brand span{font-size:12px;text-transform:uppercase;font-weight:800;color:#0f766e;}",
      ".rdo-cover-main{max-width:640px;}",
      ".rdo-kicker{margin:0 0 10px;color:#0f766e;font-weight:800;text-transform:uppercase;font-size:12px;}",
      "h1{margin:0 0 12px;font-size:44px;color:#0b1724;}",
      ".rdo-cover-main p{font-size:16px;color:#475569;}",
      ".rdo-cover-grid,.rdo-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}",
      ".rdo-info-item{border:1px solid #dbe4ee;background:#fff;padding:12px;border-radius:8px;break-inside:avoid;}",
      ".rdo-info-item span{display:block;font-size:10px;text-transform:uppercase;font-weight:800;color:#64748b;margin-bottom:4px;}",
      ".rdo-info-item strong{font-size:13px;color:#111827;white-space:pre-wrap;}",
      ".rdo-seal{align-self:flex-start;padding:8px 12px;border:1px solid #0f766e;border-radius:999px;color:#0f766e;font-size:12px;font-weight:800;}",
      ".rdo-summary-panel{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(240px,.65fr);gap:16px;margin:0 0 18px;padding:18px;border:1px solid #0f766e;border-radius:12px;background:#f3fbfa;break-inside:avoid;}",
      ".rdo-summary-panel div{display:grid;gap:6px;}",
      ".rdo-summary-panel span{color:#0f766e;font-size:10px;font-weight:900;text-transform:uppercase;}",
      ".rdo-summary-panel strong{color:#0b1724;font-size:14px;}",
      ".rdo-summary-panel ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none;}",
      ".rdo-summary-panel li{display:grid;gap:4px;padding:10px;border-radius:8px;background:#fff;border:1px solid #dbe4ee;text-align:center;}",
      ".rdo-summary-panel li strong{font-size:20px;}",
      ".rdo-section{margin:0 0 18px;padding:18px;border:1px solid #dbe4ee;border-radius:10px;break-inside:avoid;}",
      ".rdo-section h2{margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;color:#0b1724;font-size:18px;}",
      "table{width:100%;border-collapse:collapse;font-size:11px;}",
      "th{background:#0b1724;color:#fff;text-align:left;padding:8px;border:1px solid #0b1724;}",
      "td{vertical-align:top;padding:8px;border:1px solid #dbe4ee;}",
      "tr:nth-child(even) td{background:#f8fafc;}",
      ".rdo-empty{margin:0;color:#64748b;font-size:12px;}",
      ".rdo-notice{margin:0 0 18px;padding:12px 14px;border:1px solid #f59e0b;background:#fffbeb;color:#92400e;border-radius:8px;font-weight:800;}",
      ".rdo-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}",
      "figure{margin:0;border:1px solid #dbe4ee;border-radius:8px;overflow:hidden;break-inside:avoid;background:#fff;}",
      "figure img{display:block;width:100%;height:190px;object-fit:cover;}",
      "figcaption{padding:8px 10px;font-size:11px;color:#334155;font-weight:700;}",
      ".rdo-photo-placeholder{height:190px;display:grid;place-items:center;background:#f1f5f9;color:#64748b;font-weight:800;}",
      ".rdo-footer{position:fixed;left:14mm;right:14mm;bottom:7mm;border-top:1px solid #dbe4ee;padding-top:5px;text-align:center;color:#64748b;font-size:9px;}",
      "@media print{body{background:#fff;}.rdo-page{max-width:none;margin:0;padding:0 0 16mm;}.rdo-section{box-shadow:none;}.rdo-footer{display:block;}}",
      "@media screen{.rdo-page{box-shadow:0 18px 60px rgba(15,23,42,.16);}}"
    ].join("");
  }

  function safePdfText_(value) {
    return normalizeDisplayText_(clean(value)) || "-";
  }

  function escapeHtml_(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute_(value) {
    return escapeHtml_(value).replace(/`/g, "&#096;");
  }

  function buildDailyLogShareSubject_(logItem) {
    const workName = logItem.work ? logItem.work.name : getWorkName_(logItem.workId);
    return "ObraReport | Resumo técnico da obra " + (workName || "sem nome informado");
  }

  function buildDailyLogExecutiveSummary_(logItem) {
    const workName = logItem.work ? logItem.work.name : getWorkName_(logItem.workId);
    const clientName = logItem.client ? logItem.client.name : "";
    const estimated = buildEstimatedMaterialsForProductions_(logItem.productions || [], logItem.materials || []);
    const lines = [
      "Resumo executivo do Diário de Obras",
      "",
      "Obra: " + (workName || "-"),
      clientName ? "Cliente: " + clientName : "",
      "Data: " + formatDateOnly_(logItem.date),
      "Responsável: " + (logItem.responsible || "-"),
      "",
      "Equipe: " + formatDailyLogTeamLine_(logItem),
      "Produção executada: " + ((logItem.productions || []).length ? formatProductionCollection_(logItem.productions) : "-"),
      "Materiais registrados: " + ((logItem.materials || []).length ? logItem.materials.map(formatMaterialSummary_).join("; ") : "-"),
      "Consumo estimado: " + (estimated.items.length ? estimated.items.map(formatEstimatedMaterialSummary_).join("; ") : "-"),
      "Diferença identificada: " + (estimated.audit.length ? estimated.audit.map(formatEstimatedAuditSummary_).join("; ") : "-"),
      "Ocorrências: " + (logItem.occurrences || "-"),
      "Segurança: " + formatDailyLogSafetyLine_(logItem),
      "Fotos: " + formatDailyLogPhotosLine_(logItem),
      "",
      logItem.summary ? "Resumo do dia: " + logItem.summary : buildDailyLogSummary_(logItem)
    ].filter(function (line) {
      return line !== "";
    });

    if (estimated.missing && estimated.missing.length) {
      lines.splice(lines.length - 1, 0, "Sem composição cadastrada para: " + estimated.missing.map(function (production) {
        return production.service;
      }).join(", ") + ".");
    }

    return lines.join("\n");
  }

  function buildDailyLogWhatsappMessage_(logItem) {
    const workName = logItem.work ? logItem.work.name : getWorkName_(logItem.workId);
    const clientName = logItem.client ? logItem.client.name : "";
    const summary = logItem.summary || buildDailyLogSummary_(logItem);

    return [
      "🏗️ *OBRAREPORT — RESUMO DA OBRA*",
      "",
      "📍 *Obra:* " + (workName || "Obra não informada"),
      "👤 *Cliente:* " + (clientName || "Cliente não informado"),
      "📅 *Data:* " + (logItem.date ? formatDateOnly_(logItem.date) : "Data não informada"),
      "",
      "━━━━━━━━━━━━━━",
      "",
      "📌 *Resumo do dia*",
      limitShareText_(summary, 520),
      "",
      "✅ *Produção executada*",
      formatShareBulletList_(logItem.productions, formatProductionSummary_, "Nenhuma produção executada foi registrada."),
      "",
      "🧱 *Materiais consumidos*",
      formatShareBulletList_(logItem.materials, formatMaterialSummary_, "Nenhum material consumido foi registrado."),
      "",
      "⚠️ *Ocorrências*",
      "• " + (logItem.occurrences || "Nenhuma ocorrência registrada."),
      "",
      "🦺 *Segurança*",
      "• " + formatDailyLogSafetyLine_(logItem),
      "",
      "📄 *Documento técnico*",
      "Relatório/RDO gerado pelo ObraReport.",
      "",
      "━━━━━━━━━━━━━━",
      "",
      "Mensagem enviada por *ObraReport*."
    ].join("\n");
  }

  function buildDailyLogEmailBody_(logItem) {
    const workName = logItem.work ? logItem.work.name : getWorkName_(logItem.workId);
    const clientName = logItem.client ? logItem.client.name : "";
    const responsible = logItem.responsible || (currentUser && currentUser.name) || "Responsável técnico";
    const summary = logItem.summary || buildDailyLogSummary_(logItem);

    return [
      "Olá, " + (clientName || "cliente") + ".",
      "",
      "Segue o resumo técnico registrado no ObraReport.",
      "",
      "Obra: " + (workName || "Obra não informada"),
      "Data: " + (logItem.date ? formatDateOnly_(logItem.date) : "Data não informada"),
      "Responsável: " + responsible,
      "",
      "Resumo executivo:",
      limitShareText_(summary, 700),
      "",
      "Produção executada:",
      formatPlainShareList_(logItem.productions, formatProductionSummary_, "Nenhuma produção executada foi registrada."),
      "",
      "Materiais consumidos:",
      formatPlainShareList_(logItem.materials, formatMaterialSummary_, "Nenhum material consumido foi registrado."),
      "",
      "Ocorrências:",
      "* " + (logItem.occurrences || "Nenhuma ocorrência registrada."),
      "",
      "Segurança:",
      "* " + formatDailyLogSafetyLine_(logItem),
      "",
      "Este registro foi organizado pelo ObraReport para acompanhamento técnico da obra.",
      "",
      "Atenciosamente,",
      responsible
    ].join("\n");
  }

  function formatShareBulletList_(items, formatter, emptyText) {
    const safeItems = (items || []).slice(0, 5);

    if (!safeItems.length) {
      return "• " + emptyText;
    }

    return safeItems.map(function (item) {
      return "• " + formatter(item);
    }).join("\n") + ((items || []).length > safeItems.length ? "\n• Outros registros disponíveis no RDO." : "");
  }

  function formatPlainShareList_(items, formatter, emptyText) {
    const safeItems = (items || []).slice(0, 8);

    if (!safeItems.length) {
      return "* " + emptyText;
    }

    return safeItems.map(function (item) {
      return "* " + formatter(item);
    }).join("\n") + ((items || []).length > safeItems.length ? "\n* Outros registros disponíveis no RDO." : "");
  }

  function limitShareText_(text, maxLength) {
    const value = clean(text) || "Resumo técnico não informado.";

    if (value.length <= maxLength) {
      return value;
    }

    return value.slice(0, maxLength - 1).trim() + "…";
  }

  function formatDailyLogTeamLine_(logItem) {
    return [
      logItem.employeeCount ? logItem.employeeCount + " funcionário(s)" : "",
      logItem.teamPresent || "",
      logItem.teamNotes || ""
    ].filter(Boolean).join(" · ") || "-";
  }

  function formatDailyLogSafetyLine_(logItem) {
    if (!logItem.safety) {
      return "-";
    }

    return [
      logItem.safety.occurrence || "Nenhuma ocorrência",
      logItem.safety.description,
      logItem.safety.actions,
      logItem.safety.responsible && "Responsável: " + logItem.safety.responsible
    ].filter(Boolean).join(" · ");
  }

  function formatDailyLogPhotosLine_(logItem) {
    const photos = logItem.photos || [];

    if (!photos.length) {
      return "Nenhuma foto registrada.";
    }

    return photos.length + " foto(s)" + (photos.some(function (photo) { return photo.caption; })
      ? " · " + photos.map(function (photo) {
        return photo.caption || "Sem legenda";
      }).join("; ")
      : ".");
  }

  function formatEstimatedMaterialSummary_(item) {
    return item.name + " - " + formatQuantity_(item.quantity) + " " + item.unit;
  }

  function formatEstimatedAuditSummary_(item) {
    return item.name + " - " + formatAuditDifference_(item);
  }

  function normalizeDisplayText_(value) {
    return String(value || "")
      .replace(/mÂ²/g, "m²")
      .replace(/mÂ³/g, "m³")
      .replace(/Â·/g, "·")
      .replace(/cerÂmico/g, "cerâmico")
      .replace(/CerÂmico/g, "Cerâmico")
      .replace(/cerÃ¢mico/g, "cerâmico")
      .replace(/CerÃ¢mico/g, "Cerâmico");
  }

  function getWorkName_(workId) {
    const work = findWork_(workId);
    return work ? work.name : "";
  }

  function formatProductionSummary_(production) {
    return production.service + ": " + formatQuantity_(production.quantity) + " " + production.unit;
  }

  function formatProductionCollection_(productions) {
    return (productions || []).map(formatProductionSummary_).join("; ");
  }

  function formatMaterialSummary_(material) {
    return formatQuantity_(material.quantity) + " " + formatMaterialUnit_(material.unit, material.quantity) + " de " + material.name;
  }

  function formatMaterialUnit_(unit, quantity) {
    const value = Number(quantity || 0);
    const safeUnit = unit || "un";
    const pluralUnits = {
      un: "unidades",
      saco: "sacos",
      lata: "latas",
      caixa: "caixas",
      barra: "barras",
      rolo: "rolos",
      litro: "litros"
    };

    if (value === 1) {
      return safeUnit;
    }

    return pluralUnits[safeUnit] || safeUnit;
  }

  function parseNumber_(value) {
    let normalized = String(value || "0")
      .replace(/[^\d,.-]/g, "")
      .trim();

    if (normalized.indexOf(",") >= 0) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      const dotParts = normalized.split(".");
      if (dotParts.length > 2) {
        normalized = dotParts.join("");
      } else if (dotParts.length === 2 && dotParts[1].length === 3 && dotParts[0] !== "0") {
        normalized = dotParts.join("");
      }
    }

    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function formatQuantity_(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) {
      return "0";
    }

    return number.toLocaleString("pt-BR", {
      maximumFractionDigits: 3
    });
  }

  function formatCurrency_(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function formatDateOnly_(value) {
    if (!value) {
      return "-";
    }

    try {
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short"
      }).format(new Date(value + "T12:00:00"));
    } catch (error) {
      return value;
    }
  }

  function setDailyLogStatus_(message, kind) {
    if (!dailyLogStatus) {
      setLocalStatus_(message, kind);
      return;
    }

    dailyLogStatus.textContent = message;
    dailyLogStatus.className = "local-status" + (kind ? " " + kind : "");
  }

  function createReport_(work, title) {
    const client = findClient_(work.clientId);
    const today = new Date().toISOString().slice(0, 10);
    const draft = {
      id: defaultDraftId + "-new",
      version: 2,
      updatedAt: new Date().toISOString(),
      values: {
        obra: work.name,
        dataVistoria: today,
        responsavelTecnico: currentUser.name,
        local: work.address,
        tipoObra: work.type,
        emailDestino: currentUser.email,
        observacoes: client ? "Cliente: " + client.name : ""
      },
      images: {}
    };

    return {
      id: createId_("rel"),
      userId: currentUser.id,
      clientId: work.clientId,
      workId: work.id,
      title: title,
      status: "Em edição",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      draft: draft,
      pdfUrl: ""
    };
  }

  async function openReportEditor_(reportId) {
    const report = findReport_(reportId);

    if (!report) {
      return;
    }

    activeReportId = report.id;
    setLastOpened_("editor", report.clientId, report.workId, report.id);
    saveLocalData({ syncCloud: false });
    if (window.location.hash !== "#report/" + report.id) {
      window.location.hash = "#report/" + report.id;
    }
    resetEditorForm_();
    applyDraftToForm_(await getDraftRecord_() || report.draft);
    updateReportContext_();
    showReportPanel_();
    goToStep_("dados", false);
    setDraftStatus_("Relatório carregado do histórico da obra.", "success");
  }

  function resetEditorForm_() {
    form.reset();
    imageCache.clear();
    clearAllImagePreviews_();
    setLog("");
    setGenerationStatus_("Pronto para gerar o PDF técnico.");

    if (todayInput) {
      todayInput.valueAsDate = new Date();
    }
  }

  function applyDraftToForm_(draft) {
    if (!draft || !draft.values) {
      return;
    }

    Object.keys(draft.values).forEach(function (name) {
      const field = form.elements[name];

      if (field && field.type !== "file") {
        field.value = draft.values[name];
      }
    });

    if (draft.images) {
      Object.keys(draft.images).forEach(function (inputName) {
        const hiddenField = getHiddenImageField_(inputName);

        imageCache.set(inputName, draft.images[inputName]);
        if (hiddenField) {
          hiddenField.value = draft.images[inputName].payload.base64;
        }
        renderImagePreview_(inputName, draft.images[inputName]);
      });
    }

    updateReportMetrics_();
    renderReviewSummary_();
  }

  function saveActiveReportDraft_(draft) {
    if (!activeReportId) {
      return;
    }

    const report = findReport_(activeReportId);
    if (!report) {
      return;
    }

    setLastOpened_("editor", report.clientId, report.workId, report.id);
    report.draft = cloneDraftWithoutImages_(draft);
    report.updatedAt = draft.updatedAt;
    report.status = report.pdfUrl ? "PDF gerado · em edição" : "Em edição";
    report.summary = getReportStats_();
    report.imageCount = Object.keys(draft.images || {}).length;
    saveAppState_();
    renderSaasState_();
  }

  function saveActiveReportExport_(pdfUrl, payload) {
    if (!activeReportId) {
      return;
    }

    const report = findReport_(activeReportId);
    if (!report) {
      return;
    }

    report.pdfUrl = pdfUrl || "";
    report.status = "PDF gerado";
    report.lastExport = {
      submittedAt: payload.submittedAt,
      fotosUnidade: payload.fotosUnidade.length,
      inconformidades: payload.inconformidades.length,
      billing: payload.billing || {}
    };
    report.updatedAt = new Date().toISOString();
    report.summary = getReportStats_();
    saveAppState_();
    renderSaasState_();
  }

  function cloneDraftWithoutImages_(draft) {
    return {
      id: draft.id,
      version: draft.version,
      updatedAt: draft.updatedAt,
      values: Object.assign({}, draft.values),
      images: {}
    };
  }

  function updateReportContext_() {
    if (!currentReportLabel) {
      return;
    }

    const report = activeReportId ? findReport_(activeReportId) : null;
    const work = report ? findWork_(report.workId) : null;
    const client = report ? findClient_(report.clientId) : null;

    if (!report) {
      currentReportLabel.textContent = "Relatório sem vínculo";
      return;
    }

    currentReportLabel.textContent = [
      report.title,
      client && client.name,
      work && work.name
    ].filter(Boolean).join(" · ");
  }

  function getActiveReportClientName_() {
    const report = activeReportId ? findReport_(activeReportId) : null;
    const client = report ? findClient_(report.clientId) : null;

    return client ? clean(client.name) : "";
  }

  function findClient_(clientId) {
    return appState.clients.find(function (client) {
      return client.id === clientId;
    }) || null;
  }

  function findWork_(workId) {
    return appState.works.find(function (work) {
      return work.id === workId;
    }) || null;
  }

  function findReport_(reportId) {
    return appState.reports.find(function (report) {
      return report.id === reportId;
    }) || null;
  }

  function formatDateTime_(value) {
    if (!value) {
      return "-";
    }

    try {
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  }

  function showReportPanel_() {
    showOnlyPanel_(reportPanel);
    const firstInput = form.querySelector("input, select, textarea");

    if (firstInput) {
      firstInput.focus();
    }
  }

  function setBusy(isBusy) {
    submitButton.disabled = isBusy;
    submitButton.textContent = isBusy ? "Gerando relatório..." : "Gerar relatório";
    if (floatingPdfButton) {
      floatingPdfButton.disabled = isBusy;
      floatingPdfButton.querySelector("span").textContent = isBusy ? "Gerando..." : "Gerar PDF";
    }
  }

  function handleFloatingPdfClick_() {
    if (!form || !submitButton || submitButton.disabled) {
      return;
    }

    goToStep_("gerar", false);
    setGenerationStatus_("Gerando PDF pelo atalho rapido...");

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit(submitButton);
      return;
    }

    submitButton.click();
  }

  function setGenerationStatus_(message) {
    if (generationStatus) {
      generationStatus.textContent = message;
    }
  }

  function setLog(message, kind) {
    log.textContent = message;
    log.className = "form-log" + (kind ? " " + kind : "");
  }

  function setDraftStatus_(message, kind) {
    if (!draftStatus) {
      return;
    }

    draftStatus.textContent = message || "";
    draftStatus.className = "draft-status" + (kind ? " " + kind : "");
  }

  function initializeWizard_() {
    updateReportMetrics_();
    goToStep_("dados", false);

    stepButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        goToStep_(button.dataset.stepTarget, false);
      });
    });

    form.addEventListener("click", function (event) {
      const nextButton = event.target.closest("[data-next-step]");
      const prevButton = event.target.closest("[data-prev-step]");

      if (nextButton) {
        if (validateCurrentStep_()) {
          goToStep_(nextButton.dataset.nextStep, false);
        }
      }

      if (prevButton) {
        goToStep_(prevButton.dataset.prevStep, false);
      }
    });

    if (floatingPdfButton) {
      floatingPdfButton.addEventListener("click", function () {
        handleFloatingPdfClick_();
      });
    }
  }

  function goToStep_(step, shouldFocus) {
    const index = stepOrder.indexOf(step);
    const safeStep = index >= 0 ? step : "dados";
    const safeIndex = stepOrder.indexOf(safeStep);

    stepPanels.forEach(function (panel) {
      panel.classList.toggle("active", panel.dataset.step === safeStep);
    });

    stepButtons.forEach(function (button) {
      const buttonIndex = stepOrder.indexOf(button.dataset.stepTarget);
      button.classList.toggle("active", button.dataset.stepTarget === safeStep);
      button.classList.toggle("done", buttonIndex >= 0 && buttonIndex < safeIndex);
    });

    if (progressFill) {
      progressFill.style.width = ((safeIndex + 1) / stepOrder.length * 100) + "%";
    }

    updateReportMetrics_();
    if (safeStep === "revisao") {
      renderReviewSummary_();
    }

    if (shouldFocus !== false) {
      const panel = stepPanels.find(function (item) {
        return item.dataset.step === safeStep;
      });
      const focusable = panel && panel.querySelector("input, select, textarea, button");
      if (focusable) {
        focusable.focus();
      }
    }
  }

  function validateCurrentStep_() {
    const activePanel = document.querySelector(".step-panel.active");
    const requiredFields = activePanel ? Array.from(activePanel.querySelectorAll("[required]")) : [];

    for (let index = 0; index < requiredFields.length; index += 1) {
      if (!requiredFields[index].checkValidity()) {
        requiredFields[index].reportValidity();
        requiredFields[index].focus();
        return false;
      }
    }

    return true;
  }

  function validateAllRequired_() {
    const requiredFields = Array.from(form.querySelectorAll("[required]"));

    for (let index = 0; index < requiredFields.length; index += 1) {
      if (!requiredFields[index].checkValidity()) {
        const panel = requiredFields[index].closest("[data-step]");
        if (panel) {
          goToStep_(panel.dataset.step, false);
        }
        requiredFields[index].reportValidity();
        requiredFields[index].focus();
        return false;
      }
    }

    return true;
  }

  function updateReportMetrics_() {
    const stats = getReportStats_();

    if (fotoCount) {
      fotoCount.textContent = String(stats.fotos);
    }

    if (inconformidadeCount) {
      inconformidadeCount.textContent = String(stats.inconformidades);
    }

    if (highRiskCount) {
      highRiskCount.textContent = String(stats.riscosAltos);
    }
  }

  function getReportStats_() {
    let fotos = 0;
    let inconformidades = 0;
    let riscosAltos = 0;

    for (let index = 1; index <= maxFotosUnidade; index += 1) {
      const number = String(index).padStart(2, "0");
      if (hasImage_("fotoUnidade" + number)) {
        fotos += 1;
      }
    }

    for (let index = 1; index <= maxInconformidades; index += 1) {
      const number = String(index).padStart(2, "0");
      const imageName = "fotoInconformidade" + number;
      const descricao = clean(form.elements["descricaoInconformidade" + number] && form.elements["descricaoInconformidade" + number].value);
      const solucao = clean(form.elements["solucaoInconformidade" + number] && form.elements["solucaoInconformidade" + number].value);
      const grau = clean(form.elements["grauRisco" + number] && form.elements["grauRisco" + number].value);

      if (hasImage_(imageName) || descricao || solucao || grau) {
        inconformidades += 1;
      }

      if (grau.indexOf("Alto") >= 0 || grau.indexOf("Interdicao") >= 0) {
        riscosAltos += 1;
      }
    }

    return {
      fotos: fotos,
      inconformidades: inconformidades,
      riscosAltos: riscosAltos
    };
  }

  function hasImage_(inputName) {
    const input = form.elements[inputName];
    return imageCache.has(inputName) || Boolean(input && input.files && input.files[0]);
  }

  function renderReviewSummary_() {
    const stats = getReportStats_();
    const items = [
      ["Obra", clean(form.elements.obra && form.elements.obra.value) || "-"],
      ["Local", clean(form.elements.local && form.elements.local.value) || "-"],
      ["Data da vistoria", clean(form.elements.dataVistoria && form.elements.dataVistoria.value) || "-"],
      ["Tipo de obra", clean(form.elements.tipoObra && form.elements.tipoObra.value) || "-"],
      ["Fotos da unidade", stats.fotos + " foto(s)"],
      ["Inconformidades", stats.inconformidades + " item(ns)"],
      ["Riscos altos", stats.riscosAltos + " item(ns)"]
    ];

    if (!reviewSummary) {
      return;
    }

    reviewSummary.innerHTML = "";
    items.forEach(function (item) {
      const card = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");

      card.className = "review-card";
      label.textContent = item[0];
      value.textContent = item[1];

      card.appendChild(label);
      card.appendChild(value);
      reviewSummary.appendChild(card);
    });
  }

  function renderFotoUnidadeFields() {
    const fragment = document.createDocumentFragment();

    for (let index = 1; index <= maxFotosUnidade; index += 1) {
      const number = String(index).padStart(2, "0");
      const section = document.createElement("section");
      section.className = "nonconformity-card photo-card";

      section.appendChild(createTitle("Foto tecnica " + number));
      section.appendChild(createFileField("Foto da Unidade " + number, "fotoUnidade" + number));
      section.appendChild(createTextAreaField("Descrição da Foto " + number, "descricaoFotoUnidade" + number, 3));

      fragment.appendChild(section);
    }

    fotosUnidadeContainer.innerHTML = "";
    fotosUnidadeContainer.appendChild(fragment);
  }

  function renderInconformidadeFields() {
    const fragment = document.createDocumentFragment();

    for (let index = 1; index <= maxInconformidades; index += 1) {
      const number = String(index).padStart(2, "0");
      const section = document.createElement("section");
      section.className = "nonconformity-card occurrence-card";

      section.appendChild(createTitle("Ocorrencia tecnica " + number));
      section.appendChild(createFileField("Foto da Inconformidade " + number, "fotoInconformidade" + number));
      section.appendChild(createRiskField("Grau de risco " + number, "grauRisco" + number));
      section.appendChild(createTextAreaField("Inconformidade " + number + " - Descrição Técnica", "descricaoInconformidade" + number, 4));
      section.appendChild(createTextAreaField("Inconformidade " + number + " - Solução Recomendada", "solucaoInconformidade" + number, 4));

      fragment.appendChild(section);
    }

    inconformidadesContainer.innerHTML = "";
    inconformidadesContainer.appendChild(fragment);
  }

  function createTitle(text) {
    const title = document.createElement("h3");
    title.textContent = text;
    return title;
  }

  function createFileField(labelText, name) {
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    const input = document.createElement("input");
    const hint = document.createElement("small");
    const preview = document.createElement("div");
    const hidden = document.createElement("input");

    wrapper.className = "image-upload-field";
    input.name = name;
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("accept", "image/*");
    input.dataset.imageInput = "true";

    hint.className = "upload-hint";
    hint.textContent = "No celular, selecione ou fotografe. A imagem será comprimida automaticamente antes do envio.";

    preview.className = "image-preview is-empty";
    preview.dataset.previewFor = name;
    preview.setAttribute("aria-live", "polite");

    hidden.type = "hidden";
    hidden.name = name + "Base64Jpeg";
    hidden.dataset.processedFor = name;

    label.appendChild(document.createTextNode(labelText));
    label.appendChild(input);
    wrapper.appendChild(label);
    wrapper.appendChild(hint);
    wrapper.appendChild(preview);
    wrapper.appendChild(hidden);
    return wrapper;
  }

  function createRiskField(labelText, name) {
    const label = document.createElement("label");
    const select = document.createElement("select");
    const options = [
      ["", "Escolher"],
      ["Baixo - acompanhar", "Baixo - acompanhar"],
      ["Medio - corrigir com prioridade", "Médio - corrigir com prioridade"],
      ["Alto - corrigir imediatamente", "Alto - corrigir imediatamente"],
      ["Interdicao - paralisar area", "Interdição - paralisar área"]
    ];

    select.name = name;

    options.forEach(function (option) {
      const item = document.createElement("option");
      item.value = option[0];
      item.textContent = option[1];
      select.appendChild(item);
    });

    label.appendChild(document.createTextNode(labelText));
    label.appendChild(select);
    return label;
  }

  function createTextAreaField(labelText, name, rows) {
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    const textarea = document.createElement("textarea");

    wrapper.className = "technical-text-field";
    textarea.name = name;
    textarea.rows = rows || 4;

    label.appendChild(document.createTextNode(labelText));
    label.appendChild(textarea);
    wrapper.appendChild(label);

    if (shouldOfferAiForField_(name)) {
      wrapper.appendChild(createAiFieldAction_(name, getAiKindForField_(name)));
    }

    return wrapper;
  }

  function shouldOfferAiForField_(name) {
    return (
      name.indexOf("descricaoInconformidade") === 0 ||
      name.indexOf("solucaoInconformidade") === 0
    );
  }

  function getAiKindForField_(name) {
    if (name.indexOf("solucaoInconformidade") === 0) {
      return "solution";
    }

    if (name.indexOf("descricaoFotoUnidade") === 0) {
      return "photo";
    }

    if (name === "observacoes") {
      return "general";
    }

    return "technical";
  }

  function getAiImageTextTarget_(inputName) {
    if (inputName.indexOf("fotoUnidade") === 0) {
      return "descricaoFotoUnidade" + inputName.replace("fotoUnidade", "");
    }

    if (inputName.indexOf("fotoInconformidade") === 0) {
      return "descricaoInconformidade" + inputName.replace("fotoInconformidade", "");
    }

    return "";
  }

  function getImageLabelForInput_(inputName) {
    if (inputName.indexOf("fotoUnidade") === 0) {
      return "Foto da Unidade " + inputName.replace("fotoUnidade", "");
    }

    if (inputName.indexOf("fotoInconformidade") === 0) {
      return "Foto da Inconformidade " + inputName.replace("fotoInconformidade", "");
    }

    return "Foto anexada";
  }

  function createAiFieldAction_(targetName, kind) {
    const toolbar = document.createElement("div");
    const button = document.createElement("button");

    toolbar.className = "ai-field-toolbar";
    button.type = "button";
    button.className = "mini-button ai-button";
    button.textContent = "Melhorar com IA";
    button.dataset.aiAction = "improve";
    button.dataset.aiTarget = targetName;
    button.dataset.aiKind = kind || "technical";

    toolbar.appendChild(button);
    return toolbar;
  }

  function initializeAiAssistant_() {
    if (!form) {
      return;
    }

    form.addEventListener("click", function (event) {
      const target = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
      const button = target && target.closest ? target.closest("[data-ai-action]") : null;

      if (!button) {
        return;
      }

      event.preventDefault();
      handleAiAction_(button).catch(function (error) {
        console.error(error);
        setDraftStatus_(error.message || "Não foi possível gerar a sugestão da IA.", "error");
      });
    });

    [aiRejectButton, aiCloseButton].forEach(function (button) {
      if (!button) {
        return;
      }

      button.addEventListener("click", function () {
        closeAiSuggestion_();
      });
    });

    if (aiAcceptButton) {
      aiAcceptButton.addEventListener("click", function () {
        acceptAiSuggestion_();
      });
    }
  }

  async function handleAiAction_(button) {
    const assistant = window.ObraReportAI;

    if (!assistant) {
      throw new Error("Assistente local de IA não foi carregado.");
    }

    const action = button.dataset.aiAction;
    const target = form.elements[button.dataset.aiTarget];
    const context = buildAiContext_(button);
    const original = target ? clean(target.value) : "";
    let result;

    if (!canUseAi_()) {
      return;
    }

    setAiButtonBusy_(button, true);

    try {
      if (action === "analyze-image") {
        await handleAiImageAction_(button);
        registerBillingUsage_("ai", {
          action: action,
          target: button.dataset.aiTarget || "",
          imageTarget: button.dataset.aiImageTarget || ""
        });
        return;
      }

      if (action === "conclusion") {
        result = await assistant.generateConclusion(context);
      } else if (action === "review") {
        result = await assistant.reviewReport(context);
      } else {
        result = await assistant.improveTechnicalText(original, context);
      }
    } finally {
      setAiButtonBusy_(button, false);
    }

    showAiSuggestion_(result, original, target);
    registerBillingUsage_("ai", {
      action: action || "improve",
      target: button.dataset.aiTarget || ""
    });
  }

  async function handleAiImageAction_(button) {
    const assistant = window.ObraReportAI;
    const imageInputName = button.dataset.aiImageTarget || "";
    const record = imageCache.get(imageInputName);
    const target = form.elements[button.dataset.aiTarget];
    const original = target ? clean(target.value) : "";

    if (!assistant || !assistant.analyzeImage) {
      throw new Error("Assistente visual de IA não foi carregado.");
    }

    if (!record || !record.payload || !record.payload.base64) {
      throw new Error("A foto precisa estar processada antes da análise visual.");
    }

    const context = buildAiContext_(button);
    context.imageInputName = imageInputName;
    context.imageLabel = getImageLabelForInput_(imageInputName);
    context.imageMeta = {
      fileName: record.payload.fileName,
      originalName: record.payload.originalName,
      width: record.payload.width,
      height: record.payload.height
    };

    const result = await assistant.analyzeImage(record.payload, context);
    showAiSuggestion_(result, original, target, record);
  }

  function buildAiContext_(button) {
    const report = {
      obra: getFieldValue_("obra"),
      local: getFieldValue_("local"),
      dataVistoria: getFieldValue_("dataVistoria"),
      responsavelTecnico: getFieldValue_("responsavelTecnico"),
      tipoObra: getFieldValue_("tipoObra"),
      observacoes: getFieldValue_("observacoes"),
      emailDestino: getFieldValue_("emailDestino")
    };
    const stats = getReportStats_();

    return {
      kind: button.dataset.aiKind || getAiKindForField_(button.dataset.aiTarget || ""),
      targetName: button.dataset.aiTarget || "",
      report: report,
      stats: stats,
      inconformidades: collectAiInconformities_()
    };
  }

  function collectAiInconformities_() {
    const items = [];

    for (let index = 1; index <= maxInconformidades; index += 1) {
      const number = String(index).padStart(2, "0");
      const descricao = getFieldValue_("descricaoInconformidade" + number);
      const solucao = getFieldValue_("solucaoInconformidade" + number);
      const grau = getFieldValue_("grauRisco" + number);

      if (descricao || solucao || grau) {
        items.push({
          numero: number,
          descricao: descricao,
          solucao: solucao,
          grauRisco: grau
        });
      }
    }

    return items;
  }

  function getFieldValue_(name) {
    const field = form.elements[name];
    return clean(field && field.value);
  }

  function showAiSuggestion_(result, original, target, imageRecord) {
    if (!aiSuggestionPanel || !aiOriginalText || !aiSuggestedText) {
      return;
    }

    const suggestion = result && result.suggestion ? result.suggestion : "";
    activeAiTarget = {
      field: target || null,
      suggestion: suggestion,
      imageRecord: imageRecord || null
    };

    if (aiSuggestionTitle) {
      aiSuggestionTitle.textContent = result && result.title ? result.title : "Sugestão da IA";
    }

    aiOriginalText.value = original || "Campo ainda vazio.";
    aiSuggestedText.value = suggestion;
    renderAiImageReview_(imageRecord);

    if (aiSuggestionNote) {
      aiSuggestionNote.textContent = result && result.note ? result.note : "";
    }

    aiSuggestionPanel.classList.remove("is-hidden");
    aiSuggestionPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function closeAiSuggestion_() {
    activeAiTarget = null;
    renderAiImageReview_(null);

    if (aiSuggestionPanel) {
      aiSuggestionPanel.classList.add("is-hidden");
    }
  }

  function acceptAiSuggestion_() {
    if (!activeAiTarget || !activeAiTarget.field) {
      closeAiSuggestion_();
      return;
    }

    const suggestion = aiSuggestedText ? aiSuggestedText.value : activeAiTarget.suggestion;

    if (activeAiTarget.imageRecord) {
      applyVisualAiSuggestionToReport_(activeAiTarget.field, suggestion);
    } else {
      activeAiTarget.field.value = suggestion;
      activeAiTarget.field.dispatchEvent(new Event("input", { bubbles: true }));
    }
    updateReportMetrics_();
    renderReviewSummary_();
    saveDraft_().catch(function (error) {
      console.warn("Não foi possível salvar a sugestão da IA imediatamente.", error);
    });
    setDraftStatus_("Sugestão da IA aplicada. Revise o texto antes de gerar o PDF.", "success");
    closeAiSuggestion_();
  }

  function applyVisualAiSuggestionToReport_(targetField, suggestionText) {
    const suggestion = parseVisualAiSuggestion_(suggestionText);
    const targetName = targetField && targetField.name ? targetField.name : "";
    const number = getNonconformityNumberFromField_(targetName);
    const descriptionField = number ? form.elements["descricaoInconformidade" + number] : targetField;
    const solutionField = number ? form.elements["solucaoInconformidade" + number] : null;
    const riskField = number ? form.elements["grauRisco" + number] : null;
    const observationField = form.elements.observacoes;

    appendAiTextToField_(descriptionField, buildVisualAiDescriptionText_(suggestion));
    appendAiTextToField_(solutionField, suggestion.verificacoesRecomendadas);
    appendAiTextToField_(observationField, suggestion.observacaoObrigatoria);
    applyVisualAiRisk_(riskField, suggestion.grauPreliminar);
  }

  function parseVisualAiSuggestion_(text) {
    const result = {
      elementoObservado: "",
      possivelManifestacao: "",
      evidenciasVisuais: "",
      verificacoesRecomendadas: "",
      grauPreliminar: "",
      textoSugeridoRelatorio: "",
      observacaoObrigatoria: ""
    };
    const keyMap = {
      elementoobservado: "elementoObservado",
      possivelmanifestacao: "possivelManifestacao",
      evidenciasvisuais: "evidenciasVisuais",
      verificacoesrecomendadas: "verificacoesRecomendadas",
      graupreliminar: "grauPreliminar",
      textosugeridopararelatorio: "textoSugeridoRelatorio",
      observacaoobrigatoria: "observacaoObrigatoria"
    };
    let currentKey = "";

    String(text || "").split(/\r?\n/).forEach(function (line) {
      const match = line.match(/^([^:]{3,90}):\s*(.*)$/);

      if (match) {
        currentKey = keyMap[normalizeAiSuggestionKey_(match[1])] || "";
        if (currentKey) {
          result[currentKey] = appendTextBlock_(result[currentKey], clean(match[2]));
        }
        return;
      }

      if (currentKey && clean(line)) {
        result[currentKey] = appendTextBlock_(result[currentKey], clean(line));
      }
    });

    if (!result.textoSugeridoRelatorio) {
      result.textoSugeridoRelatorio = clean(text);
    }

    return result;
  }

  function normalizeAiSuggestionKey_(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function appendTextBlock_(current, next) {
    const safeNext = clean(next);
    return safeNext ? (current ? current + "\n" + safeNext : safeNext) : (current || "");
  }

  function buildVisualAiDescriptionText_(suggestion) {
    const lines = [];

    if (suggestion.possivelManifestacao) {
      lines.push("Possível manifestação: " + suggestion.possivelManifestacao);
    }

    if (suggestion.textoSugeridoRelatorio) {
      lines.push(suggestion.textoSugeridoRelatorio);
    }

    if (suggestion.evidenciasVisuais) {
      lines.push("Evidências visuais: " + suggestion.evidenciasVisuais);
    }

    return lines.join("\n");
  }

  function cleanMultiline_(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function appendAiTextToField_(field, text) {
    const nextText = cleanMultiline_(text);

    if (!field || !nextText) {
      return;
    }

    const current = cleanMultiline_(field.value);
    field.value = current
      ? current + "\n\n--- Sugestão da IA ---\n" + nextText
      : nextText;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function applyVisualAiRisk_(field, value) {
    if (!field || clean(field.value)) {
      return;
    }

    const normalized = normalizeAiSuggestionKey_(value);

    if (normalized.indexOf("critico") >= 0 || normalized.indexOf("alto") >= 0) {
      field.value = "Alto - corrigir imediatamente";
    } else if (normalized.indexOf("atencao") >= 0 || normalized.indexOf("medio") >= 0) {
      field.value = "Medio - corrigir com prioridade";
    } else if (normalized.indexOf("baixo") >= 0) {
      field.value = "Baixo - acompanhar";
    }

    if (field.value) {
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function getNonconformityNumberFromField_(name) {
    const match = String(name || "").match(/(?:descricaoInconformidade|solucaoInconformidade|grauRisco|fotoInconformidade)(\d{2})/);
    return match ? match[1] : "";
  }

  function setAiButtonBusy_(button, isBusy) {
    if (!button) {
      return;
    }

    if (isBusy) {
      button.dataset.originalText = button.textContent;
      button.textContent = "Gerando sugestão...";
      button.disabled = true;
      return;
    }

    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }

  function renderAiImageReview_(record) {
    if (!aiImageReview || !aiReviewedImage || !aiReviewedImageMeta) {
      return;
    }

    if (!record || !record.previewDataUrl || !record.payload) {
      aiImageReview.classList.add("is-hidden");
      aiReviewedImage.removeAttribute("src");
      aiReviewedImageMeta.textContent = "";
      return;
    }

    aiReviewedImage.src = record.previewDataUrl;
    aiReviewedImageMeta.textContent =
      (record.payload.originalName || record.payload.fileName || "Foto") +
      " · " +
      record.payload.width +
      "x" +
      record.payload.height +
      " px";
    aiImageReview.classList.remove("is-hidden");
  }

  function initializeDraft_() {
    form.addEventListener("input", function (event) {
      if (event.target && event.target.type !== "file") {
        setLocalStatus_("Alterações não salvas", "info");
        scheduleDraftSave_();
        updateReportMetrics_();
      }
    });

    form.addEventListener("change", async function (event) {
      const target = event.target;

      if (!target) {
        return;
      }

      setLocalStatus_("Alterações não salvas", "info");

      if (target.type === "file" && target.dataset.imageInput === "true") {
        await handleFileInputChange_(target);
        updateReportMetrics_();
        return;
      }

      scheduleDraftSave_();
      updateReportMetrics_();
    });

    // A restauração acontece ao abrir um relatório no fluxo SaaS.
  }

  async function handleFileInputChange_(input) {
    const file = input.files && input.files[0] ? input.files[0] : null;
    const meta = getImageInputMeta_(input);
    const previewElement = getPreviewElement_(input.name);
    const hiddenField = getHiddenImageField_(input.name);

    if (!file || !meta) {
      imageCache.delete(input.name);
      if (hiddenField) {
        hiddenField.value = "";
      }
      renderImageEmpty_(input.name);
      scheduleDraftSave_();
      return;
    }

    if (!canAddPhotoToReport_(input.name)) {
      input.value = "";
      return;
    }

    const record = await enqueueImageProcessing_(function () {
      return processImageInput(input, previewElement, hiddenField);
    });

    await saveDraft_();

    if (record) {
      setDraftStatus_("Rascunho salvo automaticamente.", "success");
    }
  }

  function enqueueImageProcessing_(task) {
    const nextTask = imageProcessingQueue
      .catch(function () {
        return null;
      })
      .then(task);

    imageProcessingQueue = nextTask;
    return nextTask;
  }

  function getImageInputMeta_(input) {
    if (!input || !input.name) {
      return null;
    }

    if (input.name.indexOf("fotoUnidade") === 0) {
      const number = input.name.replace("fotoUnidade", "");
      return {
        number: number,
        prefix: "UNIDADE-" + number,
        label: "Foto da Unidade " + number
      };
    }

    if (input.name.indexOf("fotoInconformidade") === 0) {
      const number = input.name.replace("fotoInconformidade", "");
      return {
        number: number,
        prefix: "RQO-" + number,
        label: "Inconformidade " + number
      };
    }

    return null;
  }

  async function getPreparedImage_(input, prefix, label) {
    if (!input) {
      return null;
    }

    const file = input.files && input.files[0] ? input.files[0] : null;
    const cached = imageCache.get(input.name);

    if (!file && cached) {
      return cached.payload;
    }

    if (!file) {
      return null;
    }

    const signature = getFileSignature_(file);
    if (cached && cached.signature === signature) {
      return cached.payload;
    }

    try {
      renderImageStatus_(input.name, "Otimizando " + label + "...");
      const record = await imageFileToBase64Jpeg(file, prefix);
      imageCache.set(input.name, record);
      renderImagePreview_(input.name, record);
      await saveDraft_();
      return record.payload;
    } catch (error) {
      renderImageError_(input.name, error.message || "Imagem inválida.");
      input.value = "";
      throw error;
    }
  }

  async function processImageInput(inputElement, previewElement, hiddenField) {
    const file = inputElement.files && inputElement.files[0] ? inputElement.files[0] : null;
    const meta = getImageInputMeta_(inputElement);

    if (!file || !meta) {
      return null;
    }

    try {
      showImageStatus("Processando e comprimindo imagem...", "info", previewElement);
      const record = await imageFileToBase64Jpeg(file, meta.prefix);
      imageCache.set(inputElement.name, record);

      if (hiddenField) {
        hiddenField.value = record.payload.base64;
      }

      renderImagePreview_(inputElement.name, record);
      return record;
    } catch (error) {
      imageCache.delete(inputElement.name);
      inputElement.value = "";

      if (hiddenField) {
        hiddenField.value = "";
      }

      showImageStatus(error.message || "Não foi possível processar a imagem. Se estiver no celular, tente tirar a foto novamente em JPG.", "error", previewElement);
      return null;
    }
  }

  async function imageFileToBase64Jpeg(file, prefix) {
    const compressed = await compressImageFile(file);
    const base64 = await blobToBase64_(compressed.blob);

    return {
      signature: getFileSignature_(file),
      originalSize: file.size || 0,
      compressedSize: compressed.blob.size || 0,
      previewDataUrl: "data:image/jpeg;base64," + base64,
      updatedAt: new Date().toISOString(),
      payload: {
        originalName: file.name || "foto.jpg",
        fileName: safeFileName(prefix + "-" + String(file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg"),
        mimeType: "image/jpeg",
        base64: base64,
        width: compressed.width,
        height: compressed.height
      }
    };
  }

  async function compressImageFile(file) {
    validateImageFile_(file);

    const sourceImage = await loadImage_(file);
    const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
    const sourceHeight = sourceImage.naturalHeight || sourceImage.height;

    if (!sourceWidth || !sourceHeight) {
      throw new Error("Não foi possível ler o tamanho da imagem.");
    }

    const maxSide = config.maxImageWidth || 1280;
    const maxPixels = config.maxImagePixels || 1638400;
    const sideRatio = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const pixelRatio = Math.min(1, Math.sqrt(maxPixels / (sourceWidth * sourceHeight)));
    const ratio = Math.min(sideRatio, pixelRatio);
    const canvas = document.createElement("canvas");
    const width = Math.max(1, Math.round(sourceWidth * ratio));
    const height = Math.max(1, Math.round(sourceHeight * ratio));

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("O navegador não conseguiu preparar a imagem.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceImage, 0, 0, width, height);
    if (typeof sourceImage.close === "function") {
      sourceImage.close();
    }

    return {
      blob: await canvasToBlob_(canvas, "image/jpeg", config.jpegQuality || 0.72),
      width: width,
      height: height
    };
  }

  async function processImageFile_(file, prefix) {
    return imageFileToBase64Jpeg(file, prefix);
  }

  function validateImageFile_(file) {
    const extension = getFileExtension_(file.name);

    if (heicExtensions.has(extension) || file.type === "image/heic" || file.type === "image/heif") {
      throw new Error("Esta foto parece estar em HEIC/HEIF. No iPhone, use a câmera em 'Mais Compatível' ou envie uma imagem JPG/PNG.");
    }

    if (file.type && allowedTypes.has(file.type)) {
      return;
    }

    if (!file.type && allowedExtensions.has(extension)) {
      return;
    }

    throw new Error("Arquivo não permitido. Use JPG, PNG ou WEBP.");
  }

  async function loadImage_(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (error) {
        console.warn("createImageBitmap falhou; tentando ObjectURL.", error);
      }
    }

    try {
      return await loadImageWithObjectUrl_(file);
    } catch (error) {
      console.warn("ObjectURL falhou; tentando DataURL.", error);
      return loadImageWithDataUrl_(file);
    }
  }

  function loadImageWithObjectUrl_(file) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = function () {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Falha ao abrir a imagem pelo navegador."));
      };

      image.src = objectUrl;
    });
  }

  async function loadImageWithDataUrl_(file) {
    const dataUrl = await fileToDataUrl_(file);

    return new Promise(function (resolve, reject) {
      const image = new Image();

      image.onload = function () {
        resolve(image);
      };

      image.onerror = function () {
        reject(new Error("Não foi possível abrir esta imagem. No celular, tente tirar a foto novamente ou selecione uma imagem JPG/PNG."));
      };

      image.src = dataUrl;
    });
  }

  function fileToDataUrl_(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();

      reader.onerror = function () {
        reject(new Error("Não foi possível ler o arquivo da imagem no celular. Tente tirar a foto novamente ou escolha outra imagem."));
      };

      reader.onload = function () {
        resolve(String(reader.result || ""));
      };

      reader.readAsDataURL(file);
    });
  }

  function canvasToBlob_(canvas, mimeType, quality) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Não foi possível comprimir a imagem."));
          }
        }, mimeType, quality);
        return;
      }

      try {
        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve(dataUrlToBlob_(dataUrl));
      } catch (error) {
        reject(error);
      }
    });
  }

  function dataUrlToBlob_(dataUrl) {
    const parts = dataUrl.split(",");
    const header = parts[0];
    const base64 = parts[1];
    const mime = header.match(/data:(.*?);base64/)[1];
    const bytes = atob(base64);
    const array = new Uint8Array(bytes.length);

    for (let index = 0; index < bytes.length; index += 1) {
      array[index] = bytes.charCodeAt(index);
    }

    return new Blob([array], { type: mime });
  }

  function blobToBase64_(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();

      reader.onerror = function () {
        reject(new Error("Não foi possível ler a imagem comprimida."));
      };

      reader.onload = function () {
        resolve(String(reader.result).split(",")[1]);
      };

      reader.readAsDataURL(blob);
    });
  }

  function showImageStatus(message, type, previewElement) {
    const target = previewElement || null;

    if (!target) {
      setLog(message, type === "error" ? "error" : "");
      return;
    }

    target.className = "image-preview" + (type ? " " + type : "");
    target.innerHTML = "";
    target.appendChild(createPreviewMessage_(message));
  }

  function renderImageStatus_(inputName, message) {
    const preview = getPreviewElement_(inputName);
    if (!preview) {
      return;
    }

    showImageStatus(message, "info", preview);
  }

  function renderImageEmpty_(inputName) {
    const preview = getPreviewElement_(inputName);
    if (!preview) {
      return;
    }

    preview.className = "image-preview is-empty";
    preview.innerHTML = "";
  }

  function renderImageError_(inputName, message) {
    const preview = getPreviewElement_(inputName);
    if (!preview) {
      return;
    }

    showImageStatus(message, "error", preview);
  }

  function renderImagePreview_(inputName, record) {
    const preview = getPreviewElement_(inputName);
    const image = document.createElement("img");
    const meta = document.createElement("p");
    const toolbar = document.createElement("div");
    const aiButton = document.createElement("button");
    const targetName = getAiImageTextTarget_(inputName);

    if (!preview) {
      return;
    }

    image.src = record.previewDataUrl;
    image.alt = "Prévia da imagem selecionada";
    image.loading = "lazy";

    meta.textContent =
      "Imagem pronta para envio. Otimizada: " +
      record.payload.width +
      "x" +
      record.payload.height +
      " px · " +
      formatBytes_(record.originalSize) +
      " → " +
      formatBytes_(record.compressedSize);

    preview.className = "image-preview ready";
    preview.innerHTML = "";
    preview.appendChild(image);
    preview.appendChild(meta);

    if (targetName) {
      toolbar.className = "ai-field-toolbar";
      aiButton.type = "button";
      aiButton.className = "mini-button ai-button";
      aiButton.textContent = "Analisar foto com IA";
      aiButton.dataset.aiAction = "analyze-image";
      aiButton.dataset.aiImageTarget = inputName;
      aiButton.dataset.aiTarget = targetName;
      aiButton.dataset.aiKind = inputName.indexOf("fotoInconformidade") === 0 ? "visual-nonconformity" : "visual-photo";
      toolbar.appendChild(aiButton);
      preview.appendChild(toolbar);
    }
  }

  function clearAllImagePreviews_() {
    Array.from(document.querySelectorAll("[data-preview-for]")).forEach(function (preview) {
      preview.className = "image-preview is-empty";
      preview.innerHTML = "";
    });
  }

  function createPreviewMessage_(message) {
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    return paragraph;
  }

  function getPreviewElement_(inputName) {
    return document.querySelector("[data-preview-for='" + inputName + "']");
  }

  function getHiddenImageField_(inputName) {
    return document.querySelector("[data-processed-for='" + inputName + "']");
  }

  function scheduleDraftSave_() {
    window.clearTimeout(draftSaveTimer);
    draftSaveTimer = window.setTimeout(function () {
      saveDraft_().catch(function (error) {
        console.warn("Não foi possível salvar o rascunho.", error);
      });
    }, 500);
  }

  async function saveDraft_() {
    const draft = buildDraft_();
    saveDraftTextFallback_(draft);
    await putDraftRecord_(draft);
    saveActiveReportDraft_(draft);
    scheduleCloudSync_(draft);
    setDraftStatus_("Rascunho salvo automaticamente.", "success");
  }

  function buildDraft_() {
    const values = {};
    const images = {};

    Array.from(form.elements).forEach(function (field) {
      if (
        !field.name ||
        field.type === "file" ||
        field.type === "hidden" ||
        field.type === "submit" ||
        field.tagName === "BUTTON"
      ) {
        return;
      }

      values[field.name] = field.value;
    });

    imageCache.forEach(function (record, inputName) {
      images[inputName] = record;
    });

    return {
      id: getActiveDraftId_(),
      version: 2,
      updatedAt: new Date().toISOString(),
      values: values,
      images: images
    };
  }

  async function restoreDraft_() {
    let draft = await getDraftRecord_();

    if (!draft && activeReportId && findReport_(activeReportId)) {
      draft = findReport_(activeReportId).draft;
    }

    if (!draft || !draft.values) {
      return;
    }

    applyDraftToForm_(draft);

    showReportPanel_();
    setDraftStatus_("Rascunho restaurado automaticamente.", "success");
  }

  async function clearDraft_() {
    await deleteDraftRecord_();
    setDraftStatus_("");
  }

  function openDraftDb_() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB indisponível."));
        return;
      }

      const request = window.indexedDB.open("icaro-amaral-relatorios", 1);

      request.onerror = function () {
        reject(request.error);
      };

      request.onupgradeneeded = function () {
        const db = request.result;

        if (!db.objectStoreNames.contains("drafts")) {
          db.createObjectStore("drafts", { keyPath: "id" });
        }
      };

      request.onsuccess = function () {
        resolve(request.result);
      };
    });
  }

  function getActiveDraftId_() {
    return activeReportId ? getDraftIdForReport_(activeReportId) : defaultDraftId;
  }

  function getDraftIdForReport_(reportId) {
    return defaultDraftId + "-" + reportId;
  }

  async function putDraftRecord_(record) {
    return putDraftRecordById_(record.id || getActiveDraftId_(), record);
  }

  async function putDraftRecordById_(draftId, record) {
    let db;

    try {
      db = await openDraftDb_();
    } catch (error) {
      saveDraftFallback_(record);
      return;
    }

    return new Promise(function (resolve, reject) {
      const transaction = db.transaction("drafts", "readwrite");
      const store = transaction.objectStore("drafts");
      const copy = Object.assign({}, record, { id: draftId });
      const request = store.put(copy);

      request.onerror = function () {
        reject(request.error);
      };

      transaction.oncomplete = function () {
        db.close();
        resolve();
      };

      transaction.onerror = function () {
        db.close();
        reject(transaction.error);
      };
    });
  }

  async function getDraftRecord_() {
    let db;

    try {
      db = await openDraftDb_();
    } catch (error) {
      return getDraftFallback_();
    }

    return new Promise(function (resolve, reject) {
      const transaction = db.transaction("drafts", "readonly");
      const store = transaction.objectStore("drafts");
      const request = store.get(getActiveDraftId_());

      request.onerror = function () {
        reject(request.error);
      };

      request.onsuccess = function () {
        db.close();
        resolve(request.result || null);
      };
    });
  }

  async function deleteDraftRecord_() {
    let db;

    window.localStorage.removeItem(getActiveDraftId_());

    try {
      db = await openDraftDb_();
    } catch (error) {
      return;
    }

    return new Promise(function (resolve, reject) {
      const transaction = db.transaction("drafts", "readwrite");
      const store = transaction.objectStore("drafts");
      const request = store.delete(getActiveDraftId_());

      request.onerror = function () {
        reject(request.error);
      };

      transaction.oncomplete = function () {
        db.close();
        resolve();
      };

      transaction.onerror = function () {
        db.close();
        reject(transaction.error);
      };
    });
  }

  function saveDraftFallback_(record) {
    saveDraftTextFallback_(record);
    setDraftStatus_("Rascunho de texto salvo. As imagens dependem do navegador permitir IndexedDB.", "success");
  }

  function saveDraftTextFallback_(record) {
    const textOnlyRecord = {
      id: record.id,
      version: record.version,
      updatedAt: record.updatedAt,
      values: record.values,
      images: {}
    };

    try {
      window.localStorage.setItem(getActiveDraftId_(), JSON.stringify(textOnlyRecord));
    } catch (error) {
      console.warn("Fallback de rascunho indisponível.", error);
    }
  }

  function getDraftFallback_() {
    try {
      const raw = window.localStorage.getItem(getActiveDraftId_());
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Não foi possível ler o rascunho local.", error);
      return null;
    }
  }

  function getFileSignature_(file) {
    return [file.name, file.size, file.lastModified].join("|");
  }

  function getFileExtension_(name) {
    const parts = String(name || "").toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function formatBytes_(bytes) {
    if (!bytes) {
      return "0 KB";
    }

    if (bytes < 1024 * 1024) {
      return Math.max(1, Math.round(bytes / 1024)) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
  }

  function safeFileName(name) {
    return String(name || "foto.jpg")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) || "foto.jpg";
  }

  window.StockAiObrasEngine = Object.assign({}, window.StockAiObrasEngine || {}, {
    isStockAiCompositionRequest: isStockAiCompositionRequest_,
    parseStockAiCompositionRequest: parseStockAiCompositionRequest,
    buildStockAiCompositionAnswerFromMessage: buildStockAiCompositionAnswerFromMessage,
    answerStockIaQuestion: answerStockIaQuestion_,
    calculateStockAiPredictedConsumption: calculateStockAiPredictedConsumption
  });
})();
