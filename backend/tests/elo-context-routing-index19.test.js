import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const assistantSource = readFileSync(join(testDir, "../../relatorio-qualidade-obras/elo-assistente.js"), "utf8");

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); }
  };
}

function createTestJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return encode({ alg: "none", typ: "JWT" }) + "." + encode(payload) + ".fixture";
}

function loadAssistant() {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const document = {
    body: { dataset: {}, getAttribute() { return null; }, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } },
    documentElement: { getAttribute() { return null; }, setAttribute() {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() {
      return {
        dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        appendChild() {}, setAttribute() {}, addEventListener() {}, querySelector() { return null; },
        querySelectorAll() { return []; }, textContent: "", innerHTML: "", focus() {}
      };
    }
  };
  const window = {
    localStorage,
    sessionStorage,
    document,
    navigator: { onLine: true, userAgent: "node-test" },
    location: { hostname: "localhost", protocol: "http:", pathname: "/elo.html", search: "", hash: "", assign() {} },
    ELO_AUTH_TOKEN: createTestJwt({ iss: "https://mplpzyalcxhhinuvjthx.supabase.co/auth/v1", exp: Math.floor(Date.now() / 1000) + 3600, sub: "context-route-fixture" }),
    atob(value) { return Buffer.from(value, "base64").toString("binary"); },
    addEventListener() {},
    removeEventListener() {},
    setTimeout(fn) { return setTimeout(fn, 0); },
    clearTimeout,
    URLSearchParams,
    Date,
    Math,
    console,
    fetch() { throw new Error("network disabled in synthetic routing test"); }
  };
  window.window = window;
  const context = vm.createContext({ window, document, navigator: window.navigator, localStorage, sessionStorage, console, setTimeout, clearTimeout, URLSearchParams, Date, Math, fetch: window.fetch });
  vm.runInContext(assistantSource, context, { filename: "elo-assistente.js" });
  return context.window.EloAssistente;
}

const syntheticReportAnswer = "Análise sintética de uma obra E2E: a ficha registra uma fissura no fixture; hipótese de teste; recomendação de revisar somente este exemplo.";

function rememberSyntheticReport(api) {
  api.rememberActiveAnalysisForTest("analise do relatorio E2E sintetico", { fullAnswer: syntheticReportAnswer, sessionIntent: "document_analysis" }, syntheticReportAnswer);
  return syntheticReportAnswer;
}

test("pergunta geral apos contexto de relatorio segue pela conversa geral", () => {
  const api = loadAssistant();
  rememberSyntheticReport(api);
  const question = "Explique a diferença entre fato, hipótese e recomendação usando a ficha 9.";
  const payload = { message: question, context: {} };

  assert.equal(api.detectCommandBridgeRequestForTest(question), null);
  assert.equal(api.applyActiveAnalysisContextToPayloadForTest(payload, question), false);
});

test("resuma esse relatorio usa o contexto ativo em vez da listagem generica", () => {
  const api = loadAssistant();
  const analysis = rememberSyntheticReport(api);
  const question = "Resuma esse relatório.";
  const payload = { message: question, context: {} };

  assert.equal(api.detectCommandBridgeRequestForTest(question), null);
  assert.equal(api.applyActiveAnalysisContextToPayloadForTest(payload, question), true);
  assert.equal(payload.context.lastMeaningfulAnalysis.analysis, analysis);
});

test("fato hipotese e recomendacao isolados nao ativam rota de relatorio", () => {
  const api = loadAssistant();
  const question = "Explique a diferença entre fato, hipótese e recomendação.";
  assert.equal(api.detectCommandBridgeRequestForTest(question), null);
});

test("follow-up legitimo resuma isso preserva analise sintetica ativa", () => {
  const api = loadAssistant();
  const analysis = rememberSyntheticReport(api);
  const payload = { message: "resuma isso", context: {} };

  assert.equal(api.detectCommandBridgeRequestForTest(payload.message), null);
  assert.equal(api.applyActiveAnalysisContextToPayloadForTest(payload, payload.message), true);
  assert.equal(payload.context.lastMeaningfulAnalysis.analysis, analysis);
});

test("mudanca brusca de assunto inicia contexto geral sem anexar relatorio antigo", () => {
  const api = loadAssistant();
  rememberSyntheticReport(api);
  api.rememberSessionTurnForTest("Agora explique como organizar uma agenda semanal.", { sessionTheme: "conversa_geral", sessionIntent: "general" }, "Organize compromissos por prioridade e prazo.");
  const question = "Explique a diferença entre fato, hipótese e recomendação.";
  const payload = { message: question, context: {} };

  assert.equal(api.detectCommandBridgeRequestForTest(question), null);
  assert.equal(api.applyActiveAnalysisContextToPayloadForTest(payload, question), false);
  assert.equal(payload.context.lastMeaningfulAnalysis, undefined);
});

test("retorno explicito ao relatorio reutiliza somente o contexto ativo", () => {
  const api = loadAssistant();
  const analysis = rememberSyntheticReport(api);
  api.rememberSessionTurnForTest("Agora explique como organizar uma agenda semanal.", { sessionTheme: "conversa_geral", sessionIntent: "general" }, "Organize compromissos por prioridade e prazo.");
  const question = "Voltando ao relatório, resuma isso.";
  const payload = { message: question, context: {} };

  assert.equal(api.detectCommandBridgeRequestForTest(question), null);
  assert.equal(api.applyActiveAnalysisContextToPayloadForTest(payload, question), true);
  assert.equal(payload.context.lastMeaningfulAnalysis.analysis, analysis);
});

test("novo PDF substitui o contexto documental anterior", () => {
  const api = loadAssistant();
  api.rememberActiveDocumentForTest([{ fileName: "fixture-antigo.pdf", text: "FIXTURE_ANTIGA: conteúdo documental sintético sem dados reais." }]);
  api.rememberActiveAnalysisForTest("analise o PDF antigo", { fullAnswer: "Análise sintética do PDF antigo: FIXTURE_ANTIGA.", sessionIntent: "document_analysis" }, "Análise sintética do PDF antigo: FIXTURE_ANTIGA.");
  api.rememberActiveDocumentForTest([{ fileName: "fixture-novo.pdf", text: "FIXTURE_NOVA: conteúdo documental sintético sem dados reais." }]);
  const payload = { message: "resuma esse relatório", context: {} };

  assert.equal(api.getActiveAnalysisForTest(), null);
  assert.equal(api.applyActiveDocumentContextToPayloadForTest(payload, payload.message), true);
  assert.match(payload.context.documentsSummary, /FIXTURE_NOVA/);
  assert.doesNotMatch(payload.context.documentsSummary, /FIXTURE_ANTIGA/);
});

test("nova imagem invalida analise do anexo anterior antes de nova analise", () => {
  const api = loadAssistant();
  api.rememberActiveDocumentForTest([{ fileName: "fixture-anterior.pdf", text: "FIXTURE_ANTERIOR: conteúdo sintético." }]);
  api.rememberActiveAnalysisForTest("analise do PDF anterior", { fullAnswer: "Análise sintética antiga: FIXTURE_ANTERIOR.", sessionIntent: "document_analysis" }, "Análise sintética antiga: FIXTURE_ANTERIOR.");
  api.beginImageAttachmentForTest({ name: "imagem-fixture.png", type: "image/png" });
  const payload = { message: "resuma isso", context: {} };

  assert.equal(api.getActiveAnalysisForTest(), null);
  assert.equal(api.applyActiveAnalysisContextToPayloadForTest(payload, payload.message), false);
  assert.equal(payload.context.lastMeaningfulAnalysis, undefined);
});

test("sem contexto ativo pedido de relatorio nao inventa analise", () => {
  const api = loadAssistant();
  const response = api.buildReportFromAnalysisContextForTest("gere um relatório disso");

  assert.equal(response.sessionIntent, "generate_report_from_context_missing_context");
  assert.match(response.fullAnswer, /envie ou cole a analise|anexe o arquivo/i);
  assert.doesNotMatch(response.fullAnswer, /FIXTURE_|conteudo documental|constatacao de obra real/i);
});

test("zero false routing: prompts gerais com recomendacao nunca selecionam relatorio", () => {
  const api = loadAssistant();
  const generalPrompts = [
    "Explique a diferença entre fato, hipótese e recomendação usando a ficha 9.",
    "Qual recomendação geral ajuda a priorizar tarefas de escritório?",
    "Dê uma recomendação para organizar o planejamento semanal.",
    "O que diferencia uma hipótese de uma recomendação?"
  ];
  const reportRoutes = generalPrompts.map((prompt) => api.detectCommandBridgeRequestForTest(prompt)).filter((route) => route && route.module === "obrareport_report");

  assert.deepEqual(reportRoutes, []);
});
