// Storage estimates are advisory, not a guarantee that an OPFS write will fail.
export async function openRenderFile(storage,path){
 const root=await (await storage.getDirectory()).getDirectoryHandle('pve-iphone-renders',{create:true});
 try{
  const fileHandle=await root.getFileHandle(path,{create:true});
  const handle=await fileHandle.createSyncAccessHandle();
  return {root,path,fileHandle,handle};
 }catch(error){await root.removeEntry(path).catch(()=>{});throw error}
}
export function writeRenderChunk(handle,data,position,check=()=>{}){
 const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);let offset=0;
 while(offset<bytes.length){
  check();const count=handle.write(bytes.subarray(offset),{at:position+offset});
  if(!Number.isInteger(count)||count<=0||count>bytes.length-offset)throw Error('書き出しデータをブラウザ内へ保存できませんでした。保存先を確認して再試行してください。');
  offset+=count;
 }
}
export function storageFailureMessage(error){
 return error?.name==='QuotaExceededError'
  ?'ブラウザ内の保存領域の上限に達しました。Mac本体の空き容量とは別の制限です。「保存容量を確認・整理」で確認するか、Macローカルエンジンをご利用ください。'
  :error?.message||'書き出しに失敗しました。';
}
