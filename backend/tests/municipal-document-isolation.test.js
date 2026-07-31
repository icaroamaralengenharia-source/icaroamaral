import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";

function createStore() {
  return createMemoryMunicipalAdminStore({
    institutions: [
      { id: "inst-a", name: "Prefeitura A", status: "active" },
      { id: "inst-b", name: "Prefeitura B", status: "active" }
    ],
    units: [
      { id: "unit-a", institution_id: "inst-a", name: "Almox A", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Almox B", status: "active" }
    ],
    profiles: [
      { id: "profile-platform", auth_user_id: "platform-user", institution_id: "", unit_id: null, role: "platform_admin", status: "active", email: "platform@example.com" },
      { id: "profile-admin-a", auth_user_id: "admin-a", institution_id: "inst-a", unit_id: null, role: "municipal_admin", status: "active", email: "admin-a@example.com" },
      { id: "profile-admin-b", auth_user_id: "admin-b", institution_id: "inst-b", unit_id: null, role: "municipal_admin", status: "active", email: "admin-b@example.com" },
      { id: "profile-gestor-a", auth_user_id: "gestor-a", institution_id: "inst-a", unit_id: "unit-a", role: "gestor", status: "active", email: "gestor-a@example.com" },
      { id: "profile-leitura-a", auth_user_id: "leitura-a", institution_id: "inst-a", unit_id: null, role: "leitura", status: "active", email: "leitura-a@example.com" }
    ],
    municipal_documents: [],
    municipal_document_versions: [],
    municipal_admin_audit_log: []
  });
}

function createAuthMock(store) {
  const users = {
    platform: { id: "platform-user", email: "platform@example.com" },
    adminA: { id: "admin-a", email: "admin-a@example.com" },
    adminB: { id: "admin-b", email: "admin-b@example.com" },
    gestorA: { id: "gestor-a", email: "gestor-a@example.com" },
    leituraA: { id: "leitura-a", email: "leitura-a@example.com" }
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

async function json(base, path, options = {}) {
  const response = await fetch(base + path, Object.assign({}, options, {
    headers: Object.assign({ "Content-Type": "application/json", Origin: "http://127.0.0.1:5500" }, options.headers || {})
  }));
  return { response, data: await response.json() };
}

function auth(token) {
  return { Authorization: "Bearer " + token };
}

test("rotas do acervo documental municipal aplicam escopo e nao expõem storage_path", async () => {
  await withServer(async (base, store) => {
    const created = await json(base, "/api/municipal-admin/documents", {
      method: "POST",
      headers: auth("adminA"),
      body: JSON.stringify({ title: "Inventario A", document_type: "inventario", unit_id: "unit-a" })
    });
    assert.equal(created.response.status, 200);
    assert.equal(created.data.document.institution_id, "inst-a");

    const gestorDenied = await json(base, "/api/municipal-admin/documents", {
      method: "POST",
      headers: auth("gestorA"),
      body: JSON.stringify({ title: "Externo", document_type: "relatorio", unit_id: "unit-b" })
    });
    assert.equal(gestorDenied.response.status, 403);

    const readDenied = await json(base, "/api/municipal-admin/documents", {
      method: "POST",
      headers: auth("leituraA"),
      body: JSON.stringify({ title: "Nao cria", document_type: "nota" })
    });
    assert.equal(readDenied.response.status, 403);

    const version = await json(base, "/api/municipal-admin/documents/" + created.data.document.id + "/versions", {
      method: "POST",
      headers: auth("adminA"),
      body: JSON.stringify({ original_filename: "inventario.pdf", mime_type: "application/pdf", file_reference: "https://example.test/inventario.pdf" })
    });
    assert.equal(version.response.status, 200);
    assert.equal(version.data.version.version_number, 1);
    store.tables.municipal_document_versions[0].storage_path = "private/raw/inventario.pdf";

    const unsafe = await json(base, "/api/municipal-admin/documents/" + created.data.document.id + "/versions", {
      method: "POST",
      headers: auth("adminA"),
      body: JSON.stringify({ file_reference: "storage://bucket/private.pdf" })
    });
    assert.equal(unsafe.response.status, 400);

    const download = await json(base, "/api/municipal-admin/documents/" + created.data.document.id + "/download", { headers: auth("leituraA") });
    assert.equal(download.response.status, 200);
    assert.equal(download.data.download.storage_path, undefined);
    assert.equal(download.data.download.file_reference, "https://example.test/inventario.pdf");

    const otherTenant = await json(base, "/api/municipal-admin/documents/" + created.data.document.id, { headers: auth("adminB") });
    assert.equal(otherTenant.response.status, 403);

    const listA = await json(base, "/api/municipal-admin/documents", { headers: auth("adminA") });
    assert.equal(listA.response.status, 200);
    assert.ok(listA.data.documents.every((item) => item.institution_id === "inst-a"));

    const archived = await json(base, "/api/municipal-admin/documents/" + created.data.document.id + "/archive", {
      method: "POST",
      headers: auth("adminA")
    });
    assert.equal(archived.response.status, 200);
    assert.equal(archived.data.document.status, "archived");

    const versionAfterArchive = await json(base, "/api/municipal-admin/documents/" + created.data.document.id + "/versions", {
      method: "POST",
      headers: auth("adminA"),
      body: JSON.stringify({ file_reference: "https://example.test/v2.pdf" })
    });
    assert.equal(versionAfterArchive.response.status, 409);

    assert.deepEqual(store.tables.municipal_admin_audit_log.map((item) => item.action), [
      "document_created",
      "document_version_created",
      "document_downloaded",
      "document_archived"
    ]);
  });
});

test("acervo ELO por obra permanece roteado separadamente", async () => {
  await withServer(async (base) => {
    const archive = await json(base, "/api/elo/projects/obra-a/archive");
    assert.notEqual(archive.response.status, 404);
    assert.notEqual(archive.data.error, "api_route_not_found");
    assert.notEqual(archive.data.error, "document_not_found");
  });
});
