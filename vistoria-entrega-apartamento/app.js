(function () {
  "use strict";

  const STORAGE_KEY = "obrareport-apartment-handover-inspection-v2";
  const PHOTO_DB = "obrareport-apartment-handover-photos";
  const PHOTO_STORE = "photos";
  const NOT_INSPECTED = "NAO_INSPECIONADO";
  const MAX_PHOTOS = 5;
  const API_BASE_URL = String(window.OBRAREPORT_API_BASE_URL || window.OBRAREPORT_PRODUCTION_API_BASE_URL || "https://obrareport-backend.onrender.com").replace(/\/$/, "");
  const template = window.VistoriaEntregaTemplates.templates.find((entry) => entry.id === window.VistoriaEntregaTemplates.activeTemplateId);
  const statusLabels = { C: "Conforme", NC: "Não Conforme", NA: "Não Aplicável", NV: "Não Verificado", [NOT_INSPECTED]: "Não Inspecionado" };
  const measurementTypes = ["tensão", "dimensão", "nível", "caimento", "umidade", "pressão", "temperatura", "outro"];
  const units = ["V", "mm", "cm", "m", "%", "°C", "bar"];
  const defaultInstruments = ["Trena", "Nível", "Nível a laser", "Multímetro", "Medidor de umidade", "Termômetro", "Esquadro", "Prumo", "Manômetro", "Outro"];
  const severityOrder = { critica: 0, alta: 1, media: 2, baixa: 3 };

  let activeSystemId = "all";
  let activeFilter = "all";
  let activeNcFilter = "all";
  let activeResultKey = "";
  let pendingPhotos = [];
  let draftStatus = "C";
  let pdfBusy = false;
  let pdfObjectUrl = "";
  let syncController = null;
  let syncEnabled = false;
  let syncContextSnapshot = { institutionId: "", clientId: "", projectId: "", createdBy: "" };
  let state = normalizeState(loadState() || createSession());

  const nodes = {
    views: Array.from(document.querySelectorAll("[data-view]")),
    fields: Array.from(document.querySelectorAll("[data-field]")),
    summaryStrip: document.querySelector("[data-summary-strip]"),
    dashboardCards: document.querySelector("[data-dashboard-cards]"),
    environmentGrid: document.querySelector("[data-environment-grid]"),
    envTabs: document.querySelector("[data-environment-tabs]"),
    systemTabs: document.querySelector("[data-system-tabs]"),
    filterChips: document.querySelector("[data-filter-chips]"),
    searchInput: document.querySelector("[data-search-input]"),
    environmentStatus: document.querySelector("[data-environment-status]"),
    itemList: document.querySelector("[data-item-list]"),
    saveState: document.querySelector("[data-save-state]"),
    itemSheet: document.querySelector("[data-item-sheet]"),
    sheetContext: document.querySelector("[data-sheet-context]"),
    itemTitle: document.querySelector("[data-item-title]"),
    criteria: document.querySelector("[data-acceptance-criteria]"),
    currentStatus: document.querySelector("[data-current-status]"),
    ncPanel: document.querySelector("[data-nc-panel]"),
    naPanel: document.querySelector("[data-na-panel]"),
    nvPanel: document.querySelector("[data-nv-panel]"),
    measurementPanel: document.querySelector("[data-measurement-panel]"),
    ncSeverity: document.querySelector("[data-nc-severity]"),
    ncNotes: document.querySelector("[data-nc-notes]"),
    ncRecommendation: document.querySelector("[data-nc-recommendation]"),
    ncPhoto: document.querySelector("[data-nc-photo]"),
    ncPhotoCamera: document.querySelector("[data-nc-photo-camera]"),
    ncPhotoGallery: document.querySelector("[data-nc-photo-gallery]"),
    photoStatus: document.querySelector("[data-photo-status]"),
    primaryPhoto: document.querySelector("[data-primary-photo]"),
    analyzeAi: document.querySelector("[data-analyze-ai]"),
    aiStatus: document.querySelector("[data-ai-status]"),
    aiCard: document.querySelector("[data-ai-card]"),
    aiHeading: document.querySelector("[data-ai-heading]"),
    aiDescription: document.querySelector("[data-ai-description]"),
    aiRecommendation: document.querySelector("[data-ai-recommendation]"),
    aiMeta: document.querySelector("[data-ai-meta]"),
    aiTarget: document.querySelector("[data-ai-target]"),
    naJustification: document.querySelector("[data-na-justification]"),
    nvReason: document.querySelector("[data-nv-reason]"),
    measurementType: document.querySelector("[data-measurement-type]"),
    measurementValue: document.querySelector("[data-measurement-value]"),
    measurementUnit: document.querySelector("[data-measurement-unit]"),
    measurementInstrument: document.querySelector("[data-measurement-instrument]"),
    observation: document.querySelector("[data-observation]"),
    bulkDialog: document.querySelector("[data-bulk-dialog]"),
    envNaDialog: document.querySelector("[data-env-na-dialog]"),
    finalizeDialog: document.querySelector("[data-finalize-dialog]"),
    finalizeWarning: document.querySelector("[data-finalize-warning]"),
    summaryDialog: document.querySelector("[data-summary-dialog]"),
    fullSummary: document.querySelector("[data-full-summary]"),
    globalNcList: document.querySelector("[data-global-nc-list]"),
    ncFilterChips: document.querySelector("[data-nc-filter-chips]"),
    instrumentType: document.querySelector("[data-instrument-type]"),
    instrumentBrand: document.querySelector("[data-instrument-brand]"),
    instrumentModel: document.querySelector("[data-instrument-model]"),
    instrumentId: document.querySelector("[data-instrument-id]"),
    instrumentNote: document.querySelector("[data-instrument-note]"),
    instrumentList: document.querySelector("[data-instrument-list]"),
    generateReport: document.querySelector("[data-generate-report]"),
    generateDraftPdf: document.querySelector("[data-generate-draft-pdf]"),
    generateFinalPdf: document.querySelector("[data-generate-final-pdf]"),
    pdfDialog: document.querySelector("[data-pdf-dialog]"),
    pdfEyebrow: document.querySelector("[data-pdf-eyebrow]"),
    pdfTitle: document.querySelector("[data-pdf-title]"),
    pdfStatus: document.querySelector("[data-pdf-status]"),
    pdfActions: document.querySelector("[data-pdf-actions]"),
    pdfOpen: document.querySelector("[data-open-pdf]"),
    pdfDownload: document.querySelector("[data-download-pdf]"),
    pdfPreflight: document.querySelector("[data-pdf-preflight]"),
    pdfBlockers: document.querySelector("[data-pdf-blockers]"),
    pdfWarnings: document.querySelector("[data-pdf-warnings]"),
    reopenButton: document.querySelector("[data-reopen-inspection]"),
    syncStatus: document.querySelector("[data-sync-status]")
  };

  function createSession() {
    const metadata = { projectName: "", developerName: "", towerName: "", unitName: "", address: "", clientName: "", technicalResponsible: "", professionalRegistry: "", inspectionDate: new Date().toISOString().slice(0, 10), inspectionType: "Entrega inicial", initialNotes: "" };
    const results = {};
    for (const item of template.items) results[resultKey(item.environmentId, item.id)] = createResult(item);
    return { id: "inspection-" + Date.now(), type: "apartment_handover_inspection", currentView: "identification", activeEnvironmentId: template.environments[0].id, inspection: { templateId: template.id, metadata, environments: template.environments, systems: template.systems, items: template.items, results, photos: {}, measurements: {}, instruments: defaultInstruments.map((name, index) => ({ id: "inst-" + index, type: name, brand: "", model: "", identification: "", observation: "" })), status: "draft", startedAt: "", completedAt: "", reopenedAt: "", summary: {} } };
  }

  function createResult(item) {
    return { type: "inspectionResult", inspectionItemId: item.id, environmentId: item.environmentId, systemId: item.systemId, status: NOT_INSPECTED, severity: "baixa", notes: "", recommendation: "", observation: "", justification: "", nvReason: "", photoIds: [], photoPrincipalId: "", aiSuggestion: null, aiReview: {}, confirmedByUser: false, confirmedAt: "", bulkConfirmed: false, bulkAction: "", measurementValue: "", measurementUnit: item.measurementType === "tensão" ? "V" : item.measurementType === "dimensão" ? "mm" : item.measurementType === "pressão" ? "bar" : item.measurementType === "temperatura" ? "°C" : "%", measurementType: item.measurementType || "outro", instrument: item.recommendedInstrument || "", acceptanceCriteria: item.acceptanceCriteria };
  }

  function normalizeState(session) {
    session.inspection.metadata = session.inspection.metadata || {};
    for (const [oldKey, newKey] of [["projectName", "projectName"], ["unitName", "unitName"], ["technicalResponsible", "technicalResponsible"], ["professionalRegistry", "professionalRegistry"]]) {
      if (session[oldKey] && !session.inspection.metadata[newKey]) session.inspection.metadata[newKey] = session[oldKey];
    }
    session.inspection.environments = template.environments;
    session.inspection.systems = template.systems;
    session.inspection.items = template.items;
    session.inspection.instruments = session.inspection.instruments?.length ? session.inspection.instruments : defaultInstruments.map((name, index) => ({ id: "inst-" + index, type: name, brand: "", model: "", identification: "", observation: "" }));
    session.inspection.results = session.inspection.results || {};
    for (const item of template.items) {
      const key = resultKey(item.environmentId, item.id);
      session.inspection.results[key] = { ...createResult(item), ...(session.inspection.results[key] || {}) };
    }
    session.inspection.photos = session.inspection.photos || {};
    session.inspection.measurements = session.inspection.measurements || {};
    session.inspection.status = session.inspection.status || "draft";
    return session;
  }

  function resultKey(environmentId, itemId) { return environmentId + "::" + itemId; }
  function loadState() { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
  function persist() {
    state.inspection.summary = computeSummary();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (nodes.saveState) nodes.saveState.textContent = "Salvo " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function cleanString(value) { return String(value || "").trim(); }
  function readStorageJson(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
  function normalizeSyncContext(context) {
    const safe = context || {};
    return {
      institutionId: cleanString(safe.institutionId || safe.institution_id || safe.companyId || safe.company_id),
      clientId: cleanString(safe.clientId || safe.client_id),
      projectId: cleanString(safe.projectId || safe.project_id || safe.workId || safe.work_id),
      createdBy: cleanString(safe.createdBy || safe.created_by || safe.userId || safe.user_id)
    };
  }
  function hasSyncContext(context) {
    return Boolean(context && context.institutionId && context.clientId && context.projectId && context.createdBy);
  }
  function resolveSaasSyncContext() {
    const appState = readStorageJson("obrareport-saas-v1") || {};
    const session = appState.session || {};
    const local = appState.local || {};
    const users = Array.isArray(appState.users) ? appState.users : [];
    const clients = Array.isArray(appState.clients) ? appState.clients : [];
    const works = Array.isArray(appState.works) ? appState.works : [];
    const reports = Array.isArray(appState.reports) ? appState.reports : [];
    const user = users.find((item) => item && cleanString(item.id) === cleanString(session.userId || session.user_id)) || null;
    const report = reports.find((item) => item && cleanString(item.id) === cleanString(local.lastReportId)) || null;
    const workId = cleanString(local.lastWorkId || local.workId || local.projectId || report && report.workId);
    const work = works.find((item) => item && cleanString(item.id) === workId) || null;
    const clientId = cleanString(work && work.clientId || local.lastClientId || local.clientId || report && report.clientId);
    const client = clients.find((item) => item && cleanString(item.id) === clientId) || null;
    return normalizeSyncContext({
      institutionId: session.institutionId || session.institution_id || session.companyId || session.company_id || user && (user.institutionId || user.institution_id || user.companyId || user.company_id) || appState.institutionId || appState.institution_id,
      clientId: client ? client.id : "",
      projectId: work ? work.id : "",
      createdBy: user && user.id || session.userId || session.user_id
    });
  }
  function resolveAppSyncContext() {
    const syncModule = window.ApartmentHandoverInspectionSync;
    if (syncModule && typeof syncModule.resolveCorporateContext === "function") {
      const explicit = normalizeSyncContext(syncModule.resolveCorporateContext(localStorage));
      if (hasSyncContext(explicit)) return explicit;
    }
    return resolveSaasSyncContext();
  }
  function syncModulesAvailable() {
    return Boolean(window.ApartmentHandoverDocumentAdapter && window.ApartmentHandoverInspectionSync && typeof window.ApartmentHandoverInspectionSync.createController === "function");
  }
  function refreshSyncAvailability() {
    syncContextSnapshot = resolveAppSyncContext();
    syncEnabled = syncModulesAvailable() && hasSyncContext(syncContextSnapshot);
    if (!syncEnabled) syncController = null;
    return syncEnabled;
  }
  function getSyncMetadata() {
    const syncModule = window.ApartmentHandoverInspectionSync;
    return syncModule && typeof syncModule.ensureSyncMetadata === "function" ? syncModule.ensureSyncMetadata(state) : { syncStatus: "local_only", syncRevision: 0 };
  }
  function persistSyncState() { persist(); renderSyncStatus(); }
  function initSyncController() {
    if (!refreshSyncAvailability()) { renderSyncStatus(); return null; }
    syncController = window.ApartmentHandoverInspectionSync.createController({
      apiBaseUrl: API_BASE_URL,
      adapter: window.ApartmentHandoverDocumentAdapter,
      getState: () => state,
      getContext: () => { syncContextSnapshot = resolveAppSyncContext(); return syncContextSnapshot; },
      persistState: persistSyncState,
      debounceMs: 1200
    });
    renderSyncStatus();
    return syncController;
  }
  function ensureSyncController() { return syncController || initSyncController(); }
  function hasPendingSync() {
    const sync = getSyncMetadata();
    return sync.syncStatus === "dirty" || sync.syncStatus === "error" || (sync.syncStatus === "local_only" && Number(sync.syncRevision) > 0);
  }
  function renderSyncStatus() {
    if (!nodes.syncStatus) return;
    refreshSyncAvailability();
    const sync = getSyncMetadata();
    let label = "Salvo neste aparelho";
    let stateName = "local_only";
    if (syncEnabled) {
      stateName = sync.syncStatus || "local_only";
      if (stateName === "synced") label = "Sincronizado";
      else if (stateName === "syncing") label = "Sincronizando...";
      else if (stateName === "conflict") label = "Conflito de sincronização";
      else if (stateName === "error") label = "Erro de sincronização";
      else if (stateName === "dirty" || Number(sync.syncRevision) > 0) label = "Pendente de sincronização";
    }
    nodes.syncStatus.textContent = label;
    nodes.syncStatus.dataset.syncState = stateName;
  }
  function queueInspectionSync(reason) {
    if (!ensureSyncController()) { renderSyncStatus(); return getSyncMetadata(); }
    const metadata = syncController.queueSync(reason || "local_change");
    renderSyncStatus();
    return metadata;
  }
  async function retryPendingSync(reason) {
    if (!ensureSyncController() || !hasPendingSync()) { renderSyncStatus(); return { ok: false, skipped: true, reason: "sync_disabled_or_clean" }; }
    const result = await syncController.retryPending(reason || "retry_pending");
    renderSyncStatus();
    return result;
  }
  function retryPendingSyncLater(reason) { retryPendingSync(reason).catch(() => { renderSyncStatus(); }); }
  function showView(name) { state.currentView = name; nodes.views.forEach((view) => { view.hidden = view.dataset.view !== name; }); render(); }

  function render() {
    renderFields();
    renderSummaryStrip();
    renderDashboard();
    renderEnvironmentTabs();
    renderSystemTabs();
    renderItems();
    renderGlobalNcs();
    renderInstruments();
    nodes.reopenButton.hidden = state.inspection.status !== "completed";
    if (nodes.generateFinalPdf) nodes.generateFinalPdf.hidden = state.inspection.status !== "completed";
    setPdfButtonsBusy(pdfBusy);
    persist();
  }

  function renderFields() { nodes.fields.forEach((field) => { field.value = state.inspection.metadata[field.dataset.field] || ""; }); }
  function results() { return Object.values(state.inspection.results); }
  function environmentResults(environmentId) { return results().filter((result) => result.environmentId === environmentId); }
  function isDone(result) { return result.status !== NOT_INSPECTED; }

  function computeSummary() {
    const counts = { total: 0, C: 0, NC: 0, NA: 0, NV: 0, [NOT_INSPECTED]: 0, inspectedPercent: 0 };
    const nonConformities = [];
    for (const result of results()) {
      counts.total += 1;
      counts[result.status] += 1;
      if (result.status === "NC") nonConformities.push({ ...result, environment: envName(result.environmentId), system: systemName(result.systemId), item: itemById(result.inspectionItemId).title, photoCount: result.photoIds.length });
    }
    counts.inspectedPercent = counts.total ? Math.round(((counts.C + counts.NC + counts.NA + counts.NV) / counts.total) * 100) : 0;
    nonConformities.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    return { counts, nonConformities, environmentStatuses: template.environments.map((env) => ({ ...env, ...environmentStatus(env.id) })) };
  }

  function environmentStatus(environmentId) {
    const list = environmentResults(environmentId);
    const done = list.filter(isDone).length;
    const nc = list.filter((result) => result.status === "NC").length;
    let label = "NÃO INICIADO";
    if (nc) label = "COM NC";
    else if (done === list.length) label = "CONCLUÍDO";
    else if (done > 0) label = "EM ANDAMENTO";
    return { total: list.length, done, nc, pending: list.length - done, label };
  }

  function renderSummaryStrip() {
    if (!nodes.summaryStrip) return;
    const c = computeSummary().counts;
    nodes.summaryStrip.innerHTML = [["Total", c.total], ["%", c.inspectedPercent + "%"], ["C", c.C], ["NC", c.NC], ["NA", c.NA], ["NV", c.NV], ["Não insp.", c[NOT_INSPECTED]]].map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join("");
  }

  function renderDashboard() {
    if (!nodes.dashboardCards) return;
    const summary = computeSummary();
    const c = summary.counts;
    nodes.dashboardCards.innerHTML = [["Progresso total", c.inspectedPercent + "%"], ["Ambientes concluídos", summary.environmentStatuses.filter((env) => env.label === "CONCLUÍDO" || env.label === "COM NC").length], ["Itens concluídos", c.C + c.NC + c.NA + c.NV], ["Não inspecionados", c[NOT_INSPECTED]]].map(([label, value]) => `<article class="dash-card"><strong>${value}</strong><span>${label}</span></article>`).join("");
    nodes.environmentGrid.innerHTML = summary.environmentStatuses.map((env) => `<button type="button" class="environment-card" data-open-env="${env.id}"><strong>${escapeHtml(env.name)}</strong><span>${env.done}/${env.total}</span><em>${env.label}</em></button>`).join("");
    nodes.environmentGrid.querySelectorAll("[data-open-env]").forEach((button) => button.addEventListener("click", () => { state.activeEnvironmentId = button.dataset.openEnv; showView("environment"); }));
  }

  function renderEnvironmentTabs() {
    if (!nodes.envTabs) return;
    nodes.envTabs.innerHTML = template.environments.map((env) => `<button type="button" data-env="${env.id}" aria-selected="${env.id === state.activeEnvironmentId}">${escapeHtml(env.name)}</button>`).join("");
    nodes.envTabs.querySelectorAll("[data-env]").forEach((button) => button.addEventListener("click", () => { state.activeEnvironmentId = button.dataset.env; render(); }));
  }

  function renderSystemTabs() {
    if (!nodes.systemTabs) return;
    const ids = new Set(environmentResults(state.activeEnvironmentId).map((result) => result.systemId));
    const buttons = [{ id: "all", name: "Todos" }, ...template.systems.filter((system) => ids.has(system.id))];
    nodes.systemTabs.innerHTML = buttons.map((system) => `<button type="button" data-system="${system.id}" aria-selected="${system.id === activeSystemId}">${escapeHtml(system.name)}</button>`).join("");
    nodes.systemTabs.querySelectorAll("[data-system]").forEach((button) => button.addEventListener("click", () => { activeSystemId = button.dataset.system; renderItems(); }));
  }

  function renderItems() {
    if (!nodes.itemList) return;
    const query = (nodes.searchInput.value || "").toLowerCase();
    const status = environmentStatus(state.activeEnvironmentId);
    nodes.environmentStatus.innerHTML = `<strong>${envName(state.activeEnvironmentId)}</strong><span>${status.done}/${status.total} · ${status.label}</span>`;
    let list = environmentResults(state.activeEnvironmentId);
    if (activeSystemId !== "all") list = list.filter((result) => result.systemId === activeSystemId);
    if (activeFilter === "pending") list = list.filter((result) => result.status === NOT_INSPECTED);
    if (["NC", "NV"].includes(activeFilter)) list = list.filter((result) => result.status === activeFilter);
    if (query) list = list.filter((result) => itemById(result.inspectionItemId).title.toLowerCase().includes(query) || systemName(result.systemId).toLowerCase().includes(query));
    nodes.itemList.innerHTML = list.map((result) => {
      const item = itemById(result.inspectionItemId);
      return `<article class="inspection-card" data-item-id="${item.id}"><div class="item-head"><div><p class="item-title">${escapeHtml(item.title)}</p><p class="item-meta">${escapeHtml(systemName(item.systemId))} · ${escapeHtml(item.acceptanceCriteria)}</p></div><span class="status-pill status-${result.status}">${statusLabels[result.status]}</span></div><div class="card-actions"><button class="secondary-button" type="button" data-open-item="${resultKey(result.environmentId, result.inspectionItemId)}">Abrir item</button>${["C", "NC", "NA", "NV"].map((s) => `<button class="status-button ${result.status === s ? "active" : ""}" type="button" data-status="${s}" data-key="${resultKey(result.environmentId, result.inspectionItemId)}">${s}</button>`).join("")}</div>${result.status === "NC" ? `<p class="nc-note">${escapeHtml(result.notes || "NC registrada sem descrição.")} · Fotos: ${result.photoIds.length}</p>` : ""}</article>`;
    }).join("") || `<p class="empty-state">Nenhum item encontrado.</p>`;
    nodes.itemList.querySelectorAll("[data-open-item]").forEach((button) => button.addEventListener("click", () => openItem(button.dataset.openItem)));
    nodes.itemList.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.status === "C") { quickConfirmConforme(button.dataset.key); return; } openItem(button.dataset.key); setDraftStatus(button.dataset.status); }));
  }

  function openItem(key) {
    activeResultKey = key;
    pendingPhotos = [];
    const result = state.inspection.results[key];
    const item = itemById(result.inspectionItemId);
    draftStatus = result.status === NOT_INSPECTED ? "C" : result.status;
    nodes.sheetContext.textContent = `${envName(result.environmentId)} · ${systemName(result.systemId)}`;
    nodes.itemTitle.textContent = item.title;
    nodes.criteria.textContent = "Critério: " + item.acceptanceCriteria;
    nodes.currentStatus.textContent = "Status atual: " + statusLabels[result.status];
    nodes.ncSeverity.value = result.severity || "baixa";
    nodes.ncNotes.value = result.notes || "";
    nodes.ncRecommendation.value = result.recommendation || "";
    nodes.naJustification.value = result.justification || "";
    nodes.nvReason.value = result.nvReason || "acesso_impedido";
    nodes.observation.value = result.observation || "";
    fillSelect(nodes.measurementType, measurementTypes, result.measurementType || item.measurementType || "outro");
    fillSelect(nodes.measurementUnit, units, result.measurementUnit || "%");
    fillSelect(nodes.measurementInstrument, state.inspection.instruments.map((inst) => inst.type), result.instrument || item.recommendedInstrument || "");
    nodes.measurementValue.value = result.measurementValue || "";
    nodes.measurementPanel.hidden = !item.requiresMeasurement;
    if (nodes.ncPhotoCamera) nodes.ncPhotoCamera.value = "";
    if (nodes.ncPhotoGallery) nodes.ncPhotoGallery.value = "";
    if (nodes.ncPhoto && nodes.ncPhoto !== nodes.ncPhotoCamera) nodes.ncPhoto.value = "";
    updatePhotoStatus(result);
    renderAiSuggestion(result);
    setDraftStatus(draftStatus);
    nodes.itemSheet.hidden = false;
  }

  function setDraftStatus(status) {
    draftStatus = status;
    document.querySelectorAll("[data-sheet-status]").forEach((button) => button.classList.toggle("active", button.dataset.sheetStatus === status));
    nodes.ncPanel.hidden = status !== "NC";
    nodes.naPanel.hidden = status !== "NA";
    nodes.nvPanel.hidden = status !== "NV";
  }

  async function applyActiveSheetToState({ requireNcDescription = true } = {}) {
    const result = state.inspection.results[activeResultKey];
    if (!result) return true;
    const item = itemById(result.inspectionItemId);
    if (requireNcDescription && draftStatus === "NC" && !nodes.ncNotes.value.trim()) { nodes.ncNotes.focus(); return false; }
    result.status = draftStatus;
    result.confirmedByUser = true;
    result.confirmedAt = new Date().toISOString();
    result.bulkConfirmed = false;
    result.bulkAction = "";
    result.observation = nodes.observation.value.trim();
    result.severity = nodes.ncSeverity.value;
    result.notes = draftStatus === "NC" ? nodes.ncNotes.value.trim() : "";
    result.recommendation = draftStatus === "NC" ? nodes.ncRecommendation.value.trim() : "";
    result.justification = draftStatus === "NA" ? nodes.naJustification.value.trim() : "";
    result.nvReason = draftStatus === "NV" ? nodes.nvReason.value : "";
    if (item.requiresMeasurement) {
      result.measurementType = nodes.measurementType.value;
      result.measurementValue = nodes.measurementValue.value.trim();
      result.measurementUnit = nodes.measurementUnit.value;
      result.instrument = nodes.measurementInstrument.value;
      state.inspection.measurements[activeResultKey] = { measurementType: result.measurementType, value: result.measurementValue, unit: result.measurementUnit, instrument: result.instrument, acceptanceCriteria: result.acceptanceCriteria };
    }
    for (const file of pendingPhotos.slice(0, MAX_PHOTOS - result.photoIds.length)) {
      const photo = await storePhoto(file, result);
      state.inspection.photos[photo.id] = adapters.photos.toInspectionPhotoLink(photo, result);
      result.photoIds.push(photo.id);
      result.photoPrincipalId = result.photoPrincipalId || photo.id;
    }
    pendingPhotos = [];
    persist();
    return true;
  }

  async function saveItem() {
    if (!await applyActiveSheetToState({ requireNcDescription: true })) return;
    closeSheet();
    queueInspectionSync("save_item");
  }
  function closeSheet() { nodes.itemSheet.hidden = true; activeResultKey = ""; pendingPhotos = []; render(); }
  function quickConfirmConforme(key) {
    const result = state.inspection.results[key];
    if (!result) return;
    result.status = "C";
    result.confirmedByUser = true;
    result.confirmedAt = new Date().toISOString();
    result.bulkConfirmed = false;
    result.bulkAction = "";
    result.notes = "";
    result.recommendation = "";
    result.justification = "";
    result.nvReason = "";
    render();
    queueInspectionSync("quick_c");
  }
  function finishEnvironment() { if (environmentResults(state.activeEnvironmentId).some((result) => result.status === NOT_INSPECTED)) nodes.bulkDialog.showModal(); }
  function bulkConfirmEnvironment() { const now = new Date().toISOString(); environmentResults(state.activeEnvironmentId).forEach((result) => { if (result.status === NOT_INSPECTED) Object.assign(result, { status: "C", confirmedByUser: true, confirmedAt: now, bulkConfirmed: true, bulkAction: "environment_c" }); }); nodes.bulkDialog.close(); render(); queueInspectionSync("finish_environment"); }
  function markEnvironmentNa() { nodes.envNaDialog.showModal(); }
  function confirmEnvironmentNa() { const now = new Date().toISOString(); environmentResults(state.activeEnvironmentId).forEach((result) => { if (result.status === NOT_INSPECTED) Object.assign(result, { status: "NA", confirmedByUser: true, confirmedAt: now, bulkConfirmed: true, bulkAction: "environment_na", justification: "Ambiente não aplicável" }); }); nodes.envNaDialog.close(); render(); queueInspectionSync("environment_na"); }
  function finalizeInspection() { const c = computeSummary().counts; nodes.finalizeWarning.textContent = `${c[NOT_INSPECTED]} itens não inspecionados, ${c.NC} não conformidades e ${c.NV} itens não verificados.`; nodes.finalizeDialog.showModal(); }
  function confirmFinalize() { state.inspection.status = "completed"; state.inspection.completedAt = new Date().toISOString(); nodes.finalizeDialog.close(); showView("dashboard"); queueInspectionSync("finalize_inspection"); }
  function reopenInspection() { state.inspection.status = "draft"; state.inspection.reopenedAt = new Date().toISOString(); showView("dashboard"); queueInspectionSync("reopen_inspection"); }


  function renderInstruments() {
    if (!nodes.instrumentList) return;
    nodes.instrumentList.innerHTML = state.inspection.instruments.slice(-4).map((inst) => `<span>${escapeHtml(inst.type)}${inst.identification ? " · " + escapeHtml(inst.identification) : ""}</span>`).join("");
  }

  function addInstrument() {
    const type = (nodes.instrumentType.value || "").trim();
    if (!type) { nodes.instrumentType.focus(); return; }
    state.inspection.instruments.push({
      id: "inst-custom-" + Date.now(),
      type,
      brand: nodes.instrumentBrand.value.trim(),
      model: nodes.instrumentModel.value.trim(),
      identification: nodes.instrumentId.value.trim(),
      observation: nodes.instrumentNote.value.trim()
    });
    nodes.instrumentType.value = "";
    nodes.instrumentBrand.value = "";
    nodes.instrumentModel.value = "";
    nodes.instrumentId.value = "";
    nodes.instrumentNote.value = "";
    render();
  }
  function renderGlobalNcs() {
    if (!nodes.globalNcList) return;
    let ncs = computeSummary().nonConformities;
    if (activeNcFilter !== "all") ncs = ncs.filter((result) => result.severity === activeNcFilter);
    nodes.globalNcList.innerHTML = ncs.map((nc) => `<article class="nc-row"><strong>${escapeHtml(nc.environment)} · ${escapeHtml(nc.system)}</strong><p>${escapeHtml(nc.item)}</p><p>Severidade: ${escapeHtml(nc.severity)} · Fotos: ${nc.photoCount}</p><p>${escapeHtml(nc.notes || "Sem descrição")}</p></article>`).join("") || `<p class="empty-state">Nenhuma NC registrada.</p>`;
  }


  function reportModeFromCurrentState() {
    return state.inspection.status === "completed" ? "final" : "draft";
  }

  async function autosaveCurrentStateForPdf() {
    if (!nodes.itemSheet.hidden && activeResultKey) await applyActiveSheetToState({ requireNcDescription: false });
    state.inspection.summary = computeSummary();
    persist();
    return normalizeState(loadState() || state);
  }

  function triggerPdfDownload(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function generateReportFromTop() {
    if (pdfBusy) return;
    await autosaveCurrentStateForPdf();
    await generateInspectionPdf(reportModeFromCurrentState(), { autoDownload: true, fallbackDraftOnBlockedFinal: true });
  }

  async function generateInspectionPdf(mode, options = {}) {
    if (pdfBusy) return;
    pdfBusy = true;
    setPdfButtonsBusy(true);
    await autosaveCurrentStateForPdf();
    queueInspectionSync("pdf_" + mode);
    showPdfStatus(mode, mode === "final" ? "Gerando laudo final..." : "Gerando rascunho...");
    try {
      const response = await fetch(`${API_BASE_URL}/api/apartment-handover/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await buildApartmentHandoverPdfPayload(mode))
      });
      const contentType = response.headers.get("content-type") || "";
      if (response.status === 422 && contentType.includes("application/json")) {
        const body = await response.json();
        if (body.code === "INSPECTION_PREFLIGHT_BLOCKED") {
          if (mode === "final" && options.fallbackDraftOnBlockedFinal) {
            pdfBusy = false;
            setPdfButtonsBusy(false);
            showPdfStatus("draft", "O laudo final possui pendências. Um rascunho será gerado com as informações atuais.");
            await generateInspectionPdf("draft", { autoDownload: options.autoDownload, fallbackNotice: "O laudo final possui pendências. Um rascunho foi gerado com as informações atuais." });
            return;
          }
          showPreflightBlocked(body.review);
          return;
        }
      }
      if (!response.ok || !contentType.includes("application/pdf")) throw new Error("pdf_generation_failed");
      const blob = await response.blob();
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
      pdfObjectUrl = URL.createObjectURL(blob);
      const filename = filenameFromDisposition(response.headers.get("content-disposition")) || defaultPdfFilename(mode);
      nodes.pdfTitle.textContent = mode === "final" ? "Laudo gerado com sucesso" : "Rascunho gerado com sucesso";
      nodes.pdfStatus.textContent = (options.fallbackNotice ? options.fallbackNotice + " " : "") + "✓ Relatório gerado: " + filename;
      nodes.pdfPreflight.hidden = true;
      nodes.pdfActions.hidden = false;
      nodes.pdfOpen.href = pdfObjectUrl;
      nodes.pdfDownload.href = pdfObjectUrl;
      nodes.pdfDownload.download = filename;
      if (options.autoDownload) triggerPdfDownload(pdfObjectUrl, filename);
      nodes.pdfDialog.showModal();
    } catch {
      nodes.pdfTitle.textContent = "Não foi possível gerar o relatório.";
      nodes.pdfStatus.textContent = "Tentar novamente. Nenhum dado da vistoria foi perdido.";
      nodes.pdfActions.hidden = true;
      nodes.pdfPreflight.hidden = true;
      nodes.pdfDialog.showModal();
    } finally {
      pdfBusy = false;
      setPdfButtonsBusy(false);
    }
  }
  async function buildApartmentHandoverPdfPayload(mode) {
    const metadata = state.inspection.metadata || {};
    return {
      mode,
      report: {
        type: "apartment_handover_inspection",
        empreendimento: metadata.projectName,
        obra: metadata.projectName,
        construtora: metadata.developerName,
        torre: metadata.towerName,
        unidade: metadata.unitName,
        endereco: metadata.address,
        cliente: metadata.clientName,
        responsavelTecnico: metadata.technicalResponsible,
        creaCau: metadata.professionalRegistry,
        dataVistoria: metadata.inspectionDate,
        tipoVistoria: metadata.inspectionType,
        observacoesIniciais: metadata.initialNotes,
        inspection: {
          id: state.id,
          templateId: state.inspection.templateId,
          finalizada: mode === "final",
          status: mode === "final" ? "completed" : "draft",
          metadata,
          startedAt: state.inspection.startedAt,
          completedAt: state.inspection.completedAt,
          summary: computeSummary(),
          instruments: state.inspection.instruments,
          instrumentos: state.inspection.instruments,
          items: await buildApartmentHandoverPdfItems()
        }
      }
    };
  }

  async function buildApartmentHandoverPdfItems() {
    const mapped = [];
    const orderedResults = results().sort((a, b) => template.items.findIndex((item) => item.id === a.inspectionItemId) - template.items.findIndex((item) => item.id === b.inspectionItemId));
    for (const [index, result] of orderedResults.entries()) {
      const item = itemById(result.inspectionItemId);
      const status = result.status === NOT_INSPECTED ? "NI" : result.status;
      mapped.push({
        numero: index + 1,
        id: item.id,
        ambiente: envName(result.environmentId),
        sistema: systemName(result.systemId),
        item: item.title,
        criterio: item.acceptanceCriteria,
        status,
        severidade: result.severity || "baixa",
        descricaoTecnica: status === "NC" ? result.notes : result.observation,
        recomendacaoAcao: status === "NC" ? result.recommendation : "",
        observacoes: result.observation,
        justificativa: result.justification,
        motivoNaoVerificacao: result.nvReason,
        situacao: status === "NC" ? "Pendente" : "Registrado",
        completionCriticality: item.completionCriticality || item.criticality || "standard",
        photoRequired: status === "NC",
        fotos: await buildPdfPhotos(result),
        medicoes: buildPdfMeasurements(result)
      });
    }
    return mapped;
  }

  async function buildPdfPhotos(result) {
    const photos = [];
    for (const [index, id] of (result.photoIds || []).entries()) {
      const link = state.inspection.photos[id] || {};
      const stored = await getStoredPhoto(id).catch(() => null);
      if (!stored) {
        photos.push({ numero: index + 1, legenda: link.fileName || `Foto ${index + 1}` });
        continue;
      }
      const dataUrl = await blobToDataUrl(stored.data);
      photos.push({ numero: index + 1, legenda: stored.fileName || link.fileName || `Foto ${index + 1}`, foto: { base64: dataUrl.split(",")[1] || "", mimeType: stored.mimeType || link.mimeType || "image/jpeg" } });
    }
    return photos;
  }

  function buildPdfMeasurements(result) {
    if (!result.measurementValue) return [];
    return [{ tipo: result.measurementType, valor: result.measurementValue, unidade: result.measurementUnit, instrumento: result.instrument, acceptanceCriteria: result.acceptanceCriteria }];
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function setPdfButtonsBusy(isBusy) {
    if (nodes.generateReport) {
      nodes.generateReport.disabled = isBusy;
      nodes.generateReport.textContent = isBusy ? "Gerando relatório..." : "Gerar relatório";
    }
    if (nodes.generateDraftPdf) {
      nodes.generateDraftPdf.disabled = isBusy;
      nodes.generateDraftPdf.textContent = isBusy ? "Gerando..." : "Gerar Rascunho";
    }
    if (nodes.generateFinalPdf) {
      nodes.generateFinalPdf.disabled = isBusy;
      nodes.generateFinalPdf.textContent = isBusy ? "Gerando..." : "Gerar Laudo";
    }
  }

  function showPdfStatus(mode, message) {
    nodes.pdfEyebrow.textContent = mode === "final" ? "Laudo final" : "Rascunho";
    nodes.pdfTitle.textContent = "Gerando PDF";
    nodes.pdfStatus.textContent = message;
    nodes.pdfActions.hidden = true;
    nodes.pdfPreflight.hidden = true;
    nodes.pdfDialog.showModal();
  }

  function showPreflightBlocked(review) {
    nodes.pdfEyebrow.textContent = "Preflight";
    nodes.pdfTitle.textContent = "O laudo final ainda não pode ser emitido.";
    nodes.pdfStatus.textContent = "Revise os pontos abaixo antes de tentar gerar o laudo final.";
    nodes.pdfActions.hidden = true;
    nodes.pdfPreflight.hidden = false;
    nodes.pdfBlockers.innerHTML = renderPreflightIssues(review && review.blockers, "Nenhum bloqueio encontrado.");
    nodes.pdfWarnings.innerHTML = renderPreflightIssues(review && review.warnings, "Nenhum alerta encontrado.");
    nodes.pdfDialog.showModal();
  }

  function renderPreflightIssues(issues, emptyText) {
    const list = Array.isArray(issues) ? issues : [];
    if (!list.length) return `<p>${emptyText}</p>`;
    return list.map((issue) => `<article><strong>${escapeHtml(issue.title || "Pendência da vistoria")}</strong><p>${escapeHtml(issue.message || issue.description || "Revise este item antes da emissão final.")}</p>${issue.item ? `<p>${escapeHtml([issue.ambiente, issue.sistema, issue.item].filter(Boolean).join(" · "))}</p>` : ""}</article>`).join("");
  }

  function filenameFromDisposition(disposition) {
    const match = /filename="?([^";]+)"?/i.exec(disposition || "");
    return match ? match[1] : "";
  }

  function defaultPdfFilename(mode) {
    const metadata = state.inspection.metadata || {};
    const name = [metadata.projectName || "Empreendimento", metadata.unitName || "Unidade"].map((part) => String(part).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")).join("-");
    return `${mode === "final" ? "Laudo" : "Rascunho"}-Vistoria-${name}.pdf`;
  }
  function openSummary() { const s = computeSummary(); const c = s.counts; nodes.fullSummary.innerHTML = `<div class="summary-list"><p>Total de itens: <strong>${c.total}</strong></p><p>% inspecionado: <strong>${c.inspectedPercent}%</strong></p><p>Conformes: <strong>${c.C}</strong></p><p>Não conformes: <strong>${c.NC}</strong></p><p>Não aplicáveis: <strong>${c.NA}</strong></p><p>Não verificados: <strong>${c.NV}</strong></p><p>Não inspecionados: <strong>${c[NOT_INSPECTED]}</strong></p></div><div class="summary-list">${s.nonConformities.map((nc) => `<article class="nc-row"><strong>${escapeHtml(nc.environment)} · ${escapeHtml(nc.system)}</strong><p>${escapeHtml(nc.item)}</p><p>Severidade: ${escapeHtml(nc.severity)} · Foto existente: ${nc.photoCount ? "SIM" : "NÃO"}</p><p>${escapeHtml(nc.notes || "Sem descrição")}</p></article>`).join("") || "<p>Nenhuma NC registrada.</p>"}</div>`; nodes.summaryDialog.showModal(); }

  function fillSelect(select, options, selected) { select.innerHTML = options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join(""); if (selected) select.value = selected; }
  function updatePhotoStatus(result) {
    const total = result.photoIds.length + pendingPhotos.length;
    nodes.photoStatus.textContent = `${total} foto(s) vinculada(s)`;
    nodes.primaryPhoto.innerHTML = result.photoIds.map((id, index) => `<option value="${id}">Foto ${index + 1}</option>`).join("");
    nodes.primaryPhoto.disabled = !result.photoIds.length;
    nodes.primaryPhoto.value = result.photoPrincipalId || result.photoIds[0] || "";
  }

  function renderAiSuggestion(result) {
    const suggestion = result.aiSuggestion;
    nodes.aiCard.hidden = !suggestion;
    if (!suggestion) {
      nodes.aiStatus.textContent = "";
      return;
    }
    if (!nodes.aiStatus.textContent) nodes.aiStatus.textContent = "Sugestão pronta";
    const context = suggestion.context || {};
    const contextLabel = [envName(context.environmentId), systemName(context.systemId), itemById(context.itemId)?.title || itemById(context.itemId)?.name || context.itemId].filter(Boolean).join(" → ");
    const recommendationLabel = suggestion.recommendation
      ? `Recomendação: ${suggestion.recommendation}`
      : "Recomendação: A IA não retornou recomendação técnica para esta imagem.";
    const mismatchLabel = suggestion.itemMismatch
      ? " A imagem pode não corresponder ao item atual. Revise o enquadramento ou escolha outro item."
      : "";
    const relatedLabel = [suggestion.suggestedItemId, suggestion.suggestedSystemId, suggestion.suggestedEnvironmentId].filter(Boolean).length
      ? ` Sugestão alternativa informada pela IA: ${suggestion.suggestedItemId || "item atual"} · ${suggestion.suggestedSystemId || "sistema atual"} · ${suggestion.suggestedEnvironmentId || "ambiente atual"}.`
      : "";
    nodes.aiHeading.textContent = suggestion.detectedIssue ? "Possível não conformidade" : "IA não identificou não conformidade visual aparente";
    nodes.aiDescription.textContent = `Descrição: ${suggestion.technicalDescription || "Sem descrição sugerida."}`;
    nodes.aiRecommendation.textContent = recommendationLabel;
    nodes.aiMeta.textContent = `Status sugerido: ${suggestion.suggestedStatus || "-"} · Severidade: ${suggestion.suggestedSeverity || "não informada"} · Confiança: ${suggestion.confidence || "não informada"} · Fonte da recomendação: ${suggestion.recommendationSource || "not_returned"}`;
    nodes.aiTarget.textContent = `Contexto analisado: ${contextLabel || "não informado"}.${mismatchLabel}${relatedLabel}`;
  }

  async function getStoredPhoto(id) {
    const db = await openPhotoDb();
    const photo = await new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readonly");
      const req = tx.objectStore(PHOTO_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return photo;
  }

  async function analyzeActivePhoto() {
    const result = state.inspection.results[activeResultKey];
    if (!result) return;
    const photoId = nodes.primaryPhoto.value || result.photoPrincipalId || result.photoIds[0];
    if (!photoId) { nodes.aiStatus.textContent = "Adicione uma foto antes de analisar."; return; }
    result.photoPrincipalId = photoId;
    nodes.analyzeAi.textContent = "Analisando...";
    nodes.analyzeAi.disabled = true;
    nodes.aiStatus.textContent = "Analisando...";
    try {
      const photo = await getStoredPhoto(photoId);
      if (!photo) throw new Error("photo_not_found");
      const item = itemById(result.inspectionItemId);
      const suggestion = await window.VistoriaEntregaAI.analyzeInspectionPhoto({
        image: { file: photo.data, fileName: photo.fileName, mimeType: photo.mimeType },
        environment: template.environments.find((env) => env.id === result.environmentId),
        system: template.systems.find((system) => system.id === result.systemId),
        item,
        acceptanceCriteria: item.acceptanceCriteria,
        existingResult: result
      });
      result.aiSuggestion = { ...suggestion, analyzedAt: new Date().toISOString(), photoId, acceptedFields: [] };
      result.aiReview = { suggestedAt: result.aiSuggestion.analyzedAt, acceptedAt: "", changedByUserAfterSuggestion: false };
      nodes.aiStatus.textContent = "Sugestão pronta";
      renderAiSuggestion(result);
      persist();
    } catch (error) {
      nodes.aiStatus.textContent = error.publicMessage || "Não foi possível analisar a foto. Tentar novamente.";
    } finally {
      nodes.analyzeAi.textContent = "Analisar foto com IA";
      nodes.analyzeAi.disabled = false;
    }
  }

  function applyAiField(field) {
    const result = state.inspection.results[activeResultKey];
    const suggestion = result && result.aiSuggestion;
    if (!suggestion) return;
    let applied = false;
    if (field === "description" && suggestion.technicalDescription) { nodes.ncNotes.value = suggestion.technicalDescription; applied = true; }
    if (field === "severity" && suggestion.suggestedSeverity) { nodes.ncSeverity.value = suggestion.suggestedSeverity; applied = true; }
    if (field === "recommendation" && suggestion.recommendation) { nodes.ncRecommendation.value = suggestion.recommendation; applied = true; }
    if (field === "status" && suggestion.suggestedStatus) { setDraftStatus(suggestion.suggestedStatus); applied = true; }
    if (field === "item" && (suggestion.suggestedItemId || suggestion.suggestedSystemId)) { result.suggestedItemAccepted = { itemId: suggestion.suggestedItemId, systemId: suggestion.suggestedSystemId, acceptedAt: new Date().toISOString() }; applied = true; }
    if (field === "environment" && suggestion.suggestedEnvironmentId) { result.suggestedEnvironmentAccepted = { environmentId: suggestion.suggestedEnvironmentId, acceptedAt: new Date().toISOString() }; applied = true; }
    if (!applied) return;
    suggestion.acceptedFields = Array.from(new Set([...(suggestion.acceptedFields || []), field]));
    result.aiReview = { ...(result.aiReview || {}), acceptedAt: new Date().toISOString() };
    persist();
  }

  function dismissAiSuggestion() {
    const result = state.inspection.results[activeResultKey];
    if (!result) return;
    result.aiSuggestion = null;
    renderAiSuggestion(result);
    persist();
  }
  function envName(id) { return template.environments.find((env) => env.id === id)?.name || id; }
  function systemName(id) { return template.systems.find((system) => system.id === id)?.name || id; }
  function itemById(id) { return template.items.find((item) => item.id === id) || template.items[0]; }
  function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }

  function openPhotoDb() { return new Promise((resolve, reject) => { const request = indexedDB.open(PHOTO_DB, 1); request.onupgradeneeded = () => request.result.createObjectStore(PHOTO_STORE, { keyPath: "id" }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  async function storePhoto(file, result) { const buffer = await file.arrayBuffer(); const photo = { id: "photo-" + Date.now() + "-" + Math.random().toString(16).slice(2), itemId: result.inspectionItemId, inspectionItemId: result.inspectionItemId, environmentId: result.environmentId, createdAt: new Date().toISOString(), data: new Blob([buffer], { type: file.type || "image/jpeg" }), fileName: file.name, mimeType: file.type || "image/jpeg", size: file.size }; const db = await openPhotoDb(); await new Promise((resolve, reject) => { const tx = db.transaction(PHOTO_STORE, "readwrite"); tx.objectStore(PHOTO_STORE).put(photo); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close(); return photo; }

  const adapters = { aiVisual: { toInspectionResultSuggestion: (analysis) => ({ aiSuggestion: analysis || null, status: analysis?.status || "", notes: analysis?.technicalDescription || analysis?.description || "" }) }, photos: { toInspectionPhotoLink: (photo, result) => ({ type: "inspectionPhotoLink", id: photo.id, itemId: result.inspectionItemId, environmentId: result.environmentId, inspectionItemId: result.inspectionItemId, storedIn: "indexedDB", fileName: photo.fileName, mimeType: photo.mimeType, size: photo.size, createdAt: photo.createdAt }) }, reportDataJson: { toReportDataJson: (session) => ({ type: session.type, inspection: session.inspection }) } };

  nodes.fields.forEach((field) => field.addEventListener("input", () => { state.inspection.metadata[field.dataset.field] = field.value; persist(); }));
  document.querySelectorAll("[data-view-button]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.viewButton)));
  document.querySelector("[data-start-inspection]").addEventListener("click", () => { state.inspection.startedAt = state.inspection.startedAt || new Date().toISOString(); showView("dashboard"); });
  document.querySelector("[data-add-instrument]").addEventListener("click", addInstrument);
  nodes.filterChips.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { activeFilter = button.dataset.filter; nodes.filterChips.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b === button))); renderItems(); }));
  nodes.ncFilterChips.querySelectorAll("[data-nc-filter]").forEach((button) => button.addEventListener("click", () => { activeNcFilter = button.dataset.ncFilter; nodes.ncFilterChips.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b === button))); renderGlobalNcs(); }));
  nodes.searchInput.addEventListener("input", renderItems);
  document.querySelectorAll("[data-sheet-status]").forEach((button) => button.addEventListener("click", () => setDraftStatus(button.dataset.sheetStatus)));
  function syncPendingPhotosFromInputs() {
    const result = state.inspection.results[activeResultKey];
    if (!result) return;
    const files = [nodes.ncPhotoCamera, nodes.ncPhotoGallery]
      .filter(Boolean)
      .flatMap((input) => Array.from(input.files || []));
    const slots = Math.max(0, MAX_PHOTOS - result.photoIds.length);
    pendingPhotos = files.slice(0, slots);
    updatePhotoStatus(result);
  }
  [nodes.ncPhotoCamera, nodes.ncPhotoGallery].filter(Boolean).forEach((input) => input.addEventListener("change", syncPendingPhotosFromInputs));
  nodes.primaryPhoto.addEventListener("change", () => { const result = state.inspection.results[activeResultKey]; if (result) { result.photoPrincipalId = nodes.primaryPhoto.value; persist(); } });
  nodes.analyzeAi.addEventListener("click", analyzeActivePhoto);
  document.querySelectorAll("[data-apply-ai]").forEach((button) => button.addEventListener("click", () => applyAiField(button.dataset.applyAi)));
  document.querySelector("[data-dismiss-ai]").addEventListener("click", dismissAiSuggestion);
  document.querySelector("[data-save-item]").addEventListener("click", saveItem);
  document.querySelector("[data-close-sheet]").addEventListener("click", closeSheet);
  document.querySelector("[data-finish-environment]").addEventListener("click", finishEnvironment);
  document.querySelector("[data-confirm-bulk]").addEventListener("click", bulkConfirmEnvironment);
  document.querySelector("[data-cancel-bulk]").addEventListener("click", () => nodes.bulkDialog.close());
  document.querySelector("[data-mark-environment-na]").addEventListener("click", markEnvironmentNa);
  document.querySelector("[data-confirm-env-na]").addEventListener("click", confirmEnvironmentNa);
  document.querySelector("[data-cancel-env-na]").addEventListener("click", () => nodes.envNaDialog.close());
  document.querySelector("[data-finalize-inspection]").addEventListener("click", finalizeInspection);
  document.querySelector("[data-confirm-finalize]").addEventListener("click", confirmFinalize);
  document.querySelector("[data-cancel-finalize]").addEventListener("click", () => nodes.finalizeDialog.close());
  nodes.reopenButton.addEventListener("click", reopenInspection);
  nodes.generateReport.addEventListener("click", generateReportFromTop);
  nodes.generateDraftPdf.addEventListener("click", () => generateInspectionPdf("draft"));
  nodes.generateFinalPdf.addEventListener("click", () => generateInspectionPdf("final"));
  document.querySelector("[data-close-pdf-dialog]").addEventListener("click", () => nodes.pdfDialog.close());
  document.querySelector("[data-summary-button]").addEventListener("click", openSummary);
  document.querySelector("[data-close-summary]").addEventListener("click", () => nodes.summaryDialog.close());

  window.VistoriaEntregaApp = { adapters, template, getState: () => JSON.parse(JSON.stringify(state)), buildApartmentHandoverPdfPayload, generateInspectionPdf, generateReportFromTop, queueInspectionSync, retryPendingSync, getSyncContext: () => ({ ...syncContextSnapshot }), isSyncEnabled: () => syncEnabled, getSyncMetadata: () => JSON.parse(JSON.stringify(getSyncMetadata())), maybeHydrateRemote: (remote, options) => window.ApartmentHandoverInspectionSync ? window.ApartmentHandoverInspectionSync.maybeHydrateRemote(state, remote, options || {}) : { applied: false, reason: "sync_unavailable", state }, reset: () => { localStorage.removeItem(STORAGE_KEY); state = createSession(); activeSystemId = "all"; activeFilter = "all"; activeNcFilter = "all"; syncController = null; showView("identification"); }, buildPerformanceTemplate: (count = 300) => Array.from({ length: count }, (_, index) => ({ ...template.items[index % template.items.length], id: "perf-" + index })) };

  initSyncController();
  showView(state.currentView || "identification");
  retryPendingSyncLater("app_open");
})();

