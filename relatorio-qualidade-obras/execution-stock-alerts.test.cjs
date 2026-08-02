const assert = require("node:assert/strict");
const test = require("node:test");

const analysisPromise = import("./execution-stock-analysis.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseAnalysis(overrides = {}) {
  return Object.assign({
    version: 1,
    status: "ready",
    workId: "obra-a",
    sourceRdoId: "rdo-1",
    sourceRdoUpdatedAt: "2026-08-02T10:00:00.000Z",
    calculatedAt: "2026-08-02T10:01:00.000Z",
    sourceFingerprint: "fp-1",
    alerts: [{ material: "Bloco", status: "consumption_above_expected", difference: 10 }],
    result: {
      materials: [{ material: "Bloco", expectedConsumption: 250, actualStockExit: 260, difference: 10, status: "consumption_above_expected" }],
      alerts: [{ material: "Bloco", status: "consumption_above_expected", difference: 10 }]
    },
    summary: { workId: "obra-a", alerts: 1 },
    missingInputs: []
  }, overrides);
}

async function persist(state, analysis, options = {}) {
  const mod = await analysisPromise;
  return mod.persistExecutionStockAlerts(state, analysis, Object.assign({ now: () => "2026-08-02T12:00:00.000Z" }, options));
}

test("analise ready cria alerta persistente no contrato local", async () => {
  const state = { version: 1, dailyLogs: [{ id: "rdo-1" }], stockMovements: [{ id: "m-1" }] };
  const result = await persist(state, baseAnalysis());

  assert.equal(result.created, 1);
  assert.equal(state.executionStockAlerts.length, 1);
  assert.deepEqual(Object.keys(state.executionStockAlerts[0]), [
    "id", "version", "workId", "sourceRdoId", "sourceRdoUpdatedAt", "sourceFingerprint", "type", "severity",
    "title", "summary", "recommendation", "serviceCode", "serviceName", "materialCode", "materialName",
    "expectedQuantity", "actualQuantity", "differenceQuantity", "differencePercent", "status", "createdAt", "updatedAt", "resolvedAt"
  ]);
  assert.equal(state.executionStockAlerts[0].workId, "obra-a");
  assert.equal(state.executionStockAlerts[0].sourceRdoId, "rdo-1");
  assert.equal(state.executionStockAlerts[0].materialName, "Bloco");
  assert.equal(state.executionStockAlerts[0].expectedQuantity, 250);
  assert.equal(state.executionStockAlerts[0].actualQuantity, 260);
  assert.equal(state.executionStockAlerts[0].differencePercent, 4);
});

test("mesma analise nao duplica", async () => {
  const state = { version: 1 };
  await persist(state, baseAnalysis());
  const firstId = state.executionStockAlerts[0].id;
  const second = await persist(state, baseAnalysis(), { now: () => "2026-08-02T13:00:00.000Z" });

  assert.equal(state.executionStockAlerts.length, 1);
  assert.equal(state.executionStockAlerts[0].id, firstId);
  assert.equal(second.updated, 1);
});

test("reload nao duplica alerta persistido", async () => {
  const state = { version: 1 };
  await persist(state, baseAnalysis());
  const reloaded = JSON.parse(JSON.stringify(state));
  await persist(reloaded, baseAnalysis());

  assert.equal(reloaded.executionStockAlerts.length, 1);
  assert.equal(reloaded.executionStockAlerts[0].id, state.executionStockAlerts[0].id);
});

test("fingerprint novo atualiza a mesma ocorrencia", async () => {
  const state = { version: 1 };
  await persist(state, baseAnalysis());
  const firstCreatedAt = state.executionStockAlerts[0].createdAt;
  await persist(state, baseAnalysis({ sourceFingerprint: "fp-2", alerts: [{ material: "Bloco", status: "consumption_above_expected", difference: 20 }], result: { materials: [{ material: "Bloco", expectedConsumption: 250, actualStockExit: 270, difference: 20, status: "consumption_above_expected" }] } }), { now: () => "2026-08-02T14:00:00.000Z" });

  assert.equal(state.executionStockAlerts.length, 1);
  assert.equal(state.executionStockAlerts[0].sourceFingerprint, "fp-2");
  assert.equal(state.executionStockAlerts[0].differenceQuantity, 20);
  assert.equal(state.executionStockAlerts[0].createdAt, firstCreatedAt);
  assert.equal(state.executionStockAlerts[0].updatedAt, "2026-08-02T14:00:00.000Z");
});

test("duas obras nao compartilham alertas", async () => {
  const state = { version: 1 };
  await persist(state, baseAnalysis());
  await persist(state, baseAnalysis({ workId: "obra-b", sourceRdoId: "rdo-b", sourceFingerprint: "fp-b" }));

  assert.equal(state.executionStockAlerts.length, 2);
  assert.deepEqual(state.executionStockAlerts.map((item) => item.workId).sort(), ["obra-a", "obra-b"]);
});

test("dois RDOs diferentes ficam separados", async () => {
  const state = { version: 1 };
  await persist(state, baseAnalysis());
  await persist(state, baseAnalysis({ sourceRdoId: "rdo-2", sourceFingerprint: "fp-rdo-2" }));

  assert.equal(state.executionStockAlerts.length, 2);
  assert.deepEqual(state.executionStockAlerts.map((item) => item.sourceRdoId).sort(), ["rdo-1", "rdo-2"]);
});

test("insufficient_data nao cria alerta", async () => {
  const state = { version: 1 };
  await persist(state, baseAnalysis({ status: "insufficient_data", missingInputs: ["stockMovements"], alerts: [] }));
  assert.deepEqual(state.executionStockAlerts, []);
});

test("error nao cria alerta", async () => {
  const state = { version: 1 };
  await persist(state, baseAnalysis({ status: "error", alerts: [] }));
  assert.deepEqual(state.executionStockAlerts, []);
});

test("resultado sem alertas nao inventa ocorrencia", async () => {
  const state = { version: 1 };
  const result = await persist(state, baseAnalysis({ alerts: [], result: { materials: [] }, summary: { workId: "obra-a", alerts: 0 } }));

  assert.equal(result.created, 0);
  assert.deepEqual(state.executionStockAlerts, []);
});

test("alerta resolvido nao volta automaticamente para open", async () => {
  const state = { version: 1 };
  await persist(state, baseAnalysis());
  state.executionStockAlerts[0].status = "resolved";
  state.executionStockAlerts[0].resolvedAt = "2026-08-02T12:30:00.000Z";
  await persist(state, baseAnalysis({ sourceFingerprint: "fp-2" }));

  assert.equal(state.executionStockAlerts[0].status, "resolved");
  assert.equal(state.executionStockAlerts[0].resolvedAt, "2026-08-02T12:30:00.000Z");
});

test("alerta removido do novo resultado vira obsolete", async () => {
  const state = { version: 1 };
  await persist(state, baseAnalysis({
    alerts: [
      { material: "Bloco", status: "consumption_above_expected", difference: 10 },
      { material: "Cimento", status: "missing_reference", difference: null }
    ],
    result: { materials: [
      { material: "Bloco", expectedConsumption: 250, actualStockExit: 260, difference: 10, status: "consumption_above_expected" },
      { material: "Cimento", expectedConsumption: 0, actualStockExit: 4, difference: 4, status: "missing_reference" }
    ] }
  }));
  await persist(state, baseAnalysis({ sourceFingerprint: "fp-2" }));

  assert.equal(state.executionStockAlerts.length, 2);
  assert.equal(state.executionStockAlerts.find((item) => item.materialName === "Cimento").status, "obsolete");
  assert.equal(state.executionStockAlerts.find((item) => item.materialName === "Bloco").status, "open");
});

test("estoque e movimentos permanecem identicos", async () => {
  const state = { version: 1, stockMovements: [{ id: "mov-1", quantity: 2 }], stockBalances: [{ id: "bal-1", balance: 5 }] };
  const before = clone({ stockMovements: state.stockMovements, stockBalances: state.stockBalances });
  await persist(state, baseAnalysis());

  assert.deepEqual({ stockMovements: state.stockMovements, stockBalances: state.stockBalances }, before);
});

test("RDO nao e alterado", async () => {
  const rdo = { id: "rdo-1", workId: "obra-a", materials: [{ name: "Bloco", quantity: 260 }] };
  const state = { version: 1, dailyLogs: [clone(rdo)] };
  await persist(state, baseAnalysis());

  assert.deepEqual(state.dailyLogs, [rdo]);
});

test("nenhuma rede e chamada", async () => {
  const previousFetch = global.fetch;
  let calls = 0;
  global.fetch = function () { calls += 1; throw new Error("network_forbidden"); };
  try {
    await persist({ version: 1 }, baseAnalysis());
    assert.equal(calls, 0);
  } finally {
    global.fetch = previousFetch;
  }
});

test("dados antigos continuam compativeis", async () => {
  const state = { version: 1, dailyLogs: [] };
  await persist(state, baseAnalysis());

  assert.equal(Array.isArray(state.executionStockAlerts), true);
  assert.equal(state.executionStockAlerts.length, 1);
});

test("limite de historico nao remove alertas abertos", async () => {
  const state = { version: 1, executionStockAlerts: [] };
  for (let index = 0; index < 505; index += 1) {
    state.executionStockAlerts.push({
      id: "old-" + index,
      version: 1,
      workId: "obra-z",
      sourceRdoId: "rdo-old-" + index,
      sourceFingerprint: "old-fp-" + index,
      type: "missing_reference",
      serviceCode: null,
      serviceName: null,
      materialCode: null,
      materialName: "Material " + index,
      status: index < 3 ? "open" : "obsolete",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      resolvedAt: null
    });
  }
  await persist(state, baseAnalysis(), { maxAlerts: 500 });

  assert.equal(state.executionStockAlerts.length, 500);
  assert.equal(state.executionStockAlerts.filter((item) => item.status === "open" && item.workId === "obra-z").length, 3);
});
