import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const testDir = dirname(fileURLToPath(import.meta.url)); const repoDir = join(testDir, "..", "..");
function load(){ const sandbox={console,window:{}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras","elo-executive-budget-engine.js"),"utf8"),sandbox); return sandbox.window.EloExecutiveBudgetEngine; }
test("ExecutiveBudget bloqueia executivo sem cidade composicoes fechadas e quantitativos completos",()=>{ const e=load(); const result=e.evaluateExecutiveReadiness({project:{type:"casa_terrea",builtAreaM2:80},premises:{},workPackages:[{status:"pending"}],compositionSelections:[]},{budgetTable:{summary:{pendingRows:4},rows:[]}}); assert.equal(result.ready,false); assert.ok(result.blockers.some(x=>x.id==="city_uf")); assert.ok(result.blockers.some(x=>x.id==="candidate_compositions")); });
test("ExecutiveBudget score aumenta quando dados sao preenchidos",()=>{ const e=load(); const low=e.evaluateExecutiveReadiness({project:{builtAreaM2:80},premises:{},workPackages:[{status:"pending"}],compositionSelections:[]},{budgetTable:{summary:{pendingRows:3},rows:[]}}); const high=e.evaluateExecutiveReadiness({client:{name:"Cliente"},project:{name:"Obra",cityUf:"Salvador/BA",type:"casa_terrea",builtAreaM2:80},premises:{sinapiState:"BA",sinapiReferenceMonth:"2026-06",priceSource:"SINAPI",bdi:20},workPackages:[{status:"ready"}],compositionSelections:[{selected:true}]},{budgetTable:{summary:{pendingRows:0},rows:[]},consumptionBlocked:[]}); assert.ok(high.score>low.score); });

test("ExecutiveChecklist bloqueia fechamento sem dados obrigatorios",()=>{ const e=load(); const result=e.buildExecutiveClosingChecklist({project:{type:"casa_terrea"},premises:{},workPackages:[{status:"pending"}],compositionSelections:[],revisions:[]},{budgetTable:{summary:{pendingRows:2}},baseStatus:{loaded:false},compositionMatches:[{found:true}]}); assert.equal(result.canClose,false); assert.ok(result.blockers.some(x=>x.id==="city_uf")); assert.ok(result.blockers.some(x=>x.id==="compositions")); assert.ok(result.blockers.some(x=>x.id==="prices")); });

