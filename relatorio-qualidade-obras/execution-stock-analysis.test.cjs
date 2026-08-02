const assert = require("node:assert/strict");
const test = require("node:test");

const analysisPromise = import("./execution-stock-analysis.js");
const snapshotPromise = import("./elo-stock-obras-snapshot.js");
const crossPromise = import("./elo-execution-stock-cross.js");

function createStorage() {
  return {
    reads: 0,
    writes: 0,
    getItem() {
      this.reads += 1;
      return null;
    },
    setItem() {
      this.writes += 1;
      throw new Error("network_or_storage_write_not_allowed");
    },
    removeItem() {
      this.writes += 1;
      throw new Error("network_or_storage_write_not_allowed");
    }
  };
}

function baseRdo(overrides = {}) {
  return Object.assign({
    id: "rdo-1",
    workId: "obra-a",
    updatedAt: "2026-08-02T10:00:00.000Z",
    productions: [{ id: "prod-1", serviceId: "alvenaria", service: "Alvenaria", quantity: 10, unit: "m2" }],
    materials: [{ id: "mat-1", name: "Bloco", unit: "un", quantity: 260 }]
  }, overrides);
}

function baseState(rdo = baseRdo()) {
  return {
    version: 1,
    dailyLogs: [rdo],
    stockIa: {
      plannedConsumptions: [
        { workId: "obra-a", serviceId: "alvenaria", material: "Bloco", unit: "un", coefficient: 25 }
      ]
    }
  };
}

async function realDeps(extra = {}) {
  const { buildEloStockObrasSnapshot } = await snapshotPromise;
  const { crossExecutionWithStock } = await crossPromise;
  return Object.assign({
    snapshotBuilder: buildEloStockObrasSnapshot,
    crossBuilder: crossExecutionWithStock,
    localStorage: createStorage(),
    operationalStock: {
      getAlmoxBalances() {
        return [{ workId: "obra-a", item: { name: "Bloco", unit: "un" }, balance: 100 }];
      },
      createConfirmedExit() {
        throw new Error("stock_exit_must_not_be_created");
      }
    },
    now() {
      return "2026-08-02T12:00:00.000Z";
    }
  }, extra);
}

async function run(state, rdo, deps) {
  const { refreshExecutionStockAnalysisAfterRdoSave } = await analysisPromise;
  return refreshExecutionStockAnalysisAfterRdoSave(state, rdo, deps || await realDeps());
}

test("salvar RDO continua preservado sem modulo de analise", async () => {
  const rdo = baseRdo();
  const state = { version: 1, dailyLogs: [rdo] };
  const result = await run(state, rdo, { now: () => "2026-08-02T12:00:00.000Z" });

  assert.equal(state.dailyLogs.length, 1);
  assert.equal(state.dailyLogs[0].id, "rdo-1");
  assert.equal(result.analysis.status, "error");
});

test("RDO com dados completos executa snapshot e cross", async () => {
  const rdo = baseRdo();
  const state = baseState(rdo);
  const result = await run(state, rdo);

  assert.equal(result.analysis.status, "ready");
  assert.equal(result.analysis.result.summary.workId, "obra-a");
  assert.equal(result.analysis.result.materials.length, 1);
});

test("resultado ready e armazenado em executionStockAnalysis", async () => {
  const rdo = baseRdo();
  const state = baseState(rdo);
  await run(state, rdo);

  assert.equal(state.executionStockAnalysis.status, "ready");
  assert.equal(state.executionStockAnalysis.sourceRdoId, "rdo-1");
  assert.equal(state.executionStockAnalysis.alerts.length, 1);
});

test("falta de producao gera insufficient_data", async () => {
  const rdo = baseRdo({ productions: [] });
  const state = baseState(rdo);
  const result = await run(state, rdo);

  assert.equal(result.analysis.status, "insufficient_data");
  assert.deepEqual(result.analysis.missingInputs, ["productions"]);
});

test("falta de consumo esperado gera insufficient_data", async () => {
  const rdo = baseRdo();
  const state = baseState(rdo);
  state.stockIa.plannedConsumptions = [];
  const result = await run(state, rdo);

  assert.equal(result.analysis.status, "insufficient_data");
  assert.ok(result.analysis.missingInputs.includes("plannedConsumptions"));
});

test("falta de estoque e movimentos nao gera alerta inventado", async () => {
  const rdo = baseRdo({ materials: [] });
  const state = baseState(rdo);
  const deps = await realDeps({ operationalStock: { getAlmoxBalances() { return []; } } });
  const result = await run(state, rdo, deps);

  assert.equal(result.analysis.status, "insufficient_data");
  assert.ok(result.analysis.missingInputs.includes("stockMovements"));
  assert.ok(result.analysis.missingInputs.includes("stockBalances"));
  assert.deepEqual(result.analysis.alerts, []);
});

test("erro no cross nao perde RDO", async () => {
  const rdo = baseRdo();
  const state = baseState(rdo);
  const deps = await realDeps({ crossBuilder() { throw new Error("cross_failed"); } });
  const result = await run(state, rdo, deps);

  assert.equal(state.dailyLogs[0].id, "rdo-1");
  assert.equal(result.analysis.status, "error");
});

test("fingerprint igual evita recalculo do cross", async () => {
  const rdo = baseRdo();
  const state = baseState(rdo);
  let calls = 0;
  const deps = await realDeps({ crossBuilder(input) { calls += 1; return { summary: { workId: input.workId }, materials: [], alerts: [], dataQuality: {} }; } });

  await run(state, rdo, deps);
  const second = await run(state, rdo, deps);

  assert.equal(calls, 1);
  assert.equal(second.skipped, true);
});

test("edicao do RDO recalcula", async () => {
  const rdo = baseRdo();
  const edited = baseRdo({ updatedAt: "2026-08-02T11:00:00.000Z" });
  const state = baseState(rdo);
  let calls = 0;
  const deps = await realDeps({ crossBuilder(input) { calls += 1; return { summary: { workId: input.workId }, materials: [], alerts: [], dataQuality: {} }; } });

  await run(state, rdo, deps);
  state.dailyLogs[0] = edited;
  await run(state, edited, deps);

  assert.equal(calls, 2);
  assert.equal(state.executionStockAnalysis.sourceRdoUpdatedAt, "2026-08-02T11:00:00.000Z");
});

test("obras diferentes nao compartilham resultado", async () => {
  const rdoA = baseRdo();
  const rdoB = baseRdo({ id: "rdo-2", workId: "obra-b", updatedAt: "2026-08-02T11:00:00.000Z" });
  const state = baseState(rdoA);
  state.dailyLogs.push(rdoB);
  const deps = await realDeps();

  await run(state, rdoA, deps);
  await run(state, rdoB, deps);

  assert.equal(state.executionStockAnalysis.workId, "obra-b");
  assert.equal(state.executionStockAnalysis.sourceRdoId, "rdo-2");
});

test("nenhuma movimentacao de estoque e criada", async () => {
  const rdo = baseRdo();
  const state = baseState(rdo);
  let exits = 0;
  const deps = await realDeps({ operationalStock: { getAlmoxBalances() { return [{ workId: "obra-a", item: { name: "Bloco", unit: "un" }, balance: 100 }]; }, createConfirmedExit() { exits += 1; } } });

  await run(state, rdo, deps);

  assert.equal(exits, 0);
});

test("nenhuma chamada de rede ocorre", async () => {
  const previousFetch = global.fetch;
  let calls = 0;
  global.fetch = function () { calls += 1; throw new Error("network_forbidden"); };
  try {
    const rdo = baseRdo();
    const state = baseState(rdo);
    await run(state, rdo);
    assert.equal(calls, 0);
  } finally {
    global.fetch = previousFetch;
  }
});

test("dados antigos sem analysis continuam compativeis", async () => {
  const rdo = baseRdo();
  const state = { version: 1, dailyLogs: [rdo] };
  const result = await run(state, rdo);

  assert.equal(state.dailyLogs[0].id, "rdo-1");
  assert.ok(["ready", "insufficient_data"].includes(result.analysis.status));
});
