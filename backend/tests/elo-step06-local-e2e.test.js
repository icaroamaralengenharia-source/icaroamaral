import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

const headersA = { Authorization: "Bearer token-a", "x-institution-id": "inst_a", "x-user-id": "user_a" };
const headersB = { Authorization: "Bearer token-b", "x-institution-id": "inst_b", "x-user-id": "user_b" };

function authClient() {
  return {
    auth: { async getUser(token) { return { data: { user: { id: token === "token-b" ? "user_b" : "user_a" } }, error: null }; } },
    from(table) {
      assert.equal(table, "profiles");
      return { select() { return { eq(_column, value) { return { async maybeSingle() {
        return { data: value === "user_b" ? { id: "profile-b", auth_user_id: "user_b", institution_id: "inst_b", role: "admin" } : { id: "profile-a", auth_user_id: "user_a", institution_id: "inst_a", role: "admin" }, error: null };
      } }; } }; } };
    }
  };
}

async function json(base, path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:5500", ...(options.headers || {}) } });
  const text = await response.text();
  return { response, data: text ? JSON.parse(text) : {} };
}

test("Step 06 local E2E percorre criar, item, foto, persistencia, PDF controlado e tenant", async () => {
  const dir = mkdtempSync(join(tmpdir(), "elo-step06-e2e-"));
  const app = createApp({
    obraReportTransactionalService: createObraReportTransactionalService({ dataPath: join(dir, "obra.json") }),
    authContextSupabaseClient: authClient()
  });
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const payload = { projectId: "obra_e2e", clientId: "cliente_e2e", title: "Vistoria E2E", idempotencyKey: "e2e-create-1", inspectionData: { type: "apartment_handover_inspection", metadata: { projectName: "Obra E2E", unitName: "101" }, items: [{ id: "bath-wall", ambiente: "Banheiro Social", sistema: "Revestimentos", item: "Parede", status: "NI", fotos: [] }] } };
    const first = await json(base, "/api/obrareport/apartment-handover-inspections", { method: "POST", headers: headersA, body: JSON.stringify(payload) });
    const duplicate = await json(base, "/api/obrareport/apartment-handover-inspections", { method: "POST", headers: headersA, body: JSON.stringify(payload) });
    assert.equal(first.response.status, 201);
    assert.equal(duplicate.response.status, 201);
    assert.equal(duplicate.data.inspection.id, first.data.inspection.id);
    const id = first.data.inspection.id;

    const item = await json(base, `/api/obrareport/apartment-handover-inspections/${id}`, { method: "PUT", headers: headersA, body: JSON.stringify({ itemUpdate: { itemId: "bath-wall", status: "NC", severity: "alta", notes: "Fissura" } }) });
    assert.equal(item.response.status, 200);
    assert.equal(item.data.inspection.inspection_data_json.items[0].status, "NC");
    const photo = await json(base, `/api/obrareport/apartment-handover-inspections/${id}`, { method: "PUT", headers: headersA, body: JSON.stringify({ photoAttachment: { itemId: "bath-wall", photo: { id: "photo-e2e", fileName: "fissura.jpg" } } }) });
    assert.equal(photo.response.status, 200);
    assert.equal(photo.data.inspection.inspection_data_json.items[0].fotos[0].id, "photo-e2e");

    const listed = await json(base, "/api/obrareport/apartment-handover-inspections?projectId=obra_e2e", { headers: headersA });
    const opened = await json(base, `/api/obrareport/apartment-handover-inspections/${id}`, { headers: headersA });
    const version = await json(base, `/api/obrareport/apartment-handover-inspections/${id}/versions`, { method: "POST", headers: headersA, body: "{}" });
    const document = await json(base, `/api/obrareport/apartment-handover-inspections/${id}/generate-document`, { method: "POST", headers: headersA, body: "{}" });
    const events = await json(base, `/api/obrareport/apartment-handover-inspections/${id}/events`, { headers: headersA });
    assert.equal(listed.data.inspections.length, 1);
    assert.equal(opened.data.inspection.inspection_data_json.items[0].fotos.length, 1);
    assert.equal(version.response.status, 201);
    assert.equal(document.response.status, 201);
    assert.equal(document.data.document.source_type, "apartment_handover_inspection");
    assert.ok(events.data.events.some((event) => event.event_type === "inspection_item_updated"));
    assert.ok(events.data.events.some((event) => event.event_type === "inspection_photo_attached"));

    const blocked = await json(base, `/api/obrareport/apartment-handover-inspections/${id}`, { headers: headersB });
    assert.equal(blocked.response.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
