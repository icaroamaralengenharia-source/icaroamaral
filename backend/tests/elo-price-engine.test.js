import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const repoDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function load(){ const sandbox={window:{}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras","elo-price-engine.js"),"utf8"),sandbox); return sandbox.window.EloPriceEngine; }
test("PriceEngine n?o totaliza sem pre?o",()=>{ const e=load(); const result=e.attachPricesToBudgetRows([{service:"Piso",quantity:50,unit:"m2",compositionCode:"SINAPI-PISO"}],{}); assert.equal(result.canTotal,false); assert.equal(result.totals,null); assert.equal(result.missingPrices.length,1); });
test("PriceEngine aplica BDI apenas com pre?os completos",()=>{ const e=load(); const result=e.attachPricesToBudgetRows([{service:"Piso",quantity:50,unit:"m2",compositionCode:"SINAPI-PISO"}],{"SINAPI-PISO":20,source:"user"}); assert.equal(result.canTotal,true); assert.equal(result.totals.directCost,1000); assert.equal(e.applyBdi(result.pricedRows,20).totalWithBdi,1200); assert.equal(e.applyBdi([{service:"Sem pre?o"}],20).canApply,false); });
