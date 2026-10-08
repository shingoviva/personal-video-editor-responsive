import {clamp} from './model.js';

export function zoomFromPinch(startZoom,startDistance,currentDistance,min=1,max=10){
 return clamp(startZoom*Math.max(currentDistance,1)/Math.max(startDistance,1),min,max);
}

export function anchoredScroll(anchorRatio,contentWidth,viewportPoint,viewportWidth){
 return clamp(anchorRatio*contentWidth-viewportPoint,0,Math.max(0,contentWidth-viewportWidth));
}

export function bindTimelinePinch({root,getZoom,setZoom,render,status=()=>{},min=1,max=10}){
 const pointers=new Map();let gesture=null;
 const point=e=>({id:e.pointerId,x:e.clientX,y:e.clientY,target:e.target});
 const geometry=()=>{const values=[...pointers.values()],a=values[0],b=values[1];return{distance:Math.hypot(a.x-b.x,a.y-b.y),center:(a.x+b.x)/2}};
 const cancelEditorGesture=pointer=>{try{pointer.target?.onpointercancel?.({pointerId:pointer.id})}catch{}try{pointer.target?.releasePointerCapture?.(pointer.id)}catch{}};
 root.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch')return;pointers.set(e.pointerId,point(e));
  if(pointers.size===2){
   const g=geometry(),rect=root.getBoundingClientRect(),contentWidth=Math.max(root.scrollWidth,root.clientWidth);
   gesture={startZoom:getZoom(),startDistance:g.distance,anchorRatio:(root.scrollLeft+g.center-rect.left)/contentWidth};
   for(const p of pointers.values())cancelEditorGesture(p);
   for(const id of pointers.keys())try{root.setPointerCapture(id)}catch{}
   e.preventDefault();e.stopPropagation();status('ピンチでタイムラインの細かさを調整');
  }
 },{capture:true,passive:false});
 root.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,point(e));if(!gesture||pointers.size<2)return;
  const g=geometry(),rect=root.getBoundingClientRect(),next=zoomFromPinch(gesture.startZoom,gesture.startDistance,g.distance,min,max);
  setZoom(next);render();root.scrollLeft=anchoredScroll(gesture.anchorRatio,root.scrollWidth,g.center-rect.left,root.clientWidth);
  e.preventDefault();e.stopPropagation();
 },{capture:true,passive:false});
 const end=e=>{if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(pointers.size<2)gesture=null};
 root.addEventListener('pointerup',end,{capture:true});root.addEventListener('pointercancel',end,{capture:true});
 root.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();const rect=root.getBoundingClientRect(),point=e.clientX-rect.left,contentWidth=Math.max(root.scrollWidth,root.clientWidth),anchor=(root.scrollLeft+point)/contentWidth,next=clamp(getZoom()*Math.exp(-e.deltaY*.01),min,max);setZoom(next);render();root.scrollLeft=anchoredScroll(anchor,root.scrollWidth,point,root.clientWidth);status('トラックパッドでタイムラインの細かさを調整')},{passive:false});
 let safariGesture=null;root.addEventListener('gesturestart',e=>{e.preventDefault();const rect=root.getBoundingClientRect(),point=(e.clientX??rect.left+root.clientWidth/2)-rect.left,contentWidth=Math.max(root.scrollWidth,root.clientWidth);safariGesture={zoom:getZoom(),point,anchor:(root.scrollLeft+point)/contentWidth}},{passive:false});
 root.addEventListener('gesturechange',e=>{e.preventDefault();if(!safariGesture)return;setZoom(clamp(safariGesture.zoom*(e.scale||1),min,max));render();root.scrollLeft=anchoredScroll(safariGesture.anchor,root.scrollWidth,safariGesture.point,root.clientWidth);status('トラックパッドでタイムラインの細かさを調整')},{passive:false});
 root.addEventListener('gestureend',e=>{e.preventDefault();safariGesture=null},{passive:false});
 return()=>{pointers.clear();gesture=null};
}
