import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";

const FIXTURE_ID = "963a86a8-8602-4ec4-b750-f00661dd142a";
const TENANT_B_ITEM_ID = "963a86a8-8602-4ec4-b750-f00661dd14b2";

function createSupabaseMock() {
  const sessions = {
    "token-a": { user: { id: "auth-user-a", email: "a@example.com" }, profile: { id: "profile-a", institution_id: "tenant-a", role: "admin" } },
    "token-b": { user: { id: "auth-user-b", email: "b@example.com" }, profile: { id: "profile-b", institution_id: "tenant-b", role: "admin" } },
    "token-no-tenant": { user: { id: "auth-user-no-tenant", email: "missing@example.com" }, profile: { id: "profile-no-tenant", role: "admin" } }
  };
  const items = [
    { id: FIXTURE_ID, institution_id: "tenant-a", project_id: null, name: "E2E ELO STOCK ACTION TEST", unit: "un", category: "Teste", current_quantity: 0, min_quantity: 0, location: "E2E", is_active: true },
    { id: TENANT_B_ITEM_ID, institution_id: "tenant-b", project_id: null, name: "E2E ELO STOCK ACTION TEST", unit: "un", category: "Teste", current_quantity: 7, min_quantity: 0, location: "B", is_active: true },
    { id: "963a86a8-8602-4ec4-b750-f00661dd14a1", institution_id: "tenant-a", project_id: null, name: "Nome duplicado", unit: "un", current_quantity: 1, min_quantity: 0, location: "A1", is_active: true },
    { id: "963a86a8-8602-4ec4-b750-f00661dd14a2", institution_id: "tenant-a", project_id: null, name: "Nome duplicado", unit: "un", current_quantity: 2, min_quantity: 0, location: "A2", is_active: true },
    { id: "963a86a8-8602-4ec4-b750-f00661dd14a3", institution_id: "tenant-a", project_id: "work-a", name: "Material de obra", unit: "un", current_quantity: 3, min_quantity: 0, location: "A", is_active: true },
    { id: "963a86a8-8602-4ec4-b750-f00661dd14a4", institution_id: "tenant-a", project_id: "work-b", name: "Material de obra", unit: "un", current_quantity: 4, min_quantity: 0, location: "B", is_active: true },
    ...Array.from({ length: 7 }, (_, index) => ({
      id: "963a86a8-8602-4ec4-b750-f00661dd15" + String(index).padStart(2, "0"),
      institution_id: "tenant-a",
      project_id: null,
      name: "Cimento " + index,
      unit: "saco",
      current_quantity: index,
      min_quantity: 0,
      location: "A",
      is_active: true
    }))
  ];
  const itemQueries = [];
  let activeUserId = "";

  function createItemQuery(table) {
    const filters = [];
    let orFilter = "";
    let maxRows = Infinity;
    const query = {
      select() { return this; },
      eq(column, value) { filters.push({ column, value }); return this; },
      is(column, value) { filters.push({ column, value, isNull: value === null }); return this; },
      or(value) { orFilter = value; return this; },
      limit(value) { maxRows = value; return this; },
      then(resolve, reject) {
        try {
          const orTerms = Array.from(orFilter.matchAll(/([a-z_]+)\.ilike\."%([^%]+)%"/g), (match) => ({ column: match[1], term: match[2].toLowerCase() }));
          const plan = { table, filters: filters.map((filter) => ({ ...filter })), orFilter, maxRows };
          itemQueries.push(plan);
          const rows = items.filter((item) => {
            const matchesFilters = filters.every((filter) => filter.isNull
              ? item[filter.column] == null
              : item[filter.column] === filter.value);
            const matchesOr = !orFilter || orTerms.some(({ column, term }) => String(item[column] || "").toLowerCase().includes(term));
            return matchesFilters && matchesOr;
          }).slice(0, maxRows);
          return Promise.resolve(resolve({ data: rows, error: null }));
        } catch (error) {
          return Promise.reject(reject ? reject(error) : error);
        }
      }
    };
    return query;
  }

  return {
    items,
    itemQueries,
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
                    const session = Object.values(sessions).find((candidate) => candidate.user.id === value);
                    return { data: session ? session.profile : null, error: null };
                  }
                };
              }
            };
          }
        };
      }
      return createItemQuery(table);
    },
    async rpc(name) {
      assert.equal(name, "stock_full_list_works");
      return { data: activeUserId === "auth-user-a" ? [{ id: "work-a", institution_id: "tenant-a" }] : [{ id: "work-b", institution_id: "tenant-b" }], error: null };
    }
  };
}

async function withServer(callback) {
  const supabase = createSupabaseMock();
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

async function getJson(base, query, token, extraQuery = "") {
  const auth = token ? { Authorization: "Bearer " + token } : {};
  const response = await fetch(base + "/api/stock-full/items/lookup?" + query + extraQuery, { headers: auth });
  return { response, data: await response.json() };
}

test("Stock Full item lookup filtra ID e nome exatos antes do retorno", async () => {
  await withServer(async (base, supabase) => {
    const byId = await getJson(base, "id=" + FIXTURE_ID, "token-a");
    assert.equal(byId.response.status, 200);
    assert.equal(byId.data.item.id, FIXTURE_ID);
    assert.equal(byId.data.item.currentQuantity, 0);
    assert.equal(Object.hasOwn(byId.data, "items"), false);
    assert.ok(supabase.itemQueries.at(-1).filters.some((filter) => filter.column === "id" && filter.value === FIXTURE_ID));

    const byName = await getJson(base, "name=" + encodeURIComponent("E2E ELO STOCK ACTION TEST"), "token-a");
    assert.equal(byName.response.status, 200);
    assert.equal(byName.data.item.id, FIXTURE_ID);
    assert.ok(supabase.itemQueries.at(-1).filters.some((filter) => filter.column === "name" && filter.value === "E2E ELO STOCK ACTION TEST"));

    for (const plan of supabase.itemQueries) {
      assert.ok(plan.filters.some((filter) => filter.column === "institution_id" && filter.value === "tenant-a"));
      assert.ok(plan.filters.some((filter) => filter.column === "is_active" && filter.value === true));
      assert.ok(plan.filters.some((filter) => filter.column === "project_id" && filter.isNull === true));
    }
  });
});

test("Stock Full item lookup retorna ausência segura e bloqueia acesso cross-tenant", async () => {
  await withServer(async (base, supabase) => {
    const missing = await getJson(base, "id=963a86a8-8602-4ec4-b750-f00661dd14ff", "token-a");
    assert.equal(missing.response.status, 404);
    assert.equal(missing.data.error, "stock_full_item_not_found");

    const foreign = await getJson(base, "id=" + TENANT_B_ITEM_ID + "&institution_id=tenant-b", "token-a");
    assert.equal(foreign.response.status, 404);
    assert.equal(foreign.data.error, "stock_full_item_not_found");
    assert.ok(supabase.itemQueries.at(-1).filters.some((filter) => filter.column === "institution_id" && filter.value === "tenant-a"));
    assert.equal(supabase.itemQueries.at(-1).filters.some((filter) => filter.value === "tenant-b"), false);
  });
});

test("Stock Full item lookup exige identificação para nomes duplicados", async () => {
  await withServer(async (base) => {
    const result = await getJson(base, "name=" + encodeURIComponent("Nome duplicado"), "token-a");
    assert.equal(result.response.status, 409);
    assert.equal(result.data.error, "stock_full_item_ambiguous");
    assert.equal(result.data.item, undefined);
    assert.equal(result.data.matches.length, 2);
    assert.deepEqual(result.data.matches.map((item) => item.id), [
      "963a86a8-8602-4ec4-b750-f00661dd14a1",
      "963a86a8-8602-4ec4-b750-f00661dd14a2"
    ]);
  });
});

test("Stock Full item lookup exige autenticação e rejeita token inválido", async () => {
  await withServer(async (base, supabase) => {
    const anonymous = await getJson(base, "id=" + FIXTURE_ID);
    assert.equal(anonymous.response.status, 401);
    assert.equal(anonymous.data.error, "authentication_required");

    const invalid = await getJson(base, "id=" + FIXTURE_ID, "invalid-token");
    assert.equal(invalid.response.status, 401);
    assert.equal(supabase.itemQueries.length, 0);

    const missingTenant = await getJson(base, "id=" + FIXTURE_ID, "token-no-tenant");
    assert.equal(missingTenant.response.status, 403);
    assert.equal(missingTenant.data.error, "stock_full_tenant_required");
    assert.equal(supabase.itemQueries.length, 0);
  });
});

test("Stock Full item lookup respeita escopo de obra e limita busca server-side", async () => {
  await withServer(async (base, supabase) => {
    const scoped = await getJson(base, "name=Material%20de%20obra", "token-a", "&projectId=work-a");
    assert.equal(scoped.response.status, 200);
    assert.equal(scoped.data.item.projectId, "work-a");
    assert.ok(supabase.itemQueries.at(-1).filters.some((filter) => filter.column === "project_id" && filter.value === "work-a"));

    const forbiddenWork = await getJson(base, "name=Material%20de%20obra", "token-a", "&projectId=work-b");
    assert.equal(forbiddenWork.response.status, 403);
    assert.equal(forbiddenWork.data.error, "WORK_NOT_ALLOWED");

    const bounded = await getJson(base, "query=cim", "token-a");
    assert.equal(bounded.response.status, 200);
    assert.equal(bounded.data.items.length, 6);
    assert.equal(bounded.data.hasMore, true);
    assert.equal(supabase.itemQueries.at(-1).maxRows, 7);
    assert.match(supabase.itemQueries.at(-1).orFilter, /name\.ilike/);
    assert.equal(Object.hasOwn(bounded.data, "item"), false);
  });
});
