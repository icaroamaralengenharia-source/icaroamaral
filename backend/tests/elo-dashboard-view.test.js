import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const repoDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function load(){ const sandbox={console,window:{}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras","elo-dashboard-view.js"),"utf8"),sandbox); return sandbox.window.EloDashboardView; }
test("DashboardView gera HTML com cards tabela e alertas",()=>{ const d=load(); const html=d.buildDashboardHtml({cards:[{label:"Pacotes",value:13,status:"ok"}],tables:{budgetRows:[{package:"Piso",service:"Piso cerâmico",quantity:50,unit:"m2",quantitySource:"informed",compositionCode:"SINAPI",consumptionStatus:"ready",pending:[]}],consumptions:[]},alerts:[{status:"blocked",message:"executivo bloqueado"}]}); assert.match(html,/Pacotes/); assert.match(html,/Piso cerâmico/); assert.match(html,/executivo bloqueado/); });
