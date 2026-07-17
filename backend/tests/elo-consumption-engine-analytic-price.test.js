import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadConsumptionEngine() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-consumption-engine.js"), "utf8"), sandbox, { filename: "elo-consumption-engine.js" });
  return sandbox.window.EloConsumptionEngine;
}

test("consumption engine transporta preco analitico real do input sem recalcular", () => {
  const engine = loadConsumptionEngine();
  const result = engine.calculateConsumptionFromCompositions([
    { packageId: "pkg", serviceId: "svc", quantity: 10, unit: "m2" }
  ], [{
    packageId: "pkg",
    serviceId: "svc",
    found: true,
    composition: {
      code: "COMP-1",
      unit: "m2",
      inputs: [{
        code: "MAT-1",
        name: "Bloco ceramico",
        unit: "un",
        coefficient: 12.5,
        unitPrice: 1.92,
        precoUnitario: 1.92,
        totalCost: 24,
        custoTotal: 24
      }, {
        code: "LAB-1",
        name: "SERVENTE COM ENCARGOS COMPLEMENTARES",
        unit: "h",
        coefficient: 0.5,
        unitPrice: 21.2,
        totalCost: 10.6
      }, {
        code: "EQ-1",
        name: "VIBRADOR DE IMERSAO - CHP DIURNO",
        unit: "chp",
        coefficient: 0.1,
        unitPrice: 1.37,
        totalCost: 0.137
      }, {
        code: "MAT-SEM-PRECO",
        name: "Material sem preco",
        unit: "kg",
        coefficient: 2
      }]
    }
  }]);

  const inputs = result.consumptions[0].inputs;
  const block = inputs.find((item) => item.code === "MAT-1");
  assert.equal(block.total, 125);
  assert.equal(block.unitPrice, 1.92);
  assert.equal(block.precoUnitario, 1.92);
  assert.equal(block.totalCost, 24);
  assert.equal(block.custoTotal, 24);

  assert.equal(inputs.find((item) => item.code === "LAB-1").type, "labor");
  assert.equal(inputs.find((item) => item.code === "EQ-1").type, "equipment");
  assert.equal(inputs.find((item) => item.code === "MAT-SEM-PRECO").unitPrice, undefined);
});
