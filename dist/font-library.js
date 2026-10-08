export const WEB_FONTS=['Noto Sans JP','Noto Serif JP','M PLUS Rounded 1c','Zen Kaku Gothic New','Shippori Mincho','BIZ UDPGothic','BIZ UDPMincho','Kosugi Maru','Sawarabi Gothic','Kaisei Decol','RocknRoll One'];
export const SYSTEM_FONT_CANDIDATES=['Arial','Helvetica Neue','Hiragino Sans','Hiragino Kaku Gothic ProN','Hiragino Mincho ProN','Yu Gothic','Yu Mincho','Avenir Next','Futura','Georgia','Times New Roman','Baskerville','Didot','Menlo','Courier New'];

let connection;
const database=()=>connection??=(new Promise((resolve,reject)=>{const request=indexedDB.open('pve.iphone.fonts.v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>{connection=null;reject(request.error)}}));
const transact=(mode,work)=>database().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction('files',mode),store=tx.objectStore('files');work(store);tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error)}));
const cleanName=name=>String(name||'Font').replace(/\.(woff2?|ttf|otf)$/i,'').replace(/[^\p{L}\p{N} _-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,60)||'Font';

export function fontRecord(file,id=crypto.randomUUID()){
 const label=cleanName(file.name),family=`PVE ${label} ${id.slice(0,8)}`;
 return{id,family,label,name:file.name,size:file.size,type:'file'};
}
export async function installFont(record,file,{store=true}={}){
 const face=new FontFace(record.family,await file.arrayBuffer());await face.load();document.fonts.add(face);
 if(store)await transact('readwrite',objectStore=>objectStore.put(file,record.id));
 return record;
}
export async function restoreFonts(records=[]){
 const restored=[];let db;try{db=await database()}catch{return restored}
 for(const record of records.filter(value=>value?.type==='file'))try{const file=await new Promise((resolve,reject)=>{const request=db.transaction('files').objectStore('files').get(record.id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});if(file){await installFont(record,file,{store:false});restored.push(record.id)}}catch{}
 return restored;
}
export async function discoverLocalFonts(){
 if(typeof globalThis.queryLocalFonts!=='function')return[];
 const values=await globalThis.queryLocalFonts(),seen=new Set();return values.map(value=>value.family||value.fullName).filter(name=>name&&!seen.has(name)&&seen.add(name)).sort((a,b)=>a.localeCompare(b));
}
export function fontChoices(records=[],localNames=[]){
 const base=[['Sans','Sans Serif'],['Serif','Serif'],['Mono','Monospace']],available=SYSTEM_FONT_CANDIDATES.filter(name=>document.fonts?.check?.(`12px "${name}"`)),project=records.map(record=>[record.family,record.label+' · 読み込み']);
 return [...base,...WEB_FONTS.map(name=>[name,name+' · Web']),...available.map(name=>[name,name+' · Mac']),...localNames.map(name=>[name,name+' · Local']),...project].filter((value,index,all)=>all.findIndex(other=>other[0]===value[0])===index);
}
export function sanitizeFontRecords(records=[]){return(Array.isArray(records)?records:[]).slice(0,32).filter(record=>record&&record.id&&record.family).map(record=>({id:String(record.id).slice(0,80),family:String(record.family).slice(0,100),label:String(record.label||record.family).slice(0,80),name:String(record.name||'font').slice(0,120),size:Math.max(0,+record.size||0),type:record.type==='file'?'file':'local'}))}
