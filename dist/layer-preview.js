import {needsPreviewSeek,previewMediaEnded} from './playback-sync.js?v=2.2.43';
import {renderer} from './preview.js?v=2.2.28';
import {StillPreview} from './image-media.js';
import {waitForMedia} from './media-state.js?v=2.2.49';
import {sourceOffset,timing} from './model.js';
import {clipAlpha} from './creative.js';
import {motionTransform} from './motion-transform.js';
// A second decoder exists only while an upper layer reveals the lower picture.
export class LayerPreview{
 constructor(canvas){this.generation=0;this.canvas=canvas;this.painter=renderer(canvas);this.still=new StillPreview();this.video=document.createElement('video');this.video.muted=true;this.video.playsInline=true;this.video.preload='auto';this.video.onseeked=()=>this.paint();this.video.onloadeddata=()=>this.paint();}
 async update(row,t,m,url,file,aspect,compare,playing,stabilization=null,previewLongEdge=960){
  if(!row||!url){this.clear();return}
  this.canvas.style.opacity=String(clipAlpha(row,t));
  if(this.busy){this.pending=[row,t,m,url,file,aspect,compare,playing,stabilization,previewLongEdge];return}
  const generation=this.generation;this.state={row,t,m,aspect,compare,stabilization,previewLongEdge};this.busy=true;try{
   if(m.kind==='image'){this.video.pause();await this.still.load(url,async()=>file||await fetch(url).then(r=>r.blob()),m);}
   else{
    this.still.clear();
    if(this.url!==url){this.controller?.abort();this.controller=new AbortController();const ready=waitForMedia(this.video,'loadedmetadata',{signal:this.controller.signal});this.url=url;this.video.src=url;this.video.load();await ready}
    if(generation!==this.generation)return;
    const c=row.clip,local=Math.max(0,t-row.start),source=c.freezeAt??Math.min(c.out-.00001,c.in+sourceOffset(local,c)),tm=timing(c),i=tm.nodes.findIndex(n=>n[1]>=local),speed=tm.pieces[Math.max(0,i-1)]?.[2]||1;
    const reachedEnd=previewMediaEnded(this.video,`${c.id}|${url}`,{playing});if(!reachedEnd&&needsPreviewSeek(this.video,source,{playing,still:!!c.freezeDuration||speed<.25||speed>4,fps:m.fps||30}))this.video.currentTime=source;
    if(playing&&!reachedEnd&&!this.video.ended&&!c.freezeDuration&&local<tm.nodes.at(-1)[1]&&speed>=.25&&speed<=4){if(this.video.playbackRate!==speed)this.video.playbackRate=speed;if(this.video.paused)await this.video.play().catch(()=>{})}else this.video.pause();
   }
   if(generation!==this.generation){this.video.pause();return}
   if(!this.pending)this.paint();
  }catch{if(generation===this.generation)this.painter?.black()}finally{this.busy=false;if(this.pending){const next=this.pending;this.pending=null;this.update(...next)}}
 }
 paint(){const s=this.state;if(!s?.row||this.video.seeking||s.m.kind!=='image'&&this.url!==this.video.getAttribute('src'))return;const source=s.m.kind==='image'?this.still.bitmap:this.video;if(source)this.painter?.draw(source,motionTransform(s.row.clip,s.t-s.row.start,s.row.duration),s.aspect,s.compare,s.stabilization,s.previewLongEdge)}
 clear(){this.generation++;this.state=null;this.pending=null;this.canvas.style.opacity='0';this.video.pause();this.controller?.abort();if(this.url){this.video.removeAttribute('src');this.video.load();this.url=null}this.still.clear();this.painter?.release?.();}
 pause(){this.generation++;if(this.pending)this.pending[7]=false;this.video.pause()}
 dispose(){this.clear();this.painter?.dispose()}
}
