import {normalizeRegionZoom} from './region-zoom.js?v=2.2.83';
export function regionZoomDrag(initial,dx,dy,resize=false){return normalizeRegionZoom({...initial,...(resize?{zoomSize:initial.zoomSize+2*(Math.abs(dx)>Math.abs(dy)?dx:dy)}:{zoomX:initial.zoomX+dx,zoomY:initial.zoomY+dy})})}
// Keep the phone's full touch target inside the picture, even at 10× zoom.
export function regionZoomHandlePosition(effect,width,height,target=44){
 const e=normalizeRegionZoom(effect),left=(e.zoomX-e.zoomSize/2)*width,top=(e.zoomY-e.zoomSize/2)*height;
 const cornerX=(e.zoomX+e.zoomSize/2)*width,cornerY=(e.zoomY+e.zoomSize/2)*height;
 const handleLeft=Math.max(0,Math.min(Math.max(0,width-target-2),cornerX-target/2)),handleTop=Math.max(0,Math.min(Math.max(0,height-target-2),cornerY-target/2));
 const labelLeft=Math.max(0,Math.min(Math.max(0,width-74),handleLeft>=78?handleLeft-78:handleLeft+target+4));
 return{left:handleLeft-left,top:handleTop-top,labelLeft:labelLeft-left,labelTop:handleTop-top,compact:e.zoomSize*width<74||e.zoomSize*height<44};
}
export function bindRegionZoomFrame(frame,{getEffect,begin,change,finish}){
 let active=false;
 frame.addEventListener('pointerdown',event=>{
  const effect=getEffect();if(active||!effect||event.button!==0||event.isPrimary===false)return;
  const rect=frame.parentElement.getBoundingClientRect();if(!rect.width||!rect.height)return;
  event.preventDefault();event.stopPropagation();
  const initial=normalizeRegionZoom(effect),x=event.clientX,y=event.clientY,id=event.pointerId,resize=!!event.target.closest('[data-zoom-resize]');
  active=true;begin();frame.setPointerCapture(id);
  frame.onpointermove=ev=>{
   if(ev.pointerId!==id)return;ev.preventDefault();ev.stopPropagation();
   change(regionZoomDrag(initial,(ev.clientX-x)/rect.width,(ev.clientY-y)/rect.height,resize));
  };
  const end=ev=>{
   if(ev.pointerId!==id||!active)return;ev.preventDefault();ev.stopPropagation();active=false;
   frame.onpointermove=frame.onpointerup=frame.onpointercancel=frame.onlostpointercapture=null;
   try{frame.releasePointerCapture(id)}catch{}
   finish(ev.type!=='pointerup',initial);
  };
  frame.onpointerup=end;frame.onpointercancel=end;frame.onlostpointercapture=end;
 });
}
