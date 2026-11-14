import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createApp } from "../src/app.js";

// Local HTTP integration: real routes/auth guards/DTO/mapper; only provider and
// database persistence are in-memory fixtures. This is not a live DB/UI proof.
function createFixture() {
  const sessions = {
    "fixture-admin-a": { user: { id: "auth-a" }, profile: { id: "profile-a", institution_id: "tenant-a", role: "admin" } },
    "fixture-reader-a": { user: { id: "auth-reader" }, profile: { id: "profile-reader", institution_id: "tenant-a", role: "leitura" } },
    "fixture-admin-b": { user: { id: "auth-b" }, profile: { id: "profile-b", institution_id: "tenant-b", role: "admin" } }
  };
  const items = [
    ...Array.from({ length: 7 }, (_, i) => ({ id: `old-${i}`, institution_id: "tenant-a", project_id: null, name: `Legacy ${i}`, unit: "un", category: "Teste", min_quantity: 0, current_quantity: i + 1, location: "L", notes: "old", sku: null, is_active: true })),
    { id: "foreign", institution_id: "tenant-b", project_id: null, name: "Foreign", unit: "un", current_quantity: 9, sku: "FOREIGN", is_active: true },
    { id: "other-work", institution_id: "tenant-a", project_id: "work-b", name: "Other work", unit: "un", current_quantity: 11, sku: "OTHER", is_active: true }
  ];
  const movements = [{ id: "entry-existing", quantity: 100, type: "entrada" }, { id: "exit-existing", quantity: 25, type: "saida" }];
  const originalItems = structuredClone(items), originalMovements = structuredClone(movements);
  const writes = [];
  let activeUser = "", sequence = 0;
  function query(table) {
    assert.equal(table, "stock_full_items", "No unrelated table may be queried by item routes");
    const filters = [];
    let update = null;
    const matching = () => items.filter(row => filters.every(([key, value]) => value === null ? row[key] == null : row[key] === value));
    return {
      select() { return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      is(key, value) { filters.push([key, value]); return this; },
      order() { return this; },
      insert(payload) {
        writes.push({ action: "insert", payload: structuredClone(payload) });
        const row = { id: `created-${++sequence}`, sku: null, is_active: true, ...structuredClone(payload) };
        items.push(row);
        return { select() { return { async single() { return { data: structuredClone(row), error: null }; } }; } };
      },
      update(payload) { update = structuredClone(payload); writes.push({ action: "update", payload: update, filters }); return this; },
      async maybeSingle() { const row = matching()[0]; if (row && update) Object.assign(row, update); return { data: row ? structuredClone(row) : null, error: null }; },
      then(resolve, reject) { return Promise.resolve({ data: structuredClone(matching()), error: null }).then(resolve, reject); }
    };
  }
  const database = {
    items, movements, writes,
    auth: { async getUser(token) { const session = sessions[token]; activeUser = session?.user.id || ""; return session ? { data: { user: session.user }, error: null } : { data: null, error: new Error("fixture unauthorized") }; } },
    from(table) {
      if (table !== "profiles") return query(table);
      return { select() { return { eq(key, value) { assert.equal(key, "auth_user_id"); assert.equal(value, activeUser); return { async maybeSingle() { return { data: Object.values(sessions).find(session => session.user.id === value)?.profile || null, error: null }; } }; } }; } };
    },
    async rpc(name) { assert.equal(name, "stock_full_list_works"); return { data: [{ id: activeUser === "auth-b" ? "work-b" : "work-a", institution_id: activeUser === "auth-b" ? "tenant-b" : "tenant-a" }], error: null }; }
  };
  return { database, originalItems, originalMovements };
}

async function withServer(database, callback) {
  const app = createApp({ env: {}, stockFullSupabaseClient: database });
  const server = await new Promise(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  try { return await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function request(base, method, suffix = "", body, token = "fixture-admin-a") {
  const response = await fetch(base + "/api/stock-full/items" + suffix, {
    method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, data: await response.json() };
}

const payload = { name: "SKU TESTE LOCAL012", unit: "un", category: "Teste", minQuantity: 0, currentQuantity: 75, location: "TESTE", notes: "Synthetic local fixture" };
function assertExistingUnchanged(fixture) {
  assert.deepEqual(fixture.database.items.filter(row => !row.id.startsWith("created-")), fixture.originalItems);
  assert.deepEqual(fixture.database.movements, fixture.originalMovements);
}

test("SKU survives create/list/update and a new app instance with the same durable ID and75 balance", async () => {
  const fixture = createFixture(); let id;
  await withServer(fixture.database, async base => {
    const created = await request(base, "POST", "", { ...payload, sku: "  SKU-012-A  " });
    assert.equal(created.status, 200); id = created.data.item.id;
    assert.equal(created.data.item.sku, "SKU-012-A");
    assert.equal(fixture.database.items.find(row => row.id === id).sku, "SKU-012-A");
    assert.equal((await request(base, "GET")).data.items.find(row => row.id === id).sku, "SKU-012-A");
    const updated = await request(base, "PUT", "/" + id, { ...payload, sku: "  SKU-012-B  " });
    assert.equal(updated.status, 200); assert.equal(updated.data.item.id, id); assert.equal(updated.data.item.sku, "SKU-012-B");
  });
  await withServer(fixture.database, async base => {
    const reopened = (await request(base, "GET")).data.items.find(row => row.id === id);
    assert.equal(reopened.sku, "SKU-012-B"); assert.equal(reopened.currentQuantity, 75);
  });
  assert.equal(fixture.database.items.filter(row => row.id === id).length, 1); assertExistingUnchanged(fixture);
});

test("fiscalCode is an explicit trimmed input alias on create and update", async () => {
  const fixture = createFixture();
  await withServer(fixture.database, async base => {
    const created = await request(base, "POST", "", { ...payload, fiscalCode: "  ALIAS-012  " });
    assert.equal(created.status, 200); assert.equal(created.data.item.sku, "ALIAS-012");
    const updated = await request(base, "PUT", "/" + created.data.item.id, { ...payload, fiscalCode: "  ALIAS-NEXT  " });
    assert.equal(updated.data.item.sku, "ALIAS-NEXT"); assert.equal(updated.data.item.currentQuantity, 75);
  });
  assertExistingUnchanged(fixture);
});

test("PUT without either SKU property preserves a persisted SKU rather than clearing it", async () => {
  const fixture = createFixture();
  fixture.database.items.push({ id: "created-seeded", institution_id: "tenant-a", project_id: null, ...{ name: payload.name, unit: "un", category: "Teste", current_quantity: 75, sku: "KEEP-012", is_active: true } });
  await withServer(fixture.database, async base => {
    const updated = await request(base, "PUT", "/created-seeded", payload);
    assert.equal(updated.status, 200); assert.equal(Object.hasOwn(fixture.database.writes.at(-1).payload, "sku"), false);
    assert.equal(fixture.database.items.find(row => row.id === "created-seeded").sku, "KEEP-012");
    assert.equal(updated.data.item.sku, "KEEP-012");
  });
  await withServer(fixture.database, async base => assert.equal((await request(base, "GET")).data.items.find(row => row.id === "created-seeded").sku, "KEEP-012"));
  assertExistingUnchanged(fixture);
});

test("an explicit blank SKU clears to nullable storage and reopens as empty", async () => {
  const fixture = createFixture();
  fixture.database.items.push({ id: "created-clear", institution_id: "tenant-a", project_id: null, name: payload.name, unit: "un", current_quantity: 75, sku: "CLEAR-012", is_active: true });
  await withServer(fixture.database, async base => {
    const cleared = await request(base, "PUT", "/created-clear", { ...payload, sku: "   " });
    assert.equal(cleared.status, 200); assert.equal(fixture.database.items.find(row => row.id === "created-clear").sku, null);
    assert.equal(cleared.data.item.sku, ""); assert.equal(cleared.data.item.currentQuantity, 75);
  });
  await withServer(fixture.database, async base => assert.equal((await request(base, "GET")).data.items.find(row => row.id === "created-clear").sku, ""));
  assertExistingUnchanged(fixture);
});

test("default create and legacy null SKU remain readable without backfilling existing products", async () => {
  const fixture = createFixture();
  await withServer(fixture.database, async base => {
    const created = await request(base, "POST", "", payload); assert.equal(created.status, 200);
    assert.equal(fixture.database.items.find(row => row.id === created.data.item.id).sku, null); assert.equal(created.data.item.sku, "");
    const listed = await request(base, "GET"); assert.equal(listed.data.items.find(row => row.id === "old-0").sku, "");
  });
  assertExistingUnchanged(fixture);
});

test("adding SKU does not relax tenant, work or product-write permission guards", async () => {
  const fixture = createFixture();
  await withServer(fixture.database, async base => {
    for (const id of ["foreign", "other-work"]) {
      const denied = await request(base, "PUT", "/" + id, { ...payload, sku: "MUST-NOT-WRITE" });
      assert.equal(denied.status, 404);
    }
    const reader = await request(base, "POST", "", { ...payload, sku: "READER" }, "fixture-reader-a"); assert.equal(reader.status, 403);
    const work = await request(base, "POST", "", { ...payload, projectId: "work-b", sku: "WORK" }); assert.equal(work.status, 403);
  });
  assertExistingUnchanged(fixture);
});

test("local SQL proposal adds only nullable sku metadata without data/RLS/ledger changes", async () => {
  const sql = await readFile(new URL("../src/data/stock-full-sku-metadata-migration.sql", import.meta.url), "utf8");
  const statement = sql.replace(/--[^\n]*/g, "").trim();
  assert.match(statement, /^alter table public\.stock_full_items\s+add column if not exists sku text default null;$/i);
});
