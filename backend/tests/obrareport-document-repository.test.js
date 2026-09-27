import assert from "node:assert/strict";
import { test } from "node:test";
import { createSupabaseObraReportDocumentRepository } from "../src/services/obrareport-document-repository.js";

function createFakeSupabase() {
  const tables = {
    obrareport_generated_documents: [],
    obrareport_document_files: [],
    obrareport_projects: [{ id: "work-a", institution_id: "tenant-a", name: "OBRA TESTE ELO E2E" }]
  };

  function builder(tableName) {
    const state = { operation: "select", payload: null, filters: [], limit: null };
    const api = {
      select() { return api; },
      insert(payload) { state.operation = "insert"; state.payload = payload; return api; },
      delete() { state.operation = "delete"; return api; },
      eq(column, value) { state.filters.push([column, value]); return api; },
      limit(value) { state.limit = value; return api; },
      order() { return api; },
      async maybeSingle() { const result = execute(); return { data: result.data[0] || null, error: result.error }; },
      async single() { const result = execute(); return { data: result.data[0] || null, error: result.error || (result.data[0] ? null : { code: "PGRST116" }) }; },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); }
    };

    function execute() {
      const rows = tables[tableName];
      if (state.operation === "insert") {
        if (rows.some((row) => row.id === state.payload.id || row.idempotency_key && row.idempotency_key === state.payload.idempotency_key)) {
          return { data: [], error: { code: "23505" } };
        }
        rows.push({ ...state.payload });
        return { data: [{ ...state.payload }], error: null };
      }
      if (state.operation === "delete") {
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (state.filters.every(([column, value]) => rows[index][column] === value)) rows.splice(index, 1);
        }
        return { data: [], error: null };
      }
      let selected = rows.filter((row) => state.filters.every(([column, value]) => row[column] === value));
      if (state.limit) selected = selected.slice(0, state.limit);
      return { data: selected.map((row) => ({ ...row })), error: null };
    }

    return api;
  }

  return { tables, from(table) { return builder(table); } };
}

test("canonical document repository persists file relation, external id and idempotency", async () => {
  const client = createFakeSupabase();
  const repository = createSupabaseObraReportDocumentRepository({ client });
  const context = { institutionId: "tenant-a", userId: "user-a" };
  const input = {
    sourceType: "rdo",
    sourceId: "rdo-a",
    rdoId: "rdo-a",
    workId: "work-a",
    documentType: "rdo_pdf",
    title: "RDO - OBRA TESTE ELO E2E",
    provider: "google_drive_apps_script",
    externalFileId: "drive-file-a",
    artifactUrl: "https://drive.google.com/file/d/drive-file-a/view",
    idempotencyKey: "rdo-a-pdf-v1"
  };

  await repository.ensureReady(context);
  const first = await repository.insert(context, input);
  assert.equal(first.duplicate, false);
  assert.equal(client.tables.obrareport_generated_documents.length, 1);
  assert.equal(client.tables.obrareport_document_files.length, 1);
  assert.equal(client.tables.obrareport_generated_documents[0].file_id, client.tables.obrareport_document_files[0].id);
  assert.equal(client.tables.obrareport_generated_documents[0].external_file_id, "drive-file-a");
  assert.equal(client.tables.obrareport_document_files[0].storage_path, "google_drive:drive-file-a");

  const duplicate = await repository.insert(context, input);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.document.id, first.document.id);
  assert.equal(client.tables.obrareport_generated_documents.length, 1);
  assert.equal(client.tables.obrareport_document_files.length, 1);
  assert.equal((await repository.list(context, { rdoId: "rdo-a", workId: "work-a", sourceType: "rdo" })).length, 1);
});
