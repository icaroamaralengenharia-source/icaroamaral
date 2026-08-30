import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";

function createStore() {
  return createMemoryMunicipalAdminStore({
    profiles: [
      { id: "profile-leitura", auth_user_id: "leitura-user", institution_id: "inst-a", unit_id: null, role: "leitura", status: "active", email: "leitura@example.com" }
    ],
    municipal_profiles: [
      { id: "mprof-a", municipality_name: "Vitória da Conquista", state: "BA", profile_type: "official" },
      { id: "mprof-b", municipality_name: "Salvador", state: "BA", profile_type: "official" }
    ],
    municipal_profile_versions: [
      { id: "mver-active", profile_id: "mprof-a", version_number: 1, status: "active" },
      { id: "mver-draft", profile_id: "mprof-a", version_number: 2, status: "draft" },
      { id: "mver-other", profile_id: "mprof-b", version_number: 1, status: "draft" }
    ],
    municipal_profile_values: [
      { id: "old-a", version_id: "mver-active", catalog_code: "MUN_DOC_002", raw_value: "SIM", normalized_value: true, value_type: "boolean", unit: "", note: "", source_page: 1, source_text: "relatorio obrigatorio sim", confidence: 1 },
      { id: "old-b", version_id: "mver-active", catalog_code: "MUN_DOC_003", raw_value: "SIM", normalized_value: true, value_type: "boolean", unit: "", note: "", source_page: 2, source_text: "acervo ativo sim", confidence: 1 },
      { id: "new-a", version_id: "mver-draft", catalog_code: "MUN_DOC_002", raw_value: "NÃO", normalized_value: false, value_type: "boolean", unit: "", note: "", source_page: 3, source_text: "relatorio obrigatorio nao", confidence: 1 },
      { id: "new-c", version_id: "mver-draft", catalog_code: "MUN_INF_001", raw_value: "6", normalized_value: 6, value_type: "number", unit: "un", note: "", source_page: 4, source_text: "minimo 6", confidence: 0.8 }
    ],
    municipal_admin_audit_log: []
  });
}

function createAuthMock(store) {
  return {
    auth: {
      async getUser(token) {
        if (token !== "leitura") return { data: null, error: new Error("invalid") };
        return { data: { user: { id: "leitura-user", email: "leitura@example.com" } }, error: null };
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
  const app = createApp({
    authContextSupabaseClient: auth,
    municipalAdminSupabaseClient: auth,
    municipalAdminStore: store,
    env: { ELO_ARCHIVE_ENABLED: "false" }
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port, store);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function getJson(base, path) {
  const response = await fetch(base + path, {
    headers: { Authorization: "Bearer leitura", Origin: "http://127.0.0.1:5500" }
  });
  return { response, data: await response.json() };
}

test("rota M05 retorna diff active vs draft sem ativar versao", async () => {
  await withServer(async (base, store) => {
    const result = await getJson(base, "/api/municipal-admin/municipal-profiles/mprof-a/diff");

    assert.equal(result.response.status, 200);
    assert.equal(result.data.fromVersion.id, "mver-active");
    assert.equal(result.data.toVersion.id, "mver-draft");
    assert.equal(result.data.summary.added, 1);
    assert.equal(result.data.summary.removed, 1);
    assert.equal(result.data.summary.valueChanged, 1);
    assert.ok(result.data.rows.find((row) => row.catalog_code === "MUN_DOC_002").change_types.includes("VALUE_CHANGED"));
    assert.equal(store.tables.municipal_profile_versions.find((row) => row.id === "mver-active").status, "active");
  });
});

test("rota M05 valida mismatch de perfil e versao inexistente", async () => {
  await withServer(async (base) => {
    const mismatch = await getJson(base, "/api/municipal-admin/municipal-profiles/mprof-a/diff?from=mver-active&to=mver-other");
    assert.equal(mismatch.response.status, 400);
    assert.equal(mismatch.data.error, "municipal_profile_diff_profile_mismatch");

    const missing = await getJson(base, "/api/municipal-admin/municipal-profiles/mprof-a/diff?from=missing&to=mver-draft");
    assert.equal(missing.response.status, 404);
    assert.equal(missing.data.error, "municipal_profile_version_not_found");
  });
});
