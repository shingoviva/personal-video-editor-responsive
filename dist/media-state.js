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
const pendingVideoFrames=new WeakSet();
export function videoFrameReady(media){return media.readyState>=2&&!media.seeking&&!pendingVideoFrames.has(media)}
export async function seekVideoFrame(media,time,{fps=30,timeout=8000,signal}={}){
  if(signal?.aborted)throw new DOMException('処理をキャンセルしました。','AbortError');
  if(!media.requestVideoFrameCallback||Math.abs(media.currentTime-time)<.00001&&media.readyState>=2&&!media.seeking)return seekMedia(media,time,{timeout,signal});
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});pendingVideoFrames.add(media);
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
  finally{clearTimeout(timer);if(callback!==undefined)media.cancelVideoFrameCallback?.(callback);controller.signal.removeEventListener('abort',onAbort);signal?.removeEventListener('abort',abort);controller.abort();pendingVideoFrames.delete(media)}
}
