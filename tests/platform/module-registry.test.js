import test from "node:test";
import assert from "node:assert/strict";
import { platformModules, evaluateModuleSaasReadiness } from "../../src/platform/module-registry.js";

test("module-registry carrega todos os modulos iniciais", () => {
  assert.equal(platformModules.length, 6);
  assert.deepEqual(platformModules.map((module) => module.id).sort(), [
    "cadista",
    "elo",
    "obrareport",
    "stock-full",
    "stock-obras",
    "stock-saude-jovem4"
  ]);
});

test("module-registry nao possui ids duplicados", () => {
  const ids = platformModules.map((module) => module.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Stock Saude marca dados sensiveis", () => {
  const stockSaude = platformModules.find((module) => module.id === "stock-saude-jovem4");
  assert.equal(stockSaude.requiresSensitiveData, true);
});

test("countryMode dos estoques principais esta correto", () => {
  const stockObras = platformModules.find((module) => module.id === "stock-obras");
  const stockFull = platformModules.find((module) => module.id === "stock-full");
  assert.equal(stockObras.countryMode, "BR");
  assert.equal(stockFull.countryMode, "GLOBAL_READY");
});

test("ELO integra todos os demais modulos", () => {
  const elo = platformModules.find((module) => module.id === "elo");
  const otherIds = platformModules.filter((module) => module.id !== "elo").map((module) => module.id).sort();
  assert.deepEqual([...elo.integrations].sort(), otherIds);
});

test("evaluateModuleSaasReadiness retorna score, nivel, blockers e nextActions", () => {
  const stockFull = platformModules.find((module) => module.id === "stock-full");
  const result = evaluateModuleSaasReadiness(stockFull);
  assert.equal(typeof result.score, "number");
  assert.match(result.level, /ready|pilot|foundation|blocked/);
  assert.ok(Array.isArray(result.blockers));
  assert.ok(Array.isArray(result.nextActions));
});
