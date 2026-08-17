import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";

function profile_(role = "gestor") {
  return { id: "profile_auth", auth_user_id: "auth_user_1", institution_id: "inst_auth", unit_id: "unit_auth", name: "Gestor", email: "gestor@teste.local", role };
}

async function listen_(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return { server, baseUrl: "http://127.0.0.1:" + server.address().port };
}

async function close_(server) {
  await new Promise((resolve) => server.close(resolve));
}

function createProfilesQuery_(profiles) {
  const filters = [];
  return {
    select() { return this; },
    eq(column, value) { filters.push({ column, value }); return this; },
    async maybeSingle() {
      const found = profiles.find((profile) => filters.every((filter) => profile[filter.column] === filter.value));
      return { data: found || null, error: null };
    }
  };
}

function createMockSupabase_(options = {}) {
  const profile = Object.prototype.hasOwnProperty.call(options, "profile") ? options.profile : profile_();
  const client = {
    profiles: profile ? [profile] : [],
    stockFullItems: (options.stockFullItems || []).map((item) => ({ ...item })),
    stockFullEntries: (options.stockFullEntries || []).map((item) => ({ ...item })),
    stockFullExits: (options.stockFullExits || []).map((item) => ({ ...item })),
    stockFullAuditLogs: (options.stockFullAuditLogs || []).map((item) => ({ ...item })),
    rpcCalls: [],
    auth: {
      async getUser(token) {
        if (token !== "valid-token") return { data: null, error: { message: "invalid" } };
        return { data: { user: { id: "auth_user_1", email: "gestor@teste.local" } }, error: null };
      }
    },
    from(table) {
      if (table === "profiles") return createProfilesQuery_(client.profiles);
      return { select() { return this; }, eq() { return this; }, order() { return this; }, async maybeSingle() { return { data: null, error: null }; }, then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
    },
    async rpc(name, args) {
      client.rpcCalls.push({ name, args });
      if (name === "stock_full_apply_movement") return applyMovement_(client, args || {});
      if (name === "stock_full_apply_transfer") return applyTransfer_(client, args || {});
      return { data: null, error: { message: "rpc_not_implemented" } };
    }
  };
  return client;
}

function clean_(value) { return String(value ?? "").trim(); }
function snapshot_(client) {
  return {
    items: client.stockFullItems.map((item) => ({ ...item })),
    entries: client.stockFullEntries.map((item) => ({ ...item })),
    exits: client.stockFullExits.map((item) => ({ ...item })),
    audit: client.stockFullAuditLogs.map((item) => ({ ...item }))
  };
}
function restore_(client, snap) {
  client.stockFullItems.splice(0, client.stockFullItems.length, ...snap.items.map((item) => ({ ...item })));
  client.stockFullEntries.splice(0, client.stockFullEntries.length, ...snap.entries.map((item) => ({ ...item })));
  client.stockFullExits.splice(0, client.stockFullExits.length, ...snap.exits.map((item) => ({ ...item })));
  client.stockFullAuditLogs.splice(0, client.stockFullAuditLogs.length, ...snap.audit.map((item) => ({ ...item })));
}

function applyMovement_(client, args) {
  const snap = snapshot_(client);
  try {
    const profile = client.profiles.find((item) => item.id === args.p_profile_id);
    if (!profile) throw new Error("stock_full_profile_not_found");
    const movement = args.p_movement || {};
    const type = ["saida", "exit"].includes(clean_(movement.type).toLowerCase()) ? "saida" : "entrada";
    const item = client.stockFullItems.find((candidate) => candidate.id === clean_(movement.item_id || movement.itemId) && candidate.institution_id === profile.institution_id && candidate.is_active !== false);
    const quantity = Number(movement.quantity);
    const operationId = clean_(movement.operation_id || movement.operationId);
    const offlineUuid = clean_(movement.offline_uuid || movement.offlineUuid || operationId);
    if (!item) throw new Error("stock_full_item_not_found");
    if (!(quantity > 0)) throw new Error("quantity_required");
    if (!operationId && !offlineUuid) throw new Error("stock_full_idempotency_key_required");
    const target = type === "saida" ? client.stockFullExits : client.stockFullEntries;
    const duplicate = target.find((candidate) => candidate.institution_id === profile.institution_id && ((operationId && candidate.operation_id === operationId) || (offlineUuid && candidate.offline_uuid === offlineUuid)));
    if (duplicate) return { data: { status: "duplicate", duplicate: true, type, [type === "saida" ? "exit" : "entry"]: duplicate, item }, error: null };
    const before = Number(item.current_quantity || 0);
    if (type === "saida" && quantity > before) throw new Error("stock_full_insufficient_quantity");
    item.current_quantity = type === "saida" ? before - quantity : before + quantity;
    const record = { id: (type === "saida" ? "stock_full_exit_" : "stock_full_entry_") + String(target.length + 1), institution_id: profile.institution_id, item_id: item.id, quantity, operation_id: operationId || null, offline_uuid: offlineUuid || null, source: clean_(movement.source) || "elo", sync_status: "synced", created_at: new Date().toISOString() };
    target.push(record);
    return { data: { status: "synced", duplicate: false, type, [type === "saida" ? "exit" : "entry"]: record, item, previousBalance: before, newBalance: item.current_quantity }, error: null };
  } catch (error) {
    restore_(client, snap);
    return { data: null, error: { message: clean_(error.message) } };
  }
}

function applyTransfer_(client, args) {
  const snap = snapshot_(client);
  try {
    const profile = client.profiles.find((item) => item.id === args.p_profile_id);
    if (!profile) throw new Error("stock_full_profile_not_found");
    if (["leitura", "viewer"].includes(clean_(profile.role).toLowerCase())) throw new Error("permission_denied");
    const body = args.p_transfer || {};
    const transferId = clean_(body.transfer_id || body.transferId || body.operation_id || body.operationId);
    const sourceItemId = clean_(body.source_item_id || body.sourceItemId);
    const destinationItemId = clean_(body.destination_item_id || body.destinationItemId);
    const quantity = Number(body.quantity);
    const notes = clean_(body.notes);
    if (!transferId) throw new Error("transfer_id_required");
    if (!sourceItemId) throw new Error("source_item_id_required");
    if (!destinationItemId) throw new Error("destination_item_id_required");
    if (sourceItemId === destinationItemId) throw new Error("stock_full_same_transfer_item");
    if (!(quantity > 0)) throw new Error("quantity_required");
    const duplicateExit = client.stockFullExits.find((item) => item.institution_id === profile.institution_id && item.transfer_id === transferId);
    const duplicateEntry = client.stockFullEntries.find((item) => item.institution_id === profile.institution_id && item.transfer_id === transferId);
    if (duplicateExit && duplicateEntry) {
      const sourceItem = client.stockFullItems.find((item) => item.id === duplicateExit.item_id);
      const destinationItem = client.stockFullItems.find((item) => item.id === duplicateEntry.item_id);
      return { data: { status: "duplicate", duplicate: true, transfer_id: transferId, exit: duplicateExit, entry: duplicateEntry, sourceItem, destinationItem }, error: null };
    }
    if (duplicateExit || duplicateEntry) throw new Error("stock_full_transfer_partial_state");
    const sourceItem = client.stockFullItems.find((item) => item.id === sourceItemId && item.institution_id === profile.institution_id && item.is_active !== false);
    const destinationItem = client.stockFullItems.find((item) => item.id === destinationItemId && item.institution_id === profile.institution_id && item.is_active !== false);
    if (!sourceItem) throw new Error("stock_full_item_not_found");
    if (!destinationItem) throw new Error("stock_full_destination_item_not_found");
    const sourcePreviousBalance = Number(sourceItem.current_quantity || 0);
    const destinationPreviousBalance = Number(destinationItem.current_quantity || 0);
    if (quantity > sourcePreviousBalance) throw new Error("stock_full_insufficient_quantity");
    sourceItem.current_quantity = sourcePreviousBalance - quantity;
    if (notes === "force-after-exit") throw new Error("forced_after_exit_failure");
    const exit = { id: "stock_full_exit_" + String(client.stockFullExits.length + 1), institution_id: profile.institution_id, item_id: sourceItem.id, quantity, transfer_id: transferId, operation_id: transferId, offline_uuid: transferId, destination: destinationItem.id, responsible: clean_(body.responsible), source: "elo", sync_status: "synced", created_at: new Date().toISOString() };
    client.stockFullExits.push(exit);
    if (notes === "force-entry-fail") throw new Error("forced_entry_insert_failure");
    destinationItem.current_quantity = destinationPreviousBalance + quantity;
    const entry = { id: "stock_full_entry_" + String(client.stockFullEntries.length + 1), institution_id: profile.institution_id, item_id: destinationItem.id, quantity, transfer_id: transferId, operation_id: transferId, offline_uuid: transferId, supplier: sourceItem.id, source: "elo", sync_status: "synced", created_at: new Date().toISOString() };
    client.stockFullEntries.push(entry);
    const audit = { id: "stock_full_audit_" + String(client.stockFullAuditLogs.length + 1), institution_id: profile.institution_id, action: "stock_full_transfer_created", entity_type: "stock_full_transfer", entity_id: transferId, operation_id: transferId, source: "elo", created_at: new Date().toISOString() };
    client.stockFullAuditLogs.push(audit);
    return { data: { status: "synced", duplicate: false, transfer_id: transferId, exit, entry, sourceItem, destinationItem, audit, sourcePreviousBalance, sourceNewBalance: sourceItem.current_quantity, destinationPreviousBalance, destinationNewBalance: destinationItem.current_quantity }, error: null };
  } catch (error) {
    restore_(client, snap);
    return { data: null, error: { message: clean_(error.message) || "stock_full_transfer_failed" } };
  }
}

async function postJson_(server, path, body) {
  const response = await fetch(server.baseUrl + path, { method: "POST", headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { response, data: await response.json() };
}

function transferItems_() {
  return [
    { id: "source", institution_id: "inst_auth", name: "Cimento origem", unit: "saco", current_quantity: 10, is_active: true },
    { id: "dest", institution_id: "inst_auth", name: "Cimento destino", unit: "saco", current_quantity: 2, is_active: true },
    { id: "other", institution_id: "inst_other", name: "Outro tenant", unit: "saco", current_quantity: 99, is_active: true }
  ];
}

test("stock full transferencia remota atomica movimenta origem e destino com mesmo transferId", async () => {
  const supabase = createMockSupabase_({ stockFullItems: transferItems_() });
  const server = await listen_(createApp({ env: { PORT: "0" }, stockFullSupabaseClient: supabase }));
  try {
    const { response, data } = await postJson_(server, "/api/stock-full/transfers", { transferId: "tr-1", sourceItemId: "source", destinationItemId: "dest", quantity: 5, responsible: "ELO" });
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.transferId, "tr-1");
    assert.equal(supabase.stockFullItems.find((item) => item.id === "source").current_quantity, 5);
    assert.equal(supabase.stockFullItems.find((item) => item.id === "dest").current_quantity, 7);
    assert.equal(supabase.stockFullExits.length, 1);
    assert.equal(supabase.stockFullEntries.length, 1);
    assert.equal(supabase.stockFullExits[0].transfer_id, "tr-1");
    assert.equal(supabase.stockFullEntries[0].transfer_id, "tr-1");
    assert.equal(supabase.stockFullAuditLogs[0].action, "stock_full_transfer_created");
    assert.equal(supabase.rpcCalls[0].name, "stock_full_apply_transfer");
  } finally {
    await close_(server.server);
  }
});

test("stock full transferencia remota retry com mesmo transferId nao duplica", async () => {
  const supabase = createMockSupabase_({ stockFullItems: transferItems_() });
  const server = await listen_(createApp({ env: { PORT: "0" }, stockFullSupabaseClient: supabase }));
  const body = { transferId: "tr-retry", sourceItemId: "source", destinationItemId: "dest", quantity: 5 };
  try {
    const first = await postJson_(server, "/api/stock-full/transfers", body);
    const second = await postJson_(server, "/api/stock-full/transfers", body);
    assert.equal(first.data.status, "synced");
    assert.equal(second.data.status, "duplicate");
    assert.equal(supabase.stockFullExits.length, 1);
    assert.equal(supabase.stockFullEntries.length, 1);
    assert.equal(supabase.stockFullItems.find((item) => item.id === "source").current_quantity, 5);
    assert.equal(supabase.stockFullItems.find((item) => item.id === "dest").current_quantity, 7);
  } finally {
    await close_(server.server);
  }
});

test("stock full transferencia bloqueia saldo insuficiente origem igual destino inexistente e cross-company", async () => {
  const cases = [
    [{ transferId: "tr-low", sourceItemId: "source", destinationItemId: "dest", quantity: 11 }, "stock_full_insufficient_quantity"],
    [{ transferId: "tr-same", sourceItemId: "source", destinationItemId: "source", quantity: 1 }, "stock_full_same_transfer_item"],
    [{ transferId: "tr-missing", sourceItemId: "source", destinationItemId: "missing", quantity: 1 }, "stock_full_destination_item_not_found"],
    [{ transferId: "tr-cross", sourceItemId: "source", destinationItemId: "other", quantity: 1 }, "stock_full_destination_item_not_found"]
  ];
  for (const [body, error] of cases) {
    const supabase = createMockSupabase_({ stockFullItems: transferItems_() });
    const server = await listen_(createApp({ env: { PORT: "0" }, stockFullSupabaseClient: supabase }));
    try {
      const result = await postJson_(server, "/api/stock-full/transfers", body);
      assert.equal(result.data.error, error);
      assert.equal(supabase.stockFullItems.find((item) => item.id === "source").current_quantity, 10);
      assert.equal(supabase.stockFullItems.find((item) => item.id === "dest").current_quantity, 2);
      assert.equal(supabase.stockFullExits.length, 0);
      assert.equal(supabase.stockFullEntries.length, 0);
    } finally {
      await close_(server.server);
    }
  }
});

test("stock full transferencia rollback total se falhar apos saida ou ao criar entrada", async () => {
  for (const notes of ["force-after-exit", "force-entry-fail"]) {
    const supabase = createMockSupabase_({ stockFullItems: transferItems_() });
    const server = await listen_(createApp({ env: { PORT: "0" }, stockFullSupabaseClient: supabase }));
    try {
      const result = await postJson_(server, "/api/stock-full/transfers", { transferId: "tr-rollback-" + notes, sourceItemId: "source", destinationItemId: "dest", quantity: 5, notes });
      assert.equal(result.response.status, 500);
      assert.equal(supabase.stockFullItems.find((item) => item.id === "source").current_quantity, 10);
      assert.equal(supabase.stockFullItems.find((item) => item.id === "dest").current_quantity, 2);
      assert.equal(supabase.stockFullExits.length, 0);
      assert.equal(supabase.stockFullEntries.length, 0);
      assert.equal(supabase.stockFullAuditLogs.length, 0);
    } finally {
      await close_(server.server);
    }
  }
});

test("stock full entrada e saida remotas continuam idempotentes apos transferencia", async () => {
  const supabase = createMockSupabase_({ stockFullItems: transferItems_() });
  const server = await listen_(createApp({ env: { PORT: "0" }, stockFullSupabaseClient: supabase }));
  try {
    const entryA = await postJson_(server, "/api/stock-full/entries", { itemId: "source", quantity: 2, operationId: "entry-05n" });
    const entryB = await postJson_(server, "/api/stock-full/entries", { itemId: "source", quantity: 2, operationId: "entry-05n" });
    const exitA = await postJson_(server, "/api/stock-full/exits", { itemId: "source", quantity: 1, operationId: "exit-05n" });
    const exitB = await postJson_(server, "/api/stock-full/exits", { itemId: "source", quantity: 1, operationId: "exit-05n" });
    assert.equal(entryA.data.status, "synced");
    assert.equal(entryB.data.status, "duplicate");
    assert.equal(exitA.data.status, "synced");
    assert.equal(exitB.data.status, "duplicate");
    assert.equal(supabase.stockFullItems.find((item) => item.id === "source").current_quantity, 11);
    assert.equal(supabase.stockFullEntries.length, 1);
    assert.equal(supabase.stockFullExits.length, 1);
  } finally {
    await close_(server.server);
  }
});
