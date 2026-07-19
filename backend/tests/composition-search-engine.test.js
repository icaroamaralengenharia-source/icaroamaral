import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function officialRowsFixture() {
  return [{
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-COB-001",
    compositionName: "Cobertura com telha ceramica portuguesa sobre estrutura de madeira",
    compositionUnit: "m2",
    serviceType: "cobertura",
    inputCode: "SINAPI-TELHA-PORT",
    inputName: "Telha ceramica portuguesa",
    inputUnit: "un",
    coefficient: "16"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-PISO-001",
    compositionName: "Revestimento ceramico para piso com argamassa colante",
    compositionUnit: "m2",
    serviceType: "piso_ceramico",
    inputCode: "SINAPI-ARG-AC1",
    inputName: "Argamassa colante industrializada AC I",
    inputUnit: "kg",
    coefficient: "4,2"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-PORC-001",
    compositionName: "Revestimento porcelanato para piso com argamassa colante",
    compositionUnit: "m2",
    serviceType: "piso_ceramico",
    inputCode: "SINAPI-ARG-AC3",
    inputName: "Argamassa colante AC III para porcelanato",
    inputUnit: "kg",
    coefficient: "5,1"
  }, {
    source: "ORSE",
    state: "SE",
    referenceMonth: "2026-01",
    compositionCode: "ORSE-CHAP-001",
    compositionName: "Chapisco aplicado em alvenaria com argamassa de cimento e areia",
    compositionUnit: "m2",
    serviceType: "chapisco",
    inputCode: "ORSE-CIM-001",
    inputName: "Cimento portland",
    inputUnit: "kg",
    coefficient: "2,4"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-REBOCO-001",
    compositionName: "Emboco ou massa unica em argamassa para parede interna",
    compositionUnit: "m2",
    serviceType: "reboco",
    inputCode: "SINAPI-AREIA-001",
    inputName: "Areia media",
    inputUnit: "m3",
    coefficient: "0,025"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-ALV-001",
    compositionName: "Alvenaria de vedacao com bloco ceramico",
    compositionUnit: "m2",
    serviceType: "alvenaria",
    inputCode: "SINAPI-BLOCO-001",
    inputName: "Bloco ceramico de vedacao",
    inputUnit: "un",
    coefficient: "13,5"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-CONTRA-001",
    compositionName: "Regularizacao de piso cimentado tipo contrapiso",
    compositionUnit: "m2",
    serviceType: "contrapiso",
    inputCode: "SINAPI-ARG-CONTRA",
    inputName: "Argamassa para contrapiso",
    inputUnit: "m3",
    coefficient: "0,035"
  }];
}

function loadSearchEngine() {
  const stockSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "stock-ai-composition-engine.js"), "utf8");
  const searchSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "composition-search-engine.js"), "utf8");
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(stockSource, sandbox, { filename: "stock-ai-composition-engine.js" });
  vm.runInContext(searchSource, sandbox, { filename: "composition-search-engine.js" });
  const imported = sandbox.window.StockAiCompositionEngine.importOfficialBase({ rows: officialRowsFixture() });
  assert.equal(imported.ok, true);
  return sandbox.window.CompositionSearchEngine;
}

test("CompositionSearchEngine normaliza acentos, plural simples e sinonimos", () => {
  const search = loadSearchEngine();

  assert.equal(search.normalize("Telhas cerâmicas"), "telhas ceramicas");
  assert.deepEqual(Array.from(search.tokenize("Telhas cerâmicas")), ["telha", "ceramica"]);
  assert.match(search.expandQuery("telhado portugues").normalizedQuery, /cobertura/);
});

test("CompositionSearchEngine busca telha portuguesa na base oficial", () => {
  const search = loadSearchEngine();
  const result = search.searchOfficialCompositions("quero um telhado ceramico com telha portuguesa", { unit: "m2" });

  assert.equal(result.found, true);
  assert.equal(result.indexedCount, 7);
  assert.equal(result.indexedInputCount, 7);
  assert.equal(result.indexedUniqueInputCount, 7);
  assert.equal(typeof result.indexDurationMs, "number");
  assert.equal(result.candidates[0].code, "SINAPI-COB-001");
  assert.match(result.candidates[0].reasons.join(" "), /sinonimo|telha|cobertura/);
});

test("CompositionSearchEngine busca piso ceramico e retorna reasons", () => {
  const search = loadSearchEngine();
  const result = search.searchOfficialCompositions("vou assentar 50m2 de piso ceramico no chao", { unit: "m2" });

  assert.equal(result.found, true);
  assert.equal(result.candidates[0].code, "SINAPI-PISO-001");
  assert.ok(result.candidates[0].reasons.length > 0);
});

test("CompositionSearchEngine busca bloco ceramico baiano como alvenaria", () => {
  const search = loadSearchEngine();
  const result = search.searchOfficialCompositions("parede de 10m2 de bloco ceramico baiano", { unit: "m2" });

  assert.equal(result.found, true);
  assert.equal(result.candidates[0].code, "SINAPI-ALV-001");
});

test("controlled finishStandard registry starts empty and keeps ranking", () => {
  const source = readFileSync(join(repoDir, "relatorio-qualidade-obras", "composition-search-engine.js"), "utf8");
  assert.match(source, /const FINISH_STANDARD_BY_COMPOSITION_CODE = Object\.freeze\(\{\}\);/);
  assert.equal((source.match(/FINISH_STANDARD_BY_COMPOSITION_CODE/g) || []).length, 2);
  assert.equal(/PRMA_OFFICIAL_KIT_POLICIES|officialCandidates|pending_selection/.test(source), false);
  const search = loadSearchEngine();
  const composition = (code, description, extra = {}) => Object.assign({ code, description, unit: "un", source: "SINAPI", isOfficial: true, inputs: [{ code: "MAT-" + code, name: "insumo", unit: "un", coefficient: 1 }] }, extra);
  const find = (items) => search.searchOfficialCompositions("vaso sanitario", { unit: "un", compositions: items });
  assert.equal(find([composition("910", "vaso sanitario")]).candidates[0].finishStandard, undefined);
  assert.equal(find([composition("911", "vaso sanitario", { finishStandard: "PREMIUM" })]).candidates[0].finishStandard, "premium");
  assert.equal(find([composition("86931", "vaso sanitario")]).candidates[0].finishStandard, undefined);
  assert.equal(find([composition("86931-X", "vaso sanitario")]).candidates[0].finishStandard, undefined);
  assert.equal(find([composition("912", "vaso sanitario economico barato")]).candidates[0].finishStandard, undefined);
  assert.equal(find([composition("913", "vaso sanitario", { price: 1, unitPrice: 1 })]).candidates[0].finishStandard, undefined);
  const plain = find([composition("101", "vaso sanitario alfa", { price: 20 }), composition("102", "vaso sanitario beta", { price: 10 })]);
  const tagged = find([composition("101", "vaso sanitario alfa", { finishStandard: "economic", price: 20 }), composition("102", "vaso sanitario beta", { price: 10 })]);
  const summary = (result) => result.candidates.map(({ code, score, price }) => ({ code, score, price }));
  assert.deepEqual(summary(tagged), summary(plain));
  const prma = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-budget-eap-engine.js"), "utf8");
  assert.match(prma, /compositionStatus: "pending_selection"/);
  assert.match(prma, /selectedOfficialCode/);
});

test("CompositionSearchEngine retorna not found estruturado", () => {
  const search = loadSearchEngine();
  const result = search.searchOfficialCompositions("xyzqwerty", { unit: "m2" });

  assert.equal(result.found, false);
  assert.equal(result.reason, "no_official_composition_found");
  assert.ok(Array.isArray(result.searchedTerms));
});

