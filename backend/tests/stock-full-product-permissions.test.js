import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";

function createSupabaseProductMock() {
  const sessions = {
    "token-admin-a": {
      user: { id: "auth-admin-a", email: "admin-a@example.com" },
      profile: { id: "profile-admin-a", institution_id: "inst-a", unit_id: "unit-a", name: "Admin A", email: "admin-a@example.com", role: "admin" }
    },
    "token-reader-a": {
      user: { id: "auth-reader-a", email: "reader-a@example.com" },
      profile: { id: "profile-reader-a", institution_id: "inst-a", unit_id: "unit-a", name: "Reader A", email: "reader-a@example.com", role: "leitura" }
    },
    "token-admin-b": {
      user: { id: "auth-admin-b", email: "admin-b@example.com" },
      profile: { id: "profile-admin-b", institution_id: "inst-b", unit_id: "unit-b", name: "Admin B", email: "admin-b@example.com", role: "admin" }
    }
  };
  const items = [
    { id: "item-a", institution_id: "inst-a", project_id: null, name: "Cimento", unit: "saco", category: "Obra", min_quantity: 5, current_quantity: 12, location: "A1", notes: "", is_active: true },
    { id: "item-b", institution_id: "inst-b", project_id: null, name: "Argamassa", unit: "saco", category: "Obra", min_quantity: 3, current_quantity: 9, location: "B1", notes: "", is_active: true }
  ];
  const writes = [];
  const rpcCalls = [];
  let activeUserId = "";

  function selectProfileByAuthUserId(authUserId) {
    const session = Object.values(sessions).find((candidate) => candidate.user.id === authUserId);
    return session ? session.profile : null;
  }

  function createItemQuery(table) {
    const filters = [];
    let updatePayload = null;
    return {
      insert(payload) {
        writes.push({ table, action: "insert", payload });
        const row = Object.assign({ id: "item-created", is_active: true }, payload);
        items.push(row);
        return {
          select() {
            return {
              async single() {
                return { data: row, error: null };
              }
            };
          }
        };
      },
      update(payload) {
        updatePayload = payload;
        writes.push({ table, action: "update", payload, filters });
        return this;
      },
      eq(column, value) {
        filters.push({ column, value });
        return this;
      },
      is(column, value) {
        filters.push({ column, value, isNull: value === null });
        return this;
      },
      select() {
        return this;
      },
      order() {
        return this;
      },
      then(resolve, reject) {
        try {
          const data = items.filter((item) => filters.every((filter) => filter.isNull ? item[filter.column] == null : item[filter.column] === filter.value));
          return Promise.resolve(resolve({ data, error: null }));
        } catch (error) {
          return Promise.reject(reject ? reject(error) : error);
        }
      },
      async maybeSingle() {
        const row = items.find((item) => filters.every((filter) => filter.isNull ? item[filter.column] == null : item[filter.column] === filter.value));
        if (!row) return { data: null, error: null };
        Object.assign(row, updatePayload || {});
        return { data: row, error: null };
      }
    };
  }

  return {
    writes,
    rpcCalls,
    items,
    auth: {
      async getUser(token) {
        const session = sessions[token];
        if (!session) return { data: null, error: new Error("invalid token") };
        activeUserId = session.user.id;
        return { data: { user: session.user }, error: null };
      }
    },
    from(table) {
      if (table === "profiles") {
        return {
          select() {
            return {
              eq(column, value) {
                assert.equal(column, "auth_user_id");
                assert.equal(value, activeUserId);
                return {
                  async maybeSingle() {
                    return { data: selectProfileByAuthUserId(value), error: null };
                  }
                };
              }
            };
          }
        };
      }
      return createItemQuery(table);
    },
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      const item = items.find((candidate) => candidate.id === args.p_item_id && candidate.institution_id === args.p_institution_id);
      if (!item) return { data: null, error: { message: "stock_full_item_not_found" } };
      return { data: null, error: { message: "unexpected same-tenant RPC in isolation test" } };
    }
  };
}

async function withServer(callback) {
  const supabase = createSupabaseProductMock();
  const app = createApp({ stockFullSupabaseClient: supabase });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port, supabase);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function json(url, options = {}) {
  const response = await fetch(url, Object.assign({}, options, {
    headers: Object.assign({ "Content-Type": "application/json", Origin: "http://127.0.0.1:5500" }, options.headers || {})
  }));
  return { response, data: await response.json() };
}

const productPayload = {
  name: "Cimento CP II",
  unit: "saco",
  category: "Cimento",
  minQuantity: 4,
  currentQuantity: 10,
  location: "Deposito"
};

test("Stock Full mantém isolamento Tenant A/B em listagens e operações por Direct-ID", async () => {
  await withServer(async (base, supabase) => {
    const tenants = [
      { tenant: "A", token: "token-admin-a", institutionId: "inst-a", profileId: "profile-admin-a", foreignItemId: "item-b", ownName: "Cimento", spoofedInstitutionId: "inst-b" },
      { tenant: "B", token: "token-admin-b", institutionId: "inst-b", profileId: "profile-admin-b", foreignItemId: "item-a", ownName: "Argamassa", spoofedInstitutionId: "inst-a" }
    ];

    for (const current of tenants) {
      const list = await json(base + "/api/stock-full/items", {
        headers: { Authorization: "Bearer " + current.token }
      });
      assert.equal(list.response.status, 200, "Tenant " + current.tenant + " lista o estoque");
      assert.deepEqual(list.data.items.map((item) => item.name), [current.ownName]);
      assert.equal(list.data.items.some((item) => item.id === current.foreignItemId), false);

      const update = await json(base + "/api/stock-full/items/" + current.foreignItemId, {
        method: "PUT",
        headers: { Authorization: "Bearer " + current.token },
        body: JSON.stringify(Object.assign({}, productPayload, { name: "Tentativa cross-tenant " + current.tenant }))
      });
      assert.equal(update.response.status, 404, "Direct-ID estrangeiro deve ser indistinguível de inexistente");
      assert.equal(update.data.error, "stock_full_item_not_found");

      for (const [path, type] of [["entries", "entrada"], ["exits", "saida"]]) {
        const movement = await json(base + "/api/stock-full/" + path, {
          method: "POST",
          headers: { Authorization: "Bearer " + current.token },
          body: JSON.stringify({ itemId: current.foreignItemId, quantity: 1, institutionId: current.spoofedInstitutionId })
        });
        assert.equal(movement.response.status, 404, "Movimento por Direct-ID estrangeiro deve ser negado");
        assert.equal(movement.data.error, "stock_full_item_not_found");
        const rpc = supabase.rpcCalls.at(-1);
        assert.equal(rpc.name, "stock_full_apply_movement");
        assert.equal(rpc.args.p_institution_id, current.institutionId, "tenant confiável vem do profile autenticado");
        assert.equal(rpc.args.p_profile_id, current.profileId);
        assert.equal(rpc.args.p_item_id, current.foreignItemId);
        assert.equal(rpc.args.p_movement_type, type);
        assert.equal(rpc.args.p_quantity, 1);
      }
    }

    assert.equal(supabase.items.find((item) => item.id === "item-a").name, "Cimento");
    assert.equal(supabase.items.find((item) => item.id === "item-b").name, "Argamassa");
    const directIdUpdates = supabase.writes.filter((write) => write.action === "update");
    assert.equal(directIdUpdates.length, 2);
    assert.deepEqual(directIdUpdates.map((write) => ({
      institutionId: write.filters.find((filter) => filter.column === "institution_id")?.value,
      itemId: write.filters.find((filter) => filter.column === "id")?.value
    })), [
      { institutionId: "inst-a", itemId: "item-b" },
      { institutionId: "inst-b", itemId: "item-a" }
    ]);
    assert.deepEqual(supabase.rpcCalls.map(({ args }) => ({ tenantId: args.p_institution_id, itemId: args.p_item_id, type: args.p_movement_type })), [
      { tenantId: "inst-a", itemId: "item-b", type: "entrada" },
      { tenantId: "inst-a", itemId: "item-b", type: "saida" },
      { tenantId: "inst-b", itemId: "item-a", type: "entrada" },
      { tenantId: "inst-b", itemId: "item-a", type: "saida" }
    ]);
    assert.deepEqual(supabase.items.map((item) => item.current_quantity), [12, 9]);
  });
});

test("Stock Full bloqueia criacao de produto sem autenticacao", async () => {
  await withServer(async (base, supabase) => {
    const result = await json(base + "/api/stock-full/items", {
      method: "POST",
      body: JSON.stringify(productPayload)
    });

    assert.equal(result.response.status, 401);
    assert.equal(result.data.error, "authentication_required");
    assert.equal(supabase.writes.length, 0);
  });
});

test("Stock Full exige permissao backend para writes de produto", async () => {
  await withServer(async (base, supabase) => {
    const authReader = { Authorization: "Bearer token-reader-a" };

    const create = await json(base + "/api/stock-full/items", {
      method: "POST",
      headers: authReader,
      body: JSON.stringify(productPayload)
    });
    const update = await json(base + "/api/stock-full/items/item-a", {
      method: "PUT",
      headers: authReader,
      body: JSON.stringify(Object.assign({}, productPayload, { name: "Cimento editado" }))
    });
    const remove = await json(base + "/api/stock-full/items/item-a", {
      method: "DELETE",
      headers: authReader
    });

    assert.equal(create.response.status, 403);
    assert.equal(update.response.status, 403);
    assert.equal(remove.response.status, 403);
    assert.deepEqual([create.data.error, update.data.error, remove.data.error], ["permission_denied", "permission_denied", "permission_denied"]);
    assert.equal(supabase.writes.length, 0);
    assert.equal(supabase.items.find((item) => item.id === "item-a").name, "Cimento");
  });
});

test("Stock Full permite admin escrever produto somente no proprio tenant", async () => {
  await withServer(async (base, supabase) => {
    const authAdmin = { Authorization: "Bearer token-admin-a" };

    const create = await json(base + "/api/stock-full/items", {
      method: "POST",
      headers: authAdmin,
      body: JSON.stringify(productPayload)
    });
    const update = await json(base + "/api/stock-full/items/item-a", {
      method: "PUT",
      headers: authAdmin,
      body: JSON.stringify(Object.assign({}, productPayload, { name: "Cimento revisado" }))
    });
    const crossTenant = await json(base + "/api/stock-full/items/item-b", {
      method: "PUT",
      headers: authAdmin,
      body: JSON.stringify(Object.assign({}, productPayload, { name: "Tentativa cross tenant" }))
    });
    const remove = await json(base + "/api/stock-full/items/item-a", {
      method: "DELETE",
      headers: authAdmin
    });

    assert.equal(create.response.status, 200);
    assert.equal(update.response.status, 200);
    assert.equal(crossTenant.response.status, 404);
    assert.equal(crossTenant.data.error, "stock_full_item_not_found");
    assert.equal(remove.response.status, 200);
    assert.equal(supabase.items.find((item) => item.id === "item-a").is_active, false);
    assert.equal(supabase.items.find((item) => item.id === "item-b").name, "Argamassa");
  });
});
test("Stock Full permite listar estoque geral sem obra e mantem isolamento por tenant", async () => {
  await withServer(async (base) => {
    const result = await json(base + "/api/stock-full/items", {
      headers: { Authorization: "Bearer token-admin-a" }
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.data.ok, true);
    assert.deepEqual(result.data.items.map((item) => item.name), ["Cimento"]);
    assert.equal(result.data.items[0].projectId, "");
  });
});

test("Stock Full não retorna WORK_REQUIRED para validações de entrada e saída sem obra", async () => {
  await withServer(async (base) => {
    const authAdmin = { Authorization: "Bearer token-admin-a" };
    for (const path of ["entries", "exits"]) {
      const result = await json(base + "/api/stock-full/" + path, {
        method: "POST",
        headers: authAdmin,
        body: JSON.stringify({ quantity: 5 })
      });

      assert.equal(result.response.status, 400);
      assert.notEqual(result.data.error, "WORK_REQUIRED");
      assert.equal(result.data.error, "item_id_required");
    }
  });
});
