import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const repoDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function load(){ const sandbox={console,window:{}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras","elo-dashboard-view.js"),"utf8"),sandbox); return sandbox.window.EloDashboardView; }
test("DashboardView gera painel operacional com cards tabelas checklist e acoes",()=>{ const d=load(); const html=d.buildDashboardHtml({projectRecordId:"p1",cards:[{label:"Pacotes",value:13,status:"ok"}],baseStatus:{loaded:true},executiveClosing:{canClose:false,score:0.3,checklist:[{label:"Pre?o",ok:false,required:true}]},selectableCompositions:[{serviceId:"piso",packageId:"piso",code:"SINAPI",description:"Piso",source:"SINAPI",unit:"m2",score:0.9}],tables:{budgetRows:[{package:"Piso",service:"Piso cer?mico",quantity:50,unit:"m2",quantitySource:"informed",compositionCode:"SINAPI",consumptionStatus:"ready",pending:[]}],consumptions:[{serviceId:"piso",quantity:50,inputs:[{name:"Argamassa",coefficient:4.2,total:210,unit:"kg"}]}]},alerts:[{status:"blocked",message:"executivo bloqueado"}]}); assert.match(html,/Painel operacional do ELO/); assert.match(html,/Pacotes/); assert.match(html,/Piso cer/); assert.match(html,/Composi/); assert.match(html,/Selecionar/); assert.match(html,/Checklist executivo/); assert.match(html,/Exportar CSV/); assert.match(html,/executivo bloqueado/); });
