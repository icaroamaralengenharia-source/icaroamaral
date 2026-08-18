import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const reportSource = readFileSync(new URL("../../relatorio-qualidade-obras/relatorio-qualidade-obras.js", import.meta.url), "utf8");
const backendSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

function functionBody_(name) {
  const start = reportSource.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " should exist");
  const next = reportSource.indexOf("\n  function ", start + 20);
  return reportSource.slice(start, next >= 0 ? next : reportSource.length);
}

test("ELO entry persists stable operationId and starts explicit remote sync", () => {
  const entryBody = functionBody_("createConfirmedOperationalEntry_");
  assert.match(entryBody, /operationId:\s*buildEloStockMovementOperationId_\("entrada", entryId\)/);
  assert.match(entryBody, /offlineUuid:\s*buildEloStockMovementOperationId_\("entrada", entryId\)/);
  assert.match(entryBody, /localConfirmationStatus:\s*"local_confirmed"/);
  assert.match(entryBody, /remoteSyncStatus:\s*"remote_pending"/);
  assert.match(entryBody, /remoteSync:\s*movement \? syncConfirmedMovement_\(movement, \{ type: "entrada" \}\)/);

  const localEntryBody = functionBody_("saveAlmoxEntryFromFormData_");
  assert.match(localEntryBody, /operationId:\s*clean\(formData\.get\("operationId"\)\)/);
  assert.match(localEntryBody, /offlineUuid:\s*clean\(formData\.get\("offlineUuid"\)\) \|\| clean\(formData\.get\("operationId"\)\)/);
  assert.match(localEntryBody, /syncStatus:\s*clean\(formData\.get\("syncStatus"\)\)/);
});

test("ELO exit persists stable operationId and starts explicit remote sync", () => {
  const exitBody = functionBody_("createConfirmedOperationalExit_");
  assert.match(exitBody, /const exitOperationId = buildEloStockMovementOperationId_\("saida", releaseId/);
  assert.match(exitBody, /operationId:\s*exitOperationId/);
  assert.match(exitBody, /offlineUuid:\s*exitOperationId/);
  assert.match(exitBody, /localConfirmationStatus:\s*"local_confirmed"/);
  assert.match(exitBody, /remoteSyncStatus:\s*"remote_pending"/);
  assert.match(exitBody, /const remoteSync = syncConfirmedMovement_\(movement, \{ type: "saida" \}\)/);

  const localExitBody = functionBody_("saveAlmoxExitFromFormData_");
  assert.match(localExitBody, /operationId:\s*clean\(formData\.get\("operationId"\)\)/);
  assert.match(localExitBody, /offlineUuid:\s*clean\(formData\.get\("offlineUuid"\)\) \|\| clean\(formData\.get\("operationId"\)\)/);
  assert.match(localExitBody, /syncStatus:\s*clean\(formData\.get\("syncStatus"\)\)/);
});

test("official bridge exposes read/write sync helper for retries with same operationId", () => {
  const syncBody = functionBody_("syncConfirmedMovement_");
  assert.match(syncBody, /const operationId = clean\(movement && movement\.operationId\)/);
  assert.match(syncBody, /stock_full_idempotency_key_required/);
  assert.match(syncBody, /remoteSyncStatus:\s*"remote_pending"/);
  assert.match(syncBody, /await createStockFullRemoteExit_\(payload\)/);
  assert.match(syncBody, /await createStockFullRemoteEntry_\(payload\)/);
  assert.match(syncBody, /remoteSyncStatus:\s*"synced"/);
  assert.match(syncBody, /remoteSyncStatus:\s*"remote_error"/);
  assert.match(reportSource, /syncConfirmedMovement:\s*syncConfirmedMovement_/);
});

test("remote sync uses existing endpoints and backend idempotency contract", () => {
  assert.match(reportSource, /fetchStockFullJson_\("\/api\/stock-full\/entries"/);
  assert.match(reportSource, /fetchStockFullJson_\("\/api\/stock-full\/exits"/);
  assert.match(backendSource, /app\.post\("\/api\/stock-full\/entries"[\s\S]*applyStockFullMovementRpc_\(database, session\.profile, "entrada"/);
  assert.match(backendSource, /app\.post\("\/api\/stock-full\/exits"[\s\S]*applyStockFullMovementRpc_\(database, session\.profile, "saida"/);
  assert.match(backendSource, /stock_full_idempotency_key_required/);
  assert.match(backendSource, /database\.rpc\("stock_full_apply_movement"/);
});

test("remote transfer uses dedicated atomic endpoint and reconciles local movements", () => {
  const transferBody = functionBody_("createConfirmedOperationalTransfer_");
  const syncTransferBody = functionBody_("syncConfirmedTransfer_");
  assert.doesNotMatch(transferBody, /syncConfirmedMovement_|createStockFullRemoteEntry_|createStockFullRemoteExit_/);
  assert.match(transferBody, /state\.movements\.push\(outMovement\)/);
  assert.match(transferBody, /state\.movements\.push\(inMovement\)/);
  assert.match(transferBody, /remoteSync:\s*syncConfirmedTransfer_\(transferPayload, \[outMovement, inMovement\]\)/);
  assert.match(syncTransferBody, /createStockFullRemoteTransfer_/);
  assert.match(syncTransferBody, /remoteSyncStatus:\s*"remote_pending"/);
  assert.match(syncTransferBody, /remoteSyncStatus:\s*"remote_confirmed"/);
  assert.match(syncTransferBody, /updated\.forEach\(function \(movement\) \{/);
  assert.match(syncTransferBody, /removeConfirmedStockLocalMovement_\(movement\)/);
  assert.match(syncTransferBody, /remoteSyncStatus:\s*"remote_error"/);
  assert.match(reportSource, /fetchStockFullJson_\("\/api\/stock-full\/transfers"/);
  assert.match(reportSource, /syncConfirmedTransfer:\s*syncConfirmedTransfer_/);
  assert.match(backendSource, /app\.post\("\/api\/stock-full\/transfers"[\s\S]*applyStockFullTransferRpc_\(database, session\.profile/);
  assert.match(backendSource, /database\.rpc\("stock_full_apply_transfer"/);
});
