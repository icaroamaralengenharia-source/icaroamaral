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
  const stockMasterRows = document.getElementById("stockMasterRows");
  const stockUnlinkedRows = document.getElementById("stockUnlinkedRows");
  const stockManualMovementsRows = document.getElementById("stockManualMovementsRows");
  const stockIaRows = document.getElementById("stockIaRows");
  const stockIaMovements = document.getElementById("stockIaMovements");
  const stockIaInsight = document.getElementById("stockIaInsight");
  const stockIaOperationalInsight = document.getElementById("stockIaOperationalInsight");
  const stockIaPeriodControls = document.getElementById("stockIaPeriodControls");
  const stockIaAlertsList = document.getElementById("stockIaAlertsList");
  const stockPurchasePanelNote = document.getElementById("stockPurchasePanelNote");
  const stockPurchaseSummaryCards = document.getElementById("stockPurchaseSummaryCards");
  const stockPurchaseRows = document.getElementById("stockPurchaseRows");
  const stockTopMaterialsRows = document.getElementById("stockTopMaterialsRows");
  const stockConsumptionByWorkRows = document.getElementById("stockConsumptionByWorkRows");
  const stockIaQuestionForm = document.getElementById("stockIaQuestionForm");
  const stockIaQuestionInput = document.getElementById("stockIaQuestionInput");
  const stockIaQuestionAnswer = document.getElementById("stockIaQuestionAnswer");
  const stockIaActionMessage = document.getElementById("stockIaActionMessage");
  const stockIaModal = document.getElementById("stockIaModal");
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
  let dailyLogSearchTerm = "";
  let compositionDraft = createEmptyCompositionDraft_();
  let pendingHomeAction = "";
  let localAccessGrantedInMemory = false;
  let stockIaCurrentPeriod = "30d";
  let stockIaLastAnswer = "";
  let dailyLogEstimateDraft = {
    items: [],
    audit: [],
    missing: [],
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

  function ensureCompositionLibrary_(items) {
    const current = Array.isArray(items) ? items : [];
    const defaultById = {};

    getDefaultCompositions_().forEach(function (composition) {
      defaultById[composition.id] = composition;
    });

    const normalized = current
      .filter(Boolean)
      .map(normalizeComposition_);
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
      createDefaultComposition_("std_alvenaria", "Alvenaria", "m²", 5, [
        ["Bloco cerâmico", 13, "un", ""],
        ["Cimento", 0.1, "saco", ""],
        ["Areia", 0.018, "m³", ""]
      ]),
      createDefaultComposition_("std_chapisco", "Chapisco", "m²", 5, [
        ["Cimento", 0.05, "saco", ""],
        ["Areia", 0.006, "m³", ""]
      ]),
      createDefaultComposition_("std_reboco", "Reboco", "m²", 5, [
        ["Cimento", 0.08, "saco", ""],
        ["Areia", 0.02, "m³", ""]
      ]),
      createDefaultComposition_("std_emboco", "Emboço", "m²", 5, [
        ["Cimento", 0.07, "saco", ""],
        ["Areia", 0.018, "m³", ""]
      ]),
      createDefaultComposition_("std_contrapiso", "Contrapiso", "m²", 5, [
        ["Cimento", 0.12, "saco", ""],
        ["Areia", 0.025, "m³", ""]
      ]),
      createDefaultComposition_("std_piso", "Piso", "m²", 3, [
        ["Piso cerâmico", 1.05, "m²", ""],
        ["Argamassa colante", 0.25, "saco", ""],
        ["Rejunte", 0.2, "kg", ""]
      ]),
      createDefaultComposition_("std_revestimento", "Revestimento", "m²", 3, [
        ["Revestimento cerâmico", 1.05, "m²", ""],
        ["Argamassa colante", 0.25, "saco", ""],
        ["Rejunte", 0.18, "kg", ""]
      ]),
      createDefaultComposition_("std_pintura", "Pintura", "m²", 5, [
        ["Tinta", 0.12, "litro", ""],
        ["Massa corrida", 0.18, "kg", ""]
      ]),
      createDefaultComposition_("std_esgoto", "Tubulação de esgoto", "m", 3, [
        ["Tubo PVC esgoto", 1.03, "m", ""],
        ["Conexões PVC", 0.25, "un", ""]
      ]),
      createDefaultComposition_("std_agua", "Tubulação de água", "m", 3, [
        ["Tubo PVC água", 1.03, "m", ""],
        ["Conexões PVC", 0.2, "un", ""]
      ]),
      createDefaultComposition_("std_eletroduto", "Eletroduto", "m", 3, [
        ["Eletroduto", 1.03, "m", ""],
        ["Conexões elétricas", 0.15, "un", ""]
      ])
    ];
  }

  function createDefaultComposition_(id, service, productionUnit, lossPercent, materials) {
    return {
      id: id,
      service: service,
      productionUnit: productionUnit,
      lossPercent: lossPercent,
      note: "Composição padrão editável do ObraReport.",
      source: "ObraReport",
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
    copy.productionUnit = clean(copy.productionUnit) || "m²";
    copy.lossPercent = parseNumber_(copy.lossPercent);
    copy.note = clean(copy.note);
    copy.source = clean(copy.source) || "Personalizada";
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

  function initializeSaas_() {
    bindSaasEvents_();

    if (!hasLocalAccessSession_()) {
      if (isRestrictedRouteHash_()) {
        setCloudStatus_("Informe a senha para acessar a area interna.", "info");
        setLoginAccessStatus_("Informe a senha para acessar a area interna.", "info");
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
      setCloudStatus_("Informe a senha para acessar a area interna.", "info");
      setLoginAccessStatus_("Informe a senha para acessar a area interna.", "info");
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
        const questionButton = target && target.closest ? target.closest("[data-stock-question]") : null;
        const actionButton = target && target.closest ? target.closest("[data-stock-action]") : null;

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

    window.addEventListener("hashchange", function () {
      if (currentUser && hasLocalAccessSession_() && window.location.hash.indexOf("#app/") === 0) {
        showDashboardPanel_(getRouteFromHash_());
        return;
      }

      if (isRestrictedRouteHash_() && !hasLocalAccessSession_()) {
        setCloudStatus_("Informe a senha para acessar a area interna.", "info");
        setLoginAccessStatus_("Informe a senha para acessar a area interna.", "info");
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
    const floatButton = document.querySelector(".elo-float-button");
    const panel = document.querySelector(".elo-panel");
    const input = document.querySelector(".elo-input");
    const sendButton = document.querySelector(".elo-send-button");

    if (!floatButton || !input || !sendButton) {
      setHomeActionStatus_("O Elo será aberto dentro do sistema. Acesse o ObraReport para perguntar: " + cleanQuestion);
      return;
    }

    if (panel && panel.classList.contains("is-hidden")) {
      floatButton.click();
    }

    input.value = cleanQuestion;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    sendButton.click();
    setHomeActionStatus_("Pergunta enviada ao Elo Assistente.");
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
      "🏗️ *OBRAREPORT — IMPLANTAÇÃO ASSISTIDA*",
      "",
      "Olá. Acabei de visualizar o PDF da Obra Exemplo do ObraReport e gostaria de implantar o sistema na minha empresa.",
      "",
      "━━━━━━━━━━━━━━",
      "",
      "📌 *Interesse*",
      "• Quero usar o ObraReport para organizar relatórios, RDOs, materiais e documentos técnicos da obra.",
      "",
      "👤 *Meus dados*",
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
    return getAllRoutes_().indexOf(value) >= 0 ? value : getDefaultRouteForRole_();
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
    return ["dashboard", "clientes", "obras", "relatorios", "diario", "stock-ia", "planos", "administracao", "cliente", "minha-obra", "meus-relatorios", "meus-rdos", "documentos", "suporte"];
  }

  function getAdminRoutes_() {
    return ["dashboard", "clientes", "obras", "relatorios", "diario", "stock-ia", "planos", "administracao"];
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
      setCloudStatus_("Informe a senha para acessar a area interna.", "info");
      setLoginAccessStatus_("Informe a senha para acessar a area interna.", "info");
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
      return composition.source !== "ObraReport";
    });

    appState.compositions = getDefaultCompositions_().concat(custom);
    saveLocalData({ syncCloud: true });
    resetCompositionForm_();
    renderCompositionModule_();
    setDailyLogStatus_("Composições padrão ObraReport restauradas e enviadas para sincronização.", "success");
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

      if (composition.source !== "ObraReport") {
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

    if (button.dataset.compositionAction === "remove" && composition.source !== "ObraReport") {
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
      editable: false
    };
    renderEstimatePanel_();
  }

  function calculateDailyLogEstimatedMaterials_() {
    if (!dailyLogDraft.productions.length) {
      setDailyLogStatus_("Adicione produção executada antes de calcular materiais estimados.", "error");
      return;
    }

    const result = buildEstimatedMaterialsForProductions_(dailyLogDraft.productions);
    dailyLogEstimateDraft = {
      items: result.items,
      audit: result.audit,
      missing: result.missing,
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

    productions.forEach(function (production) {
      const composition = findCompositionForProduction_(production);
      const productionQuantity = parseNumber_(production.quantity);

      if (!composition || productionQuantity <= 0) {
        missing.push(production);
        return;
      }

      const lossMultiplier = 1 + (parseNumber_(composition.lossPercent) / 100);
      (composition.materials || []).forEach(function (material) {
        const estimatedQuantity = productionQuantity * parseNumber_(material.quantityPerUnit) * lossMultiplier;
        const key = normalizeCompositionKey_(material.name) + "|" + (material.unit || "un");

        if (!grouped[key]) {
          grouped[key] = {
            id: createId_("est"),
            name: material.name,
            quantity: 0,
            unit: material.unit || "un",
            note: "Consumo calculado por composição estimada. Revise antes de aplicar.",
            sources: []
          };
        }

        grouped[key].quantity += estimatedQuantity;
        grouped[key].sources.push(
          production.service + " " + formatQuantity_(productionQuantity) + " " + (production.unit || composition.productionUnit)
        );
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
      audit: buildEstimatedConsumptionAudit_(items, registeredMaterials)
    };
  }

  function findCompositionForProduction_(production) {
    const serviceKey = normalizeCompositionKey_(production.service);
    const unitKey = normalizeUnitKey_(production.unit);
    const compositions = ensureCompositionLibrary_(appState.compositions).filter(function (composition) {
      return normalizeCompositionKey_(composition.service) === serviceKey;
    });

    if (!compositions.length) {
      return null;
    }

    return compositions.find(function (composition) {
      return composition.source !== "ObraReport" && normalizeUnitKey_(composition.productionUnit) === unitKey;
    }) || compositions.find(function (composition) {
      return normalizeUnitKey_(composition.productionUnit) === unitKey;
    }) || compositions.find(function (composition) {
      return composition.source !== "ObraReport";
    }) || compositions[0];
  }

  function buildEstimatedConsumptionAudit_(estimatedItems, registeredMaterials) {
    const registered = {};

    (registeredMaterials || dailyLogDraft.materials).forEach(function (material) {
      const key = normalizeCompositionKey_(material.name) + "|" + (material.unit || "un");

      if (!registered[key]) {
        registered[key] = {
          quantity: 0,
          unit: material.unit || "un"
        };
      }

      registered[key].quantity += parseNumber_(material.quantity);
    });

    return estimatedItems.map(function (item) {
      const key = normalizeCompositionKey_(item.name) + "|" + (item.unit || "un");
      const registeredQuantity = registered[key] ? registered[key].quantity : 0;

      return {
        name: item.name,
        unit: item.unit,
        estimated: item.quantity,
        registered: roundQuantity_(registeredQuantity),
        difference: roundQuantity_(registeredQuantity - item.quantity)
      };
    });
  }

  function renderEstimatePanel_() {
    if (!dailyLogEstimatePanel) {
      return;
    }

    const items = dailyLogEstimateDraft.items || [];
    const missing = dailyLogEstimateDraft.missing || [];

    dailyLogEstimatePanel.innerHTML = "";
    if (!items.length && !missing.length) {
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
    warning.textContent = "Consumo calculado por composição estimada. Revise antes de aplicar.";
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
          " · " + formatAuditDifference_(item),
        "",
        []
      ));
    });

    return list;
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

    if (action === "apply") {
      applyEstimatedMaterialsToDailyLog_();
    }
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

    if (difference < 0) {
      return "Falta registrar: " + formatQuantity_(Math.abs(difference)) + unit;
    }

    if (difference > 0) {
      return "Excedente registrado: " + formatQuantity_(difference) + unit;
    }

    return "Sem diferença";
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
    clearDailyLogEstimate_();

    if (dailyLogForm.elements.date) {
      dailyLogForm.elements.date.value = new Date().toISOString().slice(0, 10);
    }

    if (dailyLogForm.elements.responsible && currentUser) {
      dailyLogForm.elements.responsible.value = currentUser.name || "";
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

  function renderStockIaPanel_(dailyLogs) {
    const movements = buildStockMovementsFromDailyLogs_(dailyLogs);
    const balances = buildStockBalanceFromMovements_(movements);
    const summary = buildStockSummaryFromBalances_(balances, movements);

    renderStockIaSummaryCards_(summary);
    renderStockIaRows_(balances);
    renderStockIaMovements_(movements);

    if (stockIaInsight) {
      stockIaInsight.textContent = buildStockIaInsightFromDailyLogs_(balances, movements);
    }
  }

  function renderStockIaSummaryCards_(summary) {
    if (!stockIaSummaryCards) {
      return;
    }

    stockIaSummaryCards.innerHTML = "";
    [
      ["Materiais identificados", summary.materialCount],
      ["Consumo registrado", summary.movementCount + " movimento(s)"],
      ["Custo total consumido", formatCurrency_(summary.totalCost)],
      ["Diarios com materiais", summary.dailyLogCount]
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

  function renderStockIaRows_(balances) {
    if (!stockIaRows) {
      return;
    }

    stockIaRows.innerHTML = "";
    if (!balances.length) {
      appendStockIaEmptyRow_(stockIaRows, 7, "Nenhum material registrado nos RDOs.");
      return;
    }

    balances.forEach(function (balance) {
      const row = document.createElement("tr");
      appendStockIaCell_(row, balance.name);
      appendStockIaCell_(row, balance.unit);
      appendStockIaCell_(row, formatQuantity_(balance.totalQuantity));
      appendStockIaCell_(row, formatCurrency_(balance.totalCost));
      appendStockIaCell_(row, String(balance.dailyLogIds.length));
      appendStockIaCell_(row, summarizeStockIaList_(balance.workNames, 3));
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
      appendStockIaEmptyRow_(stockIaMovements, 8, "Nenhum movimento derivado encontrado.");
      return;
    }

    movements.slice(0, 80).forEach(function (movement) {
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
      const item = state.items.find(function (candidate) {
        return candidate.id === movement.stockItemId;
      });

      if (!item) {
        return;
      }

      movements.push(Object.assign({}, movement, {
        source: "manual",
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

    return state.items.map(function (item) {
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

    if (minimumStock > 0 && realBalance <= minimumStock) {
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
    renderStockPeriodControls_();
    renderStockOperationalAlerts_(alerts);
    renderStockPurchasePanel_(purchaseSuggestions, purchaseSummary);
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
      ["Itens negativos", summary.negativeCount],
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
      appendStockIaEmptyRow_(stockMasterRows, 11, "Nenhum item mestre cadastrado.");
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

    if (!state.manualMovements.length) {
      appendStockIaEmptyRow_(stockManualMovementsRows, 8, "Nenhuma movimentacao manual registrada.");
      return;
    }

    state.manualMovements.slice().sort(function (a, b) {
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
      appendStockIaCell_(row, movement.notes || "-");
      stockManualMovementsRows.appendChild(row);
    });
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
      appendStockIaEmptyRow_(stockIaRows, 7, "Nenhum material registrado nos RDOs.");
      return;
    }
  }

  function renderStockIaMovements_(movements) {
    if (!stockIaMovements) {
      return;
    }

    stockIaMovements.innerHTML = "";
    if (!movements.length) {
      appendStockIaEmptyRow_(stockIaMovements, 8, "Nenhum movimento derivado encontrado.");
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
    } else if (type === "movement") {
      appendStockMovementFields_(form, state, item, payload.movementType);
    } else if (type === "delete-item") {
      appendStockIaNotice_(form, "Confirma excluir este item e suas movimentacoes locais?");
    } else if (type === "create-from-rdo") {
      appendStockItemFields_(form, null, rdoEntry);
    } else if (type === "link-rdo") {
      appendStockLinkFields_(form, state, rdoEntry);
    }

    appendHiddenField_(form, "itemId", payload.itemId || "");
    appendHiddenField_(form, "rdoMaterialKey", payload.rdoMaterialKey || "");
    appendHiddenField_(form, "movementType", payload.movementType || "");
    appendStockIaFormActions_(form, type === "delete-item" ? "Excluir" : "Salvar");
    card.appendChild(form);
    content.appendChild(card);
    stockIaModal.appendChild(content);
  }

  function getStockIaModalTitle_(type, item, payload) {
    if (type === "item") {
      return item ? "Editar material" : "Novo material";
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
    appendStockIaTextarea_(form, "notes", "Observacao", "");
  }

  function appendStockLinkFields_(form, state, rdoEntry) {
    if (rdoEntry) {
      appendStockIaNotice_(form, "Material do RDO: " + rdoEntry.material.name + " | " + formatQuantity_(rdoEntry.material.quantity) + " " + (rdoEntry.material.unit || "un"));
    }
    appendStockItemSelect_(form, state.items, "");
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

  function appendStockItemSelect_(form, items, selectedItemId) {
    const wrapper = document.createElement("label");
    const select = document.createElement("select");
    wrapper.textContent = "Item de estoque";
    select.name = "stockItemId";
    select.required = true;
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

  function handleStockIaFormSubmit_(event) {
    event.preventDefault();
    const form = event.target;
    const type = form.dataset.stockFormType;
    const formData = new FormData(form);
    const itemId = clean(formData.get("itemId"));
    const rdoMaterialKey = clean(formData.get("rdoMaterialKey"));
    const movementType = clean(formData.get("movementType"));

    if (type === "item") {
      if (itemId) {
        updateStockMasterItem_(itemId, Object.fromEntries(formData.entries()));
        showStockIaToast_("Material atualizado.", "success");
      } else {
        createStockMasterItem_(Object.fromEntries(formData.entries()));
        showStockIaToast_("Material cadastrado.", "success");
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
      buildDailyLogPdfTableSection_("Auditoria simples", ["Material", "Estimado", "Registrado", "Diferença"], estimated.audit.map(function (item) {
        return [
          item.name,
          formatQuantity_(item.estimated) + " " + item.unit,
          formatQuantity_(item.registered) + " " + item.unit,
          formatAuditDifference_(item)
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
    const number = Number(String(value || "0").replace(",", "."));
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
      suggestion: suggestion
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

    activeAiTarget.field.value = activeAiTarget.suggestion;
    activeAiTarget.field.dispatchEvent(new Event("input", { bubbles: true }));
    updateReportMetrics_();
    renderReviewSummary_();
    saveDraft_().catch(function (error) {
      console.warn("Não foi possível salvar a sugestão da IA imediatamente.", error);
    });
    setDraftStatus_("Sugestão da IA aplicada. Revise o texto antes de gerar o PDF.", "success");
    closeAiSuggestion_();
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
})();
