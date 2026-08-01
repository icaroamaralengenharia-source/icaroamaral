import assert from "node:assert/strict";
import { test } from "node:test";

const SEED = "municipal-concurrency-stress-v1";

class Mutex {
  constructor() { this.tail = Promise.resolve(); }
  run(fn) {
    const next = this.tail.then(fn, fn);
    this.tail = next.catch(() => {});
    return next;
  }
}

function createConcurrentState() {
  const locks = new Map();
  const stock = new Map([["inst-a:unit-a:item", { quantity: 10, audit: [], operations: new Set() }]]);
  const notifications = new Map();
  const assets = new Map([["inst-a:PAT-1", { unit_id: "unit-a", status: "ativo", history: ["created"], version: 1 }]]);
  const offlineCache = new Map();
  const externalSends = [];
  function lock(key) {
    if (!locks.has(key)) locks.set(key, new Mutex());
    return locks.get(key);
  }
  return {
    stock,
    notifications,
    assets,
    offlineCache,
    externalSends,
    stockOperation(op) {
      return lock("stock:item").run(async () => {
        const item = stock.get("inst-a:unit-a:item");
        if (item.operations.has(op.operation_id)) return { ok: false, reason: "duplicate" };
        if (!Number.isInteger(op.quantity) || op.quantity <= 0) return { ok: false, reason: "quantity_invalid" };
        if (op.type === "exit" && item.quantity < op.quantity) return { ok: false, reason: "insufficient_stock" };
        item.operations.add(op.operation_id);
        item.quantity += op.type === "entry" ? op.quantity : -op.quantity;
        item.audit.push({ type: op.type, quantity: op.quantity, operation_id: op.operation_id });
        return { ok: true, quantity: item.quantity };
      });
    },
    notify(event) {
      return lock(`notification:${event.deduplication_key}`).run(async () => {
        if (event.channel !== "in_app") return { ok: false, reason: `${event.channel}_disabled` };
        if (notifications.has(event.deduplication_key)) return { ok: true, deduplicated: true };
        notifications.set(event.deduplication_key, { ...event, status: "pending", read_at: null });
        return { ok: true };
      });
    },
    markRead(key) {
      return lock(`notification:${key}`).run(async () => {
        const row = notifications.get(key);
        if (!row) return { ok: false, reason: "not_found" };
        if (row.status === "cancelled") return { ok: false, reason: "cancelled" };
        row.status = "read";
        row.read_at = new Date("2026-01-01T00:00:00.000Z").toISOString();
        return { ok: true };
      });
    },
    cancel(key) {
      return lock(`notification:${key}`).run(async () => {
        const row = notifications.get(key);
        if (!row || row.status === "read") return { ok: false, reason: row ? "already_read" : "not_found" };
        row.status = "cancelled";
        return { ok: true };
      });
    },
    transferAsset(toUnit) {
      return lock("asset:PAT-1").run(async () => {
        const asset = assets.get("inst-a:PAT-1");
        asset.unit_id = toUnit;
        asset.version += 1;
        asset.history.push(`transfer:${toUnit}`);
        return { ok: true, version: asset.version };
      });
    },
    syncOffline(scope, records, fail = false) {
      const key = `${scope.institution_id}:${scope.unit_id}:${scope.user_id}`;
      const previous = offlineCache.get(key);
      if (fail) return { ok: false, preserved: previous || null };
      const safeRecords = records.filter((row) => row.institution_id === scope.institution_id && row.unit_id === scope.unit_id).map((row) => ({ ...row, token: undefined }));
      offlineCache.set(key, { last_synced_at: "2026-01-01T00:00:00.000Z", records: safeRecords, index: safeRecords.map((row) => `${row.asset_tag} ${row.name} ${row.category}`).join(" ").toLowerCase() });
      return { ok: true, count: safeRecords.length };
    },
    searchOffline(scope, term) {
      const key = `${scope.institution_id}:${scope.unit_id}:${scope.user_id}`;
      const cache = offlineCache.get(key);
      if (!cache) return { ok: true, offline: true, stale: true, records: [], last_synced_at: null };
      return { ok: true, offline: true, last_synced_at: cache.last_synced_at, records: cache.records.filter((row) => JSON.stringify(row).toLowerCase().includes(term.toLowerCase())) };
    },
    logout(scope) {
      offlineCache.delete(`${scope.institution_id}:${scope.unit_id}:${scope.user_id}`);
    }
  };
}

test("20 operacoes simultaneas no mesmo item preservam saldo e auditoria", async () => {
  const state = createConcurrentState();
  const ops = Array.from({ length: 20 }, (_, index) => state.stockOperation({ type: index % 3 === 0 ? "exit" : "entry", quantity: 1, operation_id: `op-${index}` }));
  const results = await Promise.all(ops);
  const accepted = results.filter((row) => row.ok).length;
  const item = state.stock.get("inst-a:unit-a:item");
  const expected = 10 + item.audit.reduce((sum, row) => sum + (row.type === "entry" ? row.quantity : -row.quantity), 0);
  assert.equal(item.quantity, expected);
  assert.equal(item.audit.length, accepted);
  assert.ok(accepted >= 20);
});

test("operation_id e deduplication_key concorrentes nao duplicam", async () => {
  const state = createConcurrentState();
  const stock = await Promise.all(Array.from({ length: 20 }, () => state.stockOperation({ type: "entry", quantity: 1, operation_id: "same-op" })));
  assert.equal(stock.filter((row) => row.ok).length, 1);
  const notifications = await Promise.all(Array.from({ length: 1000 }, (_, index) => state.notify({ channel: "in_app", deduplication_key: `alert-${index % 50}`, title: "A" })));
  assert.equal(notifications.filter((row) => row.ok && !row.deduplicated).length, 50);
  assert.equal(state.notifications.size, 50);
  assert.equal(state.externalSends.length, 0);
});

test("leitura e cancelamento concorrentes mantem unread-count coerente", async () => {
  const state = createConcurrentState();
  for (let i = 0; i < 50; i += 1) await state.notify({ channel: "in_app", deduplication_key: `n-${i}`, title: "N" });
  const tasks = [];
  for (let i = 0; i < 50; i += 1) tasks.push(i % 2 === 0 ? state.markRead(`n-${i}`) : state.cancel(`n-${i}`));
  await Promise.all(tasks);
  const values = [...state.notifications.values()];
  assert.equal(values.filter((row) => row.status === "pending").length, 0);
  assert.equal(values.filter((row) => row.status === "read").length, 25);
  assert.equal(values.filter((row) => row.status === "cancelled").length, 25);
});

test("transferencias simultaneas preservam historico e baixa nao exclui", async () => {
  const state = createConcurrentState();
  await Promise.all(Array.from({ length: 20 }, (_, index) => state.transferAsset(index % 2 === 0 ? "unit-a" : "unit-b")));
  const asset = state.assets.get("inst-a:PAT-1");
  asset.status = "baixado";
  asset.history.push("deactivate");
  assert.equal(state.assets.has("inst-a:PAT-1"), true);
  assert.equal(asset.history.length, 22);
  assert.equal(asset.version, 21);
});

test("offline cache isola institution_id unit_id user_id e preserva ultimo cache valido", () => {
  const state = createConcurrentState();
  const scopeA = { institution_id: "inst-a", unit_id: "unit-a", user_id: "u-a" };
  const scopeB = { institution_id: "inst-b", unit_id: "unit-b", user_id: "u-b" };
  const rows = [
    { institution_id: "inst-a", unit_id: "unit-a", asset_tag: "PAT-1", name: "Mesa", category: "Mobiliario", token: "secret" },
    { institution_id: "inst-b", unit_id: "unit-b", asset_tag: "PAT-B", name: "Outro", category: "Sigilo" }
  ];
  assert.equal(state.syncOffline(scopeA, rows).count, 1);
  assert.equal(state.syncOffline(scopeB, rows).count, 1);
  assert.equal(state.searchOffline(scopeA, "PAT-B").records.length, 0);
  assert.equal(JSON.stringify(state.searchOffline(scopeA, "PAT-1")).includes("secret"), false);
  const failed = state.syncOffline(scopeA, [], true);
  assert.equal(failed.preserved.records.length, 1);
  state.logout(scopeA);
  assert.equal(state.searchOffline(scopeA, "PAT-1").records.length, 0);
});
