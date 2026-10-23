import assert from'node:assert/strict';
import{projectFolderName,saveFolderProject,copyMediaToProject,restoreProjectMediaFile,createProjectFolder}from'../dist/project-storage.js?v=2.2.84';

class FileHandle{constructor(name,file=new File([''],name)){this.name=name;this.file=file}async getFile(){return this.file}async isSameEntry(other){return this===other}async createWritable(){let chunks=[];return{write:async value=>chunks.push(value),close:async()=>{this.file=new File(chunks,this.name)},abort:async()=>{chunks=[]}}}}
class Directory{constructor(name='root'){this.name=name;this.files=new Map;this.directories=new Map}async queryPermission(){return'granted'}async requestPermission(){return'granted'}async getFileHandle(name,{create=false}={}){if(!this.files.has(name)){if(!create)throw new DOMException('missing','NotFoundError');this.files.set(name,new FileHandle(name))}return this.files.get(name)}async getDirectoryHandle(name,{create=false}={}){if(!this.directories.has(name)){if(!create)throw new DOMException('missing','NotFoundError');this.directories.set(name,new Directory(name))}return this.directories.get(name)}async removeEntry(name){this.files.delete(name)}}

assert.equal(projectFolderName('YouTube: test/01','abcdef12'),'YouTube test 01-abcdef.pveproject');
const directory=new Directory(),project={version:1,id:'abcdef12',name:'Folder project',media:[],clips:[]};
for(const name of ['Originals','Audio','Proxies','Autosave','Cache','Exports'])await directory.getDirectoryHandle(name,{create:true});
// IndexedDB is intentionally absent in Node; the folder write must still be testable through a no-op shim.
globalThis.indexedDB={open(){const request={};queueMicrotask(()=>{request.result={createObjectStore(){},transaction(){return{objectStore(){return{put(){}}},set oncomplete(fn){queueMicrotask(fn)},set onerror(fn){},set onabort(fn){}}}};request.onupgradeneeded?.();request.onsuccess?.()});return request}};
await saveFolderProject(project,directory);
assert.deepEqual(JSON.parse(await(await directory.getFileHandle('Project.pve')).getFile().then(file=>file.text())),project);
const source=new File(['moving frames'],'sample.mov',{type:'video/quicktime'}),media={id:'asset-1',name:'sample.mov',kind:'video'};
const path=await copyMediaToProject(directory,media,source);assert.match(path,/^Originals\/asset-1-[a-f0-9-]+-sample\.mov$/);
const restored=await restoreProjectMediaFile(directory,path);assert.equal(await restored.text(),'moving frames');
console.log('Project folder naming, manifest save, streamed media copy and restore PASS');

// B1: copies referenced by a saved project are immutable, including when close
// commits data before rejecting. Failure injection never uses real user files.
const oldBytes=new Uint8Array([0,255,128,13,10,1]),newBytes=new Uint8Array([2,0,254,7]);
const blob=name=>new File([newBytes],name,{type:'video/quicktime'});
const bytes=async file=>[...new Uint8Array(await file.arrayBuffer())];
class FaultDirectory extends Directory{
 constructor(){super();this.fault=null;this.writes=[];this.removed=[];this.abortFailed=false;this.active=0;this.peak=0;this.hook=null}
 fail(stage){if(this.fault===stage)throw new DOMException('injected '+stage,'UnknownError')}
 async getFileHandle(name,{create=false}={}){
  if(!create)this.fail('lookup');else this.fail('acquire');
  const handle=await super.getFileHandle(name,{create});
  if(create){
   if(this.fault==='acquire-after-create')throw Error('injected acquire-after-create');
   handle.createWritable=async()=>{
    this.fail('writer');this.writes.push(name);this.active++;this.peak=Math.max(this.peak,this.active);let pending,finished=false;
    const finish=()=>{if(!finished){finished=true;this.active--}};
    return{write:async value=>{pending=value;await this.hook?.();this.fail('write');if(this.fault==='abort'){throw Error('injected write before abort')}},
     close:async()=>{this.fail('close');if(this.fault==='close-abort')throw Error('injected close before abort');handle.file=new File([pending],name);finish();this.fail('close-after-commit')},
     abort:async()=>{finish();if(['abort','close-abort'].includes(this.fault)){this.abortFailed=true;throw Error('injected abort')}pending=null}};
   };
  }
  return handle;
 }
 async removeEntry(name){this.removed.push(name);this.fail('cleanup');return super.removeEntry(name)}
}
async function caseDirectory(existing){
 const root=new Directory(),folder=new FaultDirectory();root.directories.set('Originals',folder);
 const media={id:'m',name:'shot.mov',kind:'video',...(existing?{projectPath:'Originals/m-shot.mov',retained:true}:{})};
 if(existing)folder.files.set('m-shot.mov',new FileHandle('m-shot.mov',new File([oldBytes],'shot.mov')));
 const saved=JSON.stringify({media:[structuredClone(media)]});root.files.set('Project.pve',new FileHandle('Project.pve',new File([saved],'Project.pve')));
 return{root,folder,media,saved};
}
let injectedCases=0;
for(const existing of [false,true])for(const fault of ['lookup','acquire','acquire-after-create','writer','write','close','close-after-commit','abort','close-abort']){
 const {root,folder,media,saved}=await caseDirectory(existing),before=structuredClone(media);
 folder.fault=fault;
 await assert.rejects(async()=>{media.projectPath=await copyMediaToProject(root,media,blob('shot.mov'))},/injected/);
 assert.deepEqual(media,before,`${existing}/${fault}: current reference`);
 assert.equal(await(await root.files.get('Project.pve').getFile()).text(),saved,'saved reference');
 if(existing){assert.deepEqual(await bytes(await folder.files.get('m-shot.mov').getFile()),[...oldBytes]);assert(!folder.writes.includes('m-shot.mov'));assert(!folder.removed.includes('m-shot.mov'))}
 if(['writer','write','close','close-after-commit','abort','close-abort'].includes(fault))assert.equal(folder.files.size,existing?1:0,`${fault}: owned failed file removed`);
 if(fault==='acquire-after-create')assert.equal(folder.removed.length,0,'unknown creation ownership must not delete');
 if(['abort','close-abort'].includes(fault))assert(folder.abortFailed);
 folder.fault=null;
 media.projectPath=await copyMediaToProject(root,media,blob('shot.mov'));
 assert.deepEqual(await bytes(await restoreProjectMediaFile(root,media.projectPath)),[...newBytes],'retry bytes');
 if(existing)assert.deepEqual(await bytes(await restoreProjectMediaFile(root,before.projectPath)),[...oldBytes],'old reference after retry');
 injectedCases++;
}
// Lookup failures other than NotFound must not be mistaken for a new entry.
for(const errorName of ['NotAllowedError','TypeMismatchError']){
 const {root,folder}=await caseDirectory(true);folder.getFileHandle=async()=>{throw new DOMException('lookup denied',errorName)};
 await assert.rejects(copyMediaToProject(root,media,source),e=>e.name===errorName);assert.equal(folder.writes.length,0);assert.equal(folder.removed.length,0);
}
// A failed cleanup leaves only an unreferenced generation. Retry never overwrites
// that entry and must not hide the original write failure.
{
 const {root,folder,media}=await caseDirectory(true);
 folder.fault='write';const remove=folder.removeEntry.bind(folder);folder.removeEntry=async()=>{throw Error('cleanup denied')};
 await assert.rejects(copyMediaToProject(root,media,blob('shot.mov')),error=>error.message.includes('write')&&error.mediaCopyCleanupError.message==='cleanup denied');
 assert.equal(folder.files.size,2);folder.removeEntry=remove;folder.fault=null;
 const path=await copyMediaToProject(root,media,blob('shot.mov'));assert.equal(folder.files.size,3);assert.deepEqual(await bytes(await restoreProjectMediaFile(root,path)),[...newBytes]);
}
// If another entry replaced the failed file, cleanup must not remove that entry.
{
 const {root,folder,media}=await caseDirectory(false);folder.fault='write';
 folder.hook=async()=>folder.files.set(folder.writes.at(-1),new FileHandle(folder.writes.at(-1),new File([oldBytes],'replacement')));
 await assert.rejects(copyMediaToProject(root,media,blob('shot.mov')));
 assert.deepEqual(await bytes(await folder.files.get(folder.writes.at(-1)).getFile()),[...oldBytes]);assert.equal(folder.removed.length,0);
}
// Overlapping requests with the same ID (including differing source names) each
// return their own complete bytes; a failed predecessor does not poison the queue.
{
 const {root,folder,media}=await caseDirectory(true);folder.hook=()=>new Promise(r=>setTimeout(r,2));
 const files=Array.from({length:8},(_,i)=>new File([Uint8Array.of(i,255-i)],i%2?'other.wav':'shot.mov'));
 const paths=await Promise.all(files.map((file,i)=>copyMediaToProject(i%2?Object.create(root):root,media,file)));
 assert.equal(new Set(paths).size,8);assert.equal(folder.peak,1);
 for(let i=0;i<files.length;i++)assert.deepEqual(await bytes(await restoreProjectMediaFile(root,paths[i])),await bytes(files[i]));
 assert.deepEqual(await bytes(await restoreProjectMediaFile(root,media.projectPath)),[...oldBytes]);
 folder.fault='write';const bad=copyMediaToProject(root,media,source);await assert.rejects(bad);folder.fault=null;assert(await copyMediaToProject(root,media,source));
}
// Folder migration must be able to create its destination without prematurely
// publishing a manifest/recent-project entry. The caller stages media on a clone.
{
 const parent=new Directory();globalThis.showDirectoryPicker=async()=>parent;
 const dest=await createProjectFolder(project,{save:false});assert.equal(dest.files.size,0);assert.equal(dest.directories.size,6);
 delete globalThis.showDirectoryPicker;
}
console.log(`B1 ${injectedCases} existing/new failure cases, retained bytes/references, cleanup ownership, retries and concurrent copies PASS`);
// Independent realms without Web Locks still allocate different generations.
{
 const descriptor=Object.getOwnPropertyDescriptor(navigator,'locks');Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
 try{
  const other=await import('../dist/project-storage.js?b1-independent');
  const {root,folder,media}=await caseDirectory(false);folder.hook=()=>new Promise(r=>setTimeout(r,3));
  const files=[new File([Uint8Array.of(11)],'shot.mov'),new File([Uint8Array.of(22)],'shot.mov')];
  const paths=await Promise.all([copyMediaToProject(root,media,files[0]),other.copyMediaToProject(Object.create(root),media,files[1])]);
  assert.notEqual(paths[0],paths[1]);assert.equal(folder.peak,2);
  for(let i=0;i<2;i++)assert.deepEqual(await bytes(await restoreProjectMediaFile(root,paths[i])),await bytes(files[i]));
 }finally{if(descriptor)Object.defineProperty(navigator,'locks',descriptor);else delete navigator.locks}
}
// Collision checks preserve pre-existing entries instead of treating them as
// owned failed attempts. Bound retries if UUID generation keeps colliding.
{
 const random=crypto.randomUUID;
 try{
  const {root,folder,media}=await caseDirectory(true),name='m-collision-shot.mov';
  folder.files.set(name,new FileHandle(name,new File([oldBytes],name)));crypto.randomUUID=()=> 'collision';
  await assert.rejects(copyMediaToProject(root,media,blob('shot.mov')),/ファイル名/);
  assert.equal(folder.writes.length,0);assert.equal(folder.removed.length,0);assert.deepEqual(await bytes(await folder.files.get(name).getFile()),[...oldBytes]);
 }finally{crypto.randomUUID=random}
}
// No current or persisted reference is published while the writer is pending.
{
 const {root,folder,media,saved}=await caseDirectory(true);let release,entered;
 const gate=new Promise(r=>{release=r}),ready=new Promise(r=>{entered=r});folder.hook=()=>{entered();return gate};
 const before=media.projectPath;let settled=false;
 const task=copyMediaToProject(root,media,blob('shot.mov')).then(path=>{media.projectPath=path;settled=true});
 await ready;assert.equal(settled,false);assert.equal(media.projectPath,before);assert.equal(await(await root.files.get('Project.pve').getFile()).text(),saved);
 assert.deepEqual(await bytes(await restoreProjectMediaFile(root,before)),[...oldBytes]);release();await task;
 assert.notEqual(media.projectPath,before);assert.deepEqual(await bytes(await restoreProjectMediaFile(root,media.projectPath)),[...newBytes]);
}
console.log('B1 no-Web-Locks concurrency, name collisions and publish-after-close PASS');
