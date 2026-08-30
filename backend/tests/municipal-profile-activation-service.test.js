import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalProfileService } from "../src/municipal-profile-service.js";

function ctx(role = "platform_admin") {
  return {
    ok: true,
    userId: role + "-user",
    institutionId: "",
    role,
    profile: { id: role + "-profile", auth_user_id: role + "-user", role, status: "active" }
  };
}

function value(id, versionId, code, overrides = {}) {
  return Object.assign({
    id,
    version_id: versionId,
    catalog_code: code,
    raw_value: "SIM",
    normalized_value: true,
    value_type: "boolean",
    unit: "",
    note: "",
    source_page: 1,
    source_text: code + ": SIM",
    confidence: 1
  }, overrides);
}

function reviewImport(status = "review_completed", rows = null) {
  return {
    imports: [{ id: "imp-draft", profile_id: "profile-a", version_id: "draft-a", status, reviewed_at: "2026-02-10T11:00:00.000Z" }],
    rows: rows || [
      { id: "row-a", import_id: "imp-draft", review_status: "confirmed", catalog_code_confirmed: "MUN_DOC_002", duplicate_candidate: false, requires_review: false },
      { id: "row-b", import_id: "imp-draft", review_status: "corrected", catalog_code_confirmed: "MUN_INF_001", duplicate_candidate: false, requires_review: false }
    ]
  };
}

function setup(extra = {}) {
  const review = extra.review || reviewImport();
  const store = createMemoryMunicipalAdminStore({
    municipal_profiles: [
      { id: "profile-a", municipality_name: "Vitória da Conquista", municipality_key: "vitoria-da-conquista", state: "BA", profile_type: "official", profile_key: "BA:vitoria-da-conquista:official" },
      { id: "profile-b", municipality_name: "Salvador", municipality_key: "salvador", state: "BA", profile_type: "official", profile_key: "BA:salvador:official" }
    ],
    municipal_profile_versions: [
      { id: "active-a", profile_id: "profile-a", version_number: 1, status: "active", effective_from: "2026-01-01" },
      { id: "draft-a", profile_id: "profile-a", version_number: 2, status: "draft", effective_from: extra.effectiveFrom === undefined ? "2026-03-01" : extra.effectiveFrom },
      { id: "archived-a", profile_id: "profile-a", version_number: 0, status: "archived", effective_from: "2025-01-01" },
      { id: "draft-b", profile_id: "profile-b", version_number: 1, status: "draft", effective_from: "2026-03-01" }
    ],
    municipal_profile_values: extra.values || [
      value("old-a", "active-a", "MUN_DOC_002", { raw_value: "SIM", normalized_value: true }),
      value("new-a", "draft-a", "MUN_DOC_002", { raw_value: "NÃO", normalized_value: false }),
      value("new-b", "draft-a", "MUN_INF_001", { raw_value: "6", normalized_value: 6, value_type: "number", unit: "un" })
    ],
    municipal_profile_imports: review.imports,
    municipal_profile_import_rows: review.rows,
    municipal_admin_audit_log: []
  });
  const cacheEvents = [];
  const service = createMunicipalProfileService({
    store,
    now: () => new Date("2026-02-10T12:00:00.000Z"),
    invalidateMunicipalProfileCache(profileId, details) {
      cacheEvents.push({ profileId, details });
      return { invalidated: true, profileId, details };
    }
  });
  return { store, service, cacheEvents };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("M06 ativa draft revisado com confirmacao, arquiva active anterior, audita diff e invalida cache", async () => {
  const { service, store, cacheEvents } = setup();
  const result = await service.activateControlledMunicipalProfileVersion(ctx(), "profile-a", { versionId: "draft-a", confirmation: true });

  assert.equal(result.previousVersion.status, "archived");
  assert.equal(result.version.status, "active");
  assert.equal(result.diffSummary.added, 1);
  assert.equal(result.diffSummary.valueChanged, 1);
  assert.equal(cacheEvents.length, 1);
  assert.equal(cacheEvents[0].profileId, "profile-a");
  assert.equal(store.tables.municipal_profile_versions.filter((row) => row.profile_id === "profile-a" && row.status === "active").length, 1);
  assert.equal(store.tables.municipal_profile_versions.find((row) => row.id === "active-a").status, "archived");
  assert.equal(store.tables.municipal_profile_versions.find((row) => row.id === "draft-a").status, "active");
  assert.deepEqual(store.tables.municipal_profile_versions.map((row) => row.id), ["active-a", "draft-a", "archived-a", "draft-b"]);
  const actions = store.tables.municipal_admin_audit_log.map((row) => row.action);
  assert.ok(actions.includes("municipal_profile_version_activation_started"));
  assert.ok(actions.includes("municipal_profile_version_archived"));
  assert.ok(actions.includes("municipal_profile_version_activated"));
  assert.equal(store.tables.municipal_admin_audit_log.find((row) => row.action === "municipal_profile_version_activated").metadata.diffSummary.added, 1);

  const active = await service.getActiveMunicipalProfile(ctx("leitura"), { municipality: "Vitoria da Conquista", state: "BA", profileType: "official" });
  assert.equal(active.version.id, "draft-a");
});

test("M06 bloqueia confirmacao ausente, data ausente, status invalido e versao de outro perfil", async () => {
  await rejectsCode(setup().service.activateControlledMunicipalProfileVersion(ctx(), "profile-a", { versionId: "draft-a", confirmation: false }), "municipal_profile_activation_confirmation_required");
  await rejectsCode(setup({ effectiveFrom: null }).service.activateControlledMunicipalProfileVersion(ctx(), "profile-a", { versionId: "draft-a", confirmation: true }), "municipal_profile_activation_effective_from_required");
  await rejectsCode(setup().service.activateControlledMunicipalProfileVersion(ctx(), "profile-a", { versionId: "active-a", confirmation: true }), "municipal_profile_version_not_draft");
  await rejectsCode(setup().service.activateControlledMunicipalProfileVersion(ctx(), "profile-a", { versionId: "archived-a", confirmation: true }), "municipal_profile_version_not_draft");
  await rejectsCode(setup().service.activateControlledMunicipalProfileVersion(ctx(), "profile-a", { versionId: "draft-b", confirmation: true }), "municipal_profile_activation_profile_mismatch");
  await rejectsCode(setup().service.activateControlledMunicipalProfileVersion(ctx(), "profile-a", { confirmation: true }), "municipal_profile_activation_version_required");
});

test("M06 bloqueia revisao incompleta, duplicidade e valor invalido", async () => {
  await rejectsCode(setup({ review: reviewImport("draft_review") }).service.activateControlledMunicipalProfileVersion(ctx(), "profile-a", { versionId: "draft-a", confirmation: true }), "municipal_profile_activation_review_incomplete");
  await rejectsCode(setup({ review: reviewImport("review_completed", [
    { id: "row-a", import_id: "imp-draft", review_status: "confirmed", catalog_code_confirmed: "MUN_DOC_002" },
    { id: "row-b", import_id: "imp-draft", review_status: "confirmed", catalog_code_confirmed: "MUN_DOC_002" }
  ]) }).service.activateControlledMunicipalProfileVersion(ctx(), "profile-a", { versionId: "draft-a", confirmation: true }), "municipal_profile_activation_duplicate_unresolved");
  await rejectsCode(setup({ values: [value("new-a", "draft-a", "MUN_DOC_002", { normalized_value: null })] }).service.activateControlledMunicipalProfileVersion(ctx(), "profile-a", { versionId: "draft-a", confirmation: true }), "municipal_profile_value_invalid");
});

test("M06 restaura status se falhar depois de arquivar active", async () => {
  const { store, service } = setup();
  const originalUpdate = store.update.bind(store);
  store.update = async (table, id, patch) => {
    if (table === "municipal_profile_versions" && id === "draft-a" && patch.status === "active") {
      const err = new Error("forced_activation_failure");
      err.status = 500;
      err.code = "forced_activation_failure";
      throw err;
    }
    return originalUpdate(table, id, patch);
  };

  await rejectsCode(service.activateControlledMunicipalProfileVersion(ctx(), "profile-a", { versionId: "draft-a", confirmation: true }), "forced_activation_failure");
  assert.equal(store.tables.municipal_profile_versions.find((row) => row.id === "active-a").status, "active");
  assert.equal(store.tables.municipal_profile_versions.find((row) => row.id === "draft-a").status, "draft");
  assert.ok(store.tables.municipal_admin_audit_log.some((row) => row.action === "municipal_profile_version_activation_failed"));
});
