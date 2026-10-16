import fs from "node:fs";import path from "node:path";import {execFileSync} from "node:child_process";import {root} from "./elo-rdo-local-db.mjs";
const common=execFileSync("git",["rev-parse","--path-format=absolute","--git-common-dir"],{cwd:root,encoding:"utf8"}).trim();
const roots=[path.dirname(root),path.dirname(common)];
const skip=new Set(["node_modules",".git",".elo-secrets","qa-artifacts","dist",".next","offline-media","out"]);
const found=[];
function walk(dir,depth=0){if(depth>5)return;let list;try{list=fs.readdirSync(dir,{withFileTypes:true});}catch{return;}for(const d of list){if(d.isSymbolicLink())continue;const file=path.join(dir,d.name);if(d.isDirectory()){if(!skip.has(d.name))walk(file,depth+1);continue;}if(!d.name.startsWith(".env")||/example|sample|template/i.test(d.name))continue;
 const entries={};for(const line of fs.readFileSync(file,"utf8").split(/\r?\n/)){const m=line.trim().match(/^([A-Z_0-9]+)=(.*)$/);if(m)entries[m[1]]=m[2].trim().replace(/^["']|["']$/g,"");}
 const urls=Object.entries(entries).filter(([k])=>/SUPABASE.*URL|DATABASE_URL|STAGING.*URL/.test(k)).map(([k,v])=>{try{return {key:k,host:new URL(v).hostname};}catch{return {key:k,host:"not-a-parseable-url"};}});
 found.push({file,keys:Object.keys(entries),projectHosts:urls,environmentLabel:entries.E2E_ENVIRONMENT||entries.NODE_ENV||null,tenantSlug:entries.E2E_TENANT_SLUG||null,writesFlag:entries.E2E_ALLOW_WRITES||null});
}}
for(const r of roots)walk(r);
const publicHost="mplpzyalcxhhinuvjthx.supabase.co";
const envKeys=Object.keys(process.env).filter(k=>/SUPABASE|STAGING|POSTGRES|DATABASE|E2E_/.test(k));
const result={atUtc:new Date().toISOString(),publishedProject:publicHost,secretsPrinted:false,configs:found,environmentVariableNames:envKeys,confirmedIndependentSupabaseStaging:false,classification:found.map(f=>({file:f.file,hosts:f.projectHosts.map(u=>u.host),classification:f.projectHosts.some(u=>u.host===publicHost)?"SHARED_WITH_PUBLISHED_PROJECT":f.projectHosts.length?"DIFFERENT_PROJECT_BUT_PURPOSE_NOT_VERIFIED_DO_NOT_USE":"NO_DATABASE_ENDPOINT"})),localAlternative:"PostgreSQL 17 isolated cluster; fresh QA credentials; local auth/REST protocol adapter; no production credentials"};
fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));console.log(JSON.stringify({configs:found.length,projectHosts:[...new Set(found.flatMap(f=>f.projectHosts.map(x=>x.host)))],confirmedIndependentSupabaseStaging:false,secretsPrinted:false,environmentVariableNames:envKeys}));

