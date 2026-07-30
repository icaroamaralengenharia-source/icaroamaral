import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createEloArchiveService } from "../src/elo-archive-service.js";
import { createEloSentinelMemoryStore } from "../src/elo-sentinel-store.js";
import { createEloBudgetService } from "../src/services/elo-budget-service.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

function tempPath(name) {
  return join(mkdtempSync(join(tmpdir(), "elo-archive-")), name);
}

function context(projectId = "obra-a", companyId = "company-a") {
  return { institutionId: "inst-a", companyId, projectId, profile: { id: "user-a", institution_id: "inst-a", company_id: companyId } };
}

function buildServices() {
  const obra = createObraReportTransactionalService({ dataPath: tempPath("obra.json") });
  const budget = createEloBudgetService({
    dataPath: tempPath("budget.json"),
    pdfAdapterFactory() {
      return {
        buildBudgetV2ProfessionalPdfDataForTest(documentData) { return { record: documentData, context: {} }; },
        buildProfessionalPdfDocumentForTest() { return "<html>orcamento</html>"; }
      };
    }
  });
  return { obra, budget };
}

async function seedArchive() {
  const { obra, budget } = buildServices();
  const ctx = context();
  const report = obra.createTechnicalReport(ctx, { projectId: "obra-a", title: "Relatorio de fissuras", reportData: { title: "Relatorio de fissuras" } });
  const rdo = obra.createRdo(ctx, { projectId: "obra-a", title: "RDO concreto", rdoData: { date: "2026-07-29", activities: ["concretagem"] } });
  obra.generateTechnicalReportDocument(ctx, report.id);
  obra.generateRdoDocument(ctx, rdo.id);
  const bud = budget.createBudget({ title: "Orcamento fundacao", projectId: "obra-a", items: [{ name: "Fundacao" }] }, ctx);
  budget.generateBudgetPdf(bud.id, ctx);
  const sources = [
    { id: "sent-1", institution_id: "inst-a", company_id: "company-a", project_id: "obra-a", source_module: "sentinel", source_entity_type: "evidence", source_entity_id: "sent-1", title: "Foto de fachada", document_type: "photo", status: "registered", occurred_at: "2026-07-30T10:00:00.000Z", file_reference: { kind: "source", source_entity_id: "sent-1" }, metadata: { file_hash: "abc", secret: "nope" } },
    { id: "other-company", institution_id: "inst-a", company_id: "company-b", project_id: "obra-a", source_module: "sentinel", source_entity_type: "evidence", source_entity_id: "sent-2", title: "Outra empresa", document_type: "photo", status: "registered" },
    { id: "other-project", institution_id: "inst-a", company_id: "company-a", project_id: "obra-b", source_module: "sentinel", source_entity_type: "evidence", source_entity_id: "sent-3", title: "Outra obra", document_type: "photo", status: "registered" }
  ];
  return { service: createEloArchiveService({ obraReportTransactionalService: obra, eloBudgetService: budget, sources }), obra, budget };
}

test("EloArchiveItem agrega fontes reais, filtra, busca, ordena e pagina", async () => {
  const { service } = await seedArchive();
  const list = await service.listArchive(Object.assign({}, context(), { institution_id: "inst-a", company_id: "company-a", project_id: "obra-a", limit: 20 }));
  assert.equal(list.warnings.length, 0);
  assert.ok(list.items.length >= 7);
  const modules = new Set(list.items.map((item) => item.source_module));
  ["rdo", "technical_report", "generated_document", "elo_budget", "budget_pdf", "sentinel"].forEach((mod) => assert.ok(modules.has(mod), mod));
  assert.equal(list.items.some((item) => JSON.stringify(item).includes("orcamento</html>")), false);
  assert.equal(list.items.some((item) => JSON.stringify(item).includes("secret")), false);
  assert.ok(list.items.every((item) => item.metadata && item.metadata.operational_contract));
  assert.ok(list.items.some((item) => item.metadata.operational_contract.source_module === "rdo"));

  const searched = await service.listArchive(Object.assign({}, context(), { institution_id: "inst-a", company_id: "company-a", project_id: "obra-a", search: "fissuras" }));
  assert.ok(searched.items.every((item) => JSON.stringify(item).toLowerCase().includes("fissuras")));

  const filtered = await service.listArchive(Object.assign({}, context(), { institution_id: "inst-a", company_id: "company-a", project_id: "obra-a", source_module: "rdo" }));
  assert.ok(filtered.items.length >= 1);
  assert.ok(filtered.items.every((item) => item.source_module === "rdo"));

  const page = await service.listArchive(Object.assign({}, context(), { institution_id: "inst-a", company_id: "company-a", project_id: "obra-a", limit: 2 }));
  assert.equal(page.items.length, 2);
  assert.equal(page.page.has_more, true);
  assert.equal(page.page.cursor, "2");
  assert.ok(page.items[0].occurred_at >= page.items[1].occurred_at);
});

test("Acervo isola obra, empresa, fonte vazia e item orfao", async () => {
  const { service, obra } = await seedArchive();
  const otherWork = await service.listArchive({ institution_id: "inst-a", company_id: "company-a", project_id: "obra-b" });
  assert.equal(otherWork.items.some((item) => item.title === "Outra obra"), true);
  assert.equal(otherWork.items.some((item) => item.title === "RDO concreto"), false);

  const otherCompany = await service.listArchive({ institution_id: "inst-a", company_id: "company-b", project_id: "obra-a" });
  assert.equal(otherCompany.items.some((item) => item.title === "Outra empresa"), true);
  assert.equal(otherCompany.items.some((item) => item.title === "Foto de fachada"), false);

  const empty = await createEloArchiveService({ sources: [] }).listArchive({ institution_id: "inst-a", company_id: "company-a", project_id: "obra-a" });
  assert.deepEqual(empty.items, []);

  const raw = JSON.parse(readFileSync(obra.dataPath, "utf8"));
  raw.generatedDocuments.orphan = { id: "orphan", institution_id: "inst-a", source_type: "rdo", source_id: "missing", document_type: "rdo_controlled_html", status: "generated", file_id: "missing" };
  assert.equal(Boolean(raw.generatedDocuments.orphan), true);
  const after = await service.listArchive({ institution_id: "inst-a", company_id: "company-a", project_id: "obra-a" });
  assert.equal(after.items.some((item) => item.source_entity_id === "orphan"), false);
});

async function withServer(options = {}, callback) {
  const { obra, budget } = buildServices();
  const archiveService = options.archiveService || createEloArchiveService({ obraReportTransactionalService: obra, eloBudgetService: budget, sources: options.sources || [] });
  const app = createApp({
    env: Object.assign({}, process.env, { ELO_ARCHIVE_ENABLED: "" }, options.env || {}),
    eloSentinelStore: createEloSentinelMemoryStore(),
    archiveService,
    obraReportTransactionalService: obra,
    eloBudgetService: budget
  });
  app.locals.resolveAuthContext = async (request) => {
    const auth = String(request.headers.authorization || "");
    if (auth === "Bearer tenant-b") return { ok: true, userId: "user-b", institutionId: "inst-b", companyId: "company-b", profile: { id: "user-b", institution_id: "inst-b", company_id: "company-b" } };
    return { ok: true, userId: "user-a", institutionId: "inst-a", companyId: "company-a", profile: { id: "user-a", institution_id: "inst-a", company_id: "company-a" } };
  };
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  try { await callback("http://127.0.0.1:" + server.address().port, { obra, budget }); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function get(base, path, token = "tenant-a") {
  const response = await fetch(base + path, { headers: { Authorization: "Bearer " + token } });
  return { response, data: await response.json() };
}

test("rota /api/elo/projects/:projectId/archive respeita flag, isolamento e falha segura", async () => {
  await withServer({}, async (base) => {
    const off = await get(base, "/api/elo/projects/obra-a/archive");
    assert.equal(off.response.status, 503);
    assert.equal(off.data.error, "elo_archive_disabled");
  });

  await withServer({ env: { ELO_ARCHIVE_ENABLED: "true" }, sources: [{ institution_id: "inst-a", company_id: "company-a", project_id: "obra-a", source_module: "sentinel", source_entity_type: "evidence", source_entity_id: "ev-1", title: "Evidencia real", document_type: "photo", status: "registered" }] }, async (base) => {
    const ok = await get(base, "/api/elo/projects/obra-a/archive?document_type=photo");
    assert.equal(ok.response.status, 200);
    assert.equal(ok.data.items.length, 1);
    const tenantB = await get(base, "/api/elo/projects/obra-a/archive", "tenant-b");
    assert.equal(tenantB.response.status, 200);
    assert.equal(tenantB.data.items.length, 0);
  });

  await withServer({ env: { ELO_ARCHIVE_ENABLED: "true" }, archiveService: { async listArchive() { throw Object.assign(new Error("archive_failed"), { status: 503 }); } } }, async (base) => {
    const archive = await get(base, "/api/elo/projects/obra-a/archive");
    assert.equal(archive.response.status, 503);
    assert.equal(archive.data.error, "archive_failed");
    const chat = await fetch(base + "/api/elo/chat", { method: "POST", headers: { Authorization: "Bearer tenant-a", "Content-Type": "application/json" }, body: JSON.stringify({ message: "oi" }) });
    const data = await chat.json();
    assert.notEqual(data.error, "archive_failed");
  });
});

test("frontend do Acervo tem flag, responsividade e abertura por mecanismo real", () => {
  const html = readFileSync(new URL("../../elo.html", import.meta.url), "utf8");
  const js = readFileSync(new URL("../../relatorio-qualidade-obras/elo-archive-ui.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../relatorio-qualidade-obras/elo-sentinel-ui.css", import.meta.url), "utf8");
  assert.match(html, /data-elo-sentinel-mode="archive"[^>]*hidden/);
  assert.match(html, /data-elo-archive-root hidden/);
  assert.match(js, /ELO_ARCHIVE_UI_ENABLED/);
  assert.match(js, /eloArchiveUiEnabled/);
  assert.match(js, /window\.open\(base\(\)\+ref\.endpoint/);
  assert.match(js, /elo_archive_disabled/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.elo-archive-filters/);
});
