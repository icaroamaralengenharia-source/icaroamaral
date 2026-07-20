import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); }
  };
}

function createElement(tag) {
  return {
    tagName: String(tag || "").toUpperCase(),
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
    getAttribute() { return ""; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    textContent: "",
    value: "",
    options: [],
    selectedIndex: -1
  };
}

function knownEngineBudget() {
  return {
    projectFacts: { builtAreaM2: 70, city: "Salvador", uf: "BA", constructionType: "casa terrea", standard: "medio" },
    budgetEap: { stages: [{ name: "Servicos preliminares" }, { name: "Fundacao" }, { name: "Alvenaria" }], items: [{ description: "Locacao de obra", origin: "eap-canonica" }, { description: "Alvenaria de vedacao", origin: "eap-canonica" }] },
    quantities: [{ serviceId: "area_construida", description: "Area construida", quantity: 70, unit: "m2", source: "informed" }, { serviceId: "cobertura_telha", description: "Cobertura em telha", quantity: 70, unit: "m2", source: "estimated" }],
    compositionResolution: { resolved: [{ serviceId: "alvenaria", code: "SINAPI-ALV-001", source: "SINAPI", description: "Alvenaria de vedacao com bloco ceramico", unit: "m2" }], missing: [{ serviceId: "fundacao", reason: "tipo de fundacao nao informado" }] },
    compositionMatches: [{ serviceId: "cobertura", code: "SINAPI-COB-001", source: "SINAPI", description: "Telhamento com telha ceramica", unit: "m2" }],
    priceStatus: { canTotal: true, totals: { subtotal: 700, bdiPercent: 20, bdiValue: 140, total: 840 }, missingPrices: [] },
    realBudget: { status: "complete", total: 840, subtotal: 700, bdiPercent: 20, bdiValue: 140, canClose: true },
    missing: [],
    risks: ["Fixture de teste com fonte de preco injetada; nao tratar como preco oficial real."],
    summary: "Orcamento residencial preliminar completo com preco de fixture injetada.",
    baseStatus: { officialPriceBase: "missing" }
  };
}

function realObservedShapeBudget() {
  return {
    projectFacts: { builtAreaM2: 70, city: "Salvador", uf: "BA", constructionType: "casa terrea", standard: "medio" },
    budgetEap: null,
    workPackages: {
      packages: [
        { id: "servicos_preliminares", name: "Servicos preliminares", description: "Preparacao inicial da obra", items: [{ serviceId: "limpeza_inicial", description: "Limpeza inicial e preparacao do canteiro" }] },
        { id: "alvenaria", name: "Alvenaria", description: "Vedacao em blocos", items: [{ serviceId: "alvenaria_bloco", description: "Alvenaria de vedacao" }] }
      ]
    },
    quantities: [{ serviceId: "area_construida", description: "Area construida", quantity: 70, unit: "m2", source: "informed" }],
    compositionResolution: null,
    compositionMatches: [
      { serviceId: "alvenaria_bloco", service: "Alvenaria de vedacao", found: true, composition: { code: "SINAPI-ALV-001", source: "SINAPI", description: "Alvenaria de vedacao com bloco ceramico", unit: "m2" } },
      { serviceId: "cobertura_telha", service: "Cobertura/telhamento", found: true, composition: { compositionCode: "SINAPI-COB-001", source: "SINAPI", compositionName: "Telhamento com telha ceramica", compositionUnit: "m2" } }
    ],
    priceStatus: { canTotal: false, totals: null, missingPrices: [{ serviceId: "alvenaria_bloco", reason: "price_missing", description: "Preco oficial nao carregado" }] },
    realBudget: null,
    missing: [{ serviceId: "fundacao", reason: "tipo_fundacao", description: "Tipo de fundacao nao informado" }],
    risks: [{ reason: "projeto_executivo", message: "Orcamento preliminar depende de projeto executivo." }],
    summary: "Orcamento residencial preliminar com valores pendentes.",
    baseStatus: { loaded: false, source: "SINAPI", state: "BA", referenceMonth: "", totalCompositions: 0, totalInputs: 0, indexDurationMs: 12, lastLoadedAt: "2026-07-11T00:00:00.000Z" }
  };
}

function assertResidentialPdfAction(response, options = {}) {
  assert.ok(response.pdfAction, "orcamento residencial deve liberar acao de PDF");
  assert.equal(response.pdfAction.type, "budget_v2_professional_pdf");
  assert.equal(response.pdfAction.label, "Gerar PDF do orçamento");
  const documentData = response.pdfAction.budgetDocumentData;
  assert.ok(documentData, "acao de PDF deve carregar budgetDocumentData V2");
  assert.ok(documentData.budgetId, "documento V2 deve carregar budgetId");
  if (response.pdfAction.budgetId) assert.equal(response.pdfAction.budgetId, documentData.budgetId);
  assert.equal(documentData.documentType, "residential");
  assert.ok(response.budgetOrchestratorV2?.budgetPackage, "resposta deve carregar budgetPackage");
  assert.ok(documentData.scope.length, "documento V2 deve carregar EAP/escopo");
  assert.ok(documentData.quantities.length, "documento V2 deve carregar quantitativos");
  if (options.expectTotals) {
    assert.ok(documentData.budget);
    assert.doesNotMatch(JSON.stringify(documentData.budget), /R\$\s*0[,\.]00/);
  }
  const saveActions = (response.budgetActions || []).filter((action) => action.type === "budget_v2_save");
  assert.equal(saveActions.length, 1, "orcamento residencial atual deve expor acao de salvar");
  assert.ok(saveActions[0].budgetDocumentData, "acao de salvar tambem deve carregar budgetDocumentData");
}
function loadAssistant(options = {}) {
  const localStorage = createStorage();
  let capturedHtml = "";
  const popup = {
    document: {
      open() {},
      write(html) { capturedHtml = String(html || ""); },
      close() {}
    },
    focus() {}
  };
  const calls = { buildPreliminaryBudget: 0 };
  const sandbox = {
    console,
    Date,
    Math,
    setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
    clearTimeout() {},
    Blob: function Blob() {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    URLSearchParams,
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      ELO_DISABLE_AUTOFOCUS: true,
      ELO_PRODUCT_MODE: true,
      localStorage,
      sessionStorage: createStorage(),
      location: { hostname: "localhost", protocol: "http:", pathname: "/relatorio-qualidade-obras.html", hash: "" },
      addEventListener() {},
      removeEventListener() {},
      crypto: { randomUUID: () => "test-id" },
      open() { return popup; },
      setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
      clearTimeout() {},
      EloBudgetEngine: {
        buildPreliminaryBudget() {
          calls.buildPreliminaryBudget += 1;
          return options.budget || knownEngineBudget();
        }
      }
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
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { elo: sandbox.window.EloAssistente, calls, getCapturedHtml: () => capturedHtml };
}

test("pedido residencial explicito com briefing suficiente usa o motor real e abre PDF profissional atual", () => {
  const { elo, calls, getCapturedHtml } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero orcamento residencial preliminar para casa terrea de 120 m2 em Vitoria da Conquista - BA, padrao medio");

  assert.equal(calls.buildPreliminaryBudget, 1);
  assert.match(response.fullAnswer, /Orcamento residencial V2 criado/i);
  assert.equal(response.sessionIntent, "budget_v2_scope");
  assert.equal(elo.getBudgetRecordsForTest().length, 0);
  assertResidentialPdfAction(response, { expectTotals: true });
  assert.equal(response.pdfAction.budgetDocumentData.facts.builtAreaM2, 120);

  const pdfResponse = elo.buildResponseForTest("gerar PDF");
  assert.equal(pdfResponse.sessionIntent, "budget_v2_current_pdf");
  const html = getCapturedHtml();
  assert.match(html, /elo-professional-pdf/);
  assert.match(html, /or.amento residencial preliminar/i);
  assert.match(html, /120/);
  assert.match(html, /<table/i);
  assert.match(html, /Servi\u00e7o/);
  assert.match(html, /Unidade/);
  assert.match(html, /Quantidade/);
  assert.match(html, /Pre\u00e7o unit\u00e1rio/);
  assert.match(html, /Total/);
  assert.match(html, /Situa\u00e7\u00e3o/);
  assert.match(html, /Vit\u00f3ria da Conquista\/BA/);
  assert.doesNotMatch(html, /R\$\s*0[,\.]00/);
  assert.doesNotMatch(html, /Pagina 0|P\u00e1gina 0|P\u00e1gina 1 de 2|P\u00e1gina 2 de 2/i);
  assert.doesNotMatch(html, /projectType|builtAreaM2|price_source_not_selected|CONTE\u00daDO T\u00c9CNICO CONSOLIDADO/i);
});

test("PDF residencial V2 exibe premissa economica do banheiro sem alterar dados tecnicos", () => {
  const { elo, getCapturedHtml } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  elo.buildResponseForTest("Quero or\u00e7amento residencial preliminar para casa t\u00e9rrea de 120 m\u00b2 em Vit\u00f3ria da Conquista - BA, padr\u00e3o m\u00e9dio");
  const scoped = elo.buildResponseForTest("Reduza o escopo do banheiro.");
  const quantitiesBefore = JSON.stringify(scoped.pdfAction.budgetDocumentData.quantities);
  const financialLinesBefore = JSON.stringify(scoped.pdfAction.budgetDocumentData.financialLines);
  const compositionsBefore = JSON.stringify(scoped.pdfAction.budgetDocumentData.compositions);

  const response = elo.buildResponseForTest("Reduza o padr\u00e3o de acabamento do banheiro para econ\u00f4mico.");

  assert.equal(response.sessionIntent, "budget_v2_scope_reduce_bathroom_finish_economic_applied");
  assert.equal(response.revision?.action, "change_finish_standard");
  assert.equal(response.budgetOrchestratorV2?.budgetPackage?.scopePreferences?.bathroomFinishStandard, "economic");
  assert.equal(response.pdfAction?.type, "budget_v2_professional_pdf");
  const documentData = response.pdfAction.budgetDocumentData;
  assert.equal(JSON.stringify(documentData.quantities), quantitiesBefore);
  assert.equal(JSON.stringify(documentData.financialLines), financialLinesBefore);
  assert.equal(JSON.stringify(documentData.compositions), compositionsBefore);
  assert.equal((documentData.assumptions || []).filter((item) => item === "Banheiro: padr\u00e3o de acabamento econ\u00f4mico.").length, 1);
  assert.equal((response.pdfAction.budgetDocumentData.assumptions || []).filter((item) => item === "Banheiro: padr\u00e3o de acabamento econ\u00f4mico.").length, 1);

  const pdf = elo.openBudgetV2ProfessionalPdfForTest(documentData);
  const html = pdf.html || getCapturedHtml();
  assert.match(html, /<table/i);
  assert.match(html, /Servi\u00e7o/);
  assert.match(html, /Unidade/);
  assert.match(html, /Quantidade/);
  assert.match(html, /Pre\u00e7o unit\u00e1rio/);
  assert.match(html, /Total/);
  assert.match(html, /Situa\u00e7\u00e3o/);
  assert.match(html, /Vit\u00f3ria da Conquista\/BA/);
  assert.equal((html.match(/Banheiro: padr\u00e3o de acabamento econ\u00f4mico\./g) || []).length, 1);
  assert.doesNotMatch(html, /Pagina 0|P\u00e1gina 0|P\u00e1gina 1 de 2|P\u00e1gina 2 de 2/i);
  assert.match(html, /@media print\{html,body\{background:#fff;padding:0\}/);
  assert.doesNotMatch(html, /\.elo-budget-page\{[^}]*break-after:page/i);
  assert.doesNotMatch(html, /<section class="elo-budget-page">\s*<\/section>\s*<\/article>/i);
  assert.doesNotMatch(html, /projectType|builtAreaM2|price_source_not_selected|CONTE\u00daDO T\u00c9CNICO CONSOLIDADO/i);
  assert.doesNotMatch(html, /redu\u00e7\u00e3o de pre\u00e7o|economia monet\u00e1ria|troca efetiva de material|material econ\u00f4mico selecionado|composi\u00e7\u00e3o econ\u00f4mica selecionada/i);
});

test("gatilhos nao residenciais nao chamam o motor de orcamento residencial", () => {
  const { elo, calls } = loadAssistant();
  const messages = [
    "oi, tudo bem?",
    "estou preocupado com a obra",
    "faca OCR desta imagem",
    "busque na web preco de cimento hoje",
    "abrir ferramenta de relatorio"
  ];

  for (const message of messages) {
    const response = elo.buildResponseForTest(message);
    assert.equal(response.pdfAction?.type, undefined, message);
    assert.equal(response.budgetOrchestratorV2?.budgetPackage, undefined, message);
  }

  assert.equal(calls.buildPreliminaryBudget, 0);
});

test("saida real observada do motor fica legivel sem JSON bruto no documento e no PDF", () => {
  const { elo, getCapturedHtml } = loadAssistant({ budget: realObservedShapeBudget() });
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero orcamento residencial preliminar para casa terrea de 120 m2 em Vitoria da Conquista - BA, padrao medio");
  const documentData = response.pdfAction?.budgetDocumentData;
  assert.ok(documentData);
  assert.equal(elo.getBudgetRecordsForTest().length, 0);
  assert.match(response.fullAnswer, /Servicos preliminares|preparacao do canteiro/i);
  assert.match(JSON.stringify(documentData.compositions), /SINAPI-ALV-001|SINAPI-COB-001/i);
  assert.doesNotMatch(response.fullAnswer, /\{"/);
  assert.doesNotMatch(response.fullAnswer, /"[a-zA-Z0-9_]+":/);
  assert.doesNotMatch(response.fullAnswer, /\[object Object\]|undefined|\bNaN\b/);
  assert.doesNotMatch(response.fullAnswer, /R\$\s*0[,\.]00|total\s*:\s*0|subtotal\s*:\s*0|BDI\s*:\s*0/i);
  assertResidentialPdfAction(response);

  const pdfResponse = elo.buildResponseForTest("gerar PDF");
  assert.equal(pdfResponse.sessionIntent, "budget_v2_current_pdf");
  const html = getCapturedHtml();
  assert.match(html, /<table/i);
  assert.match(html, /Servi\u00e7o/);
  assert.match(html, /Unidade/);
  assert.match(html, /Quantidade/);
  assert.match(html, /Pre\u00e7o unit\u00e1rio/);
  assert.match(html, /Total/);
  assert.match(html, /Situa\u00e7\u00e3o/);
  assert.match(html, /Or\u00e7amento ainda n\u00e3o precificado|Pendente/i);
  assert.doesNotMatch(html, /\{&quot;|\{"|&quot;[a-zA-Z0-9_]+&quot;:/);
  assert.doesNotMatch(html, /\[object Object\]|undefined|\bNaN\b/);
  assert.doesNotMatch(html, /R\$\s*0[,\.]00|total\s*:\s*0|subtotal\s*:\s*0|BDI\s*:\s*0/i);
  assert.doesNotMatch(html, /projectType|builtAreaM2|price_source_not_selected|CONTE\u00daDO T\u00c9CNICO CONSOLIDADO/i);
});

test("briefing residencial aceita sistema estrutural convencional sem inventar padrao de acabamento", () => {
  const message = "Quero orcamento residencial preliminar para casa terrea de 120 m2 em Vitoria da Conquista - BA, padrao medio, estrutura convencional";
  const { elo, calls } = loadAssistant({ budget: realObservedShapeBudget() });
  elo.clearBudgetRecordsForTest();
  const response = elo.buildResponseForTest(message);

  assert.equal(calls.buildPreliminaryBudget, 1);
  assert.equal(response.brain, "budget");
  assert.equal(response.sessionIntent, "budget_v2_scope");
  assert.equal(response.pdfAction?.type, "budget_v2_professional_pdf");
  assert.ok(response.pdfAction?.budgetDocumentData);
  assert.equal(response.budgetOrchestratorV2.state.residentialCanonicalState.systems.structure, "convencional");
  assert.equal(response.budgetOrchestratorV2.state.standard, "medio");
  assert.equal(response.budgetOrchestratorV2.state.budgetPackage.scopePreferences, undefined);
  assert.equal(elo.getBudgetRecordsForTest().length, 0);

  const negativeMessages = [
    "quero uma casa convencional",
    "isso e convencional",
    "quero um orcamento",
    "o procedimento convencional de seguranca da equipe",
    "CADISTA, faca um desenho convencional da planta"
  ];

  for (const item of negativeMessages) {
    const negative = loadAssistant();
    const negativeResponse = negative.elo.buildResponseForTest(item);
    assert.equal(negative.calls.buildPreliminaryBudget, 0, item);
    assert.notEqual(negativeResponse.sessionIntent, "budget_v2_scope", item);
    assert.equal(negativeResponse.pdfAction?.budgetDocumentData, undefined, item);
  }
});

test("entrada real residencial com m2 sobrescrito gera documento V2 completo", () => {
  const { elo, calls } = loadAssistant({ budget: realObservedShapeBudget() });
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero orcamento residencial preliminar para casa terrea de 95 m2 em Vitoria da Conquista - BA, padrao medio");

  assert.equal(calls.buildPreliminaryBudget, 1);
  assert.equal(response.brain, "budget");
  assert.equal(response.sessionIntent, "budget_v2_scope");
  assert.equal(response.pdfAction?.type, "budget_v2_professional_pdf");
  assert.ok(response.pdfAction?.budgetDocumentData);
  assert.ok(response.budgetOrchestratorV2.budgetPackage);
  assert.equal(response.budgetOrchestratorV2.state.areaM2, 95);
  assert.match(response.budgetOrchestratorV2.state.city, /Vit.ria da Conquista/i);
  assert.equal(response.budgetOrchestratorV2.state.standard, "medio");
  assert.equal(response.pdfAction.budgetDocumentData.facts.builtAreaM2, 95);
  assert.ok(response.pdfAction.budgetDocumentData.scope.length);
  assert.ok(response.pdfAction.budgetDocumentData.quantities.length);
  assert.ok(response.pdfAction.budgetDocumentData.budgetId);
  assert.equal(elo.getBudgetRecordsForTest().length, 0);
});

test("briefing residencial incompleto pede dados antes de chamar o motor", () => {
  const { elo, calls } = loadAssistant();
  const response = elo.buildResponseForTest("Quero orcamento residencial");

  assert.equal(calls.buildPreliminaryBudget, 0);
  assert.match(response.fullAnswer, /cidade\/UF/i);
  assert.match(response.fullAnswer, /area aproximada/i);
  assert.equal(response.canSave, false);
  assert.equal(response.pdfAction, undefined);
});
