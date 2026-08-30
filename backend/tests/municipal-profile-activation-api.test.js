import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";

function createStore() {
  return createMemoryMunicipalAdminStore({
    profiles: [
      { id: "profile-platform", auth_user_id: "platform-user", institution_id: "", unit_id: null, role: "platform_admin", status: "active", email: "platform@example.com" }
    ],
    municipal_profiles: [
      { id: "mprof-a", municipality_name: "Vitória da Conquista", municipality_key: "vitoria-da-conquista", state: "BA", profile_type: "official", profile_key: "BA:vitoria-da-conquista:official" },
      { id: "mprof-b", municipality_name: "Salvador", municipality_key: "salvador", state: "BA", profile_type: "official", profile_key: "BA:salvador:official" }
    ],
    municipal_profile_versions: [
      { id: "mver-active", profile_id: "mprof-a", version_number: 1, status: "active", effective_from: "2026-01-01" },
      { id: "mver-draft", profile_id: "mprof-a", version_number: 2, status: "draft", effective_from: "2026-03-01" },
      { id: "mver-other", profile_id: "mprof-b", version_number: 1, status: "draft", effective_from: "2026-03-01" }
    ],
    municipal_profile_values: [
      { id: "old-a", version_id: "mver-active", catalog_code: "MUN_DOC_002", raw_value: "SIM", normalized_value: true, value_type: "boolean", unit: "", note: "", source_page: 1, source_text: "relatorio sim", confidence: 1 },
      { id: "new-a", version_id: "mver-draft", catalog_code: "MUN_DOC_002", raw_value: "NÃO", normalized_value: false, value_type: "boolean", unit: "", note: "", source_page: 2, source_text: "relatorio nao", confidence: 1 }
    ],
    municipal_profile_imports: [
      { id: "mimp-a", profile_id: "mprof-a", version_id: "mver-draft", status: "review_completed", reviewed_at: "2026-02-10T11:00:00.000Z" }
    ],
    municipal_profile_import_rows: [
      { id: "mrow-a", import_id: "mimp-a", review_status: "confirmed", catalog_code_confirmed: "MUN_DOC_002", duplicate_candidate: false, requires_review: false }
    ],
    municipal_admin_audit_log: []
  });
}

function createAuthMock(store) {
  return {
    auth: {
      async getUser(token) {
        if (token !== "platform") return { data: null, error: new Error("invalid") };
        return { data: { user: { id: "platform-user", email: "platform@example.com" } }, error: null };
      }
    },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return {
            eq(column, value) {
              assert.equal(column, "auth_user_id");
              return {
                async maybeSingle() {
                  return { data: store.tables.profiles.find((item) => item.auth_user_id === value) || null, error: null };
                }
              };
            }
          };
        }
      };
    }
  };
}

async function withServer(callback) {
  const store = createStore();
  const auth = createAuthMock(store);
  const app = createApp({ authContextSupabaseClient: auth, municipalAdminSupabaseClient: auth, municipalAdminStore: store, env: { ELO_ARCHIVE_ENABLED: "false" } });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port, store);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function json(base, path, body) {
  const response = await fetch(base + path, {
    method: "PUT",
    headers: { Authorization: "Bearer platform", Origin: "http://127.0.0.1:5500", "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  return { response, data: await response.json() };
}

test("rota M06 ativa versao revisada com confirmacao explicita", async () => {
  await withServer(async (base, store) => {
    const result = await json(base, "/api/municipal-admin/municipal-profiles/mprof-a/activate", { versionId: "mver-draft", confirmation: true });

    assert.equal(result.response.status, 200);
    assert.equal(result.data.version.id, "mver-draft");
    assert.equal(result.data.version.status, "active");
    assert.equal(result.data.previousVersion.status, "archived");
    assert.equal(result.data.diffSummary.valueChanged, 1);
    assert.equal(store.tables.municipal_profile_versions.filter((row) => row.profile_id === "mprof-a" && row.status === "active").length, 1);
    assert.equal(store.tables.municipal_admin_audit_log.at(-1).action, "municipal_profile_version_activated");
  });
});

test("rota M06 bloqueia sem versionId, sem confirmation e cross-profile", async () => {
  await withServer(async (base) => {
    const missingVersion = await json(base, "/api/municipal-admin/municipal-profiles/mprof-a/activate", { confirmation: true });
    assert.equal(missingVersion.response.status, 400);
    assert.equal(missingVersion.data.error, "municipal_profile_activation_version_required");

    const missingConfirmation = await json(base, "/api/municipal-admin/municipal-profiles/mprof-a/activate", { versionId: "mver-draft" });
    assert.equal(missingConfirmation.response.status, 400);
    assert.equal(missingConfirmation.data.error, "municipal_profile_activation_confirmation_required");

    const mismatch = await json(base, "/api/municipal-admin/municipal-profiles/mprof-a/activate", { versionId: "mver-other", confirmation: true });
    assert.equal(mismatch.response.status, 400);
    assert.equal(mismatch.data.error, "municipal_profile_activation_profile_mismatch");
  });
});
