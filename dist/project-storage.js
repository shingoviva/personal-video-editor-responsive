const DB_NAME='pve.iphone.projects.v1',STORE='projects',PROJECT_FILE='Project.pve';

const clone=value=>globalThis.structuredClone?structuredClone(value):JSON.parse(JSON.stringify(value));
export const supportsProjectFolders=()=>typeof globalThis.showDirectoryPicker==='function';
export function projectFolderName(name,id=''){
 const clean=String(name||'Untitled film').normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,80)||'Untitled film';
 return `${clean}${id?`-${String(id).slice(0,6)}`:''}.pveproject`;
}
async function permission(handle,write=false,request=false){
 if(!handle)return false;const options={mode:write?'readwrite':'read'};
 if(!handle.queryPermission)return true;
 if(await handle.queryPermission(options)==='granted')return true;
 return request&&handle.requestPermission&&await handle.requestPermission(options)==='granted';
}
async function writeFile(directory,name,data){
 const handle=await directory.getFileHandle(name,{create:true}),writer=await handle.createWritable();
 try{await writer.write(data);await writer.close()}catch(error){try{await writer.abort()}catch{}throw error}
}
async function readJson(directory,name=PROJECT_FILE){
 const handle=await directory.getFileHandle(name),file=await handle.getFile();return JSON.parse(await file.text());
}
function db(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB)return reject(new Error('IndexedDB unavailable'));const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function transaction(mode,run){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,mode),store=tx.objectStore(STORE),result=run(store);tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error||new Error('プロジェクト一覧を更新できませんでした。'))})}

export async function rememberProject(project,{directory=null,mode=directory?'folder':'browser'}={}){
 const record={id:project.id,name:project.name||'Untitled film',updatedAt:Date.now(),mode,snapshot:clone(project),directory};
 await transaction('readwrite',store=>store.put(record));return record;
}
export async function listRecentProjects(){
 try{const records=await transaction('readonly',store=>new Promise((resolve,reject)=>{const request=store.getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)}));return records.sort((a,b)=>b.updatedAt-a.updatedAt)}catch{return[]}
}
export async function referencedMediaIds(){const records=await listRecentProjects();return new Set(records.flatMap(record=>(record.snapshot?.media||[]).map(media=>media.id)))}
export async function removeRecentProject(id){try{await transaction('readwrite',store=>store.delete(id))}catch{}}

export async function createProjectFolder(project){
 if(!supportsProjectFolders())throw Error('このブラウザではローカルフォルダ保存を利用できません。ChromeまたはEdgeを使用してください。');
 const parent=await showDirectoryPicker({id:'pve-projects',mode:'readwrite',startIn:'documents'});
 if(!await permission(parent,true,true))throw new DOMException('フォルダへの書き込みが許可されませんでした。','NotAllowedError');
 const directory=await parent.getDirectoryHandle(projectFolderName(project.name,project.id),{create:true});
 for(const name of ['Originals','Audio','Proxies','Autosave','Cache','Exports'])await directory.getDirectoryHandle(name,{create:true});
 await saveFolderProject(project,directory);return directory;
}
export async function chooseProjectFolder(){
 if(!supportsProjectFolders())throw Error('このブラウザではフォルダを直接開けません。SafariではDEVICE ENGINEまたはブラウザ内プロジェクトを使用してください。');
 const directory=await showDirectoryPicker({id:'pve-open-project',mode:'readwrite'});
 if(!await permission(directory,true,true))throw new DOMException('フォルダへのアクセスが許可されませんでした。','NotAllowedError');
 return{directory,project:await readJson(directory)};
}
export async function openRecentProject(record,request=true){
 if(record.mode!=='folder'||!record.directory)return{project:clone(record.snapshot),directory:null,mode:'browser'};
 if(!await permission(record.directory,true,request))throw new DOMException('プロジェクトフォルダへのアクセスを許可してください。','NotAllowedError');
 return{project:await readJson(record.directory),directory:record.directory,mode:'folder'};
}
export async function saveFolderProject(project,directory){
 if(!directory)return; if(!await permission(directory,true,false))throw new DOMException('プロジェクトフォルダへのアクセスが必要です。','NotAllowedError');
 const text=JSON.stringify(project,null,2),autosave=await directory.getDirectoryHandle('Autosave',{create:true});
 await writeFile(autosave,'Latest.project',text);await writeFile(directory,PROJECT_FILE,text);
 await rememberProject(project,{directory,mode:'folder'});
}
export async function copyMediaToProject(directory,media,file){
 if(!directory)return null;if(!await permission(directory,true,false))throw new DOMException('プロジェクトフォルダへのアクセスが必要です。','NotAllowedError');
 const group=media.kind==='audio'?'Audio':'Originals',folder=await directory.getDirectoryHandle(group,{create:true});
 const original=String(file.name||media.name||'media').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(-160),name=`${media.id}-${original}`;
 try{await writeFile(folder,name,file)}catch(error){try{await folder.removeEntry(name)}catch{}throw error}
 return`${group}/${name}`;
}
export async function restoreProjectMediaFile(directory,path){
 if(!directory||!path)return null;if(!await permission(directory,false,false))return null;
 const parts=String(path).split('/').filter(Boolean);if(parts.length!==2||!['Originals','Audio'].includes(parts[0]))return null;
 try{const folder=await directory.getDirectoryHandle(parts[0]),handle=await folder.getFileHandle(parts[1]);return await handle.getFile()}catch{return null}
}
export async function saveBrowserProject(project){return rememberProject(project,{mode:'browser'})}
