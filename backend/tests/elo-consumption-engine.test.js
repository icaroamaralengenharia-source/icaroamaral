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
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-consumption-engine.js"), "utf8"), sandbox);
  return sandbox.window.EloConsumptionEngine;
}

test("ConsumptionEngine calcula coeficiente vezes quantidade", () => {
  const engine = loadEngine();
  const result = engine.calculateConsumptionFromCompositions([
    { packageId: "piso_revestimento", serviceId: "piso_ceramico", quantity: 50, unit: "m2" }
  ], [
    { packageId: "piso_revestimento", serviceId: "piso_ceramico", found: true, composition: { code: "SINAPI-PISO", description: "Piso", unit: "m2", inputs: [{ code: "ARG", name: "Argamassa colante", unit: "kg", coefficient: 4.2 }] } }
  ]);
  assert.equal(result.blocked.length, 0);
  assert.equal(result.consumptions[0].inputs[0].total, 210);
  assert.equal(result.consumptions[0].inputs[0].conversion.totalConverted, 10.5);
});

test("ConsumptionEngine bloqueia unidade incompativel", () => {
  const engine = loadEngine();
  const result = engine.calculateConsumptionFromCompositions([
    { packageId: "contrapiso", serviceId: "contrapiso_argamassa", quantity: 0.9, unit: "m3" }
  ], [
    { packageId: "contrapiso", serviceId: "contrapiso_argamassa", found: true, composition: { code: "SINAPI-CONTRA", description: "Contrapiso", unit: "m2", inputs: [{ name: "Cimento", unit: "kg", coefficient: 8 }] } }
  ]);
  assert.equal(result.consumptions.length, 0);
  assert.equal(result.blocked[0].reason, "unit_incompatible");
});
