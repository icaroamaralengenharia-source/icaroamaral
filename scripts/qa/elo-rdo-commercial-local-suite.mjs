// 100 independent UI scenarios against the official backend + real local SQL.
// The local auth/REST adapter is explicitly not Supabase cloud certification.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {config,query,root,qaDir,ports} from "./elo-rdo-local-db.mjs";
import {installedChromium} from "./elo-rdo-local-browser.mjs";
const require=createRequire(path.join(root,"package.json"));
const {chromium}=require("@playwright/test");
const c=config(),api="http://127.0.0.1:"+ports.backend,ui="http://127.0.0.1:"+ports.frontend,gateway="http://127.0.0.1:"+ports.gateway;
const rdoFaultRoute=url=>url.origin===api&&url.pathname.startsWith("/api/obrareport/rdos");
const catalog=JSON.parse(fs.readFileSync(path.join(root,"scripts/qa/elo-rdo-commercial-cases.json"),"utf8"));
const runId=process.env.ELO_QA_RUN_ID||new Date().toISOString().replace(/\D/g,"").slice(0,14);
const runDir=path.join(qaDir,"runs",runId);if(fs.existsSync(runDir)&&fs.readdirSync(runDir).length)throw Error("Refusing to overwrite existing evidence run");fs.mkdirSync(runDir,{recursive:true});
const numbers=process.env.ELO_QA_CASES?new Set(process.env.ELO_QA_CASES.split(",").map(Number)):null;
const results=[];
const canonical=v=>JSON.stringify(v&&typeof v==="object"?(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))]))):v);
const allRdos=()=>query("select * from obrareport_rdos order by id");
const safe=s=>Object.values(c.accounts).reduce((v,a)=>v.replaceAll(a.password,"[local-password-redacted]"),String(s)).replace(/eyJ[A-Za-z0-9_.-]+/g,"[jwt-redacted]").replace(/Bearer\s+\S+/gi,"Bearer [redacted]");
const checkedFacts=(answer,facts)=>{for(const fact of facts)assert.ok(answer.includes(fact),"Missing fact: "+fact);};
function full(work,marker="PILOTO_QA_"+runId,extra=""){return "Prepare um RDO de 15/10/2026 para a obra "+work.name+". Este é o piloto controlado "+marker+". Equipe: 1 encarregado, 2 pedreiros e 3 serventes. Horário: das 8h às 17h. Clima: sol. Serviço: 17 m² de alvenaria. Material recebido: 24 sacos de cimento às 10h. Intercorrência: houve paralisação parcial entre 14h e 14h30 por falta de material. "+extra+" Não salve antes de mostrar a prévia completa.";}
async function login(page,actor="A"){
 const a=c.accounts[actor];
 await page.goto(ui+"/elo.html",{waitUntil:"domcontentloaded"});
 await page.locator('input[name="email"]').fill(a.email);
 await page.locator('input[name="password"]').fill(a.password);
 const promise=page.waitForResponse(r=>r.url().startsWith(gateway+"/auth/v1/token")&&r.request().method()==="POST",{timeout:20000});
 await page.getByRole("button",{name:"Entrar",exact:true}).click();
 const response=await promise;assert.equal(response.status(),200);
 const auth=await response.json();
 await page.getByText(a.email,{exact:true}).waitFor({timeout:20000});
 return auth.access_token;
}
async function ask(ctx,message){
 const {page}=ctx,started=Date.now();const before=await page.locator("article.elo-message.assistant").count();
 ctx.steps.push({type:"message",input:message,startedAt:new Date(started).toISOString()});
 await page.getByRole("textbox",{name:"Pergunte ao ELO…",exact:true}).fill(message);
 await page.getByRole("button",{name:"➤ Enviar",exact:true}).click();
 await page.waitForFunction(n=>{const a=document.querySelectorAll("article.elo-message.assistant .elo-message-bubble");return a.length>n&&a[a.length-1].textContent.trim()!=="Estou pensando";},before,{timeout:45000});
 const output=await page.locator("article.elo-message.assistant .elo-message-bubble").last().innerText();
 Object.assign(ctx.steps.at(-1),{output:safe(output),durationMs:Date.now()-started});
 ctx.answer=output;return output;
}
const pending=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("elo_action_bus_rdo_pending_v1")||"null"));
const data=async ctx=>(await pending(ctx.page))?.draft?.rdoData||{};
const postCount=ctx=>ctx.requests.filter(r=>r.method==="POST"&&r.path==="/api/obrareport/rdos").length;
async function draft(ctx,fields="",work=ctx.actor.works[0]){await ask(ctx,"Prepare um RDO de 15/10/2026 para a obra "+work.name+". "+fields+" Não salve antes de mostrar a prévia completa.");const p=await pending(ctx.page);assert.equal(p?.action,"rdo.create.execute");return p;}
async function fullDraft(ctx){const marker="PILOTO_QA_"+runId+"_"+String(ctx.number).padStart(3,"0");await ask(ctx,full(ctx.actor.works[0],marker));const p=await pending(ctx.page);assert.equal(p?.action,"rdo.create.execute");return p;}
async function apiGet(ctx,url){
 const target=new URL(url,api);assert.equal(target.hostname,"127.0.0.1");
 const r=await fetch(target,{headers:{Authorization:"Bearer "+ctx.token}});const json=await r.json();ctx.verifications.push({method:"GET",path:target.pathname+target.search,status:r.status,body:json});return {r,json};
}
const compareOtherFields=(before,after,field,value)=>{const expected=structuredClone(before);expected[field]=value;assert.equal(canonical(after),canonical(expected));};
async function scenario(n,ctx){
 const a=ctx.actor,page=ctx.page,w=a.works[0],recordId=a.seedRdoIds[0];
 switch(n){
 case 1:{await page.getByText(a.email,{exact:true}).waitFor();const r=await apiGet(ctx,"/api/stock-full/me");assert.equal(r.r.status,200);assert.equal(r.json.profile.institution_id,a.institutionId);break;}
 case 2:await draft(ctx);assert.equal((await pending(page)).draft.projectId,w.id);break;
 case 3:await ask(ctx,"Prepare um RDO de 15/10/2026 para a obra CONSTRUÇÃO ÁGUA, mas não salve.");assert.equal((await pending(page))?.draft?.projectId,a.works[2].id);break;
 case 4:await ask(ctx,"Prepare um RDO de 15/10/2026 para a obra qa construção água, mas não salve.");assert.equal((await pending(page))?.draft?.projectId,a.works[2].id);break;
 case 5:await ask(ctx,"Prepare um RDO de 15/10/2026 para a obra QA INEXISTENTE "+runId+", mas não salve.");assert.ok(!(await pending(page))?.draft?.projectId);assert.match(ctx.answer,/não encontr|selec|escolh|informe/i);break;
 case 6:await ask(ctx,"Prepare um RDO de 15/10/2026 para a obra QA COMERCIAL, mas não salve.");assert.ok(!(await pending(page))?.draft?.projectId);assert.match(ctx.answer,/mais de uma|poss[ií]ve|qual|escolh|selec/i);checkedFacts(ctx.answer,["ALFA","NORTE"]);break;
 case 7:{const p=await draft(ctx,"Clima: sol.");assert.equal(p.draft.projectId,w.id);assert.equal(p.draft.rdoData.workId,w.id);const works=await apiGet(ctx,"/api/stock-full/works");assert.ok(works.json.works.some(x=>x.id===w.id&&x.name===w.name));break;}
 case 8:await ask(ctx,"Prepare um RDO de 15/10/2026 para a obra QA TENANT B, mas não salve.");assert.ok(!(await pending(page))?.draft?.projectId);assert.ok(!ctx.answer.includes(c.accounts.B.works[0].id));{const v=await apiGet(ctx,"/api/obrareport/rdos/"+c.accounts.B.seedRdoIds[0]);assert.ok([403,404].includes(v.r.status));}break;
 case 9:{const p=await draft(ctx,"Equipe: 2 pedreiros. Clima: sol.");await ask(ctx,"Troque a obra para QA CONSTRUÇÃO ÁGUA.");const after=await pending(page);assert.equal(after?.draft?.projectId,a.works[2].id);assert.equal(after.draft.rdoData.employeeCount,p.draft.rdoData.employeeCount);break;}
 case 10:{const p=await fullDraft(ctx);await ask(ctx,"Mostre novamente a prévia completa.");assert.equal((await pending(page)).draft.projectId,p.draft.projectId);assert.ok(ctx.answer.includes(w.name));break;}
 case 11:await ask(ctx,"Liste os RDOs da obra "+w.name+".");await ask(ctx,"Quais RDOs existem nesta obra?");checkedFacts(ctx.answer,["RDO QA A 2026-10-15","RDO QA A 2026-10-14"]);break;
 case 12:await ask(ctx,"Abra o RDO mais recente da obra "+w.name+".");checkedFacts(ctx.answer,["2026-10-15"]);assert.ok(!ctx.answer.includes("RDO QA A 2026-10-14"));break;
 case 13:await ask(ctx,"Abra o RDO de 14/10/2026 da obra "+w.name+".");checkedFacts(ctx.answer,["2026-10-14"]);assert.ok(!ctx.answer.includes("RDO QA A 2026-10-15"));break;
 case 14:await ask(ctx,"Abra o RDO ID "+recordId+".");checkedFacts(ctx.answer,["RDO QA A 2026-10-15"]);{const r=await apiGet(ctx,"/api/obrareport/rdos/"+recordId);assert.equal(r.json.rdo.id,recordId);}break;
 case 15:await ask(ctx,"Abra o RDO de 01/01/2020 da obra "+w.name+".");assert.match(ctx.answer,/não encontr|não há|nenhum RDO/i);assert.ok(!ctx.answer.includes("RDO QA A 2026-10-15"));break;
 case 16:await ask(ctx,"Liste os RDOs da obra "+w.name+" no período de 01/10/2026 a 03/10/2026.");for(const date of ["2026-10-01","2026-10-02","2026-10-03"])assert.ok(ctx.answer.includes(date),date);assert.ok(!ctx.answer.includes("2026-10-15"));break;
 case 17:await ask(ctx,"Liste os RDOs do mês anterior da obra "+w.name+".");assert.ok(ctx.answer.includes("2026-09-30"));assert.ok(!ctx.answer.includes("2026-10-15"));break;
 case 18:await ask(ctx,"Liste em ordem do mais recente para o mais antigo os RDOs da obra "+w.name+".");{const dates=[...ctx.answer.matchAll(/RDO QA A (\d{4}-\d{2}-\d{2})/g)].map(m=>m[1]);assert.ok(dates.length>2);assert.deepEqual(dates,[...dates].sort().reverse());}break;
 case 19:await ask(ctx,"Liste os RDOs da obra "+w.name+", cinco registros por página.");{const ids=()=>page.locator("article.elo-message.assistant").last().locator("[data-elo-rdo-id]").evaluateAll(elements=>elements.map(e=>e.getAttribute("data-elo-rdo-id")));const first=await ids();assert.equal(first.length,5);await ask(ctx,"Próxima página de RDOs.");const second=await ids();assert.equal(second.length,5);assert.ok(second.every(id=>!first.includes(id)));}break;
 case 20:await ask(ctx,"Abra o RDO ID "+recordId+".");{const first=ctx.answer;await page.reload({waitUntil:"domcontentloaded"});await page.getByText(a.email,{exact:true}).waitFor();await ask(ctx,"Abra o RDO ID "+recordId+".");assert.equal(ctx.answer,first);const v=await apiGet(ctx,"/api/obrareport/rdos/"+recordId);assert.equal(v.json.rdo.id,recordId);}break;
 case 21:await ask(ctx,"Crie o RDO de hoje para a obra "+w.name+", mas não salve.");assert.equal((await pending(page))?.draft?.rdoDate,"2026-10-15");break;
 case 22:await ask(ctx,"Abra o RDO de ontem da obra "+w.name+".");assert.ok(ctx.answer.includes("2026-10-14"));assert.ok(!ctx.answer.includes("RDO QA A 2026-10-15"));break;
 case 23:await ask(ctx,"Mostre o RDO de anteontem da obra "+w.name+".");assert.ok(ctx.answer.includes("2026-10-13"));assert.ok(!ctx.answer.includes("RDO QA A 2026-10-15"));break;
 case 24:await ask(ctx,"Mostre o RDO da última segunda-feira da obra "+w.name+".");assert.ok(ctx.answer.includes("2026-10-12"));assert.ok(!ctx.answer.includes("RDO QA A 2026-10-15"));break;
 case 25:await ask(ctx,"Prepare um RDO para a obra "+w.name+" na data de 15/10/2026, mas não salve.");assert.equal((await pending(page))?.draft?.rdoDate,"2026-10-15");break;
 case 26:await ask(ctx,"Prepare um RDO de 2026-10-15 para a obra "+w.name+", mas não salve.");assert.equal((await pending(page))?.draft?.rdoDate,"2026-10-15");break;
 case 27:await page.clock.setFixedTime(new Date("2026-11-01T01:00:00Z"));await ask(ctx,"Prepare um RDO de hoje para a obra "+w.name+", mas não salve.");assert.equal((await pending(page))?.draft?.rdoDate,"2026-10-31");break;
 case 28:await page.clock.setFixedTime(new Date("2024-03-01T01:00:00Z"));await ask(ctx,"Prepare um RDO de hoje para a obra "+w.name+", mas não salve.");assert.equal((await pending(page))?.draft?.rdoDate,"2024-02-29");break;
 case 29:await ask(ctx,"Prepare um RDO de 17/10/2026 para a obra "+w.name+", mas não salve.");{const d=await data(ctx);assert.equal(d.date,"2026-10-17");assert.equal(d.employeeCount,undefined);assert.equal(d.startTime,undefined);}break;
 case 30:{const before=await fullDraft(ctx);await ask(ctx,"Corrija somente a data deste RDO para 14/10/2026. Não altere os demais dados e não salve.");const p=await pending(page);assert.equal(p?.draft?.rdoDate,"2026-10-14");const expected=structuredClone(before.draft.rdoData);expected.date="2026-10-14";delete expected.operationId;const actual={...p.draft.rdoData};delete actual.operationId;assert.equal(canonical(actual),canonical(expected));break;}
 case 31:await draft(ctx,"Equipe: 1 encarregado, 2 pedreiros e 3 serventes.");assert.equal((await data(ctx)).teamPresent,"1 encarregado, 2 pedreiros e 3 serventes");break;
 case 32:await draft(ctx,"Equipe: 3 serventes, 1 encarregado e 2 pedreiros.");assert.equal((await data(ctx)).employeeCount,"6");break;
 case 33:await draft(ctx,"Jornada: das 08h às 17h.");{const d=await data(ctx);assert.equal(d.startTime,"08:00");assert.equal(d.endTime,"17:00");}break;
 case 34:await draft(ctx,"Clima: sol.");assert.equal((await data(ctx)).weather,"sol");break;
 case 35:await draft(ctx,"Serviço: alvenaria.");assert.equal((await data(ctx)).services,"alvenaria");break;
 case 36:await draft(ctx,"Produção: 17 m² de alvenaria.");{const d=await data(ctx);assert.equal(d.productions[0].quantity,17);assert.equal(d.productions[0].unit,"m²");}break;
 case 37:await draft(ctx,"Material recebido: 24 sacos de cimento.");assert.equal((await data(ctx)).materials[0].quantity,24);break;
 case 38:await draft(ctx,"Material recebido: 24 sacos de cimento às 10h.");assert.equal((await data(ctx)).materials[0].note,"Recebido às 10:00");break;
 case 39:await draft(ctx,"Intercorrência: houve paralisação parcial entre 14h e 14h30 por falta de material.");assert.equal((await data(ctx)).occurrences,"houve paralisação parcial entre 14:00 e 14:30 por falta de material");break;
 case 40:await fullDraft(ctx);checkedFacts(ctx.answer,[w.name,"15/10/2026","6 pessoas","08:00–17:00","CLIMA: sol","17 m²","24 sacos","10:00","14:30","PILOTO_QA_"]);break;
 case 41:await draft(ctx,"Responsável: Equipe QA.");checkedFacts(ctx.answer,[w.name,"DATA: 15/10/2026","RESPONSÁVEL: Equipe QA"]);break;
 case 42:await draft(ctx,"Equipe: 2 armadores e 2 serventes.");checkedFacts(ctx.answer,["4 pessoas","2 armadores e 2 serventes"]);break;
 case 43:await draft(ctx,"Jornada: das 8h15 às 17h10.");checkedFacts(ctx.answer,["HORÁRIOS: 08:15–17:10"]);break;
 case 44:await draft(ctx,"Clima: chuva.");checkedFacts(ctx.answer,["CLIMA: chuva"]);break;
 case 45:await draft(ctx,"Serviço: 17,5 m² de reboco.");assert.equal((await data(ctx)).productions[0].quantity,17.5);checkedFacts(ctx.answer,["17.5 m² de reboco"]);break;
 case 46:await draft(ctx,"Materiais recebidos: 24 sacos de cimento às 10h; 10 kg de areia às 11h.");{const d=await data(ctx);assert.equal(d.materials.length,2);checkedFacts(ctx.answer,["24 sacos de cimento","10:00","10 kg de areia","11:00"]);}break;
 case 47:await draft(ctx,"Intercorrência: parada entre 12h10 e 13h20 por manutenção preventiva.");checkedFacts(ctx.answer,["12:10","13:20","manutenção preventiva"]);break;
 case 48:{const text="Observação técnica: execução, atenção à fundação e proteção da área. ".repeat(25)+"FIM_OBSERVACAO_QA";await draft(ctx,"Observações: "+text+".");assert.equal((await data(ctx)).generalNotes,text);assert.ok(ctx.answer.includes("FIM_OBSERVACAO_QA"));break;}
 case 49:await draft(ctx);{const d=await data(ctx);for(const key of ["responsible","employeeCount","weather","materials","productions"])assert.equal(d[key],undefined);checkedFacts(ctx.answer,["RESPONSÁVEL: Não informado","EQUIPE: Não informado"]);}break;
 case 50:await fullDraft(ctx);assert.equal(postCount(ctx),0);assert.equal(canonical(allRdos()),canonical(ctx.before));break;
 case 51:{await fullDraft(ctx);const before=ctx.answer;await ask(ctx,"Mostre novamente a prévia completa.");assert.equal(ctx.answer,before);break;}
 case 52:await fullDraft(ctx);await ask(ctx,"Quais campos foram preenchidos?");checkedFacts(ctx.answer,["EQUIPE: 6 pessoas","17 m²","24 sacos"]);break;
 case 53:await fullDraft(ctx);await ask(ctx,"Faltou mostrar a equipe.");checkedFacts(ctx.answer,["1 encarregado, 2 pedreiros e 3 serventes"]);assert.ok(!ctx.answer.startsWith("RDOs encontrados"));break;
 case 54:await draft(ctx,"Equipe: 2 pedreiros. Clima: sol.");await ask(ctx,"Inclua o horário de saída às 17h.");assert.equal((await data(ctx)).endTime,"17:00");break;
 case 55:{await fullDraft(ctx);const before=await data(ctx);await ask(ctx,"Corrija o clima para nublado.");compareOtherFields(before,await data(ctx),"weather","nublado");checkedFacts(ctx.answer,["CLIMA: nublado"]);break;}
 case 56:await fullDraft(ctx);await ask(ctx,"Foram 22 sacos de cimento, não 24.");assert.equal((await data(ctx)).materials[0].quantity,22);break;
 case 57:{await fullDraft(ctx);const before=await data(ctx);await ask(ctx,"Corrija nesse mesmo RDO: chegaram 22 sacos de cimento, não 24. Não altere os demais dados.");const after=await data(ctx),expected=structuredClone(before);expected.materials[0].quantity=22;assert.equal(canonical(after),canonical(expected));break;}
 case 58:await fullDraft(ctx);await ask(ctx,"Não salve ainda.");assert.equal(postCount(ctx),0);assert.equal((await pending(page))?.status,"pending");break;
 case 59:await fullDraft(ctx);await ask(ctx,"não");assert.equal(await pending(page),null);assert.match(ctx.answer,/cancelad/);break;
 case 60:await fullDraft(ctx);await ask(ctx,"Cancelar");await draft(ctx,"",a.works[2]);{const d=await data(ctx);for(const key of ["employeeCount","weather","materials","productions"])assert.equal(d[key],undefined);assert.equal(d.projectId,a.works[2].id);}break;
 case 61:await ask(ctx,"Prepare um RDO para a obra "+w.name+", mas não salve.");await ask(ctx,"15/10/2026");assert.equal((await pending(page))?.draft?.rdoDate,"2026-10-15");assert.ok(!ctx.answer.includes("resultado é"));break;
 case 62:await ask(ctx,"Liste os RDOs da obra "+w.name+".");assert.ok(!(await pending(page))?.action?.includes("create"));assert.equal(postCount(ctx),0);break;
 case 63:await ask(ctx,"Corrija o RDO ID "+recordId+": equipe de 2 para 3 funcionários. Não salve.");assert.equal((await pending(page))?.draft?.rdoId,recordId);assert.equal((await pending(page))?.action,"rdo.update.execute");break;
 case 64:await ask(ctx,"Quanto é 2 + 3?");assert.ok(ctx.answer.includes("5"));assert.equal(await pending(page),null);break;
 case 65:await fullDraft(ctx);await ask(ctx,"Quanto é 9 vezes 3?");assert.equal(postCount(ctx),0);assert.equal(canonical(allRdos()),canonical(ctx.before));break;
 case 66:await ask(ctx,"sim");assert.equal(postCount(ctx),0);assert.equal(canonical(allRdos()),canonical(ctx.before));break;
 case 67:await fullDraft(ctx);await ask(ctx,"Cancelar");assert.equal(await pending(page),null);assert.equal(postCount(ctx),0);break;
 case 68:ctx.allowWrites=true;await fullDraft(ctx);ctx.steps.push({type:"double-click-confirmation",confirmationInput:"sim",atUtc:new Date().toISOString()});await page.getByRole("textbox",{name:"Pergunte ao ELO…",exact:true}).fill("sim");await page.getByRole("button",{name:"➤ Enviar",exact:true}).dblclick();await page.waitForFunction(()=>Array.from(document.querySelectorAll(".elo-message-bubble")).some(e=>/RDO criado pelo ELO:/.test(e.textContent)),undefined,{timeout:20000});{const added=allRdos().filter(r=>!ctx.before.some(b=>b.id===r.id));assert.equal(added.length,1);assert.ok(postCount(ctx)<=1);ctx.steps.at(-1).addedIds=added.map(x=>x.id);}break;
 case 69:ctx.allowWrites=true;ctx.faults.push("POST response dropped after real backend commit");await fullDraft(ctx);{let dropped=false;await page.route(api+"/api/obrareport/rdos",async route=>{if(route.request().method()==="POST"&&!dropped){dropped=true;ctx.faultHits++;await route.fetch();return route.abort("failed");}return route.continue();});await ask(ctx,"sim");assert.equal(dropped,true,"Fault injection was not reached");assert.ok(!/RDO criado pelo ELO:/.test(ctx.answer));let added=allRdos().filter(r=>!ctx.before.some(b=>b.id===r.id));assert.equal(added.length,1);await page.unroute(api+"/api/obrareport/rdos");await ask(ctx,"sim");added=allRdos().filter(r=>!ctx.before.some(b=>b.id===r.id));assert.equal(added.length,1);const v=await apiGet(ctx,"/api/obrareport/rdos/"+added[0].id);assert.equal(v.r.status,200);}break;
 case 70:ctx.faults.push("Successful HTTP response without persisted RDO, controlled local fault");await fullDraft(ctx);await page.route(api+"/api/obrareport/rdos",route=>{if(route.request().method()!=="POST")return route.continue();ctx.faultHits++;return route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({ok:true})});});await ask(ctx,"sim");assert.ok(!/RDO criado pelo ELO:/.test(ctx.answer),"Creation asserted without persisted record");assert.equal(canonical(allRdos()),canonical(ctx.before));break;
 case 71:await ask(ctx,"Liste os RDOs da obra "+w.name+".");assert.ok(ctx.answer.includes("RDO QA A"));assert.ok(!ctx.answer.includes("RDO QA B"));break;
 case 72:await ask(ctx,"Liste os RDOs da obra "+w.name+".");assert.ok(ctx.answer.includes("RDO QA B"));assert.ok(!ctx.answer.includes("RDO QA A"));break;
 case 73:await ask(ctx,"Abra o RDO ID "+c.accounts.B.seedRdoIds[0]+".");assert.ok(!ctx.answer.includes("RDO QA B"));{const r=await apiGet(ctx,"/api/obrareport/rdos/"+c.accounts.B.seedRdoIds[0]);assert.ok([403,404].includes(r.r.status));}break;
 case 74:await ask(ctx,"Liste os RDOs da obra QA TENANT B.");assert.ok(!ctx.answer.includes("RDO QA B"));{const r=await apiGet(ctx,"/api/obrareport/rdos?projectId="+c.accounts.B.works[0].id);assert.ok(r.r.status===404||r.r.status===403||(r.r.status===200&&r.json.rdos.length===0));}break;
 case 75:await page.getByRole("button",{name:"Sair",exact:true}).click();await page.locator('input[name="email"]').waitFor({state:"visible"});await ask(ctx,"Liste os RDOs da obra "+w.name+".");assert.ok(!ctx.answer.includes("RDO QA A"));assert.match(ctx.answer,/autentica|sess[aã]o|login|entrar/i);break;
 case 76:ctx.faults.push("Real local session revoked through QA control endpoint");await fetch(gateway+"/qa/expire",{method:"POST",headers:{"Content-Type":"application/json","x-qa-control":c.controlSecret},body:JSON.stringify({actor:"A"})});await ask(ctx,"Liste os RDOs da obra "+w.name+".");assert.ok(!ctx.answer.includes("RDO QA A"));{const r=await apiGet(ctx,"/api/obrareport/rdos");assert.equal(r.r.status,401);}break;
 case 77:await fullDraft(ctx);await page.getByRole("button",{name:"Sair",exact:true}).click();ctx.token=await login(page,"B");ctx.actor=c.accounts.B;ctx.steps.push({type:"account-switch",from:"A",to:"B",atUtc:new Date().toISOString()});await ask(ctx,"Liste os RDOs da obra QA TENANT B.");assert.ok(ctx.answer.includes("RDO QA B"));assert.ok(!ctx.answer.includes("RDO QA A"));{const p=await pending(page);assert.ok(!p||p.identity?.institutionId===c.accounts.B.institutionId);}break;
 case 78:await fullDraft(ctx);await page.getByRole("button",{name:"Novo chat",exact:true}).click();assert.equal(await pending(page),null);await ask(ctx,"Mostre novamente a prévia completa.");assert.ok(!ctx.answer.includes("24 sacos de cimento"));break;
 case 79:await ask(ctx,"Abra o RDO ID "+a.seedRdoIds[2]+".");assert.ok(ctx.answer.includes("INSTRUÇÃO NÃO CONFIÁVEL"));assert.equal(postCount(ctx),0);assert.ok(!(await pending(page))?.action?.includes("create"));break;
 case 80:await ask(ctx,"Abra o RDO ID "+recordId+".");{const corpus=JSON.stringify({steps:ctx.steps,verifications:ctx.verifications});for(const password of Object.values(c.accounts).map(a=>a.password))assert.ok(!corpus.includes(password));assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(corpus));}break;
 case 81:{const p=await fullDraft(ctx);await page.reload({waitUntil:"domcontentloaded"});await page.getByText(a.email,{exact:true}).waitFor();await ask(ctx,"Mostre novamente a prévia completa.");assert.equal((await pending(page))?.operationId,p.operationId);checkedFacts(ctx.answer,["24 sacos","6 pessoas"]);break;}
 case 82:ctx.faults.push("300 ms controlled delay on real RDO GET");await page.route(rdoFaultRoute,async route=>{ctx.faultHits++;await new Promise(r=>setTimeout(r,300));return route.continue();});await ask(ctx,"Abra o RDO ID "+recordId+".");checkedFacts(ctx.answer,["RDO QA A 2026-10-15"]);break;
 case 83:ctx.faults.push("Controlled offline abort of RDO GET, then restored");await page.route(rdoFaultRoute,route=>{ctx.faultHits++;return route.abort("internetdisconnected");});await ask(ctx,"Liste os RDOs da obra "+w.name+".");assert.ok(!ctx.answer.includes("RDO QA A"));await page.unroute(rdoFaultRoute);await ask(ctx,"Liste os RDOs da obra "+w.name+".");assert.ok(ctx.answer.includes("RDO QA A"));break;
 case 84:ctx.faults.push("RDO GET stalled beyond query timeout");await page.route(rdoFaultRoute,async route=>{ctx.faultHits++;await new Promise(r=>setTimeout(r,16000));try{return await route.abort("timedout");}catch{}});await ask(ctx,"Liste os RDOs da obra "+w.name+".");assert.match(ctx.answer,/tempo|timeout|demor|não consegui/i);break;
 case 85:{const other=await ctx.context.newPage();await other.goto(ui+"/elo.html",{waitUntil:"domcontentloaded"});await other.getByText(a.email,{exact:true}).waitFor();await ask(ctx,"Liste os RDOs da obra "+w.name+".");const x={...ctx,page:other,steps:[],requests:[],verifications:[]};await ask(x,"Abra o RDO ID "+recordId+".");assert.ok(ctx.answer.includes("RDO QA A"));assert.ok(x.answer.includes("RDO QA A 2026-10-15"));ctx.steps.push(...x.steps);await other.close();break;}
 case 86:{const input=full(w,"PILOTO_QA_"+runId+"_086");ctx.steps.push({type:"message",input,action:"double-click-preview",atUtc:new Date().toISOString()});await page.getByRole("textbox",{name:"Pergunte ao ELO…",exact:true}).fill(input);await page.getByRole("button",{name:"➤ Enviar",exact:true}).dblclick();await page.getByText(/Ainda não salvei. Deseja confirmar/).last().waitFor();ctx.answer=await page.locator("article.elo-message.assistant .elo-message-bubble").last().innerText();ctx.steps.at(-1).output=ctx.answer;assert.equal(postCount(ctx),0);assert.equal(canonical(allRdos()),canonical(ctx.before));break;}
 case 87:await ask(ctx,"Elo, monta o RDO de 15/10/2026 pra obra "+w.name+". Trabalharam 2 pedreiros e 3 serventes, com 1 encarregado, das 8h às 17h. Fez sol. Fizemos 17 m² de alvenaria. Chegaram 24 sacos de cimento às 10h. Parou das 14h às 14h30 por falta de material. Me mostra tudo antes, sem salvar.");{const d=await data(ctx);assert.equal(d.employeeCount,"6");assert.equal(d.startTime,"08:00");assert.equal(d.materials?.[0]?.quantity,24);assert.equal(d.productions?.[0]?.quantity,17);}break;
 case 88:await page.setViewportSize({width:390,height:844});await fullDraft(ctx);checkedFacts(ctx.answer,["6 pessoas","24 sacos","14:30"]);{const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(width.scroll<=width.client+1,"Horizontal page overflow");}break;
 case 89:await page.setViewportSize({width:1440,height:1000});await fullDraft(ctx);checkedFacts(ctx.answer,[w.name,"6 pessoas","24 sacos","14:30"]);assert.ok(await page.locator(".elo-message.assistant").last().isVisible());break;
 case 90:ctx.faults.push("Controlled incomplete JSON RDO list response");await page.route(rdoFaultRoute,route=>{ctx.faultHits++;return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true})});});await ask(ctx,"Liste os RDOs da obra "+w.name+".");assert.ok(!/não encontrei RDOs|nenhum RDO/i.test(ctx.answer),"Malformed response silently treated as empty list");assert.match(ctx.answer,/erro|inv[aá]lid|não consegui/i);break;
 case 91:await ask(ctx,"Prepare um RDO de 15/10/2026 para a obra "+a.works[2].name+", mas não salve.");assert.equal((await pending(page))?.draft?.projectId,a.works[2].id);break;
 case 92:await ask(ctx,"Abra o RDO ID "+recordId+" com equipe, jornada, clima, serviço, materiais e intercorrências.");{const v=await apiGet(ctx,"/api/obrareport/rdos/"+recordId),d=v.json.rdo.rdo_data_json;checkedFacts(ctx.answer,[d.teamPresent,"08:00–17:00",d.weather,String(d.materials[0].quantity)+" sacos","17 m²"]);}break;
 case 93:await ask(ctx,"Liste os RDOs da obra "+w.name+".");{const buttons=page.getByRole("button",{name:/Abrir RDO/});assert.ok(await buttons.count()>0,"List has no selectable RDO detail action");await buttons.first().click();await page.getByText(/EQUIPE:/).last().waitFor();}break;
 case 94:await fullDraft(ctx);checkedFacts(ctx.answer,[w.name,"15/10/2026","6 pessoas","17 m²","24 sacos","14:30"]);break;
 case 95:await fullDraft(ctx);{const d=await data(ctx);assert.equal(d.employeeCount,"6");assert.equal(d.teamPresent,"1 encarregado, 2 pedreiros e 3 serventes");assert.equal(d.startTime,"08:00");assert.equal(d.endTime,"17:00");assert.equal(d.weather,"sol");assert.equal(d.productions[0].quantity,17);assert.equal(d.materials[0].quantity,24);}break;
 case 96:await fullDraft(ctx);assert.ok(!/PROJECT ID|operationId|rdo_data_json|\{\s*"/.test(ctx.answer));checkedFacts(ctx.answer,["OBRA:","DATA:","EQUIPE:","MATERIAIS:"]);break;
 case 97:{await fullDraft(ctx);const before=await data(ctx);await ask(ctx,"Corrija nesse mesmo RDO: chegaram 22 sacos de cimento, não 24. Não altere os demais dados.");const after=await data(ctx),expected=structuredClone(before);expected.materials[0].quantity=22;assert.equal(canonical(after),canonical(expected));break;}
 case 98:await fullDraft(ctx);await ask(ctx,"Corrija nesse mesmo RDO: chegaram 22 sacos de cimento, não 24. Não altere os demais dados.");{const previous=ctx.answer;await ask(ctx,"Mostre a prévia completa desse mesmo RDO.");assert.equal(ctx.answer,previous);assert.equal(postCount(ctx),0);}break;
 case 99:await fullDraft(ctx);await ask(ctx,"Quais campos foram preenchidos?");assert.equal(postCount(ctx),0);assert.equal(canonical(allRdos()),canonical(ctx.before));break;
 case 100:ctx.allowWrites=true;await fullDraft(ctx);await ask(ctx,"Corrija nesse mesmo RDO: chegaram 22 sacos de cimento, não 24. Não altere os demais dados.");assert.equal(postCount(ctx),0);await ask(ctx,"sim");{const added=allRdos().filter(r=>!ctx.before.some(b=>b.id===r.id));assert.equal(added.length,1);const record=added[0],v=await apiGet(ctx,"/api/obrareport/rdos/"+record.id);assert.equal(v.r.status,200);assert.equal(v.json.rdo.rdo_data_json.materials[0].quantity,22);assert.equal(v.json.rdo.rdo_data_json.employeeCount,"6");assert.equal(v.json.rdo.project_id,w.id);await ask(ctx,"Liste os RDOs da obra "+w.name+".");assert.ok(ctx.answer.includes(record.title));const history=await apiGet(ctx,"/api/obrareport/rdos?projectId="+w.id);assert.ok(history.json.rdos.some(r=>r.id===record.id));ctx.createdRdoId=record.id;}break;
 default:throw Error("Scenario handler missing");
 }
}
let browser;
try{
 const health=await fetch(api+"/api/health");assert.equal(health.status,200);
 browser=await chromium.launch({headless:true,executablePath:installedChromium(chromium)});
 const commit=execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
 const dirtySource=Boolean(execFileSync("git",["diff","--name-only","HEAD","--","relatorio-qualidade-obras/elo-command-bridge.js","relatorio-qualidade-obras/elo-assistente.js","scripts/qa"],{cwd:root,encoding:"utf8"}).trim());
 const sourceSha256=createHash("sha256").update(fs.readFileSync(path.join(root,"relatorio-qualidade-obras/elo-command-bridge.js"))).digest("hex");
 for(let n=1;n<=100;n++){
  if(numbers&&!numbers.has(n))continue;
  const meta=catalog[n-1],started=Date.now(),number=String(n).padStart(3,"0");
  const context=await browser.newContext({serviceWorkers:"block",timezoneId:"America/Bahia",viewport:{width:1280,height:900}});
  const ctx={number:n,context,page:await context.newPage(),actor:c.accounts[n===72?"B":"A"],steps:[],requests:[],verifications:[],faults:[],faultHits:0,allowWrites:false,before:allRdos()};
  let externalBlocked=0;
  await context.route("**/*",route=>{const u=new URL(route.request().url());if(!["localhost","127.0.0.1"].includes(u.hostname)){externalBlocked++;return route.abort();}return route.continue();});
  ctx.page.on("request",request=>{const u=new URL(request.url());if(u.origin===api&&u.pathname.startsWith("/api/"))ctx.requests.push({method:request.method(),path:u.pathname,query:u.search,atUtc:new Date().toISOString(),body:request.method()==="GET"?undefined:safe(request.postData()||"")});});
  ctx.page.on("response",response=>{const u=new URL(response.url());if(u.origin===api){const row=[...ctx.requests].reverse().find(r=>r.path===u.pathname&&!r.status);if(row)row.status=response.status();}});
  let status="PASS",error=null;
  try{
   await ctx.page.clock.install({time:new Date("2026-10-16T01:16:37.640Z")});
   ctx.token=await login(ctx.page,n===72?"B":"A");
   ctx.steps.push({type:"login",actor:n===72?"B":"A",email:ctx.actor.email,status:"authenticated",atUtc:new Date().toISOString()});
   await ctx.page.getByRole("button",{name:"Novo chat",exact:true}).click();
   await scenario(n,ctx);
   if([69,70,82,83,84,90].includes(n))assert.ok(ctx.faultHits>0,"Controlled fault injection did not intercept a request");
   if(!ctx.allowWrites){assert.equal(canonical(allRdos()),canonical(ctx.before),"Unexpected RDO write before confirmation");assert.equal(postCount(ctx),n===70?1:0,"Unexpected create request before explicit authorized confirmation");}
  }catch(e){status="FAIL";error=safe(e.message);}
  const after=allRdos(),added=after.filter(r=>!ctx.before.some(b=>b.id===r.id));
  const row={...meta,status,executed:true,type:"LOCAL_INTEGRATION_REAL_POSTGRES_LOCAL_AUTH_ADAPTER",cloudE2eExecuted:false,cloudStatus:"BLOCKED_NO_ISOLATED_SUPABASE_ENV",environment:ui,commit,sourceSha256,dirtySource,actor:n===72?"B":"A",startedAt:new Date(started).toISOString(),completedAt:new Date().toISOString(),durationMs:Date.now()-started,steps:ctx.steps,backendCalls:ctx.requests,backendVerification:ctx.verifications,faultInjection:ctx.faults,faultHits:ctx.faultHits,observed:error||ctx.answer||"Specific functional assertions passed",input:ctx.steps.filter(x=>x.input||x.confirmationInput).map(x=>x.input||x.confirmationInput).join("\n→ ")||"Login autenticado "+ctx.actor.email,rdosBefore:ctx.before.length,rdosAfter:after.length,addedIds:added.map(r=>r.id),changedIds:after.filter(r=>ctx.before.some(b=>b.id===r.id&&canonical(b)!==canonical(r))).map(r=>r.id),removedIds:ctx.before.filter(b=>!after.some(r=>r.id===b.id)).map(b=>b.id),postCount:postCount(ctx),allowedStagingWrites:ctx.allowWrites,productionWrites:0,externalRequestsBlocked:externalBlocked,error,evidence:"runs/"+runId+"/"+number+".json",databaseSnapshots:{before:"runs/"+runId+"/"+number+"-before-rdos.json",after:"runs/"+runId+"/"+number+"-after-rdos.json"}};
  fs.writeFileSync(path.join(runDir,number+"-before-rdos.json"),JSON.stringify(ctx.before,null,2));
  fs.writeFileSync(path.join(runDir,number+"-after-rdos.json"),JSON.stringify(after,null,2));
  fs.writeFileSync(path.join(runDir,number+".json"),JSON.stringify(row,null,2));
  if(status==="FAIL"||[1,40,55,68,69,70,88,89,92,94,97,100].includes(n)){
   try{await ctx.page.screenshot({path:path.join(runDir,number+".png"),fullPage:true,mask:[ctx.page.locator('input[type="password"]')]});row.screenshot="runs/"+runId+"/"+number+".png";if(await ctx.page.locator("article.elo-message.assistant .elo-message-bubble").count()){await ctx.page.locator("article.elo-message.assistant .elo-message-bubble").last().screenshot({path:path.join(runDir,number+"-detail.png")});row.detailScreenshot="runs/"+runId+"/"+number+"-detail.png";}fs.writeFileSync(path.join(runDir,number+".json"),JSON.stringify(row,null,2));}catch{}
  }
  results.push(row);await context.close();fs.writeFileSync(path.join(runDir,"results.json"),JSON.stringify(results,null,2));
  console.log(JSON.stringify({id:meta.id,status,durationMs:row.durationMs,reason:error?.slice(0,260),rdosAdded:added.length}));
 }
 const summary={runId,commit,sourceSha256,classification:"LOCAL_INTEGRATION_NOT_SUPABASE_CLOUD",executed:results.length,pass:results.filter(r=>r.status==="PASS").length,fail:results.filter(r=>r.status==="FAIL").length,cloudE2eExecuted:0,commercialGate:"PARTIAL",productionWrites:0,resultsDir:runDir};
 fs.writeFileSync(path.join(runDir,"summary.json"),JSON.stringify(summary,null,2));fs.writeFileSync(path.join(qaDir,"latest-local-run.json"),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 if(summary.fail)process.exitCode=1;
}catch(e){console.error(safe(e.stack||e.message));process.exitCode=1;}finally{await browser?.close();}
