import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const repoDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function load(){ const sandbox={console,window:{},localStorage:{m:{},getItem(k){return this.m[k]||null},setItem(k,v){this.m[k]=String(v)},removeItem(k){delete this.m[k]}}}; sandbox.globalThis=sandbox.window; sandbox.window.localStorage=sandbox.localStorage; vm.createContext(sandbox); vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras","elo-project-store.js"),"utf8"),sandbox); return sandbox.window.EloProjectStore; }
test("ProjectStore salva lista carrega historico e exclui",()=>{ const s=load(); const saved=s.saveProjectRecord({project:{name:"Obra A",builtAreaM2:80}}); assert.ok(saved.id); assert.equal(s.listProjectRecords().length,1); assert.equal(s.loadProjectRecord(saved.id).project.name,"Obra A"); const updated=s.appendProjectHistory(saved.id,{type:"note",message:"evento"}); assert.ok(updated.history.length>=2); s.appendProjectRevision(saved.id,{summary:"R1"}); assert.ok(s.loadProjectRecord(saved.id).revisions.length>=1); assert.equal(s.deleteProjectRecord(saved.id),true); assert.equal(s.listProjectRecords().length,0); });
