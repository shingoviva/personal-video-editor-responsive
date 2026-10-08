import {clamp} from './model.js';

export function centeredTransform(origin,dx,dy,width,height,threshold=8,direction=-1){
 let x=clamp((origin.x??.5)+direction*dx/Math.max(width,1),0,1),y=clamp((origin.y??.5)+direction*dy/Math.max(height,1),0,1),snapX=false,snapY=false;
 if(Math.abs(x-.5)*width<=threshold){x=.5;snapX=true}if(Math.abs(y-.5)*height<=threshold){y=.5;snapY=true}
 return{x,y,snapX,snapY};
}
export function scaleFromWheel(scale,delta){return clamp((scale??1)*Math.exp(-delta*.002),.1,3)}
export function scaleFromDrag(scale,dx,dy){return clamp((scale??1)*Math.exp((dx-dy)*.006),.1,3)}

export function bindStageTransform({root,getClip,enabled,begin,change,finish,guides,status=()=>{},direction=()=>-1,allowScale=()=>true,select=()=>{},scaleHandle=null}){
 let drag=null,wheelTimer=null;
 root.addEventListener('pointerdown',event=>{if(event.button!==0||event.pointerType==='touch'&&event.isPrimary===false)return;select(event);if(!enabled())return;const clip=getClip();if(!clip)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,origin:{x:clip.x??.5,y:clip.y??.5,scale:clip.scale??1},scale:!!scaleHandle?.contains(event.target),moved:false};root.setPointerCapture?.(event.pointerId)},true);
 root.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y,rect=root.getBoundingClientRect(),distance=Math.hypot(dx,dy);if(!drag.moved&&distance<4)return;if(!drag.moved){drag.moved=true;begin()}if(drag.scale){const scale=scaleFromDrag(drag.origin.scale,dx,dy);change({scale});guides({scale});status(`サイズ ${scale.toFixed(2)}×`)}else{const next=centeredTransform(drag.origin,dx,dy,rect.width,rect.height,8,direction());change(next);guides(next);status(`位置 X ${next.x.toFixed(2)} · Y ${next.y.toFixed(2)}${next.snapX||next.snapY?' · 中央に吸着':''}`)}event.preventDefault()},true);
 const end=event=>{if(!drag||event.pointerId!==drag.id)return;const moved=drag.moved;drag=null;guides(null);if(moved)finish()};root.addEventListener('pointerup',end,true);root.addEventListener('pointercancel',end,true);
 root.addEventListener('wheel',event=>{if(!enabled()||!allowScale()||!(event.ctrlKey||event.metaKey))return;event.preventDefault();if(!wheelTimer)begin();const clip=getClip(),next=scaleFromWheel(clip.scale,event.deltaY);change({scale:next});status(`サイズ ${next.toFixed(2)}×`);clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{wheelTimer=null;finish()},140)},{passive:false});
 for(const name of ['gesturestart','gesturechange','gestureend'])root.addEventListener(name,event=>event.preventDefault(),{passive:false});
}
