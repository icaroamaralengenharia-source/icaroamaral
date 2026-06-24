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
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-work-package-engine.js"), "utf8"), sandbox);
  return sandbox.window.EloWorkPackageEngine;
}

test("WorkPackageEngine gera 13 pacotes para casa terrea", () => {
  const engine = loadEngine();
  const result = engine.buildWorkPackages({ originalMessage: "casa térrea 80m²" }, {});
  assert.equal(result.typology, "casa_terrea");
  assert.equal(result.packages.length, 13);
  assert.ok(result.packages.some((item) => item.id === "alvenaria"));
  assert.ok(result.packages.some((item) => item.id === "piso_revestimento"));
});
