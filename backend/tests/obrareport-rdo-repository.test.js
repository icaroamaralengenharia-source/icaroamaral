import assert from "node:assert/strict";
import { test } from "node:test";
import { createSupabaseRdoRepository } from "../src/services/obrareport-rdo-repository.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";
import { createApp } from "../src/app.js";

function createFakeSupabase() {
  const tables = {
    obrareport_rdos: [],
    obrareport_rdo_events: [],
    obrareport_rdo_versions: []
  };

  function builder(tableName) {
    const state = { tableName, filters: [], operation: "select", payload: null, patch: null, order: null, limit: null };
    const builderApi = {
      select() {
        return builderApi;
      },
      insert(payload) {
        state.operation = "insert";
        state.payload = payload;
        return builderApi;
      },
      update(patch) {
        state.operation = "update";
        state.patch = patch;
        return builderApi;
      },
      eq(column, value) {
        state.filters.push([column, value]);
        return builderApi;
      },
      order(column, options) {
        state.order = [column, options || {}];
        return builderApi;
      },
      limit(value) {
        state.limit = value;
        return builderApi;
      },
      async maybeSingle() {
        const rows = executeRows();
        return { data: rows[0] || null, error: null };
      },
      async single() {
        const rows = executeRows();
        return { data: rows[0] || null, error: rows[0] ? null : new Error("row_missing") };
      },
      then(resolve, reject) {
        return Promise.resolve({ data: executeRows(), error: null }).then(resolve, reject);
      }
    };

    function executeRows() {
      const rows = tables[tableName];
      if (state.operation === "insert") {
        const payload = { ...state.payload };
        if (rows.some((row) => row.id === payload.id)) return [];
        rows.push(payload);
        return [payload];
      }
      let selected = rows.filter((row) => state.filters.every(([column, value]) => row[column] === value));
      if (state.operation === "update") {
        selected = selected.map((row) => Object.assign(row, state.patch));
      }
      if (state.order) {
        const [column, options] = state.order;
        selected.sort((left, right) => String(left[column] || "").localeCompare(String(right[column] || "")) * (options.ascending === false ? -1 : 1));
      }
      return state.limit ? selected.slice(0, state.limit) : selected;
    }

    return builderApi;
  }

  return {
    tables,
    from(tableName) {
      if (!tables[tableName]) throw new Error(`unknown_table:${tableName}`);
      return builder(tableName);
    }
  };
}

test("Supabase RDO repository is durable, tenant-scoped and idempotent", async () => {
  const client = createFakeSupabase();
  const repositoryA = createSupabaseRdoRepository({ client });
  const repositoryB = createSupabaseRdoRepository({ client });
  const tenantA = { userId: "auth-a", profile: { id: "profile-a", auth_user_id: "auth-a", institution_id: "tenant-a" } };
  const tenantB = { userId: "auth-b", profile: { id: "profile-b", auth_user_id: "auth-b", institution_id: "tenant-b" } };
  const payload = {
    projectId: "work-a",
    title: "RDO A",
    rdoDate: "2026-09-14",
    rdoData: { date: "2026-09-14", operationId: "create-operation-a", observations: ["original"] }
  };

  await assert.rejects(
    () => repositoryA.create(tenantA, { rdoData: { date: "2026-09-14" } }),
    (error) => error && error.status === 400 && error.message === "rdo_idempotency_key_required"
  );

  const created = await repositoryA.create(tenantA, payload);
  assert.equal(created.institution_id, "tenant-a");
  assert.equal(created.created_by, "auth-a");
  assert.equal(client.tables.obrareport_rdos.length, 1);
  assert.equal(client.tables.obrareport_rdo_events.length, 1);

  const duplicate = await repositoryB.create(tenantA, payload);
  assert.equal(duplicate.id, created.id);
  assert.equal(client.tables.obrareport_rdos.length, 1);

  const restartedRead = await repositoryB.getById(tenantA, created.id);
  assert.equal(restartedRead.id, created.id);
  assert.equal((await repositoryB.list(tenantA)).length, 1);
  assert.deepEqual(await repositoryB.list(tenantB), []);
  await assert.rejects(() => repositoryB.getById(tenantB, created.id), /rdo_not_found/);
  await assert.rejects(() => repositoryB.update(tenantB, created.id, { rdoData: { operationId: "cross-tenant" } }), /rdo_not_found/);

  const updateData = { date: "2026-09-14", operationId: "update-operation-a", observations: ["original", "controlled update"] };
  const updated = await repositoryA.update(tenantA, created.id, { rdoData: updateData });
  const repeated = await repositoryB.update(tenantA, created.id, { rdoData: updateData });
  assert.deepEqual(repeated.rdo_data_json, updated.rdo_data_json);
  assert.equal(client.tables.obrareport_rdo_events.filter((event) => event.event_type === "rdo_updated").length, 1);
});


test("Supabase-backed RDO service never falls back to local document JSON", () => {
  const client = createFakeSupabase();
  const repository = createSupabaseRdoRepository({ client });
  const service = createObraReportTransactionalService({ rdoRepository: repository });
  const context = { userId: "auth-a", profile: { id: "profile-a", auth_user_id: "auth-a", institution_id: "tenant-a" } };
  assert.throws(() => service.generateRdoDocument(context, "missing"), /rdo_document_store_not_configured/);
  assert.throws(() => service.prepareDocumentEmail(context, "missing"), /document_store_not_configured/);
});


test("production RDO store fails closed without Supabase and permits explicit file mode", () => {
  assert.throws(() => createApp({ env: { NODE_ENV: "production" } }), /rdo_supabase_store_not_configured/);
  assert.throws(() => createApp({ env: { NODE_ENV: "production", ELO_RDO_STORE: "unknown" } }), /rdo_store_mode_invalid/);
  assert.doesNotThrow(() => createApp({ env: { NODE_ENV: "production", ELO_RDO_STORE: "file" } }));
});
