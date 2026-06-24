import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadEngine() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-budget-table-engine.js"), "utf8"), sandbox);
  return sandbox.window.EloBudgetTableEngine;
}

test("BudgetTableEngine gera linhas ready pending blocked", () => {
  const engine = loadEngine();
  const table = engine.buildBudgetTable({
    workPackages: { packages: [
      { id: "piso_revestimento", name: "Piso", missing: [], services: [{ id: "piso_ceramico", description: "Piso cerâmico", unit: "m2" }] },
      { id: "fundacao", name: "Fundação", missing: ["tipo_fundacao"], services: [{ id: "fundacao", description: "Fundação", unit: "m3" }] }
    ] },
    quantities: [{ packageId: "piso_revestimento", serviceId: "piso_ceramico", quantity: 50, unit: "m2", source: "informed" }],
    compositionMatches: [{ packageId: "piso_revestimento", serviceId: "piso_ceramico", composition: { code: "SINAPI-PISO", source: "SINAPI" } }],
    consumptions: [{ packageId: "piso_revestimento", serviceId: "piso_ceramico" }]
  });
  assert.equal(table.rows.length, 2);
  assert.equal(table.summary.readyRows, 1);
  assert.equal(table.summary.pendingRows, 1);
});
