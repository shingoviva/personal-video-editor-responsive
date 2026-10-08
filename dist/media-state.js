// Media lifecycle helpers. Register before changing src / currentTime.
export function waitForMedia(media,event,{signal,timeout=20000,ready}={}){
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
  });
}
export async function seekMedia(media,time,options={}){
  if(Math.abs(media.currentTime-time)<.00001&&media.readyState>=2&&!media.seeking)return;
  const pending=waitForMedia(media,'seeked',options);media.currentTime=time;await pending;
}
