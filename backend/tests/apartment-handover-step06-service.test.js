import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "obrareport-step06-"));
  return { dir, path: join(dir, "obra.json"), contextA: { institutionId: "inst_a", userId: "user_a" }, contextB: { institutionId: "inst_b", userId: "user_b" } };
}

function data() {
  return { type: "apartment_handover_inspection", metadata: { projectName: "Obra A", unitName: "101" }, items: [{ id: "bath-wall", ambiente: "Banheiro Social", sistema: "Revestimentos", item: "Parede", status: "NI", fotos: [] }], status: "draft" };
}

test("Step 06 local create is idempotent and item/photo updates persist across restart", () => {
  const state = setup();
  try {
    const service = createObraReportTransactionalService({ dataPath: state.path });
    const first = service.createApartmentHandoverInspection(state.contextA, { sourceType: "apartment_handover_inspection", projectId: "obra_a", idempotencyKey: "op-1", inspectionData: data() });
    const duplicate = service.createApartmentHandoverInspection(state.contextA, { sourceType: "apartment_handover_inspection", projectId: "obra_a", idempotencyKey: "op-1", inspectionData: data() });
    assert.equal(duplicate.id, first.id);

    const updated = service.updateApartmentHandoverInspectionItem(state.contextA, first.id, { itemId: "bath-wall", status: "NC", severity: "media", notes: "Fissura visível" });
    assert.equal(updated.inspection_data_json.items[0].status, "NC");
    assert.equal(updated.inspection_data_json.items[0].severidade, "media");

    const withPhoto = service.attachApartmentHandoverInspectionPhoto(state.contextA, first.id, { itemId: "bath-wall", photo: { id: "photo-1", fileName: "fissura.jpg" } });
    assert.equal(withPhoto.inspection_data_json.items[0].fotos.length, 1);
    assert.throws(() => service.getApartmentHandoverInspection(state.contextB, first.id), /inspection_forbidden/);

    const restarted = createObraReportTransactionalService({ dataPath: state.path });
    const reopened = restarted.getApartmentHandoverInspection(state.contextA, first.id);
    assert.equal(reopened.inspection_data_json.items[0].fotos[0].id, "photo-1");
  } finally {
    rmSync(state.dir, { recursive: true, force: true });
  }
});

test("Step 06 item update fails closed for invalid status and ambiguous item", () => {
  const state = setup();
  try {
    const service = createObraReportTransactionalService({ dataPath: state.path });
    const inspection = service.createApartmentHandoverInspection(state.contextA, { sourceType: "apartment_handover_inspection", projectId: "obra_a", idempotencyKey: "op-2", inspectionData: Object.assign(data(), { items: [data().items[0], Object.assign({}, data().items[0], { id: "bath-floor", item: "Piso" })] }) });
    assert.throws(() => service.updateApartmentHandoverInspectionItem(state.contextA, inspection.id, { itemId: "bath-wall", status: "BROKEN" }), /inspection_item_status_invalid/);
    assert.throws(() => service.updateApartmentHandoverInspectionItem(state.contextA, inspection.id, { environment: "Banheiro Social", status: "NC" }), /inspection_item_ambiguous/);
  } finally {
    rmSync(state.dir, { recursive: true, force: true });
  }
});
