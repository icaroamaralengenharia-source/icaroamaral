// QA-only pooled SQL connections. The target is fixed to the private loopback DB.
import path from "node:path";
import {createRequire} from "node:module";
import {root,config,ports,database,ident} from "./elo-rdo-local-db.mjs";
const require=createRequire(path.join(root,"scripts/qa/runtime/package.json"));
const {Pool}=require("pg");
export async function connectLocalSql(){
 const pool=new Pool({host:"127.0.0.1",port:ports.postgres,database,user:"elo_qa_admin",password:config().pgPassword,max:4,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,statement_timeout:10000});
 pool.on("error",()=>console.error("LOCAL_QA_DATABASE_CONNECTION_ERROR"));
 const target=(await pool.query("select current_database() db,host(inet_server_addr()) host,inet_server_port() port")).rows[0];
 if(target.db!==database||target.host!=="127.0.0.1"||target.port!==ports.postgres){await pool.end();throw Error("QA database target mismatch: "+JSON.stringify(target));}
 return{
  async query(text){const r=await pool.query("select coalesce(json_agg(qa_result),'[]'::json) records from ("+text+") qa_result");return r.rows[0].records;},
  async sql(text){const r=await pool.query(text);const value=r.rows?.[0]&&Object.values(r.rows[0])[0];return value===undefined?"":typeof value==="object"?JSON.stringify(value):String(value);},
  async insert(table,row){const fields=Object.keys(row),values=fields.map(k=>row[k]&&typeof row[k]==="object"?JSON.stringify(row[k]):row[k]);const result=await pool.query("with qa_insert as (insert into "+ident(table)+" ("+fields.map(ident).join(",")+") values ("+fields.map((_,i)=>"$"+(i+1)).join(",")+") returning *) select coalesce(json_agg(qa_insert),'[]'::json) records from qa_insert",values);return result.rows[0].records;},
  end:()=>pool.end()
 };
}
