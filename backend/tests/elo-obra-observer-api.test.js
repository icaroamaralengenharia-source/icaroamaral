import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";

function createReadonlyReaders(overrides = {}) {
  const calls = { reads: 0, writes: 0 };
  const readers = {
    async readBudget(context) {
      calls.reads += 1;
      return Object.hasOwn(overrides, "budget") ? overrides.budget : {
        plannedMaterials: [
          { projectId: "obra-a", name: "Cimento Portland", unit: "sc", plannedQuantity: 10 },
          { projectId: "obra-b", name: "Cimento Portland", unit: "sc", plannedQuantity: 50 }
        ]
      };
    },
    async readStockObras(context) {
      calls.reads += 1;
      return Object.hasOwn(overrides, "stockObras") ? overrides.stockObras : {
        balances: [
          { projectId: "obra-a", name: "Cimento Portland", unit: "sc", currentQuantity: 3 },
          { projectId: "obra-b", name: "Cimento Portland", unit: "sc", currentQuantity: 0 }
        ],
        movements: [
          { projectId: "obra-b", id: "mov-b", type: "saida", name: "Cimento Portland", unit: "sc", quantity: 20 }
        ]
      };
    },
    async readRdos(context) {
      calls.reads += 1;
      return Object.hasOwn(overrides, "rdos") ? overrides.rdos : [
        { projectId: "obra-a", id: "rdo-a", productions: [], materials: [] },
        { projectId: "obra-b", id: "rdo-b", materials: [{ name: "Cimento Portland", unit: "sc", quantity: 99 }] }
      ];
    },
    async writeAnything() {
      calls.writes += 1;
      throw new Error("write_not_allowed");
    }
  };
  return { readers, calls };
}

async function withServer(readers, callback) {
  const app = createApp({ eloObraObserverReaders: readers });
  app.locals.resolveAuthContext = async (request) => {
    const authorization = String(request.headers.authorization || "");
    if (authorization !== "Bearer valid-token") return { ok: false, status: 401, error: "invalid_session" };
    return {
      ok: true,
      userId: "user-a",
      institutionId: "inst-a",
      profile: { id: "profile-a", institution_id: "inst-a", role: "gestor" }
    };
  };
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  try {
    await callback("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function getJson(base, query = "projectId=obra-a", headers = { Authorization: "Bearer valid-token" }) {
  const response = await fetch(base + "/api/elo/obra/attention" + (query ? "?" + query : ""), { headers });
  return { response, data: await response.json() };
}

test("GET /api/elo/obra/attention exige Bearer", async () => {
  const { readers } = createReadonlyReaders();
  await withServer(readers, async (base) => {
    const result = await getJson(base, "projectId=obra-a", {});
    assert.equal(result.response.status, 401);
    assert.equal(result.data.error, "authentication_required");
  });
});

test("GET /api/elo/obra/attention isola obra A de obra B e retorna alerta de falta", async () => {
  const { readers, calls } = createReadonlyReaders();
  await withServer(readers, async (base) => {
    const result = await getJson(base);
    assert.equal(result.response.status, 200);
    assert.equal(result.data.ok, true);
    assert.equal(result.data.sourcesUsed.budget, true);
    assert.equal(result.data.sourcesUsed.stockObras, true);
    assert.equal(result.data.sourcesUsed.rdos, true);
    assert.equal(result.data.alerts.length, 1);
    assert.equal(result.data.alerts[0].type, "material_shortage_risk");
    assert.equal(result.data.alerts[0].evidence.material, "Cimento Portland");
    assert.equal(result.data.alerts[0].impact.quantityGap, 7);
    assert.equal(result.data.summary.rdos, 1);
    assert.equal(calls.writes, 0);
  });
});

test("GET /api/elo/obra/attention responde 200 com baixa qualidade quando faltam dados", async () => {
  const { readers, calls } = createReadonlyReaders({
    budget: null,
    stockObras: null,
    rdos: []
  });
  await withServer(readers, async (base) => {
    const result = await getJson(base);
    assert.equal(result.response.status, 200);
    assert.equal(result.data.ok, true);
    assert.equal(result.data.dataQuality.level, "low");
    assert.deepEqual(result.data.dataQuality.missingSources, ["budget", "stockObras", "rdos"]);
    assert.equal(result.data.alerts.length, 0);
    assert.equal(calls.writes, 0);
  });
});