import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const repoDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function storage(){ return { m:{}, getItem(k){return this.m[k]||null;}, setItem(k,v){this.m[k]=String(v);}, removeItem(k){delete this.m[k];} }; }
function load(fetchImpl){ const sandbox={console,window:{fetch:fetchImpl,localStorage:storage(),URLSearchParams}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); ["elo-project-api-client.js","elo-project-store.js"].forEach((file)=>vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras",file),"utf8"),sandbox,{filename:file})); return sandbox.window; }
test("ApiClient usa backend quando dispon?vel",async()=>{ const win=load(async()=>({ok:true,json:async()=>({ok:true,project:{id:"backend_1"}})})); const result=await win.EloProjectApiClient.save({project:{name:"Casa"}}); assert.equal(result.source,"backend"); assert.equal(result.project.id,"backend_1"); });
test("ApiClient usa fallback local quando backend falha",async()=>{ const win=load(async()=>{throw new Error("offline")}); const result=await win.EloProjectApiClient.save({project:{name:"Casa"}}); assert.equal(result.source,"local"); assert.ok(result.project.id); assert.equal(win.EloProjectStore.listProjectRecords().length,1); });
