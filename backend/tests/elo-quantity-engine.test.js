import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadEngines() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const file of ["elo-work-package-engine.js", "elo-quantity-engine.js"]) vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox);
  return sandbox.window;
}

test("QuantityEngine estima piso e cobertura de casa 80m2 e nao inventa alvenaria", () => {
  const win = loadEngines();
  const facts = { builtAreaM2: 80, floorMaterial: "piso ceramico", roofMaterial: "telha portuguesa", wallHeightM: 4, wallMaterial: "bloco ceramico baiano" };
  const packages = win.EloWorkPackageEngine.buildWorkPackages(facts, {});
  const result = win.EloQuantityEngine.estimateQuantities(facts, packages);
  const piso = result.quantities.find((item) => item.serviceId === "piso_ceramico");
  const cobertura = result.quantities.find((item) => item.serviceId === "cobertura_telha");
  assert.equal(piso.quantity, 80);
  assert.equal(piso.source, "estimated");
  assert.equal(cobertura.quantity, 80);
  assert.equal(cobertura.source, "estimated");
  assert.match(cobertura.warnings.join(" "), /inclinação|beiral|perdas/i);
  assert.equal(result.quantities.some((item) => item.serviceId === "alvenaria_bloco"), false);
  assert.ok(result.missing.some((item) => /perímetro|alvenaria/i.test(item.message)));
});

test("QuantityEngine calcula contrapiso 30m2 3cm como 0,9m3", () => {
  const win = loadEngines();
  const facts = { contrapisoAreaM2: 30, contrapisoThicknessCm: 3 };
  const packages = win.EloWorkPackageEngine.buildWorkPackages(facts, {});
  const result = win.EloQuantityEngine.estimateQuantities(facts, packages);
  const contrapiso = result.quantities.find((item) => item.serviceId === "contrapiso_argamassa");
  assert.equal(contrapiso.quantity, 0.9);
  assert.equal(contrapiso.unit, "m3");
  assert.equal(contrapiso.formula, "area × espessura");
});
