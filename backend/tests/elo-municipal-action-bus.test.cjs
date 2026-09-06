const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = join(__dirname, "..", "..");

function createResponse(data) {
  return {
    ok: true,
    json: () => Promise.resolve(Object.assign({ ok: true }, data || {}))
  };
}

function loadBridge(options = {}) {
  const calls = [];
  const sandbox = {
    URLSearchParams,
    console,
    window: {
      OBRAREPORT_API_BASE_URL: "https://municipal.local",
      ELO_AUTH_TOKEN: options.token === false ? "" : "token-a",
      ELO_SENTINEL_AUTH_TOKEN: options.token === false ? "" : "token-a",
      MUNICIPAL_ADMIN_AUTH_TOKEN: options.token === false ? "" : "token-a",
      ELO_MUNICIPAL_CONTEXT: Object.assign({
        institutionId: "inst-a",
        institution_id: "inst-a",
        companyId: "company-a",
        company_id: "company-a",
        projectId: "obra-a",
        project_id: "obra-a",
        unitId: "unit-a",
        unit_id: "unit-a",
        pendingItemId: "pending-a"
      }, options.context || {}),
      localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
      fetch(url, init = {}) {
        const parsed = new URL(url);
        const body = init.body ? JSON.parse(init.body) : null;
        calls.push({ url, path: parsed.pathname, search: parsed.searchParams, method: init.method || "GET", body, headers: init.headers || {} });
        if (url.includes("/assets")) return Promise.resolve(createResponse({ assets: [{ id: "asset-a", asset_tag: "PAT-001" }] }));
        if (url.includes("/documents")) return Promise.resolve(createResponse({ documents: [{ id: "doc-a", title: "Relatorio" }] }));
        if (url.includes("/notifications")) return Promise.resolve(createResponse({ notifications: [{ id: "notif-a", title: "Alerta" }] }));
        if (url.includes("/sentinel/alerts")) return Promise.resolve(createResponse({ alerts: [{ id: "alert-a", severity: "high" }] }));
        if (url.includes("/reports/preview")) return Promise.resolve(createResponse({ report: { id: "report-a" } }));
        if (url.includes("/reports/archive")) return Promise.resolve(createResponse({ archived: true }));
        if (url.includes("/evidences")) return Promise.resolve(createResponse({ evidences: [{ id: "ev-a" }] }));
        if (url.includes("/timeline")) return Promise.resolve(createResponse({ events: [{ id: "event-a" }] }));
        if (url.includes("/pending-items/pending-a/validate")) return Promise.resolve(createResponse({ pending_item: { id: "pending-a", status: "resolved" } }));
        if (url.includes("/pending-items/pending-a/evidences")) return Promise.resolve(createResponse({ link: { id: "link-a" } }));
        if (url.includes("/pending-items/pending-a")) return Promise.resolve(createResponse({ pending_item: { id: "pending-a" } }));
        if (url.includes("/pending-items")) return Promise.resolve(createResponse({ pending_items: [{ id: "pending-a", status: parsed.searchParams.get("status") || "open" }] }));
        return Promise.resolve(createResponse({}));
      }
    }
  };
  sandbox.window.window = sandbox.window;
  sandbox.fetch = sandbox.window.fetch;
  vm.createContext(sandbox);
  [
    "relatorio-qualidade-obras/elo-municipal-action-adapter.js",
    "relatorio-qualidade-obras/elo-municipal-sentinel-adapter.js",
    "relatorio-qualidade-obras/elo-command-bridge.js"
  ].forEach((file) => vm.runInContext(readFileSync(join(root, file), "utf8"), sandbox, { filename: file }));
  return { window: sandbox.window, calls };
}

test("municipal adapter bloqueia sem token e sem prefeitura", async () => {
  const noToken = loadBridge({ token: false });
  const auth = await noToken.window.EloCommandBridge.execute({ module: "municipal", action: "assets.list", context: {}, dryRun: true });
  assert.equal(auth.ok, false);
  assert.equal(auth.error, "authentication_required");

  const noInstitution = loadBridge({ context: { institutionId: "", institution_id: "" } });
  const inst = await noInstitution.window.EloCommandBridge.execute({ module: "municipal", action: "municipal.attention", context: { authToken: "token-a" }, dryRun: true });
  assert.equal(inst.ok, false);
  assert.equal(inst.error, "institution_id_required");
});

test("municipal read actions chamam endpoints reais com tenant", async () => {
  const { window, calls } = loadBridge();
  await window.EloCommandBridge.execute({ module: "municipal", action: "municipal.attention", context: { authToken: "token-a" }, dryRun: true });
  await window.EloCommandBridge.execute({ module: "municipal", action: "assets.list", context: { authToken: "token-a" }, dryRun: true });
  await window.EloCommandBridge.execute({ module: "municipal", action: "archive.documents.list", context: { authToken: "token-a" }, dryRun: true });
  await window.EloCommandBridge.execute({ module: "municipal", action: "notifications.list", context: { authToken: "token-a" }, dryRun: true });

  assert.ok(calls.some((call) => call.path === "/api/municipal-admin/sentinel/alerts"));
  assert.ok(calls.some((call) => call.path === "/api/municipal-admin/assets"));
  assert.ok(calls.some((call) => call.path === "/api/municipal-admin/documents"));
  assert.ok(calls.some((call) => call.path === "/api/municipal-admin/notifications"));
  assert.ok(calls.every((call) => call.search.get("institution_id") === "inst-a"));
});

test("reports preview e archive respeitam dry-run confirmacao e operation_id", async () => {
  const { window, calls } = loadBridge();
  const preview = await window.EloCommandBridge.execute({ module: "municipal", action: "reports.preview", context: { authToken: "token-a" }, dryRun: true });
  assert.equal(preview.requiresConfirmation, true);
  assert.equal(calls.some((call) => call.path === "/api/municipal-admin/reports/preview"), false);

  const endpointPreview = await window.EloCommandBridge.execute({ module: "municipal", action: "reports.preview", context: { authToken: "token-a" }, payload: { report: { title: "Demo" } } });
  assert.equal(endpointPreview.ok, true);
  assert.ok(calls.some((call) => call.path === "/api/municipal-admin/reports/preview" && call.body.title === "Demo"));

  const noConfirm = await window.EloCommandBridge.execute({ module: "municipal", action: "reports.archive", context: { authToken: "token-a" }, payload: { operation_id: "op-a" } });
  assert.equal(noConfirm.ok, false);
  assert.equal(noConfirm.error, "confirmation_required");

  const noOperation = await window.EloCommandBridge.execute({ module: "municipal", action: "reports.archive", context: { authToken: "token-a" }, payload: { confirmation: true } });
  assert.equal(noOperation.ok, false);
  assert.equal(noOperation.error, "operation_id_required");

  const archived = await window.EloCommandBridge.execute({ module: "municipal", action: "reports.archive", context: { authToken: "token-a" }, payload: { confirmation: true, operation_id: "op-a", report: { id: "report-a" } } });
  assert.equal(archived.ok, true);
  assert.ok(calls.some((call) => call.path === "/api/municipal-admin/reports/archive" && call.body.operation_id === "op-a"));
});

test("sentinel lista pendencias e exige project para escopo operacional", async () => {
  const noProject = loadBridge({ context: { projectId: "", project_id: "" } });
  const blocked = await noProject.window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.list", context: { authToken: "token-a" }, dryRun: true });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "project_id_required");

  const { window, calls } = loadBridge();
  await window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.list", context: { authToken: "token-a" }, payload: { status: "open" }, dryRun: true });
  await window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.list", context: { authToken: "token-a" }, payload: { status: "awaiting_validation" }, dryRun: true });
  const pendingCalls = calls.filter((call) => call.path === "/api/elo/sentinel/pending-items");
  assert.equal(pendingCalls[0].search.get("status"), "open");
  assert.equal(pendingCalls[1].search.get("status"), "awaiting_validation");
  assert.ok(pendingCalls.every((call) => call.search.get("project_id") === "obra-a"));
});

test("sentinel writes de pendencia exigem preview/confirmacao", async () => {
  const { window, calls } = loadBridge();
  const createPreview = await window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.create", context: { authToken: "token-a" }, payload: { title: "Corrigir placa" }, dryRun: true });
  assert.equal(createPreview.requiresConfirmation, true);
  assert.equal(calls.length, 0);

  const createBlocked = await window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.create", context: { authToken: "token-a" }, payload: { title: "Corrigir placa" } });
  assert.equal(createBlocked.error, "confirmation_required");

  const created = await window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.create", context: { authToken: "token-a" }, payload: { title: "Corrigir placa", confirmation: true } });
  assert.equal(created.ok, true);
  assert.ok(calls.some((call) => call.path === "/api/elo/sentinel/pending-items" && call.method === "POST" && call.body.title === "Corrigir placa"));

  const updated = await window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.update", context: { authToken: "token-a" }, payload: { notes: "Ajustado", confirmation: true } });
  assert.equal(updated.ok, true);
  assert.ok(calls.some((call) => call.path === "/api/elo/sentinel/pending-items/pending-a" && call.method === "PUT" && call.body.notes === "Ajustado"));

  const linked = await window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.linkEvidence", context: { authToken: "token-a" }, payload: { evidence_id: "ev-a", confirmation: true } });
  assert.equal(linked.ok, true);
  assert.ok(calls.some((call) => call.path === "/api/elo/sentinel/pending-items/pending-a/evidences" && call.method === "POST" && call.body.evidence_id === "ev-a"));
});
test("sentinel validate respeita dryRun confirmacao notes e nao envia validated_by", async () => {
  const { window, calls } = loadBridge();
  const dryRun = await window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.validate", context: { authToken: "token-a" }, payload: { decision: "approved" }, dryRun: true });
  assert.equal(dryRun.requiresConfirmation, true);
  assert.equal(calls.length, 0);

  const noConfirm = await window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.validate", context: { authToken: "token-a" }, payload: { decision: "approved" } });
  assert.equal(noConfirm.error, "confirmation_required");

  const rejectedNoNotes = await window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.validate", context: { authToken: "token-a" }, payload: { decision: "rejected", confirmation: true } });
  assert.equal(rejectedNoNotes.error, "validation_notes_required");

  const rejected = await window.EloCommandBridge.execute({ module: "municipal_sentinel", action: "sentinel.pending.validate", context: { authToken: "token-a" }, payload: { decision: "rejected", notes: "Faltou acabamento", confirmation: true, validated_by: "malicious" } });
  assert.equal(rejected.ok, true);
  const call = calls.find((item) => item.path === "/api/elo/sentinel/pending-items/pending-a/validate");
  assert.equal(call.method, "POST");
  assert.equal(call.body.validated_by, undefined);
  assert.equal(call.body.notes, "Faltou acabamento");
});


