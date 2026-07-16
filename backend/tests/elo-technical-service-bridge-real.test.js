import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function stockAiOfficialRowsFixture() {
  const source = readFileSync(join(testDir, "stock-ai-real-compositions.test.js"), "utf8");
  const start = source.indexOf("function officialBaseRowsFixture()");
  const end = source.indexOf("function officialGeometryRowsFixture()");
  assert.ok(start >= 0 && end > start, "fixture oficial do Stock AI nao localizada");
  const sandbox = { result: null };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(start, end) + "\nresult = officialBaseRowsFixture();", sandbox, { filename: "stock-ai-real-compositions.fixture.js" });
  return sandbox.result;
}

function loadRealBridge(options = {}) {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const file of [
    "stock-ai-composition-engine.js",
    "composition-search-engine.js",
    "elo-consumption-engine.js",
    "elo-technical-service-bridge.js"
  ]) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  if (options.importBase !== false) {
    const imported = sandbox.window.StockAiCompositionEngine.importOfficialBase({ rows: stockAiOfficialRowsFixture() });
    assert.equal(imported.ok, true);
  }
  return sandbox.window;
}

test("ponte usa Stock Obras + CompositionSearchEngine real para alvenaria de bloco ceramico", () => {
  const win = loadRealBridge();
  const result = win.EloTechnicalServiceBridge.build({
    text: "Quero fazer uma parede com bloco ceramico baiano, 30 metros de comprimento e 2,80 metros de altura. Qual material necessario?"
  });

  assert.equal(result.quantity, 84);
  assert.equal(result.unit, "m2");
  assert.equal(result.composition.source, "SINAPI");
  assert.match(result.composition.description, /Alvenaria de bloco ceramico oficial controlada/i);
  assert.equal(result.pricingStatus, "unpriced");
  assert.equal(result.unitCost, null);
  assert.equal(result.totalCost, null);

  const materials = result.materials.map((item) => ({
    code: item.code,
    name: item.name,
    unit: item.unit,
    coefficient: item.coefficient,
    quantity: item.quantity
  }));

  assert.equal(JSON.stringify(materials), JSON.stringify([{
    code: "SINAPI-MAT-001",
    name: "Bloco ceramico oficial",
    unit: "un",
    coefficient: 12.5,
    quantity: 1050
  }, {
    code: "SINAPI-MAT-002",
    name: "Argamassa oficial",
    unit: "kg",
    coefficient: 3.25,
    quantity: 273
  }]));
});

test("ponte bloqueia claramente quando nenhuma base real esta carregada", () => {
  const win = loadRealBridge({ importBase: false });
  const result = win.EloTechnicalServiceBridge.build({
    text: "Quero fazer uma parede com bloco ceramico baiano, 30 metros de comprimento e 2,80 metros de altura. Qual material necessario?"
  });

  assert.equal(result.quantity, 84);
  assert.equal(result.pricingStatus, "blocked_composition_not_found");
  assert.equal(JSON.stringify(result.warnings), JSON.stringify(["composition_not_found"]));
  assert.equal(result.composition, null);
  assert.equal(result.materials.length, 0);
});
