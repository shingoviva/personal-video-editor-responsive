// A pending video seek cannot prevent audio envelopes / clip switches updating.
export class PreviewPlaybackScheduler {
 constructor(){this.generation=0;this.reset()}
 reset(){this.generation++;this.audioAt=this.videoAt=-Infinity;this.pending=null}
 step(now,{audio,video,onError=()=>{}}){
  if(now-this.audioAt>=50){this.audioAt=now;audio()}
  if(now-this.videoAt<50||this.pending)return;
  this.videoAt=now;const generation=this.generation;
  const pending=Promise.resolve().then(()=>{if(generation===this.generation)return video()}).catch(error=>{if(generation===this.generation)onError(error)}).finally(()=>{if(this.pending===pending)this.pending=null});this.pending=pending;
 }
}
