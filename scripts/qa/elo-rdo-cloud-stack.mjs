// Official app and vendor Supabase cloud. No auth/REST emulation.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import {pathToFileURL} from 'node:url';import {config,root,privateDir,qaDir,ports,projectRef} from './elo-rdo-cloud-db.mjs';
const c=config(),origin=c.url,servers=[];
async function startBackend(){
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=(input,init)=>{const url=new URL(String(input?.url||input));if(!["127.0.0.1","localhost",projectRef+".supabase.co"].includes(url.hostname))return Promise.reject(Error("QA_EXTERNAL_NETWORK_BLOCKED"));return nativeFetch(input,init);};
 const {createApp}=await import(pathToFileURL(path.join(root,"backend/src/app.js")).href);
 const env={NODE_ENV:"test",SUPABASE_URL:origin,SUPABASE_ANON_KEY:c.anonKey,SUPABASE_SERVICE_ROLE_KEY:c.serviceRoleKey,ELO_RDO_STORE:"supabase",ELO_TELEMETRY_ENABLED:"false",ELO_CORE_STORE_PATH:path.join(privateDir,"elo-core.json"),ELO_VECTOR_MEMORY_PATH:path.join(privateDir,"vector-memory.json")};
 const app=createApp({env,enableEloTelemetryRetention:false});
 const server=await new Promise(resolve=>{const s=app.listen(ports.backend,"127.0.0.1",()=>resolve(s));});servers.push(server);
 return env;
}
async function startFrontend(env){
 const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon"};
 const cfg={ELO_API_BASE_URL:"http://127.0.0.1:"+ports.backend,OBRAREPORT_API_BASE_URL:"http://127.0.0.1:"+ports.backend,ELO_SUPABASE_URL:origin,ELO_SUPABASE_ANON_KEY:env.SUPABASE_ANON_KEY};
 const script="<script>"+Object.entries(cfg).map(([k,v])=>"window."+k+"="+JSON.stringify(v)+";").join("")+"</script>";
 const server=http.createServer(async (req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname),segments=pathname.split("/");
  if(segments.some(s=>s.startsWith(".")||s==="node_modules"||s==="qa-artifacts"||s==="backend")){res.writeHead(403);return res.end();}
  const file=path.resolve(root,"."+pathname+(pathname.endsWith("/")?"index.html":""));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{let bytes=fs.readFileSync(file);if(path.extname(file)===".html")bytes=Buffer.from(bytes.toString("utf8").replace("<head>","<head>"+script));res.setHeader("Cache-Control","no-store");res.setHeader("Content-Type",mime[path.extname(file)]||"application/octet-stream");res.end(bytes);}
  catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(ports.frontend,"127.0.0.1",resolve));servers.push(server);
}

const marker=await fetch(origin+'/rest/v1/qa_environment?select=project_ref',{headers:{apikey:c.serviceRoleKey,Authorization:'Bearer '+c.serviceRoleKey}}).then(r=>r.json());if(marker?.[0]?.project_ref!==projectRef)throw Error('QA target marker absent');const env=await startBackend();await startFrontend(env);const info={ready:true,projectRef,classification:'AUTHENTICATED_E2E_REAL_SUPABASE_CLOUD_LOOPBACK_APP',realGoTrue:true,realPostgREST:true,officialBackend:true,frontendPort:ports.frontend,backendPort:ports.backend,productionWrites:0};fs.writeFileSync(path.join(qaDir,'cloud-stack-context.json'),JSON.stringify(info,null,2));console.log(JSON.stringify(info));
