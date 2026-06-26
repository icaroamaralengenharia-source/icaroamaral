import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadEloProductionStack() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  [
    "stock-ai-composition-engine.js",
    "bases-reais/sinapi-ba-202412-index.js",
    "composition-search-engine.js",
    "elo-technical-engine.js"
  ].forEach((file) => {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  });
  return sandbox.window.EloTechnicalEngine;
}

test("Elo calcula area de parede a partir de comprimento e altura", () => {
  const engine = loadEloProductionStack();
  const result = engine.analyze("quero saber o material necessario pra fazer uma parede que mede 30metros da comprimento e 2,80 metros de altura");

  assert.equal(result.service.id, "alvenaria");
  assert.equal(result.quantity.value, 84);
  assert.equal(result.quantity.unit, "m2");
  assert.equal(result.quantity.source, "wall_dimensions");
  assert.equal(result.facts.comprimentoParedeM, 30);
  assert.equal(result.facts.alturaParedeM, 2.8);
  assert.equal(result.facts.areaParedeM2, 84);
  assert.equal(result.compositionSearch.indexedCount, 7829);
  assert.equal(result.compositionSearch.found, true);
  assert.match(result.answer, /AREA CALCULADA/);
  assert.match(result.answer, /30,00 x 2,80 = 84,00 m2/);
  assert.doesNotMatch(result.answer, /Qual a area de alvenaria/i);
});

test("Elo pergunta dimensao do bloco baiano depois de receber area da parede", () => {
  const engine = loadEloProductionStack();
  const result = engine.analyze("40m2 de parede, tipo baiano");

  assert.equal(result.service.id, "alvenaria");
  assert.equal(result.quantity.value, 40);
  assert.deepEqual(Array.from(result.missing), ["dimensao_bloco"]);
  assert.equal(result.compositionSearch.indexedCount, 7829);
  assert.equal(result.compositionSearch.found, true);
  assert.match(result.answer, /Qual a dimensao do bloco baiano\? Exemplos: 9x19x29 ou 14x19x29\./);
  assert.doesNotMatch(result.answer, /Qual a espessura da parede\/bloco/i);
});
test("Elo mantem orcamento de parede na base oficial", () => {
  const engine = loadEloProductionStack();
  const result = engine.analyze("orçar parede de bloco cerâmico");

  assert.equal(result.mode, "technical_consumption");
  assert.equal(result.service.id, "alvenaria");
  assert.deepEqual(Array.from(result.missing), ["area", "dimensao_bloco"]);
  assert.equal(result.compositionSearch.indexedCount, 7829);
  assert.equal(result.compositionSearch.found, true);
  assert.match(result.answer, /BUSCA NA BASE OFICIAL/);
  assert.doesNotMatch(result.answer, /Estou pronto/);
});
