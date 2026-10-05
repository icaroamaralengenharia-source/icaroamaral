import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const root = join(testDirectory, "..", "..");
const migration = readFileSync(join(testDirectory, "..", "src", "data", "stock-full-atomic-movement-migration.sql"), "utf8");
const backend = readFileSync(join(testDirectory, "..", "src", "app.js"), "utf8");
const frontend = readFileSync(join(root, "relatorio-qualidade-obras", "relatorio-qualidade-obras.js"), "utf8");
const sync = readFileSync(join(root, "stock-full-sync.js"), "utf8");
const stockFullApp = readFileSync(join(root, "stock-full-app.js"), "utf8");

test("Stock Full movement RPC keeps balance, movement and audit in one invoker transaction", () => {
  assert.match(migration, /stock_full_runtime_schema_required/);
  assert.match(migration, /stock_full_work_scope_migration_required/);
  assert.match(migration, /create or replace function public\.stock_full_apply_movement\([\s\S]*?security invoker[\s\S]*?as \$\$/i);
  assert.match(migration, /from public\.stock_full_items[\s\S]*?for update/i);
  assert.match(migration, /update public\.stock_full_items[\s\S]*?insert into public\.stock_full_entries[\s\S]*?insert into public\.stock_full_audit_log/i);
  assert.match(migration, /insert into public\.stock_full_exits[\s\S]*?insert into public\.stock_full_audit_log/i);
  assert.match(migration, /p_movement_type = 'saida' and p_quantity > v_previous_balance/i);
  assert.match(migration, /auth_user_id = auth\.uid\(\)/i);
  assert.match(migration, /institution_id::text = p_institution_id/i);
  assert.match(migration, /public\.stock_full_current_institution_id\(\)/i);
  assert.match(migration, /public\.stock_full_work_allowed\(v_project_id\)/i);
  assert.match(migration, /v_project_id text := nullif\(btrim\(p_project_id\), ''\)/i);
  assert.match(migration, /if v_project_id is not null and not public\.stock_full_work_allowed\(v_project_id\)/i);
  assert.doesNotMatch(migration, /if p_project_id is null[\s\S]*?raise exception 'WORK_REQUIRED'/i);
  assert.match(migration, /revoke all on function public\.stock_full_apply_movement[\s\S]*?from anon/i);
  assert.match(migration, /grant execute on function public\.stock_full_apply_movement[\s\S]*?to authenticated/i);
  assert.doesNotMatch(migration, /enable row level security|create policy|drop policy/i);
});

test("Stock Full protects direct-ID item access with the authenticated tenant in API and movement RPC", () => {
  assert.match(backend, /\.update\(validation\.payload\)\s*\.eq\("id", itemId\)\s*\.eq\("institution_id", session\.profile\.institution_id\)/);
  assert.match(migration, /select \* into v_item[\s\S]*?where id = p_item_id\s+and institution_id = p_institution_id\s+and project_id is not distinct from v_project_id\s+and is_active = true\s+for update/i);
  assert.match(migration, /update public\.stock_full_items[\s\S]*?where id = v_item\.id\s+and institution_id = p_institution_id\s+and project_id is not distinct from v_project_id\s+and is_active = true\s+returning \* into v_item/i);
});

test("Stock Full movement RPC serializes both idempotency keys and rejects collisions", () => {
  assert.match(migration, /unnest\(array\[[\s\S]*?v_operation_id[\s\S]*?v_offline_uuid[\s\S]*?order by keys\.value[\s\S]*?pg_advisory_xact_lock/i);
  assert.match(migration, /union all[\s\S]*?from public\.stock_full_exits[\s\S]*?v_existing_count > 1[\s\S]*?stock_full_idempotency_key_reused/i);
  assert.match(migration, /v_existing_quantity is distinct from p_quantity/i);
  assert.match(migration, /stock_full_nfe_already_imported/);
});

test("Stock Full online and offline API paths use the atomic movement RPC", () => {
  assert.match(backend, /async function applyStockFullMovementAtomically_\([\s\S]*?database\.rpc\("stock_full_apply_movement"/);
  assert.match(backend, /async function processStockFullSyncMovement_\([\s\S]*?applyStockFullMovementAtomically_\(database, type, validation\.payload, profile\)/);
  assert.match(backend, /const result = await applyStockFullMovementAtomically_\(database, "entrada", validation\.payload, session\.profile\)/);
  assert.match(backend, /const result = await applyStockFullMovementAtomically_\(database, "saida", validation\.payload, session\.profile\)/);
  assert.match(backend, /const operationId = suppliedOperationId \|\| suppliedOfflineUuid \|\| randomUUID\(\)/);
});

test("Stock Full backend token wins over unrelated auth keys and offline UI movements persist in queue", () => {
  assert.match(frontend, /preferredKeys = \["sb-stock-full-backend-auth-token", "sb-stock-full-auth-token", "stockFullSupabaseToken"\]/);
  assert.match(frontend, /requestOptions\.headers\["x-project-id"\] = activeProjectId/);
  assert.match(frontend, /await window\.StockFullWorkScopeReady/);
  assert.match(stockFullApp, /window\.StockFullWorkScopeReady = new Promise/);
  assert.match(frontend, /if \(hasStockFullBackendToken_\(\)\) \{[\s\S]*?fetchStockFullMe_\(\)[\s\S]*?operações locais bloqueadas/i);
  assert.match(frontend, /stockFullRemoteItemsLoaded && !stockFullRemoteAccessUnavailable \? stockFullRemoteItems : \[\]/);
  assert.match(frontend, /StockFullSync\.enqueue\("stock:entry"/);
  assert.match(frontend, /StockFullSync\.enqueue\("stock:exit"/);
  assert.match(sync, /\["sb-stock-full-backend-auth-token", "sb-stock-full-auth-token", "stockFullSupabaseToken"\]/);
  assert.match(sync, /stockfull:sync-complete/);
});
