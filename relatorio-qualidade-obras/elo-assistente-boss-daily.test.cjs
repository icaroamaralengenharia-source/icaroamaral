const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    clear() { data.clear(); }
  };
}

function createJwt(payload = {}) {
  function encode(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
  return encode({ alg: "none", typ: "JWT" }) + "." + encode(Object.assign({
    iss: "https://lidueokjpzxdybtongbk.supabase.co/auth/v1",
    exp: Math.floor(Date.now() / 1000) + 3600
  }, payload)) + ".sig";
}

function createElement(tag) {
  const element = {
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
    selectedIndex: -1
  };
  Object.defineProperty(element, "textContent", {
    get() { return this._textContent || ""; },
    set(value) { this._textContent = String(value || ""); }
  });
  return element;
}

function loadEloContext(options = {}) {
  const localStorage = createStorage(options.localStorage || {});
  const sessionStorage = createStorage(options.sessionStorage || {});
  const context = {
    console,
    setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
    clearTimeout() {},
    Date,
    Math,
    fetch: options.fetch,
    URLSearchParams,
    Blob: function Blob() {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
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
      btoa(value) { return Buffer.from(String(value), "binary").toString("base64"); }
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
  return { elo: context.window.EloAssistente, context };
}

function dailyPayload() {
  return {
    ok: true,
    summary: {},
    alerts: [{ type: "material_shortage_risk", severity: "critical", evidence: { material: "Cimento" }, impact: { quantityGap: 7, unit: "sc" } }],
    sourcesUsed: { budget: true, stockObras: true, rdos: true },
    dataQuality: { level: "high" },
    executionStockCross: {
      materials: [{ material: "Cimento", unit: "sc", differencePercent: 30, classification: "critico" }],
      auditMemory: { ok: true }
    },
    auditMemory: { ok: true },
    dailySummary: {
      scope: { projectId: "proj-a", workId: "obra-a-work" },
      retiradasHoje: [
        { material: "Cimento", quantity: 13, unit: "sc" },
        { material: "Areia", quantity: 2, unit: "m3" }
      ],
      producaoHoje: [{ service: "Piso cimentado", quantity: 10, unit: "m2" }],
      gastoConhecido: 130,
      faltas: [{ material: "Cimento", gap: 7, unit: "sc" }],
      desviosCriticos: [{ material: "Cimento", differencePercent: 30, classification: "critico" }],
      prioridades: [{ type: "material_shortage_risk", evidence: { material: "Cimento" } }],
      dataQuality: { hasRetiradasHoje: true, hasProducaoHoje: true, hasGastoConhecido: true, hasFaltas: true, hasDesviosCriticos: true }
    }
  };
}

test("ELO do patrao detecta e formata as sete perguntas do dailySummary", async () => {
  const calls = [];
  const validToken = createJwt({ sub: "user-a" });
  const { elo } = loadEloContext({
    window: { ELO_AUTH_TOKEN: validToken, ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch(url, options = {}) {
      calls.push({ url: String(url), options });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(dailyPayload()) });
    }
  });
  const questions = [
    "O que saiu hoje?",
    "Quanto foi gasto?",
    "Quanto foi produzido?",
    "O que está faltando?",
    "Há desvios críticos?",
    "Qual obra exige atenção?",
    "Resuma o dia."
  ];

  questions.forEach((question) => assert.equal(elo.detectObraAttentionForTest(question), true, question));
  const answers = [];
  for (const question of questions) answers.push(await elo.requestObraAttentionForTest(question));

  assert.equal(calls.length, 7);
  calls.forEach((call) => {
    assert.match(call.url, /\/api\/elo\/obra\/attention\?projectId=proj-a&workId=obra-a-work/);
    assert.equal(call.options.method, "GET");
    assert.equal(call.options.headers.Authorization, "Bearer " + validToken);
  });
  assert.match(answers[0], /Retiradas de hoje: Cimento 13 sc; Areia 2 m3\./);
  assert.match(answers[1], /Gasto conhecido hoje: R\$ 130,00\./);
  assert.match(answers[2], /Piso cimentado 10 m2/);
  assert.match(answers[3], /Faltando agora: Cimento - falta 7 sc\./);
  assert.match(answers[4], /Desvios críticos: Cimento \(30 %\)\./);
  assert.match(answers[5], /Obra ativa: proj-a \/ obra-a-work\.[\s\S]*Prioridades: Cimento\./);
  assert.match(answers[6], /Resumo do dia:[\s\S]*Retiradas:[\s\S]*Gasto conhecido:[\s\S]*Produção:[\s\S]*Faltas:[\s\S]*Desvios críticos:[\s\S]*Prioridades:/);
  answers.forEach((answer) => assert.doesNotMatch(answer, /material_shortage_risk|\{\s*"dailySummary"/));
});

test("ELO do patrao informa sem dado disponível quando a fonte nao veio", () => {
  const { elo } = loadEloContext();
  const answer = elo.formatObraAttentionForTest({ ok: true, dailySummary: {} }, "Quanto foi gasto?");

  assert.match(answer, /sem dado disponível/);
});