import assert from'node:assert/strict';
import{projectFolderName,saveFolderProject,copyMediaToProject,restoreProjectMediaFile}from'../dist/project-storage.js';

class FileHandle{constructor(name,file=new File([''],name)){this.name=name;this.file=file}async getFile(){return this.file}async createWritable(){let chunks=[];return{write:async value=>chunks.push(value),close:async()=>{this.file=new File(chunks,this.name)},abort:async()=>{chunks=[]}}}}
class Directory{constructor(name='root'){this.name=name;this.files=new Map;this.directories=new Map}async queryPermission(){return'granted'}async requestPermission(){return'granted'}async getFileHandle(name,{create=false}={}){if(!this.files.has(name)){if(!create)throw Error('missing');this.files.set(name,new FileHandle(name))}return this.files.get(name)}async getDirectoryHandle(name,{create=false}={}){if(!this.directories.has(name)){if(!create)throw Error('missing');this.directories.set(name,new Directory(name))}return this.directories.get(name)}async removeEntry(name){this.files.delete(name)}}

assert.equal(projectFolderName('YouTube: test/01','abcdef12'),'YouTube test 01-abcdef.pveproject');
const directory=new Directory(),project={version:1,id:'abcdef12',name:'Folder project',media:[],clips:[]};
for(const name of ['Originals','Audio','Proxies','Autosave','Cache','Exports'])await directory.getDirectoryHandle(name,{create:true});
// IndexedDB is intentionally absent in Node; the folder write must still be testable through a no-op shim.
globalThis.indexedDB={open(){const request={};queueMicrotask(()=>{request.result={createObjectStore(){},transaction(){return{objectStore(){return{put(){}}},set oncomplete(fn){queueMicrotask(fn)},set onerror(fn){},set onabort(fn){}}}};request.onupgradeneeded?.();request.onsuccess?.()});return request}};
await saveFolderProject(project,directory);
assert.deepEqual(JSON.parse(await(await directory.getFileHandle('Project.pve')).getFile().then(file=>file.text())),project);
const source=new File(['moving frames'],'sample.mov',{type:'video/quicktime'}),media={id:'asset-1',name:'sample.mov',kind:'video'};
const path=await copyMediaToProject(directory,media,source);assert.equal(path,'Originals/asset-1-sample.mov');
const restored=await restoreProjectMediaFile(directory,path);assert.equal(await restored.text(),'moving frames');
console.log('Project folder naming, manifest save, streamed media copy and restore PASS');
