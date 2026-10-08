// Runtime preview only. Export canvases keep their explicit output dimensions.
export class PhonePreviewBudget {
 constructor(){this.reset()}
 reset(){this.tier=0;this.slow=0;this.fast=0}
 get longEdge(){return [960,720,540][this.tier]}
 get interval(){return 1000/[24,20,15][this.tier]}
 observe(milliseconds){
  if(!Number.isFinite(milliseconds)||milliseconds<0)return;
  if(milliseconds>this.interval*.65){this.slow++;this.fast=0;if(this.slow>=3){this.tier=Math.min(2,this.tier+1);this.slow=0}}
  else if(milliseconds<this.interval*.25){this.fast++;this.slow=0;if(this.fast>=60){this.tier=Math.max(0,this.tier-1);this.fast=0}}
  else{this.slow=0;this.fast=0}
 }
}
// A pending video seek cannot prevent audio envelopes / clip switches updating.
export class PhonePlaybackScheduler {
 constructor(){this.generation=0;this.reset()}
 reset(){this.generation++;this.audioAt=this.videoAt=-Infinity;this.pending=null}
 step(now,{audio,video,onError=()=>{}}){
  if(now-this.audioAt>=50){this.audioAt=now;audio()}
  if(now-this.videoAt<50||this.pending)return;
  this.videoAt=now;const generation=this.generation;
  const pending=Promise.resolve().then(()=>{if(generation===this.generation)return video()}).catch(error=>{if(generation===this.generation)onError(error)}).finally(()=>{if(this.pending===pending)this.pending=null});this.pending=pending;
 }
}
