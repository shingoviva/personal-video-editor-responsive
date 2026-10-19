// One output clock per playback session. Decoder selection and seek completion
// never redefine it. Prefer the running audio device clock; otherwise use wall time.
export class PreviewPlaybackClock{
 start(position,{now=performance.now(),context=null}={}){
  this.position=this.last=position;this.context=context?.state==='running'&&Number.isFinite(context.currentTime)?context:null;
  this.anchor=this.context?this.context.currentTime:now/1000;this.running=true;return position;
 }
 read(now=performance.now()){
  if(!this.running)return this.last??0;
  const clock=this.context?this.context.currentTime:now/1000;
  if(Number.isFinite(clock))this.last=Math.max(this.last,this.position+Math.max(0,clock-this.anchor));
  return this.last;
 }
 get interrupted(){return !!(this.running&&this.context&&this.context.state!=='running')}
 stop(){this.running=false}
}
