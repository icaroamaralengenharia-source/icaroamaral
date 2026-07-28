import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createEloSentinelMemoryStore } from "../src/elo-sentinel-store.js";

async function withServer(options = {}, callback) {
  const app = createApp({
    env: Object.assign({}, process.env, { ELO_SENTINEL_ENABLED: "true" }, options.env || {}),
    eloSentinelStore: options.store || createEloSentinelMemoryStore(),
    aiHandler: options.aiHandler,
    obraReportTransactionalService: options.obraReportTransactionalService
  });
  app.locals.resolveAuthContext = async (request) => {
    const auth = String(request.headers.authorization || "");
    if (auth === "Bearer tenant-b") {
      return {
        ok: true,
        userId: "user-b",
        institutionId: "inst-b",
        companyId: "company-b",
        profile: { id: "profile-b", institution_id: "inst-b", company_id: "company-b" }
      };
    }
    if (auth !== "Bearer tenant-a") return { ok: false, status: 401, error: "invalid_session" };
    return {
      ok: true,
      userId: "user-a",
      institutionId: "inst-a",
      companyId: "company-a",
      profile: { id: "profile-a", institution_id: "inst-a", company_id: "company-a" }
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
    headers: Object.assign({ Authorization: "Bearer " + token }, body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  return { response, data: await response.json() };
}

test("Fase 2 cria evidencia textual persistente, hash deterministico e evento automatico", async () => {
  await withServer({}, async (base) => {
    const content = "Concretagem conferida no bloco A";
    const created = await json(base, "POST", "/api/elo/sentinel/evidences", {
      project_id: "obra-a",
      evidence_type: "text",
      source: "manual",
      title: "Conferencia de concretagem",
      description: content,
      content,
      occurred_at: "2026-07-28T10:00:00.000Z",
      idempotency_key: "op-001"
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.evidence.file_hash, createHash("sha256").update(content).digest("hex"));
    assert.equal(created.data.evidence.metadata.hash_source, "content_sha256");
    assert.equal(created.data.evidence.status, "registered");
    assert.equal(created.data.event.event_type, "evidence_created");
    assert.equal(created.data.event.evidence_id, created.data.evidence.id);
    assert.equal(created.data.event.metadata.evidence_type, "text");

    const list = await json(base, "GET", "/api/elo/sentinel/evidences?project_id=obra-a");
    assert.equal(list.response.status, 200);
    assert.equal(list.data.evidences.length, 1);
    assert.equal(list.data.page.has_more, false);

    const timeline = await json(base, "GET", "/api/elo/sentinel/timeline?project_id=obra-a");
    assert.equal(timeline.response.status, 200);
    assert.equal(timeline.data.events.length, 1);
    assert.equal(timeline.data.events[0].evidence.id, created.data.evidence.id);
  });
});

test("Fase 2 aceita referencia segura de arquivo e rejeita storage_path inseguro", async () => {
  await withServer({}, async (base) => {
    const created = await json(base, "POST", "/api/elo/sentinel/evidences", {
      project_id: "obra-a",
      evidence_type: "photo",
      source: "upload",
      title: "Foto da fachada",
      storage_path: "sentinel/obra-a/fachada-01.webp",
      mime_type: "image/webp",
      file_hash: "a".repeat(64)
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.evidence.storage_path, "sentinel/obra-a/fachada-01.webp");

    const unsafe = await json(base, "POST", "/api/elo/sentinel/evidences", {
      project_id: "obra-a",
      evidence_type: "photo",
      title: "Path ruim",
      storage_path: "../secret.env"
    });
    assert.equal(unsafe.response.status, 400);
    assert.equal(unsafe.data.error, "unsafe_storage_path");
  });
});

test("Fase 2 valida contrato sem obra, tipo, texto e campos desconhecidos", async () => {
  await withServer({}, async (base) => {
    const noWork = await json(base, "POST", "/api/elo/sentinel/evidences", { evidence_type: "text", title: "Sem obra", description: "x" });
    assert.equal(noWork.response.status, 400);
    assert.equal(noWork.data.error, "project_id_required");

    const invalidType = await json(base, "POST", "/api/elo/sentinel/evidences", { project_id: "obra-a", evidence_type: "audio", title: "Audio", description: "x" });
    assert.equal(invalidType.response.status, 400);
    assert.equal(invalidType.data.error, "invalid_evidence_type");

    const empty = await json(base, "POST", "/api/elo/sentinel/evidences", { project_id: "obra-a", evidence_type: "text", title: "Vazio" });
    assert.equal(empty.response.status, 400);
    assert.equal(empty.data.error, "evidence_content_required");

    const unknown = await json(base, "POST", "/api/elo/sentinel/evidences", { project_id: "obra-a", evidence_type: "note", title: "Campo", description: "x", validated: true });
    assert.equal(unknown.response.status, 400);
    assert.equal(unknown.data.error, "unknown_evidence_field");
  });
});

test("Fase 2 garante idempotencia por tenant e obra", async () => {
  await withServer({}, async (base) => {
    const body = { project_id: "obra-a", evidence_type: "note", title: "Nota", description: "Primeira", idempotency_key: "same-key" };
    const first = await json(base, "POST", "/api/elo/sentinel/evidences", body);
    const second = await json(base, "POST", "/api/elo/sentinel/evidences", body);
    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 200);
    assert.equal(second.data.idempotent, true);
    assert.equal(second.data.evidence.id, first.data.evidence.id);

    const list = await json(base, "GET", "/api/elo/sentinel/evidences?project_id=obra-a");
    assert.equal(list.data.evidences.length, 1);

    const otherWork = await json(base, "POST", "/api/elo/sentinel/evidences", Object.assign({}, body, { project_id: "obra-b" }));
    assert.equal(otherWork.response.status, 201);
    assert.notEqual(otherWork.data.evidence.id, first.data.evidence.id);
  });
});

test("Fase 2 pagina, filtra e ordena evidencias e timeline", async () => {
  await withServer({}, async (base) => {
    const rows = [
      { title: "A", type: "text", occurred: "2026-07-28T08:00:00.000Z" },
      { title: "B", type: "photo", occurred: "2026-07-28T09:00:00.000Z" },
      { title: "C", type: "text", occurred: "2026-07-29T09:00:00.000Z" }
    ];
    for (const row of rows) {
      await json(base, "POST", "/api/elo/sentinel/evidences", {
        project_id: "obra-a",
        evidence_type: row.type,
        title: row.title,
        description: "desc " + row.title,
        occurred_at: row.occurred
      });
    }

    const page = await json(base, "GET", "/api/elo/sentinel/evidences?project_id=obra-a&limit=2");
    assert.equal(page.data.evidences.length, 2);
    assert.equal(page.data.evidences[0].title, "C");
    assert.equal(page.data.page.has_more, true);

    const filtered = await json(base, "GET", "/api/elo/sentinel/evidences?project_id=obra-a&evidence_type=text&date_from=2026-07-29T00:00:00.000Z");
    assert.deepEqual(filtered.data.evidences.map((item) => item.title), ["C"]);

    const timeline = await json(base, "GET", "/api/elo/sentinel/timeline?project_id=obra-a&event_type=evidence_created&limit=2&offset=1");
    assert.equal(timeline.data.events.length, 2);
    assert.equal(timeline.data.page.offset, 1);
  });
});

test("Fase 2 isola tenant/obra e ignora injecao de tenant no body", async () => {
  await withServer({}, async (base) => {
    const injected = await json(base, "POST", "/api/elo/sentinel/evidences", {
      institution_id: "inst-b",
      company_id: "company-b",
      project_id: "obra-a",
      evidence_type: "text",
      title: "Tentativa",
      description: "Nao deve mudar tenant"
    });
    assert.equal(injected.response.status, 201);
    assert.equal(injected.data.evidence.institution_id, "inst-a");
    assert.equal(injected.data.evidence.company_id, "company-a");

    const tenantB = await json(base, "GET", "/api/elo/sentinel/evidences?project_id=obra-a&institution_id=inst-a&company_id=company-a", undefined, "tenant-b");
    assert.equal(tenantB.response.status, 200);
    assert.equal(tenantB.data.evidences.length, 0);

    const obraB = await json(base, "GET", "/api/elo/sentinel/evidences?project_id=obra-b");
    assert.equal(obraB.response.status, 200);
    assert.equal(obraB.data.evidences.length, 0);
  });
});

test("Fase 2 nao chama IA, RDO ou relatorio ao criar evidencia", async () => {
  const calls = { ai: 0, reports: 0, rdos: 0 };
  const obraReportTransactionalService = {
    createReport() { calls.reports += 1; throw new Error("not_allowed"); },
    createRdo() { calls.rdos += 1; throw new Error("not_allowed"); },
    listReports() { return []; },
    listRdos() { return []; }
  };
  await withServer({ aiHandler() { calls.ai += 1; }, obraReportTransactionalService }, async (base) => {
    const created = await json(base, "POST", "/api/elo/sentinel/evidences", {
      project_id: "obra-a",
      evidence_type: "text",
      title: "Sem automacao",
      description: "Apenas persistencia"
    });
    assert.equal(created.response.status, 201);
    assert.deepEqual(calls, { ai: 0, reports: 0, rdos: 0 });
  });
});
