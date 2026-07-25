const assert = require("node:assert/strict");
const test = require("node:test");

const todayModulePromise = import("./elo-today-work-core.js");
const snapshotModulePromise = import("./elo-stock-obras-snapshot.js");
const crossModulePromise = import("./elo-execution-stock-cross.js");
const reportModulePromise = import("./elo-execution-stock-report.js");

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    writes: 0,
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { this.writes += 1; data.set(String(key), String(value)); },
    removeItem(key) { this.writes += 1; data.delete(String(key)); }
  };
}

function buildLocalStorage() {
  return {
    "obrareport-saas-v1": JSON.stringify({
      version: 1,
      local: { lastProjectId: "proj-a", lastWorkId: "obra-a-work" },
      dailyLogs: [
        {
          projectId: "proj-a",
          workId: "obra-a-work",
          productions: [{ serviceId: "alvenaria", service: "Alvenaria A", quantity: 100, unit: "m2" }],
          materials: [{ name: "Bloco A", unit: "un", quantity: 2600 }]
        },
        {
          projectId: "proj-b",
          workId: "obra-b-work",
          productions: [{ serviceId: "pintura", service: "Pintura B", quantity: 900, unit: "m2" }],
          materials: [{ name: "Tinta B", unit: "l", quantity: 9000 }]
        }
      ],
      stockIa: {
        plannedConsumptions: [
          { projectId: "proj-a", workId: "obra-a-work", serviceId: "alvenaria", material: "Bloco A", unit: "un", coefficient: 25 },
          { projectId: "proj-b", workId: "obra-b-work", serviceId: "pintura", material: "Tinta B", unit: "l", coefficient: 99 }
        ]
      }
    }),
    obraReportAlmoxarifadoData: JSON.stringify({ items: [
      { projectId: "proj-a", workId: "obra-a-work", name: "Bloco A", unit: "un", balance: 40 },
      { projectId: "proj-b", workId: "obra-b-work", name: "Tinta B", unit: "l", balance: 8000 }
    ] })
  };
}

async function buildExistingOutputs(storageSeed = buildLocalStorage()) {
  const { buildEloStockObrasSnapshot } = await snapshotModulePromise;
  const { crossExecutionWithStock } = await crossModulePromise;
  const { buildExecutionStockReport } = await reportModulePromise;
  const localStorage = createStorage(storageSeed);
  const snapshot = buildEloStockObrasSnapshot({
    projectId: "proj-a",
    workId: "obra-a-work",
    localStorage
  });
  const executionStockCross = crossExecutionWithStock(snapshot);
  const localReport = buildExecutionStockReport({ snapshot, cross: executionStockCross });
  return { localStorage, snapshot, executionStockCross, localReport };
}

test("Hoje na Obra prioriza motores existentes sem misturar obra B", async () => {
  const { buildTodayWorkCore } = await todayModulePromise;
  const existing = await buildExistingOutputs();

  const result = buildTodayWorkCore(existing);

  assert.equal(result.summary.totalPriorities, 1);
  assert.equal(result.priorities[0].type, "consumption_above_expected");
  assert.match(result.priorities[0].evidence, /esperado 2500 un; saida 2600 un; saldo 40 un/);
  assert.match(result.recommendedActions[0].action, /Abrir RDO/);
  assert.doesNotMatch(JSON.stringify(result), /Tinta B|9000|obra-b-work|proj-b/);
  assert.equal(existing.localStorage.writes, 0);
});

test("Hoje na Obra ordena no maximo 5 prioridades pelo contrato", async () => {
  const { buildTodayWorkCore } = await todayModulePromise;
  const result = buildTodayWorkCore({
    executionStockCross: {
      summary: { projectId: "proj-a", workId: "obra-a" },
      dataQuality: { hasProductions: true, hasStockMovements: true, hasStockBalances: true, hasSinapiExpectedConsumptions: true },
      materials: [
        { projectId: "proj-a", workId: "obra-a", material: "Saida sem producao", unit: "un", expectedConsumption: 0, actualStockExit: 4, currentBalance: 9, difference: 4, status: "stock_exit_without_production" },
        { projectId: "proj-a", workId: "obra-a", material: "Consumo alto", unit: "un", expectedConsumption: 10, actualStockExit: 12, currentBalance: 5, difference: 2, status: "consumption_above_expected" },
        { projectId: "proj-a", workId: "obra-a", material: "Falta", unit: "un", expectedConsumption: 10, actualStockExit: 10, currentBalance: -1, difference: 0, status: "insufficient_balance" },
        { projectId: "proj-a", workId: "obra-a", material: "Sem saida", unit: "un", expectedConsumption: 10, actualStockExit: 0, currentBalance: 20, difference: -10, status: "production_without_stock_exit" },
        { projectId: "proj-a", workId: "obra-a", material: "Referencia", unit: "un", expectedConsumption: 0, actualStockExit: 0, currentBalance: 20, difference: 0, status: "missing_reference" },
        { projectId: "proj-a", workId: "obra-a", material: "Extra", unit: "un", expectedConsumption: 0, actualStockExit: 2, currentBalance: 20, difference: 2, status: "stock_exit_without_production" }
      ]
    },
    rdo: { projectId: "proj-a", workId: "obra-a", pending: true }
  });

  assert.deepEqual(result.priorities.map((item) => item.type), [
    "shortage_risk",
    "consumption_above_expected",
    "production_without_stock_exit",
    "stock_exit_without_production",
    "stock_exit_without_production"
  ]);
  assert.equal(result.priorities.length, 5);
});

test("Hoje na Obra declara ausencia de dados sem inventar prioridade tecnica", async () => {
  const { buildTodayWorkCore } = await todayModulePromise;
  const existing = await buildExistingOutputs({});

  const result = buildTodayWorkCore(existing);

  assert.equal(result.dataQuality.level, "low");
  assert.deepEqual(result.dataQuality.missingSources, ["rdos", "stockMovements", "stockBalances", "plannedConsumptions"]);
  assert.deepEqual(result.priorities.map((item) => item.type), [
    "rdo_pending",
    "critical_missing_data",
    "critical_missing_data",
    "critical_missing_data"
  ]);
  assert.match(result.summary.text, /Hoje na obra/);
  assert.equal(existing.localStorage.writes, 0);
});

test("Hoje na Obra mantem recommendedActions coerentes por tipo", async () => {
  const { buildTodayWorkCore } = await todayModulePromise;
  const result = buildTodayWorkCore({
    executionStockCross: {
      summary: { projectId: "proj-a", workId: "obra-a" },
      dataQuality: { hasProductions: true, hasStockMovements: true, hasStockBalances: true, hasSinapiExpectedConsumptions: true },
      materials: [
        { projectId: "proj-a", workId: "obra-a", material: "Cimento", unit: "sc", expectedConsumption: 10, actualStockExit: 10, currentBalance: -1, difference: 0, status: "insufficient_balance" },
        { projectId: "proj-a", workId: "obra-a", material: "Bloco", unit: "un", expectedConsumption: 10, actualStockExit: 0, currentBalance: 20, difference: -10, status: "production_without_stock_exit" }
      ]
    }
  });

  assert.match(result.recommendedActions[0].action, /Abrir Almoxarifado/);
  assert.match(result.recommendedActions[1].action, /Abrir Almoxarifado/);
  assert.equal(result.alerts.length, 2);
});
