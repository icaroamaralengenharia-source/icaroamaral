import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const sampleFixture = JSON.parse(readFileSync(join(testDir, "fixtures", "stock-ai-real-compositions-sample.json"), "utf8"));
const realTemplate = JSON.parse(readFileSync(join(testDir, "..", "..", "relatorio-qualidade-obras", "bases-reais", "sinapi-orse-real-sample.template.json"), "utf8"));
const firstRealExamplePath = join(testDir, "..", "..", "relatorio-qualidade-obras", "bases-reais", "primeira-composicao-real.example.json");
const firstRealExample = JSON.parse(readFileSync(firstRealExamplePath, "utf8"));
const firstOfficialGuidePath = join(testDir, "..", "..", "docs", "stock-ai-guia-primeira-composicao-oficial.md");
const officialBaseImporterGuidePath = join(testDir, "..", "..", "docs", "stock-ai-importador-bases-oficiais.md");

function loadStockAiCompositionEngine(windowOverrides = {}) {
  const source = readFileSync(join(testDir, "..", "..", "relatorio-qualidade-obras", "stock-ai-composition-engine.js"), "utf8");
  const sandbox = {
    window: Object.assign({}, windowOverrides),
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.StockAiCompositionEngine;
}

function sinapiAlvenariaFixture(unit = "m2") {
  return [{
    source: "SINAPI",
    sourceRegion: "BA",
    sourceDate: "2025-01",
    code: "TESTE-001",
    description: "Alvenaria de bloco ceramico fixture de teste",
    serviceType: "alvenaria",
    unit,
    lossPercent: 0,
    inputs: [{
      code: "MAT-001",
      name: "Bloco teste",
      type: "material",
      unit: "un",
      coefficient: 1.5
    }],
    metadata: {
      importedFrom: "fixture de teste",
      isRealComposition: true
    }
  }];
}

function officialManualEntryTestOnly() {
  return {
    schemaVersion: "1.0",
    source: "SINAPI",
    sourceType: "official_manual_entry",
    referenceMonth: "2025-01",
    state: "BA",
    createdBy: "manual",
    items: [{
      source: "SINAPI",
      sourceType: "official_manual_entry",
      code: "TEST-ONLY-SINAPI-001",
      name: "TEST ONLY - composicao estrutural valida para teste automatizado",
      serviceType: "alvenaria",
      unit: "m2",
      reference: "TEST ONLY - nao usar como base real",
      isOfficial: true,
      inputs: [{
        code: "TEST-ONLY-MAT-001",
        name: "TEST ONLY - insumo de teste",
        unit: "un",
        coefficient: 1.5
      }],
      metadata: {
        importedFrom: "TEST ONLY - nao usar como base real",
        manualReviewRequired: true
      }
    }]
  };
}

function officialBaseRowsFixture() {
  return [{
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-ALV-001",
    compositionName: "Alvenaria de bloco ceramico oficial controlada",
    compositionUnit: "m2",
    serviceType: "alvenaria",
    inputCode: "SINAPI-MAT-001",
    inputName: "Bloco ceramico oficial",
    inputUnit: "un",
    coefficient: "12,50"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-ALV-001",
    compositionName: "Alvenaria de bloco ceramico oficial controlada",
    compositionUnit: "m2",
    serviceType: "alvenaria",
    inputCode: "SINAPI-MAT-002",
    inputName: "Argamassa oficial",
    inputUnit: "kg",
    coefficient: "3.25"
  }];
}

test("Stock AI Obras mantem composicao demonstrativa sem base externa", () => {
  const engine = loadStockAiCompositionEngine();
  const composition = engine.findComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });
  const prediction = engine.calculatePredictedConsumption({
    service: "Alvenaria de bloco ceramico",
    quantity: 36,
    unit: "m2"
  });

  assert.ok(composition);
  assert.notEqual(composition.source, "SINAPI");
  assert.equal(prediction.predictedItems.length > 0, true);
});

test("Stock AI Obras prioriza composicao SINAPI compativel sobre demonstrativa", () => {
  const engine = loadStockAiCompositionEngine();

  engine.loadExternalCompositions(sinapiAlvenariaFixture(), "SINAPI");
  const composition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });

  assert.ok(composition);
  assert.equal(composition.source, "SINAPI");
  assert.equal(composition.code, "TESTE-001");
});

test("Stock AI Obras ignora composicao real com unidade incompativel", () => {
  const engine = loadStockAiCompositionEngine();

  engine.loadExternalCompositions(sinapiAlvenariaFixture("m3"), "SINAPI");
  const composition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });

  assert.ok(composition);
  assert.notEqual(composition.source, "SINAPI");
  assert.equal(composition.productionUnit, "m2");
});

test("Stock AI Obras rejeita coeficiente invalido em base importada", () => {
  const engine = loadStockAiCompositionEngine();
  const invalidRows = sinapiAlvenariaFixture();
  invalidRows[0].inputs[0].coefficient = 0;

  const imported = engine.loadExternalCompositions(invalidRows, "SINAPI");

  assert.equal(imported.length, 0);
});

test("Stock AI Obras importa JSON valido com resumo e fontes", () => {
  const engine = loadStockAiCompositionEngine();

  const result = engine.loadRealCompositionsFromJson(sinapiAlvenariaFixture());

  assert.equal(result.ok, true);
  assert.equal(result.imported.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.summary.total, 1);
  assert.equal(result.summary.valid, 1);
  assert.equal(result.summary.invalid, 0);
  assert.equal(result.summary.sources.SINAPI, 1);
});

test("Stock AI Obras rejeita composicao sem inputs", () => {
  const engine = loadStockAiCompositionEngine();
  const rows = sinapiAlvenariaFixture();
  rows[0].inputs = [];

  const result = engine.loadRealCompositionsFromJson(rows);

  assert.equal(result.ok, false);
  assert.equal(result.imported.length, 0);
  assert.match(result.rejected[0].reasons.join(" "), /sem inputs/i);
});

test("Stock AI Obras rejeita input sem coefficient", () => {
  const engine = loadStockAiCompositionEngine();
  const rows = sinapiAlvenariaFixture();
  delete rows[0].inputs[0].coefficient;

  const result = engine.loadRealCompositionsFromJson(rows);

  assert.equal(result.ok, false);
  assert.match(result.rejected[0].reasons.join(" "), /coefficient/i);
});

test("Stock AI Obras rejeita coefficient zero ou negativo", () => {
  const engine = loadStockAiCompositionEngine();
  const zeroRows = sinapiAlvenariaFixture();
  const negativeRows = sinapiAlvenariaFixture();
  zeroRows[0].inputs[0].coefficient = 0;
  negativeRows[0].inputs[0].coefficient = -1;

  const zero = engine.loadRealCompositionsFromJson(zeroRows);
  const negative = engine.loadRealCompositionsFromJson(negativeRows);

  assert.equal(zero.imported.length, 0);
  assert.equal(negative.imported.length, 0);
  assert.match(zero.rejected[0].reasons.join(" "), /maior que zero/i);
  assert.match(negative.rejected[0].reasons.join(" "), /maior que zero/i);
});

test("Stock AI Obras normaliza unidades m2, m3 e metro", () => {
  const engine = loadStockAiCompositionEngine();

  assert.equal(engine.normalizeCompositionUnit("m²"), "m2");
  assert.equal(engine.normalizeCompositionUnit("m2"), "m2");
  assert.equal(engine.normalizeCompositionUnit("m³"), "m3");
  assert.equal(engine.normalizeCompositionUnit("m3"), "m3");
  assert.equal(engine.normalizeCompositionUnit("metro"), "m");
});

test("Stock AI Obras registra catalogo externo controlado", () => {
  const engine = loadStockAiCompositionEngine();

  const result = engine.setExternalCompositionCatalog(sinapiAlvenariaFixture());

  assert.equal(result.imported.length, 1);
  assert.equal(engine.getExternalCompositionCatalog().length, 1);
  assert.equal(engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" }).source, "SINAPI");
});

test("Stock AI Obras importa CSV parseado por source", () => {
  const engine = loadStockAiCompositionEngine();
  const rows = sinapiAlvenariaFixture().map(({ source, ...row }) => row);

  const result = engine.loadRealCompositionsFromRows(rows, { source: "ORSE" });

  assert.equal(result.ok, true);
  assert.equal(result.imported[0].source, "ORSE");
});

test("Stock AI Obras mostra fonte da composicao real na resposta", () => {
  const engine = loadStockAiCompositionEngine();

  engine.loadExternalCompositions(sinapiAlvenariaFixture(), "SINAPI");
  const answer = engine.buildAnswerFromMessage("Tenho uma parede de 12 m por 3 m");

  assert.match(answer, /Fonte: SINAPI - codigo TESTE-001 - referencia 2025-01 - BA/);
});

test("Stock AI Obras alimenta consumo previsto com geometria e composicao real compativel", () => {
  const engine = loadStockAiCompositionEngine();

  engine.loadExternalCompositions(sinapiAlvenariaFixture(), "SINAPI");
  const answer = engine.buildAnswerFromMessage("Tenho uma parede de 12 m por 3 m");

  assert.match(answer, /Bloco teste: 54 un/);
  assert.match(answer, /PLANEJAMENTO DE COMPRA/);
});

test("Stock AI Obras volta para demonstrativa quando nao ha base real", () => {
  const engine = loadStockAiCompositionEngine();

  engine.loadExternalCompositions([], "SINAPI");
  const answer = engine.buildAnswerFromMessage("Tenho uma parede de 12 m por 3 m");

  assert.doesNotMatch(answer, /Bloco teste/);
  assert.match(answer, /Fonte: Base .*demonstrativa/i);
});

test("Stock AI Obras nao inventa consumo quando nao existe composicao cadastrada", () => {
  const engine = loadStockAiCompositionEngine();
  const answer = engine.buildAnswerFromMessage("Vou instalar 8 portas");

  assert.match(answer, /QUANTITATIVO GEOM/);
  assert.match(answer, /Ainda nao existe composicao tecnica cadastrada|sem composicao cadastrada/i);
  assert.doesNotMatch(answer, /CONSUMO PREVISTO/);
});

test("Stock AI Obras limpa catalogo externo controlado", () => {
  const engine = loadStockAiCompositionEngine();

  engine.setExternalCompositionCatalog(sinapiAlvenariaFixture());
  engine.clearExternalCompositionCatalog();

  assert.equal(engine.getExternalCompositionCatalog().length, 0);
  assert.notEqual(engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" }).source, "SINAPI");
});

test("Stock AI Obras identifica mock como mock e nao como base real", () => {
  const engine = loadStockAiCompositionEngine();

  const result = engine.setExternalCompositionCatalog(sampleFixture.compositions);
  const composition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });
  const answer = engine.buildAnswerFromMessage("Tenho uma parede de 12 m por 3 m");

  assert.equal(sampleFixture.isMock, true);
  assert.equal(sampleFixture.mockOnly, true);
  assert.equal(result.imported[0].metadata.isMock, true);
  assert.equal(engine.isMockComposition(composition), true);
  assert.equal(engine.isRealComposition(composition), false);
  assert.match(answer, /Fonte: MOCK DE TESTE - nao usar como base real/);
});

test("Stock AI Obras rejeita template de base real pequena como base pronta", () => {
  const engine = loadStockAiCompositionEngine();

  const importResult = engine.loadRealCompositionsFromJson(realTemplate);
  const readiness = engine.validateSmallRealCompositionFile(realTemplate);

  assert.equal(importResult.imported.length, 0);
  assert.equal(readiness.ok, false);
  assert.equal(readiness.ready.length, 0);
  assert.match(readiness.rejected[0].reasons.join(" "), /placeholder/i);
  assert.match(readiness.rejected[0].reasons.join(" "), /coefficient oficial ausente ou zerado|coefficient numerico maior que zero/i);
});

test("Stock AI Obras exige revisao manual para base real pequena SINAPI ORSE", () => {
  const engine = loadStockAiCompositionEngine();
  const rows = sinapiAlvenariaFixture();
  rows[0].metadata = {
    importedFrom: "teste controlado"
  };

  const readiness = engine.validateSmallRealCompositionFile(rows);

  assert.equal(readiness.ok, false);
  assert.match(readiness.rejected[0].reasons.join(" "), /manualReviewRequired/);
});

test("Stock AI Obras mantem arquivo example da primeira composicao real como preenchivel", () => {
  assert.equal(existsSync(firstRealExamplePath), true);
  assert.equal(firstRealExample.sourceType, "official_manual_entry");
  assert.equal(firstRealExample.items[0].inputs[0].coefficient, 0);
});

test("Stock AI Obras rejeita primeira composicao real example como base pronta", () => {
  const engine = loadStockAiCompositionEngine();

  const importResult = engine.loadRealCompositionsFromJson(firstRealExample);
  const readiness = engine.validateSmallRealCompositionFile(firstRealExample);

  assert.equal(importResult.imported.length, 0);
  assert.equal(readiness.ok, false);
  assert.equal(readiness.ready.length, 0);
  assert.match(readiness.rejected[0].reasons.join(" "), /Fonte deve ser SINAPI ou ORSE|placeholder|Coeficiente oficial ausente ou zerado/);
});

test("Stock AI Obras aceita somente entrada oficial manual positiva em validacao estrutural", () => {
  const engine = loadStockAiCompositionEngine();
  const readiness = engine.validateSmallRealCompositionFile(officialManualEntryTestOnly());

  assert.equal(readiness.ok, true);
  assert.equal(readiness.ready.length, 1);
  assert.equal(readiness.rejected.length, 0);
  assert.equal(readiness.ready[0].source, "SINAPI");
  assert.equal(readiness.ready[0].metadata.manualReviewRequired, true);
});

test("Stock AI Obras rejeita entrada manual positiva sem marcadores oficiais obrigatorios", () => {
  const engine = loadStockAiCompositionEngine();
  const invalid = officialManualEntryTestOnly();
  delete invalid.sourceType;
  delete invalid.items[0].sourceType;
  invalid.items[0].isOfficial = false;
  invalid.referenceMonth = "";
  invalid.state = "";

  const readiness = engine.validateSmallRealCompositionFile(invalid);

  assert.equal(readiness.ok, false);
  assert.match(readiness.rejected[0].reasons.join(" "), /sourceType/);
  assert.match(readiness.rejected[0].reasons.join(" "), /isOfficial/);
  assert.match(readiness.rejected[0].reasons.join(" "), /referenceMonth/);
  assert.match(readiness.rejected[0].reasons.join(" "), /state\/UF/);
});

test("Stock AI Obras nao trata mock template ou example como base real pronta", () => {
  const engine = loadStockAiCompositionEngine();
  const mockReadiness = engine.validateSmallRealCompositionFile(sampleFixture);
  const templateReadiness = engine.validateSmallRealCompositionFile(realTemplate);
  const exampleReadiness = engine.validateSmallRealCompositionFile(firstRealExample);

  assert.equal(mockReadiness.ok, false);
  assert.equal(templateReadiness.ok, false);
  assert.equal(exampleReadiness.ok, false);
});

test("Stock AI Obras seta composicao externa de teste e limpa retorno demonstrativo", () => {
  const engine = loadStockAiCompositionEngine();
  const validTestOnly = officialManualEntryTestOnly();

  const result = engine.setExternalCompositionCatalog(validTestOnly);
  const externalComposition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });

  assert.equal(result.imported.length, 1);
  assert.equal(externalComposition.source, "SINAPI");
  assert.equal(externalComposition.code, "TEST-ONLY-SINAPI-001");

  engine.clearExternalCompositionCatalog();
  const fallbackComposition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });

  assert.notEqual(fallbackComposition.source, "SINAPI");
  assert.match(fallbackComposition.source, /demonstrativa/i);
});

test("Stock AI Obras assistente classifica template original como incompleto", () => {
  const engine = loadStockAiCompositionEngine();
  const analysis = engine.analyzeOfficialCompositionReadiness(realTemplate);

  assert.equal(analysis.ready, false);
  assert.equal(analysis.status, "Incompleta");
  assert.equal(analysis.score < 40, true);
  assert.equal(analysis.errors.length > 3, true);
  assert.match(analysis.errors.join(" "), /placeholder|Coeficiente oficial ausente|sourceType/i);
});

test("Stock AI Obras assistente classifica composicao parcial com score intermediario", () => {
  const engine = loadStockAiCompositionEngine();
  const partial = officialManualEntryTestOnly();
  partial.items[0].code = "";
  partial.items[0].reference = "";
  partial.referenceMonth = "";
  partial.state = "";
  partial.items[0].inputs[0].code = "";
  partial.items[0].inputs[0].coefficient = 0;

  const analysis = engine.analyzeOfficialCompositionReadiness(partial);

  assert.equal(analysis.ready, false);
  assert.equal(analysis.score >= 40, true);
  assert.equal(analysis.score < 80, true);
  assert.equal(analysis.status, "Parcialmente preenchida");
  assert.match(analysis.errors.join(" "), /code da composicao|referenceMonth|state\/UF|Coeficiente oficial ausente/);
});

test("Stock AI Obras assistente aceita mock TEST ONLY completo sem cadastrar catalogo real", () => {
  const engine = loadStockAiCompositionEngine();
  const mockReady = officialManualEntryTestOnly();
  mockReady.items[0].metadata.isMock = true;
  mockReady.items[0].metadata.mockOnly = true;

  const analysis = engine.analyzeOfficialCompositionReadiness(mockReady);

  assert.equal(analysis.ready, true);
  assert.equal(analysis.score, 100);
  assert.equal(engine.getExternalCompositionCatalog().length, 0);
  assert.match(analysis.warnings.join(" "), /TEST ONLY|MOCK/);
});

test("Stock AI Obras diagnostico do template retorna ok false e lista erros", () => {
  const engine = loadStockAiCompositionEngine();
  const report = engine.generateOfficialCompositionDiagnosticReport(realTemplate);

  assert.equal(report.ok, false);
  assert.equal(report.readiness.ready, false);
  assert.equal(report.readiness.score < 40, true);
  assert.equal(report.errors.length > 3, true);
  assert.match(report.errors.join(" "), /placeholder|coefficient oficial ausente|sourceType/i);
});

test("Stock AI Obras diagnostico parcial retorna score intermediario", () => {
  const engine = loadStockAiCompositionEngine();
  const partial = officialManualEntryTestOnly();
  partial.items[0].code = "";
  partial.items[0].reference = "";
  partial.referenceMonth = "";
  partial.state = "";
  partial.items[0].inputs[0].code = "";
  partial.items[0].inputs[0].coefficient = 0;

  const report = engine.generateOfficialCompositionDiagnosticReport(partial);

  assert.equal(report.ok, false);
  assert.equal(report.readiness.score >= 40, true);
  assert.equal(report.readiness.score < 80, true);
  assert.match(report.textReport, /Parcialmente preenchida/);
});

test("Stock AI Obras diagnostico mock TEST ONLY retorna score 100 com aviso", () => {
  const engine = loadStockAiCompositionEngine();
  const mockReady = officialManualEntryTestOnly();
  mockReady.items[0].metadata.isMock = true;
  mockReady.items[0].metadata.mockOnly = true;

  const report = engine.generateOfficialCompositionDiagnosticReport(mockReady);

  assert.equal(report.ok, true);
  assert.equal(report.readiness.score, 100);
  assert.match(report.warnings.join(" "), /TEST ONLY|MOCK/);
});

test("Stock AI Obras diagnostico textual contem fonte UF referencia insumos e status", () => {
  const engine = loadStockAiCompositionEngine();
  const report = engine.generateOfficialCompositionDiagnosticReport(officialManualEntryTestOnly());

  assert.match(report.textReport, /Fonte: SINAPI/);
  assert.match(report.textReport, /UF: BA/);
  assert.match(report.textReport, /Referencia: TEST ONLY - nao usar como base real/);
  assert.match(report.textReport, /TEST-ONLY-MAT-001/);
  assert.match(report.textReport, /Status: Pronta para importacao \(100\/100\)/);
});

test("Stock AI Obras diagnostico nao cadastra catalogo externo sozinho", () => {
  const engine = loadStockAiCompositionEngine();

  const before = engine.getExternalCompositionCatalog().length;
  const report = engine.generateOfficialCompositionDiagnosticReport(officialManualEntryTestOnly());
  const after = engine.getExternalCompositionCatalog().length;

  assert.equal(report.ok, true);
  assert.equal(before, 0);
  assert.equal(after, 0);
});

test("Stock AI Obras documenta guia pratico da primeira composicao oficial", () => {
  assert.equal(existsSync(firstOfficialGuidePath), true);

  const guide = readFileSync(firstOfficialGuidePath, "utf8");

  assert.match(guide, /Origem dos dados oficiais/);
  assert.match(guide, /Qual composicao escolher primeiro/);
  assert.match(guide, /Checklist final antes da importacao/);
  assert.match(guide, /Fluxo completo/);
  assert.match(guide, /nao cria codigos, nao cria coeficientes/i);
  assert.match(guide, /sem inventar valores/i);
});

test("Stock AI Obras importador oficial agrupa linhas por composicao", () => {
  const engine = loadStockAiCompositionEngine();
  const result = engine.importOfficialBase({ rows: officialBaseRowsFixture() });

  assert.equal(result.ok, true);
  assert.equal(result.imported.length, 1);
  assert.equal(result.imported[0].code, "SINAPI-ALV-001");
  assert.equal(result.imported[0].inputs.length, 2);
  assert.equal(result.imported[0].sourceType, "official_imported_file");
});

test("Stock AI Obras importador oficial converte virgula decimal", () => {
  const engine = loadStockAiCompositionEngine();
  const normalized = engine.normalizeOfficialBaseRows(officialBaseRowsFixture());

  assert.equal(normalized[0].coefficient, 12.5);
  assert.equal(normalized[1].coefficient, 3.25);
});

test("Stock AI Obras importador oficial rejeita coeficiente zerado", () => {
  const engine = loadStockAiCompositionEngine();
  const rows = officialBaseRowsFixture();
  rows[0].coefficient = "0";
  const result = engine.importOfficialBase({ rows });

  assert.equal(result.ok, false);
  assert.equal(result.imported.length, 0);
  assert.match(result.errors.join(" "), /Coeficiente oficial ausente/);
});

test("Stock AI Obras importador oficial rejeita MOCK TEST ONLY", () => {
  const engine = loadStockAiCompositionEngine();
  const rows = officialBaseRowsFixture();
  rows[0].compositionName = "TEST ONLY MOCK de alvenaria";
  const result = engine.validateOfficialBaseImport({ rows });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /MOCK|TEST ONLY/);
});

test("Stock AI Obras importador oficial busca por codigo", () => {
  const engine = loadStockAiCompositionEngine();
  engine.importOfficialBase({ rows: officialBaseRowsFixture() });
  const results = engine.searchImportedOfficialCompositions("SINAPI-ALV-001");

  assert.equal(results.length, 1);
  assert.equal(results[0].code, "SINAPI-ALV-001");
});

test("Stock AI Obras importador oficial busca por nome parcial", () => {
  const engine = loadStockAiCompositionEngine();
  engine.importOfficialBase({ rows: officialBaseRowsFixture() });
  const results = engine.searchImportedOfficialCompositions("bloco ceramico");

  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Alvenaria de bloco ceramico oficial controlada");
});

test("Stock AI Obras base oficial importada tem prioridade sobre catalogo demonstrativo", () => {
  const engine = loadStockAiCompositionEngine();
  engine.importOfficialBase({ rows: officialBaseRowsFixture() });

  const composition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });
  const prediction = engine.calculatePredictedConsumption({
    service: "Alvenaria de bloco ceramico",
    quantity: 10,
    unit: "m2"
  });

  assert.equal(composition.code, "SINAPI-ALV-001");
  assert.equal(composition.source, "SINAPI");
  assert.equal(composition.sourceType, "official_imported_file");
  assert.equal(prediction.predictedItems.some((item) => item.name === "Bloco ceramico oficial"), true);
});

test("Stock AI Obras limpar base oficial restaura fallback demonstrativo", () => {
  const engine = loadStockAiCompositionEngine();
  engine.importOfficialBase({ rows: officialBaseRowsFixture() });
  engine.clearImportedOfficialBase();

  const composition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });

  assert.notEqual(composition.code, "SINAPI-ALV-001");
  assert.match(engine.normalize(composition.source), /base tecnica demonstrativa editavel/);
});

test("Stock AI Obras importacao oficial invalida nao remove catalogo valido anterior", () => {
  const engine = loadStockAiCompositionEngine();
  engine.importOfficialBase({ rows: officialBaseRowsFixture() });
  const rows = officialBaseRowsFixture();
  rows[0].coefficient = 0;

  const invalid = engine.importOfficialBase({ rows });
  const stats = engine.getImportedOfficialBaseStats();
  const composition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });

  assert.equal(invalid.ok, false);
  assert.equal(stats.totalCompositions, 1);
  assert.equal(composition.code, "SINAPI-ALV-001");
});

test("Stock AI Obras estatisticas da base oficial importada retornam fonte UF mes e totais", () => {
  const engine = loadStockAiCompositionEngine();
  engine.importOfficialBase({ rows: officialBaseRowsFixture() });
  const stats = engine.getImportedOfficialBaseStats();

  assert.equal(stats.totalCompositions, 1);
  assert.equal(stats.totalInputs, 2);
  assert.equal(stats.source, "SINAPI");
  assert.equal(stats.state, "BA");
  assert.equal(stats.referenceMonth, "2026-01");
});

test("Stock AI Obras documenta importador local de bases oficiais", () => {
  assert.equal(existsSync(officialBaseImporterGuidePath), true);

  const guide = readFileSync(officialBaseImporterGuidePath, "utf8");

  assert.match(guide, /Formato aceito/);
  assert.match(guide, /coeficientes oficiais/i);
  assert.match(guide, /nao invente coeficientes/i);
  assert.match(guide, /prioridade/i);
  assert.match(guide, /XLSX/i);
});
