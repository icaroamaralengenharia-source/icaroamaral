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

test("controlled SINAPI finishStandard registry uses exact code metadata and keeps ranking", () => {
  const source = readFileSync(join(repoDir, "relatorio-qualidade-obras", "composition-search-engine.js"), "utf8");
  const registryStart = source.indexOf("const FINISH_STANDARD_BY_COMPOSITION_CODE");
  const registryEnd = source.indexOf("  const SYNONYMS", registryStart);
  const registry = source.slice(registryStart, registryEnd);
  assert.notEqual(registryStart, -1);
  assert.notEqual(registryEnd, -1);
  assert.equal((registry.match(/"\d+": Object\.freeze\(\{/g) || []).length, 4);
  assert.match(registry, /"86904"[\s\S]*finishStandard: "economic"[\s\S]*source: "SINAPI BA 2024-12"[\s\S]*evidence: "PADRÃO POPULAR"/);
  assert.match(registry, /"86906"[\s\S]*finishStandard: "economic"[\s\S]*source: "SINAPI BA 2024-12"[\s\S]*evidence: "PADRÃO POPULAR"/);
  assert.match(registry, /"86915"[\s\S]*finishStandard: "standard"[\s\S]*source: "SINAPI BA 2024-12"[\s\S]*evidence: "PADRÃO MÉDIO"/);
  assert.match(registry, /"100878"[\s\S]*finishStandard: "premium"[\s\S]*source: "SINAPI BA 2024-12"[\s\S]*evidence: "PADRÃO ALTO"/);
  assert.equal(/PRMA_OFFICIAL_KIT_POLICIES|officialCandidates|pending_selection/.test(source), false);
  assert.equal(/descriptionOf\(composition\).*finishStandard|PADRÃO POPULAR.*candidate|unitPrice.*finishStandard|price.*finishStandard/.test(source), false);

  const search = loadSearchEngine();
  const composition = (code, description, extra = {}) => Object.assign({ code, description, unit: "un", source: "SINAPI", isOfficial: true, inputs: [{ code: "MAT-" + code, name: "insumo", unit: "un", coefficient: 1 }] }, extra);
  const find = (query, items) => search.searchOfficialCompositions(query, { unit: "un", compositions: items });
  const byCode = (code, description, extra) => find(code, [composition(code, description, extra)]).candidates[0];

  assert.equal(byCode("86904", "lavatorio louca branca suspenso").finishStandard, "economic");
  assert.equal(byCode("86906", "torneira cromada de mesa para lavatorio").finishStandard, "economic");
  assert.equal(byCode("86915", "torneira cromada de mesa para lavatorio").finishStandard, "standard");
  assert.equal(byCode("100878", "vaso sanitario sifonado com caixa acoplada").finishStandard, "premium");
  assert.equal(byCode("910", "vaso sanitario").finishStandard, undefined);
  assert.equal(byCode("869040", "lavatorio louca branca suspenso").finishStandard, undefined);
  assert.equal(byCode("8690", "lavatorio louca branca suspenso").finishStandard, undefined);
  assert.equal(byCode("1008780", "vaso sanitario sifonado com caixa acoplada").finishStandard, undefined);
  assert.equal(byCode("912", "vaso sanitario PADRÃO POPULAR").finishStandard, undefined);
  assert.equal(byCode("913", "vaso sanitario", { price: 1, unitPrice: 1 }).finishStandard, undefined);
  assert.equal(byCode("86904", "lavatorio louca branca suspenso", { finishStandard: "premium" }).finishStandard, "premium");
  assert.equal(byCode("86904", "lavatorio louca branca suspenso", { metadata: { finishStandard: "standard" }, inputs: [{ code: "MAT-86904-A", name: "insumo", unit: "un", coefficient: 1 }, { code: "MAT-86904-B", name: "insumo", unit: "un", coefficient: 1 }] }).finishStandard, "standard");

  const plain = find("vaso sanitario", [composition("101", "vaso sanitario alfa", { price: 20 }), composition("102", "vaso sanitario beta", { price: 10 })]);
  const tagged = find("vaso sanitario", [composition("101", "vaso sanitario alfa", { finishStandard: "economic", price: 20 }), composition("102", "vaso sanitario beta", { price: 10 })]);
  const summary = (result) => result.candidates.map(({ code, score, price, warnings }) => ({ code, score, price, warnings }));
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

