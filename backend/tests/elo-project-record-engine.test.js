import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const testDir = dirname(fileURLToPath(import.meta.url)); const repoDir = join(testDir, "..", "..");
function load(){ const sandbox={console,window:{}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras","elo-project-record-engine.js"),"utf8"),sandbox); return sandbox.window.EloProjectRecordEngine; }
test("ProjectRecord cria prontuario e preserva historico e revisoes",()=>{ const e=load(); const record=e.buildOrUpdateProjectRecord(null,{projectFacts:{projectType:"casa_terrea",builtAreaM2:80,wallMaterial:"bloco ceramico baiano",roofMaterial:"telha portuguesa",floorMaterial:"piso ceramico"},summary:"orcamento preliminar"}); assert.equal(record.project.builtAreaM2,80); assert.equal(record.premises.wallSystem,"bloco ceramico baiano"); assert.equal(record.premises.roof,"telha portuguesa"); assert.equal(record.status,"preliminary"); assert.equal(record.revisions.length,1); assert.equal(record.history.length,1); });
test("ProjectRecord serialize e hydrate mantem dados",()=>{ const e=load(); const record=e.buildOrUpdateProjectRecord(null,{projectFacts:{builtAreaM2:80}}); const hydrated=e.hydrateProjectRecord(e.serializeProjectRecord(record)); assert.equal(hydrated.project.builtAreaM2,80); assert.equal(e.summarizeProjectRecord(hydrated).revision,0); });
