import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const repoDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function load(){ const sandbox={console,window:{}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras","elo-export-engine.js"),"utf8"),sandbox); return sandbox.window.EloExportEngine; }
test("Export gera CSV e JSON sem zero falso",()=>{ const e=load(); const csv=e.exportBudgetToCsv({rows:[{package:"Piso",service:"Piso",quantity:null,unit:"m2",quantitySource:"pending",compositionCode:"",compositionSource:"",consumptionStatus:"pending",pending:["area"]}]}); assert.match(csv,/Pacote;Serviço/); assert.match(csv,/pendente/); assert.doesNotMatch(csv,/;0;/); const json=e.exportProjectRecordToJson({id:"1"}); assert.match(json,/"id": "1"/); });
