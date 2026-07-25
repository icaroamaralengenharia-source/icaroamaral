const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const snapshotModulePromise = import("./elo-stock-obras-snapshot.js");
const crossModulePromise = import("./elo-execution-stock-cross.js");

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
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    setAttribute(name, value) { this[String(name)] = String(value); },
    getAttribute(name) { return this[String(name)] || ""; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    value: "",
    options: [],
    selectedIndex: -1,
    textContent: ""
  };
}

async function loadEloContext(options = {}) {
  const localStorage = options.readOnlyStorage ? createReadOnlyStorage(options.localStorage || {}) : createStorage(options.localStorage || {});
  const sessionStorage = createStorage(options.sessionStorage || {});
  const { buildEloStockObrasSnapshot } = await snapshotModulePromise;
  const { crossExecutionWithStock } = await crossModulePromise;
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
      EloExecutionStockCross: options.withModules === false ? undefined : { crossExecutionWithStock }
    },
    document: {
      readyState: "complete",
      body: createElement("body"),
      createElement,
      addEventListener() {},
      querySelector() { return null; },
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