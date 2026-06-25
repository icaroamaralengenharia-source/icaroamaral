import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function officialRowsFixture() {
  return [
    { source: "SINAPI", compositionCode: "SINAPI-ALV-001", compositionName: "Alvenaria de vedacao com bloco ceramico baiano", compositionUnit: "m2", serviceType: "alvenaria", inputCode: "BLOCO", inputName: "Bloco ceramico", inputUnit: "un", coefficient: "13,5" },
    { source: "SINAPI", compositionCode: "SINAPI-COB-001", compositionName: "Telhamento com telha ceramica portuguesa", compositionUnit: "m2", serviceType: "cobertura", inputCode: "TELHA", inputName: "Telha ceramica portuguesa", inputUnit: "un", coefficient: "16" },
    { source: "SINAPI", compositionCode: "SINAPI-PISO-001", compositionName: "Revestimento ceramico para piso com argamassa colante", compositionUnit: "m2", serviceType: "piso_ceramico", inputCode: "ARG", inputName: "Argamassa colante", inputUnit: "kg", coefficient: "4,2" },
    { source: "SINAPI", compositionCode: "SINAPI-CHAP-001", compositionName: "Chapisco aplicado em alvenaria", compositionUnit: "m2", serviceType: "chapisco", inputCode: "CIM", inputName: "Cimento portland", inputUnit: "kg", coefficient: "2,4" },
    { source: "SINAPI", compositionCode: "SINAPI-REBOCO-001", compositionName: "Emboco ou massa unica", compositionUnit: "m2", serviceType: "reboco", inputCode: "AREIA", inputName: "Areia media", inputUnit: "m3", coefficient: "0,025" },
    { source: "SINAPI", compositionCode: "SINAPI-CONTRA-001", compositionName: "Contrapiso em argamassa", compositionUnit: "m3", serviceType: "contrapiso", inputCode: "CIM2", inputName: "Cimento portland", inputUnit: "kg", coefficient: "8" }
  ];
}

function loadStack() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  const files = ["stock-ai-composition-engine.js", "composition-search-engine.js", "elo-technical-engine.js", "elo-work-package-engine.js", "elo-quantity-engine.js", "elo-consumption-engine.js", "elo-audit-engine.js", "elo-budget-table-engine.js", "elo-project-record-engine.js", "elo-project-store.js", "elo-executive-budget-engine.js", "elo-ui-data-engine.js", "elo-composition-selection-engine.js", "elo-export-engine.js", "elo-base-status-engine.js", "elo-traceability-engine.js", "elo-technical-knowledge-graph.js", "elo-budget-engine.js", "elo-brain-router.js"];
  for (const file of files) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
    if (file === "composition-search-engine.js") sandbox.window.StockAiCompositionEngine.importOfficialBase({ rows: officialRowsFixture() }, { state: "BA", referenceMonth: "2026-06" });
  }
  return sandbox.window;
}

test("orçamento casa térrea 80m2 cria orçamento preliminar estruturado sem briefing antigo", () => {
  const win = loadStack();
  const context = {};
  const routed = win.EloBrainRouter.routeEloBrain("orçamento casa térrea 80m²", context);
  const budget = routed.result.technicalEngine.budget;
  assert.equal(routed.brain, "technical");
  assert.equal(routed.result.technicalEngine.mode, "preliminary_budget");
  assert.equal(budget.projectFacts.builtAreaM2, 80);
  assert.equal(budget.workPackages.packages.length, 13);
  assert.ok(budget.budgetTable.rows.length >= 13);
  assert.doesNotMatch(routed.result.fullAnswer, /Dados mínimos que vou usar|BRIEFING DA OBRA|Próxima ação: Complete cliente/i);
});

test("casa térrea com bloco baiano telha portuguesa e piso 50m2 estrutura tabela e consumos", () => {
  const win = loadStack();
  const budget = win.EloBudgetEngine.buildPreliminaryBudget({ originalMessage: "casa térrea 80m², bloco baiano, telha portuguesa, piso cerâmico 50m²" }, {});
  assert.equal(budget.workPackages.packages.length, 13);
  assert.ok(budget.quantities.some((item) => item.serviceId === "piso_ceramico" && item.quantity === 50 && item.source === "informed"));
  assert.ok(budget.quantities.some((item) => item.serviceId === "cobertura_telha" && item.quantity === 80 && item.source === "estimated"));
  assert.equal(budget.quantities.some((item) => item.serviceId === "alvenaria_bloco"), false);
  assert.ok(budget.compositionMatches.some((item) => item.packageId === "alvenaria" && item.found));
  assert.ok(budget.compositionMatches.some((item) => item.packageId === "cobertura" && item.found));
  assert.ok(budget.compositionMatches.some((item) => item.packageId === "piso_revestimento" && item.found));
  assert.ok(budget.consumptions.some((item) => item.serviceId === "piso_ceramico"));
  assert.ok(budget.budgetTable.summary.totalRows >= 13);
  assert.ok(budget.projectRecord);
  assert.ok(budget.executiveReadiness);
  assert.equal(budget.executiveReadiness.ready, false);
  assert.ok(budget.dashboardData.cards.length);
  assert.ok(budget.knowledgeGraphHints.includes("Cobertura"));
  assert.ok(budget.projectRecordId);
  assert.ok(budget.baseStatus);
  assert.ok(budget.traceability.length);
  assert.match(budget.exportData.budgetCsv, /Pacote;Serviço/);
  assert.ok(budget.selectableCompositions.length);
  assert.equal(budget.closingChecklist.canClose, false);
  assert.ok(budget.budgetTable.summary.readyRows >= 1);
});

test("paredes com 4m registra altura sem transformar em área", () => {
  const win = loadStack();
  const budget = win.EloBudgetEngine.buildPreliminaryBudget({ originalMessage: "paredes com 4m de altura" }, {});
  assert.equal(budget.projectFacts.wallHeightM, 4);
  assert.equal(budget.projectFacts.builtAreaM2, undefined);
  assert.equal(budget.quantities.some((item) => item.quantity === 4 && item.unit === "m2"), false);
  assert.ok(budget.missing.some((item) => /perímetro|alvenaria|parede/i.test(item.message)));
});

test("quanto fica tudo não inventa total nem R$ quando faltam dados", () => {
  const win = loadStack();
  const context = {};
  win.EloBrainRouter.routeEloBrain("orçamento casa térrea 80m²", context);
  const routed = win.EloBrainRouter.routeEloBrain("quanto fica tudo?", context);
  assert.equal(routed.result.technicalEngine.mode, "preliminary_budget");
  assert.match(routed.result.fullAnswer, /ORÇAMENTO PRELIMINAR|Tabela preliminar|Pendências/i);
  assert.doesNotMatch(routed.result.fullAnswer, /R\$\s*\d/i);
});

test("gerar resumo do orçamento retorna relatório textual estruturado", () => {
  const win = loadStack();
  const context = {};
  win.EloBrainRouter.routeEloBrain("orçamento casa térrea 80m²", context);
  win.EloBrainRouter.routeEloBrain("bloco baiano", context);
  win.EloBrainRouter.routeEloBrain("telha portuguesa", context);
  const routed = win.EloBrainRouter.routeEloBrain("gerar resumo do orçamento", context);
  assert.equal(routed.result.technicalEngine.mode, "preliminary_budget");
  assert.match(routed.result.fullAnswer, /Pacotes de serviço|PRONTUÁRIO DA OBRA|PRONTIDÃO PARA EXECUTIVO|PAINEL/i);
});



