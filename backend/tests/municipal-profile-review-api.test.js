import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";

function createStore() {
  return createMemoryMunicipalAdminStore({
    profiles: [
      { id: "profile-platform", auth_user_id: "platform-user", institution_id: "", unit_id: null, role: "platform_admin", status: "active", email: "platform@example.com" },
      { id: "profile-leitura", auth_user_id: "leitura-user", institution_id: "inst-a", unit_id: null, role: "leitura", status: "active", email: "leitura@example.com" }
    ],
    municipal_profiles: [
      { id: "mprof-a", municipality_name: "Vitória da Conquista", municipality_key: "vitoria-da-conquista", state: "BA", profile_type: "official", profile_key: "BA:vitoria-da-conquista:official" }
    ],
    municipal_profile_versions: [
      { id: "mver-a", profile_id: "mprof-a", version_number: 1, status: "draft", source_hash: "HASH_A" }
    ],
    municipal_profile_values: [],
    municipal_profile_imports: [
      { id: "mimp-a", profile_id: "mprof-a", version_id: "mver-a", file_name: "perfil.pdf", source_hash: "HASH_A", status: "draft_review", created_by: "platform-user" }
    ],
    municipal_profile_import_rows: [
      { id: "mrow-a", import_id: "mimp-a", page: 1, raw_label: "Unidade operacional obrigatoria", raw_value: "SIM", raw_text: "Unidade operacional obrigatoria: SIM", catalog_code_suggested: "MUN_ADM_002", normalized_value_suggested: true, value_type: "boolean", confidence: "HIGH", duplicate_candidate: false, requires_review: false, review_status: "pending" },
      { id: "mrow-b", import_id: "mimp-a", page: 1, raw_label: "Linha sem mapeamento", raw_value: "dado", raw_text: "Linha sem mapeamento: dado", catalog_code_suggested: null, normalized_value_suggested: null, value_type: null, confidence: "UNMATCHED", duplicate_candidate: false, requires_review: true, review_status: "pending" }
    ],
    municipal_admin_audit_log: []
  });
}

function createAuthMock(store) {
  const users = {
    platform: { id: "platform-user", email: "platform@example.com" },
    leitura: { id: "leitura-user", email: "leitura@example.com" }
  };
  return {
    auth: {
      async getUser(token) {
        const user = users[token];
        if (!user) return { data: null, error: new Error("invalid") };
        return { data: { user }, error: null };
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

function auth(token) {
  return { Authorization: "Bearer " + token };
}

async function json(base, path, options = {}) {
  const response = await fetch(base + path, Object.assign({}, options, {
    headers: Object.assign({ "Content-Type": "application/json", Origin: "http://127.0.0.1:5500" }, options.headers || {})
  }));
  return { response, data: await response.json() };
}

test("rotas M04 retornam import e salvam revisao sem ativar versao", async () => {
  await withServer(async (base, store) => {
    const loaded = await json(base, "/api/municipal-admin/municipal-profile-imports/mimp-a", { headers: auth("leitura") });
    assert.equal(loaded.response.status, 200);
    assert.equal(loaded.data.import.file_name, "perfil.pdf");
    assert.equal(loaded.data.summary.total, 2);

    const reviewed = await json(base, "/api/municipal-admin/municipal-profile-imports/mimp-a/review", {
      method: "PUT",
      headers: auth("platform"),
      body: JSON.stringify({
        decisions: [
          { rowId: "mrow-a", reviewStatus: "confirmed", catalogCodeConfirmed: "MUN_ADM_002", normalizedValueConfirmed: true },
          { rowId: "mrow-b", reviewStatus: "ignored", reviewNote: "fora do perfil" }
        ]
      })
    });
    assert.equal(reviewed.response.status, 200);
    assert.equal(reviewed.data.import.status, "review_completed");
    assert.equal(store.tables.municipal_profile_versions[0].status, "draft");
    assert.equal(store.tables.municipal_profile_values[0].catalog_code, "MUN_ADM_002");
    assert.ok(store.tables.municipal_admin_audit_log.some((row) => row.action === "municipal_import_review_completed"));
  });
});
