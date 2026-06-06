import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as XLSX from "xlsx";

const testDir = dirname(fileURLToPath(import.meta.url));
const sampleFixture = JSON.parse(readFileSync(join(testDir, "fixtures", "stock-ai-real-compositions-sample.json"), "utf8"));
const realTemplate = JSON.parse(readFileSync(join(testDir, "..", "..", "relatorio-qualidade-obras", "bases-reais", "sinapi-orse-real-sample.template.json"), "utf8"));
const firstRealExamplePath = join(testDir, "..", "..", "relatorio-qualidade-obras", "bases-reais", "primeira-composicao-real.example.json");
const firstRealExample = JSON.parse(readFileSync(firstRealExamplePath, "utf8"));
const firstOfficialGuidePath = join(testDir, "..", "..", "docs", "stock-ai-guia-primeira-composicao-oficial.md");
const officialBaseImporterGuidePath = join(testDir, "..", "..", "docs", "stock-ai-importador-bases-oficiais.md");
const officialBaseCsvGuidePath = join(testDir, "..", "..", "docs", "stock-ai-leitor-csv-bases-oficiais.md");
const officialBaseXlsxGuidePath = join(testDir, "..", "..", "docs", "stock-ai-leitor-xlsx-bases-oficiais.md");
const officialBaseUploadGuidePath = join(testDir, "..", "..", "docs", "stock-ai-interface-upload-base-oficial.md");
const sinapiAnaliticoGuidePath = join(testDir, "..", "..", "docs", "stock-ai-adaptador-sinapi-analitico.md");
const stockAiObrasHtmlPath = join(testDir, "..", "..", "stock-ai-obras.html");
const stockAiBrowserXlsxPath = join(testDir, "..", "..", "relatorio-qualidade-obras", "xlsx.full.min.js");

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

function officialGeometryRowsFixture() {
  return [{
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-GEO-ALV-001",
    compositionName: "Alvenaria de bloco ceramico geometria oficial",
    compositionUnit: "m2",
    serviceType: "alvenaria",
    inputCode: "SINAPI-GEO-BLOCO",
    inputName: "Bloco ceramico geometria oficial",
    inputUnit: "un",
    coefficient: "12,50"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-GEO-ALV-001",
    compositionName: "Alvenaria de bloco ceramico geometria oficial",
    compositionUnit: "m2",
    serviceType: "alvenaria",
    inputCode: "SINAPI-GEO-ARG",
    inputName: "Argamassa geometria oficial",
    inputUnit: "kg",
    coefficient: "3,25"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-GEO-PILAR-001",
    compositionName: "Pilar de concreto armado geometria oficial",
    compositionUnit: "m3",
    serviceType: "pilar",
    inputCode: "SINAPI-GEO-CONC",
    inputName: "Concreto usinado geometria oficial",
    inputUnit: "m3",
    coefficient: "1"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-GEO-PILAR-001",
    compositionName: "Pilar de concreto armado geometria oficial",
    compositionUnit: "m3",
    serviceType: "pilar",
    inputCode: "SINAPI-GEO-ACO",
    inputName: "Aco CA-50 geometria oficial",
    inputUnit: "kg",
    coefficient: "95"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-GEO-LAJE-001",
    compositionName: "Laje pre-moldada geometria oficial",
    compositionUnit: "m2",
    serviceType: "laje",
    inputCode: "SINAPI-GEO-LAJOTA",
    inputName: "Lajota ceramica geometria oficial",
    inputUnit: "un",
    coefficient: "8"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-GEO-COB-001",
    compositionName: "Cobertura com telha ceramica geometria oficial",
    compositionUnit: "m2",
    serviceType: "cobertura",
    inputCode: "SINAPI-GEO-TELHA",
    inputName: "Telha ceramica geometria oficial",
    inputUnit: "un",
    coefficient: "16"
  }];
}

function officialWithdrawalRowsFixture() {
  return [{
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-RET-PILAR-001",
    compositionName: "Pilar unitario para conferencia de retirada",
    compositionUnit: "un",
    serviceType: "pilar",
    inputCode: "SINAPI-RET-CIM",
    inputName: "Cimento",
    inputUnit: "saco",
    coefficient: "4"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-RET-PILAR-001",
    compositionName: "Pilar unitario para conferencia de retirada",
    compositionUnit: "un",
    serviceType: "pilar",
    inputCode: "SINAPI-RET-TAB",
    inputName: "Tabua",
    inputUnit: "un",
    coefficient: "8"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-RET-PISO-001",
    compositionName: "Assentamento de piso com argamassa AC3",
    compositionUnit: "m2",
    serviceType: "piso",
    inputCode: "SINAPI-RET-AC3",
    inputName: "Argamassa colante AC3",
    inputUnit: "saco",
    coefficient: "1"
  }];
}

function officialBaseCodigo97141Fixture() {
  return [{
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12",
    compositionCode: "97141",
    compositionName: "Tubo de ferro fundido DN 80 fixture oficial controlada",
    compositionUnit: "m",
    serviceType: "tubulacao",
    inputCode: "SINAPI-97141-MAT-001",
    inputName: "Tubo ferro fundido DN 80 fixture",
    inputUnit: "m",
    coefficient: "1,05"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12",
    compositionCode: "97141",
    compositionName: "Tubo de ferro fundido DN 80 fixture oficial controlada",
    compositionUnit: "m",
    serviceType: "tubulacao",
    inputCode: "SINAPI-97141-MAT-002",
    inputName: "Conexao ferro fundido fixture",
    inputUnit: "un",
    coefficient: "0,10"
  }];
}

function officialBaseCsvSemicolonFixture() {
  return [
    "compositionCode;compositionName;compositionUnit;inputCode;inputName;inputUnit;coefficient",
    "SINAPI-CSV-001;Alvenaria de bloco ceramico CSV controlada;m2;SINAPI-CSV-MAT-001;Bloco ceramico CSV;un;12,50",
    "SINAPI-CSV-001;Alvenaria de bloco ceramico CSV controlada;m2;SINAPI-CSV-MAT-002;Argamassa CSV;kg;3,25"
  ].join("\n");
}

function officialBaseCsvCommaFixture() {
  return [
    "compositionCode,compositionName,compositionUnit,inputCode,inputName,inputUnit,coefficient",
    "ORSE-CSV-001,Chapisco CSV controlado,m2,ORSE-CSV-MAT-001,Argamassa CSV,kg,\"4,75\""
  ].join("\n");
}

function loadStockAiCompositionEngineWithXlsx() {
  return loadStockAiCompositionEngine({ XLSX });
}

function officialBaseWorkbook(sheets) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  });
  return workbook;
}

function officialBaseXlsxSimpleWorkbook() {
  return officialBaseWorkbook([{
    name: "SINAPI",
    rows: [
      ["compositionCode", "compositionName", "compositionUnit", "inputCode", "inputName", "inputUnit", "coefficient"],
      ["SINAPI-XLSX-001", "Alvenaria XLSX controlada", "m2", "SINAPI-XLSX-MAT-001", "Bloco XLSX", "un", "12,50"],
      ["SINAPI-XLSX-001", "Alvenaria XLSX controlada", "m2", "SINAPI-XLSX-MAT-002", "Argamassa XLSX", "kg", "3,25"]
    ]
  }]);
}

function sinapiAnaliticoRowsFixture() {
  return [
    ["PCI.818.01", "", "", "", "", "", "", "", "", ""],
    ["DATA DE EMISSAO", "10/01/2025", "", "", "", "", "", "", "", ""],
    ["ENCARGOS SOCIAIS", "DESONERADO", "", "", "", "", "", "", "", ""],
    ["ABRANGENCIA", "BA", "", "", "", "", "", "", "", ""],
    ["DATA DE PRECO", "12/2024", "", "", "", "", "", "", "", ""],
    ["CODIGO DA COMPOSICAO", "DESCRICAO DA COMPOSICAO", "UNIDADE", "TIPO ITEM", "CODIGO ITEM", "DESCRIÇÃO ITEM", "UNIDADE ITEM", "COEFICIENTE", "PRECO UNITARIO", "CUSTO TOTAL"],
    ["SINAPI-ANA-001", "Alvenaria analitica fixture", "M²", "INSUMO", "MAT-ANA-001", "Bloco ceramico analitico", "UN", "12,50", "1,00", "12,50"],
    ["SINAPI-ANA-001", "Alvenaria analitica fixture", "M²", "COMPOSICAO", "COMP-AUX-001", "Argamassa auxiliar analitica", "M³", "0,25", "100,00", "25,00"],
    ["SINAPI-ANA-002", "Chapisco analitico fixture", "M²", "INSUMO", "MAT-ANA-002", "Cimento analitico", "KG", "4,20", "0,80", "3,36"]
  ];
}

function sinapiAnaliticoWorkbookFixture() {
  return officialBaseWorkbook([{
    name: "Analitico",
    rows: sinapiAnaliticoRowsFixture()
  }]);
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

  assert.match(answer, /Fonte: SINAPI oficial importado - codigo TESTE-001 - referencia 2025-01 - BA/);
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

test("Stock AI Obras leitor CSV com separador ponto e virgula normaliza linhas", () => {
  const engine = loadStockAiCompositionEngine();
  const parsed = engine.parseOfficialBaseCsv(officialBaseCsvSemicolonFixture(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-02"
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.delimiter, ";");
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].compositionCode, "SINAPI-CSV-001");
});

test("Stock AI Obras leitor CSV com separador virgula normaliza linhas", () => {
  const engine = loadStockAiCompositionEngine();
  const parsed = engine.parseOfficialBaseCsv(officialBaseCsvCommaFixture(), {
    source: "ORSE",
    state: "SE",
    referenceMonth: "2026-02"
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.delimiter, ",");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].source, "ORSE");
});

test("Stock AI Obras leitor CSV preserva decimal com virgula para conversao", () => {
  const engine = loadStockAiCompositionEngine();
  const parsed = engine.parseOfficialBaseCsv(officialBaseCsvSemicolonFixture(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-02"
  });
  const normalized = engine.normalizeOfficialBaseRows({ rows: parsed.rows });

  assert.equal(normalized[0].coefficient, 12.5);
  assert.equal(normalized[1].coefficient, 3.25);
});

test("Stock AI Obras leitor CSV aceita columnMap manual", () => {
  const engine = loadStockAiCompositionEngine();
  const csv = [
    "COD_COMP;DESC_COMP;UN_COMP;COD_INSUMO;DESC_INSUMO;UN_INSUMO;COEF",
    "SINAPI-MAP-001;Piso ceramico CSV controlado;m2;SINAPI-MAP-MAT-001;Piso CSV;m2;1,10"
  ].join("\n");
  const parsed = engine.parseOfficialBaseCsv(csv, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-03",
    delimiter: ";",
    columnMap: {
      compositionCode: "COD_COMP",
      compositionName: "DESC_COMP",
      compositionUnit: "UN_COMP",
      inputCode: "COD_INSUMO",
      inputName: "DESC_INSUMO",
      inputUnit: "UN_INSUMO",
      coefficient: "COEF"
    }
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rows[0].compositionCode, "SINAPI-MAP-001");
  assert.equal(parsed.rows[0].coefficient, "1,10");
});

test("Stock AI Obras leitor CSV aceita cabecalhos alternativos", () => {
  const engine = loadStockAiCompositionEngine();
  const csv = [
    "codigo da composicao;descricao da composicao;unidade composicao;codigo insumo;nome insumo;unidade insumo;coef",
    "SINAPI-ALT-001;Reboco CSV controlado;m2;SINAPI-ALT-MAT-001;Argamassa alternativa;kg;5,20"
  ].join("\n");
  const parsed = engine.parseOfficialBaseCsv(csv, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-04"
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rows[0].inputName, "Argamassa alternativa");
});

test("Stock AI Obras leitor CSV rejeita CSV vazio", () => {
  const engine = loadStockAiCompositionEngine();
  const parsed = engine.parseOfficialBaseCsv("", {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-02"
  });

  assert.equal(parsed.ok, false);
  assert.match(parsed.errors.join(" "), /CSV vazio/);
});

test("Stock AI Obras leitor CSV rejeita CSV sem colunas minimas", () => {
  const engine = loadStockAiCompositionEngine();
  const parsed = engine.parseOfficialBaseCsv("foo;bar\n1;2", {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-02"
  });

  assert.equal(parsed.ok, false);
  assert.match(parsed.errors.join(" "), /colunas minimas/);
});

test("Stock AI Obras leitor CSV invalido nao apaga base oficial anterior", () => {
  const engine = loadStockAiCompositionEngine();
  engine.importOfficialBase({ rows: officialBaseRowsFixture() });
  const invalid = engine.importOfficialBaseCsv("foo;bar\n1;2", {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-02"
  });
  const stats = engine.getImportedOfficialBaseStats();

  assert.equal(invalid.ok, false);
  assert.equal(stats.totalCompositions, 1);
});

test("Stock AI Obras importOfficialBaseCsv importa e permite busca", () => {
  const engine = loadStockAiCompositionEngine();
  const imported = engine.importOfficialBaseCsv(officialBaseCsvSemicolonFixture(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-02"
  });
  const results = engine.searchImportedOfficialCompositions("SINAPI-CSV-001");

  assert.equal(imported.ok, true);
  assert.equal(imported.imported.length, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].code, "SINAPI-CSV-001");
});

test("Stock AI Obras clearImportedOfficialBase apos CSV restaura fallback", () => {
  const engine = loadStockAiCompositionEngine();
  engine.importOfficialBaseCsv(officialBaseCsvSemicolonFixture(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-02"
  });
  engine.clearImportedOfficialBase();

  const composition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });

  assert.notEqual(composition.code, "SINAPI-CSV-001");
  assert.match(engine.normalize(composition.source), /base tecnica demonstrativa editavel/);
});

test("Stock AI Obras documenta leitor CSV de bases oficiais", () => {
  assert.equal(existsSync(officialBaseCsvGuidePath), true);

  const guide = readFileSync(officialBaseCsvGuidePath, "utf8");

  assert.match(guide, /formato minimo esperado/i);
  assert.match(guide, /columnMap/i);
  assert.match(guide, /decimal com virgula/i);
  assert.match(guide, /CSV.*rows.*importador.*catalogo/i);
  assert.match(guide, /XLSX\/ZIP/i);
});

test("Stock AI Obras leitor XLSX simples importa corretamente", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const buffer = XLSX.write(officialBaseXlsxSimpleWorkbook(), { type: "buffer", bookType: "xlsx" });
  const imported = engine.importOfficialBaseXlsx(buffer, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-05"
  });

  assert.equal(imported.ok, true);
  assert.equal(imported.imported.length, 1);
  assert.equal(imported.imported[0].code, "SINAPI-XLSX-001");
  assert.equal(imported.imported[0].inputs.length, 2);
});

test("Stock AI Obras leitor XLSX com multiplas composicoes agrupa corretamente", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const workbook = officialBaseWorkbook([{
    name: "ORSE",
    rows: [
      ["compositionCode", "compositionName", "compositionUnit", "inputCode", "inputName", "inputUnit", "coefficient"],
      ["ORSE-XLSX-001", "Chapisco XLSX controlado", "m2", "ORSE-XLSX-MAT-001", "Argamassa chapisco XLSX", "kg", "4,20"],
      ["ORSE-XLSX-002", "Reboco XLSX controlado", "m2", "ORSE-XLSX-MAT-002", "Argamassa reboco XLSX", "kg", "8,40"]
    ]
  }]);
  const imported = engine.importOfficialBaseXlsx(workbook, {
    source: "ORSE",
    state: "SE",
    referenceMonth: "2026-05"
  });

  assert.equal(imported.ok, true);
  assert.equal(imported.imported.length, 2);
});

test("Stock AI Obras leitor XLSX converte decimal com virgula", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const parsed = engine.parseOfficialBaseXlsx(officialBaseXlsxSimpleWorkbook(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-05"
  });
  const normalized = engine.normalizeOfficialBaseRows({ rows: parsed.rows });

  assert.equal(parsed.ok, true);
  assert.equal(normalized[0].coefficient, 12.5);
  assert.equal(normalized[1].coefficient, 3.25);
});

test("Stock AI Obras leitor XLSX aceita columnMap manual", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const workbook = officialBaseWorkbook([{
    name: "SINAPI",
    rows: [
      ["COD_COMP", "DESC_COMP", "UN_COMP", "COD_INSUMO", "DESC_INSUMO", "UN_INSUMO", "COEF"],
      ["SINAPI-XLSX-MAP-001", "Piso XLSX controlado", "m2", "SINAPI-XLSX-MAP-MAT-001", "Piso XLSX", "m2", "1,10"]
    ]
  }]);
  const parsed = engine.parseOfficialBaseXlsx(workbook, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-06",
    columnMap: {
      compositionCode: "COD_COMP",
      compositionName: "DESC_COMP",
      compositionUnit: "UN_COMP",
      inputCode: "COD_INSUMO",
      inputName: "DESC_INSUMO",
      inputUnit: "UN_INSUMO",
      coefficient: "COEF"
    }
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rows[0].compositionCode, "SINAPI-XLSX-MAP-001");
});

test("Stock AI Obras leitor XLSX usa sheetName especifico", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const workbook = officialBaseWorkbook([{
    name: "Vazia",
    rows: []
  }, {
    name: "Dados",
    rows: [
      ["compositionCode", "compositionName", "compositionUnit", "inputCode", "inputName", "inputUnit", "coefficient"],
      ["SINAPI-XLSX-SHEET-001", "Baldrame XLSX controlado", "m3", "SINAPI-XLSX-SHEET-MAT-001", "Concreto XLSX", "m3", "1"]
    ]
  }]);
  const parsed = engine.parseOfficialBaseXlsx(workbook, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-07",
    sheetName: "Dados"
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.sheetName, "Dados");
  assert.equal(parsed.rows[0].compositionCode, "SINAPI-XLSX-SHEET-001");
});

test("Stock AI Obras leitor XLSX sheetName inexistente retorna erro claro", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const parsed = engine.parseOfficialBaseXlsx(officialBaseXlsxSimpleWorkbook(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-05",
    sheetName: "NaoExiste"
  });

  assert.equal(parsed.ok, false);
  assert.match(parsed.errors.join(" "), /Aba XLSX nao encontrada/);
});

test("Stock AI Obras leitor XLSX vazio e rejeitado", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const parsed = engine.parseOfficialBaseXlsx({ SheetNames: [], Sheets: {} }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-05"
  });

  assert.equal(parsed.ok, false);
  assert.match(parsed.errors.join(" "), /sem abas/);
});

test("Stock AI Obras leitor XLSX sem colunas minimas e rejeitado", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const workbook = officialBaseWorkbook([{
    name: "Invalida",
    rows: [
      ["foo", "bar"],
      ["1", "2"]
    ]
  }]);
  const parsed = engine.parseOfficialBaseXlsx(workbook, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-05"
  });

  assert.equal(parsed.ok, false);
  assert.match(parsed.errors.join(" "), /colunas minimas/);
});

test("Stock AI Obras leitor XLSX rejeita coefficient zero na importacao", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const workbook = officialBaseWorkbook([{
    name: "SINAPI",
    rows: [
      ["compositionCode", "compositionName", "compositionUnit", "inputCode", "inputName", "inputUnit", "coefficient"],
      ["SINAPI-XLSX-ZERO-001", "Alvenaria XLSX zero", "m2", "SINAPI-XLSX-ZERO-MAT-001", "Bloco XLSX zero", "un", "0"]
    ]
  }]);
  const imported = engine.importOfficialBaseXlsx(workbook, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-05"
  });

  assert.equal(imported.ok, false);
  assert.match(imported.errors.join(" "), /Coeficiente oficial ausente/);
});

test("Stock AI Obras leitor XLSX invalido nao apaga base oficial anterior", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialBaseRowsFixture() });
  const workbook = officialBaseWorkbook([{
    name: "Invalida",
    rows: [
      ["foo", "bar"],
      ["1", "2"]
    ]
  }]);
  const invalid = engine.importOfficialBaseXlsx(workbook, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-05"
  });
  const stats = engine.getImportedOfficialBaseStats();

  assert.equal(invalid.ok, false);
  assert.equal(stats.totalCompositions, 1);
});

test("Stock AI Obras importOfficialBaseXlsx importa e permite busca", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const imported = engine.importOfficialBaseXlsx(officialBaseXlsxSimpleWorkbook(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-05"
  });
  const results = engine.searchImportedOfficialCompositions("SINAPI-XLSX-001");

  assert.equal(imported.ok, true);
  assert.equal(results.length, 1);
  assert.equal(results[0].code, "SINAPI-XLSX-001");
});

test("Stock AI Obras clearImportedOfficialBase apos XLSX restaura fallback", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBaseXlsx(officialBaseXlsxSimpleWorkbook(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-05"
  });
  engine.clearImportedOfficialBase();

  const composition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });

  assert.notEqual(composition.code, "SINAPI-XLSX-001");
  assert.match(engine.normalize(composition.source), /base tecnica demonstrativa editavel/);
});

test("Stock AI Obras documenta leitor XLSX de bases oficiais", () => {
  assert.equal(existsSync(officialBaseXlsxGuidePath), true);

  const guide = readFileSync(officialBaseXlsxGuidePath, "utf8");

  assert.match(guide, /objetivo/i);
  assert.match(guide, /xlsx/i);
  assert.match(guide, /sheetName/i);
  assert.match(guide, /columnMap/i);
  assert.match(guide, /decimal com virgula/i);
  assert.match(guide, /XLSX.*rows.*importador.*catalogo/i);
});

test("Stock AI Obras interface contem upload de base oficial", () => {
  const html = readFileSync(stockAiObrasHtmlPath, "utf8");

  assert.match(html, /Importar base oficial SINAPI\/ORSE/);
  assert.match(html, /Fonte/);
  assert.match(html, /UF/);
  assert.match(html, /M&ecirc;s de refer&ecirc;ncia/);
  assert.match(html, /Validar arquivo/);
  assert.match(html, /Importar base/);
  assert.match(html, /Limpar base importada/);
  assert.match(html, /relatorio-qualidade-obras\/xlsx\.full\.min\.js/);
  assert.match(html, /Leitura XLSX habilitada no navegador/);
});

test("Stock AI Obras bridge expoe fluxo seguro de upload oficial", () => {
  const bridge = readFileSync(join(testDir, "..", "..", "stock-ai-obras-bridge.js"), "utf8");

  assert.match(bridge, /parseOfficialBaseCsv/);
  assert.match(bridge, /importOfficialBaseCsv/);
  assert.match(bridge, /parseOfficialBaseXlsx/);
  assert.match(bridge, /parseSinapiAnaliticoXlsx/);
  assert.match(bridge, /importSinapiAnaliticoXlsx/);
  assert.match(bridge, /Formato SINAPI Analitico detectado/);
  assert.match(bridge, /Nao foi possivel ler o XLSX/);
  assert.equal(bridge.indexOf("if (isXlsxFile_(file))") < bridge.indexOf("if (isCsvFile_(file))"), true);
  assert.equal(bridge.indexOf("detectSinapiAnaliticoFormat") < bridge.indexOf("parseOfficialBaseXlsx"), true);
  assert.match(bridge, /formatSinapiAnaliticoFailure_/);
  assert.doesNotMatch(bridge, /Workbook sheets|SINAPI DETECTION|SINAPI PARSE|SINAPI FALLBACK TO GENERIC XLSX/);
  assert.match(bridge, /clearImportedOfficialBase/);
  assert.match(bridge, /ColumnMap invalido/);
});

test("Stock AI Obras documenta interface de upload de base oficial", () => {
  assert.equal(existsSync(officialBaseUploadGuidePath), true);

  const guide = readFileSync(officialBaseUploadGuidePath, "utf8");

  assert.match(guide, /como importar CSV/i);
  assert.match(guide, /fallback XLSX no browser/i);
  assert.match(guide, /columnMap/i);
  assert.match(guide, /validacao antes da importacao/i);
  assert.match(guide, /Limpar base/i);
});

test("Stock AI Obras detecta formato SINAPI Analitico real", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const detected = engine.detectSinapiAnaliticoFormat(sinapiAnaliticoRowsFixture());

  assert.equal(detected.detected, true);
  assert.equal(detected.headerIndex, 5);
  assert.equal(detected.columnIndexes.compositionCode, 0);
});

test("Stock AI Obras detecta cabecalhos SINAPI Analitico reais com acentos", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const rows = sinapiAnaliticoRowsFixture().map((row) => row.slice());
  rows[5] = [
    "CÓDIGO DA COMPOSIÇÃO",
    "DESCRIÇÃO DA COMPOSIÇÃO",
    "UNIDADE",
    "TIPO DO ITEM",
    "CÓDIGO DO ITEM",
    "DESCRIÇÃO DO ITEM",
    "UNIDADE DO ITEM",
    "COEFICIENTE"
  ];
  const detected = engine.detectSinapiAnaliticoFormat(rows);

  assert.equal(detected.detected, true);
  assert.equal(detected.columnIndexes.inputName, 5);
});

test("Stock AI Obras parser SINAPI Analitico ignora metadados do topo", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const parsed = engine.parseSinapiAnaliticoRows(sinapiAnaliticoRowsFixture(), {
    source: "SINAPI",
    state: "BA",
    pricingType: "Desonerado"
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.referenceMonth, "2024-12");
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.rows[0].compositionCode, "SINAPI-ANA-001");
});

test("Stock AI Obras parser SINAPI Analitico ignora linha com composicao sem item real", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const rows = sinapiAnaliticoRowsFixture().map((row) => row.slice());
  rows.splice(6, 0, ["97141", "Composicao administrativa sem item real", "M2", "", "", "", "", "", "", ""]);
  const parsed = engine.parseSinapiAnaliticoRows(rows, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12"
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.ignoredRows.length, 1);
  assert.equal(parsed.ignoredRows[0].compositionCode, "97141");
  assert.doesNotMatch(parsed.errors.join(" "), /97141/);
});

test("Stock AI Obras parser SINAPI Analitico ignora itemType sem evidencia de item real", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const rows = sinapiAnaliticoRowsFixture().map((row) => row.slice());
  rows.splice(6, 0, ["97141", "Categoria administrativa de insumos", "M2", "INSUMO", "", "", "", "", "", ""]);
  const parsed = engine.parseSinapiAnaliticoRows(rows, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12"
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.ignoredRows.length, 1);
  assert.equal(parsed.ignoredRows[0].compositionCode, "97141");
  assert.match(parsed.ignoredRows[0].reason, /sem codigo, descricao ou coeficiente/);
  assert.doesNotMatch(parsed.errors.join(" "), /97141/);
});

test("Stock AI Obras parser SINAPI Analitico agrupa por codigo na importacao", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const imported = engine.importSinapiAnaliticoXlsx(sinapiAnaliticoWorkbookFixture(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12",
    pricingType: "Desonerado"
  });

  assert.equal(imported.ok, true);
  assert.equal(imported.imported.length, 2);
  assert.equal(imported.imported[0].inputs.length, 2);
});

test("Stock AI Obras parser SINAPI Analitico importa INSUMO corretamente", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const parsed = engine.parseSinapiAnaliticoRows(sinapiAnaliticoRowsFixture(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12"
  });

  const insumo = parsed.rows.find((row) => row.inputCode === "MAT-ANA-001");
  assert.equal(insumo.inputType, "insumo");
  assert.equal(insumo.inputName, "Bloco ceramico analitico");
});

test("Stock AI Obras parser SINAPI Analitico preserva COMPOSICAO como item composto", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const imported = engine.importSinapiAnaliticoXlsx(sinapiAnaliticoWorkbookFixture(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12"
  });

  const composition = imported.imported.find((item) => item.code === "SINAPI-ANA-001");
  const composedInput = composition.inputs.find((input) => input.code === "COMP-AUX-001");
  assert.equal(composedInput.type, "composicao");
  assert.equal(composedInput.name, "Argamassa auxiliar analitica");
});

test("Stock AI Obras parser SINAPI Analitico converte coefficient com virgula", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const parsed = engine.parseSinapiAnaliticoRows(sinapiAnaliticoRowsFixture(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12"
  });
  const normalized = engine.normalizeOfficialBaseRows({ rows: parsed.rows });

  assert.equal(normalized[0].coefficient, 12.5);
  assert.equal(normalized[1].coefficient, 0.25);
});

test("Stock AI Obras importSinapiAnaliticoXlsx importa e permite busca", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const imported = engine.importSinapiAnaliticoXlsx(sinapiAnaliticoWorkbookFixture(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12",
    pricingType: "Desonerado",
    locality: "SALVADOR"
  });
  const results = engine.searchImportedOfficialCompositions("alvenaria analitica");

  assert.equal(imported.ok, true);
  assert.equal(imported.format, "SINAPI_ANALITICO");
  assert.equal(results.length, 1);
  assert.equal(results[0].code, "SINAPI-ANA-001");
});

test("Stock AI Obras reconhece consulta por codigo de composicao SINAPI", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialBaseCodigo97141Fixture() });

  ["calcule a composicao 97141", "SINAPI 97141", "codigo 97141"].forEach((question) => {
    const request = engine.parseRequest(question);
    assert.equal(engine.isCompositionRequest(question), true);
    assert.equal(engine.isStockAiRequest(question), true);
    assert.equal(request.compositionCodeQuery.code, "97141");
    assert.equal(request.compositionCodeQuery.composition.code, "97141");
    assert.equal(request.compositionCodeQuery.composition.source, "SINAPI");
  });
});

test("Stock AI Obras responde composicao SINAPI por codigo sem cair no fluxo generico", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialBaseCodigo97141Fixture() });
  const answer = engine.buildAnswerFromMessage("calcule a composicao 97141");

  assert.match(answer, /COMPOSICAO IDENTIFICADA/);
  assert.match(answer, /97141/);
  assert.match(answer, /Tubo de ferro fundido DN 80/);
  assert.match(answer, /Fonte: SINAPI/);
  assert.match(answer, /UF: BA/);
  assert.match(answer, /Referencia: 2024-12/);
  assert.match(answer, /Nenhum coeficiente foi inventado/);
  assert.doesNotMatch(answer, /RDO|Relatorio Diario de Obra/i);
});

test("Stock AI Obras calcula insumos SINAPI por codigo com quantidade informada", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialBaseCodigo97141Fixture() });
  const answer = engine.buildAnswerFromMessage("calcule 10 m da composicao SINAPI 97141. Estoque: 5 m de tubo ferro fundido");

  assert.match(answer, /INSUMOS COM QUANTIDADE CALCULADA/);
  assert.match(answer, /Fonte: SINAPI oficial importado/);
  assert.match(answer, /Tubo ferro fundido DN 80 fixture: 1,05 m por m \| quantidade: 10,5 m/);
  assert.match(answer, /ESTOQUE X PREVISTO/);
  assert.match(answer, /Nenhum coeficiente foi inventado/);
});

test("Stock AI Obras usa SINAPI real por descricao aproximada no fluxo normal", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const officialPisoRows = officialBaseRowsFixture().map((row) => ({
    ...row,
    compositionCode: "SINAPI-PISO-001",
    compositionName: "Piso ceramico oficial controlado",
    serviceType: "piso"
  }));
  engine.importOfficialBase({ rows: officialPisoRows });
  const answer = engine.buildAnswerFromMessage("Vou executar 20 m2 de piso ceramico");

  assert.match(answer, /Composicao utilizada: SINAPI-PISO-001/);
  assert.match(answer, /Fonte: SINAPI oficial importado/);
  assert.match(answer, /Bloco ceramico oficial: 250 un/);
  assert.match(answer, /Argamassa oficial: 65 kg/);
  assert.match(answer, /SINAPI oficial importado ou ORSE oficial importado/);
});

test("Stock AI Obras sugere composicoes SINAPI proximas por descricao sem inventar consumo", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const officialPisoRows = officialBaseRowsFixture().map((row) => ({
    ...row,
    compositionCode: "SINAPI-PISO-001",
    compositionName: "Piso ceramico oficial controlado",
    serviceType: "piso"
  }));
  engine.importOfficialBase({ rows: officialPisoRows });
  const answer = engine.buildAnswerFromMessage("qual composicao SINAPI para piso ceramico?");

  assert.match(answer, /COMPOSICOES SINAPI\/ORSE SUGERIDAS/);
  assert.match(answer, /SINAPI-PISO-001 - Piso ceramico oficial controlado/);
  assert.match(answer, /Nenhum coeficiente foi inventado/);
  assert.doesNotMatch(answer, /CONSUMO PREVISTO/);
});

test("Stock AI Obras mantem fallback demonstrativo quando descricao nao encontra SINAPI compativel", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const incompatibleOfficialRows = officialBaseRowsFixture().map((row) => ({
    ...row,
    compositionName: "Piso ceramico oficial controlado",
    serviceType: "piso",
    compositionUnit: "m3"
  }));
  engine.importOfficialBase({ rows: incompatibleOfficialRows });
  const answer = engine.buildAnswerFromMessage("Vou executar 12 m2 de piso ceramico");

  assert.doesNotMatch(answer, /Composicao utilizada: SINAPI-ALV-001/);
  assert.match(answer, /Fonte: Base tecnica demonstrativa/);
});

test("Stock AI Obras aplica SINAPI importado em quantitativo geometrico de parede", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialGeometryRowsFixture() });
  const answer = engine.buildAnswerFromMessage("parede 12 x 3. Estoque: 100 un de bloco ceramico geometria oficial");

  assert.match(answer, /QUANTITATIVO GEOM/);
  assert.match(answer, /36 m2|36 m²/);
  assert.match(answer, /Composicao utilizada: SINAPI-GEO-ALV-001/);
  assert.match(answer, /Fonte: SINAPI oficial importado/);
  assert.match(answer, /Bloco ceramico geometria oficial: 450 un/);
  assert.match(answer, /Argamassa geometria oficial: 117 kg/);
  assert.match(answer, /estoque 100 un/);
  assert.match(answer, /comprar 350 un/);
});

test("Stock AI Obras aplica SINAPI importado em quantitativo geometrico de pilares", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialGeometryRowsFixture() });
  const request = engine.parseRequest("14 pilares 20x30 com 3 m");
  const answer = engine.buildAnswerFromMessage("14 pilares 20x30 com 3 m");

  assert.equal(request.geometry.quantity, 2.52);
  assert.equal(request.geometry.unit, "m3");
  assert.match(answer, /Composicao utilizada: SINAPI-GEO-PILAR-001/);
  assert.match(answer, /Concreto usinado geometria oficial: 2,52 m(?:3|³)/);
  assert.match(answer, /Aco CA-50 geometria oficial: 239,4 kg/);
});

test("Stock AI Obras aplica SINAPI importado em laje por area sem inventar espessura", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialGeometryRowsFixture() });
  const answer = engine.buildAnswerFromMessage("laje 100 m2");

  assert.match(answer, /Composicao utilizada: SINAPI-GEO-LAJE-001/);
  assert.match(answer, /Lajota ceramica geometria oficial: 800 un/);
  assert.doesNotMatch(answer, /Qual a espessura da laje/);
});

test("Stock AI Obras aplica SINAPI importado em cobertura por area sem tipo informado", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialGeometryRowsFixture() });
  const answer = engine.buildAnswerFromMessage("cobertura 180 m2");

  assert.match(answer, /Composicao utilizada: SINAPI-GEO-COB-001/);
  assert.match(answer, /Telha ceramica geometria oficial: 2\.880 un|Telha ceramica geometria oficial: 2880 un/);
  assert.doesNotMatch(answer, /tipo de cobertura/i);
});

test("Stock AI Obras conferencia de retirada marca pedido acima do previsto", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialWithdrawalRowsFixture() });
  const answer = engine.buildAnswerFromMessage("Pedreiro pediu 10 sacos de cimento e 20 tabuas para fazer 2 pilares");

  assert.match(answer, /CONFERENCIA INTELIGENTE DE RETIRADA/);
  assert.match(answer, /Composicao utilizada: SINAPI-RET-PILAR-001/);
  assert.match(answer, /Cimento: solicitado 10 saco, previsto 8 saco, diferenca 2 saco \| status: acima do previsto/);
  assert.match(answer, /Tabua: solicitado 20 un, previsto 16 un, diferenca 4 un \| status: acima do previsto/);
  assert.match(answer, /reduzir quantidade ou exigir justificativa/);
  assert.match(answer, /SINAPI oficial importado ou ORSE oficial importado/);
});

test("Stock AI Obras conferencia de retirada marca pedido abaixo do previsto", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialWithdrawalRowsFixture() });
  const answer = engine.buildAnswerFromMessage("Pedreiro pediu 8 sacos de argamassa colante AC3 para assentar 10 m2 de piso");

  assert.match(answer, /argamassa colante AC3: solicitado 8 saco, previsto 10 saco, diferenca -2 saco \| status: abaixo do previsto/);
  assert.match(answer, /recomendacao: aumentar quantidade/);
  assert.match(answer, /complementar 2 saco/);
});

test("Stock AI Obras conferencia de retirada marca pedido dentro do previsto", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialWithdrawalRowsFixture() });
  const answer = engine.buildAnswerFromMessage("Pedreiro pediu 8 sacos de cimento e 16 tabuas para fazer 2 pilares");

  assert.match(answer, /Cimento: solicitado 8 saco, previsto 8 saco, diferenca 0 saco \| status: dentro do previsto/);
  assert.match(answer, /Tabua: solicitado 16 un, previsto 16 un, diferenca 0 un \| status: dentro do previsto/);
  assert.match(answer, /recomendacao: liberar/);
});

test("Stock AI Obras conferencia de retirada marca item nao previsto na composicao", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialWithdrawalRowsFixture() });
  const answer = engine.buildAnswerFromMessage("Pedreiro pediu 8 sacos de cimento e 2 kg de prego para fazer 2 pilares");

  assert.match(answer, /Prego: solicitado 2 kg, previsto 0 kg, diferenca 2 kg \| status: item nao previsto na composicao/);
  assert.match(answer, /exigir justificativa/);
});

test("Stock AI Obras conferencia de retirada pede complemento quando falta quantitativo suficiente", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialWithdrawalRowsFixture() });
  const answer = engine.buildAnswerFromMessage("Pedreiro pediu 10 sacos de cimento para fazer pilares");

  assert.match(answer, /CONFERENCIA INTELIGENTE DE RETIRADA/);
  assert.match(answer, /PERGUNTAS COMPLEMENTARES/);
  assert.match(answer, /Quantos pilares serao executados e qual a altura\?|Informe o quantitativo do servico/);
  assert.match(answer, /Nenhum coeficiente foi inventado/);
});

test("Stock AI Obras conferencia de retirada preserva fallback demonstrativo com aviso", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const answer = engine.buildAnswerFromMessage("Pedreiro pediu 12 m2 de piso ceramico para assentar 10 m2 de piso");

  assert.match(answer, /CONFERENCIA INTELIGENTE DE RETIRADA/);
  assert.match(answer, /Fonte: Base tecnica demonstrativa/);
  assert.match(answer, /Piso ceramico: solicitado 12 m(?:2|²), previsto 10,815 m(?:2|²), diferenca 1,185 m(?:2|²) \| status: acima do previsto/);
  assert.match(answer, /Composi[cç][aã]o demonstrativa/);
});

test("Stock AI Obras rejeita parede com medida zero", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const answer = engine.buildAnswerFromMessage("parede 0 x 3");

  assert.match(answer, /PERGUNTAS COMPLEMENTARES|QUANTITATIVO INVALIDO/);
  assert.match(answer, /maiores que zero|Geometria incompleta ou invalida/);
  assert.doesNotMatch(answer, /CONSUMO PREVISTO/);
});

test("Stock AI Obras rejeita parede com medida negativa sem transformar em positiva", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const answer = engine.buildAnswerFromMessage("parede -10 x 3");

  assert.match(answer, /PERGUNTAS COMPLEMENTARES|QUANTITATIVO INVALIDO/);
  assert.match(answer, /maiores que zero|Geometria incompleta ou invalida/);
  assert.doesNotMatch(answer, /30 m2|30 m²/);
  assert.doesNotMatch(answer, /CONSUMO PREVISTO/);
});

test("Stock AI Obras pede correcao para geometria malformada sem sugerir composicao aleatoria", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialBaseCodigo97141Fixture() });
  const answer = engine.buildAnswerFromMessage("parede abc x 3");

  assert.match(answer, /PERGUNTAS COMPLEMENTARES/);
  assert.match(answer, /Geometria incompleta ou invalida/);
  assert.doesNotMatch(answer, /97141/);
  assert.doesNotMatch(answer, /COMPOSICOES SINAPI\/ORSE SUGERIDAS/);
});

test("Stock AI Obras rejeita quantidade negativa em consulta por codigo SINAPI", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialBaseCodigo97141Fixture() });
  const answer = engine.buildAnswerFromMessage("calcule -10 m da composicao SINAPI 97141");

  assert.match(answer, /QUANTITATIVO INVALIDO/);
  assert.match(answer, /maior que zero/);
  assert.doesNotMatch(answer, /quantidade: 10,5 m/);
});

test("Stock AI Obras reconhece estoque no formato material quantidade unidade", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialBaseCodigo97141Fixture() });
  const answer = engine.buildAnswerFromMessage("calcule 10 m da composicao SINAPI 97141\n\nestoque:\ncimento 999999 sacos");

  assert.match(answer, /ESTOQUE X PREVISTO/);
  assert.doesNotMatch(answer, /Nenhum estoque informado na mensagem/);
});

test("Stock AI Obras aceita estoque zero como saldo valido", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialBaseCodigo97141Fixture() });
  const answer = engine.buildAnswerFromMessage("calcule 10 m da composicao SINAPI 97141\n\nestoque:\ncimento 0 sacos");

  assert.match(answer, /ESTOQUE X PREVISTO/);
  assert.doesNotMatch(answer, /ESTOQUE INVALIDO/);
  assert.doesNotMatch(answer, /Nenhum estoque informado na mensagem/);
});

test("Stock AI Obras sinaliza estoque negativo como invalido", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialBaseCodigo97141Fixture() });
  const answer = engine.buildAnswerFromMessage("calcule 10 m da composicao SINAPI 97141\n\nestoque:\ncimento -5 sacos");

  assert.match(answer, /ESTOQUE INVALIDO/);
  assert.match(answer, /Cimento: -5 saco/);
  assert.doesNotMatch(answer, /INSUMOS COM QUANTIDADE CALCULADA/);
});

test("Stock AI Obras rejeita retirada com quantidade negativa", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialWithdrawalRowsFixture() });
  const answer = engine.buildAnswerFromMessage("Pedreiro pediu -5 sacos de cimento para fazer 2 pilares");

  assert.match(answer, /RETIRADA INVALIDA/);
  assert.match(answer, /Quantidade zero ou negativa nao e valida para retirada/);
  assert.doesNotMatch(answer, /recomendacao: aumentar quantidade/);
  assert.doesNotMatch(answer, /status: abaixo do previsto/);
});

test("Stock AI Obras catalogo controlado identifica coluna como pilar", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const service = engine.findControlledServiceByText("coluna de concreto");

  assert.equal(service.id, "pilar");
  assert.equal(service.categoria, "estrutura");
  assert.equal(service.nivelRisco, "alto");
});

test("Stock AI Obras catalogo controlado identifica parede como alvenaria", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const service = engine.findControlledServiceByText("parede de bloco");

  assert.equal(service.id, "alvenaria");
  assert.equal(service.unidadePrincipal, "m2");
});

test("Stock AI Obras catalogo controlado identifica assentar piso como piso ceramico", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const service = engine.findControlledServiceByText("assentar piso na cozinha");

  assert.equal(service.id, "piso_ceramico");
});

test("Stock AI Obras catalogo controlado identifica reboco como reboco emboco", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const service = engine.findControlledServiceByText("reboco da parede");

  assert.equal(service.id, "reboco_emboco");
});

test("Stock AI Obras catalogo controlado identifica telhado como cobertura", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const service = engine.findControlledServiceByText("telhado ceramico");

  assert.equal(service.id, "cobertura");
  assert.deepEqual(Array.from(engine.getControlledServiceSearchPriority("cobertura")), ["SINAPI", "ORSE", "DEMO"]);
});

test("Stock AI Obras catalogo controlado retorna dados necessarios quando faltam informacoes", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const required = engine.getControlledServiceRequiredData("pilar");
  const incomplete = engine.isControlledServiceInputIncomplete(
    engine.getControlledServiceById("pilar"),
    { originalMessage: "coluna de concreto", quantity: 0 }
  );

  assert.deepEqual(Array.from(required), ["quantidade", "secao", "altura"]);
  assert.equal(incomplete, true);
});

test("Stock AI Obras nao sugere composicao aleatoria quando servico controlado esta incompleto", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialBaseCodigo97141Fixture() });
  const answer = engine.buildAnswerFromMessage("telhado");

  assert.match(answer, /PERGUNTAS COMPLEMENTARES/);
  assert.match(answer, /Servico controlado identificado: Cobertura/);
  assert.doesNotMatch(answer, /97141/);
  assert.doesNotMatch(answer, /COMPOSICOES SINAPI\/ORSE SUGERIDAS/);
});

test("Stock AI Obras preserva fallback demonstrativo quando nao ha servico controlado", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const answer = engine.buildAnswerFromMessage("Vou executar 10 m2 de impermeabilizacao simples");

  assert.match(answer, /Composicao utilizada: std_impermeabilizacao_simples/);
  assert.match(answer, /Fonte: Base tecnica demonstrativa/);
});

test("Stock AI Obras SINAPI Analitico importado tem prioridade sobre demonstrativa", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importSinapiAnaliticoXlsx(sinapiAnaliticoWorkbookFixture(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12"
  });

  const composition = engine.findBestComposition({ service: "Alvenaria analitica fixture", unit: "m2" });

  assert.equal(composition.code, "SINAPI-ANA-001");
  assert.equal(composition.source, "SINAPI");
});

test("Stock AI Obras clear apos SINAPI Analitico restaura fallback", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importSinapiAnaliticoXlsx(sinapiAnaliticoWorkbookFixture(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12"
  });
  engine.clearImportedOfficialBase();

  const fallback = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });

  assert.notEqual(fallback.code, "SINAPI-ANA-001");
  assert.match(engine.normalize(fallback.source), /base tecnica demonstrativa editavel/);
});

test("Stock AI Obras rejeita XLSX sem cabecalho SINAPI Analitico", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const parsed = engine.parseSinapiAnaliticoXlsx(officialBaseXlsxSimpleWorkbook(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12"
  });

  assert.equal(parsed.ok, false);
  assert.match(parsed.errors.join(" "), /cabecalho SINAPI Analitico|sem cabecalho/i);
});

test("Stock AI Obras SINAPI Analitico detectado com erro nao retorna erro generico XLSX", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  const rows = sinapiAnaliticoRowsFixture().map((row) => row.slice());
  rows[6][7] = "0";
  const parsed = engine.parseSinapiAnaliticoXlsx(officialBaseWorkbook([{
    name: "Analitico",
    rows
  }]), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12"
  });
  const errors = parsed.errors.join(" ");

  assert.equal(parsed.ok, false);
  assert.equal(parsed.detected, true);
  assert.match(errors, /Formato SINAPI Analitico detectado/);
  assert.doesNotMatch(errors, /XLSX sem cabecalho valido|XLSX sem colunas minimas/i);
});

test("Stock AI Obras importacao SINAPI Analitico invalida nao apaga base anterior", () => {
  const engine = loadStockAiCompositionEngineWithXlsx();
  engine.importOfficialBase({ rows: officialBaseRowsFixture() });
  const invalid = engine.importSinapiAnaliticoXlsx(officialBaseXlsxSimpleWorkbook(), {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2024-12"
  });
  const stats = engine.getImportedOfficialBaseStats();

  assert.equal(invalid.ok, false);
  assert.equal(stats.totalCompositions, 1);
});

test("Stock AI Obras documenta adaptador SINAPI Analitico", () => {
  assert.equal(existsSync(sinapiAnaliticoGuidePath), true);

  const guide = readFileSync(sinapiAnaliticoGuidePath, "utf8");

  assert.match(guide, /SINAPI_Custo_Ref_Composicoes_Analitico_BA_202412_Desonerado\.xlsx/);
  assert.match(guide, /CODIGO DA COMPOSICAO/);
  assert.match(guide, /INSUMO/);
  assert.match(guide, /COMPOSICAO/);
  assert.match(guide, /interface/i);
});

test("Stock AI Obras frontend carrega XLSX global para navegador", () => {
  assert.equal(existsSync(stockAiBrowserXlsxPath), true);

  const sandbox = {
    window: {},
    console,
    setTimeout,
    clearTimeout
  };
  sandbox.self = sandbox.window;
  sandbox.global = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(stockAiBrowserXlsxPath, "utf8"), sandbox);
  if (sandbox.XLSX && !sandbox.window.XLSX) {
    sandbox.window.XLSX = sandbox.XLSX;
  }

  assert.equal(!!sandbox.window.XLSX, true);
  assert.equal(typeof sandbox.window.XLSX.read, "function");
  assert.equal(typeof sandbox.window.XLSX.utils.sheet_to_json, "function");
});

test("Stock AI Obras frontend XLSX permite parse SINAPI Analitico no motor", () => {
  const source = readFileSync(join(testDir, "..", "..", "relatorio-qualidade-obras", "stock-ai-composition-engine.js"), "utf8");
  const sandbox = {
    window: {},
    console,
    setTimeout,
    clearTimeout
  };
  sandbox.self = sandbox.window;
  sandbox.global = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(stockAiBrowserXlsxPath, "utf8"), sandbox);
  if (sandbox.XLSX && !sandbox.window.XLSX) {
    sandbox.window.XLSX = sandbox.XLSX;
  }
  vm.runInContext(source, sandbox);

  const workbook = sandbox.window.XLSX.utils.book_new();
  sandbox.window.XLSX.utils.book_append_sheet(workbook, sandbox.window.XLSX.utils.aoa_to_sheet(sinapiAnaliticoRowsFixture()), "Analitico");
  const bytes = sandbox.window.XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const parsed = sandbox.window.StockAiCompositionEngine.parseSinapiAnaliticoXlsx(new Uint8Array(bytes), {
    source: "SINAPI",
    state: "BA"
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.format, "SINAPI_ANALITICO");
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.referenceMonth, "2024-12");
});
