import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalReportService } from "../src/municipal-report-service.js";

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
    stock_items: [
      { id: "item-a", institution_id: "inst-a", unit_id: "unit-a", name: "Seringa", unit: "un", minimum_quantity: 20, token: "NAO_SAIR" },
      { id: "item-b", institution_id: "inst-b", unit_id: "unit-b", name: "Outro tenant", unit: "un", minimum_quantity: 1 }
    ],
    stock_entries: [
      { id: "entry-a", institution_id: "inst-a", unit_id: "unit-a", item_id: "item-a", quantity: 10, status: "approved", created_at: "2026-01-05T00:00:00.000Z" },
      { id: "entry-old", institution_id: "inst-a", unit_id: "unit-a", item_id: "item-a", quantity: 7, status: "approved", created_at: "2025-12-01T00:00:00.000Z" },
      { id: "entry-b", institution_id: "inst-b", unit_id: "unit-b", item_id: "item-b", quantity: 99, status: "approved", created_at: "2026-01-05T00:00:00.000Z" }
    ],
    stock_exits: [
      { id: "exit-a", institution_id: "inst-a", unit_id: "unit-a", item_id: "item-a", quantity: 4, created_at: "2026-01-06T00:00:00.000Z" },
      { id: "exit-b", institution_id: "inst-b", unit_id: "unit-b", item_id: "item-b", quantity: 50, created_at: "2026-01-06T00:00:00.000Z" }
    ],
    stock_audit_log: [],
    municipal_documents: [],
    municipal_document_versions: [],
    municipal_admin_audit_log: []
  }, extra));
  return { store, service: createMunicipalReportService({ store, now: () => new Date("2026-01-07T00:00:00.000Z") }) };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("lista tipos oficiais de relatorio municipal", () => {
  const { service } = setup();
  const types = service.listTypes().types.map((item) => item.id);
  assert.deepEqual(types, ["stock", "movements", "inventory", "conference", "divergence", "accountability", "receipt_term", "administrative"]);
});

test("gera relatorio de estoque com alertas do Sentinela e sem dados sensiveis", async () => {
  const { service } = setup();
  const { report } = await service.preview(ctx("municipal_admin"), { type: "stock", unit_id: "unit-a", period: { from: "2026-01-01", to: "2026-01-31" } });
  assert.equal(report.type, "stock");
  assert.equal(report.status, "preview");
  assert.equal(report.institution_id, "inst-a");
  assert.equal(report.unit_id, "unit-a");
  assert.equal(report.summary.items_count, 1);
  assert.equal(report.summary.entries_count, 1);
  assert.equal(report.summary.exits_count, 1);
  assert.ok(report.alerts.some((item) => item.rule_code === "item_below_minimum"));
  assert.equal(JSON.stringify(report).includes("NAO_SAIR"), false);
  assert.equal(report.project_id, undefined);
});

test("gera relatorio de movimentacoes respeitando periodo", async () => {
  const { service } = setup();
  const { report } = await service.preview(ctx("gestor", { unitId: "unit-a" }), { type: "movements", period: { from: "2026-01-01", to: "2026-01-31" } });
  assert.equal(report.entries.length, 1);
  assert.equal(report.entries[0].id, "entry-a");
  assert.equal(report.exits.length, 1);
  assert.match(report.html, /Movimentacoes|Saidas/);
});

test("ausencia de dados e declarada", async () => {
  const { service } = setup({ stock_items: [], stock_entries: [], stock_exits: [] });
  const { report } = await service.preview(ctx("municipal_admin"), { type: "inventory", unit_id: "unit-a" });
  assert.equal(report.summary.items_count, 0);
  assert.match(report.conclusion, /Ausencia de dados/);
});

test("generate cria somente rascunho e nao salva no Acervo", async () => {
  const { service, store } = setup();
  const beforeDocuments = JSON.stringify(store.tables.municipal_documents);
  const { report } = await service.generate(ctx("municipal_admin"), { type: "accountability", unit_id: "unit-a" });
  assert.equal(report.status, "generated_draft");
  assert.equal(report.requires_human_confirmation, true);
  assert.equal(report.acervo_saved, false);
  assert.equal(report.upload_performed, false);
  assert.equal(JSON.stringify(store.tables.municipal_documents), beforeDocuments);
});

test("bloqueia unidade externa e tipo invalido", async () => {
  const { service } = setup();
  await rejectsCode(service.preview(ctx("gestor", { unitId: "unit-a" }), { type: "stock", unit_id: "unit-b" }), "unit_scope_forbidden");
  await rejectsCode(service.preview(ctx("municipal_admin"), { type: "obra", unit_id: "unit-a" }), "municipal_report_type_invalid");
});

test("ELO municipal pode solicitar preview sem escrita", async () => {
  const { service, store } = setup();
  const before = JSON.stringify(store.tables);
  const { report } = await service.preview(ctx("gestor", { unitId: "unit-a" }), { type: "administrative", unit_id: "unit-a", title: "Preview solicitado pelo ELO Municipal" });
  assert.equal(report.title, "Preview solicitado pelo ELO Municipal");
  assert.equal(report.requires_human_confirmation, true);
  assert.equal(report.acervo_saved, false);
  assert.equal(JSON.stringify(store.tables), before);
});