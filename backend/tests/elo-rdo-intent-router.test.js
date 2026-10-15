import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); }
  };
}

function loadAssistant() {
  const sandbox = {
    console,
    document: { readyState: "complete", addEventListener() {}, body: { dataset: {}, getAttribute() { return ""; } } },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      location: { hostname: "localhost", protocol: "http:", origin: "http://localhost", pathname: "/elo.html" },
      localStorage: createStorage(),
      sessionStorage: createStorage(),
      performance: { mark() {}, now() { return 0; } },
      setTimeout() {},
      fetch() { throw new Error("fetch nao deve ser chamado no detector de intent RDO"); }
    }
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return sandbox.window.EloAssistente;
}

test("ELO roteia frases de RDO para actions reais do Action Bus", () => {
  const assistant = loadAssistant();
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("liste os RDOs desta obra")), JSON.stringify({ module: "obrareport_rdo", action: "rdo.list", payload: { message: "liste os RDOs desta obra" } }));
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("abra o RDO de ontem")), JSON.stringify({ module: "obrareport_rdo", action: "rdo.get", payload: { message: "abra o RDO de ontem" } }));
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("quais problemas se repetiram nos ultimos 30 dias?")), JSON.stringify({ module: "obrareport_rdo", action: "rdo.problemsByPeriod", payload: { message: "quais problemas se repetiram nos ultimos 30 dias?" } }));
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("quais RDOs existem?")), JSON.stringify({ module: "obrareport_rdo", action: "rdo.list", payload: { message: "quais RDOs existem?" } }));
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("crie um RDO para hoje")), JSON.stringify({ module: "obrareport_rdo", action: "preview_new_rdo", payload: { message: "crie um RDO para hoje" } }));
  assert.equal(assistant.detectCommandBridgeRequestForTest("rota invalida rdo step04"), null);
  assert.equal(assistant.detectCommandBridgeRequestForTest("rdo banana xyz"), null);
});

test("documento generico nao sequestra o contexto para o modulo municipal", () => {
  const assistant = loadAssistant();
  assert.equal(assistant.detectCommandBridgeRequestForTest("qual e o codigo do documento?"), null);
  assert.equal(assistant.detectCommandBridgeRequestForTest("voltando ao documento, qual foi o problema mais grave?"), null);
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("mostre os documentos da prefeitura")), JSON.stringify({
    module: "municipal",
    action: "archive.documents.list",
    payload: { message: "mostre os documentos da prefeitura" }
  }));
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("agora fale sobre a prefeitura")), JSON.stringify({
    module: "municipal",
    action: "municipal.attention",
    payload: { message: "agora fale sobre a prefeitura" }
  }));
});

test("RDO updates and quantity corrections reach the confirmed RDO action", () => {
  const assistant = loadAssistant();
  [
    "adicione uma observação nesse RDO",
    "acrescente ao RDO produção de Alvenaria: 12 m²; equipe: 4 funcionários",
    "corrija no RDO a quantidade da produção de Alvenaria de 12 m² para 15 m²",
    "ajuste a equipe do RDO de 4 para 5 funcionários",
    "acrescente ao RDO produção de Fachada: 12 m²",
    "corrija no RDO a produção de Escada de 12 m² para 15 m²",
    "adicione material ao RDO: cimento 2 sacos"
  ].forEach(message => {
    const request = assistant.detectCommandBridgeRequestForTest(message);
    assert.equal(request.module, "obrareport_rdo", message);
    assert.equal(request.action, "rdo.update.preview", message);
    assert.equal(assistant.isCommandBridgePriorityRequestForTest(request), true);
  });
});

test("RDO submitted routing preserves field separators, decimal quantities and wake prefixes", () => {
  const assistant = loadAssistant();
  const message = "Acrescente ao RDO produção de Alvenaria: 12,5 m²; equipe: 4 funcionários; observação: registro sintético.";
  for (const input of [message, "Elo, " + message]) {
    const routed = assistant.stripWakePrefixForRoutingForTest(input);
    assert.equal(routed, message);
    assert.equal(assistant.detectCommandBridgeRequestForTest(routed).payload.message, message);
  }
});

test("explicit RDO PDF and reads keep priority over generic document context", () => {
  const assistant = loadAssistant();
  assistant.rememberActiveDocumentForTest([{ fileName: "fixture.txt", type: "txt", text: "Documento ativo de teste." }]);
  ["gere o PDF do RDO", "gere o PDF do RDO com isso", "exporte o documento do RDO ID obr_rdo_fixture"].forEach(message => {
    const request = assistant.detectCommandBridgeRequestForTest(message);
    assert.equal(request.module, "obrareport_rdo");
    assert.equal(request.action, "rdo.generateDocument");
    assert.equal(assistant.isCommandBridgePriorityRequestForTest(request), true);
  });
  ["abra o RDO ID obr_rdo_fixture", "liste os RDOs desta obra"].forEach(message => {
    assert.equal(assistant.isCommandBridgePriorityRequestForTest(assistant.detectCommandBridgeRequestForTest(message)), true);
  });
  assert.equal(assistant.detectCommandBridgeRequestForTest("gere o PDF deste documento"), null);
  assert.equal(assistant.detectCommandBridgeRequestForTest("desenhe a fachada no CADISTA"), null);
  const source = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8");
  assert.match(source, /!hasExplicitRdoCommand && handleEloAnalysisReferenceFastPath_/);
  assert.match(source, /!hasExplicitRdoCommand && handleEloReportFromAnalysisContextFastPath_/);
});

test("ELO offers an authenticated PDF action only for metadata linked to the requested RDO", () => {
  const assistant = loadAssistant();
  const bridgeResult = { handled: true, ok: true, action: "rdo.generateDocument", humanAnswer: "PDF oficial gerado.", data: {
    rdo: { id: "obr_rdo_fixture" }, document: { id: "obr_doc_fixture", rdo_id: "obr_rdo_fixture", source_id: "obr_rdo_fixture" }
  } };
  const answer = assistant.buildCommandBridgeAnswerForTest(bridgeResult);
  assert.equal(JSON.stringify(answer.pdfAction), JSON.stringify({ type: "rdo_official_pdf", label: "Abrir PDF oficial", documentId: "obr_doc_fixture", rdoId: "obr_rdo_fixture" }));
  assert.equal(Object.hasOwn(answer.pdfAction, "token"), false);
  assert.equal(Object.hasOwn(answer.pdfAction, "url"), false);
  assert.equal(assistant.buildCommandBridgeAnswerForTest({ ...bridgeResult, ok: false }).pdfAction, null);
  assert.equal(assistant.buildCommandBridgeAnswerForTest({ ...bridgeResult, data: { ...bridgeResult.data, document: { ...bridgeResult.data.document, rdo_id: "other-rdo" } } }).pdfAction, null);
});

test("follow-ups coerentes reutilizam documento ativo sem prender assuntos independentes", () => {
  const assistant = loadAssistant();
  assistant.rememberActiveDocumentForTest([{ fileName: "fixture.txt", type: "txt", text: "Codigo DOC-ELO-ALFA-271. Problema grave: infiltracao." }]);
  [
    "qual e o codigo?",
    "qual e o valor?",
    "e o segundo?",
    "o mais grave?",
    "onde fala disso?",
    "voltando ao documento",
    "resuma isso",
    "continue"
  ].forEach((question) => assert.equal(assistant.isActiveDocumentReferenceForTest(question), true, question));
  // Contextual reports already use the explicit report route in the baseline.
  // Keep checking that this wording is not promoted to a municipal archive.
  assert.equal(assistant.detectCommandBridgeRequestForTest("faça um relatório disso").module, "obrareport_report");
  assert.equal(assistant.detectCommandBridgeRequestForTest("faça um relatório disso").action, "generate_report_from_context");
  assert.equal(assistant.isActiveDocumentReferenceForTest("quanto e 15% de 38000?"), false);
  assert.equal(assistant.isActiveDocumentReferenceForTest("por que o ceu e azul?"), false);
  assert.equal(assistant.isActiveDocumentReferenceForTest("agora fale sobre a prefeitura"), false);
  const payload = { message: "qual e o codigo?", context: {} };
  assert.equal(assistant.applyActiveDocumentContextToPayloadForTest(payload, payload.message), true);
  assert.equal(payload.message, "qual e o codigo?");
  assert.match(payload.context.documentsSummary, /Documento ativo/i);
  assert.match(payload.context.documentsSummary, /DOC-ELO-ALFA-271/i);
  assert.equal(payload.context.activeDocumentReused, true);
});
