import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {config,ports,qaDir,query,root} from "./elo-rdo-local-db.mjs";
import {installedChromium} from "./elo-rdo-local-browser.mjs";
const require=createRequire(path.join(root,"package.json"));
const {chromium}=require("@playwright/test");
const c=config(),api="http://127.0.0.1:"+ports.backend,gateway="http://127.0.0.1:"+ports.gateway,ui="http://127.0.0.1:"+ports.frontend;
const sanitize=s=>Object.values(c.accounts).reduce((v,a)=>v.replaceAll(a.password,"[redacted]"),String(s)).replace(/eyJ[A-Za-z0-9_.-]+/g,"[jwt-redacted]");
let browser;
try{
 const login=await fetch(gateway+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:c.accounts.A.email,password:c.accounts.A.password})});
 assert.equal(login.status,200);const auth=await login.json();
 const checks=[];
 for(const endpoint of ["/api/health","/api/stock-full/me","/api/stock-full/works","/api/obrareport/rdos"]){
  const r=await fetch(api+endpoint,{headers:{Authorization:"Bearer "+auth.access_token}});const body=await r.json();
  checks.push({endpoint,status:r.status,ok:body.ok,recordCount:body.rdos?.length,workCount:body.works?.length});assert.equal(r.status,200);
 }
 const exe=installedChromium(chromium);
 assert.ok(fs.existsSync(exe),"Installed Chromium unavailable");
 browser=await chromium.launch({headless:true,executablePath:exe});
 const context=await browser.newContext({timezoneId:"America/Bahia",viewport:{width:1280,height:900}});
 await context.route("**/*",route=>{const host=new URL(route.request().url()).hostname;return ["127.0.0.1","localhost"].includes(host)?route.continue():route.abort();});
 const page=await context.newPage();await page.goto(ui+"/elo.html",{waitUntil:"domcontentloaded"});
 await page.locator('input[name="email"]').fill(c.accounts.A.email);await page.locator('input[name="password"]').fill(c.accounts.A.password);
 await page.getByRole("button",{name:"Entrar",exact:true}).click();await page.getByText(c.accounts.A.email,{exact:true}).waitFor({timeout:30000});
 await page.getByRole("button",{name:"Novo chat",exact:true}).click();
 const command="Prepare um RDO de 15/10/2026 para a obra QA CONSTRUÇÃO ÁGUA. Equipe: 1 encarregado, 2 pedreiros e 3 serventes. Horário: das 8h às 17h. Clima: sol. Serviço: 17 m² de alvenaria. Material recebido: 24 sacos de cimento às 10h. Não salve.";
 await page.getByRole("textbox",{name:"Pergunte ao ELO…",exact:true}).fill(command);await page.getByRole("button",{name:"➤ Enviar",exact:true}).click();
 await page.getByText(/Ainda não salvei. Deseja confirmar/).waitFor({timeout:30000});
 const preview=await page.locator("article.elo-message.assistant .elo-message-bubble").last().innerText();
 for(const fact of ["QA CONSTRUÇÃO ÁGUA","15/10/2026","6 pessoas","24 sacos"])assert.ok(preview.includes(fact),fact);
 fs.mkdirSync(path.join(qaDir,"evidence"),{recursive:true});await page.screenshot({path:path.join(qaDir,"evidence","local-preflight-preview.png"),fullPage:true,mask:[page.locator('input[type="password"]')]});
 await page.getByRole("textbox",{name:"Pergunte ao ELO…",exact:true}).fill("não");await page.getByRole("button",{name:"➤ Enviar",exact:true}).click();await page.getByText(/A ação de RDO foi cancelada/).waitFor();
 const result={classification:"LOCAL_INTEGRATION_NOT_SUPABASE_CLOUD",checks,authenticatedUi:true,preview,rdosAfter:query("select id from obrareport_rdos").length,externalNetworkBlocked:true,productionWrites:0};
 fs.writeFileSync(path.join(qaDir,"local-preflight.json"),JSON.stringify(result,null,2));console.log(JSON.stringify({preflight:"PASS",checks,authenticatedUi:true,rdos:result.rdosAfter,productionWrites:0}));
}catch(e){console.error(sanitize(e.stack||e.message));process.exitCode=1;}finally{await browser?.close();}

