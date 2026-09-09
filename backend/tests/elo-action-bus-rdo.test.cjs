const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repo = path.resolve(__dirname, "..", "..");

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key(index) { return Array.from(values.keys())[index] || null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadBridge(options = {}) {
  const source = readFileSync(path.join(repo, "relatorio-qualidade-obras", "elo-command-bridge.js"), "utf8");
  const calls = [];
  const sandbox = {
    console,
    URLSearchParams,
    window: {
      ELO_API_BASE_URL: "https://backend.test",
      location: { hostname: "app.test", protocol: "https:" },
      localStorage: storage(options.localStorage),
      sessionStorage: storage(),
      fetch: async (url, init = {}) => {
        calls.push({ url: String(url), init });
        if (options.fetchError) return { ok: false, status: options.fetchError.status || 500, json: async () => ({ error: options.fetchError.error || "backend_down" }) };
        const target = new URL(String(url));
        const projectId = target.searchParams.get("projectId") || "";
        const tenant = init.headers && init.headers["x-institution-id"];
        const rdos = (options.rdos || []).filter((rdo) => rdo.institution_id === tenant).filter((rdo) => !projectId || rdo.project_id === projectId);
        return { ok: true, status: 200, json: async () => ({ ok: true, rdos }) };
      }
    }
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { window: sandbox.window, calls };
}

function rdo(id, institutionId, projectId, date, occurrence, extra = {}) {
  return Object.assign({
    id,
    institution_id: institutionId,
    project_id: projectId,
    title: "RDO " + id,
    status: "closed",
    rdo_date: date,
    updated_at: date + "T12:00:00.000Z",
    rdo_data_json: { date, occurrence }
  }, extra);
}

const contextA = { authToken: "token-a", institutionId: "inst_a", userId: "user_a", projectId: "obra_a" };

const fixtures = [
  rdo("rdo_a_1", "inst_a", "obra_a", "2026-09-01", "Falta de concreto"),
  rdo("rdo_a_2", "inst_a", "obra_a", "2026-09-02", "falta de concreto!", { rdo_data_json: { date: "2026-09-02", occurrences: ["falta de concreto!", "falta de concreto"], pendingItems: ["Atraso de equipe"] } }),
  rdo("rdo_a_3", "inst_a", "obra_a", "2026-09-03", "concreto nao chegou", { rdo_data_json: { date: "2026-09-03", occurrences: ["concreto nao chegou"], pendingItems: ["Atraso de equipe"] } }),
  rdo("rdo_a_old", "inst_a", "obra_a", "2026-07-01", "Falta de concreto"),
  rdo("rdo_b_1", "inst_a", "obra_b", "2026-09-01", "Falta de concreto"),
  rdo("rdo_tenant_b", "inst_b", "obra_a", "2026-09-01", "Falta de concreto")
];

test("EloActionBusRdo parseia intents list/get/problemsByPeriod", () => {
  const { window } = loadBridge();
  assert.equal(window.EloActionBusRdo.parseIntent({ payload: { message: "liste os RDOs desta obra" } }).action, "rdo.list");
  assert.equal(window.EloActionBusRdo.parseIntent({ payload: { message: "abra o RDO de ontem", now: "2026-09-04T12:00:00.000Z" } }).action, "rdo.get");
  assert.equal(window.EloActionBusRdo.parseIntent({ payload: { message: "quais problemas se repetiram nos ultimos 30 dias?" } }).action, "rdo.problemsByPeriod");
  assert.equal(window.EloActionBusRdo.parseIntent({ action: "preview_new_rdo", payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } }).action, "rdo.create.preview");
  assert.equal(window.EloActionBusRdo.parseIntent({ action: "preview_new_rdo", payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } }).targetDate, "2026-09-04");
});

test("rdo.list consulta backend real com auth, tenant, obra e periodo", async () => {
  const { window, calls } = loadBridge({ rdos: fixtures });
  const response = await window.EloCommandBridge.execute({ module: "obrareport_rdo", action: "rdo.list", context: contextA, payload: { startDate: "2026-09-01", endDate: "2026-09-02" } });
  assert.equal(response.ok, true);
  assert.equal(response.action, "rdo.list");
  assert.deepEqual(response.data.rdos.map((item) => item.id), ["rdo_a_2", "rdo_a_1"]);
  assert.match(calls[0].url, /\/api\/obrareport\/rdos\?projectId=obra_a/);
  assert.equal(calls[0].init.headers.Authorization, "Bearer token-a");
  assert.equal(calls[0].init.headers["x-institution-id"], "inst_a");
  assert.equal(calls[0].init.method, "GET");
});

test("rdo.get resolve por id, data, ultimo, inexistente e ambiguo", async () => {
  const { window } = loadBridge({ rdos: fixtures });
  const byId = await window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.get", context: contextA, payload: { rdoId: "rdo_a_1" } });
  assert.equal(byId.data.rdo.id, "rdo_a_1");

  const byDate = await window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.get", context: contextA, payload: { message: "abra o RDO do dia 02/09/2026" } });
  assert.equal(byDate.data.rdo.id, "rdo_a_2");

  const latest = await window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.get", context: contextA, payload: { message: "mostre o ultimo RDO" } });
  assert.equal(latest.data.rdo.id, "rdo_a_3");

  const missing = await window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.get", context: contextA, payload: { rdoId: "rdo_missing" } });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "rdo_not_found");

  const ambiguous = await window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.get", context: contextA, payload: { startDate: "2026-09-01", endDate: "2026-09-03" } });
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.error, "rdo_ambiguous");
});

test("rdo.problemsByPeriod agrega recorrencia deterministica sem falso agrupamento semantico", async () => {
  const { window } = loadBridge({ rdos: fixtures });
  const response = await window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.problemsByPeriod", context: contextA, payload: { startDate: "2026-09-01", endDate: "2026-09-03" } });
  assert.equal(response.ok, true);
  assert.equal(response.data.problems.length, 2);
  const concrete = response.data.problems.find((item) => item.key === "falta de concreto");
  assert.equal(concrete.count, 2);
  assert.deepEqual(Array.from(concrete.rdoIds), ["rdo_a_1", "rdo_a_2"]);
  assert.deepEqual(Array.from(concrete.dates), ["2026-09-01", "2026-09-02"]);
  assert.equal(concrete.source, "occurrence");
  assert.equal(response.data.problems.some((item) => item.key === "concreto nao chegou"), false);
  const pending = response.data.problems.find((item) => item.key === "atraso de equipe");
  assert.equal(pending.count, 2);
  assert.equal(pending.source, "pending");
});

test("rdo.problemsByPeriod respeita periodo, obra e nenhum recorrente", async () => {
  const { window } = loadBridge({ rdos: fixtures });
  const shortPeriod = await window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.problemsByPeriod", context: contextA, payload: { startDate: "2026-09-03", endDate: "2026-09-03" } });
  assert.equal(shortPeriod.data.problems.length, 0);

  const wrongProject = await window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.problemsByPeriod", context: Object.assign({}, contextA, { projectId: "obra_b" }), payload: { startDate: "2026-09-01", endDate: "2026-09-03" } });
  assert.equal(wrongProject.data.rdos.length, 1);
  assert.equal(wrongProject.data.problems.length, 0);
});

test("rdo.create.preview exige obra real e nao chama backend antes da confirmacao", async () => {
  const ready = loadBridge({ rdos: fixtures });
  const preview = await ready.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: contextA, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(preview.ok, true);
  assert.equal(preview.action, "rdo.create.preview");
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.humanAnswer, /CONFIRMATION REQUIRED: SIM/);
  assert.match(preview.humanAnswer, /WRITE EXECUTED: 0/);
  assert.equal(ready.calls.length, 0);

  const blocked = loadBridge({ rdos: fixtures });
  const missingProject = await blocked.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(missingProject.ok, false);
  assert.equal(missingProject.requiresConfirmation, false);
  assert.equal(missingProject.error, "rdo_create_required_fields");
  assert.match(missingProject.humanAnswer, /obra\/projeto real/);
  assert.equal(blocked.calls.length, 0);
});

test("rdo bloqueia sem auth, sem tenant, periodo invalido e falha de backend", async () => {
  const noAuth = loadBridge({ rdos: fixtures }).window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.list", context: {}, payload: {} });
  assert.equal((await noAuth).requiresAuth, true);

  const noTenant = await loadBridge({ rdos: fixtures }).window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.list", context: { authToken: "token-a" }, payload: {} });
  assert.equal(noTenant.ok, false);
  assert.equal(noTenant.error, "institution_required");

  const invalidPeriod = await loadBridge({ rdos: fixtures }).window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.problemsByPeriod", context: contextA, payload: { startDate: "2026-09-10", endDate: "2026-09-01" } });
  assert.equal(invalidPeriod.ok, false);
  assert.equal(invalidPeriod.error, "invalid_period");

  const backendFail = await loadBridge({ fetchError: { status: 503, error: "backend_down" } }).window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.list", context: contextA, payload: {} });
  assert.equal(backendFail.ok, false);
  assert.equal(backendFail.mode, "error");
  assert.equal(backendFail.error, "backend_down");
});
