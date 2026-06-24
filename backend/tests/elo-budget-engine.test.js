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
    { source: "SINAPI", compositionCode: "SINAPI-CONTRA-001", compositionName: "Contrapiso em argamassa", compositionUnit: "m2", serviceType: "contrapiso", inputCode: "CIM2", inputName: "Cimento portland", inputUnit: "kg", coefficient: "8" }
  ];
}

function loadStack() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const file of ["stock-ai-composition-engine.js", "composition-search-engine.js", "elo-technical-engine.js", "elo-budget-engine.js", "elo-brain-router.js"]) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
    if (file === "composition-search-engine.js") sandbox.window.StockAiCompositionEngine.importOfficialBase({ rows: officialRowsFixture() }, { state: "BA", referenceMonth: "2026-06" });
  }
  return sandbox.window;
}

test("orçamento casa térrea 80m2 cria orçamento preliminar sem briefing antigo", () => {
  const win = loadStack();
  const context = {};
  const routed = win.EloBrainRouter.routeEloBrain("orçamento casa térrea 80m²", context);
  assert.equal(routed.brain, "technical");
  assert.equal(routed.result.technicalEngine.mode, "preliminary_budget");
  assert.equal(routed.result.technicalEngine.budget.projectFacts.builtAreaM2, 80);
  assert.ok(routed.result.technicalEngine.budget.scope.some((item) => item.id === "fundacao"));
  assert.doesNotMatch(routed.result.fullAnswer, /cliente|cidade\/UF|nome da obra|briefing da obra/i);
});

test("casa térrea com bloco baiano e telha portuguesa busca alvenaria e cobertura", () => {
  const win = loadStack();
  const budget = win.EloBudgetEngine.buildPreliminaryBudget({ originalMessage: "casa térrea 80m², bloco baiano, telha portuguesa" }, {});
  assert.ok(budget.scope.some((item) => item.id === "alvenaria"));
  assert.ok(budget.scope.some((item) => item.id === "cobertura"));
  const alvenaria = budget.compositions.find((item) => item.scopeId === "alvenaria");
  const cobertura = budget.compositions.find((item) => item.scopeId === "cobertura");
  assert.equal(alvenaria.found, true);
  assert.equal(cobertura.found, true);
});

test("piso ceramico 50m2 gera quantitativo e busca composição", () => {
  const win = loadStack();
  const budget = win.EloBudgetEngine.buildPreliminaryBudget({ originalMessage: "piso cerâmico 50m²", floorMaterial: "piso ceramico", floorAreaM2: 50 }, {});
  assert.equal(budget.quantities.find((item) => item.id === "piso").quantity, 50);
  assert.equal(budget.compositions.find((item) => item.scopeId === "piso").found, true);
});

test("paredes com 4m registra altura sem transformar em área", () => {
  const win = loadStack();
  const budget = win.EloBudgetEngine.buildPreliminaryBudget({ originalMessage: "paredes com 4m de altura" }, {});
  assert.equal(budget.projectFacts.wallHeightM, 4);
  assert.equal(budget.projectFacts.builtAreaM2, undefined);
  assert.ok(budget.missing.some((item) => /perímetro|alvenaria|paredes/i.test(item.message)));
});

test("quanto fica tudo não inventa total quando faltam dados", () => {
  const win = loadStack();
  const context = {};
  win.EloBrainRouter.routeEloBrain("orçamento casa térrea 80m²", context);
  const routed = win.EloBrainRouter.routeEloBrain("quanto fica tudo?", context);
  assert.equal(routed.result.technicalEngine.mode, "preliminary_budget");
  assert.match(routed.result.fullAnswer, /Pendências|pendências|não substitui|orçamento preliminar/i);
  assert.doesNotMatch(routed.result.fullAnswer, /R\$\s*\d/i);
});

test("gerar resumo do orçamento retorna relatório textual", () => {
  const win = loadStack();
  const context = {};
  win.EloBrainRouter.routeEloBrain("orçamento casa térrea 80m²", context);
  win.EloBrainRouter.routeEloBrain("bloco baiano", context);
  win.EloBrainRouter.routeEloBrain("telha portuguesa", context);
  const routed = win.EloBrainRouter.routeEloBrain("gerar resumo do orçamento", context);
  assert.equal(routed.result.technicalEngine.mode, "preliminary_budget");
  assert.match(routed.result.fullAnswer, /Escopo técnico inicial|Composições SINAPI|Pendências/i);
});

