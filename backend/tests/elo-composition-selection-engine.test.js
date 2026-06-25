import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const repoDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function load(){ const sandbox={console,window:{}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras","elo-composition-selection-engine.js"),"utf8"),sandbox); return sandbox.window.EloCompositionSelectionEngine; }
test("CompositionSelection seleciona candidata oficial e registra revisao",()=>{ const e=load(); const record={budget:{compositionMatches:[{packageId:"piso",serviceId:"piso",candidates:[{code:"SINAPI-1",description:"Piso",source:"SINAPI",unit:"m2"}]}]},revisions:[],history:[]}; const selected=e.selectComposition(record,{packageId:"piso",serviceId:"piso",compositionCode:"SINAPI-1",reason:"melhor aderência"}); assert.equal(e.getSelectedCompositions(selected)[0].code,"SINAPI-1"); assert.equal(selected.revisions.length,1); assert.equal(selected.history.length,1); });
