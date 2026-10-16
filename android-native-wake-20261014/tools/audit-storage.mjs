import {readdirSync,statSync,writeFileSync,lstatSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const workspace=path.resolve(import.meta.dirname,'../../..');
const artifacts=path.resolve(import.meta.dirname,'../../tmp/elo-brain-native-20261014');
const user=os.homedir(), results=[], errors=[];
function size(root) {
 let bytes=0,files=0,links=0;const stack=[root];
 while(stack.length){const dir=stack.pop();let entries;try{entries=readdirSync(dir,{withFileTypes:true})}catch(e){errors.push({path:dir,code:e.code});continue}
  for(const item of entries){const file=path.join(dir,item.name);try{
   if(item.isSymbolicLink()){links++;continue}
   if(item.isDirectory()){stack.push(file);continue}
   if(item.isFile()){bytes+=statSync(file).size;files++}
  }catch(e){errors.push({path:file,code:e.code})}}
 }
 return {path:root,bytes,files,linksSkipped:links};
}
function add(root,category){try{if(!lstatSync(root).isDirectory()||lstatSync(root).isSymbolicLink())return}catch{return}
 const result={...size(root),category};results.push(result);console.log(JSON.stringify(result));
}
// Metadata only. No file contents, sessions, credentials or personal folders.
for(const cache of [path.join(user,'.gradle','caches'),path.join(user,'.gradle','wrapper','dists'),path.join(user,'AppData','Local','npm-cache'),path.join(user,'AppData','Local','pip','Cache'),path.join(user,'.cache')]){
 let entries;try{entries=readdirSync(cache,{withFileTypes:true})}catch{continue}
 for(const child of entries)if(child.isDirectory()&&!child.isSymbolicLink())add(path.join(cache,child.name),'DEVELOPMENT_CACHE_REVIEW');
}
for(const child of readdirSync(workspace,{withFileTypes:true})){
 if(!child.isDirectory()||child.isSymbolicLink())continue;
 const project=path.join(workspace,child.name);
 for(const rel of ['app/build/intermediates','build/intermediates','.gradle','node_modules/.cache','.next/cache','android/app/build/intermediates'])add(path.join(project,rel),'PROJECT_GENERATED_OUTPUT_REVIEW');
}
const visitedBuilds=new Set(results.map(r=>r.path.toLowerCase()));
const devStack=[workspace];
while(devStack.length){const dir=devStack.pop();let entries;try{entries=readdirSync(dir,{withFileTypes:true})}catch{continue}
 for(const child of entries){
  if(!child.isDirectory()||child.isSymbolicLink()||/^(node_modules|\.git|\.codex|\.agents|backups|RDO-store-backups|src|model-assets|test-results)$/i.test(child.name))continue;
  const file=path.join(dir,child.name);
  if(child.name==='intermediates'&&/build/i.test(path.basename(dir))){if(!visitedBuilds.has(file.toLowerCase())){add(file,'ANDROID_GENERATED_INTERMEDIATES_REVIEW');visitedBuilds.add(file.toLowerCase())}continue}
  devStack.push(file);
 }
}
for(const parent of [path.join(user,'AppData','Local','Temp'),path.join(user,'AppData','Local','pnpm','store'),path.join(user,'AppData','Roaming','npm-cache')]){
 let entries;try{entries=readdirSync(parent,{withFileTypes:true})}catch{continue}
 for(const child of entries)if(child.isDirectory()&&!child.isSymbolicLink())add(path.join(parent,child.name),'TEMP_OR_DEPENDENCY_CACHE_REVIEW_NOT_AUTO_DELETE');
}
add(path.join(artifacts,'android-build-work','app-build','intermediates'),'CURRENT_BUILD_INTERMEDIATES_PRESERVE_WHILE_ACTIVE');
add(path.join(artifacts,'android-build-work','app-build','outputs'),'APK_OUTPUTS_PRESERVE');
// Compiler class directories created by this sprint, not logs or source files.
for(const child of readdirSync(artifacts,{withFileTypes:true}))if(child.isDirectory()&&/^(coordinator-classes-|native-light-classes-)/.test(child.name))add(path.join(artifacts,child.name),'SPRINT_COMPILER_OUTPUT_REVIEW');
const report={atUtc:new Date().toISOString(),metadataOnly:true,deleted:false,workspace,results:results.sort((a,b)=>b.bytes-a.bytes),errors};
const file=path.join(artifacts,'storage-audit-'+Date.now()+'.json');writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({report:file,totalListedBytes:results.reduce((n,r)=>n+r.bytes,0),largest:report.results.slice(0,15),errors:errors.length}));
