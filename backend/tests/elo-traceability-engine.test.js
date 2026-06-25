import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const repoDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function load(){ const sandbox={console,window:{}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras","elo-traceability-engine.js"),"utf8"),sandbox); return sandbox.window.EloTraceabilityEngine; }
test("Traceability gera entradas para quantidade composicao consumo e bloqueio",()=>{ const e=load(); const entries=e.buildTraceabilityEntries({quantities:[{description:"Piso",quantity:50,unit:"m2",source:"informed",formula:"usuário",confidence:1},{description:"Cobertura",quantity:80,unit:"m2",source:"estimated",formula:"area"}],compositions:[{service:"Piso",candidates:[{code:"SINAPI",source:"SINAPI",score:.8}]}],consumptions:[{compositionCode:"SINAPI"}],blocked:[{reason:"unit",serviceId:"x"}]}); assert.ok(entries.some(x=>x.origin==="user_input")); assert.ok(entries.some(x=>x.origin==="estimated")); assert.ok(entries.some(x=>x.origin==="official_composition")); assert.ok(entries.some(x=>x.origin==="blocked")); });
