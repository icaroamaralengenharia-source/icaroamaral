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
    Blob,
    window: {
      ELO_API_BASE_URL: options.eloBaseUrl || "https://backend.test",
      OBRAREPORT_API_BASE_URL: options.rdoBaseUrl,
      location: options.location || { hostname: "app.test", protocol: "https:" },
      localStorage: storage(options.localStorage),
      sessionStorage: storage(),
      EloCanonicalSession: options.canonicalSession === false ? null : {
        getSession: async () => ({ ok: true, accessToken: options.canonicalToken || "token-a", authContext: options.canonicalContext || { userId: "user_a", institutionId: "inst_a", companyId: "company_a" } }),
        getValidAccessToken: async () => options.canonicalToken || "token-a"
      },
      fetch: async (url, init = {}) => {
        calls.push({ url: String(url), init });
        if (options.fetchError) return { ok: false, status: options.fetchError.status || 500, json: async () => ({ error: options.fetchError.error || "backend_down" }) };
        const target = new URL(String(url));
        const method = init.method || "GET";
        const projectId = target.searchParams.get("projectId") || "";
        const tenant = init.headers && init.headers["x-institution-id"];
        if (target.pathname === "/api/stock-full/works" && method === "GET") {
          const works = (options.works || []).filter((work) => (work.institutionId || work.institution_id) === tenant);
          return { ok: true, status: 200, json: async () => ({ ok: true, works }) };
        }
        if (/^\/api\/obrareport\/documents\/[^/]+\/content$/.test(target.pathname) && method === "GET") {
          const pdf = options.pdf || new Blob(["%PDF-1.7\nsynthetic fixture"], { type: "application/pdf" });
          return { ok: options.pdfStatus ? options.pdfStatus === 200 : true, status: options.pdfStatus || 200, headers: { get: (name) => name === "content-type" ? options.pdfMime || "application/pdf" : name === "content-length" ? options.pdfBody ? "" : String(pdf.size) : "" }, blob: async () => pdf, body: options.pdfBody };
        }
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
        if (target.pathname.startsWith("/api/obrareport/rdos/") && target.pathname.endsWith("/generate-document") && method === "POST") {
          const id = decodeURIComponent(target.pathname.split("/").slice(-2, -1)[0] || "");
          const existing = (options.rdos || []).concat(options.createdRdos || []).find((item) => item.id === id && item.institution_id === tenant);
          if (!existing) return { ok: false, status: 404, json: async () => ({ ok: false, error: "rdo_not_found" }) };
          options.generatedDocuments = options.generatedDocuments || [];
          options.generatedDocuments.push(id);
          return { ok: true, status: 201, json: async () => ({ ok: true, document: { id: "doc_" + id, document_type: "rdo/daily_log", rdo_id: id } }) };
        }
        if (/^\/api\/obrareport\/rdos\/[^/]+$/.test(target.pathname) && method === "GET") {
          const id = decodeURIComponent(target.pathname.split("/").pop() || "");
          const existing = (options.rdos || []).concat(options.createdRdos || []).find((item) => item.id === id && item.institution_id === tenant);
          return { ok: Boolean(existing), status: existing ? 200 : 404, json: async () => existing ? { ok: true, rdo: existing } : { ok: false, error: "rdo_not_found" } };
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
  vm.runInContext(readFileSync(path.join(repo, "relatorio-qualidade-obras", "rdo-canonical-auth.js"), "utf8"), sandbox);
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

test("EloActionBusRdo separa geração de documento do preenchimento de RDO", async () => {
  const generatedDocuments = [];
  const { window, calls } = loadBridge({ works: [{ id: "work_elo_e2e_test_0e90b6f4-7997-4dd1-a100-fb6f2ae773c2", institutionId: "inst_a", name: "OBRA TESTE ELO E2E" }], rdos: [rdo("obr_rdo_1721f1765e566e3a4d7a0f0b", "inst_a", "work_elo_e2e_test_0e90b6f4-7997-4dd1-a100-fb6f2ae773c2", "2026-09-14", "")], generatedDocuments });
  const parsed = window.EloActionBusRdo.parseIntent({ payload: { message: "Gere o PDF do RDO da OBRA TESTE ELO E2E de 14/09/2026" } });
  assert.equal(parsed.action, "rdo.generateDocument");
  assert.equal(parsed.targetDate, "2026-09-14");
  assert.equal(parsed.workName, "OBRA TESTE ELO E2E");

  const response = await window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: parsed.action, context: Object.assign({}, contextA, { projectId: "work_elo_e2e_test_0e90b6f4-7997-4dd1-a100-fb6f2ae773c2" }), payload: { message: "Gere o PDF do RDO da OBRA TESTE ELO E2E de 14/09/2026" } });
  assert.equal(response.ok, true);
  assert.equal(response.action, "rdo.generateDocument");
  assert.equal(response.data.rdo.id, "obr_rdo_1721f1765e566e3a4d7a0f0b");
  assert.equal(response.data.document.document_type, "rdo/daily_log");
  assert.deepEqual(generatedDocuments, ["obr_rdo_1721f1765e566e3a4d7a0f0b"]);
  assert.equal(calls.filter((call) => call.init.method === "GET" && new URL(call.url).pathname === "/api/stock-full/works").length, 1);
  assert.equal(calls.filter((call) => call.init.method === "GET" && new URL(call.url).pathname === "/api/obrareport/rdos").length, 1);
  assert.equal(calls.filter((call) => call.init.method === "POST" && String(call.url).endsWith("/generate-document")).length, 1);
  assert.equal(calls.filter((call) => call.init.method === "POST" && String(call.url).endsWith("/api/obrareport/rdos")).length, 0);
  assert.equal(calls.filter((call) => call.init.method === "PUT").length, 0);
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

const workA = { id: "work-test-id", institutionId: "inst_a", name: "Residencia Teste", clientId: "cli-a", address: "Rua A", type: "Residencial", status: "Em andamento" };
const workB = { id: "work-b-id", institutionId: "inst_a", name: "Edificio B", clientId: "cli-b", address: "Rua B", type: "Predial", status: "Em andamento" };

test("rdo.create.preview consulta obras cloud autorizadas sem executar POST ou PUT", async () => {
  const zero = loadBridge({ rdos: fixtures, works: [] });
  const noWork = await zero.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(noWork.ok, false);
  assert.equal(noWork.error, "no_works");
  assert.match(noWork.humanAnswer, /Não encontrei nenhuma obra cadastrada/i);
  assert.equal(zero.calls.length, 1);
  assert.equal(new URL(zero.calls[0].url).pathname, "/api/stock-full/works");
  assert.equal(zero.calls[0].init.method, "GET");
  assert.equal(zero.calls.filter((call) => call.init.method === "POST" || call.init.method === "PUT").length, 0);

  const one = loadBridge({ rdos: fixtures, works: [workA] });
  const preview = await one.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(preview.ok, true);
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.humanAnswer, /PROJECT: Residencia Teste/);
  assert.match(preview.humanAnswer, /PROJECT ID: work-test-id/);
  assert.equal(preview.data.draft.projectId, "work-test-id");
  assert.equal(preview.data.draft.workId, "work-test-id");
  assert.equal(one.calls.length, 1);
  assert.equal(new URL(one.calls[0].url).pathname, "/api/stock-full/works");
  assert.equal(one.calls[0].init.method, "GET");
  assert.equal(one.calls[0].init.headers.Authorization, "Bearer token-a");
  assert.equal(one.calls[0].init.headers["x-institution-id"], "inst_a");
  assert.equal(one.calls.filter((call) => call.init.method === "POST" || call.init.method === "PUT").length, 0);

  const many = loadBridge({ rdos: fixtures, works: [workA, workB] });
  const choose = await many.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(choose.ok, false);
  assert.equal(choose.error, "work_selection_required");
  assert.match(choose.humanAnswer, /Para qual obra/i);
  assert.match(choose.humanAnswer, /Residencia Teste/);
  assert.equal(many.calls.length, 1);
  assert.ok(many.calls.every((call) => call.init.method === "GET" && new URL(call.url).pathname === "/api/stock-full/works"));
  assert.equal(many.calls.filter((call) => call.init.method === "POST" || call.init.method === "PUT").length, 0);

  const followUp = await many.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.create.preview", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "Residencia Teste", workName: "Residencia Teste" } });
  assert.equal(followUp.ok, true);
  assert.equal(followUp.requiresConfirmation, true);
  assert.equal(followUp.data.draft.rdoDate, "2026-09-04");
  assert.equal(followUp.data.draft.projectId, "work-test-id");
  assert.equal(many.calls.length, 2);
  assert.ok(many.calls.every((call) => call.init.method === "GET" && new URL(call.url).pathname === "/api/stock-full/works"));
  assert.equal(many.calls.filter((call) => call.init.method === "POST" || call.init.method === "PUT").length, 0);

  const missingFlow = loadBridge({ rdos: fixtures, works: [workA, workB] });
  await missingFlow.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  const missing = await missingFlow.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.create.preview", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "Obra Inexistente", workName: "Obra Inexistente" } });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "work_not_found");

  const arbitraryFlow = loadBridge({ rdos: fixtures, works: [workA, workB] });
  await arbitraryFlow.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  const arbitraryId = await arbitraryFlow.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.create.preview", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "work-b-id", workName: "work-b-id" } });
  assert.equal(arbitraryId.ok, false);
  assert.equal(arbitraryId.error, "work_not_found");
});
test("rdo.create.execute confirma uma vez e preserva idempotencia em reload", async () => {
  const createdRdos = [];
  const env = loadBridge({ works: [workA], createdRdos });
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
  const reloaded = loadBridge({ works: [workA], localStorage: { "elo_action_bus_rdo_pending_v1": persisted }, createdRdos });
  const afterReload = await reloaded.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo_confirm", context, payload: { message: "sim" } });
  assert.equal(afterReload.ok, true);
  assert.equal(createdRdos.length, 1);
  assert.equal(reloaded.calls.filter((call) => call.init.method === "POST").length, 0);
});

test("rdo.create.execute bloqueia sem tenant e sem projeto real", async () => {
  const noTenant = loadBridge({ canonicalContext: { userId: "user_a" }, works: [workA] });
  const preview = await noTenant.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(preview.ok, false);
  assert.equal(preview.error, "institution_required");

  const noWork = loadBridge({ works: [] });
  const missing = await noWork.window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "preview_new_rdo", context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a" }, payload: { message: "crie um RDO para hoje", now: "2026-09-04T12:00:00.000Z" } });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "no_works");

  const arbitrary = loadBridge({ works: [workA, workB] });
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
  const noAuth = loadBridge({ canonicalSession: false, rdos: fixtures }).window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.list", context: {}, payload: {} });
  assert.equal((await noAuth).requiresAuth, true);

  const noTenant = await loadBridge({ canonicalContext: { userId: "user_a" }, rdos: fixtures }).window.EloActionBusRdo.execute({ module: "obrareport_rdo", action: "rdo.list", context: { authToken: "token-a" }, payload: {} });
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

test("sessão canônica própria substitui token e identidade stale em GET POST PUT e PDF", async () => {
  const own = { session: { access_token: "own-canonical-fixture", refresh_token: "refresh-fixture", expires_at: Math.floor(Date.now() / 1000) + 3600 }, user: { id: "user_a" }, profile: { institution_id: "inst_a", company_id: "company_a" } };
  const existing = rdo("rdo_existing_a", "inst_a", "obra_a", "2026-09-04", "", { rdo_data_json: { employeeCount: "3", date: "2026-09-04", custom: { preserve: true } } });
  const env = loadBridge({ canonicalToken: "stale-elo-fixture", canonicalContext: { userId: "other", institutionId: "other" }, works: [workA], localStorage: { "obrareport-rdo-stock-canonical-session-v1": JSON.stringify(own) }, rdos: [existing], createdRdos: [] });
  const stale = { authToken: "stale-context", institutionId: "other", userId: "other", projectId: "obra_a" };
  assert.equal((await env.window.EloActionBusRdo.execute({ action: "rdo.get", context: stale, payload: { rdoId: existing.id } })).ok, true);
  assert.equal((await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: stale, payload: { message: "Acrescente ao RDO equipe: 4 funcionários; observação: registro sintético." } })).ok, true);
  assert.equal((await env.window.EloActionBusRdo.execute({ action: "rdo_confirm", context: stale, payload: { message: "sim" } })).ok, true);
  assert.equal((await env.window.EloActionBusRdo.execute({ action: "rdo.generateDocument", context: stale, payload: { rdoId: existing.id } })).ok, true);
  await env.window.EloActionBusRdo.fetchDocumentPdf("doc_fixture_a");
  assert.equal((await env.window.EloActionBusRdo.execute({ action: "preview_new_rdo", context: stale, payload: { date: "2026-09-05", workName: workA.name } })).ok, true);
  assert.equal((await env.window.EloActionBusRdo.execute({ action: "rdo_confirm", context: stale, payload: { message: "sim" } })).ok, true);
  for (const call of env.calls) {
    assert.equal(call.init.headers.Authorization, "Bearer own-canonical-fixture");
    assert.equal(call.init.headers["x-institution-id"], "inst_a");
    assert.equal(call.init.headers["x-user-id"], "user_a");
  }
  const pending = env.window.localStorage.getItem("elo_action_bus_rdo_pending_v1");
  const context = env.window.localStorage.getItem("elo_action_bus_rdo_context_v1");
  assert.doesNotMatch(pending + context, /own-canonical-fixture|refresh-fixture|stale-context/);
});

test("RDO não aceita token legado ou contexto sem provider canônico válido", async () => {
  const env = loadBridge({ canonicalSession: false, localStorage: { obrareport_access_token: "legacy-fixture", stock_full_access_token: "legacy-fixture" }, rdos: fixtures });
  const response = await env.window.EloActionBusRdo.execute({ action: "rdo.list", context: contextA, payload: {} });
  assert.equal(response.requiresAuth, true);
  assert.equal(env.calls.length, 0);
  await assert.rejects(env.window.EloActionBusRdo.fetchDocumentPdf("doc_fixture_a"), /authentication_required/);
  assert.equal(env.calls.length, 0);
});

test("create substitui contexto standalone e add/correction preservam o mesmo RDO e produção", async () => {
  const standalone = rdo("rdo_standalone_1", "inst_a", "work-test-id", "2026-09-04", "preservar", { rdo_data_json: { date: "2026-09-04", summary: "standalone untouched" } });
  const before = JSON.stringify(standalone);
  const options = { works: [workA], rdos: [standalone], createdRdos: [], updatedRdos: [] };
  const env = loadBridge(options);
  const context = Object.assign({}, contextA, { projectId: "work-test-id" });
  await env.window.EloActionBusRdo.execute({ action: "rdo.get", context, payload: { rdoId: standalone.id } });
  await env.window.EloActionBusRdo.execute({ action: "preview_new_rdo", context, payload: { date: "2026-09-05", workName: workA.name } });
  const created = await env.window.EloActionBusRdo.execute({ action: "rdo_confirm", context, payload: { message: "sim" } });
  const id = created.data.rdo.id;
  options.createdRdos[0].rdo_data_json.unknownExtension = { retain: [1, 2] };
  const addition = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context, payload: { message: "Acrescente ao RDO produção de Alvenaria: 12 m²; equipe: 4 funcionários; observação: ELO_RDO_E2E — registro sintético, sem execução física." } });
  assert.equal(addition.ok, true);
  assert.equal(addition.data.draft.rdoId, id);
  assert.match(addition.preview, /12 m²/);
  assert.equal(env.calls.filter(call => call.init.method === "PUT").length, 0);
  const added = await env.window.EloActionBusRdo.execute({ action: "rdo_confirm", context, payload: { message: "sim" } });
  const itemId = added.data.rdo.rdo_data_json.productions[0].id;
  assert.equal(added.data.rdo.rdo_data_json.employeeCount, "4");
  const correction = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context, payload: { message: "Corrija no RDO a quantidade da produção de Alvenaria de 12 m² para 15 m²; equipe de 4 para 5 funcionários." } });
  assert.equal(correction.ok, true, correction.error);
  assert.match(correction.preview, /12 → 15 m²/);
  const corrected = await env.window.EloActionBusRdo.execute({ action: "rdo_confirm", context, payload: { message: "sim" } });
  assert.equal(corrected.ok, true);
  assert.equal(corrected.data.rdo.id, id);
  const data = corrected.data.rdo.rdo_data_json;
  assert.equal(data.productions[0].id, itemId);
  assert.equal(data.productions[0].quantity, 15);
  assert.equal(data.employeeCount, "5");
  assert.deepEqual(data.unknownExtension, { retain: [1, 2] });
  assert.match(data.generalNotes, /sem execução física/);
  assert.equal(corrected.data.rdo.rdo_date, "2026-09-05");
  assert.equal(corrected.data.rdo.project_id, "work-test-id");
  assert.equal(options.createdRdos.length, 1);
  assert.equal(JSON.stringify(standalone), before);
  await env.window.EloActionBusRdo.execute({ action: "rdo_confirm", context, payload: { message: "sim" } });
  assert.equal(options.updatedRdos.length, 2);
});

test("update bloqueia alvo ambíguo, unidade, quantidade prévia, schema e alterações não reconhecidas", async () => {
  for (const scenario of [
    { productions: [{ id: "a", service: "Alvenaria", quantity: 12, unit: "m²" }, { id: "b", service: "Alvenaria", quantity: 12, unit: "m²" }], message: "Corrija no RDO a produção de Alvenaria de 12 m² para 15 m²", error: "rdo_update_production_ambiguous" },
    { message: "Corrija no RDO a produção de Alvenaria de 11 m² para 15 m²", error: "rdo_update_previous_quantity_mismatch" },
    { message: "Corrija no RDO a produção de Alvenaria de 12 m² para 15 m³", error: "rdo_update_unit_mismatch" },
    { message: "Corrija a quantidade nesse RDO", error: "rdo_update_quantity_not_understood" },
    { message: "Corrija no RDO produção de Alvenaria para quantidade desconhecida; equipe: 4 funcionários", error: "rdo_update_quantity_not_understood" },
    { productions: "unknown-schema", message: "Acrescente ao RDO produção de Pintura: 2 m²", error: "rdo_update_production_schema_invalid" },
    { changes: [{ kind: "employee_count", quantity: -2 }], error: "rdo_update_quantity_invalid" }
  ]) {
    const env = loadBridge({ rdos: [rdo("rdo_qty_fixture", "inst_a", "obra_a", "2026-09-04", "", { rdo_data_json: { employeeCount: "4", productions: scenario.productions || [{ id: "a", service: "Alvenaria", quantity: 12, unit: "m²", note: "preserve" }] } })] });
    const response = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: contextA, payload: { rdoId: "rdo_qty_fixture", message: scenario.message, changes: scenario.changes } });
    assert.equal(response.ok, false, scenario.error);
    assert.equal(response.error, scenario.error);
    assert.equal(env.calls.filter(call => call.init.method === "PUT").length, 0);
  }
});

test("quantidades não são extraídas de observações e preview inválido não confirma o anterior", async () => {
  const env = loadBridge({ rdos: [rdo("rdo_note_fixture", "inst_a", "obra_a", "2026-09-04", "", { rdo_data_json: { employeeCount: "4", productions: [] } })] });
  const preview = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: contextA, payload: { rdoId: "rdo_note_fixture", message: "Adicione observação: equipe: 90 funcionários é apenas exemplo citado." } });
  assert.equal(preview.ok, true);
  assert.equal(preview.data.draft.rdoData.employeeCount, "4");
  const invalid = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: contextA, payload: { rdoId: "rdo_note_fixture", message: "Corrija quantidade nesse RDO" } });
  assert.equal(invalid.ok, false);
  const confirmed = await env.window.EloActionBusRdo.execute({ action: "rdo_confirm", context: contextA, payload: { message: "sim" } });
  assert.equal(confirmed.error, "rdo_pending_missing");
  assert.equal(env.calls.filter(call => call.init.method === "PUT").length, 0);
});

test("update bloqueia outra obra/data e sessão própria expirada usa apenas fallback canônico válido", async () => {
  const expired = { session: { access_token: "expired-fixture", expires_at: 1 }, user: { id: "other" }, profile: { institution_id: "other" } };
  const env = loadBridge({ localStorage: { "obrareport-rdo-stock-canonical-session-v1": JSON.stringify(expired) }, rdos: [rdo("rdo_scope_fixture", "inst_a", "obra_a", "2026-09-04", "")] });
  const otherWork = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: contextA, payload: { rdoId: "rdo_scope_fixture", projectId: "obra_b", note: "cannot write" } });
  assert.equal(otherWork.error, "rdo_update_scope_mismatch");
  const otherDate = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: contextA, payload: { rdoId: "rdo_scope_fixture", date: "2026-09-05", note: "cannot write" } });
  assert.equal(otherDate.error, "rdo_update_scope_mismatch");
  assert.ok(env.calls.every(call => call.init.headers.Authorization === "Bearer token-a"));
  assert.equal(env.calls.filter(call => call.init.method === "PUT").length, 0);
});

test("PDF streaming cancela acima do limite sem carregar o conteúdo completo", async () => {
  let cancelled = false;
  let released = false;
  let calls = 0;
  const reader = { async read() { calls += 1; return { done: false, value: new Uint8Array(6 * 1024 * 1024) }; }, async cancel() { cancelled = true; }, releaseLock() { released = true; } };
  const env = loadBridge({ pdfBody: { getReader() { return reader; } } });
  await assert.rejects(env.window.EloActionBusRdo.fetchDocumentPdf("doc_fixture_a"), /rdo_document_content_invalid/);
  assert.equal(calls, 2);
  assert.equal(cancelled, true);
  assert.equal(released, true);
});

test("aliases numéricos de equipe acompanham correção e produção legada conflitante bloqueia preview", async () => {
  const row = rdo("rdo_legacy_fixture", "inst_a", "obra_a", "2026-09-04", "", { rdo_data_json: { employeeCount: "4", workers: 4, workerCount: "4", productions: [{ id: "prd_1", service: "Alvenaria", quantity: 12, unit: "m²" }] } });
  const env = loadBridge({ rdos: [row] });
  const team = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: contextA, payload: { rdoId: row.id, message: "Corrija no RDO equipe de 4 para 5 funcionários" } });
  assert.equal(team.ok, true);
  assert.equal(team.data.draft.rdoData.workers, 5);
  assert.equal(team.data.draft.rdoData.workerCount, "5");
  row.rdo_data_json.production = "Alvenaria: 12 m² (schema legado)";
  const production = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: contextA, payload: { rdoId: row.id, message: "Corrija no RDO produção de Alvenaria de 12 m² para 15 m²" } });
  assert.equal(production.error, "rdo_update_legacy_production_conflict");
  row.rdo_data_json.workers = "Descrição de equipe legada";
  const incompatibleTeam = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: contextA, payload: { rdoId: row.id, message: "Corrija no RDO equipe de 4 para 5 funcionários" } });
  assert.equal(incompatibleTeam.error, "rdo_update_legacy_workers_conflict");
  assert.equal(env.calls.filter(call => call.init.method === "PUT").length, 0);
});

test("RDO usa backend oficial em produção e base explícita somente no ambiente local", async () => {
  for (const scenario of [
    { options: { eloBaseUrl: "https://different-elo.test" }, base: "https://obrareport-backend.onrender.com" },
    { options: { eloBaseUrl: "https://different-elo.test", rdoBaseUrl: "https://canonical-rdo.test" }, base: "https://canonical-rdo.test" },
    { options: { eloBaseUrl: "http://127.0.0.1:4000", location: { hostname: "localhost", protocol: "http:" } }, base: "http://127.0.0.1:4000" }
  ]) {
    const env = loadBridge(Object.assign({ rdos: fixtures }, scenario.options));
    await env.window.EloActionBusRdo.execute({ action: "rdo.list", context: contextA, payload: {} });
    await env.window.EloActionBusRdo.fetchDocumentPdf("doc_fixture_a");
    assert.ok(env.calls.every(call => call.url.startsWith(scenario.base + "/api/obrareport/")));
  }
});

test("troca de tenant bloqueia confirmação saved/saving sem retornar dados do tenant anterior", async () => {
  for (const action of ["create", "update"]) for (const status of ["saved", "saving"]) {
    const options = { works: [workA], rdos: [rdo("rdo_private_tenant_a", "inst_a", "work-test-id", "2026-09-04", "", { rdo_data_json: { privateNote: "TENANT_A_PRIVATE_FIXTURE" } })] };
    const env = loadBridge(options);
    const context = Object.assign({}, contextA, { projectId: "work-test-id" });
    if (action === "create") await env.window.EloActionBusRdo.execute({ action: "rdo.create.preview", context, payload: { workName: workA.name, date: "2026-09-05" } });
    else await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context, payload: { rdoId: "rdo_private_tenant_a", note: "TENANT_A_PRIVATE_FIXTURE" } });
    const pending = env.window.EloActionBusRdo.readPending();
    pending.status = status;
    pending.rdo = options.rdos[0];
    env.window.localStorage.setItem("elo_action_bus_rdo_pending_v1", JSON.stringify(pending));
    options.canonicalContext = { userId: "user_b", institutionId: "inst_b", companyId: "company_b" };
    options.canonicalToken = "tenant-b-canonical-fixture";
    const before = env.calls.length;
    const confirmed = await env.window.EloActionBusRdo.execute({ action: "rdo_confirm", context, payload: { message: "sim" } });
    assert.equal(confirmed.ok, false);
    assert.equal(confirmed.error, "rdo_tenant_changed");
    assert.equal(confirmed.data, null);
    assert.doesNotMatch(JSON.stringify(confirmed), /TENANT_A_PRIVATE_FIXTURE|rdo_private_tenant_a/);
    assert.equal(env.calls.length, before);
  }
});

test("cancelamento com outro tenant não expõe nem apaga pending do tenant anterior", async () => {
  for (const action of ["create", "update"]) {
    const options = { works: [workA], rdos: [rdo("rdo_cancel_private_a", "inst_a", "work-test-id", "2026-09-04", "", { rdo_data_json: { privateNote: "TENANT_A_CANCEL_PRIVATE_FIXTURE" } })] };
    const env = loadBridge(options);
    const context = Object.assign({}, contextA, { projectId: "work-test-id" });
    if (action === "create") await env.window.EloActionBusRdo.execute({ action: "rdo.create.preview", context, payload: { workName: workA.name, date: "2026-09-05" } });
    else await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context, payload: { rdoId: "rdo_cancel_private_a", note: "TENANT_A_CANCEL_PRIVATE_FIXTURE" } });
    const pendingBefore = env.window.localStorage.getItem("elo_action_bus_rdo_pending_v1");
    options.canonicalContext = { userId: "user_b", institutionId: "inst_b", companyId: "company_b" };
    options.canonicalToken = "tenant-b-canonical-fixture";
    const callsBefore = env.calls.length;
    const cancelled = await env.window.EloActionBusRdo.execute({ action: "rdo_cancel", context, payload: { message: "cancelar" } });
    assert.equal(cancelled.ok, false);
    assert.equal(cancelled.error, "rdo_tenant_changed");
    assert.equal(cancelled.data, null);
    assert.doesNotMatch(JSON.stringify(cancelled), /TENANT_A_CANCEL_PRIVATE_FIXTURE|rdo_cancel_private_a/);
    assert.equal(env.window.localStorage.getItem("elo_action_bus_rdo_pending_v1"), pendingBefore);
    assert.equal(env.calls.length, callsBefore);
  }
});

test("obra/data explícitas escolhem RDO correspondente antes do contexto anterior", async () => {
  const work = { id: "work-test-id", institutionId: "inst_a", name: "OBRA TESTE ELO E2E", entityType: "work" };
  const earlier = rdo("rdo_standalone_oct14", "inst_a", work.id, "2026-10-14", "", { rdo_data_json: { generalNotes: "preserve standalone" } });
  const later = rdo("rdo_integration_oct15", "inst_a", work.id, "2026-10-15", "", { rdo_data_json: { productions: [] } });
  const before = JSON.stringify(earlier);
  const env = loadBridge({ works: [work], rdos: [earlier, later] });
  const context = Object.assign({}, contextA, { projectId: work.id });
  await env.window.EloActionBusRdo.execute({ action: "rdo.get", context, payload: { rdoId: earlier.id } });
  const preview = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context, payload: { message: "Acrescente ao RDO da OBRA TESTE ELO E2E de 15/10/2026 observação: registro sintético novo." } });
  assert.equal(preview.ok, true, preview.error);
  assert.equal(preview.data.draft.rdoId, later.id);
  const confirmed = await env.window.EloActionBusRdo.execute({ action: "rdo_confirm", context, payload: { message: "sim" } });
  assert.equal(confirmed.data.rdo.id, later.id);
  assert.equal(JSON.stringify(earlier), before);
  const writes = env.calls.filter(call => call.init.method === "PUT");
  assert.equal(writes.length, 1);
  assert.ok(writes[0].url.endsWith("/" + later.id));
});

test("acréscimo combina nota standalone anterior e aliases priorizados no PDF", async () => {
  const row = rdo("rdo_notes_alias", "inst_a", "obra_a", "2026-09-04", "", { rdo_data_json: { generalNotes: "nota antiga", observations: [], observation: "nota singular", observacoes: ["nota em português"], observações: "nota acentuada" } });
  const env = loadBridge({ rdos: [row] });
  const preview = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: contextA, payload: { rdoId: row.id, note: "nota nova" } });
  assert.equal(preview.ok, true);
  const data = preview.data.draft.rdoData;
  assert.ok(data.observations.includes("nota antiga"));
  assert.ok(data.observations.includes("nota nova"));
  assert.ok(data.observations.includes("nota singular"));
  assert.ok(data.observations.includes("nota em português"));
  assert.ok(data.observations.includes("nota acentuada"));
  assert.match(data.generalNotes, /nota antiga/);
  assert.match(data.generalNotes, /nota nova/);
  assert.equal(typeof data.observation, "string");
  assert.ok(Array.isArray(data.observacoes));
  const unsupported = loadBridge({ rdos: [rdo("rdo_bad_notes", "inst_a", "obra_a", "2026-09-04", "", { rdo_data_json: { generalNotes: { unreadable: true } } })] });
  const blocked = await unsupported.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: contextA, payload: { rdoId: "rdo_bad_notes", note: "nota nova" } });
  assert.equal(blocked.error, "rdo_update_notes_schema_invalid");
  assert.equal(unsupported.calls.filter(call => call.init.method === "PUT").length, 0);
});

test("preview lê RDO atual e confirmação bloqueia edição concorrente sem PUT", async () => {
  const options = { rdos: [rdo("rdo_conflict_a", "inst_a", "obra_a", "2026-09-04", "", { rdo_data_json: { observations: ["initial"] } })] };
  const env = loadBridge(options);
  await env.window.EloActionBusRdo.execute({ action: "rdo.get", context: contextA, payload: { rdoId: "rdo_conflict_a" } });
  options.rdos[0].rdo_data_json.external = "before preview";
  const preview = await env.window.EloActionBusRdo.execute({ action: "rdo.update.preview", context: contextA, payload: { note: "new observation" } });
  assert.equal(preview.data.draft.rdoData.external, "before preview");
  options.rdos[0].rdo_data_json.external = "after preview";
  const confirmed = await env.window.EloActionBusRdo.execute({ action: "rdo_confirm", context: contextA, payload: { message: "sim" } });
  assert.equal(confirmed.error, "rdo_update_conflict");
  assert.equal(env.calls.filter(call => call.init.method === "PUT").length, 0);
});

test("PDF oficial usa revisão atual e conteúdo autenticado com MIME assinatura e tamanho válidos", async () => {
  const row = rdo("rdo_pdf_fixture", "inst_a", "obra_a", "2026-09-04", "");
  const env = loadBridge({ rdos: [row] });
  await env.window.EloActionBusRdo.execute({ action: "rdo.generateDocument", context: contextA, payload: { rdoId: row.id } });
  const generated = env.calls.find(call => call.url.endsWith("/generate-document"));
  assert.deepEqual(JSON.parse(generated.init.body), { workId: "obra_a", idempotencyKey: "rdo:" + row.id + ":pdf:" + row.updated_at });
  assert.doesNotMatch(generated.init.body, /pdf:v1/);
  const pdf = await env.window.EloActionBusRdo.fetchDocumentPdf("doc_fixture_a");
  assert.equal(await pdf.slice(0, 5).text(), "%PDF-");
  assert.equal(env.calls.at(-1).init.headers.Authorization, "Bearer token-a");
  for (const options of [
    { pdfMime: "text/html" },
    { pdf: new Blob(["invalid pdf"]) },
    { pdf: new Blob([]) },
    { pdf: new Blob(["%PDF-", new Uint8Array(10 * 1024 * 1024)]) },
    { pdfStatus: 403 }
  ]) await assert.rejects(loadBridge(options).window.EloActionBusRdo.fetchDocumentPdf("doc_fixture_a"), /rdo_document_content_(?:invalid|failed)/);
});
