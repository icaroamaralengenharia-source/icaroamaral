import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../relatorio-qualidade-obras/elo-assistente.js',import.meta.url),'utf8');
const start=source.indexOf('function getEloBackendEndpoint_(path)');
const end=source.indexOf('function getEloCoreSurface_',start);
const resolve=(path,qa)=>vm.runInNewContext('('+source.slice(start,end).trim()+')(path)',{path,window:{ELO_INFERENCE_API_BASE_URL:qa,EloRuntimeConfig:{apiUrl:p=>'https://obrareport-backend.onrender.com'+p}}});
const qa='https://elo-brain-qa-v11-20261016.onrender.com';
test('Web QA sends only chat to exact configured inference service',()=>{
 assert.equal(resolve('/api/elo/chat',qa),qa+'/api/elo/chat');
 for(const path of ['/api/elo/conversations','/api/elo/me','/api/elo/memories','/api/elo/tts','/api/elo/chat?other'])assert.equal(resolve(path,qa),'https://obrareport-backend.onrender.com'+path);
});
test('Web does not trust arbitrary inference host or absent configuration',()=>{
 for(const value of ['',undefined,'https://untrusted.example','http://elo-brain-qa-v11-20261016.onrender.com'])assert.equal(resolve('/api/elo/chat',value),'https://obrareport-backend.onrender.com/api/elo/chat');
});
test('chat config follows native QA binding after initial page load',()=>{
 const window={EloRuntimeConfig:{apiUrl:p=>'https://obrareport-backend.onrender.com'+p}};
 const configStart=source.indexOf('const ELO_CONFIG = {');
 const configEnd=source.indexOf('const ELO_ONLINE_HISTORY_MESSAGE_LIMIT',configStart);
 const context=vm.createContext({window});
 vm.runInContext(source.slice(start,end)+source.slice(configStart,configEnd),context);
 const endpoint=()=>vm.runInContext('ELO_CONFIG.chatEndpoint',context);
 assert.equal(endpoint(),'https://obrareport-backend.onrender.com/api/elo/chat');
 window.ELO_INFERENCE_API_BASE_URL=qa;
 assert.equal(endpoint(),qa+'/api/elo/chat');
 assert.equal(vm.runInContext('ELO_CONFIG.vectorMemoryEndpoint',context),'https://obrareport-backend.onrender.com/api/elo/vector-memory');
 window.ELO_INFERENCE_API_BASE_URL='https://untrusted.example';
 assert.equal(endpoint(),'https://obrareport-backend.onrender.com/api/elo/chat');
});
