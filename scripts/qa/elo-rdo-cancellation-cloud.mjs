// Focused cancellation QA only. No seed, schema migration or RDO mutation is permitted.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import {execFileSync} from "node:child_process";
import {config,root,privateDir,projectRef} from "./elo-rdo-cloud-db.mjs";
import {installedChromium} from "./elo-rdo-local-browser.mjs";
const c=config(),out=path.join(root,"qa-artifacts/elo-rdo-cancel-hotfix-20261016",process.env.ELO_CANCEL_RUN_ID||"cloud-focused");
if(fs.existsSync(out))throw Error("Refusing to overwrite evidence run");
fs.mkdirSync(out,{recursive:true});
const backend=15504,frontend=15505,api="http://127.0.0.1:"+backend,ui="http://127.0.0.1:"+frontend;
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{const u=new URL(String(input?.url||input));if(!["127.0.0.1","localhost",projectRef+".supabase.co"].includes(u.hostname))throw Error("QA_EXTERNAL_HOST_BLOCKED");return nativeFetch(input,init);};
const secretValues=[c.anonKey,c.serviceRoleKey,...Object.values(c.accounts).map(a=>a.password)];
const safe=s=>secretValues.reduce((v,x)=>v.replaceAll(x,"[redacted]"),String(s)).replace(/eyJ[A-Za-z0-9_.-]+/g,"[jwt-redacted]");
const canonical=v=>JSON.stringify(v&&typeof v==="object"?(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))]))):v);
async function rows(){const r=await fetch(c.url+"/rest/v1/obrareport_rdos?select=*&order=id",{headers:{apikey:c.serviceRoleKey,Authorization:"Bearer "+c.serviceRoleKey}});assert.equal(r.status,200);return r.json();}
const mutationRequests=[],apiRequests=[],results=[],servers=[];
const sha=execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
const sourceHashes=Object.fromEntries(["elo-assistente.js","elo-command-bridge.js"].map(f=>[f,createHash("sha256").update(fs.readFileSync(path.join(root,"relatorio-qualidade-obras",f))).digest("hex")]));
let browser;
async function start(){
 const marker=await fetch(c.url+"/rest/v1/qa_environment?select=project_ref",{headers:{apikey:c.serviceRoleKey,Authorization:"Bearer "+c.serviceRoleKey}}).then(r=>r.json());assert.equal(marker[0]?.project_ref,projectRef);
 const {createApp}=await import(pathToFileURL(path.join(root,"backend/src/app.js")).href);
 const app=createApp({env:{NODE_ENV:"test",SUPABASE_URL:c.url,SUPABASE_ANON_KEY:c.anonKey,SUPABASE_SERVICE_ROLE_KEY:c.serviceRoleKey,ELO_RDO_STORE:"supabase",ELO_TELEMETRY_ENABLED:"false",ELO_CORE_STORE_PATH:path.join(privateDir,"cancel-elo-core.json"),ELO_VECTOR_MEMORY_PATH:path.join(privateDir,"cancel-vector-memory.json")},enableEloTelemetryRetention:false});
 const s=http.createServer((req,res)=>{
  if(req.url.startsWith("/api/obrareport/rdos")){
   const event={atUtc:new Date().toISOString(),method:req.method,path:req.url};apiRequests.push(event);
   res.on("finish",()=>event.status=res.statusCode);
   if(!["GET","HEAD","OPTIONS"].includes(req.method)){mutationRequests.push(event);res.writeHead(403,{"Content-Type":"application/json"});res.end('{"ok":false,"error":"qa_rdo_writes_prohibited"}');return;}
  }app(req,res);
 });await new Promise((resolve,reject)=>{s.once("error",reject);s.listen(backend,"127.0.0.1",resolve);});servers.push(s);
 const publicConfig={ELO_API_BASE_URL:api,OBRAREPORT_API_BASE_URL:api,ELO_SUPABASE_URL:c.url,ELO_SUPABASE_ANON_KEY:c.anonKey};
 const injection="<script>"+Object.entries(publicConfig).map(([k,v])=>"window."+k+"="+JSON.stringify(v)+";").join("")+"</script>";
 const f=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,ui).pathname);if(pathname.split("/").some(s=>s.startsWith(".")||["node_modules","qa-artifacts","backend"].includes(s))){res.writeHead(403);return res.end();}
  const file=path.resolve(root,"."+pathname+(pathname.endsWith("/")?"index.html":""));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{let b=fs.readFileSync(file);if(file.endsWith(".html"))b=Buffer.from(b.toString("utf8").replace("<head>","<head>"+injection));res.setHeader("Content-Type",file.endsWith(".js")?"text/javascript; charset=utf-8":file.endsWith(".html")?"text/html; charset=utf-8":file.endsWith(".css")?"text/css":"application/octet-stream");res.setHeader("Cache-Control","no-store");res.end(b);}catch{res.writeHead(404);res.end();}
 });await new Promise((resolve,reject)=>{f.once("error",reject);f.listen(frontend,"127.0.0.1",resolve);});servers.push(f);
}
const pending=p=>p.evaluate(()=>window.EloActionBusRdo.readPending());
async function login(actor){
 const context=await browser.newContext({serviceWorkers:"block",timezoneId:"America/Bahia",viewport:{width:1280,height:900}});
 await context.route("**/*",route=>{const u=new URL(route.request().url());return ["127.0.0.1","localhost",projectRef+".supabase.co"].includes(u.hostname)?route.continue():route.abort();});
 const page=await context.newPage(),a=c.accounts[actor];await page.goto(ui+"/elo.html",{waitUntil:"domcontentloaded"});await page.locator('input[name="email"]').fill(a.email);await page.locator('input[name="password"]').fill(a.password);const authResponse=page.waitForResponse(r=>r.url().startsWith(c.url+"/auth/v1/token")&&r.request().method()==="POST");await page.getByRole("button",{name:"Entrar",exact:true}).click();const r=await authResponse;assert.equal(r.status(),200);const auth=await r.json();await page.getByText(a.email,{exact:true}).waitFor();return {context,page,actor,a,token:auth.access_token,steps:[]};
}
async function ask(ctx,input){
 const n=await ctx.page.locator("article.elo-message.assistant").count();await ctx.page.getByRole("textbox",{name:"Pergunte ao ELO…"}).fill(input);await ctx.page.getByRole("button",{name:"➤ Enviar",exact:true}).click();
 await ctx.page.waitForFunction(n=>{const a=document.querySelectorAll("article.elo-message.assistant .elo-message-bubble");return a.length>n&&a[a.length-1].textContent.trim()!=="Estou pensando";},n,{timeout:45000});
 const output=await ctx.page.locator("article.elo-message.assistant .elo-message-bubble").last().innerText();ctx.steps.push({input,output:safe(output)});return output;
}
async function preview(ctx,missing=false){
 await ctx.page.getByRole("button",{name:"Novo chat",exact:true}).click();const name=ctx.a.works[0].name;
 const input="Prepare um RDO "+(missing?"":"de 16/10/2026 ")+"para a obra "+name+". Equipe: 1 encarregado, 2 pedreiros e 3 serventes. Jornada: das 08h às 17h. Clima: sol. Serviço: 17 m² de alvenaria. Material recebido: 24 sacos de cimento às 10h. Intercorrência: parada parcial das 14h às 14h30 por falta de material. Não salve.";
 await ask(ctx,input);const p=await pending(ctx.page);assert.ok(p);assert.equal(p.status,missing?"awaiting_work":"pending");return p;
}
async function run(id,ctx,fn){const before=await rows(),stepStart=ctx.steps.length,reqStart=apiRequests.length;let status="PASS",error;try{await fn();assert.equal(mutationRequests.length,0);}catch(e){status="FAIL";error=safe(e.message);}
 const after=await rows();if(canonical(before)!==canonical(after)){status="FAIL";error="QA RDO rows changed";}
 const result={id,status,error,actor:ctx.actor,steps:ctx.steps.slice(stepStart),backendRequests:apiRequests.slice(reqStart),beforeCount:before.length,afterCount:after.length,fullRowsUnchanged:canonical(before)===canonical(after),CREATE_COUNT:after.filter(r=>!before.some(b=>b.id===r.id)).length,WRITE_COUNT:apiRequests.slice(reqStart).filter(r=>!["GET","HEAD","OPTIONS"].includes(r.method)).length,classification:"AUTHENTICATED_REAL_SUPABASE_QA_LOOPBACK_APP"};
 fs.writeFileSync(path.join(out,id+".json"),JSON.stringify(result,null,2));if(status==="FAIL"||["C001","C025","C026","C027","C028"].includes(id))await ctx.page.screenshot({path:path.join(out,id+".png"),fullPage:true,mask:[ctx.page.locator('input[type="password"]')]});
 results.push(result);console.log(JSON.stringify({id,status,error}));if(status==="FAIL")throw Error(id+": "+error);
}
try{
 await start();const before=await rows();fs.writeFileSync(path.join(out,"rdos-before.json"),JSON.stringify(before,null,2));
 const require=createRequire(path.join(root,"backend/package.json"));const {chromium}=require("playwright");browser=await chromium.launch({headless:true,executablePath:installedChromium(chromium)});
 const a=await login("A");const variants=[
 "Cancele a prévia. Não salve nem crie nenhum RDO.","Cancele a prévia","Elo, cancele a prévia, por favor.","Por favor, cancele o rascunho.","Cancela essa prévia.","Cancelar a prévia.","Pode cancelar a prévia.","Quero cancelar esta operação.","Aborte a preparação do RDO.","Descarte a prévia do RDO.","Interrompa a preparação do RDO.","Cancele a prévia! Não execute.","Corrija o clima para chuva e cancele a prévia.","Não salve ainda; cancele a prévia.","Mostre o resumo. Cancele a prévia.","Cancele a prévia e não crie nada.","cansela a previa","cancelle a prévia","canceela a previa","Cancele a prévia, sem salvar e sem atualizar o RDO.","cancela isso"];
 for(let i=0;i<variants.length;i++)await run("C"+String(i+1).padStart(3,"0"),a,async()=>{await preview(a,i===1);const text=await ask(a,variants[i]);assert.match(text,/cancelad/i);assert.equal(await pending(a.page),null);await ask(a,"sim");assert.equal(await pending(a.page),null);});
 await run("C022",a,async()=>{await preview(a);const p=await pending(a.page);await ask(a,"Não salve ainda.");assert.equal(canonical(await pending(a.page)),canonical(p));await ask(a,"Posso cancelar?");assert.equal(canonical(await pending(a.page)),canonical(p));await ask(a,"Como cancelo a prévia?");assert.equal(canonical(await pending(a.page)),canonical(p));await ask(a,variants[0]);assert.equal(await pending(a.page),null);});
 await run("C023",a,async()=>{await preview(a);await ask(a,"Corrija apenas o material recebido de 24 para 22 sacos de cimento. Preserve os demais campos e não salve.");assert.equal((await pending(a.page)).draft.rdoData.materials[0].quantity,22);await ask(a,variants[0]);assert.equal(await pending(a.page),null);await ask(a,variants[0]);assert.equal(await pending(a.page),null);});
 await run("C024",a,async()=>{await preview(a);const p=await pending(a.page);await ask(a,"Quanto é 2 + 2?");assert.equal(canonical(await pending(a.page)),canonical(p));await ask(a,variants[0]);});
 await run("C025",a,async()=>{await preview(a);const result=await a.page.evaluate(async()=>Promise.all(Array.from({length:12},()=>window.EloActionBusRdo.execute({action:"rdo_cancel",payload:{message:"Cancele a prévia"}}))));assert.equal(result.filter(x=>x.mode==="cancel").length,1);assert.equal(await pending(a.page),null);});
 await run("C026",a,async()=>{await preview(a);let release,entered;const gate=new Promise(r=>release=r),entry=new Promise(r=>entered=r);const fn=async route=>{entered();await gate;await route.continue();};await a.page.route(api+"/api/stock-full/works**",fn);const request=a.page.evaluate(()=>{const p=window.EloActionBusRdo.readPending();return window.EloActionBusRdo.execute({action:"rdo.create.revise",payload:{message:"Troque a obra para QA CONSTRUÇÃO ÁGUA.",rdoPreviewContinuation:{field:"operational",operationId:p.operationId,createdAt:p.createdAt,operationToken:p.operationToken}}});});await entry;await ask(a,variants[0]);release();assert.equal((await request).ok,false);await a.page.unroute(api+"/api/stock-full/works**",fn);assert.equal(await pending(a.page),null);});
 await run("C027",a,async()=>{await preview(a);const response=await a.page.evaluate(async()=>{const original=window.EloCanonicalSession.getSession.bind(window.EloCanonicalSession);let release;const gate=new Promise(r=>release=r);window.EloCanonicalSession.getSession=async()=>{await gate;return original();};const current=window.EloActionBusRdo.readPending();const req=window.EloActionBusRdo.execute({action:"rdo_cancel",payload:{message:"Cancele a prévia"}});const replacement={...current,operationToken:current.operationToken+":replacement"};localStorage.setItem("elo_action_bus_rdo_pending_v1",JSON.stringify(replacement));release();const response=await req;window.EloCanonicalSession.getSession=original;return {ok:response.ok,expected:replacement,actual:window.EloActionBusRdo.readPending()};});assert.equal(response.ok,false);assert.equal(canonical(response.actual),canonical(response.expected));await ask(a,variants[0]);});
 const b=await login("B");
 await run("C028",b,async()=>{await preview(a);const p=await pending(a.page);await preview(b);await ask(b,variants[0]);assert.equal(await pending(b.page),null);assert.equal(canonical(await pending(a.page)),canonical(p));for(const [own,foreign]of[[a,b],[b,a]]){const r=await fetch(api+"/api/obrareport/rdos/"+foreign.a.seedRdoIds[0],{headers:{Authorization:"Bearer "+own.token}});assert.ok([403,404].includes(r.status));}await ask(a,variants[0]);assert.equal(await pending(a.page),null);});
 await run("C029",a,async()=>{const r=await fetch(api+"/api/obrareport/rdos/"+a.a.seedRdoIds[0],{headers:{Authorization:"Bearer "+a.token}});assert.equal(r.status,200);const original=await r.json();await ask(a,"Atualize o RDO ID "+a.a.seedRdoIds[0]+". Inclua a observação: CANCEL_QA_UNSAVED.");assert.equal((await pending(a.page)).action,"rdo.update.execute");await ask(a,variants[0]);assert.equal(await pending(a.page),null);const after=await fetch(api+"/api/obrareport/rdos/"+a.a.seedRdoIds[0],{headers:{Authorization:"Bearer "+a.token}}).then(r=>r.json());assert.equal(canonical(after),canonical(original));});

 await run("C030",a,async()=>{
  await preview(a);const first=await pending(a.page);const otherPage=await a.context.newPage();await otherPage.goto(ui+"/elo.html",{waitUntil:"domcontentloaded"});await otherPage.getByText(a.a.email,{exact:true}).waitFor();
  const other={...a,page:otherPage,steps:a.steps};await preview(other);const replacement=await pending(otherPage);assert.notEqual(first.conversationToken,replacement.conversationToken);
  const out=await ask(a,variants[0]);assert.doesNotMatch(out,/foi cancelada/);assert.equal(canonical(await pending(otherPage)),canonical(replacement));
  const info=await ask(a,"Posso cancelar?");assert.ok(!info.includes("EQUIPE:"));await a.page.getByRole("button",{name:"Novo chat",exact:true}).click();assert.equal(canonical(await pending(otherPage)),canonical(replacement));
  a.steps.push({check:"same_account_other_conversation",differentConversationTokens:true,otherPendingPreservedAfterOldCancel:true,otherPendingPreservedAfterNewChat:true});
  await ask(other,variants[0]);assert.equal(await pending(otherPage),null);await otherPage.close();
 });
 await run("C031",a,async()=>{await preview(a);const p=await pending(a.page);await a.page.reload({waitUntil:"domcontentloaded"});await a.page.getByText(a.a.email,{exact:true}).waitFor();assert.equal((await pending(a.page)).conversationToken,p.conversationToken);await ask(a,variants[0]);assert.equal(await pending(a.page),null);});
 const after=await rows();fs.writeFileSync(path.join(out,"rdos-after.json"),JSON.stringify(after,null,2));assert.equal(canonical(before),canonical(after));assert.equal(mutationRequests.length,0);
 const summary={atUtc:new Date().toISOString(),commit:sha,sourceHashes,projectRef,classification:"AUTHENTICATED_REAL_SUPABASE_QA_LOOPBACK_APP",executed:results.length,pass:results.filter(r=>r.status==="PASS").length,fail:results.filter(r=>r.status==="FAIL").length,CREATE_COUNT:0,WRITE_COUNT:mutationRequests.length,backendCreateRequestCount:mutationRequests.filter(r=>r.method==="POST").length,beforeCount:before.length,afterCount:after.length,fullRowsUnchanged:true,results,productionWriteCount:0,liveProductionTest:false};
 fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(summary,null,2));console.log(JSON.stringify({executed:summary.executed,pass:summary.pass,fail:summary.fail,CREATE_COUNT:0,WRITE_COUNT:summary.WRITE_COUNT,history:before.length+"→"+after.length}));
}catch(e){fs.writeFileSync(path.join(out,"failure.json"),JSON.stringify({atUtc:new Date().toISOString(),error:safe(e.stack),results,mutationRequests},null,2));console.error(safe(e.stack));process.exitCode=1;}
finally{await browser?.close();for(const s of servers)await new Promise(resolve=>s.close(resolve));}
