import {clipPreviewBounds,movePreviewClip,resizePreviewClip} from './preview-transform-geometry.js';
import {clamp} from './model.js?v=2.2.72';

export function centeredTransform(origin,dx,dy,width,height,threshold=8,direction=-1){
 let x=clamp((origin.x??.5)+direction*dx/Math.max(width,1),0,1),y=clamp((origin.y??.5)+direction*dy/Math.max(height,1),0,1),snapX=false,snapY=false;
 if(Math.abs(x-.5)*width<=threshold){x=.5;snapX=true}if(Math.abs(y-.5)*height<=threshold){y=.5;snapY=true}
 return{x,y,snapX,snapY};
}
export function scaleFromWheel(scale,delta){return clamp((scale??1)*Math.exp(-delta*.002),.1,3)}
export function scaleFromDrag(scale,dx,dy){return clamp((scale??1)*Math.exp((dx-dy)*.006),.1,3)}

// Match the source bounds to the project frame, using screen pixels for tolerance.
export function snapScaleToFrame(scale,clip,frame,source={},threshold=8){
 const width=Math.max(1,frame.width),height=Math.max(1,frame.height),ar=width/height,sourceAr=source.width>0&&source.height>0?source.width/source.height:ar;
 const axes=[{base:Math.max(1,sourceAr/ar),size:width,position:clip.x??.5,edges:['left','right']},{base:Math.max(1,ar/sourceAr),size:height,position:clip.y??.5,edges:['top','bottom']}];
 let best=null;
 for(const axis of axes){const target=1/axis.base;if(target<.1||target>3)continue;
  const factors=[axis.position,1-axis.position].filter(v=>v>1e-6);
  const distance=Math.max(...factors.map(v=>Math.abs(axis.base*scale-1)*axis.size*v));
  if(distance<=threshold&&(!best||distance<best.distance))best={scale:target,distance};
 }
 if(!best){
  const next={scale,snapEdges:[]};
  for(const [i,axis] of axes.entries()){
   const span=axis.base*scale,offset=(1-span)*axis.position*axis.size,end=offset+span*axis.size-axis.size;
   const edge=Math.abs(offset)<=Math.abs(end)?0:1,distance=Math.abs(edge?end:offset);
   if(distance<=threshold){next.snapEdges.push(axis.edges[edge]);next[i?'y':'x']=edge;}
  }
  return next;
 }
 const snapEdges=[];for(const axis of axes){const span=axis.base*best.scale;
  if(Math.abs((1-span)*axis.position)*axis.size<.5)snapEdges.push(axis.edges[0]);
  if(Math.abs((span-1)*(1-axis.position))*axis.size<.5)snapEdges.push(axis.edges[1]);
 }
 return {scale:best.scale,snapEdges};
}

export function bindStageTransform({root,getClip,enabled,begin,change,finish,guides,status=()=>{},direction=()=>-1,allowScale=()=>true,select=()=>{},scaleHandle=null,getSource=()=>({}),direct=()=>false,getFrame=()=>root.getBoundingClientRect()}){
 let drag=null,wheelTimer=null,wheelScale=null;
 root.addEventListener('pointerdown',event=>{if(drag||event.target.closest('[id=regionZoomFrame],#emptyState'))return;if(event.button!==0||event.pointerType==='touch'&&event.isPrimary===false)return;select(event);if(!enabled())return;const clip=getClip();if(!clip)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,origin:{x:clip.x??.5,y:clip.y??.5,scale:clip.scale??1,offsetX:clip.offsetX||0,offsetY:clip.offsetY||0},handle:event.target.closest('[data-transform-handle]')?.dataset.transformHandle||'se',direct:direct(),scale:!!event.target.closest('[data-transform-handle]')||!!scaleHandle?.contains(event.target),moved:false};root.setPointerCapture?.(event.pointerId)},true);
 root.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y,rect=getFrame(),distance=Math.hypot(dx,dy);if(!drag.moved&&distance<4)return;if(!drag.moved){drag.moved=true;begin()}if(drag.direct){const next=drag.scale?resizePreviewClip(drag.origin,drag.handle,dx,dy,rect,getSource(),!!event.altKey):movePreviewClip(drag.origin,dx,dy,rect,getSource());change(next);guides(next);status(drag.scale?`サイズ ${next.scale.toFixed(2)}×`:'位置を調整中')}else if(drag.scale){const next=snapScaleToFrame(scaleFromDrag(drag.origin.scale,dx,dy),drag.origin,rect,getSource());change({x:drag.origin.x,y:drag.origin.y,...next});guides(next);status(`サイズ ${next.scale.toFixed(2)}×${next.snapEdges.length?' · 画面枠に吸着':''}`)}else{const next=centeredTransform(drag.origin,dx,dy,rect.width,rect.height,8,direction());change(next);guides(next);status(`位置 X ${next.x.toFixed(2)} · Y ${next.y.toFixed(2)}${next.snapX||next.snapY?' · 中央に吸着':''}`)}event.preventDefault()},true);
 const end=event=>{if(!drag||event.pointerId!==drag.id)return;const moved=drag.moved;drag=null;guides(null);if(moved)finish()};root.addEventListener('pointerup',end,true);root.addEventListener('pointercancel',end,true);root.addEventListener('lostpointercapture',end,true);
 root.addEventListener('wheel',event=>{if(!enabled()||!allowScale()||!(event.ctrlKey||event.metaKey))return;event.preventDefault();const clip=getClip();if(!clip)return;if(!wheelTimer){begin();wheelScale=clip.scale??1}wheelScale=scaleFromWheel(wheelScale,event.deltaY);const frame=getFrame(),bounds=clipPreviewBounds(clip,frame,getSource()),factor=wheelScale/(clip.scale||1),next=direct()?resizePreviewClip(clip,'se',bounds.width*(factor-1)/2,bounds.height*(factor-1)/2,frame,getSource(),true):snapScaleToFrame(wheelScale,clip,frame,getSource());change(next);guides(next);status(`サイズ ${next.scale.toFixed(2)}×${next.snapEdges.length?' · 画面枠に吸着':''}`);clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{wheelTimer=null;wheelScale=null;guides(null);finish()},140)},{passive:false});
 for(const name of ['gesturestart','gesturechange','gestureend'])root.addEventListener(name,event=>event.preventDefault(),{passive:false});
}
