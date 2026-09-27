import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { createApp, createEloVectorMemoryStore_ } from "../src/app.js";
import { createEloCoreStore } from "../src/elo-core-store.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

const ORIGIN = "http://127.0.0.1:5500";
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURES = join(REPO, "tests", "fixtures", "pilot");
const PREVALIDATED_PDF = "C:\\elo-step05-proof\\03-rdo-report.pdf";

function createAuthClient_() {
  const users = new Map([
    ["pilot-token-a", { id: "pilot-user-a", profile: { id: "pilot-profile-a", auth_user_id: "pilot-user-a", institution_id: "pilot-tenant-elo", email: "pilot@example.test", role: "admin" } }],
    ["pilot-token-b", { id: "pilot-user-b", profile: { id: "pilot-profile-b", auth_user_id: "pilot-user-b", institution_id: "other-tenant", email: "other@example.test", role: "admin" } }]
  ]);
  return {
    auth: {
      async getUser(token) {
        const entry = users.get(token);
        return entry ? { data: { user: { id: entry.id, email: entry.profile.email } }, error: null } : { data: { user: null }, error: { message: "invalid token" } };
      }
    },
    from(table) {
      assert.equal(table, "profiles");
      let requestedUserId = "";
      return {
        select() { return this; },
        eq(column, value) { if (column === "auth_user_id") requestedUserId = value; return this; },
        async maybeSingle() {
          for (const entry of users.values()) if (entry.profile.auth_user_id === requestedUserId) return { data: entry.profile, error: null };
          return { data: null, error: null };
        }
      };
    }
  };
}

async function listen_(app) {
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  return { server, url: "http://127.0.0.1:" + server.address().port };
}

async function json_(url, path, options = {}) {
  const response = await fetch(url + path, {
    ...options,
    headers: {
      Origin: ORIGIN,
      Authorization: "Bearer pilot-token-a",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  return { response, data: text ? JSON.parse(text) : {} };
}

test("pilot-demo-smoke percorre auth, obra, stock, RDO, vistoria, anexo, relatório e memória", async () => {
  const work = JSON.parse(readFileSync(join(FIXTURES, "demo-work.json"), "utf8"));
  const stock = JSON.parse(readFileSync(join(FIXTURES, "stock-state.json"), "utf8"));
  const rdoFixture = JSON.parse(readFileSync(join(FIXTURES, "rdo.json"), "utf8"));
  const inspectionFixture = JSON.parse(readFileSync(join(FIXTURES, "inspection.json"), "utf8"));
  const analysisText = readFileSync(join(FIXTURES, "analysis.txt"), "utf8");
  const visualFixture = readFileSync(join(FIXTURES, "site-note.svg"), "utf8");
  const tempDir = mkdtempSync(join(tmpdir(), "elo-pilot-demo-smoke-"));
  const authClient = createAuthClient_();
  const vectorStore = createEloVectorMemoryStore_({ memoryOnly: true });
  const app = createApp({
    env: { ELO_RDO_STORE: "file", ELO_APARTMENT_HANDOVER_STORE: "file", AI_ALLOWED_ORIGINS: ORIGIN, OPENAI_API_KEY: "" },
    authContextSupabaseClient: authClient,
    obraReportTransactionalService: createObraReportTransactionalService({ dataPath: join(tempDir, "obrareport.json") }),
    eloCoreStore: createEloCoreStore({ dataPath: join(tempDir, "elo-core.json") }),
    eloVectorMemoryStore: vectorStore,
    enableEloTelemetryRetention: false
  });
  const harness = await listen_(app);
  const authHeaders = { Authorization: "Bearer pilot-token-a", "x-institution-id": "pilot-tenant-elo", "x-user-id": "pilot-user-a" };
  try {
    const auth = await app.locals.resolveCanonicalAuthContext({ headers: { authorization: authHeaders.Authorization } });
    assert.equal(auth.ok, true);
    assert.equal(auth.userId, "pilot-user-a");
    assert.equal(auth.institutionId, "pilot-tenant-elo");
    assert.notEqual(auth.user.email, "local@obrareport.app");

    assert.equal(work.name, "Residencial Horizonte");
    assert.equal(work.institutionId, auth.institutionId);
    assert.equal(work.fictional, true);

    const stockSaved = await json_(harness.url, "/api/stock-demo/state", { method: "POST", headers: authHeaders, body: JSON.stringify({ key: work.id, state: stock }) });
    assert.equal(stockSaved.response.status, 200);
    const stockRead = await json_(harness.url, "/api/stock-demo/state?key=" + encodeURIComponent(work.id), { headers: authHeaders });
    assert.equal(stockRead.response.status, 200);
    assert.equal(stockRead.data.state.items.find((item) => item.id === "cemento-001").quantity, 42);

    const rdoCreated = await json_(harness.url, "/api/obrareport/rdos", { method: "POST", headers: authHeaders, body: JSON.stringify({ projectId: work.id, title: rdoFixture.title, rdoDate: rdoFixture.date, rdoData: rdoFixture }) });
    assert.equal(rdoCreated.response.status, 201);
    const rdoId = rdoCreated.data.rdo.id;
    const rdoRead = await json_(harness.url, "/api/obrareport/rdos/" + encodeURIComponent(rdoId), { headers: authHeaders });
    assert.equal(rdoRead.response.status, 200);
    assert.equal(rdoRead.data.rdo.project_id, work.id);
    assert.equal(rdoRead.data.rdo.rdo_data_json.services.includes("alvenaria"), true);

    const inspectionCreated = await json_(harness.url, "/api/obrareport/apartment-handover-inspections", { method: "POST", headers: authHeaders, body: JSON.stringify({ projectId: work.id, title: inspectionFixture.title, sourceType: inspectionFixture.sourceType, inspectionData: inspectionFixture.inspectionData, idempotencyKey: "pilot-inspection-1" }) });
    assert.equal(inspectionCreated.response.status, 201);
    const inspectionId = inspectionCreated.data.inspection.id;
    const inspectionItem = await json_(harness.url, "/api/obrareport/apartment-handover-inspections/" + encodeURIComponent(inspectionId), { method: "PUT", headers: authHeaders, body: JSON.stringify({ itemUpdate: { itemId: "sink-kitchen", status: "C", notes: "Vedação revisada na demonstração." } }) });
    assert.equal(inspectionItem.response.status, 200);
    assert.equal(inspectionItem.data.inspection.inspection_data_json.items.find((item) => item.id === "sink-kitchen").status, "C");

    const form = new FormData();
    form.append("message", "Analise o anexo da vistoria da obra demonstrativa.");
    form.append("context", JSON.stringify({ projectId: work.id, institutionId: "spoofed-tenant-must-not-win" }));
    form.append("history", "[]");
    form.append("files", new Blob([analysisText], { type: "text/plain" }), "analysis.txt");
    form.append("files", new Blob([visualFixture], { type: "image/svg+xml" }), "site-note.svg");
    const attachment = await fetch(harness.url + "/api/elo/chat", { method: "POST", headers: { Origin: ORIGIN, Authorization: authHeaders.Authorization }, body: form });
    const attachmentData = await attachment.json();
    assert.ok([201, 503].includes(attachment.status), JSON.stringify(attachmentData));
    assert.ok(vectorStore.list().some((item) => item.metadata && item.metadata.fileName === "analysis.txt"));
    assert.ok(vectorStore.list().every((item) => item.metadata.institutionId === "pilot-tenant-elo"));

    const memory = await json_(harness.url, "/api/elo/chat", { method: "POST", headers: authHeaders, body: JSON.stringify({ message: "memorize: o responsável da obra demonstrativa é Carlos Demo", anonymousId: "pilot-user-a", context: { projectId: work.id }, history: [] }) });
    assert.equal(memory.response.status, 201);
    assert.equal(memory.data.mode, "memory_saved");
    const memories = await createEloCoreStore({ dataPath: join(tempDir, "elo-core.json") }).listMemories({ userId: "pilot-user-a" });
    assert.ok(memories.some((item) => /Carlos Demo/.test(item.memory_value)));

    const report = await json_(harness.url, "/api/obrareport/reports", { method: "POST", headers: authHeaders, body: JSON.stringify({ projectId: work.id, title: "Relatório da análise — Residencial Horizonte", reportData: { source: "analysis", analysis: analysisText, conclusion: "Refazer vedação e registrar evidência." } }) });
    assert.equal(report.response.status, 201, JSON.stringify(report.data));
    const reportDocument = await json_(harness.url, "/api/obrareport/reports/" + encodeURIComponent(report.data.report.id) + "/generate-document", { method: "POST", headers: authHeaders, body: "{}" });
    assert.equal(reportDocument.response.status, 201);
    assert.equal(reportDocument.data.document.source_type, "technical_report");
    assert.match(reportDocument.data.document.document_type, /technical_report/);

    assert.equal(existsSync(PREVALIDATED_PDF), true);
    const pdfBytes = readFileSync(PREVALIDATED_PDF);
    assert.equal(pdfBytes.subarray(0, 5).toString("ascii"), "%PDF-");
  } finally {
    await new Promise((resolve) => harness.server.close(resolve));
    rmSync(tempDir, { recursive: true, force: true });
  }
});
