let connection;
const storageError=()=>new Error('端末への保存が応答しません。現在の編集は続けられます。');
function db(){
 if(!connection){
  const pending=new Promise((resolve,reject)=>{
   let done=false;const r=indexedDB.open('pve.iphone.media.v1',1);
   const fail=error=>{if(done)return;done=true;clearTimeout(timer);reject(error)};
   const timer=setTimeout(()=>fail(storageError()),5000);
   r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('files'))r.result.createObjectStore('files')};
   r.onsuccess=()=>{if(done){r.result.close();return}done=true;clearTimeout(timer);r.result.onversionchange=()=>{r.result.close();connection=null};resolve(r.result)};
   r.onerror=()=>fail(r.error);r.onblocked=()=>fail(storageError());
  });connection=pending;pending.catch(()=>{if(connection===pending)connection=null});
 }return connection;
}
export async function retainFile(id,file,signal){
 if(signal?.aborted)throw signal.reason||new DOMException('保存を中止しました。','AbortError');
 const d=await db();if(signal?.aborted)throw signal.reason||new DOMException('保存を中止しました。','AbortError');
 await new Promise((resolve,reject)=>{
  let tx,settled=false;
  const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve()};
  const abort=()=>{try{tx?.abort()}catch{}finish(signal?.reason||new DOMException('保存を中止しました。','AbortError'))};
  const timer=setTimeout(()=>{try{tx?.abort()}catch{}finish(storageError())},15000);
  try{tx=d.transaction('files','readwrite');signal?.addEventListener('abort',abort,{once:true});
   // Blob records avoid Safari File serialization quirks while preserving names.
   tx.objectStore('files').put({blob:file.slice(0,file.size,file.type),name:file.name,lastModified:file.lastModified,size:file.size},id);
   tx.oncomplete=()=>finish();tx.onerror=tx.onabort=()=>finish(tx.error||new DOMException('保存を中止しました。','AbortError'));
  }catch(error){finish(error)}
 });
}
export async function restoreFile(id){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('files').objectStore('files').get(id);r.onsuccess=()=>{const value=r.result;resolve(value?.blob?new File([value.blob],value.name,{type:value.blob.type,lastModified:value.lastModified}):value)};r.onerror=()=>reject(r.error)});}
export async function forgetFiles(ids){if(!ids.size)return;const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('files','readwrite'),s=tx.objectStore('files');for(const id of ids)s.delete(id);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||new Error('素材コピーを削除できませんでした。'))});}
export async function forgetUnused(ids){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('files','readwrite'),s=tx.objectStore('files'),r=s.openKeyCursor();r.onsuccess=()=>{const c=r.result;if(c){if(!ids.has(c.key))s.delete(c.key);c.continue()}};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});}
export async function vaultInfo(){const d=await db();return new Promise((resolve,reject)=>{let count=0,bytes=0;const r=d.transaction('files').objectStore('files').openCursor();r.onsuccess=()=>{const c=r.result;if(!c)return resolve({count,bytes});count++;bytes+=c.value?.size||0;c.continue()};r.onerror=()=>reject(r.error)});}
