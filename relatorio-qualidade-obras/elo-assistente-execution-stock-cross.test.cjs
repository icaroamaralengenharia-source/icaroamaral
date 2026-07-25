const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const snapshotModulePromise = import("./elo-stock-obras-snapshot.js");
const crossModulePromise = import("./elo-execution-stock-cross.js");
const reportModulePromise = import("./elo-execution-stock-report.js");

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    writes: 0,
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
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
  return {
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
    selectedIndex: -1,
    textContent: ""
  };
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
      EloExecutionStockReport: options.withModules === false ? undefined : { buildExecutionStockReport }
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

test("pergunta de atencao sem token nao finge consulta", async () => {
  let calls = 0;
  const { elo } = await loadEloContext({ fetch() { calls += 1; throw new Error("should_not_fetch"); } });

  const answer = await elo.requestObraAttentionForTest("O que precisa da minha atenção hoje?");

  assert.equal(calls, 0);
  assert.match(answer, /autenticacao|sessao|ELO/i);
  assert.doesNotMatch(answer, /Cruzamento execucao x estoque/);
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
