import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  LIVE_PREFIX,
  apiJson,
  createMunicipalLiveFixture,
  listAudit,
  makeLiveName,
  stopMunicipalLiveFixture
} from "./municipal-e2e-live-fixture.js";

after(() => stopMunicipalLiveFixture());

test("homologacao funcional viva de patrimonio municipal", async () => {
  const fx = await createMunicipalLiveFixture();
  assert.equal(fx.projectRef, "mplpzyalcxhhinuvjthx");

  const assetTag = makeLiveName("TOMBAMENTO");
  const create = await apiJson(fx, "platform", "POST", "/api/municipal-admin/assets", {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    asset_tag: assetTag,
    name: `${LIVE_PREFIX}BEM`,
    description: "Bem de homologacao funcional E2E",
    category: `${LIVE_PREFIX}MOBILIARIO`,
    brand: "E2E",
    model: "FUNCIONAL_43",
    serial_number: makeLiveName("SERIE"),
    acquisition_value: 100,
    condition: "bom",
    status: "ativo",
    location: `${LIVE_PREFIX}LOCAL_A`,
    responsible_user_id: fx.profiles.gestor.auth_user_id
  });
  assert.equal(create.status, 200, JSON.stringify(create.data));
  const assetId = create.data.asset.id;
  assert.equal(create.data.asset.institution_id, fx.institution.id);
  assert.equal(create.data.asset.unit_id, fx.unitA.id);

  const duplicate = await apiJson(fx, "platform", "POST", "/api/municipal-admin/assets", {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    asset_tag: assetTag,
    name: `${LIVE_PREFIX}DUPLICADO`,
    condition: "bom",
    status: "ativo"
  });
  assert.equal(duplicate.status, 409);

  const list = await apiJson(fx, "platform", "GET", `/api/municipal-admin/assets?institution_id=${encodeURIComponent(fx.institution.id)}&unit_id=${encodeURIComponent(fx.unitA.id)}`);
  assert.equal(list.status, 200);
  assert.ok((list.data.assets || []).some((item) => item.id === assetId));

  const search = await apiJson(fx, "platform", "GET", `/api/municipal-admin/assets?institution_id=${encodeURIComponent(fx.institution.id)}&asset_tag=${encodeURIComponent(assetTag)}`);
  assert.equal(search.status, 200);
  assert.equal((search.data.assets || []).length, 1);

  const update = await apiJson(fx, "platform", "PATCH", `/api/municipal-admin/assets/${assetId}`, {
    name: `${LIVE_PREFIX}BEM_EDITADO`,
    location: `${LIVE_PREFIX}LOCAL_EDITADO`
  });
  assert.equal(update.status, 200, JSON.stringify(update.data));
  assert.equal(update.data.asset.name, `${LIVE_PREFIX}BEM_EDITADO`);

  const transfer = await apiJson(fx, "platform", "POST", `/api/municipal-admin/assets/${assetId}/transfer`, {
    to_unit_id: fx.unitB.id,
    location: `${LIVE_PREFIX}LOCAL_B`,
    reason: `${LIVE_PREFIX}TRANSFERENCIA`
  });
  assert.equal(transfer.status, 200, JSON.stringify(transfer.data));
  assert.equal(transfer.data.asset.unit_id, fx.unitB.id);

  const gestorBlocked = await apiJson(fx, "gestor", "GET", `/api/municipal-admin/assets/${assetId}`);
  assert.ok([403, 404].includes(gestorBlocked.status));

  const maintenance = await apiJson(fx, "platform", "POST", `/api/municipal-admin/assets/${assetId}/maintenance`, {
    note: `${LIVE_PREFIX}MANUTENCAO`,
    condition: "regular"
  });
  assert.equal(maintenance.status, 200, JSON.stringify(maintenance.data));
  assert.equal(maintenance.data.asset.status, "em_manutencao");

  const deactivate = await apiJson(fx, "platform", "POST", `/api/municipal-admin/assets/${assetId}/deactivate`, {
    reason: `${LIVE_PREFIX}BAIXA`
  });
  assert.equal(deactivate.status, 200, JSON.stringify(deactivate.data));
  assert.equal(deactivate.data.asset.status, "baixado");

  const afterDeactivate = await apiJson(fx, "platform", "GET", `/api/municipal-admin/assets/${assetId}`);
  assert.equal(afterDeactivate.status, 200);
  assert.equal(afterDeactivate.data.asset.status, "baixado");

  const history = await apiJson(fx, "platform", "GET", `/api/municipal-admin/assets/${assetId}/history`);
  assert.equal(history.status, 200);
  const actions = (history.data.history || []).map((row) => row.action);
  assert.ok(actions.includes("asset_created"));
  assert.ok(actions.includes("asset_updated"));
  assert.ok(actions.includes("asset_transferred"));
  assert.ok(actions.includes("asset_maintenance_registered"));
  assert.ok(actions.includes("asset_deactivated"));

  for (const [method, path, body] of [
    ["POST", "/api/municipal-admin/assets", { institution_id: fx.institution.id, unit_id: fx.unitA.id, asset_tag: makeLiveName("READ"), name: "read", condition: "bom", status: "ativo" }],
    ["PATCH", `/api/municipal-admin/assets/${assetId}`, { name: "bloqueado" }],
    ["POST", `/api/municipal-admin/assets/${assetId}/transfer`, { to_unit_id: fx.unitA.id }],
    ["POST", `/api/municipal-admin/assets/${assetId}/maintenance`, { note: "bloqueado" }],
    ["POST", `/api/municipal-admin/assets/${assetId}/deactivate`, { reason: "bloqueado" }]
  ]) {
    const denied = await apiJson(fx, "leitura", method, path, body);
    assert.equal(denied.status, 403);
  }

  const elo = await apiJson(fx, "platform", "POST", "/api/elo/chat", {
    message: `No patrimonio municipal, localize o bem por tombamento ${assetTag}`,
    eloContext: "municipal",
    institution_id: fx.institution.id,
    unit_id: fx.unitB.id
  });
  assert.equal(elo.status, 200, JSON.stringify(elo.data));
  assert.match(JSON.stringify(elo.data), new RegExp(assetTag));
  assert.doesNotMatch(JSON.stringify(elo.data), /storage_path|service_role|Bearer\s+[A-Za-z0-9._-]+/i);

  const audits = await listAudit(fx, "asset_deactivated", assetId);
  assert.ok(audits.length >= 1);
});
