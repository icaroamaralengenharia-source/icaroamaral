import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalDocumentService } from "../src/municipal-document-service.js";

function ctx(role, overrides = {}) {
  return {
    ok: true,
    userId: overrides.userId || role + "-user",
    institutionId: overrides.institutionId ?? "inst-a",
    role,
    profile: Object.assign({
      id: overrides.profileId || role + "-profile",
      auth_user_id: overrides.userId || role + "-user",
      institution_id: overrides.institutionId ?? "inst-a",
      unit_id: overrides.unitId || "",
      role,
      status: overrides.status || "active",
      email: role + "@example.com"
    }, overrides.profile || {})
  };
}

function setup() {
  const store = createMemoryMunicipalAdminStore({
    institutions: [
      { id: "inst-a", name: "Prefeitura A", status: "active" },
      { id: "inst-b", name: "Prefeitura B", status: "active" }
    ],
    units: [
      { id: "unit-a", institution_id: "inst-a", name: "Almox A", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Almox B", status: "active" },
      { id: "unit-a2", institution_id: "inst-a", name: "Almox A2", status: "active" }
    ],
    municipal_documents: [],
    municipal_document_versions: [],
    municipal_admin_audit_log: []
  });
  const service = createMunicipalDocumentService({ store, now: () => new Date("2026-01-10T00:00:00.000Z") });
  return { store, service };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("cria documento na propria instituicao e gestor cria na unidade autorizada", async () => {
  const { service, store } = setup();
  const adminDoc = await service.createDocument(ctx("municipal_admin", { userId: "admin-a" }), {
    title: "Inventario Municipal",
    document_type: "inventario"
  });
  assert.equal(adminDoc.document.institution_id, "inst-a");
  assert.equal(adminDoc.document.current_version, 0);
  assert.equal(store.tables.municipal_admin_audit_log.at(-1).action, "document_created");

  const gestorDoc = await service.createDocument(ctx("gestor", { userId: "gestor-a", unitId: "unit-a" }), {
    title: "Conferencia Unidade",
    document_type: "conferencia",
    unit_id: "unit-a"
  });
  assert.equal(gestorDoc.document.unit_id, "unit-a");
});

test("gestor nao cria em unidade externa e leitura nao cria", async () => {
  const { service } = setup();
  await rejectsCode(service.createDocument(ctx("gestor", { unitId: "unit-a" }), {
    title: "Bloqueado",
    document_type: "relatorio",
    unit_id: "unit-b"
  }), "unit_scope_forbidden");
  await rejectsCode(service.createDocument(ctx("leitura"), {
    title: "Somente leitura",
    document_type: "nota"
  }), "document_write_forbidden");
});

test("listagem nao mistura tenants e detalhe bloqueia tenant externo", async () => {
  const { service } = setup();
  await service.createDocument(ctx("municipal_admin", { userId: "admin-a" }), { title: "Doc A", document_type: "nota" });
  const docB = await service.createDocument(ctx("municipal_admin", { userId: "admin-b", institutionId: "inst-b" }), { title: "Doc B", document_type: "nota" });

  const listA = await service.listDocuments(ctx("municipal_admin", { userId: "admin-a" }));
  assert.deepEqual(listA.documents.map((item) => item.institution_id), ["inst-a"]);
  await rejectsCode(service.getDocument(ctx("municipal_admin", { userId: "admin-a" }), docB.document.id), "institution_scope_forbidden");
});

test("versao incrementa automaticamente e referencia insegura e rejeitada", async () => {
  const { service, store } = setup();
  const created = await service.createDocument(ctx("municipal_admin", { userId: "admin-a" }), { title: "Relatorio", document_type: "relatorio" });
  const v1 = await service.createVersion(ctx("municipal_admin", { userId: "admin-a" }), created.document.id, {
    original_filename: "relatorio.pdf",
    mime_type: "application/pdf",
    size_bytes: 123,
    file_reference: "https://example.test/relatorio.pdf",
    file_hash: "hash-1",
    storage_path: "bucket/private/raw.pdf"
  });
  assert.equal(v1.version.version_number, 1);
  assert.equal(v1.version.storage_path, undefined);
  const v2 = await service.createVersion(ctx("municipal_admin", { userId: "admin-a" }), created.document.id, {
    original_filename: "relatorio-v2.pdf",
    mime_type: "application/pdf",
    file_reference: "/api/municipal-admin/document-files/ref-2"
  });
  assert.equal(v2.version.version_number, 2);
  assert.equal(v2.document.current_version, 2);
  assert.equal(store.tables.municipal_admin_audit_log.at(-1).action, "document_version_created");

  await rejectsCode(service.createVersion(ctx("municipal_admin", { userId: "admin-a" }), created.document.id, {
    file_reference: "file:///tmp/segredo.pdf"
  }), "file_reference_unsafe");
});

test("download nao expoe storage_path e auditoria e registrada", async () => {
  const { service, store } = setup();
  const created = await service.createDocument(ctx("municipal_admin", { userId: "admin-a" }), { title: "Termo", document_type: "termo" });
  await service.createVersion(ctx("municipal_admin", { userId: "admin-a" }), created.document.id, {
    original_filename: "termo.pdf",
    mime_type: "application/pdf",
    file_reference: "https://example.test/termo.pdf"
  });
  store.tables.municipal_document_versions[0].storage_path = "raw/private/termo.pdf";

  const download = await service.downloadDocument(ctx("leitura", { userId: "leitura-a" }), created.document.id);
  assert.equal(download.download.file_reference, "https://example.test/termo.pdf");
  assert.equal(download.download.storage_path, undefined);
  assert.equal(store.tables.municipal_admin_audit_log.at(-1).action, "document_downloaded");
});

test("documento arquivado nao aceita nova versao e registra auditoria", async () => {
  const { service, store } = setup();
  const created = await service.createDocument(ctx("municipal_admin", { userId: "admin-a" }), { title: "Prestacao", document_type: "prestacao_contas" });
  await service.createVersion(ctx("municipal_admin", { userId: "admin-a" }), created.document.id, {
    file_reference: "https://example.test/prestacao.pdf"
  });
  const archived = await service.archiveDocument(ctx("municipal_admin", { userId: "admin-a" }), created.document.id);
  assert.equal(archived.document.status, "archived");
  assert.equal(store.tables.municipal_admin_audit_log.at(-1).action, "document_archived");
  await rejectsCode(service.createVersion(ctx("municipal_admin", { userId: "admin-a" }), created.document.id, {
    file_reference: "https://example.test/prestacao-v2.pdf"
  }), "document_archived");
});

test("platform_admin exige instituicao aberta e valida", async () => {
  const { service } = setup();
  const created = await service.createDocument(ctx("platform_admin", { userId: "platform-user", institutionId: "" }), {
    institution_id: "inst-a",
    title: "Inspecao Plataforma",
    document_type: "inspecao"
  });
  assert.equal(created.document.institution_id, "inst-a");
  await rejectsCode(service.createDocument(ctx("platform_admin", { userId: "platform-user", institutionId: "" }), {
    title: "Sem tenant",
    document_type: "inspecao"
  }), "institution_id_required");
});
