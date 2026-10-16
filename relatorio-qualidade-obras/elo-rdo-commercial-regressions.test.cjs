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
 fetch:async(url,init={})=>{calls.push({url:String(url),method:init.method||"GET"});if(options.respond)return options.respond(url,init);assert.equal(init.method||"GET","GET");if(String(url).endsWith("/api/stock-full/works"))return{ok:true,status:200,json:async()=>({ok:true,works:[{id:"audit-unit-canonical-work",name:"OBRA QA REGRESSAO",institutionId:identity.institutionId}]})};assert.match(String(url),/\/api\/obrareport\/rdos/);return{ok:true,status:200,json:async()=>({ok:true,rdos:options.rdos||[]})};}};
 window.window=window;
 if(options.timers){window.setTimeout=(fn)=>setTimeout(fn,1);window.clearTimeout=clearTimeout;}
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


for(const [word,expected]of[["anteontem","2026-10-13"],["última segunda-feira","2026-10-12"],["última terça-feira","2026-10-13"],["último domingo","2026-10-11"]])test("AUDIT-006 calendar reference "+word,()=>{assert.equal(runtime().api.parseIntent({payload:{message:"Mostre o RDO de "+word,now:"2026-10-16T01:00:00Z"}}).targetDate,expected);});
test("AUDIT-006 calendar range and previous month",()=>{
 let p=runtime().api.parseIntent({payload:{message:"Liste RDOs no período de 01/10/2026 a 03/10/2026",now:"2026-10-16T01:00:00Z"}});assert.equal(p.startDate,"2026-10-01");assert.equal(p.endDate,"2026-10-03");assert.equal(p.targetDate,"");
 p=runtime().api.parseIntent({payload:{message:"RDOs do mês anterior",now:"2026-01-16T01:00:00Z"}});assert.equal(p.startDate,"2025-12-01");assert.equal(p.endDate,"2025-12-31");
});
test("AUDIT-006 page size supports numeric and written values",()=>{for(const value of ["7","sete"])assert.equal(runtime().api.parseIntent({payload:{message:"RDOs, "+value+" registros por página"}}).limit,7);});
test("AUDIT-006 most recent selects one actual persisted record",async()=>{
 const env=runtime({rdos:[{id:"rdo_previous",rdo_date:"2026-10-14",rdo_data_json:{}},{id:"rdo_newest",rdo_date:"2026-10-15",rdo_data_json:{}}]});const r=await env.api.execute({context:env.identity,action:"rdo.get",payload:{message:"Abra o RDO mais recente"}});assert.equal(r.data.rdo.id,"rdo_newest");
});
for(const name of ["QA REGRESSAO","OBRA QA REGRESSAO"])test("AUDIT-004 partial and exact authorized work "+name,async()=>{const env=runtime();await env.api.execute({context:env.identity,action:"preview_new_rdo",payload:{message:"Prepare um RDO de 15/10/2026 para a obra "+name+", mas não salve."}});assert.equal(env.api.readPending().draft.projectId,"audit-unit-canonical-work");});
test("AUDIT-005 bound date revision changes no other field",async()=>{
 const env=runtime();await env.api.execute({context:env.identity,action:"preview_new_rdo",payload:{message:"RDO de 15/10/2026 para a OBRA QA REGRESSAO. Equipe: 3 armadores. Clima: chuva."}});
 const before=plain(env.api.readPending());await env.api.execute({context:env.identity,action:"rdo.create.revise",payload:{message:"Ajuste apenas a data para 13/10/2026.",rdoPreviewContinuation:{field:"operational",operationId:before.operationId,createdAt:before.createdAt}}});
 const after=plain(env.api.readPending()),expected=plain(before);expected.draft.rdoDate="2026-10-13";expected.targetDate="2026-10-13";expected.draft.rdoData.date="2026-10-13";assert.deepEqual(after,expected);
});
test("AUDIT-005 declarative receipt correction preserves arrival time and team",async()=>{
 const env=runtime();await env.api.execute({context:env.identity,action:"preview_new_rdo",payload:{message:"RDO de 15/10/2026 para a OBRA QA REGRESSAO. Equipe: 3 armadores. Material recebido: 19 sacos de argamassa às 9h."}});
 const before=plain(env.api.readPending());await env.api.execute({context:env.identity,action:"rdo.create.revise",payload:{message:"Foram 16 sacos de argamassa, não 19.",rdoPreviewContinuation:{field:"operational",operationId:before.operationId,createdAt:before.createdAt}}});
 const after=plain(env.api.readPending()),expected=plain(before);expected.draft.rdoData.materials[0].quantity=16;assert.deepEqual(after,expected);
});
test("AUDIT-005 explicit exit time extraction",()=>{assert.equal(runtime().api.parseIntent({payload:{message:"Inclua o horário de saída às 18h15."}}).rdoData.endTime,"18:15");});
test("AUDIT-009 informal fields preserve facts and marker",()=>{
 const d=runtime().api.parseIntent({payload:{message:"Trabalharam 3 pintores e 2 ajudantes, com 1 encarregado, das 7h30 às 16h45. Fez chuva. Fizemos 25 m² de pintura. Chegaram 12 kg de argamassa às 9h. Parou das 13h às 13h15 por chuva. PILOTO_QA_variant-007"}}).rdoData;
 assert.equal(d.employeeCount,"6");assert.equal(d.startTime,"07:30");assert.equal(d.endTime,"16:45");assert.equal(d.weather,"chuva");assert.equal(d.productions[0].quantity,25);assert.equal(d.materials[0].quantity,12);assert.match(d.occurrences,/13:15/);assert.equal(d.generalNotes,"PILOTO_QA_variant-007");
});
test("AUDIT-008 invalid list response is an explicit error",async()=>{const env=runtime({respond:async()=>({ok:true,status:200,json:async()=>({ok:true})})});const r=await env.api.execute({context:env.identity,action:"rdo.list",payload:{message:"Liste RDOs"}});assert.equal(r.ok,false);assert.equal(r.error,"rdo_invalid_list_response");});
test("AUDIT-008 stalled list has a bounded query timeout",async()=>{const env=runtime({timers:true,respond:()=>new Promise(()=>{})});const r=await env.api.execute({context:env.identity,action:"rdo.list",payload:{message:"Liste RDOs"}});assert.equal(r.ok,false);assert.equal(r.error,"rdo_query_timeout");});
test("AUDIT-007 HTTP 201 without record never claims creation",async()=>{
 const env=runtime({respond:async(url,init)=>({ok:true,status:init.method==="POST"?201:200,json:async()=>String(url).includes("stock-full/works")?{ok:true,works:[{id:"audit-unit-canonical-work",name:"OBRA QA REGRESSAO",institutionId:"audit-unit-tenant"}]}:{ok:true}})});
 await env.api.execute({context:env.identity,action:"preview_new_rdo",payload:{message:"RDO de 15/10/2026 para a OBRA QA REGRESSAO."}});
 const r=await env.api.execute({context:env.identity,action:"rdo_confirm",payload:{message:"sim"}});assert.equal(r.ok,false);assert.doesNotMatch(r.humanAnswer,/RDO criado pelo ELO/);assert.match(r.humanAnswer,/pode ter ocorrido/);assert.equal(env.api.readPending().status,"pending");
});

for(const mode of ["valid","missing","mismatch"])test("AUDIT-007 authenticated persistence readback "+mode,async()=>{
 let saved;
 const env=runtime({respond:async(url,init)=>{
  if(String(url).endsWith("stock-full/works"))return{ok:true,status:200,json:async()=>({ok:true,works:[{id:"audit-unit-canonical-work",name:"OBRA QA REGRESSAO",institutionId:"audit-unit-tenant"}]})};
  if(init.method==="POST"){const body=JSON.parse(init.body);saved={id:"rdo_persistence",institution_id:"audit-unit-tenant",project_id:body.projectId,rdo_date:body.rdoDate,rdo_data_json:body.rdoData};return{ok:true,status:201,json:async()=>({ok:true,rdo:saved})};}
  if(mode==="missing")return{ok:false,status:404,json:async()=>({ok:false,error:"rdo_not_found"})};
  const record=plain(saved);if(mode==="mismatch")record.rdo_data_json.employeeCount="99";
  return{ok:true,status:200,json:async()=>({ok:true,rdo:record})};
 }});
 await env.api.execute({context:env.identity,action:"preview_new_rdo",payload:{message:"RDO de 15/10/2026 para a OBRA QA REGRESSAO. Equipe: 2 armadores."}});
 const answer=await env.api.execute({context:env.identity,action:"rdo_confirm",payload:{message:"sim"}});
 assert.equal(answer.ok,mode==="valid");assert.equal(env.api.readPending().status,mode==="valid"?"saved":"pending");
 assert.ok(env.calls.some(c=>c.method==="GET"&&c.url.endsWith("/rdo_persistence")));
 if(mode!=="valid")assert.doesNotMatch(answer.humanAnswer,/RDO criado pelo ELO/);
});

for(const [instruction,weather]of[["Mantenha os demais campos exatamente como estavam.","nublado"],["Não altere os demais dados.","chuva"],["Preserve todos os outros campos.","sol"],["Não modifique nenhum outro campo.","seco"]])test("AUDIT-017 preservation directive does not become weather: "+instruction,()=>{const d=runtime().api.parseIntent({payload:{message:"Ajuste o clima para "+weather+". "+instruction}}).rdoData;assert.equal(d.weather,weather);});
test("AUDIT-017 real multi-sentence weather remains intact",()=>{assert.equal(runtime().api.parseIntent({payload:{message:"Clima: sol pela manhã. Chuva à tarde."}}).rdoData.weather,"sol pela manhã. Chuva à tarde");});
test("AUDIT-016 persisted complementary service description and production are both visible",async()=>{const record={id:"rdo_complement",project_id:"audit-unit-canonical-work",rdo_date:"2026-10-15",rdo_data_json:{services:"Proteção dos elementos e inspeção da superfície",productions:[{service:"pintura",quantity:8,unit:"m²"}]}};const before=JSON.stringify(record),env=runtime({rdos:[record]});const answer=await env.api.execute({context:env.identity,action:"rdo.get",payload:{message:"Abra o RDO ID rdo_complement"}});assert.ok(answer.humanAnswer.includes("8 m² de pintura"));assert.ok(answer.humanAnswer.includes(record.rdo_data_json.services));assert.equal(JSON.stringify(record),before);assert.ok(env.calls.every(c=>c.method==="GET"));});
test("AUDIT-016 redundant service summary is not repeated",async()=>{const env=runtime({rdos:[{id:"rdo_service",rdo_date:"2026-10-15",rdo_data_json:{services:"PINTURA.",productions:[{service:"pintura",quantity:8,unit:"m²"}]}}]});const answer=await env.api.execute({context:env.identity,action:"rdo.get",payload:{message:"Abra o RDO ID rdo_service"}});assert.match(answer.humanAnswer,/SERVIÇOS: 8 m² de pintura\n/);});
