// Isolated QA infrastructure. Real local PostgreSQL and password/JWT authentication.
// This implements a limited local protocol adapter, not a Supabase cloud installation.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {createRequire} from "node:module";
import {createHmac,randomBytes,randomUUID,timingSafeEqual,scryptSync,createHash} from "node:crypto";
import {fileURLToPath,pathToFileURL} from "node:url";
import {config,initialize,insert,query,sql,literal,ident,root,privateDir,qaDir,ports} from "./elo-rdo-local-db.mjs";
const require=createRequire(path.join(root,"backend/package.json"));
const express=require("express");
const origin="http://127.0.0.1:"+ports.gateway;
let c;
const servers=[];
const digest=v=>createHash("sha256").update(v).digest("hex");
const encode=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(payload){const body=encode({alg:"HS256",typ:"JWT"})+"."+encode({iss:origin+"/auth/v1",iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+365*86400,...payload});return body+"."+createHmac("sha256",c.jwtSecret).update(body).digest("base64url");}
function decode(token){
 try{const [h,p,s]=String(token||"").split(".");const header=JSON.parse(Buffer.from(h,"base64url"));if(header.alg!=="HS256")return null;
 const a=Buffer.from(s||"","base64url"),b=createHmac("sha256",c.jwtSecret).update(h+"."+p).digest();if(a.length!==b.length||!timingSafeEqual(a,b))return null;
 const payload=JSON.parse(Buffer.from(p,"base64url"));if(payload.iss!==origin+"/auth/v1"||payload.exp<=Date.now()/1000)return null;return payload;}catch{return null;}
}
function actor(req){
 const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");const p=decode(token);
 if(!p)return null;
 if(p.role==="service_role")return {service:true};
 if(p.role!=="authenticated"||!p.sub||!p.jti)return null;
 const sessions=query("select jti from qa_auth_sessions where jti="+literal(p.jti)+" and user_id="+literal(p.sub)+" and not revoked and expires_at>now()");
 if(!sessions.length)return null;
 const user=query("select id,email,created_at from auth.users where id="+literal(p.sub))[0];
 return user?{user,payload:p}:null;
}
const publicUser=u=>({id:u.id,email:u.email,aud:"authenticated",role:"authenticated",created_at:u.created_at,app_metadata:{provider:"email",providers:["email"]},user_metadata:{environment:"local-qa"},identities:[]});
function session(user,existing=null){
 const jti=randomUUID(),refresh=randomBytes(32).toString("base64url"),expiresIn=365*86400;
 insert("qa_auth_sessions",{jti,user_id:user.id,refresh_hash:digest(refresh),expires_at:new Date(Date.now()+expiresIn*1000).toISOString(),revoked:false});
 if(existing)sql("update qa_auth_sessions set revoked=true where jti="+literal(existing.jti)+";");
 return {access_token:sign({sub:user.id,email:user.email,role:"authenticated",aud:"authenticated",jti}),token_type:"bearer",expires_in:expiresIn,expires_at:Math.floor(Date.now()/1000)+expiresIn,refresh_token:refresh,user:publicUser(user)};
}
function jsonResponse(res,rows,status=200,single=false){if(single){if(rows.length!==1)return res.status(406).json({code:"PGRST116",message:"JSON object requested, multiple (or no) rows returned",details:"The result contains "+rows.length+" rows"});return res.status(status).json(rows[0]);}return res.status(status).json(rows);}
const tables=new Set(["profiles","companies","institutions","units","obrareport_clients","obrareport_projects","obrareport_rdos","obrareport_rdo_events","obrareport_rdo_versions","obrareport_generated_documents","obrareport_document_files"]);
function whereAndOrder(req,a,table){
 const clauses=[];
 for(const [key,value]of Object.entries(req.query)){
  if(["select","order","limit","offset"].includes(key))continue;
  const column=ident(key),s=String(value);let m=s.match(/^(eq|neq|gte|lte|gt|lt)\.(.*)$/s);
  if(m){const op={eq:"=",neq:"<>",gte:">=",lte:"<=",gt:">",lt:"<"}[m[1]];clauses.push(column+op+literal(m[2]));continue;}
  if(s==="is.null"){clauses.push(column+" IS NULL");continue;}
  if(s==="not.is.null"){clauses.push(column+" IS NOT NULL");continue;}
  throw Error("Unsupported local QA filter");
 }
 // Local adapter authorization for direct user requests. The unchanged backend
 // service repository still performs its own canonical tenant filtering.
 if(!a.service){
  const p=query("select * from profiles where auth_user_id="+literal(a.user.id))[0];if(!p)throw Error("Local profile absent");
  if(table==="profiles")clauses.push("auth_user_id="+literal(a.user.id));
  else if(table==="companies")clauses.push("id="+literal(p.company_id));
  else if(table==="institutions")clauses.push("id="+literal(p.institution_id));
  else clauses.push("institution_id="+literal(p.institution_id));
 }
 return clauses.length?" WHERE "+clauses.join(" AND "):"";
}
function selected(req){const s=String(req.query.select||"*");return s==="*"?"*":s.split(",").map(ident).join(",");}
async function startGateway(){
 const app=express();app.use(express.json({limit:"1mb"}));
 app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin",req.headers.origin||"*");res.setHeader("Access-Control-Allow-Headers","*");res.setHeader("Access-Control-Allow-Methods","GET,POST,PATCH,DELETE,OPTIONS");res.setHeader("Access-Control-Expose-Headers","Content-Range");if(req.method==="OPTIONS")return res.sendStatus(204);next();});
 app.get("/health",(req,res)=>res.json({ok:true,environment:"LOCAL_SQL_QA",cloud:false}));
 app.post("/auth/v1/token",(req,res)=>{
  try{
   if(req.query.grant_type==="refresh_token"){
    const previous=query("select * from qa_auth_sessions where refresh_hash="+literal(digest(String(req.body.refresh_token||"")))+" and not revoked and expires_at>now()")[0];
    if(!previous)return res.status(400).json({error:"invalid_grant",error_description:"Invalid local QA refresh session"});
    const u=query("select id,email,created_at from auth.users where id="+literal(previous.user_id))[0];return res.json(session(u,previous));
   }
   const u=query("select * from auth.users where email="+literal(String(req.body.email||"").toLowerCase()))[0];
   const actual=u?scryptSync(String(req.body.password||""),u.password_salt,32):null,expected=u?Buffer.from(u.password_hash,"hex"):null;
   if(!u||actual.length!==expected.length||!timingSafeEqual(actual,expected))return res.status(400).json({error:"invalid_grant",error_description:"Invalid login credentials"});
   res.json(session(u));
  }catch{res.status(500).json({error:"local_auth_failed"});}
 });
 app.get("/auth/v1/user",(req,res)=>{const a=actor(req);if(!a?.user)return res.status(401).json({msg:"Invalid local QA session"});res.json(publicUser(a.user));});
 app.post("/auth/v1/logout",(req,res)=>{const a=actor(req);if(a?.payload)sql("update qa_auth_sessions set revoked=true where jti="+literal(a.payload.jti)+";");res.sendStatus(204);});
 app.post("/qa/expire",(req,res)=>{if(req.headers["x-qa-control"]!==c.controlSecret)return res.sendStatus(403);const userId=c.accounts[req.body.actor]?.userId;if(!userId)return res.sendStatus(400);sql("update qa_auth_sessions set revoked=true where user_id="+literal(userId)+";");res.json({ok:true});});
 app.post("/rest/v1/rpc/stock_full_list_works",(req,res)=>{
  const a=actor(req);if(!a?.user)return res.status(401).json({message:"authentication_required"});
  const rows=query("select p.id,p.name,p.address,p.client_id,p.institution_id,p.created_at,p.updated_at from obrareport_projects p join profiles u on p.institution_id=u.institution_id::text where u.auth_user_id="+literal(a.user.id)+" order by p.name");
  res.json(rows);
 });
 app.all("/rest/v1/:table",(req,res)=>{
  const a=actor(req);if(!a)return res.status(401).json({message:"authentication_required"});
  const table=req.params.table;if(!tables.has(table))return res.status(404).json({message:"Local QA table not implemented",code:"42P01"});
  const single=String(req.headers.accept||"").includes("application/vnd.pgrst.object+json");
  try{
   const where=whereAndOrder(req,a,table);
   if(req.method==="GET"){
    const order=String(req.query.order||"").split(",").filter(Boolean).map(x=>{const [col,dir]=x.split(".");return ident(col)+" "+(dir==="desc"?"DESC":"ASC");}).join(",");
    const limit=Math.min(10000,Math.max(0,Number(req.query.limit)||10000)),offset=Math.max(0,Number(req.query.offset)||0);
    const rows=query("select "+selected(req)+" from "+ident(table)+where+(order?" order by "+order:"")+" limit "+limit+" offset "+offset);
    res.setHeader("Content-Range","0-"+Math.max(0,rows.length-1)+"/"+rows.length);return jsonResponse(res,rows,200,single);
   }
   if(!a.service)return res.status(403).json({message:"Local direct table writes require QA backend service identity",code:"42501"});
   if(req.method==="POST"){
    const rows=(Array.isArray(req.body)?req.body:[req.body]).flatMap(row=>insert(table,row));return jsonResponse(res,rows,201,single);
   }
   if(req.method==="PATCH"){
    const sets=Object.entries(req.body).map(([k,v])=>ident(k)+"="+literal(v)).join(",");
    const rows=JSON.parse(sql("with qa_updated as(update "+ident(table)+" set "+sets+where+" returning *) select coalesce(json_agg(qa_updated),'[]'::json) from qa_updated;")||"[]");return jsonResponse(res,rows,200,single);
   }
   return res.sendStatus(405);
  }catch(e){const unique=/duplicate key|unique constraint/i.test(e.message);res.status(unique?409:400).json({message:unique?"Local unique constraint violation":"Local QA SQL request rejected",code:unique?"23505":"QA_SQL_ERROR"});}
 });
 const server=await new Promise(resolve=>{const s=app.listen(ports.gateway,"127.0.0.1",()=>resolve(s));});servers.push(server);
}
async function startBackend(){
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=(input,init)=>{const url=new URL(String(input?.url||input));if(!["127.0.0.1","localhost"].includes(url.hostname))return Promise.reject(Error("QA_EXTERNAL_NETWORK_BLOCKED"));return nativeFetch(input,init);};
 const {createApp}=await import(pathToFileURL(path.join(root,"backend/src/app.js")).href);
 const env={NODE_ENV:"test",SUPABASE_URL:origin,SUPABASE_ANON_KEY:sign({role:"anon"}),SUPABASE_SERVICE_ROLE_KEY:sign({role:"service_role"}),ELO_RDO_STORE:"supabase",ELO_TELEMETRY_ENABLED:"false",ELO_CORE_STORE_PATH:path.join(privateDir,"elo-core.json"),ELO_VECTOR_MEMORY_PATH:path.join(privateDir,"vector-memory.json")};
 const app=createApp({env,enableEloTelemetryRetention:false});
 const server=await new Promise(resolve=>{const s=app.listen(ports.backend,"127.0.0.1",()=>resolve(s));});servers.push(server);
 return env;
}
async function startFrontend(env){
 const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon"};
 const cfg={ELO_API_BASE_URL:"http://127.0.0.1:"+ports.backend,OBRAREPORT_API_BASE_URL:"http://127.0.0.1:"+ports.backend,ELO_SUPABASE_URL:origin,ELO_SUPABASE_ANON_KEY:env.SUPABASE_ANON_KEY};
 const script="<script>"+Object.entries(cfg).map(([k,v])=>"window."+k+"="+JSON.stringify(v)+";").join("")+"</script>";
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname),segments=pathname.split("/");
  if(segments.some(s=>s.startsWith(".")||s==="node_modules"||s==="qa-artifacts"||s==="backend")){res.writeHead(403);return res.end();}
  const file=path.resolve(root,"."+pathname+(pathname.endsWith("/")?"index.html":""));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{let bytes=fs.readFileSync(file);if(path.extname(file)===".html")bytes=Buffer.from(bytes.toString("utf8").replace("<head>","<head>"+script));res.setHeader("Cache-Control","no-store");res.setHeader("Content-Type",mime[path.extname(file)]||"application/octet-stream");res.end(bytes);}
  catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(ports.frontend,"127.0.0.1",resolve));servers.push(server);
}
export async function start(){
 c=initialize();await startGateway();const env=await startBackend();await startFrontend(env);
 const context={classification:"LOCAL_INTEGRATION_REAL_POSTGRES_LOCAL_AUTH_PROTOCOL_ADAPTER",backend:"Unchanged createApp and createSupabaseRdoRepository; official SQL schema",auth:"Local password hash verification and signed JWT with persistent revocation; not Supabase GoTrue",rest:"Local SQL protocol adapter; not PostgREST vendor implementation",frontend:"Official ELO HTML/JS with local endpoint configuration",urls:{gateway:origin,backend:"http://127.0.0.1:"+ports.backend,frontend:"http://127.0.0.1:"+ports.frontend},productionNetworkBlocked:true,cloudWriteCount:0};
 fs.writeFileSync(path.join(qaDir,"local-stack-context.json"),JSON.stringify(context,null,2));console.log(JSON.stringify({ready:true,...context}));
 return {stop:async()=>{for(const s of servers)await new Promise(r=>s.close(r));},config:c,context};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))start().catch(e=>{console.error(String(e.message));process.exitCode=1;});
