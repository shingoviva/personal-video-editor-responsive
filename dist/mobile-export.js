import {downloadable,canShareFile,shareFile,safeName} from './device-save.js';
export function deviceSupport(){return!!(globalThis.VideoEncoder&&globalThis.AudioEncoder&&globalThis.Worker&&globalThis.OffscreenCanvas&&navigator.storage?.getDirectory);}
export async function renderOnDevice(project,files,{preview=false,signal,onProgress=()=>{}}={}){
 if(!deviceSupport())throw Error('このブラウザは端末内書き出しに未対応です。最新のiOSのSafariで開いてください。');
 const outputPath='render-'+crypto.randomUUID()+'.mp4';let completed=false;
 const worker=new Worker(new URL('./mobile-render-worker.js?v=2.2.47',import.meta.url),{type:'module'});let wake,timer,abortTimer,ended=false;const notes=[];
 try{
 wake=await navigator.wakeLock?.request?.('screen').catch(()=>null);
 return await new Promise((resolve,reject)=>{
 const finish=(error,result)=>{if(ended)return;ended=true;clearTimeout(timer);clearTimeout(abortTimer);signal?.removeEventListener('abort',cancel);document.removeEventListener('visibilitychange',visibility);error?reject(error):resolve({...result,notes})};
 const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(Error('動画処理から応答がありません。編集は保持されています。短い区間で再試行してください。')),120000)};
 const cancel=()=>{worker.postMessage({type:'cancel'});abortTimer=setTimeout(()=>finish(new DOMException('書き出しを中止しました。','AbortError')),5000)};
 const visibility=()=>{if(document.hidden){cancel();finish(Error('画面が閉じられたため書き出しを中止しました。Safariを開いたまま再試行してください。'))}};
 signal?.addEventListener('abort',cancel,{once:true});document.addEventListener('visibilitychange',visibility);
 worker.onmessage=({data})=>{arm();if(data.type==='progress')onProgress(data.operation,data.value);if(data.type==='note')notes.push(data.text);if(data.type==='done'){if(signal?.aborted)finish(new DOMException('書き出しを中止しました。','AbortError'));else{completed=true;finish(null,data.result)}}if(data.type==='error')finish(data.cancelled?new DOMException(data.error,'AbortError'):Error(data.error));};
 worker.onerror=e=>finish(Error(e.message||'端末内書き出しに失敗しました。'));
 if(signal?.aborted){finish(signal.reason||new DOMException('中止','AbortError'));return}arm();worker.postMessage({type:'render',project,files,preview,outputPath});
 });
 }finally{worker.terminate();await wake?.release?.().catch(()=>{});if(!completed){try{const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('pve-iphone-renders');await dir.removeEntry(outputPath)}catch{}}}
}
async function renderDirectory(create=false){const root=await navigator.storage.getDirectory();return root.getDirectoryHandle('pve-iphone-renders',{create})}
export async function deleteRender(path){if(!path)return false;try{const dir=await renderDirectory();await dir.removeEntry(path);return true}catch{return false}}
export async function cleanOldExports(keepPath){let removed=0;try{const dir=await renderDirectory();for await(const [name,handle]of dir.entries())if(handle.kind==='file'&&name!==keepPath){await dir.removeEntry(name);removed++}}catch{}return removed}
export async function exportStorageInfo(){let count=0,bytes=0;try{const dir=await renderDirectory();for await(const handle of dir.values())if(handle.kind==='file'){count++;bytes+=(await handle.getFile()).size}}catch{}return{count,bytes}}
export async function rememberedExport(){try{const info=JSON.parse(localStorage.getItem('pve.iphone.last-export'));if(!info)return null;const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('pve-iphone-renders'),handle=await dir.getFileHandle(info.path);return{...info,file:await handle.getFile()}}catch{return null}}
export async function rememberExport(result,name){let previous,saved=false;try{previous=JSON.parse(localStorage.getItem('pve.iphone.last-export'));localStorage.setItem('pve.iphone.last-export',JSON.stringify({path:result.path,width:result.width,height:result.height,fps:result.fps,duration:result.duration,name}));saved=true}catch{}if(saved&&previous?.path&&previous.path!==result.path)await deleteRender(previous.path)}
let activeDownload;
export function confirmDeviceResultClose({modal,restore,onReturn=()=>{},dialog=document.querySelector('#modal')}){
 modal(`<div class="modal-top"><h2>このウインドウを閉じますか？</h2></div><p>完成したMP4の保存先を確認してから閉じてください。編集内容は保持されます。</p><div class="modal-actions"><button id="keepExportResult">書き出し結果へ戻る</button><button id="confirmCloseExportResult" class="primary">閉じる</button></div>`);
 document.querySelector('#keepExportResult').onclick=restore;
 document.querySelector('#confirmCloseExportResult').onclick=()=>{for(const media of (dialog.querySelectorAll?.('video,audio')||[]))media.pause();onReturn();dialog.close()};
}
export function showDeviceResult(result,name,{modal,head,esc,status,onReturn}){
 activeDownload?.dispose();const file=new File([result.file],safeName(name,'mp4'),{type:'video/mp4'});activeDownload=downloadable(file);const url=activeDownload.url;
 const content=head('MP4を作成しました')+`<video controls playsinline src="${url}" style="width:100%;max-height:40dvh;background:#000"></video><p class="mono">${result.width} × ${result.height} · ${result.fps} FPS · ${(result.file.size/1e6).toFixed(1)} MB</p>${Number.isFinite(result.elapsedSeconds)?`<p class="small-note">処理時間 ${result.elapsedSeconds.toFixed(1)}秒</p>`:''}${(result.notes||[]).map(note=>`<p class="small-note">${esc(note)}</p>`).join('')}<div class="save-actions"><button id="shareMovie" class="primary">写真・ファイルへ保存</button><a class="download-link" href="${url}" download="${esc(file.name)}">ファイルとして保存 ↓</a></div><p id="deviceSaveStatus" role="status" class="small-note">共有画面で「ビデオを保存」を選ぶと「写真」へ、「ファイルに保存」を選ぶと本体やiCloud Driveへ保存できます。項目はiOSとブラウザにより異なります。</p>${result.test?'':'<p class="small-note">端末内に直近の書き出しを保持しています。再度開くにはIMPORTの「前回のMP4を開く」。</p>'}`;
 const showResult=()=>{modal(content);const button=document.querySelector('#shareMovie');if(!canShareFile(file)){button.disabled=true;document.querySelector('#deviceSaveStatus').textContent='共有保存に未対応です。「ファイルとして保存」を選んでください。iPhoneではSafariで開くと共有保存を利用できる場合があります。'}
  button.onclick=async()=>{try{await shareFile(file);document.querySelector('#deviceSaveStatus').textContent='共有先で保存をご確認ください。';}catch(e){if(e.name!=='AbortError')document.querySelector('#deviceSaveStatus').textContent=e.message;}};
  const close=document.querySelector('#modalContent .modal-top [data-close]');if(close)close.onclick=()=>confirmDeviceResultClose({modal,restore:showResult,onReturn});
 };
 showResult();
 status('MP4を作成しました。保存先を選んでください。');
}
