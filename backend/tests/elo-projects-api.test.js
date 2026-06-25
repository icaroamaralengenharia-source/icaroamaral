import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createEloProjectsStore } from "../src/elo-projects-store.js";

async function withServer(callback) {
  const dir = mkdtempSync(join(tmpdir(), "elo-api-"));
  const app = createApp({ eloProjectsStore: createEloProjectsStore({ dataPath: join(dir, "elo-projects.json") }) });
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  try { await callback("http://127.0.0.1:" + server.address().port); }
  finally { await new Promise((resolve) => server.close(resolve)); rmSync(dir, { recursive: true, force: true }); }
}
async function json(url, options = {}) { const res = await fetch(url, Object.assign({ headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:5500" } }, options)); return { res, data: await res.json() }; }

test("Elo Projects API cobre CRUD revisao auditoria selecao e checklist", async () => {
  await withServer(async (base) => {
    const created = await json(base + "/api/elo/projects", { method: "POST", body: JSON.stringify({ companyId: "c1", project: { name: "Casa" } }) });
    assert.equal(created.res.status, 201);
    const id = created.data.project.id;
    assert.ok(id);
    assert.equal((await json(base + "/api/elo/projects")).data.projects.length, 1);
    assert.equal((await json(base + "/api/elo/projects/" + id)).data.project.project.name, "Casa");
    assert.equal((await json(base + "/api/elo/projects/" + id, { method: "PUT", body: JSON.stringify({ project: { cityUf: "Salvador/BA" } }) })).data.project.project.cityUf, "Salvador/BA");
    assert.equal((await json(base + "/api/elo/projects/" + id + "/revisions", { method: "POST", body: JSON.stringify({ summary: "R1" }) })).data.project.revisions.length, 1);
    assert.equal((await json(base + "/api/elo/projects/" + id + "/audits", { method: "POST", body: JSON.stringify({ item: "piso" }) })).data.project.audits.length, 1);
    assert.equal((await json(base + "/api/elo/projects/" + id + "/compositions/select", { method: "POST", body: JSON.stringify({ serviceId: "piso", compositionCode: "SINAPI" }) })).data.project.compositionSelections[0].compositionCode, "SINAPI");
    assert.equal((await json(base + "/api/elo/projects/" + id + "/executive/checklist", { method: "POST", body: JSON.stringify({ canClose: false }) })).data.project.executiveChecklists.length, 1);
  });
});
