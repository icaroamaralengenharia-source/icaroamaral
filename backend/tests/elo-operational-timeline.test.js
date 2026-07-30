import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createEloSentinelMemoryStore } from "../src/elo-sentinel-store.js";
import { createEloSentinelService } from "../src/elo-sentinel-service.js";

function authClient() {
  return {
    auth: { async getUser(token) { return { data: { user: { id: token === "tenant-b" ? "user-b" : "user-a" } }, error: null }; } },
    from() {
      return { select() { return this; }, eq(_field, value) { this.userId = value; return this; }, async maybeSingle() {
        const b = this.userId === "user-b";
        return { data: { id: b ? "profile-b" : "profile-a", auth_user_id: this.userId, institution_id: b ? "inst-b" : "inst-a", company_id: b ? "company-b" : "company-a", role: "admin", status: "active" }, error: null };
      } };
    }
  };
}

async function withServer(callback, options = {}) {
  const store = options.store || createEloSentinelMemoryStore();
  const app = createApp({
    env: Object.assign({}, process.env, { ELO_SENTINEL_ENABLED: "true", ELO_OPERATIONAL_TIMELINE_ENABLED: "true" }, options.env || {}),
    eloSentinelStore: store,
    authContextSupabaseClient: authClient()
  });
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  try { await callback("http://127.0.0.1:" + server.address().port, store); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function json(base, method, path, body, token = "tenant-a", extraHeaders = {}) {
  const response = await fetch(base + path, {
    method,
    headers: Object.assign({ Authorization: "Bearer " + token }, extraHeaders, body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  return { response, data: await response.json() };
}

function event(scope, extra) {
  return Object.assign({
    project_id: "obra-a",
    event_type: "entity_changed",
    source_module: "sentinel",
    source_entity_type: "evidence",
    source_entity_id: "source-1",
    title: "Evento base",
    description: "Referencia segura",
    severity: "informational",
    status: "created",
    created_by: "user-a"
  }, scope, extra);
}

test("OperationalTimelineEvent valida contrato, idempotencia, filtros, isolamento e evento orfao", async () => {
  const store = createEloSentinelMemoryStore();
  const service = createEloSentinelService({ store });
  const scope = { institution_id: "inst-a", company_id: "company-a" };
  const created = await service.createOperationalTimelineEvent(event(scope, { idempotency_key: "sentinel:evidence:source-1:entity_changed:1", occurred_at: "2026-07-29T10:00:00.000Z", metadata: { safe: "ok", html_content: "<b>removido</b>" } }));
  const duplicate = await service.createOperationalTimelineEvent(event(scope, { title: "Nao duplica", idempotency_key: "sentinel:evidence:source-1:entity_changed:1" }));
  const version = await service.createOperationalTimelineEvent(event(scope, { title: "Nova versao", version: "2", occurred_at: "2026-07-29T09:00:00.000Z" }));
  const rdo = await service.createOperationalTimelineEvent(event(scope, { event_type: "rdo_created", source_module: "rdo", source_entity_type: "rdo", source_entity_id: "rdo-1", title: "RDO criado", severity: "minor", status: "active", occurred_at: "2026-07-29T11:00:00.000Z" }));
  await service.createOperationalTimelineEvent(event(scope, { project_id: "obra-b", source_entity_id: "source-b", title: "Outra obra" }));
  await service.createOperationalTimelineEvent(event({ institution_id: "inst-b", company_id: "company-b" }, { source_entity_id: "source-c", title: "Outro tenant" }));

  assert.equal(created.idempotent, false);
  assert.equal(duplicate.idempotent, true);
  assert.equal(duplicate.event.id, created.event.id);
  assert.notEqual(version.event.id, created.event.id);
  assert.equal(created.event.metadata.html_content, undefined);

  const list = await service.listOperationalTimeline(Object.assign({}, scope, { project_id: "obra-a" }));
  assert.equal(list.events.length, 3);
  assert.deepEqual(list.events.map((item) => item.title), ["RDO criado", "Evento base", "Nova versao"]);
  assert.equal(list.events.find((item) => item.id === rdo.event.id).source_exists, false);

  const byOrigin = await service.listOperationalTimeline(Object.assign({}, scope, { project_id: "obra-a", source_module: "rdo", source_entity_type: "rdo" }));
  assert.equal(byOrigin.events.length, 1);
  const bySeverity = await service.listOperationalTimeline(Object.assign({}, scope, { project_id: "obra-a", severity: "minor" }));
  assert.equal(bySeverity.events[0].source_module, "rdo");
  const byStatus = await service.listOperationalTimeline(Object.assign({}, scope, { project_id: "obra-a", status: "active" }));
  assert.equal(byStatus.events.length, 1);
  const search = await service.listOperationalTimeline(Object.assign({}, scope, { project_id: "obra-a", search: "RDO" }));
  assert.equal(search.events.length, 1);
  const page = await service.listOperationalTimeline(Object.assign({}, scope, { project_id: "obra-a", limit: 1, offset: 0 }));
  assert.equal(page.events.length, 1);
  assert.equal(page.page.has_more, true);

  await assert.rejects(() => service.createOperationalTimelineEvent(event(scope, { metadata: { note: "ok" }, content: "<html>nao copiar</html>" })), /raw_document_content_not_allowed/);
});

test("rota /api/elo/projects/:projectId/timeline respeita flag, filtros e isolamento", async () => {
  const store = createEloSentinelMemoryStore();
  const service = createEloSentinelService({ store });
  await service.createOperationalTimelineEvent(event({ institution_id: "inst-a", company_id: "company-a" }, { title: "Visivel", source_entity_id: "visible-1" }));
  await service.createOperationalTimelineEvent(event({ institution_id: "inst-b", company_id: "company-b" }, { title: "Invisivel", source_entity_id: "hidden-1" }));
  await withServer(async (base) => {
    const visible = await json(base, "GET", "/api/elo/projects/obra-a/timeline?source_module=sentinel");
    assert.equal(visible.response.status, 200);
    assert.equal(visible.data.events.length, 1);
    assert.equal(visible.data.events[0].title, "Visivel");
    const tenantB = await json(base, "GET", "/api/elo/projects/obra-a/timeline", undefined, "tenant-b");
    assert.equal(tenantB.data.events.some((item) => item.title === "Visivel"), false);
  }, { store });

  await withServer(async (base) => {
    const off = await json(base, "GET", "/api/elo/projects/obra-a/timeline");
    assert.equal(off.response.status, 503);
    assert.equal(off.data.error, "elo_operational_timeline_disabled");
  }, { store, env: { ELO_OPERATIONAL_TIMELINE_ENABLED: "" } });
});

test("adaptadores iniciais registram referencias sem copiar documentos e nao derrubam modulo original", async () => {
  await withServer(async (base) => {
    const headers = { "x-institution-id": "inst-a", "x-company-id": "company-a", "x-user-id": "user-a" };
    const report = await json(base, "POST", "/api/obrareport/reports", { title: "Relatorio A", projectId: "obra-a", reportData: { title: "Relatorio A", html: "nao entra" } }, "tenant-a", headers);
    assert.equal(report.response.status, 201);
    const rdo = await json(base, "POST", "/api/obrareport/rdos", { title: "RDO A", projectId: "obra-a", rdoData: { date: "2026-07-29", activities: ["execucao"] } }, "tenant-a", headers);
    assert.equal(rdo.response.status, 201);
    const doc = await json(base, "POST", `/api/obrareport/reports/${encodeURIComponent(report.data.report.id)}/generate-document`, {}, "tenant-a", headers);
    assert.equal(doc.response.status, 201);
    const budget = await json(base, "POST", "/api/elo/budgets", { projectId: "obra-a", documentData: { title: "Orcamento A", projectId: "obra-a", items: [{ name: "Servico" }] } });
    assert.equal(budget.response.status, 201);
    const pdf = await json(base, "POST", `/api/elo/budgets/${encodeURIComponent(budget.data.budget.id)}/generate-pdf`, {});
    assert.equal(pdf.response.status, 201);

    const timeline = await json(base, "GET", "/api/elo/projects/obra-a/timeline?limit=20");
    assert.equal(timeline.response.status, 200);
    const modules = timeline.data.events.map((item) => item.source_module);
    assert.ok(modules.includes("technical_report"));
    assert.ok(modules.includes("rdo"));
    assert.ok(modules.includes("generated_document"));
    assert.ok(modules.includes("elo_budget"), JSON.stringify(modules));
    assert.ok(modules.includes("budget_pdf"), JSON.stringify(modules));
    assert.equal(timeline.data.events.some((item) => JSON.stringify(item).includes("obrareport-controlled-document")), false);
  });

  const failingStore = createEloSentinelMemoryStore();
  failingStore.createOperationalTimelineEvent = async () => { throw Object.assign(new Error("timeline_failed"), { status: 503 }); };
  await withServer(async (base) => {
    const result = await json(base, "POST", "/api/obrareport/rdos", { title: "RDO sobrevive", projectId: "obra-a", rdoData: { date: "2026-07-29" } }, "tenant-a", { "x-institution-id": "inst-a", "x-company-id": "company-a", "x-user-id": "user-a" });
    assert.equal(result.response.status, 201);
    assert.equal(result.data.rdo.title, "RDO sobrevive");
    const chat = await json(base, "POST", "/api/elo/chat", { message: "oi" });
    assert.notEqual(chat.data.error, "timeline_failed");
  }, { store: failingStore });
});
