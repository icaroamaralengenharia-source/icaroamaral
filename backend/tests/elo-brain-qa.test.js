import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {createApp} from '../src/app.js';
import {createEloBrainQaApp,qaInferenceEnv,CANONICAL_IDENTITY_URL} from '../src/elo-brain-qa.js';
const user='qa-fixture-user';
const token='Bearer fixture.payload.signature';
const baseEnv={OPENAI_API_KEY:'fixture-only',ELO_QA_ALLOWED_USER_HASHES:createHash('sha256').update(user).digest('hex')};
async function run(fn, {identity={ok:true,user_id:user},status=200,env=baseEnv}={}) {
 const calls=[];const core=express();core.post('/api/elo/chat',(req,res)=>res.json({ok:true,context:req.body.context,auth:req.eloQaAuth?.ok}));
 const app=createEloBrainQaApp({env,inferenceApp:core,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(identity),{status});}});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try{await fn('http://127.0.0.1:'+server.address().port,calls);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
const post=(base,body={},headers={})=>fetch(base+'/api/elo/chat',{method:'POST',headers:{Authorization:token,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('QA never inherits production database or Apps Script secrets',()=>{
 const env=qaInferenceEnv({...baseEnv,SUPABASE_SERVICE_ROLE_KEY:'forbidden',SUPABASE_URL:'forbidden',OBRAREPORT_APPS_SCRIPT_URL:'forbidden'});
 assert.equal(env.SUPABASE_SERVICE_ROLE_KEY,undefined);assert.equal(env.SUPABASE_URL,undefined);assert.equal(env.OBRAREPORT_APPS_SCRIPT_URL,undefined);assert.equal(env.ELO_CORE_STORE,'json');
});
test('health identifies isolated inference and reports source',async()=>run(async(base)=>{
 const r=await fetch(base+'/api/health');const d=await r.json();assert.equal(d.historyRoutesExposed,false);assert.equal(d.productionDatabaseCredentials,false);assert.equal(r.headers.get('x-elo-environment'),'qa');
}));
test('history, memory, RDO and other routes reject before auth or inference',async()=>run(async(base,calls)=>{
 for(const path of ['/api/elo/conversations','/api/elo/memories','/api/elo/command','/api/obrareport/documents']){
  const r=await fetch(base+path,{method:'POST'});assert.equal(r.status,404);
 }assert.equal(calls.length,0);
}));
test('missing auth never invokes canonical service',async()=>run(async(base,calls)=>{
 const r=await post(base,{}, {Authorization:''});assert.equal(r.status,401);assert.equal(calls.length,0);
}));
test('unconfigured QA fails closed',async()=>run(async(base,calls)=>{
 assert.equal((await post(base)).status,503);assert.equal(calls.length,0);
},{env:{OPENAI_API_KEY:'fixture-only'}}));
test('canonical rejected or different account cannot infer',async()=>{
 await run(async(base)=>assert.equal((await post(base)).status,401),{status:401});
 await run(async(base)=>assert.equal((await post(base)).status,403),{identity:{ok:true,user_id:'different'}});
});
test('canonical outage fails closed with only numeric diagnostic',async()=>run(async(base)=>{
 const r=await post(base);assert.equal(r.status,503);
 assert.deepEqual(await r.json(),{ok:false,error:'canonical_auth_rejected',canonicalStatus:502});
},{status:502}));
test('browser can read QA provenance without exposing credentials',async()=>run(async(base)=>{
 const r=await post(base,{}, {Origin:'https://www.icaroamaral.com.br'});
 assert.equal(r.headers.get('access-control-expose-headers'),'X-ELO-Environment,X-ELO-Source-Commit');
}));
test('only verified account runs inference, forces conversation memory and only GETs identity',async()=>run(async(base,calls)=>{
 const r=await post(base,{message:'Olá',context:{memoryScope:'PERMANENT',currentConversationId:'fixture'}});
 assert.equal(r.status,200);const d=await r.json();assert.equal(d.context.memoryScope,'CONVERSATION_ONLY');assert.equal(d.context.currentConversationId,'fixture');assert.equal(d.auth,true);
 assert.equal(calls.length,1);assert.equal(calls[0].url,CANONICAL_IDENTITY_URL);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'error');
}));
test('untrusted origin cannot use authenticated QA',async()=>run(async(base,calls)=>{
 assert.equal((await post(base,{}, {Origin:'https://untrusted.example'})).status,403);assert.equal(calls.length,0);
}));
test('malformed or oversized JSON rejected without auth lookup',async()=>run(async(base,calls)=>{
 const r=await fetch(base+'/api/elo/chat',{method:'POST',headers:{Authorization:token,'Content-Type':'application/json'},body:'{'});assert.equal(r.status,400);assert.equal(calls.length,0);
}));
for(const multipart of [false,true])test(`actual QA parser preserves ${multipart?'multipart':'JSON'} and cannot save permanent memory`,async()=>{
 let writes=0;
 const core=createApp({env:{...qaInferenceEnv({}),OPENAI_API_KEY:''},enableEloTelemetryRetention:false,conversationOnlyChat:true,
   eloCoreStore:{upsertMemory:async()=>{writes++;return{id:'forbidden'}}}});
 const app=createEloBrainQaApp({env:baseEnv,inferenceApp:core,fetchImpl:async()=>new Response(JSON.stringify({ok:true,user_id:user}))});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const payload={message:'Guarde na memória que minha cor preferida é azul.',context:{currentConversationId:'fixture'}};
  let body,headers={Authorization:token};
  if(multipart){body=new FormData();body.set('message',payload.message);body.set('context',JSON.stringify(payload.context));}
  else{body=JSON.stringify(payload);headers['Content-Type']='application/json';}
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/elo/chat',{method:'POST',headers,body});
  assert.equal(response.status,503);assert.equal((await response.json()).mode,'fallback_required');assert.equal(writes,0);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
