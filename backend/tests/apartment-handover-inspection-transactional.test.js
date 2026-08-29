import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

function tempPath(name) {
  return join(mkdtempSync(join(tmpdir(), "obrareport-ahi-")), name);
}

function loadInspectionData() {
  const fixture = JSON.parse(readFileSync(new URL("../../tests/fixtures/apartment-handover-inspection-144-final.json", import.meta.url), "utf8"));
  return fixture.report.inspection;
}

function payload(overrides = {}) {
  return Object.assign({
    source_type: "apartment_handover_inspection",
    source_id: "local-inspection-001",
    client_id: "client-a",
    project_id: "project-a",
    title: "Vistoria de Entrega - Residencial QA - Apto 101",
    status: "draft",
    inspection_data_json: loadInspectionData()
  }, overrides);
}

function headers(institutionId = "inst-a", userId = "user-a") {
  return {
    "Content-Type": "application/json",
    "x-institution-id": institutionId,
    "x-user-id": userId,
    Origin: "http://127.0.0.1:5500"
  };
}

async function withServer(callback) {
  const service = createObraReportTransactionalService({ dataPath: tempPath("obrareport.json") });
  const app = createApp({ obraReportTransactionalService: service, env: { ELO_SENTINEL_ENABLED: "false" } });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port, service);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function json(base, path, options = {}) {
  const response = await fetch(base + path, options);
  return { response, data: await response.json() };
}

test("Vistoria de Entrega transacional cria, lista, busca, atualiza, versiona e preserva 144 itens", async () => {
  await withServer(async (base) => {
    const create = await json(base, "/api/obrareport/apartment-handover-inspections", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload())
    });
    assert.equal(create.response.status, 201);
    assert.equal(create.data.ok, true);
    assert.equal(create.data.inspection.institution_id, "inst-a");
    assert.equal(create.data.inspection.client_id, "client-a");
    assert.equal(create.data.inspection.project_id, "project-a");
    assert.equal(create.data.inspection.source_type, "apartment_handover_inspection");
    assert.equal(create.data.inspection.inspection_data_json.items.length, 144);
    assert.equal(create.data.inspection.created_by, "user-a");

    const id = create.data.inspection.id;
    const list = await json(base, "/api/obrareport/apartment-handover-inspections?client_id=client-a&project_id=project-a&status=draft", { headers: headers() });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.inspections.length, 1);
    assert.equal(list.data.inspections[0].id, id);

    const get = await json(base, "/api/obrareport/apartment-handover-inspections/" + encodeURIComponent(id), { headers: headers() });
    assert.equal(get.response.status, 200);
    assert.equal(get.data.inspection.id, id);
    assert.equal(get.data.inspection.inspection_data_json.items.length, 144);

    const updateData = loadInspectionData();
    updateData.status = "completed";
    updateData.completedAt = "2026-08-29T12:00:00.000Z";
    const update = await json(base, "/api/obrareport/apartment-handover-inspections/" + encodeURIComponent(id), {
      method: "PUT",
      headers: headers("inst-a", "user-b"),
      body: JSON.stringify({
        status: "completed",
        inspection_data_json: updateData,
        completed_at: "2026-08-29T12:00:00.000Z",
        institution_id: "inst-b",
        client_id: "client-b",
        project_id: "project-b",
        created_by: "attacker"
      })
    });
    assert.equal(update.response.status, 200);
    assert.equal(update.data.inspection.status, "completed");
    assert.equal(update.data.inspection.institution_id, "inst-a");
    assert.equal(update.data.inspection.client_id, "client-a");
    assert.equal(update.data.inspection.project_id, "project-a");
    assert.equal(update.data.inspection.created_by, "user-a");
    assert.equal(update.data.inspection.updated_by, "user-b");
    assert.equal(update.data.inspection.inspection_data_json.items.length, 144);

    const version = await json(base, "/api/obrareport/apartment-handover-inspections/" + encodeURIComponent(id) + "/versions", {
      method: "POST",
      headers: headers("inst-a", "user-b"),
      body: JSON.stringify({})
    });
    assert.equal(version.response.status, 201);
    assert.equal(version.data.version.inspection_id, id);
    assert.equal(version.data.version.version_number, 1);
    assert.equal(version.data.version.inspection_data_json.items.length, 144);

    const events = await json(base, "/api/obrareport/apartment-handover-inspections/" + encodeURIComponent(id) + "/events", { headers: headers() });
    assert.equal(events.response.status, 200);
    assert.ok(events.data.events.some((event) => event.event_type === "inspection_created"));
    assert.ok(events.data.events.some((event) => event.event_type === "inspection_updated"));
    assert.ok(events.data.events.some((event) => event.event_type === "inspection_completed"));
    assert.ok(events.data.events.some((event) => event.event_type === "inspection_version_created"));
  });
});

test("Vistoria de Entrega transacional isola tenants e bloqueia re-vistoria cross-tenant", async () => {
  await withServer(async (base) => {
    const createdA = await json(base, "/api/obrareport/apartment-handover-inspections", {
      method: "POST",
      headers: headers("inst-a", "user-a"),
      body: JSON.stringify(payload({ source_id: "local-a" }))
    });
    assert.equal(createdA.response.status, 201);
    const idA = createdA.data.inspection.id;

    const createdB = await json(base, "/api/obrareport/apartment-handover-inspections", {
      method: "POST",
      headers: headers("inst-b", "user-b"),
      body: JSON.stringify(payload({ source_id: "local-b", client_id: "client-b", project_id: "project-b" }))
    });
    assert.equal(createdB.response.status, 201);

    const listA = await json(base, "/api/obrareport/apartment-handover-inspections", { headers: headers("inst-a", "user-a") });
    assert.equal(listA.response.status, 200);
    assert.deepEqual(listA.data.inspections.map((item) => item.institution_id), ["inst-a"]);

    const crossGet = await json(base, "/api/obrareport/apartment-handover-inspections/" + encodeURIComponent(idA), { headers: headers("inst-b", "user-b") });
    assert.equal(crossGet.response.status, 404);
    assert.equal(crossGet.data.error, "inspection_not_found");

    const crossReinspection = await json(base, "/api/obrareport/apartment-handover-inspections", {
      method: "POST",
      headers: headers("inst-b", "user-b"),
      body: JSON.stringify(payload({ source_id: "reinspect-cross", reinspection_of_id: idA, client_id: "client-b", project_id: "project-b" }))
    });
    assert.equal(crossReinspection.response.status, 404);
    assert.equal(crossReinspection.data.error, "reinspection_not_found");

    const sameTenantReinspection = await json(base, "/api/obrareport/apartment-handover-inspections", {
      method: "POST",
      headers: headers("inst-a", "user-a"),
      body: JSON.stringify(payload({ source_id: "reinspect-a", reinspection_of_id: idA }))
    });
    assert.equal(sameTenantReinspection.response.status, 201);
    assert.equal(sameTenantReinspection.data.inspection.reinspection_of_id, idA);
  });
});

test("Vistoria de Entrega transacional valida payload, source_type, status e registros inexistentes", async () => {
  await withServer(async (base) => {
    const missingInstitution = await json(base, "/api/obrareport/apartment-handover-inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload())
    });
    assert.equal(missingInstitution.response.status, 400);
    assert.equal(missingInstitution.data.error, "institution_required");

    const invalidPayload = await json(base, "/api/obrareport/apartment-handover-inspections", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ source_type: "apartment_handover_inspection" })
    });
    assert.equal(invalidPayload.response.status, 400);
    assert.equal(invalidPayload.data.error, "inspection_data_required");

    const invalidSource = await json(base, "/api/obrareport/apartment-handover-inspections", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload({ source_type: "technical_report" }))
    });
    assert.equal(invalidSource.response.status, 400);
    assert.equal(invalidSource.data.error, "inspection_source_type_invalid");

    const invalidStatus = await json(base, "/api/obrareport/apartment-handover-inspections", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload({ status: "NC" }))
    });
    assert.equal(invalidStatus.response.status, 400);
    assert.equal(invalidStatus.data.error, "inspection_status_invalid");

    const notFound = await json(base, "/api/obrareport/apartment-handover-inspections/missing", { headers: headers() });
    assert.equal(notFound.response.status, 404);
    assert.equal(notFound.data.error, "inspection_not_found");
  });
});