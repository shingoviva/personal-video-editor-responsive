import {waitForMedia,seekVideoFrame} from './media-state.js?v=2.2.79';
// Owns only the standby decoder. Claiming it cancels and drains the old
// preparation before playback may write its src/currentTime.
export class PreviewPreloader{
 prime(target,key,url,position,fps=30){
  if(this.request?.target===target&&this.request.key===key)return this.request.job;
  const previous=this.cancel(),controller=new AbortController(),request={target,key,controller};this.request=request;
  request.job=(async()=>{
   await previous;if(this.request!==request)return false;
   target.pause();target.dataset.key=key;
   if(target.dataset.url!==url){target.dataset.url=url;target.src=url;target.load()}
   await waitForMedia(target,'loadeddata',{signal:controller.signal,timeout:8000,ready:()=>target.readyState>=2});
   if(this.request!==request)return false;
   await seekVideoFrame(target,position,{fps,signal:controller.signal,timeout:8000});
   request.ready=this.request===request;return request.ready;
  })().catch(()=>false);
  return request.job;
 }
 cancel(){const request=this.request;this.request=null;request?.controller.abort();return request?.job||Promise.resolve(false)}
 claim(target,key){if(this.request?.target!==target)return Promise.resolve(false);const prepared=this.request.ready&&this.request.key===key;return this.cancel().then(()=>!!prepared)}
}
