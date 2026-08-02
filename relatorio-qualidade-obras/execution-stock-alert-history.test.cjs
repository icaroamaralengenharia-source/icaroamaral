const assert = require("node:assert/strict");
const test = require("node:test");

const historyPromise = import("./execution-stock-alert-history.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildAlert(overrides = {}) {
  return Object.assign({
    id: "alert-open-critical",
    version: 1,
    workId: "obra-a",
    sourceRdoId: "rdo-a",
    type: "consumption_above_expected",
    title: "Consumo acima do esperado",
    severity: "critical",
    materialName: "Bloco ceramico",
    serviceName: "Alvenaria",
    expectedQuantity: 10,
    actualQuantity: 16,
    differenceQuantity: 6,
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    status: "open",
    resolvedAt: null
  }, overrides);
}

function buildState(alerts) {
  return {
    dailyLogs: [
      { id: "rdo-a", workId: "obra-a", updatedAt: "2026-08-01T09:00:00.000Z", materials: [{ id: "mat-rdo", name: "Bloco ceramico", quantity: 16 }] },
      { id: "rdo-b", workId: "obra-b", updatedAt: "2026-08-01T09:00:00.000Z", materials: [{ id: "mat-rdo-b", name: "Cimento", quantity: 3 }] }
    ],
    stock: {
      items: [{ id: "stock-a", name: "Bloco ceramico", currentQuantity: 100 }],
      movements: [{ id: "mov-a", itemId: "stock-a", quantity: 20 }]
    },
    executionStockAlerts: alerts
  };
}

test("historico lista apenas alertas validos da obra ativa", async () => {
  const history = await historyPromise;
  const state = buildState([
    buildAlert(),
    buildAlert({ id: "other-work", workId: "obra-b", sourceRdoId: "rdo-b", materialName: "Cimento" }),
    buildAlert({ id: "missing-rdo", sourceRdoId: "missing" })
  ]);

  const alerts = history.getAlertsForWork(state, "obra-a");

  assert.deepEqual(alerts.map((alert) => alert.id), ["alert-open-critical"]);
});

test("historico ordena por status gravidade e data", async () => {
  const history = await historyPromise;
  const state = buildState([
    buildAlert({ id: "resolved-critical", status: "resolved", severity: "critical", updatedAt: "2026-08-02T09:00:00.000Z" }),
    buildAlert({ id: "open-low-new", severity: "low", updatedAt: "2026-08-02T10:00:00.000Z" }),
    buildAlert({ id: "ack-critical", status: "acknowledged", severity: "critical", updatedAt: "2026-08-02T08:00:00.000Z" }),
    buildAlert({ id: "open-critical-old", severity: "critical", updatedAt: "2026-08-01T07:00:00.000Z" }),
    buildAlert({ id: "obsolete-critical", status: "obsolete", severity: "critical", updatedAt: "2026-08-03T09:00:00.000Z" })
  ]);

  const ids = history.getAlertsForWork(state, "obra-a").map((alert) => alert.id);

  assert.deepEqual(ids, ["open-critical-old", "open-low-new", "ack-critical", "resolved-critical", "obsolete-critical"]);
});

test("filtros locais de status e gravidade funcionam", async () => {
  const history = await historyPromise;
  const alerts = [
    buildAlert({ id: "open-critical", status: "open", severity: "critical" }),
    buildAlert({ id: "ack-high", status: "acknowledged", severity: "high" }),
    buildAlert({ id: "resolved-low", status: "resolved", severity: "low" })
  ];

  assert.deepEqual(history.filterAlerts(alerts, { status: "acknowledged", severity: "all" }).map((alert) => alert.id), ["ack-high"]);
  assert.deepEqual(history.filterAlerts(alerts, { status: "all", severity: "low" }).map((alert) => alert.id), ["resolved-low"]);
});

test("acoes locais alteram apenas o status do alerta", async () => {
  const history = await historyPromise;
  const state = buildState([buildAlert()]);
  const beforeRdo = JSON.stringify(state.dailyLogs);
  const beforeStock = JSON.stringify(state.stock);

  const result = history.updateAlertStatus(state, "alert-open-critical", "acknowledged", { workId: "obra-a", now: "2026-08-02T10:00:00.000Z" });

  assert.equal(result.ok, true);
  assert.equal(state.executionStockAlerts[0].status, "acknowledged");
  assert.equal(state.executionStockAlerts[0].resolvedAt, null);
  assert.equal(state.executionStockAlerts[0].updatedAt, "2026-08-02T10:00:00.000Z");
  assert.equal(JSON.stringify(state.dailyLogs), beforeRdo);
  assert.equal(JSON.stringify(state.stock), beforeStock);
});

test("resolver preenche resolvedAt e reabrir limpa resolvedAt", async () => {
  const history = await historyPromise;
  const state = buildState([buildAlert()]);

  assert.equal(history.updateAlertStatus(state, "alert-open-critical", "resolved", { workId: "obra-a", now: "2026-08-02T11:00:00.000Z" }).ok, true);
  assert.equal(state.executionStockAlerts[0].status, "resolved");
  assert.equal(state.executionStockAlerts[0].resolvedAt, "2026-08-02T11:00:00.000Z");

  assert.equal(history.updateAlertStatus(state, "alert-open-critical", "open", { workId: "obra-a", now: "2026-08-02T12:00:00.000Z" }).ok, true);
  assert.equal(state.executionStockAlerts[0].status, "open");
  assert.equal(state.executionStockAlerts[0].resolvedAt, null);
});

test("obsoleto nao reabre automaticamente e status sobrevive ao reload", async () => {
  const history = await historyPromise;
  const state = buildState([buildAlert({ status: "obsolete", resolvedAt: null })]);

  const result = history.updateAlertStatus(state, "alert-open-critical", "open", { workId: "obra-a" });
  const reloaded = clone(state);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "obsolete_locked");
  assert.equal(history.getAlertsForWork(reloaded, "obra-a")[0].status, "obsolete");
});

test("colecao antiga ou ausente nao quebra e nao chama rede", async () => {
  const history = await historyPromise;
  let fetchCalls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = function () {
    fetchCalls += 1;
    throw new Error("network_forbidden");
  };

  try {
    assert.deepEqual(history.getAlertsForWork({ dailyLogs: [] }, "obra-a"), []);
    assert.deepEqual(history.filterAlerts(null, { status: "all" }), []);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
