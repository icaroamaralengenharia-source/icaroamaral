import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalAssetService } from "../src/municipal-asset-service.js";
import { createEloMunicipalTools } from "../src/elo-municipal-tools.js";

function ctx(role, overrides = {}) {
  return {
    ok: true,
    userId: overrides.userId || role + "-user",
    institutionId: overrides.institutionId ?? "inst-a",
    role,
    profile: {
      id: role + "-profile",
      auth_user_id: overrides.userId || role + "-user",
      institution_id: overrides.institutionId ?? "inst-a",
      unit_id: overrides.unitId || "",
      role,
      status: "active"
    }
  };
}

function setup(extra = {}) {
  const store = createMemoryMunicipalAdminStore(Object.assign({
    institutions: [
      { id: "inst-a", name: "Prefeitura A", status: "active" },
      { id: "inst-b", name: "Prefeitura B", status: "active" }
    ],
    units: [
      { id: "unit-a", institution_id: "inst-a", name: "Almox A", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Almox B", status: "active" }
    ],
    municipal_assets: [
      { id: "asset-b", institution_id: "inst-b", unit_id: "unit-b", asset_tag: "B-001", name: "Tenant B", category: "mobiliario", condition: "bom", status: "ativo", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }
    ],
    municipal_asset_history: [],
    municipal_admin_audit_log: [],
    stock_items: [{ id: "item-a", institution_id: "inst-a", unit_id: "unit-a", name: "Seringa" }]
  }, extra));
  return { store, service: createMunicipalAssetService({ store, now: () => new Date("2026-01-02T00:00:00.000Z") }) };
}

async function createAsset(service, body = {}) {
  return (await service.createAsset(ctx("municipal_admin"), Object.assign({
    unit_id: "unit-a",
    asset_tag: "PAT-001",
    name: "Mesa de atendimento",
    category: "mobiliario",
    condition: "bom",
    status: "ativo",
    location: "Sala 1"
  }, body))).asset;
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("cadastra bem individual e rejeita tombamento duplicado", async () => {
  const { service, store } = setup();
  const asset = await createAsset(service);
  assert.equal(asset.asset_tag, "PAT-001");
  assert.equal(asset.institution_id, "inst-a");
  assert.equal(asset.unit_id, "unit-a");
  assert.equal(store.tables.stock_items.length, 1);
  await rejectsCode(createAsset(service, { name: "Cadeira" }), "asset_tag_duplicate");
});

test("bloqueia unidade externa e nao mistura tenants", async () => {
  const { service } = setup();
  await rejectsCode(createAsset(service, { unit_id: "unit-b", asset_tag: "PAT-EXT" }), "unit_scope_forbidden");
  await createAsset(service);
  const list = await service.listAssets(ctx("municipal_admin"), {});
  assert.equal(list.assets.some((item) => item.id === "asset-b"), false);
});

test("transferencia, manutencao e baixa preservam historico", async () => {
  const { service, store } = setup({ units: [
    { id: "unit-a", institution_id: "inst-a", name: "Almox A", status: "active" },
    { id: "unit-a2", institution_id: "inst-a", name: "Almox A2", status: "active" }
  ] });
  const asset = await createAsset(service);
  const transferred = await service.transferAsset(ctx("municipal_admin"), asset.id, { to_unit_id: "unit-a2", reason: "Redistribuicao" });
  assert.equal(transferred.asset.status, "transferido");
  const maintenance = await service.registerMaintenance(ctx("municipal_admin"), asset.id, { note: "Reparo", condition: "regular" });
  assert.equal(maintenance.asset.status, "em_manutencao");
  const deactivated = await service.deactivateAsset(ctx("municipal_admin"), asset.id, { reason: "Baixa patrimonial" });
  assert.equal(deactivated.asset.status, "baixado");
  assert.equal(store.tables.municipal_assets.length, 2);
  assert.deepEqual(store.tables.municipal_asset_history.filter((item) => item.asset_id === asset.id).map((item) => item.action), ["asset_created", "asset_transferred", "asset_maintenance_registered", "asset_deactivated"]);
  assert.ok(store.tables.municipal_admin_audit_log.some((item) => item.action === "asset_deactivated"));
});

test("gestor so acessa unidade autorizada", async () => {
  const { service } = setup({ municipal_assets: [
    { id: "asset-a", institution_id: "inst-a", unit_id: "unit-a", asset_tag: "PAT-A", name: "Mesa", condition: "ruim", status: "ativo" },
    { id: "asset-a2", institution_id: "inst-a", unit_id: "unit-a2", asset_tag: "PAT-A2", name: "Cadeira", condition: "bom", status: "ativo" }
  ], units: [
    { id: "unit-a", institution_id: "inst-a", name: "Almox A", status: "active" },
    { id: "unit-a2", institution_id: "inst-a", name: "Almox A2", status: "active" }
  ] });
  const list = await service.listAssets(ctx("gestor", { unitId: "unit-a" }), {});
  assert.deepEqual(list.assets.map((item) => item.id), ["asset-a"]);
  await rejectsCode(service.getAsset(ctx("gestor", { unitId: "unit-a" }), "asset-a2"), "unit_scope_forbidden");
});

test("ELO encontra tombamento, lista ruim e nao executa escrita", async () => {
  const { store } = setup({ municipal_assets: [
    { id: "asset-a", institution_id: "inst-a", unit_id: "unit-a", asset_tag: "PAT-777", name: "Armario", category: "mobiliario", condition: "ruim", status: "ativo", responsible_user_id: "", location: "Sala 2" }
  ] });
  const tools = createEloMunicipalTools({ store });
  const beforeCounts = {
    assets: store.tables.municipal_assets.length,
    history: store.tables.municipal_asset_history.length,
    audit: store.tables.municipal_admin_audit_log.length,
    stock: store.tables.stock_items.length
  };
  const byTag = await tools.answer(ctx("gestor", { unitId: "unit-a" }), "localizar tombamento PAT-777 no patrimonio municipal", {});
  assert.match(byTag.answer, /PAT-777/);
  const bad = await tools.answer(ctx("gestor", { unitId: "unit-a" }), "listar bens em estado ruim do patrimonio municipal", {});
  assert.match(bad.answer, /Armario/);
  assert.equal(store.tables.municipal_assets.length, beforeCounts.assets);
  assert.equal(store.tables.municipal_asset_history.length, beforeCounts.history);
  assert.equal(store.tables.municipal_admin_audit_log.length, beforeCounts.audit);
  assert.equal(store.tables.stock_items.length, beforeCounts.stock);
});
