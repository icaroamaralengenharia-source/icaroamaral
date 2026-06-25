import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createEloProjectsStore } from "../src/elo-projects-store.js";

test("EloProjectsStore cria lista carrega atualiza revisa audita seleciona e salva checklist", () => {
  const dir = mkdtempSync(join(tmpdir(), "elo-projects-"));
  try {
    const store = createEloProjectsStore({ dataPath: join(dir, "elo-projects.json") });
    const created = store.createProject({ companyId: "empresa_1", userId: "user_1", project: { name: "Casa 80", type: "casa_terrea" } });
    assert.ok(created.id);
    assert.equal(created.companyId, "empresa_1");
    assert.equal(store.listProjects({ companyId: "empresa_1" }).length, 1);
    assert.equal(store.getProject(created.id).project.name, "Casa 80");
    const updated = store.updateProject(created.id, { project: { cityUf: "Salvador/BA" } });
    assert.equal(updated.project.cityUf, "Salvador/BA");
    assert.ok(updated.history.some((event) => event.type === "project_updated"));
    assert.equal(store.appendRevision(created.id, { summary: "R1" }).revisions.length, 1);
    assert.equal(store.appendAudit(created.id, { item: "cimento", status: "attention" }).audits.length, 1);
    const selected = store.selectComposition(created.id, { packageId: "piso", serviceId: "piso", compositionCode: "SINAPI-1" });
    assert.equal(selected.compositionSelections[0].compositionCode, "SINAPI-1");
    assert.ok(selected.revisions.length >= 2);
    const checked = store.saveExecutiveChecklist(created.id, { canClose: false, blockers: [{ id: "prices" }] });
    assert.equal(checked.executiveChecklists.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
