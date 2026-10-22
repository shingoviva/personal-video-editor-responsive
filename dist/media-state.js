import {activeDiagnostics} from './preview-diagnostics.js?v=2.2.81';
// Media lifecycle helpers. Register before changing src / currentTime.
export function waitForMedia(media,event,{signal,timeout=20000,ready,start}={}){
  if(signal?.aborted)return Promise.reject(new DOMException('処理をキャンセルしました。','AbortError'));
  if(ready?.())return Promise.resolve();
  return new Promise((resolve,reject)=>{
    let timer;
    const clean=()=>{clearTimeout(timer);media.removeEventListener(event,done);media.removeEventListener('error',failed);signal?.removeEventListener('abort',aborted)};
    const done=()=>{clean();resolve()};
    const failed=()=>{clean();reject(new Error('動画を読み込めません。Mac版でプロキシを生成するか、素材を再リンクしてください。'))};
    const aborted=()=>{clean();reject(new DOMException('処理をキャンセルしました。','AbortError'))};
    media.addEventListener(event,done,{once:true});media.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',aborted,{once:true});
    timer=setTimeout(()=>{clean();reject(new Error('素材の読み込みがタイムアウトしました。もう一度お試しください。'))},timeout);
    try{start?.()}catch(error){clean();reject(error)}
  });
}
export async function seekMedia(media,time,options={}){
  if(Math.abs(media.currentTime-time)<.00001&&media.readyState>=2&&!media.seeking)return;
  await waitForMedia(media,'seeked',{...options,start:()=>{media.currentTime=time}});
}

// seeked can fire before the newly decoded picture is available to WebGL.
// Keep the old surface until the requested video frame has been presented.
const pendingVideoFrames=new WeakMap();
export function cancelVideoFrame(media){pendingVideoFrames.get(media)?.controller.abort()}
export function videoFrameReady(media){return media.readyState>=2&&!media.seeking&&!pendingVideoFrames.has(media)}
export function seekVideoFrame(media,time,options={}){
 const diagnostic=activeDiagnostics,diagnosticStart=diagnostic?performance.now():null,diagnosticRun=diagnostic?.active?.id;diagnostic?.count('seekRequests');
 if(options.signal?.aborted)return Promise.reject(new DOMException('処理をキャンセルしました。','AbortError'));
 const previous=pendingVideoFrames.get(media),controller=new AbortController(),request={controller};previous?.controller.abort();
 const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});pendingVideoFrames.set(media,request);
 const run=()=>seekPresentedFrame(media,time,{...options,signal:controller.signal});
 request.job=(previous?previous.job.catch(()=>{}).then(run):run()).then(value=>{if(diagnostic?.measuring&&activeDiagnostics===diagnostic&&diagnostic.active.id===diagnosticRun)diagnostic.sample('seekLatency',performance.now()-diagnosticStart);return value}).finally(()=>{options.signal?.removeEventListener('abort',abort);if(pendingVideoFrames.get(media)===request)pendingVideoFrames.delete(media)});
 return request.job;
}
async function seekPresentedFrame(media,time,{fps=30,timeout=8000,signal}={}){
  if(signal?.aborted)throw new DOMException('処理をキャンセルしました。','AbortError');
  if(!media.requestVideoFrameCallback||Math.abs(media.currentTime-time)<.00001&&media.readyState>=2&&!media.seeking)return seekMedia(media,time,{timeout,signal});
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  let callback,timer,onAbort;
  const frame=new Promise((resolve,reject)=>{
    onAbort=()=>reject(new DOMException('処理をキャンセルしました。','AbortError'));
    controller.signal.addEventListener('abort',onAbort,{once:true});
    timer=setTimeout(()=>reject(new Error('映像フレームの準備がタイムアウトしました。もう一度お試しください。')),timeout);
    const presented=(_now,metadata)=>{
      if(controller.signal.aborted)return;
      if(Math.abs(metadata.mediaTime-time)<=1/Math.max(1,fps)+.005)resolve();
      else callback=media.requestVideoFrameCallback(presented);
    };
    callback=media.requestVideoFrameCallback(presented);
  });
  try{await Promise.all([seekMedia(media,time,{timeout,signal:controller.signal}),frame])}
  finally{clearTimeout(timer);if(callback!==undefined)media.cancelVideoFrameCallback?.(callback);controller.signal.removeEventListener('abort',onAbort);signal?.removeEventListener('abort',abort);controller.abort()}
}
