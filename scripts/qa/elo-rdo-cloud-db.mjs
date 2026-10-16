// Fixed allowlist for the authorized, synthetic Supabase QA project.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const qaDir=path.join(root,'qa-artifacts/elo-rdo-commercial-certification-20261015');
export const privateDir=path.join(root,'.elo-secrets/elo-rdo-commercial-cloud');
export const projectRef='wbweoizkecjjqcfkfokg';
export const ports={backend:15484,frontend:15485};
export function config(){const c=JSON.parse(fs.readFileSync(path.join(privateDir,'cloud-config.json'),'utf8'));if(c.projectRef!==projectRef||c.url!=='https://'+projectRef+'.supabase.co')throw Error('QA project allowlist mismatch');for(const [field,role]of[['anonKey','anon'],['serviceRoleKey','service_role']]){let p;try{p=JSON.parse(Buffer.from(c[field].split('.')[1],'base64url'));}catch{throw Error('QA credential format invalid');}if(p.ref!==projectRef||p.role!==role)throw Error('QA credential project or role mismatch');}return c;}
