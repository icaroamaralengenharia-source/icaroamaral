import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadWindow(files) {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window;
}

function officialRowsFixture() {
  return [
    { source: "SINAPI", compositionCode: "SINAPI-PISO-001", compositionName: "Revestimento ceramico para piso com argamassa colante", compositionUnit: "m2", serviceType: "piso_ceramico", inputCode: "ARG", inputName: "Argamassa colante", inputUnit: "kg", coefficient: "4,2" }
  ];
}

test("StageGate retorna complete partial e blocked", () => {
  const win = loadWindow(["elo-stage-gate-engine.js"]);
  const engine = win.EloStageGateEngine;
  assert.equal(engine.evaluateStage({ id: "pintura", pendentes: [], bloqueadores: [] }).status, "complete");
  assert.equal(engine.evaluateStage({ id: "pintura", pendentes: ["massa"], bloqueadores: [] }).status, "partial");
  assert.equal(engine.evaluateStage({ id: "fundacao", pendentes: ["aco"], bloqueadores: ["aco"] }).status, "blocked");
});

test("orcamento executivo bloqueia se houver pendencia obrigatoria e estimativa preliminar continua permitida", () => {
  const win = loadWindow(["elo-stage-gate-engine.js"]);
  const result = win.EloStageGateEngine.evaluateBudgetGate({
    construction: { pendentes: ["tipo_fundacao"], bloqueadores: ["tipo_fundacao"] },
    rooms: { pendentes: ["ralo"], bloqueadores: ["ralo"] }
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.podeFecharOrcamentoCompleto, false);
  assert.equal(result.podeGerarEstimativaPreliminar, true);
});

test("BudgetEngine integra motor de obra em modo leitura e bloqueia completo sem impedir preliminar", () => {
  const win = loadWindow([
    "stock-ai-composition-engine.js",
    "composition-search-engine.js",
    "elo-construction-sequence-engine.js",
    "elo-room-requirements-engine.js",
    "elo-stage-gate-engine.js",
    "elo-work-package-engine.js",
    "elo-quantity-engine.js",
    "elo-consumption-engine.js",
    "elo-budget-table-engine.js",
    "elo-budget-engine.js"
  ]);
  win.StockAiCompositionEngine.importOfficialBase({ rows: officialRowsFixture() }, { state: "BA", referenceMonth: "2026-06" });
  const budget = win.EloBudgetEngine.buildPreliminaryBudget({
    originalMessage: "Casa terrea 80 m2 com cozinha e banheiro."
  }, {});
  assert.equal(budget.mode, "preliminary_budget");
  assert.equal(budget.constructionReadiness.podeGerarEstimativaPreliminar, true);
  assert.equal(budget.constructionReadiness.podeFecharOrcamentoCompleto, false);
  assert.ok(budget.constructionReadiness.pendentes.includes("tipo_fundacao"));
  assert.ok(budget.constructionReadiness.rooms.bloqueadores.includes("ralo"));
  assert.match(win.EloBudgetEngine.buildBudgetReportText(budget), /MOTOR DE OBRA/);
});

