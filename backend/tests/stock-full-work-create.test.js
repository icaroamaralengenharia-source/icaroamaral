import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createApp } from "../src/app.js";

const TENANT_A = "tenant-e2e-a";
const TENANT_B = "tenant-e2e-b";

function createWorkDatabase(options = {}) {
  const profile = options.profile || {
    id: "profile-e2e-a",
    auth_user_id: "auth-e2e-a",
    institution_id: TENANT_A,
    role: "admin",
    name: "Admin E2E",
    email: "admin@elo-e2e.test"
  };
  const profiles = options.profiles || [profile];
  const projects = (options.projects || []).map((project) => Object.assign({}, project));
  const clients = (options.clients || []).map((client) => Object.assign({}, client));
  const trace = [];
  const database = {
    profiles,
    projects,
    clients,
    trace,
    auth: {
      async getUser(token) {
        if (token !== "valid-token") return { data: null, error: { message: "invalid token" } };
        return { data: { user: { id: profile.auth_user_id, email: profile.email } }, error: null };
      }
    },
    async rpc(name) {
      if (name !== "stock_full_list_works") return { data: null, error: { message: "unexpected rpc" } };
      return {
        data: projects.filter((project) => project.institution_id === profile.institution_id)
          .map(({ id, institution_id, client_id, name, address }) => ({ id, institution_id, client_id, name, address })),
        error: null
      };
    },
    from(table) {
      return new Query(database, table);
    }
  };
  return database;
}

class Query {
  constructor(database, table) {
    this.database = database;
    this.table = table;
    this.filters = [];
    this.mode = "select";
    this.row = null;
    this.max = Infinity;
  }

  select(columns) {
    return this;
  }

  eq(field, value) {
    this.filters.push((row) => row && row[field] === value);
    this.database.trace.push({ table: this.table, filter: field, value });
    return this;
  }

  is(field, value) {
    this.filters.push((row) => row && (row[field] == null) === (value == null));
    this.database.trace.push({ table: this.table, filter: field, value: null });
    return this;
  }

  limit(value) {
    this.max = value;
    return this;
  }

  insert(row) {
    this.mode = "insert";
    this.row = Object.assign({}, row);
    this.database.trace.push({ table: this.table, operation: "insert", row: this.row });
    return this;
  }

  async maybeSingle() {
    const result = await this.execute();
    return { data: Array.isArray(result.data) ? result.data[0] || null : result.data, error: result.error };
  }

  async single() {
    const result = await this.execute();
    return { data: Array.isArray(result.data) ? result.data[0] || null : result.data, error: result.error };
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    this.database.trace.push({
      table: this.table,
      operation: this.mode,
      filters: this.filters.length
    });
    const rows = this.table === "profiles" ? this.database.profiles
      : this.table === "obrareport_projects" ? this.database.projects
        : this.table === "obrareport_clients" ? this.database.clients
          : [];
    if (this.mode === "insert") {
      const duplicate = rows.find((row) => row.id === this.row.id);
      if (duplicate) return { data: null, error: { code: "23505", message: "duplicate key" } };
      rows.push(Object.assign({}, this.row));
      return { data: Object.assign({}, this.row), error: null };
    }
    const matched = rows.filter((row) => this.filters.every((filter) => filter(row))).slice(0, this.max);
    return { data: matched, error: null };
  }
}

async function start(database, options = {}) {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: database,
    stockFullWorkCreationSupabaseClient: database,
    ...options
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return {
    server,
    baseUrl: "http://127.0.0.1:" + server.address().port,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

async function postWork(baseUrl, payload = {}, headers = {}) {
  return fetch(baseUrl + "/api/stock-full/works", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "e2e-work-key-1", ...headers },
    body: JSON.stringify(payload)
  });
}

test("Stock Full creates canonical work in authenticated tenant and ignores tenant spoof", async () => {
  const database = createWorkDatabase();
  const server = await start(database);
  try {
    const response = await postWork(server.baseUrl, {
      name: "OBRA TESTE ELO E2E B",
      address: "Endereço sintético",
      institution_id: TENANT_B
    }, { Authorization: "Bearer valid-token" });
    const data = await response.json();

    assert.equal(response.status, 201);
    assert.equal(data.work.institutionId, TENANT_A);
    assert.equal(database.projects.length, 1);
    assert.equal(database.projects[0].institution_id, TENANT_A);
    assert.equal(database.projects[0].name, "OBRA TESTE ELO E2E B");

    const listed = await fetch(server.baseUrl + "/api/stock-full/works", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const listData = await listed.json();
    assert.equal(listed.status, 200);
    assert.deepEqual(listData.works.map((work) => work.name), ["OBRA TESTE ELO E2E B"]);
    assert.equal(listData.works.some((work) => work.institutionId === TENANT_B), false);
  } finally {
    await server.close();
  }
});

test("Stock Full work creation requires authentication, valid token, and manager permission", async () => {
  const database = createWorkDatabase();
  const server = await start(database);
  try {
    const missing = await postWork(server.baseUrl, { name: "No auth" });
    assert.equal(missing.status, 401);

    const invalid = await postWork(server.baseUrl, { name: "Invalid auth" }, { Authorization: "Bearer invalid-token" });
    assert.equal(invalid.status, 401);

    const employee = createWorkDatabase({
      profile: { id: "employee", auth_user_id: "auth-e2e-a", institution_id: TENANT_A, role: "funcionario" }
    });
    const employeeServer = await start(employee);
    try {
      const denied = await postWork(employeeServer.baseUrl, { name: "Unauthorized" }, { Authorization: "Bearer valid-token" });
      assert.equal(denied.status, 403);
      assert.equal(employee.projects.length, 0);
    } finally {
      await employeeServer.close();
    }
    assert.equal(database.projects.length, 0);
  } finally {
    await server.close();
  }
});

test("Stock Full work creation rejects invalid, duplicate, and cross-tenant client references", async () => {
  const database = createWorkDatabase({
    projects: [{ id: "existing", institution_id: TENANT_A, client_id: null, name: "OBRA EXISTENTE", address: null }],
    clients: [{ id: "client-b", institution_id: TENANT_B, name: "Cliente B" }]
  });
  const server = await start(database);
  try {
    const blank = await postWork(server.baseUrl, { name: "  " }, { Authorization: "Bearer valid-token" });
    assert.equal(blank.status, 400);

    const invalidControl = await postWork(server.baseUrl, { name: "Obra\nInválida" }, { Authorization: "Bearer valid-token", "Idempotency-Key": "invalid-control" });
    assert.equal(invalidControl.status, 400);

    const duplicate = await postWork(server.baseUrl, { name: "OBRA EXISTENTE" }, { Authorization: "Bearer valid-token", "Idempotency-Key": "duplicate-name" });
    assert.equal(duplicate.status, 409);

    const foreignClient = await postWork(server.baseUrl, { name: "Obra com cliente externo", clientId: "client-b" }, { Authorization: "Bearer valid-token", "Idempotency-Key": "foreign-client" });
    assert.equal(foreignClient.status, 404);
    assert.equal(database.projects.length, 1);
  } finally {
    await server.close();
  }
});

test("Stock Full work creation is idempotent and never returns a tenant-wide collection", async () => {
  const database = createWorkDatabase({
    projects: [{ id: "other-tenant-work", institution_id: TENANT_B, client_id: null, name: "TENANT B ONLY", address: null }]
  });
  const server = await start(database);
  try {
    const headers = { Authorization: "Bearer valid-token", "Idempotency-Key": "same-request-key" };
    const first = await postWork(server.baseUrl, { name: "OBRA IDEMPOTENTE" }, headers);
    const second = await postWork(server.baseUrl, { name: "OBRA IDEMPOTENTE" }, headers);
    const firstData = await first.json();
    const secondData = await second.json();
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(secondData.duplicate, true);
    assert.equal(firstData.work.id, secondData.work.id);
    assert.equal(database.projects.filter((work) => work.institution_id === TENANT_A).length, 1);

    const altered = await postWork(server.baseUrl, { name: "NOME ALTERADO" }, headers);
    assert.equal(altered.status, 409);
    const listed = await fetch(server.baseUrl + "/api/stock-full/works", { headers: { Authorization: "Bearer valid-token" } });
    const listData = await listed.json();
    assert.equal(listData.works.some((work) => work.id === "other-tenant-work"), false);
    const projectReads = database.trace.filter((event) => event.table === "obrareport_projects" && event.operation === "select");
    assert.equal(projectReads.length > 0, true);
    assert.equal(projectReads.every((event) => event.filters >= 2), true);
    assert.equal(JSON.stringify(listData).includes("TENANT B ONLY"), false);
  } finally {
    await server.close();
  }
});

test("Stock Full work creation refuses service-client fallback when caller database is not configured", async () => {
  const serviceOnly = createWorkDatabase();
  const app = createApp({ env: { PORT: "0" }, stockFullSupabaseClient: serviceOnly });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/api/stock-full/works", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json", "Idempotency-Key": "service-only" },
      body: JSON.stringify({ name: "Não deve criar" })
    });
    assert.equal(response.status, 503);
    assert.equal(serviceOnly.projects.length, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Stock Full UI exposes canonical authenticated work creation only to permitted roles", () => {
  const appSource = readFileSync(new URL("../../stock-full-app.js", import.meta.url), "utf8");
  const coreSource = readFileSync(new URL("../../stock-full-core.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../../stockfull.html", import.meta.url), "utf8");
  assert.match(appSource, /method:\s*"POST"[\s\S]*?Authorization:\s*"Bearer "\s*\+\s*token/);
  assert.match(appSource, /Idempotency-Key/);
  assert.match(appSource, /core\.canStockFull\("works:create"/);
  assert.match(appSource, /loadStockFullWorks\(\)/);
  assert.match(coreSource, /works:create/);
  assert.match(html, /stock-full-core\.js\?v=20261009-canonical-work-create-v1/);
  assert.match(html, /stock-full-app\.css\?v=20261009-canonical-work-create-v1/);
  assert.match(html, /20261009-canonical-work-create-v1/);
});
