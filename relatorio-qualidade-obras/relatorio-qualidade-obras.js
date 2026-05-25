(function () {
  "use strict";

  const config = window.RELATORIO_QUALIDADE_CONFIG || {};
  const form = document.getElementById("qualityReportForm");
  const homePanel = document.getElementById("homePanel");
  const loginPanel = document.getElementById("loginPanel");
  const dashboardPanel = document.getElementById("dashboardPanel");
  const reportPanel = document.getElementById("reportPanel");
  const openReportButton = document.getElementById("openReportButton");
  const loginForm = document.getElementById("loginForm");
  const logoutButton = document.getElementById("logoutButton");
  const userBadge = document.getElementById("userBadge");
  const cloudStatus = document.getElementById("cloudStatus");
  const editorCloudStatus = document.getElementById("editorCloudStatus");
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
  const currentReportLabel = document.getElementById("currentReportLabel");
  const saveReportButton = document.getElementById("saveReportButton");
  const backToDashboardButton = document.getElementById("backToDashboardButton");
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
  const stepOrder = ["dados", "fotos", "inconformidades", "revisao", "gerar"];
  const stepPanels = Array.from(document.querySelectorAll("[data-step]"));
  const stepButtons = Array.from(document.querySelectorAll("[data-step-target]"));
  const routePanels = Array.from(document.querySelectorAll("[data-route]"));
  const routeButtons = Array.from(document.querySelectorAll("[data-route-target]"));
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
  const heicExtensions = new Set(["heic", "heif"]);
  const maxFotosUnidade = config.maxFotosUnidade || 20;
  const maxInconformidades = config.maxInconformidades || 20;
  const defaultDraftId = "relatorio-fiscalizacao-draft-v2";
  const saasStoreKey = "obrareport-saas-v1";
  const imageCache = new Map();
  let appState = loadAppState_();
  let currentUser = getCurrentUser_();
  let activeReportId = null;
  let draftSaveTimer = null;
  let cloudSyncTimer = null;
  let isApplyingCloudState = false;
  let imageProcessingQueue = Promise.resolve();

  const todayInput = document.querySelector("[name='dataVistoria']");
  if (todayInput) {
    todayInput.valueAsDate = new Date();
  }

  renderFotoUnidadeFields();
  renderInconformidadeFields();
  initializeWizard_();
  initializeDraft_();
  initializeSaas_();

  if (openReportButton && homePanel && reportPanel) {
    openReportButton.addEventListener("click", function () {
      if (currentUser) {
        showDashboardPanel_("dashboard");
        return;
      }

      showLoginPanel_();
    });
  }

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
          dataVistoria: clean(formData.get("dataVistoria")),
          responsavelTecnico: clean(formData.get("responsavelTecnico")),
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
          emailDestino: clean(formData.get("emailDestino"))
        },
        fotosUnidade: fotosUnidade,
        inconformidades: inconformidades
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

  function initializeSaas_() {
    bindSaasEvents_();
    renderSaasState_();

    if (currentUser && appState.session && appState.session.token) {
      showDashboardPanel_(getRouteFromHash_());
      refreshCloudState_();
      return;
    }

    showHomePanel_();
  }

  function bindSaasEvents_() {
    if (loginForm) {
      loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const name = clean(formData.get("userName"));
        const email = clean(formData.get("userEmail")).toLowerCase();
        const password = clean(formData.get("userPassword"));

        if (!name || !email || !password) {
          return;
        }

        try {
          setCloudStatus_("Conectando à nuvem...", "info");
          const result = await cloudApi_("auth.login", {
            name: name,
            email: email,
            password: password
          });

          await applyCloudLogin_(result);
          loginForm.reset();
          renderSaasState_();
          showDashboardPanel_("dashboard");
          setCloudStatus_("Sincronizado na nuvem", "success");
        } catch (error) {
          console.error(error);
          loginLocalFallback_(name, email);
          setCloudStatus_("Modo local ativo. Publique o Apps Script novo para sincronizar na nuvem.", "error");
        }
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener("click", function () {
        activeReportId = null;
        appState.session = null;
        saveAppState_();
        currentUser = null;
        showHomePanel_();
      });
    }

    routeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        showDashboardPanel_(button.dataset.routeTarget);
      });
    });

    window.addEventListener("hashchange", function () {
      if (currentUser && window.location.hash.indexOf("#app/") === 0) {
        showDashboardPanel_(getRouteFromHash_());
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

        appState.clients.push(client);
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

        appState.works.push(work);
        saveAppState_();
        workForm.reset();
        renderSaasState_();
        showDashboardPanel_("obras");
      });
    }

    if (reportClientSelect) {
      reportClientSelect.addEventListener("change", function () {
        renderReportWorkOptions_(reportClientSelect.value);
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

        const report = createReport_(work, title);
        appState.reports.push(report);
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
          setDraftStatus_("Relatório salvo no histórico da obra.", "success");
        });
      });
    }

    if (backToDashboardButton) {
      backToDashboardButton.addEventListener("click", function () {
        saveDraft_().finally(function () {
          showDashboardPanel_("relatorios");
        });
      });
    }
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
        return parsed;
      }
    } catch (error) {
      console.warn("Não foi possível ler os dados locais do SaaS.", error);
    }

    return {
      version: 1,
      session: null,
      users: [],
      clients: [],
      works: [],
      reports: []
    };
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
        role: "Responsável técnico",
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
    window.localStorage.setItem(saasStoreKey, JSON.stringify(appState));
    currentUser = user;
    loginForm.reset();
    renderSaasState_();
    showDashboardPanel_("dashboard");
  }

  function saveAppState_() {
    try {
      window.localStorage.setItem(saasStoreKey, JSON.stringify(appState));
    } catch (error) {
      console.error("Não foi possível salvar a estrutura SaaS local.", error);
      throw new Error("Não foi possível salvar os dados locais do SaaS neste navegador.");
    }

    scheduleCloudSync_();
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
      reports: reports
    };
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
        reports: []
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
    const value = String(window.location.hash || "").replace("#app/", "");
    return ["dashboard", "clientes", "obras", "relatorios"].indexOf(value) >= 0 ? value : "dashboard";
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
    const safeRoute = route || "dashboard";
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
    routePanels.forEach(function (panel) {
      panel.classList.toggle("active", panel.dataset.route === route);
    });

    routeButtons.forEach(function (button) {
      button.classList.toggle("active", button.dataset.routeTarget === route);
    });
  }

  function getUserClients_() {
    if (!currentUser) {
      return [];
    }

    return appState.clients.filter(function (client) {
      return client.userId === currentUser.id;
    });
  }

  function getUserWorks_() {
    if (!currentUser) {
      return [];
    }

    return appState.works.filter(function (work) {
      return work.userId === currentUser.id;
    });
  }

  function getUserReports_() {
    if (!currentUser) {
      return [];
    }

    return appState.reports
      .filter(function (report) {
        return report.userId === currentUser.id;
      })
      .sort(function (a, b) {
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
  }

  function renderSaasState_() {
    if (!currentUser) {
      return;
    }

    const clients = getUserClients_();
    const works = getUserWorks_();
    const reports = getUserReports_();

    if (userBadge) {
      userBadge.textContent = currentUser.name + " · " + currentUser.email;
    }

    if (clientMetric) {
      clientMetric.textContent = String(clients.length);
    }

    if (workMetric) {
      workMetric.textContent = String(works.length);
    }

    if (reportMetric) {
      reportMetric.textContent = String(reports.length);
    }

    renderClientOptions_(workClientSelect, clients);
    renderClientOptions_(reportClientSelect, clients);
    renderReportWorkOptions_(reportClientSelect ? reportClientSelect.value : "");
    renderClientsList_(clients);
    renderWorksList_(works);
    renderReportsList_(reportsList, reports);
    renderReportsList_(recentReportsList, reports.slice(0, 5));
    updateReportContext_();
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
      inconformidades: payload.inconformidades.length
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
      section.className = "nonconformity-card";

      section.appendChild(createTitle("FOTO DA UNIDADE " + number));
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
      section.className = "nonconformity-card";

      section.appendChild(createTitle("RQO " + number + " - INCONFORMIDADE IDENTIFICADA"));
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
    const label = document.createElement("label");
    const textarea = document.createElement("textarea");

    textarea.name = name;
    textarea.rows = rows || 4;

    label.appendChild(document.createTextNode(labelText));
    label.appendChild(textarea);
    return label;
  }

  function initializeDraft_() {
    form.addEventListener("input", function (event) {
      if (event.target && event.target.type !== "file") {
        scheduleDraftSave_();
        updateReportMetrics_();
      }
    });

    form.addEventListener("change", async function (event) {
      const target = event.target;

      if (!target) {
        return;
      }

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
