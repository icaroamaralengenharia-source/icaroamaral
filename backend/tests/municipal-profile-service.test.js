import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalProfileService } from "../src/municipal-profile-service.js";

function ctx(role = "platform_admin", overrides = {}) {
  return {
    ok: true,
    userId: overrides.userId || role + "-user",
    institutionId: "",
    role,
    profile: Object.assign({
      id: role + "-profile",
      auth_user_id: overrides.userId || role + "-user",
      institution_id: "",
      unit_id: null,
      role,
      status: "active",
      email: role + "@example.com"
    }, overrides.profile || {})
  };
}

function setup() {
  const store = createMemoryMunicipalAdminStore({
    municipal_profiles: [],
    municipal_profile_versions: [],
    municipal_profile_values: [],
    municipal_profile_imports: [],
    municipal_profile_import_rows: [],
    municipal_admin_audit_log: []
  });
  const service = createMunicipalProfileService({
    store,
    now: () => new Date("2026-02-10T12:00:00.000Z")
  });
  return { service, store };
}

async function createProfile(service, body = {}) {
  return await service.createMunicipalProfile(ctx(), Object.assign({
    municipality: "Vitória da Conquista",
    state: "BA",
    profileType: "official"
  }, body));
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("cria perfil municipal global e bloqueia duplicidade normalizada", async () => {
  const { service, store } = setup();
  const result = await createProfile(service);

  assert.equal(result.profile.municipality_name, "Vitória da Conquista");
  assert.equal(result.profile.municipality_key, "vitoria-da-conquista");
  assert.equal(result.profile.state, "BA");
  assert.equal(result.profile.profile_type, "official");
  assert.equal(result.profile.ibge_code, null);
  assert.equal(store.tables.municipal_admin_audit_log.at(-1).action, "municipal_profile_created");
  await rejectsCode(createProfile(service, { municipality: "Vitoria da Conquista", state: "ba" }), "municipal_profile_duplicate");
});

test("cria draft e incrementa versao", async () => {
  const { service, store } = setup();
  const { profile } = await createProfile(service);
  const v1 = await service.createMunicipalProfileVersion(ctx(), profile.id, { source_hash: "hash-1" });
  const v2 = await service.createMunicipalProfileVersion(ctx(), profile.id, { source_hash: "hash-2" });

  assert.equal(v1.version.status, "draft");
  assert.equal(v1.version.version_number, 1);
  assert.equal(v2.version.version_number, 2);
  assert.equal(store.tables.municipal_admin_audit_log.at(-1).action, "municipal_profile_version_created");
});

test("salva valores boolean, number e enum usando catalogo M01", async () => {
  const { service } = setup();
  const { profile } = await createProfile(service);
  const { version } = await service.createMunicipalProfileVersion(ctx(), profile.id);

  const booleanValue = await service.setMunicipalProfileValue(ctx(), version.id, { catalog_code: "MUN_DOC_002", raw_value: "SIM" });
  const numberValue = await service.setMunicipalProfileValue(ctx(), version.id, { catalog_code: "MUN_INF_001", raw_value: "12" });
  const enumValue = await service.setMunicipalProfileValue(ctx(), version.id, { catalog_code: "MUN_DOC_001", raw_value: "relatorio" });

  assert.equal(booleanValue.value.normalized_value, true);
  assert.equal(numberValue.value.normalized_value, 12);
  assert.equal(enumValue.value.normalized_value, "relatorio");
});

test("falha controlada para catalog code invalido, tipo incompatível e unidade incompatível", async () => {
  const { service } = setup();
  const { profile } = await createProfile(service);
  const { version } = await service.createMunicipalProfileVersion(ctx(), profile.id);

  await rejectsCode(service.setMunicipalProfileValue(ctx(), version.id, { catalog_code: "MUN_X_999", raw_value: "SIM" }), "municipal_profile_catalog_code_invalid");
  await rejectsCode(service.setMunicipalProfileValue(ctx(), version.id, { catalog_code: "MUN_INF_001", raw_value: "doze" }), "numeric_value_invalid");
  await rejectsCode(service.setMunicipalProfileValue(ctx(), version.id, { catalog_code: "MUN_INF_001", raw_value: "12", unit: "%" }), "municipal_profile_value_unit_invalid");
});

test("ativa versao, impede duas active e torna active imutavel", async () => {
  const { service, store } = setup();
  const { profile } = await createProfile(service);
  const { version } = await service.createMunicipalProfileVersion(ctx(), profile.id);
  await service.setMunicipalProfileValue(ctx(), version.id, { catalog_code: "MUN_DOC_002", raw_value: "SIM" });

  const active = await service.activateMunicipalProfileVersion(ctx(), version.id);
  assert.equal(active.version.status, "active");
  assert.equal(store.tables.municipal_profile_versions.filter((item) => item.status === "active").length, 1);
  await rejectsCode(service.setMunicipalProfileValue(ctx(), version.id, { catalog_code: "MUN_DOC_003", raw_value: "SIM" }), "municipal_profile_active_immutable");
  await rejectsCode(service.activateMunicipalProfileVersion(ctx(), version.id), "municipal_profile_version_not_draft");
});

test("nova versao apos active arquiva anterior e mantém active unica", async () => {
  const { service, store } = setup();
  const { profile } = await createProfile(service);
  const v1 = await service.createMunicipalProfileVersion(ctx(), profile.id);
  await service.setMunicipalProfileValue(ctx(), v1.version.id, { catalog_code: "MUN_DOC_002", raw_value: "SIM" });
  await service.activateMunicipalProfileVersion(ctx(), v1.version.id);

  const v2 = await service.createMunicipalProfileVersion(ctx(), profile.id);
  await service.setMunicipalProfileValue(ctx(), v2.version.id, { catalog_code: "MUN_DOC_002", raw_value: "NÃO" });
  await service.activateMunicipalProfileVersion(ctx(), v2.version.id);

  const versions = store.tables.municipal_profile_versions;
  assert.equal(versions.filter((item) => item.status === "active").length, 1);
  assert.equal(versions.find((item) => item.id === v1.version.id).status, "archived");
  assert.equal(versions.find((item) => item.id === v2.version.id).status, "active");
});

test("get active retorna metadata e valores normalizados para consumidores futuros", async () => {
  const { service } = setup();
  const { profile } = await createProfile(service);
  const { version } = await service.createMunicipalProfileVersion(ctx(), profile.id);
  await service.setMunicipalProfileValue(ctx(), version.id, { catalog_code: "MUN_DOC_002", raw_value: "SIM", confidence: 0.95, source_page: 2 });
  await service.activateMunicipalProfileVersion(ctx(), version.id);

  const active = await service.getActiveMunicipalProfile(ctx("leitura"), {
    municipality: "Vitoria da Conquista",
    state: "BA",
    profileType: "official"
  });
  assert.equal(active.profile.id, profile.id);
  assert.equal(active.version.status, "active");
  assert.equal(active.values[0].catalog_code, "MUN_DOC_002");
  assert.equal(active.values[0].normalized_value, true);
});

test("historico lista versoes e source hash duplicado e bloqueado no mesmo perfil", async () => {
  const { service } = setup();
  const { profile } = await createProfile(service);
  const v1 = await service.createMunicipalProfileVersion(ctx(), profile.id, { source_hash: "hash-repetido" });
  await service.setMunicipalProfileValue(ctx(), v1.version.id, { catalog_code: "MUN_DOC_002", raw_value: "SIM" });
  await service.activateMunicipalProfileVersion(ctx(), v1.version.id);
  const v2 = await service.createMunicipalProfileVersion(ctx(), profile.id, { source_hash: "hash-novo" });

  await rejectsCode(service.createMunicipalProfileVersion(ctx(), profile.id, { source_hash: "hash-repetido" }), "municipal_profile_source_hash_duplicate");
  const history = await service.listMunicipalProfileVersions(ctx("leitura"), profile.id);
  assert.deepEqual(history.versions.map((version) => version.version_number), [2, 1]);
  assert.equal(history.versions.find((version) => version.id === v2.version.id).status, "draft");
  assert.equal(history.versions.find((version) => version.id === v1.version.id).status, "active");
});
