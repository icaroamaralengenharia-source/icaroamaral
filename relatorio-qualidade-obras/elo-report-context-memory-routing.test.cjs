const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); }
  };
}

function loadElo(options = {}) {
  const fetchRequests = [];
  const storage = createStorage();
  const fetchHandler = options.fetch;
  const document = {
    body: { dataset: {}, getAttribute() { return null; }, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } },
    documentElement: { getAttribute() { return null; }, setAttribute() {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() {
      return {
        dataset: {},
        style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {},
        setAttribute() {},
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        textContent: "",
        innerHTML: "",
        focus() {}
      };
    }
  };
  const window = {
    localStorage: storage,
    sessionStorage: createStorage(),
    document,
    navigator: { onLine: true, userAgent: "node" },
    location: { hostname: "localhost", protocol: "http:", pathname: "/elo.html", search: "", hash: "", assign() {} },
    addEventListener() {},
    removeEventListener() {},
    setTimeout(fn) { return setTimeout(fn, 0); },
    clearTimeout,
    URLSearchParams,
    Date,
    Math,
    console,
    fetch(url, requestOptions) { fetchRequests.push({ url, options: requestOptions || {} }); if (typeof fetchHandler === "function") return fetchHandler(url, requestOptions || {}); throw new Error("network disabled in test"); }
  };
  Object.assign(window, options.window || {});
  window.window = window;
  const context = vm.createContext({ window, document, navigator: window.navigator, localStorage: storage, sessionStorage: window.sessionStorage, console, setTimeout, clearTimeout, URLSearchParams, Date, Math, fetch: window.fetch });
  const source = fs.readFileSync(path.join(__dirname, "elo-assistente.js"), "utf8");
  vm.runInContext(source, context, { filename: "elo-assistente.js" });
  return { api: context.window.EloAssistente, fetchCalls: () => fetchRequests.length, fetchRequests: () => fetchRequests.slice() };
}

const analysisAnswer = [
  "Análise técnica da imagem recebida",
  "Identifiquei falta de material no canteiro, área parcialmente parada e risco de atraso no serviço.",
  "Constatação: faltam blocos cerâmicos e argamassa para continuidade da alvenaria.",
  "Causa provável: falha de planejamento de compras e reposição de estoque.",
  "Recomendação: registrar a ocorrência, revisar cronograma e recompor o estoque mínimo."
].join("\n");

test("gera relatório a partir da última análise sem cair na ponte genérica", () => {
  const { api } = loadElo();
  api.rememberActiveAnalysisForTest("analise essa foto", { fullAnswer: analysisAnswer, sessionIntent: "image_analysis" }, analysisAnswer);

  const response = api.buildReportFromAnalysisContextForTest("faça um relatório relatando isso");
  assert.equal(response.sessionIntent, "generate_report_from_context");
  assert.match(response.fullAnswer, /RELATORIO TECNICO/i);
  assert.match(response.fullAnswer, /falta de material/i);
  assert.doesNotMatch(response.fullAnswer, /ponte com relatórios está pronta/i);

  const route = api.detectCommandBridgeRequestForTest("faça um relatório relatando isso");
  assert.equal(route.module, "obrareport_report");
  assert.equal(route.action, "generate_report_from_context");
});

test("consulta de relatórios existentes continua na rota de listagem", () => {
  const { api } = loadElo();
  const route = api.detectCommandBridgeRequestForTest("liste meus relatórios");
  assert.equal(route.module, "obrareport_report");
  assert.equal(route.action, "list_reports");
});

test("memorize tem precedência sobre relatório, salva memória canônica e preserva fallback local genérico", async () => {
  const { api, fetchCalls, fetchRequests } = loadElo();
  api.rememberActiveAnalysisForTest("analise a residência teste", { fullAnswer: analysisAnswer, sessionIntent: "image_analysis" }, analysisAnswer);

  const message = "memorize: meu código de revisão arbitrário é flor de concreto";
  assert.equal(api.detectExplicitMemoryCommandForTest(message), true);
  const route = api.detectCommandBridgeRequestForTest(message);
  assert.equal(route.module, "memory");
  assert.equal(route.action, "save_explicit_memory");

  const response = api.buildExplicitMemoryCommandForTest(message);
  assert.equal(response.sessionIntent, "explicit_memory_save");
  assert.equal(response.route, "memory");
  assert.equal(response.memorySaved, true);
  assert.equal(Array.isArray(response.savedMemoryLabels), true);
  assert.equal(response.savedMemoryLabels.length, 0);
  assert.doesNotMatch(response.fullAnswer, /Residência teste|RELATÓRIO TÉCNICO|falta de material/i);
  assert.equal(fetchCalls(), 1);

  const [memoryRequest] = fetchRequests();
  assert.match(String(memoryRequest.url), /\/api\/elo\/memories$/);
  const memoryPayload = JSON.parse(memoryRequest.options.body);
  assert.equal(memoryPayload.category, "technical_context");
  assert.match(memoryPayload.memory_key, /^explicit_/);
  assert.match(memoryPayload.memory_value, /flor de concreto/i);
  assert.equal(await response.canonicalMemoryPromise, false);
  assert.ok(api.getLongTermMemoriesForTest().some((item) => /flor de concreto/i.test(item.text)));

  const context = api.getActiveAnalysisForTest();
  assert.ok(context);
  assert.match(api.buildReportFromAnalysisContextForTest("gere um PDF com essa análise").fullAnswer, /falta de material/i);
});

test("comando por voz com wake word também entra na memória arbitrária", () => {
  const { api } = loadElo();
  const message = "Elo, memorize que meu código de revisão arbitrário é viga azul";
  assert.equal(api.detectExplicitMemoryCommandForTest(message), true);
  const response = api.buildExplicitMemoryCommandForTest(message);
  assert.equal(response.sessionIntent, "explicit_memory_save");
  assert.ok(api.getLongTermMemoriesForTest().some((item) => /viga azul/i.test(item.text)));
});

test("continuação contextual não vira música e música explícita continua sendo música", () => {
  const { api } = loadElo();
  assert.equal(api.detectMusicPlayIntentForTest("ela terá 5 metros de vão"), null);
  assert.equal(api.detectMusicPlayIntentForTest("toque Comfortably Numb Pink Floyd").intent, "PLAY");
});

test("variações de relatório reutilizam a análise anterior e entram na ação real", () => {
  const { api } = loadElo();
  api.rememberActiveAnalysisForTest("analise essa foto", { fullAnswer: analysisAnswer, sessionIntent: "image_analysis" }, analysisAnswer);

  for (const phrase of [
    "gere um relatório disso",
    "gere um relatório dessa análise",
    "faça um relatório de qualidade",
    "transforme isso em relatório",
    "gere o relatório"
  ]) {
    assert.equal(api.detectReportFromAnalysisContextForTest(phrase), true, phrase);
    const route = api.detectCommandBridgeRequestForTest(phrase);
    assert.equal(route.module, "obrareport_report", phrase);
    assert.equal(route.action, "generate_report_from_context", phrase);
    const response = api.buildReportFromAnalysisContextForTest(phrase);
    assert.equal(response.reportFromAnalysisContext.realReportAction, true, phrase);
    assert.equal(response.reportFromAnalysisContext.source, "last_analysis", phrase);
  }
});

test("sem análise, pedido de relatório não inventa conteúdo", () => {
  const { api } = loadElo();
  const response = api.buildReportFromAnalysisContextForTest("gere um relatório disso");
  assert.equal(response.sessionIntent, "generate_report_from_context_missing_context");
  assert.match(response.fullAnswer, /Nao tenho uma analise recente/i);
});

test("ação de relatório de contexto usa o mesmo gerador real e preserva os achados", async () => {
  const calls = [];
  const { api } = loadElo({
    window: { RELATORIO_QUALIDADE_CONFIG: { appsScriptUrl: "https://script.test/report" } },
    fetch(url, options) {
      calls.push({ url, options });
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ ok: true, pdfUrl: "https://script.test/report.pdf", requestId: "req-context-1" }))
      });
    }
  });
  api.rememberActiveAnalysisForTest("analise essa foto", { fullAnswer: analysisAnswer, sessionIntent: "image_analysis" }, analysisAnswer);
  await api.generateReportFromAnalysisContextForTest("gere um relatório disso");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://script.test/report");
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.fotosUnidade.length, 0);
  assert.match(payload.report.observacoes, /falta de material/i);
  assert.match(payload.inconformidades[0].descricaoTecnica, /falta de material/i);
});
