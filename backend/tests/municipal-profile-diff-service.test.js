import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import {
  compareMunicipalProfileVersions,
  createMunicipalProfileDiffService
} from "../src/municipal-profile-diff-service.js";

function ctx(role = "leitura") {
  return {
    ok: true,
    userId: role + "-user",
    institutionId: "",
    role,
    profile: { id: role + "-profile", role, status: "active" }
  };
}

function value(id, versionId, catalogCode, overrides = {}) {
  return Object.assign({
    id,
    version_id: versionId,
    catalog_code: catalogCode,
    raw_value: "SIM",
    normalized_value: true,
    value_type: "boolean",
    unit: "",
    note: "",
    source_page: 1,
    source_text: catalogCode + ": SIM",
    confidence: 1
  }, overrides);
}

function setup() {
  const store = createMemoryMunicipalAdminStore({
    municipal_profiles: [
      { id: "profile-a", municipality_name: "Vitória da Conquista", state: "BA", profile_type: "official" },
      { id: "profile-b", municipality_name: "Salvador", state: "BA", profile_type: "official" }
    ],
    municipal_profile_versions: [
      { id: "active-a", profile_id: "profile-a", version_number: 1, status: "active" },
      { id: "draft-a", profile_id: "profile-a", version_number: 2, status: "draft" },
      { id: "draft-b", profile_id: "profile-b", version_number: 1, status: "draft" }
    ],
    municipal_profile_values: [
      value("old-same", "active-a", "MUN_ADM_002"),
      value("old-value", "active-a", "MUN_DOC_002", { raw_value: "SIM", normalized_value: true }),
      value("old-removed", "active-a", "MUN_DOC_003", { raw_value: "SIM", normalized_value: true }),
      value("old-source", "active-a", "MUN_ADM_001", { raw_value: "Prefeitura A", normalized_value: "Prefeitura A", value_type: "text", source_page: 12, source_text: "Prefeitura A" }),
      value("old-type", "active-a", "MUN_INF_001", { raw_value: "5", normalized_value: 5, value_type: "number", unit: "un" }),
      value("old-unit", "active-a", "MUN_DOC_004", { raw_value: "5", normalized_value: 5, value_type: "number", unit: "un" }),
      value("old-confidence", "active-a", "MUN_FIS_001", { raw_value: "SIM", normalized_value: true, confidence: 0.4 }),
      value("new-same", "draft-a", "MUN_ADM_002"),
      value("new-value", "draft-a", "MUN_DOC_002", { raw_value: "NÃO", normalized_value: false }),
      value("new-added", "draft-a", "MUN_INF_002", { raw_value: "6", normalized_value: 6, value_type: "number", unit: "dias" }),
      value("new-source", "draft-a", "MUN_ADM_001", { raw_value: "Prefeitura A", normalized_value: "Prefeitura A", value_type: "text", source_page: 14, source_text: "Prefeitura A pagina 14" }),
      value("new-type", "draft-a", "MUN_INF_001", { raw_value: "5%", normalized_value: 5, value_type: "percentage", unit: "%" }),
      value("new-unit", "draft-a", "MUN_DOC_004", { raw_value: "5", normalized_value: 5, value_type: "number", unit: "cm" }),
      value("new-confidence", "draft-a", "MUN_FIS_001", { raw_value: "SIM", normalized_value: true, confidence: 0.9 })
    ],
    municipal_admin_audit_log: []
  });
  return { store, service: createMunicipalProfileDiffService({ store }) };
}

async function rejectsCode(promise, status, code) {
  await assert.rejects(promise, (err) => err && err.status === status && err.code === code);
}

test("compareMunicipalProfileVersions classifica VALUE, ADDED, REMOVED, UNCHANGED, SOURCE, TYPE, UNIT e CONFIDENCE", () => {
  const { store } = setup();
  const before = store.tables.municipal_profile_values.filter((row) => row.version_id === "active-a");
  const after = store.tables.municipal_profile_values.filter((row) => row.version_id === "draft-a");
  const result = compareMunicipalProfileVersions(before, after);
  const byCode = new Map(result.rows.map((row) => [row.catalog_code, row]));

  assert.equal(byCode.get("MUN_ADM_002").status, "UNCHANGED");
  assert.equal(byCode.get("MUN_DOC_002").status, "CHANGED");
  assert.ok(byCode.get("MUN_DOC_002").change_types.includes("VALUE_CHANGED"));
  assert.equal(byCode.get("MUN_INF_002").status, "ADDED");
  assert.equal(byCode.get("MUN_DOC_003").status, "REMOVED");
  assert.ok(byCode.get("MUN_ADM_001").change_types.includes("SOURCE_CHANGED"));
  assert.ok(byCode.get("MUN_INF_001").change_types.includes("TYPE_CHANGED"));
  assert.ok(byCode.get("MUN_INF_001").change_types.includes("UNIT_CHANGED"));
  assert.ok(byCode.get("MUN_DOC_004").change_types.includes("UNIT_CHANGED"));
  assert.ok(byCode.get("MUN_FIS_001").change_types.includes("CONFIDENCE_CHANGED"));
  assert.equal(result.summary.totalBefore, before.length);
  assert.equal(result.summary.totalAfter, after.length);
  assert.equal(result.summary.added, 1);
  assert.equal(result.summary.removed, 1);
  assert.equal(result.summary.unchanged, 1);
  assert.equal(result.summary.valueChanged, 1);
  assert.equal(result.summary.sourceChanged, 1);
  assert.equal(result.summary.typeChanged, 1);
});

test("getMunicipalProfileVersionDiff resolve active vs draft e nao altera active", async () => {
  const { service, store } = setup();
  const beforeActive = Object.assign({}, store.tables.municipal_profile_versions.find((row) => row.id === "active-a"));
  const result = await service.getMunicipalProfileVersionDiff(ctx(), "profile-a");

  assert.equal(result.fromVersion.id, "active-a");
  assert.equal(result.toVersion.id, "draft-a");
  assert.equal(result.summary.changed, 5);
  assert.deepEqual(store.tables.municipal_profile_versions.find((row) => row.id === "active-a"), beforeActive);
  assert.equal(store.tables.municipal_admin_audit_log.length, 0);
});

test("getMunicipalProfileVersionDiff bloqueia perfis diferentes e versao inexistente", async () => {
  const { service } = setup();
  await rejectsCode(service.getMunicipalProfileVersionDiff(ctx(), "profile-a", { from: "active-a", to: "draft-b" }), 400, "municipal_profile_diff_profile_mismatch");
  await rejectsCode(service.getMunicipalProfileVersionDiff(ctx(), "profile-a", { from: "missing", to: "draft-a" }), 404, "municipal_profile_version_not_found");
});
