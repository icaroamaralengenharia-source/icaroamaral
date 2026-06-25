import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const repoDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function storage(){ return { m:{}, getItem(k){return this.m[k]||null;}, setItem(k,v){this.m[k]=String(v);}, removeItem(k){delete this.m[k];} }; }
function load(){ const sandbox={console,navigator:{},window:{localStorage:storage(),navigator:{}}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); ["elo-project-store.js","elo-composition-selection-engine.js","elo-export-engine.js","elo-executive-budget-engine.js","elo-budget-table-engine.js","elo-dashboard-view.js"].forEach((file)=>vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras",file),"utf8"),sandbox,{filename:file})); return sandbox.window; }
test("DashboardActions seleciona composi??o exporta e salva",()=>{ const win=load(); const budget={projectRecord:{id:"p1",budget:{compositionMatches:[{packageId:"piso",serviceId:"piso",candidates:[{code:"SINAPI-1",description:"Piso",source:"SINAPI",unit:"m2"}]}]},revisions:[],history:[]},budgetTable:{rows:[{package:"Piso",service:"Piso",quantity:50,unit:"m2"}],summary:{}},compositionMatches:[{packageId:"piso",serviceId:"piso",found:true,candidates:[{code:"SINAPI-1"}]}],consumptions:[],consumptionBlocked:[]}; win.EloDashboardView.setLastBudget(budget); assert.equal(win.EloDashboardActions.selectComposition({packageId:"piso",serviceId:"piso",compositionCode:"SINAPI-1"}).ok,true); const csv=win.EloDashboardActions.exportCsv(); assert.match(csv,/Pacote;/); assert.match(csv,/Quantidade/); assert.match(win.EloDashboardActions.exportJson(),/p1/); assert.equal(win.EloDashboardActions.saveProject().ok,true); });
