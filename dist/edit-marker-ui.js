// Marker gestures own their pointer; a click selects without opening a dialog.
export function bindEditMarker(element,{getTime,getGeometry,select,begin,move,finish,cancel,edit}){
 let suppressClick=false;
 element.onpointerdown=event=>{
  if(event.button!==0)return;event.preventDefault();event.stopPropagation();select();
  const geometry=getGeometry(),origin=getTime(),x=event.clientX,id=event.pointerId;let changed=false,ended=false;
  element.setPointerCapture?.(id);
  const cleanup=()=>{element.onpointermove=element.onpointerup=element.onpointercancel=element.onlostpointercapture=null;try{element.releasePointerCapture?.(id)}catch{}};
  element.onpointermove=next=>{if(next.pointerId!==id)return;next.preventDefault();next.stopPropagation();if(!changed&&Math.abs(next.clientX-x)<4)return;if(!changed){begin();changed=true}move(Math.max(0,Math.min(geometry.duration,origin+(next.clientX-x)/Math.max(1,geometry.width)*geometry.duration)),next)};
  const end=(next,aborted=false)=>{if(ended||next.pointerId!==id)return;ended=true;next.preventDefault?.();next.stopPropagation?.();suppressClick=true;cleanup();if(aborted){if(changed)cancel()}else finish(changed)};
  element.onpointerup=event=>end(event);element.onpointercancel=event=>end(event,true);element.onlostpointercapture=event=>end(event,true);
 };
 element.onclick=event=>{event.stopPropagation();if(suppressClick){suppressClick=false;return}select();finish(false)};
 element.ondblclick=event=>{event.preventDefault();event.stopPropagation();edit()};
 element.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();select();edit()};
}
