const assert = require("node:assert/strict");
const test = require("node:test");

const reportModulePromise = import("./elo-execution-stock-report.js");
const crossModulePromise = import("./elo-execution-stock-cross.js");

function fixtureSnapshot() {
  return {
    projectId: "proj-a",
    workId: "obra-a",
    workName: "Obra A",
    productions: [
      { projectId: "proj-a", workId: "obra-a", serviceId: "alvenaria", service: "Alvenaria", quantity: 100, unit: "m2", date: "2026-07-01" },
      { projectId: "proj-b", workId: "obra-b", serviceId: "alvenaria", service: "Alvenaria", quantity: 900, unit: "m2", date: "2026-07-01" }
    ],
    sinapiExpectedConsumptions: [
      { projectId: "proj-a", workId: "obra-a", serviceId: "alvenaria", material: "Bloco ceramico", unit: "un", coefficient: 25 },
      { projectId: "proj-a", workId: "obra-a", serviceId: "alvenaria", material: "Argamassa", unit: "kg", coefficient: 18 },
      { projectId: "proj-a", workId: "obra-a", serviceId: "alvenaria", material: "Tela", unit: "m", coefficient: 0.4 },
      { projectId: "proj-b", workId: "obra-b", serviceId: "alvenaria", material: "Bloco ceramico", unit: "un", coefficient: 99 }
    ],
    stockMovements: [
      { projectId: "proj-a", workId: "obra-a", type: "saida", material: "Bloco ceramico", unit: "un", quantity: 2600, date: "2026-07-02" },
      { projectId: "proj-a", workId: "obra-a", type: "saida", material: "Argamassa", unit: "kg", quantity: 900, date: "2026-07-02" },
      { projectId: "proj-a", workId: "obra-a", type: "saida", material: "Madeira", unit: "m2", quantity: 12, date: "2026-07-02" },
      { projectId: "proj-b", workId: "obra-b", type: "saida", material: "Bloco ceramico", unit: "un", quantity: 9000, date: "2026-07-02" }
    ],
    stockBalances: [
      { projectId: "proj-a", workId: "obra-a", item: { name: "Bloco ceramico", unit: "un" }, balance: 40 },
      { projectId: "proj-a", workId: "obra-a", item: { name: "Argamassa", unit: "kg" }, balance: -1 },
      { projectId: "proj-a", workId: "obra-a", item: { name: "Tela", unit: "m" }, balance: 5 },
      { projectId: "proj-a", workId: "obra-a", item: { name: "Madeira", unit: "m2" }, balance: -2 },
      { projectId: "proj-b", workId: "obra-b", item: { name: "Bloco ceramico", unit: "un" }, balance: 8000 }
    ],
    sourcesUsed: { rdos: true, stockMovements: true, stockBalances: true, plannedConsumptions: true },
    dataQuality: { level: "high", missingSources: [] }
  };
}

async function buildFixtureReport() {
  const { buildExecutionStockReport } = await reportModulePromise;
  const { crossExecutionWithStock } = await crossModulePromise;
  const snapshot = fixtureSnapshot();
  return buildExecutionStockReport({ snapshot, cross: crossExecutionWithStock(snapshot) });
}

test("relatorio completo com dados e obra A isolada da B", async () => {
  const result = await buildFixtureReport();
  assert.equal(result.ok, true);
  assert.equal(result.scope.workName, "Obra A");
  assert.equal(result.productions.length, 1);
  assert.equal(result.materials.some((item) => item.actualStockExit === 9000), false);
  assert.match(result.text, /Relatorio local de consumo e risco/);
});

test("diferenca percentual correta usa expectedConsumption como base", async () => {
  const result = await buildFixtureReport();
  const bloco = result.materials.find((item) => item.material === "Bloco ceramico");
  assert.equal(bloco.expectedConsumption, 2500);
  assert.equal(bloco.actualStockExit, 2600);
  assert.equal(bloco.difference, 100);
  assert.equal(bloco.differencePercent, 4);
});

test("alertas ordenados por gravidade", async () => {
  const result = await buildFixtureReport();
  assert.equal(result.prioritizedAlerts[0].status, "insufficient_balance");
  assert.equal(result.prioritizedAlerts.some((alert) => alert.status === "production_without_stock_exit"), true);
  assert.equal(result.prioritizedAlerts.some((alert) => alert.status === "consumption_above_expected"), true);
});

test("referencia ausente nao fabrica esperado nem percentual", async () => {
  const { buildExecutionStockReport } = await reportModulePromise;
  const { crossExecutionWithStock } = await crossModulePromise;
  const snapshot = {
    projectId: "proj-a",
    workId: "obra-a",
    productions: [{ projectId: "proj-a", workId: "obra-a", serviceId: "pintura", service: "Pintura", quantity: 30, unit: "m2" }],
    stockMovements: [],
    stockBalances: [{ projectId: "proj-a", workId: "obra-a", item: { name: "Tinta", unit: "l" }, balance: 18 }],
    sinapiExpectedConsumptions: [],
    sourcesUsed: { rdos: true, stockMovements: false, stockBalances: true, plannedConsumptions: false },
    dataQuality: { level: "low", missingSources: ["stockMovements", "plannedConsumptions"] }
  };
  const result = buildExecutionStockReport({ snapshot, cross: crossExecutionWithStock(snapshot) });
  const tinta = result.materials[0];
  assert.equal(tinta.expectedConsumption, 0);
  assert.equal(tinta.differencePercent, null);
  assert.equal(tinta.status, "missing_reference");
});

test("perfil vazio retorna ok false sem relatorio falso", async () => {
  const { buildExecutionStockReport } = await reportModulePromise;
  const result = buildExecutionStockReport({
    snapshot: { projectId: "proj-a", workId: "obra-a", productions: [], sourcesUsed: {}, dataQuality: { missingSources: ["rdos"] } },
    cross: { materials: [], alerts: [], dataQuality: { hasProductions: false } }
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "insufficient_local_data");
  assert.deepEqual(result.missingSources, ["rdos"]);
  assert.match(result.text, /nao ha dados locais suficientes/);
});

test("sem backend e sem escrita local", async () => {
  const { buildExecutionStockReport } = await reportModulePromise;
  const { crossExecutionWithStock } = await crossModulePromise;
  const snapshot = fixtureSnapshot();
  const storage = { writes: 0, setItem() { this.writes += 1; }, removeItem() { this.writes += 1; } };
  let fetchCalls = 0;
  globalThis.fetch = function () { fetchCalls += 1; };
  buildExecutionStockReport({ snapshot, cross: crossExecutionWithStock(snapshot), localStorage: storage });
  assert.equal(storage.writes, 0);
  assert.equal(fetchCalls, 0);
  delete globalThis.fetch;
});
