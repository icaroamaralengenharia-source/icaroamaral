import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createEloSentinelMemoryStore } from "../src/elo-sentinel-store.js";

async function withServer(options = {}, callback) {
  const app = createApp(Object.assign({
    env: Object.assign({}, process.env, { ELO_SENTINEL_ENABLED: "" }, options.env || {}),
    eloSentinelStore: options.store || createEloSentinelMemoryStore()
  }, options.appOptions || {}));
  app.locals.resolveAuthContext = async (request) => {
    const auth = String(request.headers.authorization || "");
    if (auth === "Bearer tenant-b") {
      return {
        ok: true,
        userId: "user-b",
        institutionId: options.institutionIdB || "inst-b",
        companyId: options.companyIdB || "company-b",
        profile: { id: "profile-b", institution_id: options.institutionIdB || "inst-b", company_id: options.companyIdB || "company-b" }
      };
    }
    if (auth !== "Bearer tenant-a") return { ok: false, status: 401, error: "invalid_session" };
    return {
      ok: true,
      userId: "user-a",
      institutionId: options.institutionIdA,
      companyId: options.companyIdA,
      profile: { id: "profile-a", institution_id: options.institutionIdA, company_id: options.companyIdA }
    };
  };
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function json(base, method, path, body, token = "tenant-a") {
  const response = await fetch(base + path, {
    method,
    headers: Object.assign({
      Authorization: "Bearer " + token
    }, body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  return { response, data: await response.json() };
}

test("ELO Sentinela fica desligado por padrao e backend inicia", async () => {
  await withServer({ institutionIdA: "inst-a", companyIdA: "company-a" }, async (base) => {
    const result = await json(base, "GET", "/api/elo/sentinel/evidences?projectId=obra-a");
    assert.equal(result.response.status, 503);
    assert.equal(result.data.error, "elo_sentinel_disabled");

    const health = await fetch(base + "/api/health");
    assert.equal(health.status, 200);
  });
});

test("/api/elo/chat nao e interceptado pelo Sentinela desligado", async () => {
  await withServer({ institutionIdA: "inst-a", companyIdA: "company-a" }, async (base) => {
    const result = await json(base, "POST", "/api/elo/chat", { message: "Ola" });
    assert.notEqual(result.data.error, "elo_sentinel_disabled");
  });
});

test("ELO Sentinela rejeita escopo incompleto", async () => {
  await withServer({ env: { ELO_SENTINEL_ENABLED: "true" }, institutionIdA: "inst-a", companyIdA: "company-a" }, async (base) => {
    const noProject = await json(base, "GET", "/api/elo/sentinel/evidences");
    assert.equal(noProject.response.status, 400);
    assert.equal(noProject.data.error, "project_id_required");
  });

  await withServer({ env: { ELO_SENTINEL_ENABLED: "true" }, institutionIdA: "inst-a", companyIdA: "" }, async (base) => {
    const noCompany = await json(base, "GET", "/api/elo/sentinel/evidences?projectId=obra-a");
    assert.equal(noCompany.response.status, 400);
    assert.equal(noCompany.data.error, "company_id_required");
  });

  await withServer({ env: { ELO_SENTINEL_ENABLED: "true" }, institutionIdA: "", companyIdA: "company-a" }, async (base) => {
    const noInstitution = await json(base, "GET", "/api/elo/sentinel/evidences?projectId=obra-a");
    assert.equal(noInstitution.response.status, 400);
    assert.equal(noInstitution.data.error, "institution_id_required");
  });
});

test("ELO Sentinela isola evidencias e timeline por tenant e obra", async () => {
  const store = createEloSentinelMemoryStore();
  await withServer({ env: { ELO_SENTINEL_ENABLED: "true" }, store, institutionIdA: "inst-a", companyIdA: "company-a" }, async (base) => {
    const created = await json(base, "POST", "/api/elo/sentinel/evidences", {
      projectId: "obra-a",
      evidence_type: "text",
      source: "manual",
      title: "Conferencia de fundacao",
      description: "Registro inicial controlado"
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.evidence.project_id, "obra-a");

    const sameWork = await json(base, "GET", "/api/elo/sentinel/evidences?projectId=obra-a");
    assert.equal(sameWork.response.status, 200);
    assert.equal(sameWork.data.evidences.length, 1);

    const otherWork = await json(base, "GET", "/api/elo/sentinel/evidences?projectId=obra-b");
    assert.equal(otherWork.response.status, 200);
    assert.equal(otherWork.data.evidences.length, 0);

    const tenantB = await json(base, "GET", "/api/elo/sentinel/evidences?projectId=obra-a&institutionId=inst-a&companyId=company-a", undefined, "tenant-b");
    assert.equal(tenantB.response.status, 200);
    assert.equal(tenantB.data.evidences.length, 0);

    const timeline = await json(base, "GET", "/api/elo/sentinel/timeline?projectId=obra-a");
    assert.equal(timeline.response.status, 200);
    assert.equal(timeline.data.events.length, 1);
    assert.equal(timeline.data.events[0].event_type, "evidence_registered");

    const otherTimeline = await json(base, "GET", "/api/elo/sentinel/timeline?projectId=obra-b");
    assert.equal(otherTimeline.response.status, 200);
    assert.equal(otherTimeline.data.events.length, 0);
  });
});

test("falha do store Sentinela nao derruba ELO nem ObraReport", async () => {
  const brokenStore = {
    async createEvidence() { throw Object.assign(new Error("sentinel_store_failed"), { status: 503 }); },
    async listEvidences() { throw Object.assign(new Error("sentinel_store_failed"), { status: 503 }); },
    async createEvent() { throw Object.assign(new Error("sentinel_store_failed"), { status: 503 }); },
    async listTimeline() { throw Object.assign(new Error("sentinel_store_failed"), { status: 503 }); }
  };
  await withServer({ env: { ELO_SENTINEL_ENABLED: "true" }, store: brokenStore, institutionIdA: "inst-a", companyIdA: "company-a" }, async (base) => {
    const sentinel = await json(base, "GET", "/api/elo/sentinel/evidences?projectId=obra-a");
    assert.equal(sentinel.response.status, 503);
    assert.equal(sentinel.data.error, "sentinel_store_failed");

    const health = await fetch(base + "/api/health");
    assert.equal(health.status, 200);

    const reports = await json(base, "GET", "/api/obrareport/reports");
    assert.notEqual(reports.data.error, "sentinel_store_failed");
  });
});

test("schema Sentinela e aditivo e nao altera tabelas existentes", () => {
  const schema = readFileSync(new URL("../src/data/elo-sentinel-schema.sql", import.meta.url), "utf8");
  assert.match(schema, /create table if not exists public\.elo_sentinel_evidences/);
  assert.match(schema, /create table if not exists public\.elo_sentinel_events/);
  assert.doesNotMatch(schema, /alter table public\.(?!elo_sentinel_)/i);
  assert.doesNotMatch(schema, /drop table|drop column|rename column|rename to/i);
});
