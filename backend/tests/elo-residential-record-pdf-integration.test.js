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

function assertResidentialPdfAction(response, record, options = {}) {
  assert.ok(response.pdfAction, "orcamento residencial deve liberar acao de PDF");
  assert.equal(response.pdfAction.type, "budget_v2_professional_pdf");
  assert.equal(response.pdfAction.label, "Gerar PDF do orçamento");
  assert.equal(response.pdfAction.budgetId, record.numero);
  assert.ok(response.pdfAction.budgetDocumentData, "acao de PDF deve carregar budgetDocumentData V2");
  assert.equal(response.pdfAction.budgetDocumentData.budgetId, record.numero);
  assert.equal(response.pdfAction.budgetDocumentData.documentType, "residential");
  assert.ok(response.pdfAction.budgetDocumentData.scope.length, "documento V2 deve carregar EAP/escopo");
  assert.ok(response.pdfAction.budgetDocumentData.quantities.length, "documento V2 deve carregar quantitativos");
  assert.ok(record.conteudo_html, "record deve carregar HTML profissional");
  assert.match(record.conteudo_html, /elo-professional-pdf/);
  if (options.expectTotals) {
    assert.match(record.custos_encontrados, /Subtotal/i);
    assert.match(record.custos_encontrados, /BDI/i);
    assert.match(record.custos_encontrados, /Total/i);
    assert.doesNotMatch(record.custos_encontrados, /R\$\s*0[,\.]00/);
  }
  const pdfActions = (response.budgetActions || []).filter((action) => action.type === "budget_v2_professional_pdf");
  assert.equal(pdfActions.length, 1, "nao deve duplicar acao de PDF V2");
  assert.ok(pdfActions[0].budgetDocumentData, "acao secundaria tambem deve carregar budgetDocumentData");
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

test("pedido residencial explicito com briefing suficiente usa o motor real, salva record e abre PDF profissional atual", () => {
  const { elo, calls, getCapturedHtml } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero orcamento residencial preliminar para casa terrea 70m2 padrao medio em Salvador/BA, obra completa, 1 pavimento");

  assert.equal(calls.buildPreliminaryBudget, 1);
  assert.match(response.fullAnswer, /Orcamento residencial V2 criado/i);
  assert.match(response.fullAnswer, /gerar PDF/i);

  const records = elo.getBudgetRecordsForTest();
  assert.equal(records.length, 1);
  const record = records[0];
  assert.match(record.titulo, /ELO Or.*amentista V2/i);
  assert.match(record.conteudo_markdown, /Servicos preliminares/i);
  assert.match(record.quantitativos, /Area construida/i);
  assert.match(record.composicoes, /SINAPI-ALV-001/i);
  assert.match(record.custos_encontrados, /Subtotal/i);
  assert.match(record.custos_encontrados, /BDI/i);
  assert.match(record.custos_encontrados, /Total/i);
  assert.match(record.avisos_profissionais, /fixture de teste/i);
  assertResidentialPdfAction(response, record, { expectTotals: true });

  const pdfResponse = elo.buildResponseForTest("gerar PDF");
  assert.equal(pdfResponse.sessionIntent, "budget_v2_current_pdf");
  const html = getCapturedHtml();
  assert.match(html, /elo-professional-pdf/);
  assert.match(html, /or.amento residencial preliminar/i);
  assert.match(html, /Servicos preliminares/i);
  assert.match(html, /Area construida/i);
  assert.match(html, /Subtotal/i);
  assert.match(html, /BDI/i);
  assert.match(html, /Total/i);
  assert.match(html, /fixture de teste/i);
  assert.doesNotMatch(html, /R\$\s*0[,\.]00/);
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
    elo.buildResponseForTest(message);
  }

  assert.equal(calls.buildPreliminaryBudget, 0);
});

test("saida real observada do motor fica legivel sem JSON bruto no record e no PDF", () => {
  const { elo, getCapturedHtml } = loadAssistant({ budget: realObservedShapeBudget() });
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero orcamento residencial preliminar para casa terrea 70m2 padrao medio em Salvador/BA, obra completa, 1 pavimento");
  const [record] = elo.getBudgetRecordsForTest();
  assert.ok(record);
  assert.match(record.conteudo_markdown, /Servicos preliminares/i);
  assert.match(record.conteudo_markdown, /preparacao do canteiro/i);
  assert.match(record.composicoes, /SINAPI-ALV-001/i);
  assert.match(record.composicoes, /Alvenaria de vedacao com bloco ceramico/i);
  assert.match(record.bases_tecnicas, /SINAPI/i);
  assert.match(record.bases_tecnicas, /base.*nao carregada|loaded.*false|nao carregada/i);
  assert.match(record.pendencias, /tipo_fundacao|tipo de fundacao/i);
  assert.doesNotMatch(record.conteudo_markdown, /\{"/);
  assert.doesNotMatch(record.conteudo_markdown, /"[a-zA-Z0-9_]+":/);
  assert.doesNotMatch(record.conteudo_markdown, /\[object Object\]|undefined|\bNaN\b/);
  assert.doesNotMatch(record.conteudo_markdown, /R\$\s*0[,\.]00|total\s*:\s*0|subtotal\s*:\s*0|BDI\s*:\s*0/i);
  assertResidentialPdfAction(response, record);

  const pdfResponse = elo.buildResponseForTest("gerar PDF");
  assert.equal(pdfResponse.sessionIntent, "budget_v2_current_pdf");
  const html = getCapturedHtml();
  assert.match(html, /Servicos preliminares/i);
  assert.match(html, /SINAPI-ALV-001/i);
  assert.match(html, /Valores pendentes/i);
  assert.doesNotMatch(html, /\{&quot;|\{"|&quot;[a-zA-Z0-9_]+&quot;:/);
  assert.doesNotMatch(html, /\[object Object\]|undefined|\bNaN\b/);
  assert.doesNotMatch(html, /R\$\s*0[,\.]00|total\s*:\s*0|subtotal\s*:\s*0|BDI\s*:\s*0/i);
});

test("briefing residencial aceita sistema estrutural convencional sem inventar padrao de acabamento", () => {
  const positiveMessages = [
    "Quero orcamento residencial preliminar para casa terrea de 80 m2 em Salvador/BA, obra completa, estrutura convencional e cobertura em telha ceramica",
    "Quero orcamento residencial preliminar para residencia terrea de 80 m2 em Salvador/BA, obra completa, em sistema construtivo convencional e cobertura em telha ceramica",
    "Quero orcamento residencial preliminar para casa terrea de 80 m2 em Salvador/BA, obra completa, estrutura em concreto armado e cobertura em telha ceramica",
    "Quero orcamento residencial preliminar para casa terrea de 80 m2 em Salvador/BA, obra completa, alvenaria convencional com estrutura de concreto e cobertura em telha ceramica",
    "Quero orcamento residencial preliminar para casa terrea de 80 m2 em Salvador/BA, obra completa, construcao convencional e cobertura em telha ceramica"
  ];

  for (const message of positiveMessages) {
    const { elo, calls } = loadAssistant({ budget: realObservedShapeBudget() });
    elo.clearBudgetRecordsForTest();
    const response = elo.buildResponseForTest(message);
    assert.equal(calls.buildPreliminaryBudget, 1, message);
    assert.equal(response.brain, "budget", message);
    assert.equal(response.sessionIntent, "budget_v2_residential_created", message);
    assert.equal(response.pdfAction?.type, "budget_v2_professional_pdf", message);
    assert.ok(response.pdfAction?.budgetDocumentData, message);
    assert.equal(response.budgetOrchestratorV2.state.structure, "convencional", message);
    assert.equal(elo.getBudgetRecordsForTest().length, 1, message);
  }

  const negativeMessages = [
    "quero uma casa convencional",
    "isso e convencional",
    "quero um orcamento",
    "o procedimento convencional de seguranca da equipe",
    "CADISTA, faca um desenho convencional da planta"
  ];

  for (const message of negativeMessages) {
    const { elo, calls } = loadAssistant();
    const response = elo.buildResponseForTest(message);
    assert.equal(calls.buildPreliminaryBudget, 0, message);
    assert.notEqual(response.sessionIntent, "budget_v2_residential_created", message);
    assert.equal(response.pdfAction?.budgetDocumentData, undefined, message);
  }
});

test("entrada real residencial com m2 sobrescrito gera documento V2 completo", () => {
  const { elo, calls } = loadAssistant({ budget: realObservedShapeBudget() });
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero um or?amento preliminar para uma casa t?rrea de 80 m?, com dois quartos, um banheiro, sala, cozinha, ?rea de servi?o, estrutura convencional e cobertura em telha cer?mica, em Vit?ria da Conquista/BA.");

  assert.equal(calls.buildPreliminaryBudget, 1);
  assert.equal(response.brain, "budget");
  assert.equal(response.sessionIntent, "budget_v2_residential_created");
  assert.equal(response.pdfAction?.type, "budget_v2_professional_pdf");
  assert.ok(response.pdfAction?.budgetDocumentData);
  assert.equal(response.budgetOrchestratorV2.state.areaM2, 80);
  assert.match(response.budgetOrchestratorV2.state.city, /Vit.ria da Conquista/i);
  assert.equal(response.budgetOrchestratorV2.state.uf, "BA");
  assert.equal(response.budgetOrchestratorV2.state.structure, "convencional");
  assert.match(response.budgetOrchestratorV2.state.standard, /n.o informado/);
  assert.ok(elo.getBudgetRecordsForTest().length >= 1);
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
