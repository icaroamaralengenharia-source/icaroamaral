import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const testDir = dirname(fileURLToPath(import.meta.url)); const repoDir = join(testDir, "..", "..");
function load(){ const sandbox={console,window:{}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras","elo-ui-data-engine.js"),"utf8"),sandbox); return sandbox.window.EloUiDataEngine; }
test("UIData gera cards tabelas alertas e acoes",()=>{ const e=load(); const data=e.buildEloDashboardData({projectRecord:{revisions:[{number:0}],audits:[{status:"critical"}]},budget:{workPackages:{packages:[{id:"piso",name:"Piso"}]},quantities:[{source:"informed"}],compositionMatches:[{found:true}],consumptions:[{}],budgetTable:{summary:{pendingRows:2},rows:[{}]},consumptionBlocked:[{reason:"unit_incompatible"}]},executiveReadiness:{ready:false,score:0.3,blockers:[{id:"city",message:"cidade ausente"}],missing:[]}}); assert.ok(data.cards.some(c=>c.id==="pending")); assert.ok(data.tables.budgetRows.length); assert.ok(data.alerts.length>=2); assert.ok(data.actions.some(a=>a.id==="evaluate-executive")); });
