import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalReportService } from "../src/municipal-report-service.js";
import { createMunicipalReportArchiveService } from "../src/municipal-report-archive-service.js";

function ctx(role, overrides = {}) {
  return {
    ok: true,
    userId: overrides.userId || role + "-user",
    institutionId: overrides.institutionId ?? "inst-a",
    role,
    profile: {
      id: role + "-profile",
      auth_user_id: overrides.userId || role + "-user",
      institution_id: overrides.institutionId ?? "inst-a",
      unit_id: overrides.unitId || "",
      role,
      status: "active"
    }
  };
}

function setup(extra = {}) {
  const store = createMemoryMunicipalAdminStore(Object.assign({
    institutions: [
      { id: "inst-a", name: "Prefeitura A", status: "active" },
      { id: "inst-b", name: "Prefeitura B", status: "active" }
    ],
    units: [
      { id: "unit-a", institution_id: "inst-a", name: "Almox A", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Almox B", status: "active" }
    ],
    stock_items: [{ id: "item-a", institution_id: "inst-a", unit_id: "unit-a", name: "Seringa", unit: "un", minimum_quantity: 1 }],
    stock_entries: [{ id: "entry-a", institution_id: "inst-a", unit_id: "unit-a", item_id: "item-a", quantity: 3, status: "approved", created_at: "2026-01-01T00:00:00.000Z" }],
    stock_exits: [],
    stock_audit_log: [],
    municipal_documents: [],
    municipal_document_versions: [],
    municipal_admin_audit_log: []
  }, extra));
  const reportService = createMunicipalReportService({ store, now: () => new Date("2026-01-02T00:00:00.000Z") });
  const archiveService = createMunicipalReportArchiveService({ store, now: () => new Date("2026-01-03T00:00:00.000Z") });
  return { store, reportService, archiveService };
}

async function makeReport(reportService) {
  return (await reportService.generate(ctx("municipal_admin"), { type: "stock", unit_id: "unit-a", title: "Relatorio aprovado" })).report;
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("confirmacao ausente nao salva nem escreve no Acervo", async () => {
  const { store, reportService, archiveService } = setup();
  const report = await makeReport(reportService);
  const before = JSON.stringify(store.tables);
  const result = await archiveService.archive(ctx("municipal_admin"), { report, confirmation: false, operation_id: "op-1", title: "Relatorio aprovado" });
  assert.equal(result.archived, false);
  assert.equal(result.error, "confirmation_required");
  assert.equal(result.report.title, report.title);
  assert.equal(Object.prototype.hasOwnProperty.call(result.report, "project_id"), false);
  assert.equal(JSON.stringify(store.tables), before);
});

test("relatorio aprovado cria documento, versao 1 e auditoria sem storage_path", async () => {
  const { store, reportService, archiveService } = setup();
  const report = await makeReport(reportService);
  const result = await archiveService.archive(ctx("municipal_admin"), { report, confirmation: true, operation_id: "op-2", title: "Relatorio aprovado", document_type: "relatorio", unit_id: "unit-a" });
  assert.equal(result.archived, true);
  assert.equal(result.document_id, result.document.id);
  assert.equal(result.version_number, 1);
  assert.equal(result.version.version_number, 1);
  assert.equal(result.document.institution_id, "inst-a");
  assert.equal(result.document.unit_id, "unit-a");
  assert.equal(result.version.file_reference.startsWith("/api/municipal-admin/document-files/reports/"), true);
  assert.equal(JSON.stringify(result).includes("storage_path"), false);
  assert.deepEqual(store.tables.municipal_admin_audit_log.map((item) => item.action), ["report_archived", "document_created", "document_version_created"]);
});

test("duplicidade por operation_id ou hash e bloqueada", async () => {
  const { reportService, archiveService } = setup();
  const report = await makeReport(reportService);
  await archiveService.archive(ctx("municipal_admin"), { report, confirmation: true, operation_id: "op-dup", title: "Relatorio aprovado", unit_id: "unit-a" });
  await rejectsCode(archiveService.archive(ctx("municipal_admin"), { report, confirmation: true, operation_id: "op-dup", title: "Relatorio aprovado", unit_id: "unit-a" }), "report_archive_operation_duplicate");
  await rejectsCode(archiveService.archive(ctx("municipal_admin"), { report, confirmation: true, operation_id: "op-other", title: "Relatorio aprovado", unit_id: "unit-a" }), "report_archive_hash_duplicate");
});

test("gestor so salva na unidade autorizada e tenant externo e bloqueado", async () => {
  const { reportService, archiveService } = setup();
  const report = await makeReport(reportService);
  const ok = await archiveService.archive(ctx("gestor", { unitId: "unit-a" }), { report, confirmation: true, operation_id: "op-gestor", title: "Relatorio gestor", unit_id: "unit-a" });
  assert.equal(ok.archived, true);
  await rejectsCode(archiveService.archive(ctx("gestor", { unitId: "unit-a" }), { report, confirmation: true, operation_id: "op-block", title: "Relatorio gestor", unit_id: "unit-b" }), "unit_scope_forbidden");
  await rejectsCode(archiveService.archive(ctx("municipal_admin"), { report: Object.assign({}, report, { institution_id: "inst-b", unit_id: "unit-b" }), confirmation: true, operation_id: "op-tenant", title: "Tenant B" }), "institution_scope_forbidden");
});

test("falha do Acervo devolve relatorio preservado", async () => {
  const { store, reportService } = setup();
  const report = await makeReport(reportService);
  const failingStore = Object.assign({}, store, {
    async insert(table, payload) {
      if (table === "municipal_documents") throw Object.assign(new Error("archive_down"), { code: "archive_down" });
      return store.insert(table, payload);
    }
  });
  const archiveService = createMunicipalReportArchiveService({ store: failingStore });
  const result = await archiveService.archive(ctx("municipal_admin"), { report, confirmation: true, operation_id: "op-fail", title: "Falha", unit_id: "unit-a" });
  assert.equal(result.archived, false);
  assert.equal(result.error, "archive_down");
  assert.equal(result.report.title, report.title);
  assert.equal(Object.prototype.hasOwnProperty.call(result.report, "project_id"), false);
});
