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
        const method = init.method || "GET";
        const projectId = target.searchParams.get("projectId") || "";
        const tenant = init.headers && init.headers["x-institution-id"];
        if (target.pathname === "/api/obrareport/rdos" && method === "POST") {
          const body = JSON.parse(init.body || "{}");
          const created = Object.assign(rdo("rdo_created_" + ((options.createdRdos || []).length + 1), tenant, body.projectId || body.project_id || "", body.rdoDate || body.rdo_date || body.rdoData && body.rdoData.date || "", ""), {
            title: body.title || "RDO criado",
            status: body.status || "draft",
            client_id: body.clientId || body.client_id || "",
            rdo_data_json: body.rdoData || body.rdo_data || {}
          });
          options.createdRdos = options.createdRdos || [];
          options.createdRdos.push(created);
          return { ok: true, status: 201, json: async () => ({ ok: true, rdo: created }) };
        }
        if (target.pathname.startsWith("/api/obrareport/rdos/") && method === "PUT") {
          const id = decodeURIComponent(target.pathname.split("/").pop() || "");
          const allRdos = (options.rdos || []).concat(options.createdRdos || []);
          const index = allRdos.findIndex((rdo) => rdo.id === id && rdo.institution_id === tenant);
          if (index < 0) return { ok: false, status: 404, json: async () => ({ ok: false, error: "rdo_not_found" }) };
          const body = JSON.parse(init.body || "{}");
          const updated = Object.assign({}, allRdos[index], {
            status: body.status || allRdos[index].status,
            rdo_data_json: body.rdoData || body.rdo_data || allRdos[index].rdo_data_json,
            updated_at: "2026-09-04T13:00:00.000Z"
          });
          options.updatedRdos = options.updatedRdos || [];
          options.updatedRdos.push(updated);
          if (index < (options.rdos || []).length) options.rdos[index] = updated;
          else options.createdRdos[index - (options.rdos || []).length] = updated;
          return { ok: true, status: 200, json: async () => ({ ok: true, rdo: updated }) };
        }
        const rdos = (options.rdos || []).concat(options.createdRdos || []).filter((rdo) => rdo.institution_id === tenant).filter((rdo) => !projectId || rdo.project_id === projectId);
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

const contextA = { authToken: "token-a", institutionId: "inst_a", companyId: "company_a", userId: "user_a", projectId: "obra_a" };

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
  assert.equal(calls[0].init.headers["x-company-id"], "company_a");
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

function obraReportState(works) {
  return JSON.stringify({ version: 1, works, clients: [], reports: [], dailyLogs: [] });
}

const workA = { id: "work-test-id", name: "Residencia Teste", clientId: "cli-a", address: "Rua A", type: "Residencial", status: "Em andamento" };
const workB = { id: "work-b-id", name: "Edificio B", clientId: "cli-b", address: "Rua B", type: "Predial", status: "Em andamento" };

test("rdo.create.preview resolve obras reais do ObraReport sem chamar backend", async () => {
  const zero = loadBridge({ rdos: fixtures, localStorage: { "obrareport-saas-v1": obraReportState([]) } });
  const noWork = await zero.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(noWork.ok, false);
  assert.equal(noWork.error, "no_works");
  assert.match(noWork.humanAnswer, /Não encontrei nenhuma obra cadastrada/i);
  assert.equal(zero.calls.length, 0);

  const one = loadBridge({ rdos: fixtures, localStorage: { "obrareport-saas-v1": obraReportState([workA]) } });
  const preview = await one.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(preview.ok, true);
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.humanAnswer, /PROJECT: Residencia Teste/);
  assert.match(preview.humanAnswer, /PROJECT ID: work-test-id/);
  assert.equal(preview.data.draft.projectId, "work-test-id");
  assert.equal(preview.data.draft.workId, "work-test-id");
  assert.equal(one.calls.length, 0);

  const many = loadBridge({ rdos: fixtures, localStorage: { "obrareport-saas-v1": obraReportState([workA, workB]) } });
  const choose = await many.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(choose.ok, false);
  assert.equal(choose.error, "work_selection_required");
  assert.match(choose.humanAnswer, /Para qual obra/i);
  assert.match(choose.humanAnswer, /Residencia Teste/);
  assert.equal(many.calls.length, 0);

  const followUp = await many.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.create.preview", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "Residencia Teste", workName: "Residencia Teste" } });
  assert.equal(followUp.ok, true);
  assert.equal(followUp.requiresConfirmation, true);
  assert.equal(followUp.data.draft.rdoDate, "2026-09-04");
  assert.equal(followUp.data.draft.projectId, "work-test-id");
  assert.equal(many.calls.length, 0);

  const missingFlow = loadBridge({ rdos: fixtures, localStorage: { "obrareport-saas-v1": obraReportState([workA, workB]) } });
  await missingFlow.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  const missing = await missingFlow.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.create.preview", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "Obra Inexistente", workName: "Obra Inexistente" } });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "work_not_found");

  const arbitraryFlow = loadBridge({ rdos: fixtures, localStorage: { "obrareport-saas-v1": obraReportState([workA, workB]) } });
  await arbitraryFlow.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  const arbitraryId = await arbitraryFlow.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.create.preview", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "work-b-id", workName: "work-b-id" } });
  assert.equal(arbitraryId.ok, false);
  assert.equal(arbitraryId.error, "work_not_found");
});
test("rdo.create.execute confirma uma vez e preserva idempotencia em reload", async () => {
  const state = obraReportState([workA]);
  const createdRdos = [];
  const env = loadBridge({ localStorage: { "obrareport-saas-v1": state }, createdRdos });
  const context = { authToken: "token-a", institutionId: "inst_a", companyId: "company_a", userId: "user_a" };

  const preview = await env.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(preview.ok, true);
  assert.equal(preview.requiresConfirmation, true);
  assert.equal(env.calls.filter((call) => call.init.method === "POST").length, 0);
  assert.equal(preview.data.pending.action, "rdo.create.execute");
  assert.equal(preview.data.pending.status, "pending");

  const confirmed = await env.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo_confirm", context, payload: { message: "sim" } });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.action, "rdo.create.execute");
  assert.equal(createdRdos.length, 1);
  assert.equal(env.calls.filter((call) => call.init.method === "POST" && String(call.url).endsWith("/api/obrareport/rdos")).length, 1);
  assert.equal(confirmed.data.rdo.project_id, "work-test-id");
  assert.equal(confirmed.data.rdo.rdo_date, "2026-09-04");

  const again = await env.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo_confirm", context, payload: { message: "sim" } });
  assert.equal(again.ok, true);
  assert.match(again.humanAnswer, /Não criei duplicado/i);
  assert.equal(createdRdos.length, 1);
  assert.equal(env.calls.filter((call) => call.init.method === "POST" && String(call.url).endsWith("/api/obrareport/rdos")).length, 1);

  const persisted = env.window.localStorage.getItem("elo_action_bus_rdo_pending_v1");
  const reloaded = loadBridge({ localStorage: { "obrareport-saas-v1": state, "elo_action_bus_rdo_pending_v1": persisted }, createdRdos });
  const afterReload = await reloaded.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo_confirm", context, payload: { message: "sim" } });
  assert.equal(afterReload.ok, true);
  assert.equal(createdRdos.length, 1);
  assert.equal(reloaded.calls.filter((call) => call.init.method === "POST").length, 0);
});

test("rdo.create.execute bloqueia sem tenant e sem projeto real", async () => {
  const noTenant = loadBridge({ localStorage: { "obrareport-saas-v1": obraReportState([workA]) } });
  const preview = await noTenant.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(preview.ok, false);
  assert.equal(preview.error, "institution_required");

  const noWork = loadBridge({ localStorage: { "obrareport-saas-v1": obraReportState([]) } });
  const missing = await noWork.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "no_works");

  const arbitrary = loadBridge({ localStorage: { "obrareport-saas-v1": obraReportState([workA, workB]) } });
  await arbitrary.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  const arbitraryId = await arbitrary.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.create.preview", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "work-b-id", workName: "work-b-id" } });
  assert.equal(arbitraryId.ok, false);
  assert.equal(arbitraryId.error, "work_not_found");
  assert.equal(arbitrary.calls.filter((call) => call.init.method === "POST").length, 0);
});
test("rdo.get salva contexto e rdo.update confirma uma vez com pending persistente", async () => {
  const rdos = [rdo("rdo_update_1", "inst_a", "obra_a", "2026-09-04", "Inicial", { rdo_data_json: { date: "2026-09-04", observations: ["Inicial"] } })];
  const updatedRdos = [];
  const env = loadBridge({ rdos, updatedRdos });
  const context = { authToken: "token-a", institutionId: "inst_a", companyId: "company_a", userId: "user_a", projectId: "obra_a" };

  const detail = await env.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.get", context, payload: { rdoId: "rdo_update_1" } });
  assert.equal(detail.ok, true);
  assert.equal(detail.data.rdo.id, "rdo_update_1");
  assert.ok(env.window.localStorage.getItem("elo_action_bus_rdo_context_v1"));

  const preview = await env.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_update_rdo", context, payload: { message: "adicione observação atualizacao controlada nesse RDO", note: "atualizacao controlada" } });
  assert.equal(preview.ok, true);
  assert.equal(preview.requiresConfirmation, true);
  assert.equal(preview.action, "rdo.update.preview");
  assert.equal(env.calls.filter((call) => call.init.method === "PUT").length, 0);

  const confirmed = await env.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo_confirm", context, payload: { message: "sim" } });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.action, "rdo.update.execute");
  assert.equal(updatedRdos.length, 1);
  assert.deepEqual(updatedRdos[0].rdo_data_json.observations, ["Inicial", "atualizacao controlada"]);
  assert.equal(env.calls.filter((call) => call.init.method === "PUT").length, 1);

  const again = await env.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo_confirm", context, payload: { message: "sim" } });
  assert.equal(again.ok, true);
  assert.match(again.humanAnswer, /PUT duplicado/i);
  assert.equal(updatedRdos.length, 1);
  assert.equal(env.calls.filter((call) => call.init.method === "PUT").length, 1);

  const persisted = env.window.localStorage.getItem("elo_action_bus_rdo_pending_v1");
  const reloaded = loadBridge({ localStorage: { "elo_action_bus_rdo_pending_v1": persisted }, rdos, updatedRdos });
  const afterReload = await reloaded.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo_confirm", context, payload: { message: "sim" } });
  assert.equal(afterReload.ok, true);
  assert.equal(updatedRdos.length, 1);
  assert.equal(reloaded.calls.filter((call) => call.init.method === "PUT").length, 0);
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
