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

test("novo PDF invalida a analise anterior para impedir relatorio com contexto obsoleto", () => {
  const { api } = loadElo();
  const oldAnswer = "Analise do contexto A: infiltração na cobertura e risco de umidade persistente.";
  api.rememberActiveAnalysisForTest("analise o contexto A", { fullAnswer: oldAnswer, sessionIntent: "document_analysis" }, oldAnswer);
  api.rememberActiveDocumentForTest([{
    fileName: "contexto-b.pdf",
    text: "CODIGO_PDF_ELO_20261004. Problema principal: fissura diagonal próxima ao vão da janela."
  }]);

  const response = api.buildReportFromAnalysisContextForTest("faça um relatório disso");
  assert.equal(response.sessionIntent, "generate_report_from_context_missing_context");
  assert.doesNotMatch(response.fullAnswer, /infiltração|infiltracao/i);
  assert.doesNotMatch(response.fullAnswer, /contexto A/i);
});

test("consulta de relatórios existentes continua na rota de listagem", () => {
  const { api } = loadElo();
  const route = api.detectCommandBridgeRequestForTest("liste meus relatórios");
  assert.equal(route.module, "obrareport_report");
  assert.equal(route.action, "list_reports");
});

test("reutiliza o PDF ativo em follow-ups curtos e preserva o contexto após matematica", () => {
  const { api } = loadElo();
  api.rememberActiveDocumentForTest([{ fileName: "contrato-e2e.pdf", text: "Contrato 13/2024. Codigo 42. Principal problema: falta de tampa." }]);

  assert.equal(api.isActiveDocumentReferenceForTest("quais os principais problemas encontrados?"), true);
  assert.equal(api.isActiveDocumentReferenceForTest("qual e o codigo?"), true);
  assert.equal(api.isActiveDocumentReferenceForTest("e o segundo?"), true);
  assert.equal(api.isActiveDocumentReferenceForTest("voltando ao PDF, qual era o codigo?"), true);

  const payload = { message: "qual e o codigo?", context: {} };
  assert.equal(api.applyActiveDocumentContextToPayloadForTest(payload, payload.message), true);
  assert.match(payload.context.documentsSummary, /contrato-e2e\.pdf/i);
  assert.match(payload.message, /Codigo 42/i);

  api.rememberSessionTurnForTest("quanto e 15% de 38000", { sessionTheme: "matematica", sessionIntent: "math" }, "Resultado: 5700");
  const afterMath = api.getActiveDocumentForTest();
  assert.ok(afterMath);
  assert.equal(afterMath.documents[0].documentId.length > 0, true);
});

test("resolve referencias plurais contra as entidades da ultima analise, sem depender da frase exata", () => {
  const { api } = loadElo();
  api.rememberActiveDocumentForTest([{ fileName: "orcamento-e2e.pdf", text: "Area construida: 70 m2. Problemas: precos oficiais ausentes; fundacao e piso sem detalhes; escopo incompleto." }]);
  const answer = [
    "Analise tecnica do PDF do orcamento.",
    "Principais problemas encontrados:",
    "1. Ausencia de precos oficiais, impedindo fechar um custo confiavel.",
    "2. Fundacao e piso sem detalhes tecnicos suficientes.",
    "3. Escopo do orcamento incompleto, com servicos e quantidades faltantes."
  ].join("\n");
  api.rememberActiveAnalysisForTest("resuma este PDF", { fullAnswer: answer, sessionIntent: "document_analysis" }, answer);

  for (const phrase of [
    "qual deles e mais grave?",
    "qual deles aparece primeiro?",
    "e o segundo?",
    "e o ultimo?",
    "entre eles qual e pior?",
    "compare o primeiro com o terceiro",
    "qual deles tem maior impacto?",
    "resuma os tres"
  ]) {
    assert.equal(api.isAnalysisReferenceRequestForTest(phrase), true, phrase);
    const response = api.buildAnalysisReferenceResponseForTest(phrase);
    assert.ok(response, phrase);
    assert.equal(response.sessionIntent, "document_context_follow_up", phrase);
    assert.ok(response.contextResolution.selectedEntities.length > 0, phrase);
  }

  const severity = api.buildAnalysisReferenceResponseForTest("qual deles e mais grave?");
  assert.match(severity.fullAnswer, /precos oficiais/i);
  const comparison = api.buildAnalysisReferenceResponseForTest("compare o primeiro com o terceiro");
  assert.match(comparison.fullAnswer, /precos oficiais/i);
  assert.match(comparison.fullAnswer, /escopo.*incompleto/i);
});

test("separa entidades numeradas quando a resposta chega em um unico paragrafo", () => {
  const { api } = loadElo();
  api.rememberActiveDocumentForTest([{ fileName: "inline.pdf", text: "Problemas de orçamento." }]);
  const answer = "Os principais problemas são: 1. Falta de informações do cliente. 2. Ausência de composição detalhada para fundação e estrutura. 3. BDI sem confirmação. 4. Área de parede pendente de revisão.";
  api.rememberActiveAnalysisForTest("quais os principais problemas encontrados?", { fullAnswer: answer, sessionIntent: "document_analysis" }, answer);
  const context = api.getActiveAnalysisForTest();
  assert.equal(context.lastAnswerEntities.length, 4);
  const response = api.buildAnalysisReferenceResponseForTest("qual deles e mais grave?");
  assert.ok(response);
  assert.match(response.fullAnswer, /funda(?:c[aã]o|ção) e estrutura/i);
});

test("usa entidades do PDF quando a resposta analitica chega agregada em prosa", () => {
  const { api } = loadElo();
  api.rememberActiveDocumentForTest([{ fileName: "prosa.pdf", text: "Cliente não informado.\nFundação e estrutura sem validação.\nBDI pendente de confirmação." }]);
  const answer = "Os principais problemas são a falta de informações do cliente. Além disso, fundação e estrutura permanecem sem validação. Sem esses elementos, o BDI também não pode ser confirmado.";
  api.rememberActiveAnalysisForTest("quais os principais problemas encontrados?", { fullAnswer: answer, sessionIntent: "document_analysis" }, answer);
  const context = api.getActiveAnalysisForTest();
  assert.equal(context.lastAnswerEntities.length, 3);
  assert.match(api.buildAnalysisReferenceResponseForTest("e o segundo?").fullAnswer, /funda(?:c[aã]o|ção) e estrutura/i);
});

test("separa clausulas tecnicas de analise sem numeracao", () => {
  const { api } = loadElo();
  api.rememberActiveDocumentForTest([{ fileName: "clausulas.pdf", text: "Orçamento preliminar." }]);
  const answer = "Os principais problemas identificados são a ausência do projeto executivo completo e a falta de composições oficiais para fundação e estrutura. Além disso, há pendências de preços vigentes e BDI. Também se destaca que o orçamento é preliminar.";
  api.rememberActiveAnalysisForTest("quais os principais problemas encontrados?", { fullAnswer: answer, sessionIntent: "document_analysis" }, answer);
  const context = api.getActiveAnalysisForTest();
  assert.ok(context.lastAnswerEntities.length >= 3);
  assert.match(api.buildAnalysisReferenceResponseForTest("e o segundo?").fullAnswer, /funda(?:c[aã]o|ção) e estrutura/i);
  assert.doesNotMatch(api.buildAnalysisReferenceResponseForTest("e o ultimo?").fullAnswer, /Recomendo priorizar/i);
});

test("orquestrador central resolve referencias antes da chamada online", () => {
  const { api } = loadElo();
  const answer = "Problemas encontrados: 1. Cliente não informado. 2. Fundação e estrutura sem validação.";
  api.rememberActiveDocumentForTest([{ fileName: "orquestrador.pdf", text: "Problemas de orçamento." }]);
  api.rememberActiveAnalysisForTest("quais os principais problemas encontrados?", { fullAnswer: answer, sessionIntent: "document_analysis" }, answer);

  assert.equal(api.handleAnalysisReferenceForTest("qual deles e mais grave?"), true);
  const nextReference = api.buildAnalysisReferenceResponseForTest("qual deles aparece primeiro?");
  assert.ok(nextReference);
  assert.match(nextReference.fullAnswer, /Cliente não informado|Cliente nao informado/i);
  assert.doesNotMatch(nextReference.fullAnswer, /Entre os problemas identificados.*Entre os problemas identificados/i);
});

test("restaura a ultima analise a partir do historico visual da conversa", () => {
  const { api } = loadElo();
  const answer = "Problemas encontrados: 1. Cliente não informado. 2. Fundação e estrutura sem validação.";
  const restored = api.restoreAnalysisContextFromStoredMessagesForTest([
    { kind: "user", text: "quais os principais problemas encontrados?" },
    { kind: "assistant", text: answer },
    { kind: "user", text: "qual deles e mais grave?" },
    { kind: "assistant", text: "Entre os problemas identificados no arquivo orcamento.pdf, o mais grave é: Cliente não informado." }
  ]);

  assert.ok(restored);
  assert.equal(restored.lastAnswerEntities.length, 2);
  assert.doesNotMatch(restored.analysis, /Entre os problemas identificados/i);
  assert.ok(api.buildAnalysisReferenceResponseForTest("qual deles aparece primeiro?"));
});

test("relatorio contextual conserva fonte, entidades e precedencia quando o PDF continua ativo", () => {
  const { api } = loadElo();
  api.rememberActiveDocumentForTest([{ fileName: "analise-pdf.pdf", text: "Problema: ausencia de precos oficiais." }]);
  const answer = "Analise do documento: falta de precos oficiais e risco de custo nao confiavel.";
  api.rememberActiveAnalysisForTest("analise este PDF", { fullAnswer: answer, sessionIntent: "document_analysis" }, answer);

  const route = api.detectCommandBridgeRequestForTest("gere um relatorio disso");
  assert.equal(route.module, "obrareport_report");
  assert.equal(route.action, "generate_report_from_context");
  const response = api.buildReportFromAnalysisContextForTest("gere um relatorio disso");
  assert.equal(response.reportFromAnalysisContext.source, "document_analysis");
  assert.equal(response.reportFromAnalysisContext.activeSubject, "pdf");
  assert.ok(response.reportFromAnalysisContext.entities.length > 0);
  assert.match(response.fullAnswer, /precos oficiais/i);
});

test("cobre os quatro fluxos obrigatorios de relatorio contextual", () => {
  const pdfAnswer = "Analise tecnica do PDF: falta de precos oficiais e escopo incompleto.";

  const scenarioA = loadElo();
  scenarioA.api.rememberActiveDocumentForTest([{ fileName: "a.pdf", text: "Problemas: falta de precos oficiais e escopo incompleto." }]);
  scenarioA.api.rememberActiveAnalysisForTest("analise este PDF", { fullAnswer: pdfAnswer, sessionIntent: "document_analysis" }, pdfAnswer);
  assert.equal(scenarioA.api.buildReportFromAnalysisContextForTest("gere um relatorio disso").reportFromAnalysisContext.source, "document_analysis");

  const scenarioB = loadElo();
  scenarioB.api.rememberActiveDocumentForTest([{ fileName: "b.pdf", text: "Problemas: falta de precos oficiais e escopo incompleto." }]);
  scenarioB.api.rememberActiveAnalysisForTest("analise este PDF", { fullAnswer: pdfAnswer, sessionIntent: "document_analysis" }, pdfAnswer);
  scenarioB.api.rememberSessionTurnForTest("calcule 15% de 38000", { sessionTheme: "matematica", sessionIntent: "math" }, "Resultado: 5700");
  assert.ok(scenarioB.api.buildReportFromAnalysisContextForTest("gere um relatorio disso").reportFromAnalysisContext.entities.length > 0);

  const scenarioC = loadElo();
  scenarioC.api.rememberActiveDocumentForTest([{ fileName: "c.pdf", text: "Problemas: falta de precos oficiais e escopo incompleto." }]);
  scenarioC.api.rememberActiveAnalysisForTest("analise este PDF", { fullAnswer: pdfAnswer, sessionIntent: "document_analysis" }, pdfAnswer);
  scenarioC.api.rememberSessionTurnForTest("por que o ceu e azul?", { sessionTheme: "conversa_geral", sessionIntent: "general" }, "A luz azul se espalha mais na atmosfera.");
  assert.equal(scenarioC.api.buildReportFromAnalysisContextForTest("gere um relatorio disso").reportFromAnalysisContext.documentId.length > 0, true);

  const scenarioD = loadElo();
  const engineeringAnswer = "Analise tecnica de engenharia: risco estrutural na viga e necessidade de vistoria.";
  scenarioD.api.rememberActiveAnalysisForTest("analise esta vistoria de engenharia", { fullAnswer: engineeringAnswer, sessionIntent: "engineering_analysis" }, engineeringAnswer);
  const reportD = scenarioD.api.buildReportFromAnalysisContextForTest("gere um relatorio disso");
  assert.equal(reportD.reportFromAnalysisContext.source, "last_analysis");
  assert.match(reportD.fullAnswer, /risco estrutural/i);
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

test("relatório de contexto vence o fast path genérico da ponte de comandos", () => {
  const source = fs.readFileSync(path.join(__dirname, "elo-assistente.js"), "utf8");
  const contextFastPath = source.indexOf("if (handleEloReportFromAnalysisContextFastPath_(cleanQuestion)) return;");
  const genericBridgeFastPath = source.indexOf("if (!attachedFiles.length && isEloCommandBridgePriorityRequest_(domainCommandRequest))");
  assert.ok(contextFastPath >= 0, "fast path de relatório contextual deve existir");
  assert.ok(genericBridgeFastPath >= 0, "fast path genérico da ponte deve existir");
  assert.ok(contextFastPath < genericBridgeFastPath, "relatório contextual deve ter precedência sobre a ponte genérica");

  const { api } = loadElo();
  api.rememberActiveAnalysisForTest("analise esta foto", { fullAnswer: analysisAnswer, sessionIntent: "image_analysis" }, analysisAnswer);
  const response = api.buildReportFromAnalysisContextForTest("gere um relatório disso");
  assert.equal(response.sessionIntent, "generate_report_from_context");
  assert.equal(response.reportFromAnalysisContext.realReportAction, true);
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
  assert.match(calls[0].url, /(?:\/api\/obrareport\/documents\/generate|https:\/\/script\.test\/report)$/);
  const payload = JSON.parse(calls[0].options.body);
  const reportPayload = payload.generatorPayload || payload;
  assert.equal(reportPayload.fotosUnidade.length, 0);
  assert.match(reportPayload.report.observacoes, /falta de material/i);
  assert.equal(reportPayload.inconformidades.length, 0);
});
