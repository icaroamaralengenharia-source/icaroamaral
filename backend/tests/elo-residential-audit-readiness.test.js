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
  return { projectFacts: facts, budgetEap: { stages: [{ name: "Servicos preliminares" }, { name: "Fundacao" }, { name: "Estrutura" }, { name: "Vedacoes" }, { name: "Cobertura" }], items: [] }, quantities: [], compositionMatches: [], priceStatus: { canTotal: false, totals: null, missingPrices: [] }, missing: [], risks: [], baseStatus: { loaded: false, source: "SINAPI", state: facts.uf || "BA", referenceMonth: "" } };
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
function line(pack, serviceId) { return (pack.financialLines || []).find((item) => item.serviceId === serviceId); }
function makePricedCasa80() { reset(); ask(CASE_80); ask("Use SINAPI da Bahia."); ask("Use a competencia 2024-12 e nao desonerado."); return ask("Use BDI de 25%."); }
function makePricedSobrado160() { reset(); ask(CASE_160); ask("Use SINAPI da Bahia."); ask("Use a competencia 2024-12 e nao desonerado."); return ask("Use BDI de 25%."); }

const casa80 = packageOf(makePricedCasa80());
const casa80Doc = docOf(ask("Use BDI de 25%."));
const sobrado160 = packageOf(makePricedSobrado160());

test("1. auditor detecta quantidade sem formula", () => {
  const audit = elo.buildResidentialAuditReadinessForTest({ quantities: [{ serviceId: "x", quantity: 1, unit: "m2", memory: "m" }], financialLines: [], financialSummary: {} }, { areaM2: 80, city: "Vitoria", uf: "BA", constructionType: "casa", structure: "convencional", roof: "telha" });
  assert.equal(audit.checks.find((item) => item.id === "quantities_have_memory").status, "fail");
});

test("2. auditor detecta quantidade zero", () => {
  const audit = elo.buildResidentialAuditReadinessForTest({ quantities: [{ serviceId: "x", quantity: 0, unit: "m2", formula: "0", memory: "0" }], financialLines: [], financialSummary: {} }, { areaM2: 80, city: "Vitoria", uf: "BA", constructionType: "casa", structure: "convencional", roof: "telha" });
  assert.equal(audit.checks.find((item) => item.id === "quantities_have_memory").status, "fail");
});

test("3. subtotal de alvenaria nao e precificado duas vezes", () => {
  assert.equal(line(casa80, "alvenaria_liquida").composition.status, "non_priced_summary");
  assert.equal(line(casa80, "alvenaria_liquida").directCost, null);
  assert.equal(casa80.financialSummary.informationalItems, 1);
});

test("4. servico critico sem composicao bloqueia", () => {
  const audit = elo.buildResidentialAuditReadinessForTest({ quantities: [], financialLines: [{ serviceId: "cobertura", critical: true, directCost: null, pricingRole: "financial_service", composition: { status: "blocked", reason: "unit_incompatible" } }], financialSummary: { blockers: [{ serviceId: "cobertura", reason: "unit_incompatible" }] } }, { areaM2: 80, city: "Vitoria", uf: "BA", constructionType: "casa", structure: "convencional", roof: "telha" });
  assert.equal(audit.status, "blocked");
});

test("5. servico nao critico pode permanecer pendente sem duplicar custo", () => {
  assert.equal(casa80.financialSummary.blockers.length, 0);
  assert.equal(casa80.financialSummary.salePrice, null);
  assert.equal(casa80.readiness.status, "financial_partial");
});

test("6. unidade incompatível bloqueia", () => {
  reset(); ask(CASE_80); ask("Use SINAPI da Bahia."); const response = ask("Use a competencia 2025-01 e nao desonerado. Use BDI de 25%.");
  assert.equal(packageOf(response).readiness.status, "blocked");
});

test("7. custo direto reconcilia", () => {
  const total = Number(casa80.financialLines.filter((item) => item.directCost !== null).reduce((sum, item) => sum + item.directCost, 0).toFixed(2));
  assert.equal(casa80.financialSummary.directCost, total);
});

test("8. BDI reconcilia quando o total e liberavel", () => {
  assert.equal(casa80.bdi.bdiPercent, 25);
  assert.equal(casa80.bdi.bdiValue, Number((casa80.financialSummary.directCost * 0.25).toFixed(2)));
});

test("9. encargos nao duplicam", () => {
  assert.equal(casa80.socialCharges.includedInComposition, true);
  assert.equal(casa80.socialCharges.socialChargesPercent, null);
});

test("10. salePrice nulo com pendencia", () => {
  assert.equal(casa80.financialSummary.salePrice, null);
  assert.equal(casa80.priceStatus.canTotal, false);
});

test("11. salePrice liberado sem blocker apos escolhas manuais", () => {
  const response = makePricedCasa80();
  let current = response;
  for (let i = 0; i < 4; i += 1) current = ask("escolha 1");
  const pack = packageOf(current);
  assert.equal(pack.financialSummary.status, "financially_ready");
  assert.equal(pack.priceStatus.canTotal, true);
  assert.ok(pack.financialSummary.salePrice > pack.financialSummary.directCost);
});

test("12. readiness financial_partial", () => {
  assert.equal(casa80.readiness.status, "financial_partial");
});

test("13. readiness financial_ready", () => {
  makePricedCasa80(); let current; for (let i = 0; i < 4; i += 1) current = ask("escolha 1");
  assert.equal(packageOf(current).readiness.status, "financial_ready");
});

test("14. score nao ignora blocker", () => {
  const audit = elo.buildResidentialAuditReadinessForTest({ quantities: [], financialLines: [{ serviceId: "estrutura_concreto", critical: true, directCost: null, pricingRole: "financial_service", composition: { status: "blocked", reason: "unit_incompatible" } }], financialSummary: { directCost: 100, blockers: [{ serviceId: "estrutura_concreto", reason: "unit_incompatible" }], salePrice: null, pricedCoveragePercent: 99 } }, { areaM2: 80, city: "Vitoria", uf: "BA", constructionType: "casa", structure: "convencional", roof: "telha" });
  assert.equal(audit.status, "blocked");
  assert.ok(audit.score < 100);
});

test("15. revisao manual de composicao lista candidatas", () => {
  makePricedCasa80();
  const response = ask("revisar composicoes");
  assert.equal(response.sessionIntent, "budget_v2_manual_composition_review");
  assert.ok(response.manualCompositionOptions.length >= 4);
});

test("16. escolha do usuario persiste", () => {
  makePricedCasa80();
  const response = ask("escolha 1");
  assert.ok(response.manualCompositionApproval.code);
  assert.ok(response.residentialBudgetState.manualCompositionApprovals);
});

test("17. revisao de escopo cria nova versao", () => {
  makePricedCasa80();
  const response = ask("Troque o piso ceramico por porcelanato 90 x 90, acrescente uma suite e mude a cobertura para laje impermeabilizada.");
  assert.ok(response.revision);
  assert.ok(packageOf(response).versions.length >= 2);
});

test("18. versao anterior permanece intacta", () => {
  makePricedCasa80();
  const response = ask("Troque o piso ceramico por porcelanato 90 x 90.");
  const versions = packageOf(response).versions;
  assert.equal(versions[0].version, 1);
  assert.equal(versions.at(-1).previousVersion, 1);
});

test("19. PDF mostra readiness", () => {
  const pdfData = elo.buildBudgetV2ProfessionalPdfDataForTest(casa80Doc);
  assert.match(pdfData.avisos_profissionais, /Readiness/i);
});

test("20. PDF mostra blockers ou pendencias", () => {
  const pdfData = elo.buildBudgetV2ProfessionalPdfDataForTest(casa80Doc);
  assert.match(pdfData.avisos_profissionais + pdfData.pendencias, /revis|pend/i);
});

test("21. PDF nao mostra preco final bloqueado", () => {
  const pdfData = elo.buildBudgetV2ProfessionalPdfDataForTest(casa80Doc);
  assert.doesNotMatch(pdfData.custos_encontrados, /salePrice:\s*[1-9]/i);
});

test("22. PDF mostra preco final quando liberado", () => {
  makePricedCasa80(); let current; for (let i = 0; i < 4; i += 1) current = ask("escolha 1");
  const pdfData = elo.buildBudgetV2ProfessionalPdfDataForTest(docOf(current));
  assert.match(pdfData.custos_encontrados, /salePrice/i);
  assert.ok(packageOf(current).financialSummary.salePrice > 0);
});

test("23. casa terrea auditada", () => {
  assert.equal(casa80.readiness.metrics.totalServices, 38);
  assert.equal(casa80.readiness.metrics.quantitiesWithMemory, 38);
});

test("24. sobrado auditado", () => {
  assert.ok(sobrado160.readiness.metrics.totalServices > 38);
  assert.ok(sobrado160.financialSummary.directCost > casa80.financialSummary.directCost);
});

test("25. fluxo com acentos e m²", () => {
  reset();
  ask("Quero o or\u00e7amento de uma casa t\u00e9rrea de 80 m\u00b2 em Vit\u00f3ria da Conquista/BA, padr\u00e3o m\u00e9dio, estrutura convencional, alvenaria cer\u00e2mica e cobertura em telha cer\u00e2mica.");
  ask("Use SINAPI da Bahia."); ask("Use a compet\u00eancia 2024-12 e n\u00e3o desonerado."); const response = ask("Use BDI de 25%.");
  assert.equal(response.sessionIntent, "budget_v2_residential_created");
  assert.ok(packageOf(response).readiness);
});
