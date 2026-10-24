// Optional B1 native File System Access API regression. Uses only a disposable
// OPFS subtree in a fresh browser context; never invokes a user's folder picker.
// PVE_PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs node scripts/check-project-storage-browser.mjs http://127.0.0.1:8875/ output.json
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const [base,output]=process.argv.slice(2);
if(!base||!output||!process.env.PVE_PLAYWRIGHT_MODULE)throw Error('URL output.json and PVE_PLAYWRIGHT_MODULE required');
const {chromium}=await import(pathToFileURL(process.env.PVE_PLAYWRIGHT_MODULE));
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={browser:browser.version(),backend:'Native Chrome OPFS (not picker-selected external filesystem)',errors:[]};
try{
 const context=await browser.newContext(),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 report.failures=await page.evaluate(async()=>{
  const {copyMediaToProject,restoreProjectMediaFile}=await import('/dist/project-storage.js');
  const root=await navigator.storage.getDirectory(),name='pve-b1-'+crypto.randomUUID(),temp=await root.getDirectoryHandle(name,{create:true}),results=[];
  const check=(ok,label)=>{if(!ok)throw Error(label)},read=async h=>[...new Uint8Array(await(await h.getFile()).arrayBuffer())],old=[0,255,128,13],fresh=[2,254,0,7];
  const put=async(d,n,b)=>{const h=await d.getFileHandle(n,{create:true}),w=await h.createWritable();await w.write(new Uint8Array(b));await w.close();return h};
  try{for(const existing of [false,true])for(const stage of ['lookup','acquire','acquire-after-create','writer','write','close','close-after-commit','abort','close-abort']){
   const d=await temp.getDirectoryHandle((existing?'old-':'new-')+stage,{create:true}),folder=await d.getDirectoryHandle('Originals',{create:true});
   const media={id:'m',kind:'video',...(existing?{projectPath:'Originals/m-shot.mov',retained:true}:{})};
   if(existing)await put(folder,'m-shot.mov',old);
   const saved=JSON.stringify({media:[media]}),savedHandle=await put(d,'Project.pve',new TextEncoder().encode(saved));
   let fault=stage,abortFailed=false;
   const wrap=h=>({native:h,isSameEntry:other=>h.isSameEntry(other.native||other),createWritable:async()=>{
    if(fault==='writer')throw Error('injected writer');const w=await h.createWritable();
    return{write:async file=>{await w.write(file);if(['write','abort'].includes(fault))throw Error('injected write')},
     close:async()=>{if(['close','close-abort'].includes(fault))throw Error('injected close');await w.close();if(fault==='close-after-commit')throw Error('injected close-after-commit')},
     abort:async()=>{await w.abort();if(['abort','close-abort'].includes(fault)){abortFailed=true;throw Error('injected abort')}}};
   }});
   const wrapped={getDirectoryHandle:async(...args)=>{const f=await d.getDirectoryHandle(...args);return{getFileHandle:async(n,o={})=>{
    if(fault===(o.create?'acquire':'lookup'))throw Error('injected '+fault);
    const h=await f.getFileHandle(n,o);if(o.create&&fault==='acquire-after-create')throw Error('injected acquire-after-create');return wrap(h);
   },removeEntry:n=>f.removeEntry(n)}}};
   const before=JSON.stringify(media);let failed=false;
   try{media.projectPath=await copyMediaToProject(wrapped,media,new File([new Uint8Array(fresh)],'shot.mov'))}catch{failed=true}
   check(failed,'failure not observed: '+stage);check(JSON.stringify(media)===before,'reference changed');
   check(await(await savedHandle.getFile()).text()===saved,'saved manifest changed');
   if(existing)check(JSON.stringify(await read(await folder.getFileHandle('m-shot.mov')))===JSON.stringify(old),'old bytes changed');
   if(['abort','close-abort'].includes(stage))check(abortFailed,'abort failure not reached');
   const beforeRetry=[];for await(const key of folder.keys())beforeRetry.push(key);
   if(['writer','write','close','close-after-commit','abort','close-abort'].includes(stage))check(beforeRetry.length===(existing?1:0),'owned cleanup failed');
   fault=null;media.projectPath=await copyMediaToProject(wrapped,media,new File([new Uint8Array(fresh)],'shot.mov'));
   check(JSON.stringify([...new Uint8Array(await(await restoreProjectMediaFile(d,media.projectPath)).arrayBuffer())])===JSON.stringify(fresh),'retry bytes mismatch');
   if(existing)check(JSON.stringify(await read(await folder.getFileHandle('m-shot.mov')))===JSON.stringify(old),'old bytes changed after retry');
   results.push({existing,stage,bytesAndReferencesPreserved:true,retry:true,unownedResidual:stage==='acquire-after-create'});
  }}finally{await root.removeEntry(name,{recursive:true})}
  return results;
 });
 // Two independently imported modules in separate tabs exercise the real origin
 // Web Lock. All returned paths must retain the exact bytes of their request.
 const token='pve-b1-tabs-'+Date.now(),other=await context.newPage();await other.goto(base);
 const copyInTab=async(p,value)=>p.evaluate(async({token,value})=>{
  const {copyMediaToProject}=await import('/dist/project-storage.js');
  const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle(token,{create:true});
  const file=new File([Uint8Array.of(value,255-value)],'same.mov');const path=await copyMediaToProject(dir,{id:'same',kind:'video'},file);return{path,value};
 },{token,value});
 const pairs=await Promise.all([copyInTab(page,1),copyInTab(other,2),copyInTab(page,3),copyInTab(other,4)]);
 report.tabs=await page.evaluate(async({token,pairs})=>{
  const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle(token);try{
   if(new Set(pairs.map(v=>v.path)).size!==pairs.length)throw Error('tab collision');
   for(const {path,value}of pairs){const [group,name]=path.split('/'),h=await(await dir.getDirectoryHandle(group)).getFileHandle(name),bytes=[...new Uint8Array(await(await h.getFile()).arrayBuffer())];if(JSON.stringify(bytes)!==JSON.stringify([value,255-value]))throw Error('tab bytes mismatch')}
   return{requests:pairs.length,uniquePaths:true,exactBytes:true,webLocks:!!navigator.locks};
  }finally{await root.removeEntry(token,{recursive:true})}
 },{token,pairs});
 await other.close();
 // Exercise the real migration caller with only its picker redirected to OPFS.
 // The test-only hooks are injected into the HTTP response, not production code.
 const app=await fs.readFile(new URL('../dist/app.js?v=2.2.85',import.meta.url),'utf8');
 await page.route('**/app.js*',r=>r.fulfill({contentType:'text/javascript',body:app+`\nwindow.__b1={migrateCurrentToFolder,get:()=>({project:P,directory:projectDirectory,mode:projectStorageMode}),setup:(p,d,files)=>{P=p;projectDirectory=d;projectStorageMode='folder';localFiles.clear();for(const [id,file]of files)localFiles.set(id,file)}};`}));
 await page.addInitScript(()=>sessionStorage.setItem('pve.iphone.project-launcher-seen','1'));
 await page.goto(new URL('dist/',base).href,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__b1);
 report.migration=await page.evaluate(async()=>{
  const {project}=await import('./model.js?v=2.2.85'),{saveFolderProject,listRecentProjects,removeRecentProject}=await import('./project-storage.js?v=2.2.85');
  const root=await navigator.storage.getDirectory(),name='pve-b1-migrate-'+crypto.randomUUID(),temp=await root.getDirectoryHandle(name,{create:true});
  const source=await temp.getDirectoryHandle('old',{create:true}),target=await temp.getDirectoryHandle('new',{create:true}),orig=await source.getDirectoryHandle('Originals',{create:true});
  const p=project();p.id=crypto.randomUUID();p.name='B1 migration';p.media=[{id:'one',kind:'video',name:'one.mov',projectPath:'Originals/one.mov',retained:true},{id:'two',kind:'video',name:'two.mov',projectPath:'Originals/two.mov',retained:true}];
  const files=p.media.map((m,i)=>[m.id,new File([Uint8Array.of(i,255)],m.name)]);
  for(const [id,file]of files){const h=await orig.getFileHandle(id+'.mov',{create:true}),w=await h.createWritable();await w.write(file);await w.close()}
  await saveFolderProject(p,source);const before=JSON.stringify(p),saved=await(await(await source.getFileHandle('Project.pve')).getFile()).text();let fail=true;
  // Wrap only createWritable for the second file; all storage is native.
  const directoryWrap=d=>({getDirectoryHandle:async(...a)=>directoryWrap(await d.getDirectoryHandle(...a)),getFileHandle:async(n,o)=>{
   const h=await d.getFileHandle(n,o);if(fail&&n.startsWith('two-'))return{createWritable:async()=>{throw Error('migration injected')},isSameEntry:other=>h.isSameEntry(other)};return h;
  },removeEntry:(...a)=>d.removeEntry(...a)});
  window.showDirectoryPicker=async()=>directoryWrap(target);window.__b1.setup(p,source,files);
  try{
   await window.__b1.migrateCurrentToFolder();const state=window.__b1.get();if(JSON.stringify(state.project)!==before||!await state.directory.isSameEntry(source))throw Error('failed migration published references');
   if(await(await(await source.getFileHandle('Project.pve')).getFile()).text()!==saved)throw Error('old saved manifest changed');
   let record=(await listRecentProjects()).find(r=>r.id===p.id);if(!record||!await record.directory.isSameEntry(source))throw Error('recent destination changed before success');
   // The second attempt uses native directory handles, so IndexedDB can clone them.
   fail=false;window.showDirectoryPicker=async()=>target;await window.__b1.migrateCurrentToFolder();const after=window.__b1.get();
   for(const m of after.project.media){const [g,n]=m.projectPath.split('/'),h=await(await after.directory.getDirectoryHandle(g)).getFileHandle(n),b=[...new Uint8Array(await(await h.getFile()).arrayBuffer())];if(JSON.stringify(b)!==JSON.stringify([m.id==='one'?0:1,255]))throw Error('migrated bytes')}
   record=(await listRecentProjects()).find(r=>r.id===p.id);if(!await record.directory.isSameEntry(after.directory))throw Error('recent destination not committed');
   return{failurePreservesProject:true,failurePreservesSavedManifest:true,failurePreservesRecentDirectory:true,retryCommitsValidPaths:true};
  }finally{await removeRecentProject(p.id);await root.removeEntry(name,{recursive:true});delete window.__b1}
 });
 if(report.errors.length)throw Error('pageerrors: '+report.errors.join('; '));
 console.log('Native OPFS: 18 injected cases, 4 cross-tab copies, migration failure/retry PASS');
}finally{await browser.close();await fs.writeFile(output,JSON.stringify(report,null,2)+'\n')}
