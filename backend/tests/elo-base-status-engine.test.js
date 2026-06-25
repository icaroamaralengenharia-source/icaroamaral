import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const repoDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function load(){ const sandbox={console,window:{}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); for(const f of ["stock-ai-composition-engine.js","composition-search-engine.js","elo-base-status-engine.js"]){ vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras",f),"utf8"),sandbox,{filename:f}); if(f==="composition-search-engine.js") sandbox.window.StockAiCompositionEngine.importOfficialBase({rows:[{source:"SINAPI",state:"BA",referenceMonth:"2026-06",compositionCode:"1",compositionName:"Piso",compositionUnit:"m2",inputCode:"I",inputName:"Argamassa",inputUnit:"kg",coefficient:"4"}]}); } return sandbox.window.EloBaseStatusEngine; }
test("BaseStatus retorna totais quando base carregada",()=>{ const e=load(); const status=e.getTechnicalBaseStatus(); assert.equal(status.loaded,true); assert.ok(status.totalCompositions>=1); assert.ok(status.totalInputs>=1); });
