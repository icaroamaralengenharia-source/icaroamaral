import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadProductionBase() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  [
    "stock-ai-composition-engine.js",
    "bases-reais/sinapi-ba-202412-index.js",
    "composition-search-engine.js"
  ].forEach((file) => {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  });
  return sandbox.window;
}

test("base publica SINAPI do Elo carrega catalogo real completo em producao", () => {
  const window = loadProductionBase();
  const publicIndex = window.EloPublicSinapiIndex;
  const imported = window.StockAiCompositionEngine.getImportedOfficialBaseStats();
  const stats = window.CompositionSearchEngine.getIndexStats();

  assert.equal(publicIndex.loaded, true);
  assert.equal(publicIndex.source, "SINAPI");
  assert.equal(publicIndex.state, "BA");
  assert.equal(publicIndex.referenceMonth, "2024-12");
  assert.equal(imported.totalCompositions, 7829);
  assert.equal(imported.totalInputs, 40538);
  assert.equal(stats.totalCompositions, 7829);
  assert.equal(stats.totalInputs, 40538);
  assert.ok(stats.uniqueInputs > 1000);
  assert.equal(stats.baseLocations.length, 1);
  assert.equal(stats.baseLocations[0], "StockAiCompositionEngine.importedOfficialBaseCatalog");
});

test("base publica SINAPI permite busca oficial de alvenaria no Elo", () => {
  const window = loadProductionBase();
  const result = window.CompositionSearchEngine.searchOfficialCompositions("parede bloco ceramico baiano", { unit: "m2", limit: 3 });

  assert.equal(result.found, true);
  assert.equal(result.indexedCount, 7829);
  assert.ok(result.candidates.length > 0);
  assert.match(result.candidates[0].description, /ALVENARIA|BLOCO|CER/i);
  assert.ok(result.candidates[0].reasons.length > 0);
});
