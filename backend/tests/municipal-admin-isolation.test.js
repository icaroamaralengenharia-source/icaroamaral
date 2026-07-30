import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";

function createAuthMock(store) {
  const users = {
    platform: { id: "platform-user", email: "platform@example.com" },
    adminA: { id: "admin-a", email: "admin-a@example.com" },
    adminB: { id: "admin-b", email: "admin-b@example.com" },
    gestorA: { id: "gestor-a", email: "gestor-a@example.com" },
    newUser: { id: "new-user", email: "novo@example.com", user_metadata: { name: "Novo Usuario" } }
  };
  let activeUserId = "";
  return {
    auth: {
      async getUser(token) {
        const user = users[token];
        if (!user) return { data: null, error: new Error("invalid") };
        activeUserId = user.id;
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
                  const profile = store.tables.profiles.find((item) => item.auth_user_id === value || item.auth_user_id === activeUserId) || null;
                  return { data: profile, error: null };
                }
              };
            }
          };
        }
      };
    }
  };
}

function createStore() {
  return createMemoryMunicipalAdminStore({
    institutions: [
      { id: "inst-a", name: "Prefeitura A", status: "active", city: "A", state: "BA" },
      { id: "inst-b", name: "Prefeitura B", status: "active", city: "B", state: "BA" }
    ],
    units: [
      { id: "unit-a", institution_id: "inst-a", name: "Almox A", code: "A", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Almox B", code: "B", status: "active" }
    ],
    profiles: [
      { id: "profile-platform", auth_user_id: "platform-user", institution_id: "", unit_id: null, role: "platform_admin", status: "active", email: "platform@example.com", name: "Platform" },
      { id: "profile-admin-a", auth_user_id: "admin-a", institution_id: "inst-a", unit_id: null, role: "municipal_admin", status: "active", email: "admin-a@example.com", name: "Admin A" },
      { id: "profile-admin-b", auth_user_id: "admin-b", institution_id: "inst-b", unit_id: null, role: "municipal_admin", status: "active", email: "admin-b@example.com", name: "Admin B" },
      { id: "profile-gestor-a", auth_user_id: "gestor-a", institution_id: "inst-a", unit_id: "unit-a", role: "gestor", status: "active", email: "gestor-a@example.com", name: "Gestor A" }
    ],
    municipal_admin_invites: [],
    municipal_admin_audit_log: []
  });
}

async function withServer(callback) {
  const store = createStore();
  const auth = createAuthMock(store);
  const app = createApp({
    authContextSupabaseClient: auth,
    municipalAdminSupabaseClient: auth,
    municipalAdminStore: store
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

test("rotas municipais aplicam permissoes, isolamento e convite seguro", async () => {
  await withServer(async (base, store) => {
    const created = await json(base, "/api/municipal-admin/institutions", {
      method: "POST",
      headers: auth("platform"),
      body: JSON.stringify({ name: "Prefeitura Nova", city: "Feira", state: "BA" })
    });
    assert.equal(created.response.status, 200);
    assert.equal(created.data.institution.name, "Prefeitura Nova");

    const deniedInstitution = await json(base, "/api/municipal-admin/institutions", {
      method: "POST",
      headers: auth("adminA"),
      body: JSON.stringify({ name: "Tentativa" })
    });
    assert.equal(deniedInstitution.response.status, 403);

    const unit = await json(base, "/api/municipal-admin/institutions/inst-a/units", {
      method: "POST",
      headers: auth("adminA"),
      body: JSON.stringify({ name: "Almox Obras", code: "OBRAS" })
    });
    assert.equal(unit.response.status, 200);
    assert.equal(unit.data.unit.institution_id, "inst-a");

    const crossUnit = await json(base, "/api/municipal-admin/institutions/inst-b/units", {
      method: "POST",
      headers: auth("adminA"),
      body: JSON.stringify({ name: "Nao pode" })
    });
    assert.equal(crossUnit.response.status, 403);

    const invite = await json(base, "/api/municipal-admin/institutions/inst-a/invites", {
      method: "POST",
      headers: auth("gestorA"),
      body: JSON.stringify({ email: "novo@example.com", role: "funcionario", unit_id: "unit-a" })
    });
    assert.equal(invite.response.status, 200);
    assert.equal(invite.data.invite.token_hash, undefined);
    assert.ok(invite.data.invite_token);
    assert.equal(store.tables.municipal_admin_invites[0].token_hash.length, 64);

    const accepted = await json(base, "/api/municipal-admin/invites/" + invite.data.invite_token + "/accept", {
      method: "POST",
      headers: auth("newUser")
    });
    assert.equal(accepted.response.status, 200);
    assert.equal(accepted.data.profile.auth_user_id, "new-user");
    assert.equal(accepted.data.profile.unit_id, "unit-a");

    const reused = await json(base, "/api/municipal-admin/invites/" + invite.data.invite_token + "/accept", {
      method: "POST",
      headers: auth("newUser")
    });
    assert.equal(reused.response.status, 404);

    const crossUsers = await json(base, "/api/municipal-admin/institutions/inst-b/users", { headers: auth("adminA") });
    assert.equal(crossUsers.response.status, 403);

    const ownUsers = await json(base, "/api/municipal-admin/institutions/inst-a/users", { headers: auth("adminA") });
    assert.equal(ownUsers.response.status, 200);
    assert.ok(ownUsers.data.users.every((user) => user.institution_id === "inst-a"));

    const me = await json(base, "/api/municipal-admin/me", { headers: auth("gestorA") });
    assert.equal(me.response.status, 200);
    assert.equal(me.data.me.institution_id, "inst-a");
    assert.deepEqual(me.data.me.allowed_units.map((item) => item.id), ["unit-a"]);
  });
});

test("usuario desativado perde acesso e rotas antigas de health continuam intactas", async () => {
  await withServer(async (base, store) => {
    const healthSaude = await json(base, "/api/stock-saude/health");
    assert.equal(healthSaude.response.status, 200);
    assert.equal(healthSaude.data.module, "stock-saude");
    const healthFull = await json(base, "/api/stock-full/health");
    assert.equal(healthFull.response.status, 200);
    assert.equal(healthFull.data.module, "stock-full");

    const deactivated = await json(base, "/api/municipal-admin/users/gestor-a/deactivate", {
      method: "POST",
      headers: auth("adminA")
    });
    assert.equal(deactivated.response.status, 200);
    assert.equal(store.tables.profiles.find((item) => item.auth_user_id === "gestor-a").status, "inactive");

    const after = await json(base, "/api/municipal-admin/me", { headers: auth("gestorA") });
    assert.equal(after.response.status, 403);
    assert.equal(after.data.error, "user_inactive");
  });
});