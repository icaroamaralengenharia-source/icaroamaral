const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const workspaceWindow = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "rdo-project-workspace.js"), "utf8"), { window: workspaceWindow });
const { create } = workspaceWindow.ObraReportProjectWorkspace;

const source = fs.readFileSync(path.join(__dirname, "relatorio-qualidade-obras.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "relatorio-qualidade-obras.html"), "utf8");
const clean = (value) => String(value == null ? "" : value).trim();
const plain = (value) => JSON.parse(JSON.stringify(value));
const noOp = () => {};
const works = [
  { id: "canonical-a", name: "Synthetic A", institutionId: "tenant-a", canonicalStockWork: true },
  { id: "canonical-b", name: "Synthetic B", institutionId: "tenant-a", canonicalStockWork: true }
];

function extract(name) {
  const start = source.search(new RegExp("^  (?:async )?function " + name + "\\(", "m"));
  assert.ok(start >= 0, "Missing page function: " + name);
  const end = source.indexOf("\n  }", start);
  assert.ok(end > start, "Missing function end: " + name);
  return source.slice(start, end + 4);
}

function runtime(names, bindings = {}) {
  const context = vm.createContext({ clean, console, ...bindings });
  vm.runInContext(names.map(extract).join("\n"), context, { filename: "project-workspace-page-functions.js" });
  return context;
}

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) || null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key)
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function projectRuntime(names, overrides = {}) {
  const calls = { status: [], formLoads: [], draftClears: [], requests: [] };
  const adapter = {
    listStockWorks: async () => works,
    listRdosByWork: async () => [],
    mapRdoToDailyLog: (row, userId) => ({ ...row, workId: row.project_id || row.workId, userId }),
    ...overrides
  };
  const workspace = create({ adapter, storage: memoryStorage(), getUserId: () => "user-a" });
  await workspace.loadProjects();
  workspace.selectProject("canonical-a");
  const dependencies = names.some((name) => ["loadRdosForWork_", "activateProject_"].includes(name)) ? ["loadActiveProjectHistory_"] : [];
  const ctx = runtime([...dependencies, ...names], {
    projectWorkspaceEnabled: true,
    rdoProjectWorkspace: workspace,
    rdoCloudAdapter: adapter,
    currentUser: { id: "user-a", name: "Synthetic User" },
    appState: { works: plain(works), dailyLogs: [], session: { institutionId: "tenant-a", userId: "user-a" }, local: { lastWorkId: "canonical-a" } },
    canonicalStockWorksLoaded: true,
    canonicalStockWorksLoadError: "",
    canonicalRdoListLoadError: "",
    rdoLoadGeneration: 0,
    dailyLogEditorRevision: 0,
    projectHistoryLoading: false,
    dailyLogSearchTerm: "",
    dailyLogSearchInput: null,
    rdoServerIds: new Set(),
    dailyLogWorkSelect: { value: "canonical-a" },
    dailyLogForm: { elements: { dailyLogId: { value: "" }, date: { value: "2026-10-14" } } },
    dailyLogSaveButton: null,
    window: { setTimeout: (fn) => fn() },
    getActiveProject_: () => workspace.getActiveWork(),
    renderProjectWorkspace_: noOp,
    setDailyLogStatus_: (...args) => calls.status.push(args),
    renderSaasState_: noOp,
    saveLocalData: noOp,
    recordRdoE2EUiList_: noOp,
    runPendingRdoE2EPostReloadReadbacks_: async () => {},
    isRdoE2EDiagnosticsEnabled_: () => false,
    ensureLocalState_: noOp,
    setLastOpened_: noOp,
    refreshExecutionStockAnalysisAfterRdoSave_: noOp,
    resetDailyLogForm_: noOp,
    clearDailyLogDraftForLog_: (record) => calls.draftClears.push(record.id),
    loadDailyLogIntoForm_: (id) => calls.formLoads.push(id),
    collectDailyLogForm_: () => ({ id: "draft-a", workId: "canonical-a", date: "2026-10-14", responsible: "Synthetic User" })
  });
  function switchToB() {
    workspace.selectProject("canonical-b");
    ctx.dailyLogWorkSelect.value = "canonical-b";
    ctx.appState.local.lastWorkId = "canonical-b";
    ctx.appState.dailyLogs = [{ id: "rdo-b", workId: "canonical-b" }];
    ctx.rdoServerIds = new Set(["rdo-b"]);
    ctx.dailyLogForm.elements.dailyLogId.value = "rdo-b";
  }
  return { ctx, calls, adapter, workspace, switchToB };
}

test("project workspace login/default route is Obras and diary requires an authorized active project", () => {
  let active = null;
  const ctx = runtime(["getDefaultRouteForRole_", "coerceRouteForRole_"], {
    projectWorkspaceEnabled: true,
    isAdminUser_: () => true,
    isStockAiPublicDemo_: () => false,
    getAdminRoutes_: () => ["obras", "obra", "diario", "dashboard"],
    getClientRoutes_: () => ["cliente"],
    getActiveProject_: () => active
  });
  assert.equal(ctx.getDefaultRouteForRole_(), "obras");
  assert.equal(ctx.coerceRouteForRole_("dashboard"), "obras");
  assert.equal(ctx.coerceRouteForRole_("diario"), "obras");
  assert.equal(ctx.coerceRouteForRole_("obra"), "obras");
  active = works[1];
  assert.equal(ctx.coerceRouteForRole_("diario"), "diario");
  assert.equal(ctx.coerceRouteForRole_("obra"), "obra");
  const loginStart = source.indexOf('loginForm.addEventListener("submit"');
  const loginEnd = source.indexOf('logoutButton', loginStart);
  const login = source.slice(loginStart, loginEnd > loginStart ? loginEnd : loginStart + 7000);
  assert.match(login, /await loadCanonicalRdoWorkspace_\(\)/);
  assert.match(login, /showDashboardPanel_\(projectWorkspaceEnabled \? getDefaultRouteForRole_\(\) : getRouteFromHash_\(\)\)/);
});

test("late project A history cannot replace project B records", async () => {
  const request = deferred();
  const { ctx, switchToB } = await projectRuntime(["loadRdosForWork_"], {
    listRdosByWork: () => request.promise
  });
  const pending = ctx.loadRdosForWork_("canonical-a");
  switchToB();
  request.resolve([{ id: "rdo-a", project_id: "canonical-a" }]);
  await pending;
  assert.deepEqual(plain(ctx.appState.dailyLogs), [{ id: "rdo-b", workId: "canonical-b" }]);
  assert.deepEqual([...ctx.rdoServerIds], ["rdo-b"]);
  assert.equal(ctx.appState.local.lastWorkId, "canonical-b");
});

test("late project A backend open cannot fill the project B editor", async () => {
  const request = deferred();
  const { ctx, calls, switchToB } = await projectRuntime(["openDailyLogFromBackend_"], { getRdo: () => request.promise });
  const pending = ctx.openDailyLogFromBackend_("rdo-a");
  switchToB();
  request.resolve({ id: "rdo-a", project_id: "canonical-a" });
  assert.equal(await pending, null);
  assert.deepEqual(calls.formLoads, []);
  assert.deepEqual(plain(ctx.appState.dailyLogs), [{ id: "rdo-b", workId: "canonical-b" }]);
  assert.equal(ctx.dailyLogForm.elements.dailyLogId.value, "rdo-b");
});

test("backend open rejects an RDO belonging to another canonical project", async () => {
  const { ctx, calls } = await projectRuntime(["openDailyLogFromBackend_"], {
    getRdo: async () => ({ id: "rdo-b", project_id: "canonical-b" })
  });
  await assert.rejects(ctx.openDailyLogFromBackend_("rdo-b"), /rdo_work_mismatch/);
  assert.deepEqual(calls.formLoads, []);
  assert.equal(ctx.appState.dailyLogs.length, 0);
});

test("late project A save does not overwrite editor/history or clear project B draft", async () => {
  const request = deferred();
  const { ctx, calls, switchToB } = await projectRuntime(["saveDailyLogFromForm_"], { createRdo: () => request.promise });
  const pending = ctx.saveDailyLogFromForm_();
  switchToB();
  request.resolve({ id: "server-rdo-a", project_id: "canonical-a" });
  assert.equal(await pending, null);
  assert.deepEqual(plain(ctx.appState.dailyLogs), [{ id: "rdo-b", workId: "canonical-b" }]);
  assert.deepEqual([...ctx.rdoServerIds], ["rdo-b"]);
  assert.equal(ctx.dailyLogForm.elements.dailyLogId.value, "rdo-b");
  assert.deepEqual(calls.draftClears, []);
});

test("save rejects a form whose canonical project differs from the active workspace", async () => {
  let saves = 0;
  const { ctx } = await projectRuntime(["saveDailyLogFromForm_"], { createRdo: async () => { saves += 1; } });
  ctx.collectDailyLogForm_ = () => ({ id: "draft-b", workId: "canonical-b", date: "2026-10-14", responsible: "Synthetic" });
  assert.equal(await ctx.saveDailyLogFromForm_(), null);
  assert.equal(saves, 0);
});

for (const state of ["loading", "failed"]) {
  test("save waits for authoritative history when project history is " + state, async () => {
    let saves = 0;
    const { ctx } = await projectRuntime(["saveDailyLogFromForm_"], {
      createRdo: async () => { saves += 1; },
      updateRdo: async () => { saves += 1; }
    });
    ctx.projectHistoryLoading = state === "loading";
    ctx.canonicalRdoListLoadError = state === "failed" ? "Synthetic history failure" : "";
    ctx.dailyLogForm.elements.dailyLogId.value = "server-rdo-a";
    assert.equal(await ctx.saveDailyLogFromForm_(), null);
    assert.equal(saves, 0);
  });
}

test("new RDO inherits the active canonical project without deleting drafts", async () => {
  const { ctx, workspace } = await projectRuntime(["startQuickDailyLog_"]);
  workspace.selectProject("canonical-b");
  const events = [];
  ctx.dailyLogWorkSelect.value = "canonical-a";
  ctx.flushDailyLogDraft_ = () => events.push("flush");
  ctx.resetDailyLogForm_ = (options) => events.push({ reset: plain(options) });
  ctx.showDashboardPanel_ = (route) => events.push({ route });
  ctx.setLastOpened_ = (...args) => events.push({ lastOpened: args });
  ctx.document = { getElementById: () => null };
  ctx.focusElementSoon_ = noOp;
  ctx.startQuickDailyLog_();
  assert.equal(ctx.dailyLogWorkSelect.value, "canonical-b");
  assert.equal(events[0], "flush");
  assert.ok(events.some((event) => event.reset && event.reset.clearDraft === false));
  assert.ok(events.some((event) => event.route === "diario"));
  assert.ok(events.some((event) => event.lastOpened && event.lastOpened[2] === "canonical-b"));
  workspace.selectProject("");
  events.length = 0;
  ctx.startQuickDailyLog_();
  assert.deepEqual(events, [{ route: "obras" }]);
});

test("switching projects flushes the previous draft before selecting the next canonical project", async () => {
  const events = [];
  const { ctx, workspace } = await projectRuntime(["activateProject_"], {
    listRdosByWork: async (id) => {
      events.push({ history: id });
      return [{ id: "rdo-b", project_id: "canonical-b" }];
    }
  });
  ctx.dailyLogWorkSelect.value = "canonical-b";
  ctx.flushDailyLogDraft_ = () => events.push({ flush: ctx.dailyLogWorkSelect.value });
  ctx.resetDailyLogForm_ = () => {
    ctx.dailyLogWorkSelect.value = workspace.getActiveId();
    ctx.dailyLogForm.elements.dailyLogId.value = "";
  };
  ctx.showDashboardPanel_ = (route) => events.push({ route });
  ctx.restoreDailyLogDraftForCurrentContext_ = () => events.push({ restore: workspace.getActiveId() });
  assert.equal(await ctx.activateProject_("canonical-b"), true);
  assert.deepEqual(events, [
    { flush: "canonical-a" }, { route: "obra" }, { history: "canonical-b" }, { restore: "canonical-b" }
  ]);
  assert.equal(workspace.getActiveId(), "canonical-b");
  assert.equal(ctx.appState.dailyLogs.length, 1);
  assert.equal(ctx.appState.dailyLogs[0].workId, "canonical-b");
});

test("successful create preserves the server ID and the next save updates that same ID", async () => {
  const mutations = [];
  const { ctx, workspace } = await projectRuntime(["saveDailyLogFromForm_"], {
    createRdo: async (log, work) => {
      mutations.push({ action: "create", projectId: work.id });
      return { id: "server-rdo-a", project_id: work.id, date: log.date };
    },
    updateRdo: async (id, log, work) => {
      mutations.push({ action: "update", id, projectId: work.id });
      return { id, project_id: work.id, date: log.date };
    }
  });
  ctx.collectDailyLogForm_ = () => ({
    id: ctx.dailyLogForm.elements.dailyLogId.value || "local-draft-a",
    workId: "canonical-a", date: "2026-10-14", responsible: "Synthetic User"
  });
  assert.equal((await ctx.saveDailyLogFromForm_()).id, "server-rdo-a");
  assert.equal(ctx.dailyLogForm.elements.dailyLogId.value, "server-rdo-a");
  assert.equal((await ctx.saveDailyLogFromForm_()).id, "server-rdo-a");
  assert.deepEqual(mutations, [
    { action: "create", projectId: "canonical-a" },
    { action: "update", id: "server-rdo-a", projectId: "canonical-a" }
  ]);
  assert.equal(ctx.appState.dailyLogs.length, 1);
  assert.equal(workspace.getRecords().length, 1);
});

test("last draft restoration stays in the same tenant, user and work", () => {
  const current = { tenantId: "tenant-a", userId: "user-a", workId: "canonical-a", date: "2026-10-14" };
  let payload;
  const ctx = runtime(["findLastDailyLogDraftPayload_"], {
    projectWorkspaceEnabled: true,
    getDailyLogDraftIdentity_: (item) => item,
    buildDailyLogDraftLastStorageKey_: () => "synthetic-last-key",
    window: { localStorage: { getItem: () => "synthetic-draft-key" } },
    readDailyLogDraftPayload_: () => payload
  });
  payload = { identity: { ...current }, logItem: { id: "draft-a" } };
  assert.equal(ctx.findLastDailyLogDraftPayload_(current), payload);
  for (const [field, other] of Object.entries({ tenantId: "tenant-b", userId: "user-b", workId: "canonical-b" })) {
    payload = { identity: { ...current, [field]: other }, logItem: { id: "draft-other" } };
    assert.equal(ctx.findLastDailyLogDraftPayload_(current), null, "must reject different " + field);
  }
  payload = { identity: { ...current }, logItem: { id: "draft-a" } };
  assert.equal(ctx.findLastDailyLogDraftPayload_({ ...current, workId: "sem-obra" }), null);
});

test("best draft lookup requires exact tenant, user, work and date", () => {
  const current = { tenantId: "tenant-a", userId: "user-a", workId: "canonical-a", date: "2026-10-14" };
  let payload;
  const ctx = runtime(["findBestDailyLogDraftPayload_"], {
    getDailyLogDraftIdentity_: (item) => item,
    readDailyLogDraftIndex_: () => ["synthetic-draft"],
    readDailyLogDraftPayload_: () => payload,
    compareIsoDate_: (a, b) => Date.parse(a) - Date.parse(b)
  });
  payload = { identity: { ...current }, logItem: { id: "draft-a" } };
  assert.equal(ctx.findBestDailyLogDraftPayload_(current), payload);
  for (const [field, other] of Object.entries({ tenantId: "tenant-b", userId: "user-b", workId: "canonical-b", date: "2026-10-13" })) {
    payload = { identity: { ...current, [field]: other }, logItem: { id: "draft-other" } };
    assert.equal(ctx.findBestDailyLogDraftPayload_(current), null, "must reject different " + field);
  }
});

test("project workspace markup loads its module before the page and directs project creation to Stock", () => {
  const modulePosition = html.indexOf('src="./rdo-project-workspace.js?');
  const pagePosition = html.indexOf('src="./relatorio-qualidade-obras.js?');
  assert.ok(modulePosition >= 0 && pagePosition > modulePosition);
  const homeStart = html.indexOf('id="canonicalWorkListSection"');
  assert.ok(homeStart > 0);
  const area = html.slice(Math.max(0, homeStart - 2500), homeStart + 800);
  assert.match(area, /href="[^"\n]*stockfull\.html[^"\n]*"/);
  assert.match(html, /data-route="obra"/);
  assert.match(html, /id="activeProjectNewRdoBtn"/);
});

test("client home is Obras with project reading allowed and diary editing denied", () => {
  let active = null;
  const ctx = runtime(["getDefaultRouteForRole_", "coerceRouteForRole_", "getClientRoutes_"], {
    projectWorkspaceEnabled: true,
    isAdminUser_: () => false,
    isStockAiPublicDemo_: () => false,
    getActiveProject_: () => active
  });
  assert.equal(ctx.getDefaultRouteForRole_(), "obras");
  assert.equal(ctx.coerceRouteForRole_("obra"), "obras");
  active = works[0];
  assert.equal(ctx.coerceRouteForRole_("obra"), "obra");
  assert.equal(ctx.coerceRouteForRole_("obras"), "obras");
  assert.equal(ctx.coerceRouteForRole_("diario"), "obras");
  ctx.projectWorkspaceEnabled = false;
  assert.equal(ctx.getDefaultRouteForRole_(), "cliente");
  assert.equal(ctx.coerceRouteForRole_("obra"), "cliente");
});

test("client workspace exposes PDF reading while disabling new RDO and material editing", async () => {
  const { ctx } = await projectRuntime(["renderProjectWorkspace_"]);
  const rows = [];
  const nodes = new Map([
    ["activeProjectNewRdoBtn", {}], ["activeProjectMaterialsBtn", {}],
    ["activeProjectHistory", { replaceChildren: noOp, appendChild: (row) => rows.push(row) }]
  ]);
  ctx.document = { getElementById: (id) => nodes.get(id) || null };
  ctx.isAdminUser_ = () => false;
  ctx.getUserDailyLogs_ = () => [{ id: "rdo-a", workId: "canonical-a", date: "2026-10-14" }];
  ctx.createMiniButton_ = (label) => ({ label });
  ctx.createEntityItem_ = (title, detail, actions) => ({ title, detail, actions, dataset: {}, classList: { add: noOp } });
  ctx.formatDateOnly_ = (date) => date;
  ctx.renderProjectWorkspace_();
  assert.equal(nodes.get("activeProjectNewRdoBtn").disabled, true);
  assert.equal(nodes.get("activeProjectMaterialsBtn").disabled, true);
  assert.deepEqual(plain(rows[0].actions), [{ label: "PDF" }]);
});

test("a superseded backend open in the same project cannot replace the latest editor", async () => {
  const first = deferred();
  const second = deferred();
  const { ctx, calls } = await projectRuntime(["openDailyLogFromBackend_"], {
    getRdo: (id) => id === "older-open" ? first.promise : second.promise
  });
  const earlier = ctx.openDailyLogFromBackend_("older-open");
  const later = ctx.openDailyLogFromBackend_("newer-open");
  second.resolve({ id: "newer-open", project_id: "canonical-a" });
  assert.equal((await later).id, "newer-open");
  first.resolve({ id: "older-open", project_id: "canonical-a" });
  assert.equal(await earlier, null);
  assert.deepEqual(calls.formLoads, ["newer-open"]);
  assert.deepEqual(plain(ctx.appState.dailyLogs).map((row) => row.id), ["newer-open"]);
});

test("a completed save updates history without replacing a new editor or clearing its draft", async () => {
  const request = deferred();
  const { ctx, calls, workspace } = await projectRuntime(["saveDailyLogFromForm_"], { createRdo: () => request.promise });
  const pending = ctx.saveDailyLogFromForm_();
  ctx.dailyLogEditorRevision += 1;
  ctx.dailyLogForm.elements.dailyLogId.value = "new-draft-a";
  request.resolve({ id: "saved-rdo-a", project_id: "canonical-a" });
  assert.equal(await pending, null);
  assert.equal(ctx.dailyLogForm.elements.dailyLogId.value, "new-draft-a");
  assert.equal(ctx.appState.dailyLogs[0].id, "saved-rdo-a");
  assert.equal(workspace.getRecords()[0].id, "saved-rdo-a");
  assert.deepEqual(calls.draftClears, []);
});

test("an obsolete backend open failure does not escape into a new editor", async () => {
  const request = deferred();
  const { ctx, calls } = await projectRuntime(["openDailyLogFromBackend_"], { getRdo: () => request.promise });
  const pending = ctx.openDailyLogFromBackend_("rdo-a");
  ctx.dailyLogEditorRevision += 1;
  request.reject(new Error("Synthetic obsolete open failure"));
  assert.equal(await pending, null);
  assert.deepEqual(calls.status, []);
  assert.deepEqual(calls.formLoads, []);
});

test("an obsolete save failure does not show an error in a new editor", async () => {
  const request = deferred();
  const { ctx, calls } = await projectRuntime(["saveDailyLogFromForm_"], { createRdo: () => request.promise });
  const pending = ctx.saveDailyLogFromForm_();
  calls.status.length = 0;
  ctx.dailyLogEditorRevision += 1;
  ctx.dailyLogForm.elements.dailyLogId.value = "new-draft-a";
  request.reject(new Error("Synthetic obsolete save failure"));
  assert.equal(await pending, null);
  assert.deepEqual(calls.status, []);
  assert.equal(ctx.dailyLogForm.elements.dailyLogId.value, "new-draft-a");
});

test("current photo completion adds the photo and persists its original editor", async () => {
  const { ctx } = await projectRuntime(["addDailyLogPhoto_"]);
  let persisted = 0;
  ctx.dailyLogPhotoInput = { files: [{ name: "synthetic.jpg" }], value: "selected-photo" };
  ctx.dailyLogForm.elements.dailyPhotoCaption = { value: "Synthetic caption" };
  ctx.dailyLogDraft = { photos: [] };
  ctx.enqueueImageProcessing_ = async () => ({ previewDataUrl: "synthetic-image", payload: { synthetic: true } });
  ctx.createId_ = () => "synthetic-photo";
  ctx.renderDailyLogDraftLists_ = noOp;
  ctx.persistDailyLogDraft_ = () => { persisted += 1; };
  await ctx.addDailyLogPhoto_();
  assert.equal(ctx.dailyLogDraft.photos[0].id, "synthetic-photo");
  assert.equal(ctx.dailyLogDraft.photos[0].caption, "Synthetic caption");
  assert.equal(ctx.dailyLogPhotoInput.value, "");
  assert.equal(persisted, 1);
});

test("current AI completion updates the original editor and dispatches input", async () => {
  const { ctx } = await projectRuntime(["handleDiaryAiAction_"]);
  const inputEvents = [];
  let usage = 0;
  const target = { value: "Original", dispatchEvent: (event) => inputEvents.push(event.type) };
  ctx.dailyLogForm.elements.services = target;
  ctx.collectDailyLogSnapshot_ = () => ({ workId: "canonical-a" });
  ctx.buildDailyLogAiContext_ = () => ({});
  ctx.canUseAi_ = () => true;
  ctx.setAiButtonBusy_ = noOp;
  ctx.window.ObraReportAI = { improveTechnicalText: async () => ({ suggestion: "Synthetic improved text" }) };
  ctx.Event = class { constructor(type) { this.type = type; } };
  ctx.registerBillingUsage_ = () => { usage += 1; };
  await ctx.handleDiaryAiAction_({ dataset: { diaryAiTarget: "services", diaryAiAction: "improve" } });
  assert.equal(target.value, "Synthetic improved text");
  assert.deepEqual(inputEvents, ["input"]);
  assert.equal(usage, 1);
});

for (const change of ["project", "editor"]) {
  for (const outcome of ["resolve", "reject"]) {
    test("photo processing cannot affect a different " + change + " after a late " + outcome, async () => {
      const request = deferred();
      const { ctx, calls, switchToB } = await projectRuntime(["addDailyLogPhoto_"]);
      ctx.dailyLogPhotoInput = { files: [{ name: "synthetic.jpg" }], value: "selected-photo" };
      ctx.dailyLogForm.elements.dailyPhotoCaption = { value: "original caption" };
      ctx.dailyLogDraft = { photos: [] };
      ctx.enqueueImageProcessing_ = () => request.promise;
      ctx.renderDailyLogDraftLists_ = noOp;
      ctx.persistDailyLogDraft_ = () => assert.fail("obsolete photo must not persist a draft");
      const pending = ctx.addDailyLogPhoto_();
      if (change === "project") switchToB();
      else ctx.dailyLogEditorRevision += 1;
      ctx.dailyLogDraft = { photos: [{ id: "new-editor-photo" }] };
      ctx.dailyLogPhotoInput.value = "new-selection";
      ctx.dailyLogForm.elements.dailyPhotoCaption.value = "new caption";
      if (outcome === "resolve") request.resolve({ previewDataUrl: "synthetic-image", payload: {} });
      else request.reject(new Error("Synthetic late image failure"));
      await pending;
      assert.deepEqual(ctx.dailyLogDraft.photos, [{ id: "new-editor-photo" }]);
      assert.equal(ctx.dailyLogPhotoInput.value, "new-selection");
      assert.equal(ctx.dailyLogForm.elements.dailyPhotoCaption.value, "new caption");
      assert.deepEqual(calls.status, []);
    });

    test("AI completion cannot affect a different " + change + " after a late " + outcome, async () => {
      const request = deferred();
      const { ctx, calls, switchToB } = await projectRuntime(["handleDiaryAiAction_"]);
      const target = { value: "Original A", dispatchEvent: () => assert.fail("obsolete AI must not dispatch input") };
      ctx.dailyLogForm.elements.services = target;
      ctx.collectDailyLogSnapshot_ = () => ({ workId: "canonical-a" });
      ctx.buildDailyLogAiContext_ = () => ({});
      ctx.canUseAi_ = () => true;
      ctx.setAiButtonBusy_ = noOp;
      ctx.window.ObraReportAI = { improveTechnicalText: () => request.promise };
      ctx.registerBillingUsage_ = () => assert.fail("obsolete AI must not apply billing usage to another editor");
      const pending = ctx.handleDiaryAiAction_({ dataset: { diaryAiTarget: "services", diaryAiAction: "improve" } });
      if (change === "project") switchToB();
      else ctx.dailyLogEditorRevision += 1;
      target.value = "New editor text";
      if (outcome === "resolve") request.resolve({ suggestion: "Old A suggestion" });
      else request.reject(new Error("Synthetic late AI failure"));
      await pending;
      assert.equal(target.value, "New editor text");
      assert.deepEqual(calls.status, []);
    });
  }
}
