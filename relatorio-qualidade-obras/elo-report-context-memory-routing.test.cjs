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
  const storage = options.storage || createStorage();
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
  return { api: context.window.EloAssistente, storage, fetchCalls: () => fetchRequests.length, fetchRequests: () => fetchRequests.slice() };
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

const oldRdoAnalysis = "Analise tecnica do RDO A: infiltracao recorrente na parede norte e registro anterior pendente.";
const imageBAnalysis = "Analise tecnica da imagem B. Principal problema: trinca diagonal recente no encontro da viga.";
const pdfBAnalysis = "Analise tecnica do PDF B. Principal problema: ausencia de projeto executivo atualizado.";

function rememberOldRdoAnalysis(api) {
  api.rememberActiveAnalysisForTest("analise o RDO anterior", { fullAnswer: oldRdoAnalysis, sessionIntent: "rdo_analysis" }, oldRdoAnalysis);
}

function rememberCurrentImageAnalysis(api) {
  api.rememberActiveAnalysisForTest("Analise esta imagem", { fullAnswer: imageBAnalysis, sessionTheme: "analise-visual", sessionIntent: "image_analysis" }, imageBAnalysis);
}

function rememberCurrentPdfAnalysis(api) {
  api.rememberActiveAnalysisForTest("Resuma este documento", { fullAnswer: pdfBAnalysis, sessionIntent: "document_analysis" }, pdfBAnalysis);
}

function getFollowUpAnalysis(api, question) {
  const payload = { message: question, context: {} };
  assert.equal(api.applyActiveAnalysisContextToPayloadForTest(payload, question), true);
  return payload.context.imageAnalysisContext && payload.context.imageAnalysisContext.analysis || payload.context.lastMeaningfulAnalysis.analysis;
}

function setCurrentConversation(api, id) {
  api.setCurrentConversationIdForTest(id);
}

test("regressao A: novo attachment de imagem bloqueia RDO antigo e direciona follow-up para a imagem", () => {
  const { api } = loadElo();
  rememberOldRdoAnalysis(api);
  api.beginImageAttachmentForTest({ name: "image-B.jpeg" });

  assert.equal(api.getActiveAnalysisForTest(), null);
  rememberCurrentImageAnalysis(api);
  const context = getFollowUpAnalysis(api, "Qual e o principal problema?");
  assert.match(context, /imagem B/i);
  assert.doesNotMatch(context, /RDO A|infiltracao recorrente/i);
});

test("regressao B: relatorio apos imagem usa a analise da imagem atual", () => {
  const { api } = loadElo();
  rememberOldRdoAnalysis(api);
  api.beginImageAttachmentForTest({ name: "image-B.jpeg" });
  rememberCurrentImageAnalysis(api);

  const report = api.buildReportFromAnalysisContextForTest("Faca um relatorio disso");
  assert.equal(report.sessionIntent, "generate_report_from_context");
  assert.match(report.reportFromAnalysisContext.analysis, /imagem B/i);
  assert.doesNotMatch(report.reportFromAnalysisContext.analysis, /RDO A|infiltracao recorrente/i);
});

test("regressao C: resumo do PDF B substitui a elegibilidade do PDF/RDO A para follow-up", () => {
  const { api } = loadElo();
  api.rememberActiveDocumentForTest([{ fileName: "documento-A.pdf", text: "RDO A: infiltracao recorrente na parede norte." }]);
  rememberOldRdoAnalysis(api);
  api.rememberActiveDocumentForTest([{ fileName: "documento-B.pdf", text: "PDF B: projeto executivo ausente." }]);

  assert.equal(api.getActiveAnalysisForTest(), null);
  rememberCurrentPdfAnalysis(api);
  const context = getFollowUpAnalysis(api, "Qual e o principal problema?");
  assert.match(context, /PDF B/i);
  assert.doesNotMatch(context, /RDO A|infiltracao recorrente/i);
});

test("regressao D: relatorio contextual do PDF usa a analise do PDF B", () => {
  const { api } = loadElo();
  api.rememberActiveDocumentForTest([{ fileName: "documento-A.pdf", text: "RDO A: infiltracao recorrente na parede norte." }]);
  rememberOldRdoAnalysis(api);
  api.rememberActiveDocumentForTest([{ fileName: "documento-B.pdf", text: "PDF B: projeto executivo ausente." }]);
  rememberCurrentPdfAnalysis(api);

  const report = api.buildReportFromAnalysisContextForTest("Gere um relatorio disso");
  assert.equal(report.sessionIntent, "generate_report_from_context");
  assert.match(report.reportFromAnalysisContext.analysis, /PDF B/i);
  assert.doesNotMatch(report.reportFromAnalysisContext.analysis, /RDO A|infiltracao recorrente/i);
});

test("regressao E: ao trocar imagem A por PDF B, follow-up usa o attachment mais recente", () => {
  const { api } = loadElo();
  api.beginImageAttachmentForTest({ name: "image-A.jpeg" });
  api.rememberActiveAnalysisForTest("Analise esta imagem", { fullAnswer: "Analise tecnica da imagem A: infiltracao antiga.", sessionIntent: "image_analysis" }, "Analise tecnica da imagem A: infiltracao antiga.");
  api.rememberActiveDocumentForTest([{ fileName: "documento-B.pdf", text: "PDF B: projeto executivo ausente." }]);

  assert.equal(api.getActiveAnalysisForTest(), null);
  rememberCurrentPdfAnalysis(api);
  const context = getFollowUpAnalysis(api, "Qual e o principal problema?");
  assert.match(context, /PDF B/i);
  assert.doesNotMatch(context, /imagem A|infiltracao antiga/i);
});

test("regressao F: referencia explicita ao historico evita injetar o attachment atual", () => {
  const { api } = loadElo();
  api.saveConversationForTest("Analise o relatorio anterior sobre infiltracao", oldRdoAnalysis);
  api.rememberActiveDocumentForTest([{ fileName: "documento-B.pdf", text: "PDF B: projeto executivo ausente." }]);
  rememberCurrentPdfAnalysis(api);

  const question = "Volte ao relatorio anterior sobre a infiltracao";
  const documentPayload = { message: question, context: {} };
  const analysisPayload = { message: question, context: {} };
  assert.equal(api.applyActiveDocumentContextToPayloadForTest(documentPayload, question), false);
  assert.equal(api.applyActiveAnalysisContextToPayloadForTest(analysisPayload, question), false);
  assert.ok(api.getOnlineHistoryForTest(question).some((item) => item.content === oldRdoAnalysis));
  assert.match(api.getActiveAnalysisForTest().analysis, /PDF B/i);
});

test("regressao G: sessao sem attachment ou analise pede contexto em vez de reutilizar historico implicitamente", () => {
  const { api } = loadElo();
  api.saveConversationForTest("Analise o relatorio anterior", oldRdoAnalysis);

  assert.equal(api.getActiveAnalysisForTest(), null);
  const response = api.buildReportFromAnalysisContextForTest("Faca um relatorio disso");
  assert.equal(response.sessionIntent, "generate_report_from_context_missing_context");
  assert.doesNotMatch(response.fullAnswer, /infiltracao recorrente/i);
});

test("attachment ativo sobrevive ao reopen e historico antigo nao o substitui implicitamente", () => {
  const firstSession = loadElo();
  setCurrentConversation(firstSession.api, "conversation-context-reopen");
  rememberOldRdoAnalysis(firstSession.api);
  firstSession.api.saveConversationForTest("Analise o relatorio anterior sobre infiltracao", oldRdoAnalysis);
  firstSession.api.beginImageAttachmentForTest({ name: "image-B.jpeg" });

  assert.equal(firstSession.api.restoreAnalysisContextFromStoredMessagesForTest([
    { role: "user", content: "Analise o RDO anterior" },
    { role: "assistant", content: oldRdoAnalysis }
  ]), null);
  rememberCurrentImageAnalysis(firstSession.api);

  const reopened = loadElo({ storage: firstSession.storage });
  setCurrentConversation(reopened.api, "conversation-context-reopen");
  assert.equal(reopened.api.restoreActiveContextForTest(), true);
  assert.match(reopened.api.getActiveAnalysisForTest().analysis, /imagem B/i);
  assert.ok(reopened.api.getOnlineHistoryForTest("Volte ao relatorio anterior sobre infiltracao").some((item) => item.content === oldRdoAnalysis));
});

test("imagem ativa alimenta follow-ups vagos sem uma nova analise visual", () => {
  const { api } = loadElo();
  setCurrentConversation(api, "conversation-image-active");
  api.beginImageAttachmentForTest({ name: "image-A.jpeg" });
  const imageAnalysis = "Imagem A: problema principal: trinca diagonal no encontro da viga. Recomendo vistoria presencial.";
  api.rememberActiveAnalysisForTest("Analise esta imagem", { fullAnswer: imageAnalysis, sessionIntent: "image_analysis" }, imageAnalysis);

  for (const question of ["Qual e o principal problema?", "Isso e grave?"]) {
    const payload = { message: question, context: {} };
    assert.equal(api.applyAttachmentContextToPayloadForTest(payload, question), true);
    assert.equal(payload.context.imageAnalysisContext.source, "active_attachment");
    assert.match(payload.context.imageAnalysisContext.analysis, /trinca diagonal/i);
  }
});

test("request de follow-up envia a analise de imagem no payload real de chat", async () => {
  const { api, fetchRequests } = loadElo({
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, answer: "Resposta baseada na análise salva." }) })
  });
  setCurrentConversation(api, "conversation-image-request");
  api.beginImageAttachmentForTest({ name: "image-A.jpeg" });
  const imageAnalysis = "Imagem A: fissura vertical junto ao vao da janela.";
  api.rememberActiveAnalysisForTest("Analise esta imagem", { fullAnswer: imageAnalysis, sessionIntent: "image_analysis" }, imageAnalysis);

  await api.requestOnlineAnswerForTest("Qual e o principal problema?", [], {});
  const chatRequest = fetchRequests().find((request) => String(request.url).includes("/api/elo/chat"));
  assert.ok(chatRequest);
  const payload = JSON.parse(chatRequest.options.body);
  assert.equal(payload.context.imageAnalysisContext.source, "active_attachment");
  assert.match(payload.context.imageAnalysisContext.analysis, /fissura vertical/i);
});

test("imagem A -> PDF B preserva precedencia PDF, retorna explicitamente a A e volta ao PDF", () => {
  const { api } = loadElo();
  setCurrentConversation(api, "conversation-image-pdf");
  api.beginImageAttachmentForTest({ name: "image-A.jpeg" });
  const imageAnalysis = "Imagem A: infiltracao antiga no encontro da parede com a cobertura.";
  api.rememberActiveAnalysisForTest("Analise esta imagem", { fullAnswer: imageAnalysis, sessionIntent: "image_analysis" }, imageAnalysis);
  api.rememberActiveDocumentForTest([{ fileName: "documento-B.pdf", text: "PDF B: problema principal: projeto executivo ausente." }]);
  rememberCurrentPdfAnalysis(api);

  const activeQuestion = "Qual e o principal problema?";
  const activePayload = { message: activeQuestion, context: {} };
  assert.equal(api.applyAttachmentContextToPayloadForTest(activePayload, activeQuestion), true);
  assert.match(activePayload.context.documentsSummary, /PDF B/);
  assert.equal(activePayload.context.imageAnalysisContext, undefined);
  assert.doesNotMatch(JSON.stringify(activePayload.context), /infiltracao antiga|imagem A/i);

  const returnQuestion = "Volte para a imagem anterior. Qual era o principal problema?";
  const imagePayload = { message: returnQuestion, context: {} };
  assert.equal(api.applyAttachmentContextToPayloadForTest(imagePayload, returnQuestion), true);
  assert.equal(imagePayload.context.imageAnalysisContext.source, "explicit_history");
  assert.match(imagePayload.context.imageAnalysisContext.analysis, /infiltracao antiga/i);
  assert.equal(imagePayload.context.documentsSummary, undefined);

  const backToPdf = "Agora volte para o PDF. Qual era o problema?";
  const pdfPayload = { message: backToPdf, context: {} };
  assert.equal(api.applyAttachmentContextToPayloadForTest(pdfPayload, backToPdf), true);
  assert.match(pdfPayload.context.documentsSummary, /PDF B/);
  assert.doesNotMatch(JSON.stringify(pdfPayload.context), /infiltracao antiga|imagem A/i);
});

test("referencia nomeada recupera imagem do chat atual, mas nao cruza conversas", () => {
  const first = loadElo();
  setCurrentConversation(first.api, "conversation-image-history");
  first.api.beginImageAttachmentForTest({ name: "image-A.jpeg" });
  const imageAnalysis = "Imagem A: problema principal: fissura vertical junto ao vão.";
  first.api.rememberActiveAnalysisForTest("Analise esta imagem", { fullAnswer: imageAnalysis, sessionIntent: "image_analysis" }, imageAnalysis);
  first.api.rememberActiveDocumentForTest([{ fileName: "documento-B.pdf", text: "PDF B: ausencia de detalhe de armadura." }]);

  const reopened = loadElo({ storage: first.storage });
  setCurrentConversation(reopened.api, "conversation-image-history");
  assert.equal(reopened.api.restoreActiveContextForTest(), true);
  const namedQuestion = "Na imagem A, qual era o principal problema?";
  const namedPayload = { message: namedQuestion, context: {} };
  assert.equal(reopened.api.applyAttachmentContextToPayloadForTest(namedPayload, namedQuestion), true);
  assert.match(namedPayload.context.imageAnalysisContext.analysis, /fissura vertical/i);

  const missingLabel = "Na imagem Z, qual era o principal problema?";
  const missingPayload = { message: missingLabel, context: {} };
  assert.equal(reopened.api.applyAttachmentContextToPayloadForTest(missingPayload, missingLabel), true);
  assert.equal(missingPayload.context.imageAnalysisContext.available, false);
  assert.equal(missingPayload.context.documentsSummary, undefined);

  const otherChat = loadElo({ storage: first.storage });
  setCurrentConversation(otherChat.api, "different-conversation");
  assert.equal(otherChat.api.restoreActiveContextForTest(), false);
  const crossChatPayload = { message: namedQuestion, context: {} };
  assert.equal(otherChat.api.applyAttachmentContextToPayloadForTest(crossChatPayload, namedQuestion), true);
  assert.equal(crossChatPayload.context.imageAnalysisContext.available, false);
  assert.equal(crossChatPayload.context.imageAnalysisContext.analysis, undefined);
});

test("analysis de imagem sem ID inicial e vinculada ao chat quando o ID chega", () => {
  const { api } = loadElo();
  api.beginImageAttachmentForTest({ name: "image-A.jpeg" });
  const imageAnalysis = "Imagem A: problema principal: fissura diagonal na viga.";
  api.rememberActiveAnalysisForTest("Analise esta imagem", { fullAnswer: imageAnalysis, sessionIntent: "image_analysis" }, imageAnalysis);
  setCurrentConversation(api, "conversation-image-late-id");

  for (const question of ["Qual e o principal problema?", "Isso e grave?"]) {
    const payload = { message: question, context: {} };
    assert.equal(api.applyAttachmentContextToPayloadForTest(payload, question), true);
    assert.equal(payload.context.imageAnalysisContext.conversationId, "conversation-image-late-id");
    assert.match(payload.context.imageAnalysisContext.analysis, /fissura diagonal/i);
  }

  api.rememberActiveDocumentForTest([{ fileName: "documento-B.pdf", text: "PDF B: ausencia de detalhe executivo." }]);
  rememberCurrentPdfAnalysis(api);
  const explicitImageQuestion = "Volte para a imagem anterior. Qual era o principal problema?";
  const explicitImagePayload = { message: explicitImageQuestion, context: {} };
  assert.equal(api.applyAttachmentContextToPayloadForTest(explicitImagePayload, explicitImageQuestion), true);
  assert.equal(explicitImagePayload.context.imageAnalysisContext.source, "explicit_history");
  assert.match(explicitImagePayload.context.imageAnalysisContext.analysis, /fissura diagonal/i);
});

test("estado de attachment sem conversationId nao pode ser restaurado em outra conversa", () => {
  const first = loadElo();
  first.api.beginImageAttachmentForTest({ name: "image-A.jpeg" });
  const imageAnalysis = "Imagem A: problema principal: fissura diagonal na viga.";
  first.api.rememberActiveAnalysisForTest("Analise esta imagem", { fullAnswer: imageAnalysis, sessionIntent: "image_analysis" }, imageAnalysis);

  const second = loadElo({ storage: first.storage });
  setCurrentConversation(second.api, "conversation-B");
  assert.equal(second.api.restoreActiveContextForTest(), false);
  assert.equal(second.api.getActiveAnalysisForTest(), null);
});

test("payload do chat standalone usa somente o historico visivel da conversa atual", async () => {
  const { api, fetchRequests } = loadElo({
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, answer: "Resposta baseada na conversa atual." }) })
  });
  api.saveConversationForTest("Resuma o PDF anterior", "PDF A: documento de outra conversa, com dado antigo.");
  api.setCoreMessagesElementForTest({
    querySelectorAll() {
      return [{
        classList: { contains(name) { return name === "user"; } },
        dataset: {},
        querySelector() { return { textContent: "O que havia na imagem da conversa anterior?" }; }
      }];
    }
  });

  await api.requestOnlineAnswerForTest("O que havia na imagem da conversa anterior?", [], {});
  const request = fetchRequests().find((item) => String(item.url).includes("/api/elo/chat"));
  assert.ok(request);
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.history.length, 0);
  assert.doesNotMatch(JSON.stringify(payload), /PDF A|dado antigo/);
});

test("follow-up real da imagem envia analise atual sem historico de outro chat", async () => {
  const { api, fetchRequests } = loadElo({
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, answer: "O principal problema é a fissura descrita na imagem." }) })
  });
  setCurrentConversation(api, "conversation-image-followup-real");
  api.beginImageAttachmentForTest({ name: "image-A.jpeg" });
  const imageAnalysis = "Imagem A: fissura diagonal na viga, com recomendacao de vistoria.";
  api.rememberActiveAnalysisForTest("Analise esta imagem", { fullAnswer: imageAnalysis, sessionIntent: "image_analysis" }, imageAnalysis);
  api.saveConversationForTest("Resuma o PDF antigo", "PDF A: documento de outra conversa, com contexto ultrapassado.");
  api.setCoreMessagesElementForTest({
    querySelectorAll() {
      return [
        { classList: { contains(name) { return name === "assistant"; } }, dataset: {}, querySelector() { return { textContent: imageAnalysis }; } },
        { classList: { contains(name) { return name === "user"; } }, dataset: {}, querySelector() { return { textContent: "Qual e o principal problema?" }; } }
      ];
    }
  });

  await api.requestOnlineAnswerForTest("Qual e o principal problema?", [], {});
  const request = fetchRequests().find((item) => String(item.url).includes("/api/elo/chat"));
  assert.ok(request);
  const payload = JSON.parse(request.options.body);
  assert.deepEqual(payload.history, [{ role: "assistant", content: imageAnalysis }]);
  assert.equal(payload.context.imageAnalysisContext.source, "active_attachment");
  assert.match(payload.context.imageAnalysisContext.analysis, /fissura diagonal/i);
  assert.doesNotMatch(JSON.stringify(payload), /PDF A|contexto ultrapassado/);
});

test("criacao atrasada da conversa anterior nao pode assumir o novo chat", async () => {
  const pending = [];
  const { api } = loadElo({
    fetch: (url, options) => new Promise((resolve) => pending.push({ url, options, resolve }))
  });
  const firstCreation = api.ensureCoreConversationForTest();
  assert.equal(pending.length, 1);

  api.startNewConversationForLayoutTest();
  const secondCreation = api.ensureCoreConversationForTest();
  assert.equal(pending.length, 2);

  pending[1].resolve({ ok: true, status: 200, json: async () => ({ ok: true, conversation: { id: "conversation-B" } }) });
  await secondCreation;
  assert.equal(api.getActiveAnalysisForTest(), null);
  assert.equal(api.getCurrentConversationIdForTest(), "conversation-B");

  pending[0].resolve({ ok: true, status: 200, json: async () => ({ ok: true, conversation: { id: "conversation-A" } }) });
  await firstCreation;
  assert.equal(api.getCurrentConversationIdForTest(), "conversation-B");
});
