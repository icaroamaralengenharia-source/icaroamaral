"use strict";
// Local regressions only. Synthetic transport is not commercial E2E evidence.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const vm=require("node:vm");
const {execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,"..");
function runtime(options={}){
 const calls=[], values=new Map();
 const identity={institutionId:"audit-unit-tenant",companyId:"audit-unit-company",userId:"audit-unit-user"};
 const window={location:{hostname:"audit.test",protocol:"https:"},ELO_API_BASE_URL:"https://backend.test",
 localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},sessionStorage:{getItem:()=>null,removeItem(){}},
 EloCanonicalSession:{getSession:async()=>({ok:true,accessToken:"synthetic-unit-only",authContext:identity}),getValidAccessToken:async()=>"synthetic-unit-only"},
 fetch:async(url,init={})=>{calls.push({url:String(url),method:init.method||"GET"});assert.equal(init.method||"GET","GET");if(String(url).endsWith("/api/stock-full/works"))return{ok:true,status:200,json:async()=>({ok:true,works:[{id:"audit-unit-canonical-work",name:"OBRA QA REGRESSAO",institutionId:identity.institutionId}]})};assert.match(String(url),/\/api\/obrareport\/rdos/);return{ok:true,status:200,json:async()=>({ok:true,rdos:options.rdos||[]})};}};
 window.window=window;
 const context=vm.createContext({window,console,URL,URLSearchParams,Blob});
 const file="relatorio-qualidade-obras/elo-command-bridge.js";
 const source=process.env.RDO_AUDIT_BASELINE_REF?execFileSync("git",["show",process.env.RDO_AUDIT_BASELINE_REF+":"+file],{cwd:root,encoding:"utf8"}):fs.readFileSync(path.join(root,file),"utf8");
 vm.runInContext(source,context,{filename:file});
 return{api:window.EloActionBusRdo,window,calls,identity};
}
const plain=o=>JSON.parse(JSON.stringify(o));
for(const [label,now,zone,today,yesterday] of [
 ["Bahia after UTC midnight","2026-10-16T01:16:37.640Z","America/Bahia","2026-10-15","2026-10-14"],
 ["month boundary","2026-11-01T02:30:00Z","America/Sao_Paulo","2026-10-31","2026-10-30"],
 ["year boundary","2027-01-01T00:30:00Z","America/Bahia","2026-12-31","2026-12-30"],
 ["Acre work","2026-10-16T04:30:00Z","America/Rio_Branco","2026-10-15","2026-10-14"],
 ["UTC work","2026-10-16T01:16:37Z","UTC","2026-10-16","2026-10-15"],
 ["leap day","2024-03-01T01:30:00Z","America/Bahia","2024-02-29","2024-02-28"]
]){
 for(const [word,expected] of [["hoje",today],["ontem",yesterday]]) test("AUDIT-001 calendar "+label+" "+word,()=>{
  const env=runtime();const result=env.api.parseIntent({context:{timeZone:zone},payload:{message:"RDO de "+word,now}});
  assert.equal(result.targetDate,expected);
 });
}
test("AUDIT-001 default Brazil calendar preserves explicit ISO and BR dates",()=>{
 const env=runtime();
 for(const date of ["15/10/2026","2026-10-15"]) assert.equal(env.api.parseIntent({payload:{message:"RDO de "+date,now:"2026-10-16T01:00:00Z"}}).targetDate,"2026-10-15");
 assert.equal(env.api.parseIntent({payload:{message:"RDO de hoje",now:"2026-10-16T01:00:00Z"}}).targetDate,"2026-10-15");
});
for(const [input,expected]of [["Corrija o clima para nublado.","nublado"],["Ajuste o clima para chuva.","chuva"],["Clima: sol.","sol"],["O clima foi chuvoso.","chuvoso"],["O clima era seco.","seco"],["Clima está nublado.","nublado"]]){
 test("AUDIT-002 natural operational field: "+input,()=>{assert.equal(runtime().api.parseIntent({payload:{message:input}}).rdoData.weather,expected);});
}
test("AUDIT-002 revision changes weather only and performs zero writes",async()=>{
 const env=runtime();const context=env.identity;
 await env.api.execute({context,action:"preview_new_rdo",payload:{message:"Prepare um RDO de 15/10/2026 para a OBRA QA REGRESSAO. Equipe: 1 encarregado, 2 pedreiros e 3 serventes. Horário: das 8h às 17h. Clima: sol. Serviço: 17 m² de alvenaria. Material recebido: 24 sacos de cimento às 10h. Não salve."}});
 const before=plain(env.api.readPending());assert.equal(before.draft.rdoData.weather,"sol");
 const response=await env.api.execute({context,action:"rdo.create.revise",payload:{message:"Corrija o clima para nublado.",rdoPreviewContinuation:{field:"operational",operationId:before.operationId,createdAt:before.createdAt}}});
 const after=plain(env.api.readPending());const expected=plain(before);expected.draft.rdoData.weather="nublado";
 assert.deepEqual(after,expected);assert.match(response.humanAnswer,/CLIMA: nublado/);assert.ok(env.calls.every(c=>c.method==="GET"));
});


test("AUDIT-003 persisted read presents operational fields with no confirmation or writes",async()=>{
 const record={id:"rdo_audit_read",institution_id:"audit-unit-tenant",project_id:"audit-unit-canonical-work",rdo_date:"2026-10-15",title:"RDO audit read",status:"draft",rdo_data_json:{projectName:"OBRA QA REGRESSAO",employeeCount:"6",teamPresent:"1 encarregado, 2 pedreiros e 3 serventes",startTime:"08:00",endTime:"17:00",weather:"sol",services:"alvenaria",productions:[{service:"alvenaria",quantity:17,unit:"m²"}],materials:[{name:"cimento",quantity:22,unit:"sacos",note:"Recebido às 10:00"}],occurrences:"paralisação parcial entre 14:00 e 14:30",generalNotes:"MARCADOR_AUDIT_READ"}};
 const before=JSON.stringify(record);const env=runtime({rdos:[record]});
 const response=await env.api.execute({context:env.identity,action:"rdo.get",payload:{message:"Abra o RDO ID rdo_audit_read"}});
 assert.equal(response.ok,true);assert.equal(response.mode,"read");assert.equal(response.requiresConfirmation,false);
 for(const fact of ["OBRA QA REGRESSAO","15/10/2026","6 pessoas","08:00–17:00","CLIMA: sol","17 m² de alvenaria","22 sacos de cimento","Recebido às 10:00","14:00 e 14:30","MARCADOR_AUDIT_READ"]) assert.ok(response.humanAnswer.includes(fact),fact);
 assert.ok(response.humanAnswer.includes("\nEQUIPE:"));assert.doesNotMatch(response.humanAnswer,/Ainda não salvei|Deseja confirmar/);
 assert.equal(JSON.stringify(record),before);assert.ok(env.calls.every(c=>c.method==="GET"));
});
test("AUDIT-003 persisted incomplete data has no invented operational values",async()=>{
 const env=runtime({rdos:[{id:"rdo_audit_empty",project_id:"audit-unit-canonical-work",rdo_date:"2026-10-15",title:"RDO incomplete",rdo_data_json:{}}]});
 const response=await env.api.execute({context:env.identity,action:"rdo.get",payload:{message:"Abra o RDO ID rdo_audit_empty"}});
 assert.match(response.humanAnswer,/EQUIPE: Não informado/);assert.match(response.humanAnswer,/MATERIAIS: Não informado/);assert.ok(env.calls.every(c=>c.method==="GET"));
});

