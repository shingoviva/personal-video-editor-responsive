// One touch owner: swipe scrolls, holding a clip opens actions, then moving drags.
export function bindPhoneTouch({root,scroll,isPhone,onMenu,onDrag,onHideMenu,getZoom=()=>1,setZoom=()=>{},delegatePointer=()=>false,onDoubleTap=()=>false,holdMs=380}){
 let g=null,timer=null,raf=0,suppressClick=false,lastTap=null;
 const stop=()=>{clearTimeout(timer);cancelAnimationFrame(raf);raf=0};
 const eventAt=(e,compensate=false,state=g)=>({button:0,pointerType:'touch',pointerId:state.id,clientX:e.clientX+(compensate?scroll.scrollLeft-state.left:0),clientY:e.clientY,target:state.clip||e.target,timelineTouchManaged:true,preventDefault(){},stopPropagation(){}});
 const tick=()=>{if(!g?.dragging)return;const r=scroll.getBoundingClientRect(),p=g.point,dx=p.clientX<r.left+28?-9:p.clientX>r.right-28?9:0,dy=p.clientY<r.top+28?-8:p.clientY>r.bottom-28?8:0;scroll.scrollLeft+=dx;scroll.scrollTop+=dy;if(dx||dy)g.clip.onpointermove?.(eventAt(p,true));raf=requestAnimationFrame(tick)};
 const release=state=>{for(const id of [state.id,state.pinch?.id])if(id!==undefined)try{root.releasePointerCapture(id)}catch{}};
 const clearMode=state=>{if(!state.wasMoving)document.body.classList.remove('phone-moving');document.body.classList.remove('phone-drag-video','phone-drag-audio','phone-drag-overlay')};
 const reset=()=>{lastTap=null;if(!g)return;const state=g;g=null;stop();clearMode(state);if(state.dragging)state.clip.onpointercancel?.(eventAt(state.point,true,state));release(state);onHideMenu()};
 root.addEventListener('lostpointercapture',e=>{if(e.target===root&&(e.pointerId===g?.id||e.pointerId===g?.pinch?.id))reset()});
 root.addEventListener('pve-phone-interaction-reset',reset);
 globalThis.addEventListener?.('blur',reset);
 globalThis.addEventListener?.('pagehide',reset);
 root.addEventListener('pointerdown',e=>{if(!isPhone()||e.pointerType!=='touch')return;if(g&&e.isPrimary===true)reset();if(g){if(g.pinch)return;e.preventDefault();e.stopImmediatePropagation();stop();if(g.dragging)g.clip.onpointercancel?.(eventAt(g.point,true));g.pinch={id:e.pointerId,point:e,distance:Math.max(1,Math.hypot(e.clientX-g.point.clientX,e.clientY-g.point.clientY)),zoom:getZoom()};g.dragging=false;g.moved=true;root.setPointerCapture(e.pointerId);return;}const clip=e.target.closest('[data-clip],[data-fx],[data-text-chip]');if(delegatePointer(clip,e)){lastTap=null;return;}if(e.target.closest('[data-edge],[data-overlay-edge],[data-lane-resize],[data-edit-marker],#playheadHandle,#ruler'))return;e.preventDefault();e.stopImmediatePropagation();g={id:e.pointerId,clip,lane:e.target.closest('.video-track,.editable-audio,.overlay-track'),x:e.clientX,y:e.clientY,left:scroll.scrollLeft,top:scroll.scrollTop,point:e,held:false,dragging:false,moved:false,selected:clip?.classList?.contains('selected'),wasMoving:document.body.classList.contains('phone-moving')};if(g.wasMoving&&clip)g.held=true;root.setPointerCapture(e.pointerId);if(clip)timer=setTimeout(()=>{if(!g||g.moved)return;lastTap=null;g.held=true;onMenu(clip,g.x,g.y)},holdMs)},true);
 root.addEventListener('pointermove',e=>{if(!g)return;if(!g.pinch&&g.clip?.isConnected===false){reset();return;}if(g.pinch){e.preventDefault();e.stopImmediatePropagation();if(e.pointerId===g.id)g.point=e;else if(e.pointerId===g.pinch.id)g.pinch.point=e;else return;setZoom(g.pinch.zoom*Math.hypot(g.point.clientX-g.pinch.point.clientX,g.point.clientY-g.pinch.point.clientY)/g.pinch.distance);return;}if(e.pointerId!==g.id)return;e.preventDefault();e.stopImmediatePropagation();g.point=e;const distance=Math.hypot(e.clientX-g.x,e.clientY-g.y);if(distance<7&&!g.moved)return;if(!g.moved&&g.selected&&Math.abs(e.clientX-g.x)>Math.abs(e.clientY-g.y)*1.35)g.held=true;g.moved=true;lastTap=null;clearTimeout(timer);if(g.held&&g.clip){if(!g.dragging){onHideMenu();onDrag(g.clip);g.dragging=true;g.clip.onpointerdown?.(eventAt({clientX:g.x,clientY:g.y}));raf=requestAnimationFrame(tick)}g.clip.onpointermove?.(eventAt(e,true))}else{scroll.scrollLeft=g.left-(e.clientX-g.x);scroll.scrollTop=g.top-(e.clientY-g.y)}},true);
 const end=(e,cancelled)=>{if(!g||e.pointerId!==g.id&&e.pointerId!==g.pinch?.id)return;e.preventDefault();e.stopImmediatePropagation();const state=g;g=null;stop();suppressClick=true;
  if(state.dragging)state.clip[cancelled?'onpointercancel':'onpointerup']?.(eventAt(e,true,state));
  else if(!cancelled&&!state.moved&&!state.held&&state.clip){
   const id=state.clip.dataset.clip||state.clip.dataset.fx||state.clip.dataset.textChip,now=performance.now(),double=lastTap?.id===id&&now-lastTap.at<320&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<18;
   const tapEvent={...eventAt(e,false,state),stopImmediatePropagation(){}};
   if(double&&onDoubleTap(state.clip,tapEvent))lastTap=null;
   else{lastTap={id,at:now,x:e.clientX,y:e.clientY};state.clip.onpointerdown?.(tapEvent);state.clip.onpointerup?.(tapEvent);if(state.clip.dataset.textChip||state.clip.dataset.fx)state.clip.onclick?.(tapEvent)}
  }
  if(cancelled||state.moved||state.held)lastTap=null;
  if(!state.clip)lastTap=null;
  if(!cancelled&&!state.moved&&!state.held&&!state.clip)state.lane?.onpointerdown?.(eventAt(e,false,state));clearMode(state);release(state);
 };
 root.addEventListener('pointerup',e=>end(e,false),true);root.addEventListener('pointercancel',e=>end(e,true),true);
 root.addEventListener('click',e=>{if(suppressClick){suppressClick=false;e.preventDefault();e.stopImmediatePropagation()}},true);
}
