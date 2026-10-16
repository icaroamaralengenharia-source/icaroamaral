// Isolated Supabase QA only. Credentials never appear in logs or public artifacts.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const qaDir=path.join(root,'qa-artifacts/elo-rdo-commercial-certification-20261015');
export const privateDir=path.join(root,'.elo-secrets/elo-rdo-commercial-cloud');
export const projectRef='wbweoizkecjjqcfkfokg';
export const ports={backend:15484,frontend:15485,gateway:15486};
export function config(){const c=JSON.parse(fs.readFileSync(path.join(privateDir,'cloud-config.json'),'utf8'));if(c.projectRef!==projectRef||c.url!==`https://${projectRef}.supabase.co`||c.sql?.user!==`postgres.${projectRef}`||c.sql?.host!=='aws-1-us-west-2.pooler.supabase.com'||c.sql?.port!==5432||c.sql?.database!=='postgres')throw Error('Isolated QA project allowlist mismatch');return c;}
const require=createRequire(path.join(root,'scripts/qa/runtime/package.json'));
export async function connectCloudSql(){const {Pool}=require('pg'),c=config();const pool=new Pool({...c.sql,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(path.join(privateDir,'supabase-ca.crt'),'utf8')},max:3,connectionTimeoutMillis:15000,statement_timeout:20000});pool.on('error',()=>console.error('QA_CLOUD_DATABASE_CONNECTION_ERROR'));try{await pool.query('select current_database()');return pool;}catch(e){await pool.end();throw e;}}
export const ident=v=>{if(!/^[a-z_][a-z0-9_]*$/.test(v))throw Error('Invalid QA SQL identifier');return '"'+v+'"';};
export const literal=v=>v==null?'NULL':typeof v==='number'?String(v):typeof v==='boolean'?(v?'TRUE':'FALSE'):"'"+(typeof v==='object'?JSON.stringify(v):String(v)).replaceAll("'","''")+"'";
export async function query(pool,text){return(await pool.query('select coalesce(json_agg(qa_result),\'[]\'::json) records from ('+text+') qa_result')).rows[0].records;}
export async function insert(pool,table,row){const fields=Object.keys(row);return pool.query('insert into '+ident(table)+' ('+fields.map(ident).join(',')+') values ('+fields.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row).map(v=>v&&typeof v==='object'?JSON.stringify(v):v));}
