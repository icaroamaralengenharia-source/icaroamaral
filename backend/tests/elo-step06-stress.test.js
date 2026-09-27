import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

test("Step 06 local stress mantém idempotencia, atualizacao deterministica e isolamento", () => {
  const dir = mkdtempSync(join(tmpdir(), "elo-step06-stress-"));
  const contextA = { institutionId: "inst_a", userId: "user_a" };
  const contextB = { institutionId: "inst_b", userId: "user_b" };
  try {
    const service = createObraReportTransactionalService({ dataPath: join(dir, "obra.json") });
    const input = { sourceType: "apartment_handover_inspection", projectId: "obra_stress", idempotencyKey: "stress-create-1", inspectionData: { type: "apartment_handover_inspection", items: [{ id: "item-1", ambiente: "Sala", sistema: "Pisos", item: "Rodape", status: "NI", fotos: [] }] } };
    const ids = new Set(Array.from({ length: 20 }, () => service.createApartmentHandoverInspection(contextA, input).id));
    assert.equal(ids.size, 1);
    const id = [...ids][0];
    for (let index = 0; index < 20; index += 1) {
      const updated = service.updateApartmentHandoverInspectionItem(contextA, id, { itemId: "item-1", status: index % 2 ? "C" : "NC", severity: index % 2 ? "baixa" : "media" });
      assert.equal(updated.institution_id, "inst_a");
    }
    for (let index = 0; index < 20; index += 1) {
      assert.equal(service.listApartmentHandoverInspections(contextA, { projectId: "obra_stress" }).length, 1);
      assert.equal(service.getApartmentHandoverInspection(contextA, id).id, id);
      assert.throws(() => service.getApartmentHandoverInspection(contextB, id), /inspection_forbidden/);
    }
    const final = service.getApartmentHandoverInspection(contextA, id);
    assert.equal(final.inspection_data_json.items[0].status, "C");
    assert.equal(final.inspection_data_json.items[0].severidade, "baixa");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
