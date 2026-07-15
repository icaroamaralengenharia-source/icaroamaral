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
  return { getItem(key) { return data.has(key) ? data.get(key) : null; }, setItem(key, value) { data.set(String(key), String(value)); }, removeItem(key) { data.delete(key); }, clear() { data.clear(); } };
}
function createElement(tag) {
  return { tagName: String(tag || "").toUpperCase(), dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {}, setAttribute() {}, getAttribute() { return ""; }, querySelector() { return null; }, querySelectorAll() { return []; }, textContent: "", value: "", options: [], selectedIndex: -1 };
}
function fixtureBudget(facts) {
  return { projectFacts: facts, budgetEap: { stages: [{ name: "Servicos preliminares" }, { name: "Fundacao" }, { name: "Estrutura" }, { name: "Vedacoes" }, { name: "Cobertura" }], items: [{ description: "Locacao de obra" }, { description: "Fundacao" }, { description: "Alvenaria" }] }, quantities: [{ serviceId: "area_construida", description: "Area construida", quantity: facts.builtAreaM2 || 0, unit: "m2", source: "engine_stub" }], compositionMatches: [], priceStatus: { canTotal: false, totals: null, missingPrices: [] }, missing: [], risks: ["Orcamento preliminar sem fechamento financeiro."], baseStatus: { loaded: false, source: "SINAPI", state: facts.uf || "BA", referenceMonth: "" } };
}
function loadAssistant() {
  const localStorage = createStorage();
  const sandbox = { console, Date, Math, setTimeout(fn) { if (typeof fn === "function") fn(); return 0; }, clearTimeout() {}, Blob: function Blob() {}, URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} }, URLSearchParams, window: { ELO_SKIP_AUTO_WIDGET: true, ELO_DISABLE_AUTOFOCUS: true, ELO_PRODUCT_MODE: true, localStorage, sessionStorage: createStorage(), location: { hostname: "localhost", protocol: "http:", pathname: "/relatorio-qualidade-obras.html", hash: "" }, addEventListener() {}, removeEventListener() {}, crypto: { randomUUID: () => "test-id" }, open() { return { document: { open() {}, write() {}, close() {} }, focus() {} }; }, setTimeout(fn) { if (typeof fn === "function") fn(); return 0; }, clearTimeout() {}, EloBudgetEngine: { buildPreliminaryBudget(facts) { return fixtureBudget(facts || {}); } } }, document: { readyState: "complete", body: createElement("body"), createElement, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } }, navigator: { userAgent: "node-test" } };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const file of ["stock-ai-composition-engine.js", "bases-reais/sinapi-ba-202412-index.js", "composition-search-engine.js", "elo-assistente.js"]) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  return { elo: sandbox.window.EloAssistente, window: sandbox.window };
}

const env = loadAssistant();
const elo = env.elo;
const CASE_80 = "Quero o orcamento de uma casa terrea de 80 m2 em Vitoria da Conquista/BA, padrao medio, estrutura convencional, alvenaria ceramica e cobertura em telha ceramica.";
const CASE_160 = "Quero orcamento de um sobrado de 160 m2 em Vitoria da Conquista/BA, dois pavimentos, tres quartos, uma suite, banheiro social, lavabo, sala, cozinha, area de servico, garagem, estrutura convencional, alvenaria ceramica e cobertura em telha ceramica.";
function reset() { elo.clearBudgetRecordsForTest(); }
function ask(message) { return elo.buildResponseForTest(message); }
function packageOf(response) { return response.budgetOrchestratorV2?.budgetPackage; }
function docOf(response) { return response.pdfAction?.budgetDocumentData; }
function makePricedCasa80() { reset(); ask(CASE_80); ask("Use SINAPI da Bahia."); ask("Use a competencia 2024-12 e nao desonerado."); return ask("Use BDI de 25%."); }
function line(pack, serviceId) { return (pack.financialLines || []).find((item) => item.serviceId === serviceId); }
function pricedLines(pack) { return (pack.financialLines || []).filter((item) => item.unitPrice !== null && item.directCost !== null); }

test("1. base SINAPI real e localizada", () => {
  assert.equal(env.window.EloPublicSinapiIndex.loaded, true);
  assert.equal(env.window.EloPublicSinapiIndex.source, "SINAPI");
  assert.equal(env.window.EloPublicSinapiIndex.state, "BA");
  assert.equal(env.window.EloPublicSinapiIndex.referenceMonth, "2024-12");
  assert.equal(env.window.EloPublicSinapiIndex.totalCompositions, 7829);
  assert.equal(env.window.EloPublicSinapiIndex.totalInputs, 40538);
});

test("2. composicao exata ou compativel usa fonte UF competencia e preco", () => {
  const pack = packageOf(makePricedCasa80());
  const priced = pricedLines(pack);
  assert.ok(priced.length > 0);
  const item = priced[0];
  assert.match(item.composition.status, /exact|compatible/);
  assert.equal(item.composition.source, "SINAPI");
  assert.equal(item.composition.uf, "BA");
  assert.equal(item.composition.competence, "2024-12");
  assert.ok(item.unitPrice > 0);
});

test("3. composicao em revisao manual nao recebe preco", () => {
  const pack = packageOf(makePricedCasa80());
  assert.ok((pack.financialLines || []).some((item) => item.composition.status === "manual_review" || item.composition.status === "not_found"));
});

test("4. composicao nao encontrada preserva quantitativo", () => {
  const pack = packageOf(makePricedCasa80());
  const unresolved = (pack.financialLines || []).find((item) => item.unitPrice === null);
  assert.ok(unresolved);
  assert.ok(unresolved.quantity > 0);
});

test("5. pendencia financeira fica formalizada sem duplicar subtotal", () => {
  const pack = packageOf(makePricedCasa80());
  assert.ok((pack.financialLines || []).some((item) => item.composition.status === "manual_review"));
  assert.equal(pack.financialLines.find((item) => item.serviceId === "alvenaria_liquida")?.composition.status, "non_priced_summary");
  assert.equal(pack.priceStatus.canTotal, false);
});

test("6. competencia valida e registrada", () => {
  const pack = packageOf(makePricedCasa80());
  assert.equal(pack.financialSummary.bdiPercent, 25);
  assert.equal(pack.compositionResolution.competence, "2024-12");
});

test("7. competencia inexistente bloqueia", () => {
  reset(); ask(CASE_80); ask("Use SINAPI da Bahia."); const response = ask("Use a competencia 2025-01 e nao desonerado. Use BDI de 25%.");
  const pack = packageOf(response);
  assert.equal(pack.financialSummary.status, "blocked");
  assert.ok(pack.financialLines.some((item) => item.composition.reason === "competence_unavailable"));
});

test("8. UF valida BA", () => {
  const pack = packageOf(makePricedCasa80());
  assert.equal(pack.compositionResolution.uf, "BA");
});

test("9. UF incompativel bloqueia", () => {
  reset(); ask("Quero orcamento de uma casa terrea de 80 m2 em Aracaju/SE, padrao medio, estrutura convencional, alvenaria ceramica e cobertura em telha ceramica."); const response = ask("Use SINAPI de SE, competencia 2024-12, nao desonerado e BDI de 25%.");
  const pack = packageOf(response);
  assert.equal(pack.financialSummary.status, "blocked");
  assert.ok(pack.financialLines.some((item) => item.composition.reason === "uf_incompatible"));
});

test("10. regime desonerado e nao desonerado ficam explicitos", () => {
  reset(); ask(CASE_80); ask("Use SINAPI da Bahia."); let response = ask("Use a competencia 2024-12 e desonerado. Use BDI de 20%.");
  assert.equal(packageOf(response).compositionResolution.regime, "exempt");
  response = makePricedCasa80();
  assert.equal(packageOf(response).compositionResolution.regime, "non_exempt");
});

test("11. encargos nao sao duplicados", () => {
  const pack = packageOf(makePricedCasa80());
  assert.equal(pack.socialCharges.includedInComposition, true);
  assert.equal(pack.socialCharges.socialChargesPercent, null);
  assert.match(pack.socialCharges.warnings.join(" "), /duplicidade/);
});

test("12. preco ausente nao vira zero", () => {
  const pack = packageOf(makePricedCasa80());
  assert.ok(pack.financialLines.some((item) => item.unitPrice === null && item.directCost === null));
  assert.equal(pack.financialLines.some((item) => item.unitPrice === 0 || item.directCost === 0), false);
});

test("13. custo direto reconcilia nas linhas precificadas", () => {
  const pack = packageOf(makePricedCasa80());
  const total = Number(pricedLines(pack).reduce((sum, item) => sum + item.directCost, 0).toFixed(2));
  assert.equal(pack.financialSummary.directCost, total || null);
});

test("14. materiais mao de obra e equipamentos aparecem quando disponiveis", () => {
  const pack = packageOf(makePricedCasa80());
  const priced = pricedLines(pack)[0];
  assert.ok(priced.breakdown);
  assert.ok(["materials", "labor", "equipment"].some((key) => priced.breakdown[key] !== null));
});

test("15. BDI informado pelo usuario e reproduzivel", () => {
  const pack = packageOf(makePricedCasa80());
  assert.equal(pack.bdi.bdiPercent, 25);
  assert.match(pack.bdi.formula, /directCost/);
});

test("16. BDI ausente bloqueia preco de venda", () => {
  reset(); ask(CASE_80); ask("Use SINAPI da Bahia."); const response = ask("Use a competencia 2024-12 e nao desonerado.");
  const pack = packageOf(response);
  assert.equal(pack.financialSummary.salePrice, null);
  assert.ok(pack.financialSummary.blockers.some((item) => item.reason === "bdi_missing"));
});

test("17. pendencias manuais mantem total final bloqueado", () => {
  const pack = packageOf(makePricedCasa80());
  assert.equal(pack.financialSummary.status, "financial_partial");
  assert.equal(pack.financialSummary.salePrice, null);
  assert.ok(pack.financialSummary.unresolvedItems.length > 0);
});

test("18. cobertura financeira parcial fica visivel", () => {
  const pack = packageOf(makePricedCasa80());
  assert.ok(pack.financialSummary.pricedItems >= 0);
  assert.ok(pack.financialSummary.totalItems >= 37);
  assert.ok(pack.financialSummary.informationalItems >= 1);
  assert.ok(pack.financialSummary.pricedCoveragePercent >= 0 && pack.financialSummary.pricedCoveragePercent <= 100);
});

test("19. revisao de escopo recalcula custos e preserva bloqueios", () => {
  const before = packageOf(makePricedCasa80());
  const response = ask("Troque o piso ceramico por porcelanato 90 x 90, acrescente uma suite e mude a cobertura para laje impermeabilizada.");
  const after = packageOf(response);
  assert.ok(response.revision);
  assert.notEqual(line(after, "cobertura")?.quantity, line(before, "cobertura")?.quantity);
  assert.equal(after.financialSummary.status, "financial_partial");
});

test("20. porcelanato 90 x 90 nao cai na calculadora", () => {
  makePricedCasa80();
  const response = ask("Troque o piso ceramico por porcelanato 90 x 90.");
  assert.equal(response.brain, "budget");
  assert.notEqual(response.sessionIntent, "math");
});

test("21. sem base financeira continua tecnico nao precificado", () => {
  reset(); const response = ask(CASE_80 + " Pode gerar.");
  const pack = packageOf(response);
  assert.equal(pack.financialSummary.status, "unpriced");
  assert.equal(pack.financialSummary.salePrice, null);
});

test("22. todo preco exibido contem fonte UF competencia", () => {
  const pack = packageOf(makePricedCasa80());
  for (const item of pricedLines(pack)) {
    assert.equal(item.composition.source, "SINAPI");
    assert.equal(item.composition.uf, "BA");
    assert.equal(item.composition.competence, "2024-12");
  }
});

test("23. documento e PDF recebem dados financeiros", () => {
  const response = makePricedCasa80();
  const doc = docOf(response);
  assert.ok(doc.financialSummary);
  assert.ok(Array.isArray(doc.financialLines));
  assert.match(response.pdfAction.type, /budget_v2_professional_pdf/);
});

test("24. sobrado 160 m2 gera financeiro auditavel", () => {
  reset(); ask(CASE_160); ask("Use SINAPI da Bahia."); ask("Use a competencia 2024-12 e nao desonerado."); const response = ask("Use BDI de 25%.");
  const pack = packageOf(response);
  assert.ok(pack.financialSummary.totalItems >= 39);
  assert.ok(pack.financialSummary.informationalItems >= 1);
  assert.equal(pack.compositionResolution.uf, "BA");
});

test("25. fluxo real com m2 sobrescrito fecha pacote financeiro sem inventar preco", () => {
  reset();
  ask("Quero o or\u00e7amento de uma casa t\u00e9rrea de 80 m\u00b2 em Vit\u00f3ria da Conquista/BA, padr\u00e3o m\u00e9dio, estrutura convencional, alvenaria cer\u00e2mica e cobertura em telha cer\u00e2mica.");
  ask("Use SINAPI da Bahia.");
  ask("Use a compet\u00eancia 2024-12 e n\u00e3o desonerado.");
  const response = ask("Use BDI de 25%.");
  const pack = packageOf(response);
  assert.equal(response.brain, "budget");
  assert.equal(response.sessionIntent, "budget_v2_residential_created");
  assert.ok(pack.financialSummary);
  assert.ok(Array.isArray(pack.financialLines) && pack.financialLines.length > 0);
  assert.equal(pack.compositionResolution.source, "SINAPI");
  assert.equal(pack.compositionResolution.uf, "BA");
  assert.equal(pack.compositionResolution.competence, "2024-12");
  assert.equal(pack.compositionResolution.regime, "non_exempt");
  assert.equal(pack.financialSummary.bdiPercent, 25);
  assert.equal(pack.financialSummary.salePrice, null);
});