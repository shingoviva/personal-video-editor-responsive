import {activeDiagnostics} from './preview-diagnostics.js?v=2.2.85';
// Audio automation runs independently from video loading. A clip identity
// change cancels the old video request; it never waits behind an obsolete seek.
export class PreviewPlaybackScheduler {
 constructor(){this.generation=0;this.reset()}
 reset(){this.generation++;this.videoGeneration=(this.videoGeneration||0)+1;this.audioAt=this.videoAt=-Infinity;this.pending=null;this.videoKey=undefined}
 step(now,{audio,video,key,urgent=false,cancelVideo=()=>{},onError=()=>{}}){
  const diagnosticStart=activeDiagnostics?.begin('sync.control');try{
  if(now-this.audioAt>=50){this.audioAt=now;audio()}
  if(key!==undefined&&key!==this.videoKey){this.videoKey=key;this.videoGeneration++;this.videoAt=-Infinity;if(this.pending){cancelVideo();this.pending=null}}
  if((!urgent&&now-this.videoAt<50)||this.pending)return;
  this.videoAt=now;const generation=this.generation,videoGeneration=this.videoGeneration;
  const current=()=>generation===this.generation&&videoGeneration===this.videoGeneration;
  const pending=Promise.resolve().then(()=>{if(current())return video()}).catch(error=>{if(current())onError(error)}).finally(()=>{if(this.pending===pending)this.pending=null});this.pending=pending;
 }finally{activeDiagnostics?.end('sync.control',diagnosticStart)}
 }
}
