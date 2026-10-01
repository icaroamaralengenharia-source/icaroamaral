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
    }
  };
  const items = [
    { id: "item-a", institution_id: "inst-a", name: "Cimento", unit: "saco", category: "Obra", min_quantity: 5, current_quantity: 12, location: "A1", notes: "", is_active: true },
    { id: "item-b", institution_id: "inst-b", name: "Argamassa", unit: "saco", category: "Obra", min_quantity: 3, current_quantity: 9, location: "B1", notes: "", is_active: true }
  ];
  const writes = [];
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
      select() {
        return this;
      },
      async maybeSingle() {
        const row = items.find((item) => filters.every((filter) => item[filter.column] === filter.value));
        if (!row) return { data: null, error: null };
        Object.assign(row, updatePayload || {});
        return { data: row, error: null };
      }
    };
  }

  return {
    writes,
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
      assert.equal(table, "stock_full_items");
      return createItemQuery(table);
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