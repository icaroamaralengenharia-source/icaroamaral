const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const snapshotModulePromise = import("./elo-stock-obras-snapshot.js");
const crossModulePromise = import("./elo-execution-stock-cross.js");
const reportModulePromise = import("./elo-execution-stock-report.js");
const todayModulePromise = import("./elo-today-work-core.js");

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    writes: 0,
    reads: 0,
    getItem(key) { this.reads += 1; return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { this.writes += 1; data.set(String(key), String(value)); },
    removeItem(key) { this.writes += 1; data.delete(String(key)); },
    clear() { this.writes += 1; data.clear(); },
    dump() { return Object.fromEntries(data); }
  };
}

function createReadOnlyStorage(initial = {}) {
  const storage = createStorage(initial);
  storage.setItem = function setItem() { this.writes += 1; throw new Error("write_not_allowed"); };
  storage.removeItem = function removeItem() { this.writes += 1; throw new Error("write_not_allowed"); };
  storage.clear = function clear() { this.writes += 1; throw new Error("write_not_allowed"); };
  return storage;
}

function createJwt(payload = {}) {
  function encode(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
  return encode({ alg: "none", typ: "JWT" }) + "." + encode(Object.assign({
    iss: "https://lidueokjpzxdybtongbk.supabase.co/auth/v1",
    exp: Math.floor(Date.now() / 1000) + 3600
  }, payload)) + ".sig";
}

function createElement(tag) {
  let textValue = "";
  const element = {
    tagName: String(tag || "").toUpperCase(),
    dataset: {},
    style: {},
    children: [],
    parentNode: null,
    hidden: false,
    disabled: false,
    events: {},
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    addEventListener(type, listener) { this.events[type] = this.events[type] || []; this.events[type].push(listener); },
    click() { (this.events.click || []).forEach((listener) => listener({ preventDefault() {} })); },
    focus() {},
    setAttribute(name, value) { this[String(name)] = String(value); },
    getAttribute(name) { return this[String(name)] || ""; },
    closest(selector) {
      let node = this;
      while (node) {
        if (selector === "[data-elo-local-actions]" && node.dataset && Object.prototype.hasOwnProperty.call(node.dataset, "eloLocalActions")) return node;
        node = node.parentNode;
      }
      return null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    value: "",
    options: [],
    selectedIndex: -1
  };
  Object.defineProperty(element, "textContent", {
    get() { return textValue; },
    set(value) {
      textValue = value == null ? "" : String(value);
      if (textValue === "") element.children = [];
    }
  });
  return element;
}


function collectElementText(element) {
  if (!element) return "";
  const own = element.textContent || "";
  const children = Array.isArray(element.children) ? element.children.map(collectElementText).join("\n") : "";
  return [own, children].filter(Boolean).join("\n");
}

function findElementByText(element, text) {
  if (!element) return null;
  if ((element.textContent || "") === text) return element;
  const children = Array.isArray(element.children) ? element.children : [];
  for (const child of children) {
    const found = findElementByText(child, text);
    if (found) return found;
  }
  return null;
}
function findAllElementsByText(element, text, found = []) {
  if (!element) return found;
  if ((element.textContent || "") === text) found.push(element);
  const children = Array.isArray(element.children) ? element.children : [];
  for (const child of children) findAllElementsByText(child, text, found);
  return found;
}
function createTrackedClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add(...names) { names.forEach((name) => classes.add(String(name))); },
    remove(...names) { names.forEach((name) => classes.delete(String(name))); },
    toggle(name, force) {
      const key = String(name);
      const shouldAdd = force === undefined ? !classes.has(key) : Boolean(force);
      if (shouldAdd) classes.add(key); else classes.delete(key);
      return shouldAdd;
    },
    contains(name) { return classes.has(String(name)); },
    toArray() { return Array.from(classes).sort(); }
  };
}

function loadAuthGateContext() {
  const html = fs.readFileSync(path.join(__dirname, "..", "elo.html"), "utf8");
  const configMarker = "const config = window.RELATORIO_QUALIDADE_CONFIG || {};";
  const configIndex = html.indexOf(configMarker);
  const scriptStart = html.lastIndexOf("(function () {", configIndex);
  const scriptEndMarker = "})();";
  const scriptEnd = html.indexOf(scriptEndMarker, configIndex);
  assert.ok(configIndex >= 0 && scriptStart >= 0 && scriptEnd > scriptStart, "auth gate script not found");
  const script = html.slice(scriptStart, scriptEnd + scriptEndMarker.length);
  const body = createElement("body");
  body.classList = createTrackedClassList(["elo-auth-required", "elo-empty-state"]);
  const context = {
    window: { RELATORIO_QUALIDADE_CONFIG: {}, ELO_AUTH_SESSION_VALIDATED: false, setInterval() { return 1; } },
    document: { body, addEventListener(event, callback) { if (event === "DOMContentLoaded") callback(); } },
    console
  };
  context.window.window = context.window;
  context.window.document = context.document;
  vm.createContext(context);
  vm.runInContext(script, context, { filename: "elo.html-auth-gate.js" });
  return { context, body, html };
}

async function loadEloContext(options = {}) {
  const localStorage = options.readOnlyStorage ? createReadOnlyStorage(options.localStorage || {}) : createStorage(options.localStorage || {});
  const sessionStorage = createStorage(options.sessionStorage || {});
  const { buildEloStockObrasSnapshot } = await snapshotModulePromise;
  const { crossExecutionWithStock } = await crossModulePromise;
  const { buildExecutionStockReport } = await reportModulePromise;
  const { buildTodayWorkCore } = await todayModulePromise;
  const elements = options.elements || {};
  const context = {
    console,
    setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
    clearTimeout() {},
    Date,
    Math,
    fetch: options.fetch,
    Blob: function Blob() {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    URLSearchParams,
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      ELO_DISABLE_AUTOFOCUS: true,
      ELO_PRODUCT_MODE: true,
      location: { hostname: "localhost", protocol: "http:", pathname: "/elo.html", hash: "", search: "" },
      localStorage,
      sessionStorage,
      addEventListener() {},
      removeEventListener() {},
      crypto: { randomUUID: () => "test-id" },
      open: () => null,
      fetch: options.fetch,
      setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
      clearTimeout() {},
      atob(value) { return Buffer.from(String(value), "base64").toString("binary"); },
      btoa(value) { return Buffer.from(String(value), "binary").toString("base64"); },
      EloStockObrasSnapshot: options.withModules === false ? undefined : { buildEloStockObrasSnapshot },
      EloExecutionStockCross: options.withModules === false ? undefined : { crossExecutionWithStock },
      EloExecutionStockReport: options.withModules === false ? undefined : { buildExecutionStockReport },
    EloTodayWorkCore: options.withModules === false ? undefined : { buildTodayWorkCore }
    },
    document: {
      readyState: "complete",
      body: createElement("body"),
      createElement,
      addEventListener() {},
      querySelector(selector) { return elements[String(selector)] || null; },
      querySelectorAll() { return []; },
      getElementById() { return null; }
    },
    navigator: { userAgent: "node-test" }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.navigator = context.navigator;
  Object.assign(context.window, options.window || {});
  context.globalThis = context.window;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "elo-assistente.js"), "utf8");
  vm.runInContext(source, context, { filename: "elo-assistente.js" });
  return { elo: context.window.EloAssistente, localStorage, sessionStorage, context };
}

function buildRealAppState() {
  return {
    version: 1,
    local: { lastWorkId: "obra-a-work" },
    works: [
      { id: "obra-a-work", name: "Obra A" },
      { id: "obra-b-work", name: "Obra B" }
    ],
    dailyLogs: [
      {
        id: "rdo-a",
        projectId: "proj-a",
        workId: "obra-a-work",
        productions: [{ serviceId: "alvenaria", service: "Alvenaria", quantity: 100, unit: "m2" }],
        materials: [{ name: "Bloco ceramico", unit: "un", quantity: 2600 }]
      },
      {
        id: "rdo-b",
        projectId: "proj-b",
        workId: "obra-b-work",
        productions: [{ serviceId: "alvenaria", service: "Alvenaria", quantity: 900, unit: "m2" }],
        materials: [{ name: "Bloco ceramico", unit: "un", quantity: 9000 }]
      }
    ]
  };
}

function buildLocalStorage(extra = {}) {
  return Object.assign({
    "obrareport-saas-v1": JSON.stringify(buildRealAppState()),
    "obraReport.stockIa.plannedConsumptions": JSON.stringify([
      { projectId: "proj-a", workId: "obra-a-work", serviceId: "alvenaria", material: "Bloco ceramico", unit: "un", coefficient: 25 },
      { projectId: "proj-b", workId: "obra-b-work", serviceId: "alvenaria", material: "Bloco ceramico", unit: "un", coefficient: 99 }
    ]),
    obraReportAlmoxarifadoData: JSON.stringify({ items: [
      { projectId: "proj-a", workId: "obra-a-work", name: "Bloco ceramico", unit: "un", balance: 40 },
      { projectId: "proj-b", workId: "obra-b-work", name: "Bloco ceramico", unit: "un", balance: 8000 }
    ] })
  }, extra);
}

function buildReadyExecutionStockAnalysis(overrides = {}) {
  const result = {
    summary: { workId: "obra-a-work", productions: 1, materials: 1, alerts: 1, services: "Alvenaria" },
    materials: [{ material: "Bloco ceramico", unit: "un", expectedConsumption: 2500, actualStockExit: 2600, currentBalance: 40, difference: 100, status: "consumption_above_expected" }],
    alerts: [{ material: "Bloco ceramico", unit: "un", expectedConsumption: 2500, actualStockExit: 2600, currentBalance: 40, difference: 100, status: "consumption_above_expected" }],
    dataQuality: { hasProductions: true, hasStockMovements: true, hasStockBalances: true, hasSinapiExpectedConsumptions: true, missingSources: [] }
  };
  return Object.assign({ version: 1, status: "ready", workId: "obra-a-work", sourceRdoId: "rdo-a", sourceRdoUpdatedAt: "2026-07-25T10:00:00.000Z", calculatedAt: "2026-07-25T10:01:00.000Z", sourceFingerprint: "safe-fingerprint-without-images", summary: result.summary, result, alerts: result.alerts }, overrides);
}

function buildAppStateWithExecutionStockAnalysis(analysisOverrides = {}) {
  const state = buildRealAppState();
  state.dailyLogs = state.dailyLogs.map((log) => log.id === "rdo-a" ? Object.assign({}, log, { updatedAt: "2026-07-25T10:00:00.000Z" }) : log);
  state.executionStockAnalysis = buildReadyExecutionStockAnalysis(analysisOverrides);
  return state;
}

function buildLocalStorageWithExecutionStockAnalysis(analysisOverrides = {}, extra = {}) {
  return buildLocalStorage(Object.assign({ "obrareport-saas-v1": JSON.stringify(buildAppStateWithExecutionStockAnalysis(analysisOverrides)) }, extra));
}

function buildExecutionStockAlert(overrides = {}) {
  return Object.assign({
    id: "exa-obra-a-rdo-a-bloco",
    version: 1,
    workId: "obra-a-work",
    sourceRdoId: "rdo-a",
    sourceRdoUpdatedAt: "2026-07-25T10:00:00.000Z",
    sourceFingerprint: "fp-alert-a",
    type: "consumption_above_expected",
    severity: "high",
    title: "Consumo acima do previsto em Bloco ceramico",
    summary: "Bloco ceramico teve consumo acima do previsto.",
    recommendation: "Conferir desperdicio e baixa do almoxarifado.",
    serviceCode: "alvenaria",
    serviceName: "Alvenaria",
    materialCode: null,
    materialName: "Bloco ceramico",
    expectedQuantity: 2500,
    actualQuantity: 2600,
    differenceQuantity: 100,
    differencePercent: 4,
    status: "open",
    createdAt: "2026-07-25T10:02:00.000Z",
    updatedAt: "2026-07-25T10:02:00.000Z",
    resolvedAt: null
  }, overrides);
}

function buildAppStateWithExecutionStockAlerts(alerts, options = {}) {
  const state = options.withAnalysis ? buildAppStateWithExecutionStockAnalysis(options.analysisOverrides || {}) : buildRealAppState();
  state.dailyLogs = state.dailyLogs.map((log) => log.id === "rdo-a" ? Object.assign({}, log, { updatedAt: "2026-07-25T10:00:00.000Z" }) : log);
  state.executionStockAlerts = alerts;
  return state;
}

function buildLocalStorageWithExecutionStockAlerts(alerts, options = {}, extra = {}) {
  return buildLocalStorage(Object.assign({ "obrareport-saas-v1": JSON.stringify(buildAppStateWithExecutionStockAlerts(alerts, options)) }, extra));
}

test("ELO usa alerta persistido apos reload sem analysis", async () => {
  let calls = 0;
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorageWithExecutionStockAlerts([buildExecutionStockAlert()]),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });
  const answer = await elo.requestObraAttentionForTest("Quais alertas estao abertos?");

  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.match(answer, /Alertas persistidos da obra/);
  assert.match(answer, /Bloco ceramico/);
  assert.match(answer, /RDO: rdo-a/);
  assert.match(answer, /Fonte: executionStockAlerts local/);
});

test("helper de alertas persistidos rejeita outra obra obsolete e resolved aberto", async () => {
  const alerts = [
    buildExecutionStockAlert(),
    buildExecutionStockAlert({ id: "other-work", workId: "obra-b-work", sourceRdoId: "rdo-b", materialName: "Material B" }),
    buildExecutionStockAlert({ id: "obsolete", status: "obsolete", materialName: "Obsoleto", title: "Obsoleto" }),
    buildExecutionStockAlert({ id: "resolved", status: "resolved", materialName: "Resolvido", title: "Resolvido" })
  ];
  const { elo, localStorage } = await loadEloContext({ readOnlyStorage: true, localStorage: buildLocalStorageWithExecutionStockAlerts(alerts), window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" } });
  const info = elo.getExecutionStockAlertsForTest();
  const answer = await elo.requestObraAttentionForTest("Quais alertas estao abertos?");

  assert.equal(info.openAlerts.length, 1);
  assert.equal(info.openAlerts[0].materialName, "Bloco ceramico");
  assert.equal(localStorage.writes, 0);
  assert.doesNotMatch(answer, /Material B|Obsoleto|Resolvido/);
});

test("alerta acknowledged aparece separado e nao como resolvido", async () => {
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorageWithExecutionStockAlerts([buildExecutionStockAlert({ status: "acknowledged", id: "ack-alert" })]),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" }
  });
  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atencao hoje?");

  assert.equal(localStorage.writes, 0);
  assert.match(answer, /Reconhecidos, ainda nao resolvidos/);
  assert.doesNotMatch(answer, /Historico solicitado/);
});

test("alertas persistidos ordenam critical antes de low", async () => {
  const low = buildExecutionStockAlert({ id: "low-alert", severity: "low", materialName: "Areia", title: "Baixo risco em Areia", updatedAt: "2026-07-25T11:00:00.000Z" });
  const critical = buildExecutionStockAlert({ id: "critical-alert", severity: "critical", materialName: "Cimento", title: "Saldo insuficiente em Cimento", type: "insufficient_balance", updatedAt: "2026-07-25T10:00:00.000Z" });
  const { elo } = await loadEloContext({ readOnlyStorage: true, localStorage: buildLocalStorageWithExecutionStockAlerts([low, critical]), window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" } });
  const answer = await elo.requestObraAttentionForTest("Quais alertas estao abertos?");

  assert.ok(answer.indexOf("Cimento") < answer.indexOf("Areia"));
});

test("mesma ocorrencia nao duplica pela analysis atual", async () => {
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorageWithExecutionStockAlerts([buildExecutionStockAlert()], { withAnalysis: true }),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch() { throw new Error("should_not_fetch"); }
  });
  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atencao hoje?");

  assert.equal(localStorage.writes, 0);
  assert.match(answer, /Alertas persistidos da obra/);
  assert.doesNotMatch(answer, /analise local automatica pronta/);
  assert.equal((answer.match(/Bloco ceramico/g) || []).length, 2);
});

test("sem alertas persistidos cai para executionStockAnalysis", async () => {
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorageWithExecutionStockAnalysis(),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch() { throw new Error("should_not_fetch"); }
  });
  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atencao hoje?");

  assert.equal(localStorage.writes, 0);
  assert.match(answer, /analise local automatica pronta/);
});

test("alertas persistidos sem token nao bloqueiam por autenticacao nem fazem rede", async () => {
  let calls = 0;
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorageWithExecutionStockAlerts([buildExecutionStockAlert()]),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });
  const answer = await elo.requestObraExecutionStockForTest("Existe desperdicio no consumo da obra?");

  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.doesNotMatch(answer, /authentication_required|sessao|autentic/i);
  assert.match(answer, /Alertas persistidos da obra/);
});

test("consulta de alertas persistidos nao escreve storage nem movimenta estoque", async () => {
  let exits = 0;
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorageWithExecutionStockAlerts([buildExecutionStockAlert()]),
    window: {
      ELO_PROJECT_ID: "proj-a",
      ELO_WORK_ID: "obra-a-work",
      ObraReportOperationalStock: { createConfirmedExit() { exits += 1; throw new Error("stock_movement_forbidden"); } }
    },
    fetch() { throw new Error("should_not_fetch"); }
  });
  await elo.requestObraAttentionForTest("Quais alertas estao abertos?");

  assert.equal(exits, 0);
  assert.equal(localStorage.writes, 0);
});

test("historico mostra resolved e obsolete apenas quando solicitado", async () => {
  const alerts = [
    buildExecutionStockAlert({ id: "resolved", status: "resolved", materialName: "Resolvido", title: "Resolvido" }),
    buildExecutionStockAlert({ id: "obsolete", status: "obsolete", materialName: "Obsoleto", title: "Obsoleto" })
  ];
  const { elo } = await loadEloContext({ readOnlyStorage: true, localStorage: buildLocalStorageWithExecutionStockAlerts(alerts), window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" } });
  const openAnswer = await elo.requestObraAttentionForTest("Quais alertas estao abertos?");
  const historyAnswer = await elo.requestObraAttentionForTest("Quais alertas do historico estao resolvidos e obsoletos");

  assert.doesNotMatch(openAnswer, /Resolvido|Obsoleto/);
  assert.match(historyAnswer, /Historico solicitado/);
  assert.match(historyAnswer, /Resolvido/);
  assert.match(historyAnswer, /Obsoleto/);
});

test("ELO responde historico resolvido sem misturar alertas abertos", async () => {
  const alerts = [
    buildExecutionStockAlert({ id: "open-alert", status: "open", materialName: "Aberto", title: "Aberto" }),
    buildExecutionStockAlert({ id: "resolved-alert", status: "resolved", materialName: "Resolvido", title: "Resolvido" })
  ];
  const { elo, localStorage } = await loadEloContext({ readOnlyStorage: true, localStorage: buildLocalStorageWithExecutionStockAlerts(alerts), window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" } });
  const answer = await elo.requestObraAttentionForTest("Quais alertas foram resolvidos?");

  assert.equal(localStorage.writes, 0);
  assert.match(answer, /Historico solicitado/);
  assert.match(answer, /Resolvido/);
  assert.doesNotMatch(answer, /Aberto/);
});

test("ELO responde historico obsoleto sem misturar resolvidos ou abertos", async () => {
  const alerts = [
    buildExecutionStockAlert({ id: "open-alert", status: "open", materialName: "Aberto", title: "Aberto" }),
    buildExecutionStockAlert({ id: "resolved-alert", status: "resolved", materialName: "Resolvido", title: "Resolvido" }),
    buildExecutionStockAlert({ id: "obsolete-alert", status: "obsolete", materialName: "Obsoleto", title: "Obsoleto" })
  ];
  const { elo, localStorage } = await loadEloContext({ readOnlyStorage: true, localStorage: buildLocalStorageWithExecutionStockAlerts(alerts), window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" } });
  const answer = await elo.requestObraAttentionForTest("Quais alertas ficaram obsoletos?");

  assert.equal(localStorage.writes, 0);
  assert.match(answer, /Historico solicitado/);
  assert.match(answer, /Obsoleto/);
  assert.doesNotMatch(answer, /Aberto|Resolvido/);
});

test("pergunta geral continua usando alertas abertos sem historico fechado", async () => {
  const alerts = [
    buildExecutionStockAlert({ id: "open-alert", status: "open", materialName: "Aberto", title: "Aberto" }),
    buildExecutionStockAlert({ id: "resolved-alert", status: "resolved", materialName: "Resolvido", title: "Resolvido" }),
    buildExecutionStockAlert({ id: "obsolete-alert", status: "obsolete", materialName: "Obsoleto", title: "Obsoleto" })
  ];
  const { elo, localStorage } = await loadEloContext({ readOnlyStorage: true, localStorage: buildLocalStorageWithExecutionStockAlerts(alerts), window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" } });
  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atencao hoje?");

  assert.equal(localStorage.writes, 0);
  assert.match(answer, /Aberto/);
  assert.doesNotMatch(answer, /Historico solicitado|Resolvido|Obsoleto/);
});
test("ELO local usa executionStockAnalysis ready antes de erro de autenticacao", async () => {
  let calls = 0;
  const { elo, localStorage } = await loadEloContext({ readOnlyStorage: true, localStorage: buildLocalStorageWithExecutionStockAnalysis(), window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" }, fetch() { calls += 1; throw new Error("should_not_fetch"); } });
  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atencao hoje?");
  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.match(answer, /analise local automatica pronta/);
  assert.match(answer, /Bloco ceramico/);
  assert.match(answer, /esperado 2500 un/);
  assert.match(answer, /saiu 2600 un/);
  assert.match(answer, /4%/);
  assert.match(answer, /Memoria de calculo/);
  assert.doesNotMatch(answer, /authentication_required|sessao|autentic/i);
});

test("helper do ELO rejeita analise de outra obra", async () => {
  const { elo } = await loadEloContext({ localStorage: buildLocalStorageWithExecutionStockAnalysis({ workId: "obra-b-work" }), window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" } });
  const latest = elo.getLatestExecutionStockAnalysisForTest();
  assert.equal(latest.available, false);
  assert.equal(latest.reason, "work_mismatch");
});

test("helper do ELO rejeita analise obsoleta quando RDO de origem mudou", async () => {
  const { elo } = await loadEloContext({ localStorage: buildLocalStorageWithExecutionStockAnalysis({ sourceRdoUpdatedAt: "2026-07-25T09:00:00.000Z" }), window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" } });
  const latest = elo.getLatestExecutionStockAnalysisForTest();
  assert.equal(latest.available, false);
  assert.equal(latest.reason, "obsolete_source_rdo");
});

test("ELO local declara dados insuficientes sem inventar alerta", async () => {
  const { elo, localStorage } = await loadEloContext({ readOnlyStorage: true, localStorage: buildLocalStorageWithExecutionStockAnalysis({ status: "insufficient_data", missingInputs: ["plannedConsumptions", "stockMovements"], result: { summary: { workId: "obra-a-work" }, materials: [], alerts: [] }, alerts: [] }), window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" }, fetch() { throw new Error("should_not_fetch"); } });
  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atencao hoje?");
  assert.equal(localStorage.writes, 0);
  assert.match(answer, /faltam dados/);
  assert.match(answer, /plannedConsumptions, stockMovements/);
  assert.match(answer, /nao invento alertas/);
  assert.doesNotMatch(answer, /consumo acima do esperado|saldo insuficiente/);
});

test("ELO local informa erro de analise sem impedir RDO salvo", async () => {
  const { elo, localStorage } = await loadEloContext({ readOnlyStorage: true, localStorage: buildLocalStorageWithExecutionStockAnalysis({ status: "error", error: "analysis_failed", result: { summary: { workId: "obra-a-work" }, materials: [], alerts: [] }, alerts: [] }), window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" }, fetch() { throw new Error("should_not_fetch"); } });
  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atencao hoje?");
  assert.equal(localStorage.writes, 0);
  assert.match(answer, /RDO continua salvo/);
  assert.match(answer, /analise local automatica ficou indisponivel/);
});

test("backend autenticado com falha cai uma vez para analysis local", async () => {
  const calls = [];
  const validToken = createJwt({ sub: "user-a" });
  const { elo, localStorage } = await loadEloContext({ readOnlyStorage: true, localStorage: buildLocalStorageWithExecutionStockAnalysis(), window: { ELO_AUTH_TOKEN: validToken, ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" }, fetch(url) { calls.push(String(url)); return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({ ok: false, error: "backend_unavailable" }) }); } });
  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atencao hoje?");
  assert.equal(calls.length, 1);
  assert.equal(localStorage.writes, 0);
  assert.match(answer, /analise local automatica pronta/);
  assert.match(answer, /Bloco ceramico/);
});

test("UI de atencao sem token nao fica presa em consulta remota e mantem acoes seguras", async () => {
  const panel = createElement("section");
  const form = createElement("form");
  const input = createElement("textarea");
  const messages = createElement("div");
  let calls = 0;
  const { elo, localStorage } = await loadEloContext({ readOnlyStorage: true, localStorage: buildLocalStorageWithExecutionStockAnalysis(), elements: { ".panel": panel, ".form": form, ".input": input, ".messages": messages }, window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" }, fetch() { calls += 1; throw new Error("should_not_fetch"); } });
  elo.mountMinimal({ panel: ".panel", form: ".form", input: ".input", messages: ".messages" });
  assert.equal(elo.handleObraAttentionForTest("O que precisa da minha atencao hoje?"), true);
  await Promise.resolve();
  await Promise.resolve();
  const output = collectElementText(messages);
  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.doesNotMatch(output, /Consultando o Observador da Obra/);
  assert.equal(findAllElementsByText(messages, "Abrir RDO").length, 1);
  assert.equal(findAllElementsByText(messages, "Abrir Almoxarifado").length, 1);
  assert.equal(findAllElementsByText(messages, "Abrir Stock Obras").length, 1);
});

test("pergunta de atencao autenticada usa backend", async () => {
  const calls = [];
  const validToken = createJwt({ sub: "user-a" });
  const { elo } = await loadEloContext({
    window: { ELO_AUTH_TOKEN: validToken, ELO_PROJECT_ID: "proj-a" },
    fetch(url, options) {
      calls.push({ url: String(url), options });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, summary: {}, alerts: [], sourcesUsed: { budget: true }, dataQuality: { level: "high" } }) });
    }
  });

  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atenção hoje?");

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/elo\/obra\/attention/);
  assert.match(answer, /Aten|alerta|dados/i);
});

test("pergunta de atencao sem token usa Hoje na Obra local sem backend", async () => {
  let calls = 0;
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorage(),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atencao hoje?");

  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.match(answer, /Hoje na obra/);
  assert.match(answer, /Prioridades:/);
  assert.match(answer, /Evidencia:/);
  assert.match(answer, /Acao recomendada:/);
  assert.match(answer, /Bloco ceramico/);
  assert.match(answer, /esperado 2500 un/);
  assert.match(answer, /saida 2600 un/);
  assert.match(answer, /Qualidade dos dados:/);
  assert.doesNotMatch(answer, /9000|obra-b-work|proj-b/);
});

test("Hoje na Obra local informa perfil vazio sem backend nem escrita", async () => {
  let calls = 0;
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: {},
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atencao hoje?");

  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.match(answer, /Hoje na obra/);
  assert.match(answer, /Qualidade dos dados: baixa/);
  assert.match(answer, /Limitacoes: rdos, stockMovements, stockBalances, plannedConsumptions/);
});

test("Hoje na Obra exibe acoes seguras sem duplicar botoes", async () => {
  let calls = 0;
  const navigations = [];
  const popupWrites = [];
  const popup = { document: { open() {}, write(html) { popupWrites.push(html); }, close() {} }, focus() {} };
  const panel = createElement("section");
  const form = createElement("form");
  const input = createElement("textarea");
  const messages = createElement("div");
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorage(),
    elements: { ".panel": panel, ".form": form, ".input": input, ".messages": messages },
    window: {
      ELO_PROJECT_ID: "proj-a",
      ELO_WORK_ID: "obra-a-work",
      innerWidth: 390,
      location: { hostname: "localhost", protocol: "http:", pathname: "/elo.html", hash: "", search: "", assign(url) { navigations.push(String(url)); } },
      open() { return popup; }
    },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  assert.equal(elo.mountMinimal({ panel: ".panel", form: ".form", input: ".input", messages: ".messages" }), true);
  assert.equal(elo.handleObraAttentionForTest("O que precisa da minha atencao hoje?"), true);
  await Promise.resolve();
  await Promise.resolve();

  const labels = ["Abrir RDO", "Abrir Almoxarifado", "Abrir Stock Obras", "Gerar relatório", "Imprimir / salvar PDF"];
  labels.forEach(function (label) { assert.equal(findAllElementsByText(messages, label).length, 1); });

  const rdoButton = findElementByText(messages, "Abrir RDO");
  const almoxButton = findElementByText(messages, "Abrir Almoxarifado");
  const stockButton = findElementByText(messages, "Abrir Stock Obras");
  const reportButton = findElementByText(messages, "Gerar relatório");
  const pdfButton = findElementByText(messages, "Imprimir / salvar PDF");

  assert.match(rdoButton.getAttribute("data-target-url"), /section=rdo/);
  assert.match(almoxButton.getAttribute("data-target-url"), /section=almoxarifado/);
  assert.match(stockButton.getAttribute("data-target-url"), /stock-ai-obras.html/);
  [rdoButton, almoxButton, stockButton, reportButton, pdfButton].forEach(function (button) {
    assert.equal(button.getAttribute("data-project-id"), "proj-a");
    assert.equal(button.getAttribute("data-work-id"), "obra-a-work");
  });
  assert.doesNotMatch(collectElementText(messages), /9000|obra-b-work|proj-b/);

  localStorage.reads = 0;
  localStorage.writes = 0;
  rdoButton.click();
  almoxButton.click();
  stockButton.click();
  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.equal(navigations.length, 3);
  assert.match(navigations[0], /section=rdo/);
  assert.match(navigations[1], /section=almoxarifado/);
  assert.match(navigations[2], /stock-ai-obras.html/);
  assert.doesNotMatch(navigations.join("\\n"), /proj-b|obra-b-work/);

  reportButton.click();
  await Promise.resolve();
  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.equal(findAllElementsByText(messages, "Imprimir / salvar PDF").length, 1);
  assert.equal(elo.getLastLocalExecutionStockReportForTest().ok, true);

  pdfButton.click();
  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.equal(popupWrites.length, 1);
  assert.match(popupWrites.join("\\n"), /Bloco ceramico/);
  assert.doesNotMatch(popupWrites.join("\\n"), /9000|obra-b-work|proj-b/);
});

test("Hoje na Obra com perfil vazio mantem acoes seguras no mobile", async () => {
  let calls = 0;
  const panel = createElement("section");
  const form = createElement("form");
  const input = createElement("textarea");
  const messages = createElement("div");
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: {},
    elements: { ".panel": panel, ".form": form, ".input": input, ".messages": messages },
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work", innerWidth: 390 },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  assert.equal(elo.mountMinimal({ panel: ".panel", form: ".form", input: ".input", messages: ".messages" }), true);
  assert.equal(elo.handleObraAttentionForTest("O que precisa da minha atencao hoje?"), true);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.match(collectElementText(messages), /Abrir RDO/);
  assert.equal(findAllElementsByText(messages, "Imprimir / salvar PDF").length, 1);
});
test("pergunta de consumo sem token usa cruzamento local e appState real", async () => {
  let calls = 0;
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorage(),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  const answer = await elo.requestObraExecutionStockForTest("Compare consumo e saldo da obra");

  assert.equal(calls, 0);
  assert.match(answer, /Cruzamento execucao x estoque da obra atual/);
  assert.match(answer, /esperado 2500 un/);
  assert.match(answer, /saiu 2600 un/);
  assert.match(answer, /consumo acima do esperado/);
  assert.doesNotMatch(answer, /9000/);
  assert.equal(localStorage.writes, 0);
});

test("pergunta comum de saldo nao e enviada ao endpoint attention", async () => {
  let calls = 0;
  const { elo } = await loadEloContext({
    localStorage: buildLocalStorage(),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  assert.equal(elo.detectObraAttentionForTest("Qual saldo do bloco no estoque da obra?"), false);
  const answer = await elo.requestObraExecutionStockForTest("Qual saldo do bloco no estoque da obra?");

  assert.equal(calls, 0);
  assert.match(answer, /saldo 40 un/);
});

test("fonte ausente e modulo ausente sao declarados sem quebrar", async () => {
  const missingData = await loadEloContext({ localStorage: {}, window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" } });
  const missingDataAnswer = await missingData.elo.requestObraExecutionStockForTest("Compare consumo e estoque da obra");
  assert.match(missingDataAnswer, /fontes locais|fontes ausentes|nao encontrei/i);

  const missingModules = await loadEloContext({ withModules: false, localStorage: buildLocalStorage() });
  const missingModulesAnswer = await missingModules.elo.requestObraExecutionStockForTest("Compare consumo e estoque da obra");
  assert.match(missingModulesAnswer, /modulos ausentes|fontes locais indisponiveis/i);
});

test("sem mojibake novo nos textos do fluxo local", async () => {
  const { elo } = await loadEloContext({ withModules: false });
  const answer = await elo.requestObraExecutionStockForTest("Compare consumo e estoque da obra");
  assert.doesNotMatch(answer, /ï¿½|�/);
});

test("modo local readonly mostra shell e composer sem marcar autenticado", () => {
  const { context, body, html } = loadAuthGateContext();

  assert.ok(body.classList.contains("elo-auth-required"));
  assert.ok(body.classList.contains("elo-local-readonly"));
  assert.equal(body.classList.contains("elo-authenticated"), false);
  assert.ok(html.includes("body.elo-auth-required.elo-local-readonly .elo-product-shell") && html.includes("display: block;"));
  assert.match(html, /class="elo-product-shell"/);
  assert.match(html, /class="elo-input-row"/);

  context.window.EloCoreAuthGate.setAuthenticated(true);
  assert.equal(body.classList.contains("elo-auth-required"), false);
  assert.ok(body.classList.contains("elo-authenticated"));
  assert.equal(body.classList.contains("elo-local-readonly"), false);
});

test("detector local aceita consumo e risco de falta sem capturar contexto indevido", async () => {
  const { elo } = await loadEloContext();

  assert.equal(elo.detectObraExecutionStockForTest("O consumo est? acima do esperado?"), true);
  assert.equal(elo.detectObraExecutionStockForTest("Existe risco de falta de material?"), true);
  assert.equal(elo.detectObraExecutionStockForTest("Qual o saldo banc?rio da conta?"), false);
  assert.equal(elo.detectObraExecutionStockForTest("Meu consumo de energia est? alto?"), false);
});

test("perguntas locais sem token nao chamam backend nem gravam confiabilidade", async () => {
  let calls = 0;
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorage(),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  const consumptionAnswer = await elo.requestObraExecutionStockForTest("O consumo est? acima do esperado?");
  const riskAnswer = await elo.requestObraExecutionStockForTest("Existe risco de falta de material?");

  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.match(consumptionAnswer, /esperado 2500 un/);
  assert.match(riskAnswer, /saldo 40 un/);
  assert.equal(localStorage.getItem("elo_core_reliability_events_v1"), null);
});


test("fluxo ask local readonly mantem suppress ate fim e nao grava", async () => {
  let calls = 0;
  const marks = [];
  const panel = createElement("section");
  const form = createElement("form");
  const input = createElement("textarea");
  const messages = createElement("div");
  const elements = { ".panel": panel, ".form": form, ".input": input, ".messages": messages };
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorage(),
    elements,
    window: {
      ELO_PROJECT_ID: "proj-a",
      ELO_WORK_ID: "obra-a-work",
      performance: { now() { return 1; }, mark(name) { marks.push(name); } }
    },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  assert.equal(elo.mountMinimal({ panel: ".panel", form: ".form", input: ".input", messages: ".messages" }), true);
  elo.ask("O consumo est? acima do esperado?");
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.equal(localStorage.getItem("elo_core_reliability_events_v1"), null);
  assert.equal(localStorage.getItem("elo_core_current_conversation_id_v1"), null);
  assert.deepEqual(marks, []);
  assert.equal(messages.children.length >= 2, true);
});


test("pergunta natural de relatorio aciona diagnostico local sem backend nem escrita", async () => {
  let calls = 0;
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorage(),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  assert.equal(elo.detectObraExecutionStockReportForTest("Gere um relat?rio de consumo da obra."), true);
  assert.equal(elo.detectObraExecutionStockReportForTest("Fa?a um relat?rio de desperd?cio."), true);
  assert.equal(elo.detectObraExecutionStockReportForTest("Mostre o risco de falta de materiais."), true);
  assert.equal(elo.detectObraExecutionStockReportForTest("Resuma execu??o, consumo e estoque."), true);
  assert.equal(elo.detectObraExecutionStockReportForTest("Qual o saldo dos materiais?"), false);
  assert.equal(elo.detectObraExecutionStockReportForTest("O consumo est? acima?"), false);

  const answer = await elo.requestObraExecutionStockReportForTest("Gere um relat?rio de consumo da obra.");

  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.match(answer, /Relatorio local de consumo e risco/);
  assert.match(answer, /Bloco ceramico/);
  assert.match(answer, /esperado 2500 un/);
});

test("perfil vazio informa fontes ausentes no relatorio local", async () => {
  const { elo, localStorage } = await loadEloContext({ readOnlyStorage: true, localStorage: {} });
  const answer = await elo.requestObraExecutionStockReportForTest("Resuma execu??o, consumo e estoque.");

  assert.equal(localStorage.writes, 0);
  assert.match(answer, /fontes locais indisponiveis|nao ha dados locais suficientes|Fontes ausentes/i);
});

test("botao gerar relatorio aparece sem login e clique usa fluxo local", async () => {
  let calls = 0;
  const marks = [];
  const panel = createElement("section");
  const form = createElement("form");
  const input = createElement("textarea");
  const messages = createElement("div");
  const reportActions = createElement("div");
  const reportButton = createElement("button");
  reportActions.dataset.eloLocalActions = "";
  reportActions.hidden = true;
  reportButton.hidden = true;
  reportButton.textContent = "Gerar relatório";
  reportActions.appendChild(reportButton);
  const elements = {
    ".panel": panel,
    ".form": form,
    ".input": input,
    ".messages": messages,
    "[data-elo-local-report]": reportButton
  };
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorage(),
    elements,
    window: {
      ELO_PROJECT_ID: "proj-a",
      ELO_WORK_ID: "obra-a-work",
      performance: { now() { return 1; }, mark(name) { marks.push(name); } }
    },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  assert.equal(elo.mountMinimal({ panel: ".panel", form: ".form", input: ".input", messages: ".messages", reportButton: "[data-elo-local-report]" }), true);
  assert.equal(reportActions.hidden, false);
  assert.equal(reportButton.hidden, false);
  assert.equal(reportButton.disabled, false);

  const reportAnswer = await elo.runLocalExecutionStockReportActionForTest();

  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.equal(localStorage.getItem("elo_core_reliability_events_v1"), null);
  assert.deepEqual(marks, []);
  assert.equal(reportButton.textContent, "Gerar relatório");
  assert.equal(reportButton.disabled, false);
  assert.equal(messages.children.length >= 2, true);
  assert.match(reportAnswer, /Relatorio local de consumo e risco/);
});

test("botao gerar relatorio aparece autenticado e nao duplica apos nova conversa", async () => {
  let calls = 0;
  const panel = createElement("section");
  const form = createElement("form");
  const input = createElement("textarea");
  const messages = createElement("div");
  const reportActions = createElement("div");
  const reportButton = createElement("button");
  reportActions.dataset.eloLocalActions = "";
  reportButton.textContent = "Gerar relatório";
  reportActions.appendChild(reportButton);
  const elements = {
    ".panel": panel,
    ".form": form,
    ".input": input,
    ".messages": messages,
    "[data-elo-local-report]": reportButton
  };
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorage(),
    elements,
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work", ELO_AUTH_TOKEN: createJwt({ sub: "user-a" }) },
    fetch() { calls += 1; return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, memories: [] }) }); }
  });

  assert.equal(elo.mountMinimal({ panel: ".panel", form: ".form", input: ".input", messages: ".messages", reportButton: "[data-elo-local-report]" }), true);
  assert.equal(elo.mountMinimal({ panel: ".panel", form: ".form", input: ".input", messages: ".messages", reportButton: "[data-elo-local-report]" }), true);
  assert.equal(reportButton.hidden, false);
  const boundClickCount = (reportButton.events.click || []).length;
  assert.equal(boundClickCount, 1);

  calls = 0;
  localStorage.writes = 0;
  reportButton.click();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.equal((reportButton.events.click || []).length, 1);
  assert.equal(messages.children.length >= 2, true);
});

test("botao gerar relatorio fica oculto quando modulos locais faltam", async () => {
  const panel = createElement("section");
  const form = createElement("form");
  const input = createElement("textarea");
  const messages = createElement("div");
  const reportActions = createElement("div");
  const reportButton = createElement("button");
  reportActions.dataset.eloLocalActions = "";
  reportActions.appendChild(reportButton);
  const elements = {
    ".panel": panel,
    ".form": form,
    ".input": input,
    ".messages": messages,
    "[data-elo-local-report]": reportButton
  };
  const { elo } = await loadEloContext({ withModules: false, elements });

  assert.equal(elo.mountMinimal({ panel: ".panel", form: ".form", input: ".input", messages: ".messages", reportButton: "[data-elo-local-report]" }), true);
  assert.equal(reportActions.hidden, true);
  assert.equal(reportButton.hidden, true);
});

test("PDF local so habilita com report ok e mantem contrato do relatorio", async () => {
  const { elo } = await loadEloContext({
    localStorage: buildLocalStorage(),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch() { throw new Error("should_not_fetch"); }
  });
  const report = elo.buildLocalExecutionStockReportForTest();
  const pdf = elo.buildExecutionStockReportPdfForTest(report, { issuedAt: new Date("2026-07-25T10:30:00.000Z") });

  assert.equal(report.ok, true);
  assert.equal(pdf.ok, true);
  assert.equal(pdf.fileName, "elo-relatorio-execucao-estoque-obra-a-work-2026-07-25.pdf");
  assert.match(pdf.html, /Relatorio de execucao, consumo e estoque/);
  assert.match(pdf.html, /Alvenaria/);
  assert.match(pdf.html, /2500/);
  assert.match(pdf.html, /2600/);
  assert.match(pdf.html, /40/);
  assert.match(pdf.html, /4%/);
  assert.match(pdf.html, /consumo acima/);
  assert.match(pdf.html, /Conclusao tecnica/);
  assert.doesNotMatch(pdf.html, /9000|obra-b-work|proj-b/);

  const unsafeReport = Object.assign({}, report, {
    scope: { workName: "<img src=x onerror=alert(1)>", workId: "obra-a-work", projectId: "proj-a" },
    materials: [{ material: "<script>alert(1)</script>", unit: "un", expectedConsumption: 1, actualStockExit: 2, currentBalance: 3, difference: 1, differencePercent: 100, classification: "consumo acima" }]
  });
  const unsafePdf = elo.buildExecutionStockReportPdfForTest(unsafeReport);
  assert.equal(unsafePdf.ok, true);
  assert.doesNotMatch(unsafePdf.html, /<img/i);
  assert.doesNotMatch(unsafePdf.html, /<script>alert/i);
});

test("PDF local nao gera sem dados suficientes", async () => {
  const { elo, localStorage } = await loadEloContext({ readOnlyStorage: true, localStorage: {} });
  const report = elo.buildLocalExecutionStockReportForTest();
  const pdf = elo.buildExecutionStockReportPdfForTest(report);

  assert.equal(report.ok, false);
  assert.equal(pdf.ok, false);
  assert.equal(pdf.html, undefined);
  assert.equal(localStorage.writes, 0);
});

test("PDF local mantem percentual ausente quando esperado e zero", async () => {
  const { elo } = await loadEloContext();
  const report = {
    ok: true,
    scope: { projectId: "proj-a", workId: "obra-a-work" },
    period: { label: "2026-07-25" },
    sourcesUsed: { rdos: true, stockMovements: true, stockBalances: true, plannedConsumptions: true },
    summary: { productions: 1, materials: 1, alerts: 1 },
    productions: [{ service: "Pintura", quantity: 10, unit: "m2" }],
    materials: [{ material: "Tinta", unit: "l", expectedConsumption: 0, actualStockExit: 3, currentBalance: 2, difference: 3, differencePercent: null, classification: "referencia ausente", status: "missing_reference" }],
    prioritizedAlerts: [{ material: "Tinta", classification: "referencia ausente", status: "missing_reference", severityRank: 4 }],
    limitations: [],
    conclusion: "Referencia ausente."
  };
  const pdf = elo.buildExecutionStockReportPdfForTest(report, { issuedAt: new Date("2026-07-25T10:30:00.000Z") });

  assert.equal(pdf.ok, true);
  assert.match(pdf.html, /ausente/);
  assert.doesNotMatch(pdf.html, /Infinity|NaN/);
});

test("PDF local preserva prioridade dos alertas", async () => {
  const { elo } = await loadEloContext();
  const report = {
    ok: true,
    scope: { workId: "obra-a" },
    period: { label: "periodo" },
    sourcesUsed: { rdos: true, stockMovements: true, stockBalances: true, plannedConsumptions: true },
    summary: { productions: 1, materials: 2, alerts: 2 },
    productions: [{ service: "Alvenaria", quantity: 100, unit: "m2" }],
    materials: [
      { material: "Bloco", unit: "un", expectedConsumption: 2500, actualStockExit: 2600, currentBalance: 40, difference: 100, differencePercent: 4, classification: "consumo acima", status: "consumption_above_expected" },
      { material: "Cimento", unit: "sc", expectedConsumption: 20, actualStockExit: 22, currentBalance: -1, difference: 2, differencePercent: 10, classification: "saldo insuficiente", status: "insufficient_balance" }
    ],
    prioritizedAlerts: [
      { material: "Cimento", classification: "saldo insuficiente", status: "insufficient_balance", severityRank: 0 },
      { material: "Bloco", classification: "consumo acima", status: "consumption_above_expected", severityRank: 2 }
    ],
    limitations: [],
    conclusion: "Ha risco de falta."
  };
  const pdf = elo.buildExecutionStockReportPdfForTest(report);

  assert.equal(pdf.ok, true);
  assert.ok(pdf.html.indexOf("Cimento: saldo insuficiente") < pdf.html.indexOf("Bloco: consumo acima"));
});

test("abrir PDF local nao chama rede nem escreve storage", async () => {
  let calls = 0;
  const popupWrites = [];
  const popup = {
    document: {
      open() { popupWrites.push("open"); },
      write(html) { popupWrites.push(html); },
      close() { popupWrites.push("close"); }
    },
    focus() { popupWrites.push("focus"); }
  };
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorage(),
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work", open() { return popup; } },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });
  const report = elo.buildLocalExecutionStockReportForTest();
  const result = elo.openExecutionStockReportPdfForTest(report, { issuedAt: new Date("2026-07-25T10:30:00.000Z") });

  assert.equal(result.ok, true);
  assert.equal(result.opened, true);
  assert.equal(calls, 0);
  assert.equal(localStorage.writes, 0);
  assert.equal(popupWrites[0], "open");
  assert.match(popupWrites[1], /Imprimir \/ salvar PDF/);
  assert.match(popupWrites[1], /window\.addEventListener\('load'/);
  assert.equal(popupWrites[2], "close");
});

test("acao Imprimir salvar PDF aparece so com report valido e usa estado transitorio", async () => {
  let calls = 0;
  const popupWrites = [];
  const popup = { document: { open() {}, write(html) { popupWrites.push(html); }, close() {} }, focus() {} };
  const panel = createElement("section");
  const form = createElement("form");
  const input = createElement("textarea");
  const messages = createElement("div");
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorage(),
    elements: { ".panel": panel, ".form": form, ".input": input, ".messages": messages },
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work", open() { return popup; } },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  assert.equal(elo.mountMinimal({ panel: ".panel", form: ".form", input: ".input", messages: ".messages" }), true);
  await elo.runLocalExecutionStockReportActionForTest();
  assert.equal(elo.getLastLocalExecutionStockReportForTest().ok, true);
  const pdfButton = findElementByText(messages, "Imprimir / salvar PDF");
  assert.ok(pdfButton);
  localStorage.reads = 0;
  pdfButton.click();

  assert.equal(calls, 0);
  assert.equal(localStorage.reads, 0);
  assert.equal(localStorage.writes, 0);
  assert.equal(popupWrites.length, 1);
  assert.match(popupWrites.join("\\n"), /Bloco ceramico/);
  elo.startNewConversationForLayoutTest();
  assert.equal(elo.getLastLocalExecutionStockReportForTest(), null);
  assert.equal(findElementByText(messages, "Imprimir / salvar PDF"), null);

  const emptyMessages = createElement("div");
  const empty = await loadEloContext({
    readOnlyStorage: true,
    localStorage: {},
    elements: { ".panel": panel, ".form": form, ".input": input, ".messages": emptyMessages },
    window: { open() { throw new Error("should_not_open"); } }
  });
  empty.elo.mountMinimal({ panel: ".panel", form: ".form", input: ".input", messages: ".messages" });
  const emptyAnswer = await empty.elo.runLocalExecutionStockReportActionForTest();
  assert.equal(empty.elo.getLastLocalExecutionStockReportForTest(), null);
  assert.equal(findElementByText(emptyMessages, "Imprimir / salvar PDF"), null);
  assert.match(emptyAnswer, /fontes locais|fontes ausentes|nao ha dados locais suficientes/i);
});
test("acao Imprimir salvar PDF informa popup bloqueado sem persistir", async () => {
  let calls = 0;
  const panel = createElement("section");
  const form = createElement("form");
  const input = createElement("textarea");
  const messages = createElement("div");
  const { elo, localStorage } = await loadEloContext({
    readOnlyStorage: true,
    localStorage: buildLocalStorage(),
    elements: { ".panel": panel, ".form": form, ".input": input, ".messages": messages },
    window: { ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work", open() { return null; } },
    fetch() { calls += 1; throw new Error("should_not_fetch"); }
  });

  assert.equal(elo.mountMinimal({ panel: ".panel", form: ".form", input: ".input", messages: ".messages" }), true);
  await elo.runLocalExecutionStockReportActionForTest();
  const pdfButton = findElementByText(messages, "Imprimir / salvar PDF");
  assert.ok(pdfButton);
  localStorage.reads = 0;
  pdfButton.click();

  assert.equal(calls, 0);
  assert.equal(localStorage.reads, 0);
  assert.equal(localStorage.writes, 0);
  assert.match(collectElementText(messages), /Nao consegui abrir a janela de impressao do PDF local/);
});