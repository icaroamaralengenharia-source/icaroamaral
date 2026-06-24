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
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-audit-engine.js"), "utf8"), sandbox);
  return sandbox.window.EloAuditEngine;
}

test("AuditEngine classifica 14 sacos previstos e 20 retirados como critical", () => {
  const engine = loadEngine();
  const result = engine.auditConsumption({
    plannedConsumption: [{ inputs: [{ name: "argamassa", total: 280, unit: "kg", conversion: { available: true, totalConverted: 14, unit: "sacos" } }] }],
    withdrawals: [{ item: "argamassa", quantity: 20, unit: "sacos" }]
  });
  assert.equal(result.status, "critical");
  assert.equal(result.comparisons[0].status, "critical");
  assert.equal(result.comparisons[0].differencePercent, 42.857);
});
