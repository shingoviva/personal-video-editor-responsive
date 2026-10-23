import {waveformFor} from './audio-waveform.js?v=2.2.84';
import {sourceOffset} from './model.js?v=2.2.84';
import {addEnvelopePoint,envelopeDbAt,normalizeEnvelope,snapEnvelopeDb,MAX_ENVELOPE_POINTS,ENVELOPE_MIN_DB,ENVELOPE_MAX_DB} from './clip-envelope.js?v=2.2.84';

export function dbToY(db,height){const value=Math.max(ENVELOPE_MIN_DB,Math.min(ENVELOPE_MAX_DB,+db||0)),ratio=value>=0?.28*(ENVELOPE_MAX_DB-value)/ENVELOPE_MAX_DB:.28+.72*Math.pow(-value/-ENVELOPE_MIN_DB,.5);return 3+ratio*Math.max(1,height-6)}
export function yToDb(y,height){const ratio=Math.max(0,Math.min(1,(y-3)/Math.max(1,height-6)));return ratio<=.28?ENVELOPE_MAX_DB*(1-ratio/.28):ENVELOPE_MIN_DB*Math.pow((ratio-.28)/.72,2)}
// Snap in screen pixels: the asymmetric dB scale must feel equally magnetic on either side.
export function snapEnvelopeDrag(value,height,latched=false,fine=false){
 const distance=Math.abs(dbToY(value,height)-dbToY(0,height)),threshold=fine?(latched?4:2):(latched?8:5);
 const compactLimit=height<40?Math.max(.5,(dbToY(0,height)-dbToY(ENVELOPE_MAX_DB,height))*.45):Infinity;
 if(distance<=Math.min(threshold,compactLimit))return{valueDb:0,latched:true};
 return{valueDb:snapEnvelopeDb(value,fine),latched:false};
}
export const envelopeXAtTime=(time,duration,width)=>Math.max(0,Math.min(1,time/Math.max(duration,1e-6)))*Math.max(1,width);
const xAt=envelopeXAtTime;
export const envelopeTimeAtX=(x,duration,width)=>Math.max(0,Math.min(duration,x/Math.max(1,width)*duration));
const timeAt=envelopeTimeAtX;

// Boundary handles are UI-only until explicitly touched or a curve is edited.
export function envelopeHandles(points,duration){
 const p=normalizeEnvelope(points,duration),end=Math.max(0,duration),result=p.map(point=>({...point,boundary:point.time<=1e-6?'start':Math.abs(point.time-end)<=1e-6?'end':null}));
 if(!result.some(point=>point.boundary==='start'))result.unshift({id:'__gain-start',time:0,valueDb:envelopeDbAt(0,p,0),interpolation:'linear',boundary:'start',virtual:true});
 if(end>1e-6&&!result.some(point=>point.boundary==='end'))result.push({id:'__gain-end',time:end,valueDb:envelopeDbAt(end,p,0),interpolation:'linear',boundary:'end',virtual:true});
 return result;
}
export const envelopeHandleX=(point,duration,width)=>point.boundary?Math.max(Math.min(6,width/3),Math.min(width-Math.min(6,width/3),xAt(point.time,duration,width))):xAt(point.time,duration,width);
function materialize(points,duration){
 const handles=envelopeHandles(points,duration),result=normalizeEnvelope(points,duration);
 for(const point of handles)if(point.virtual)result.push({...point,id:globalThis.crypto?.randomUUID?.()||`gain-${Date.now()}-${Math.random()}`,editBoundary:true});
 return normalizeEnvelope(result,duration);
}
const flatEnvelope=points=>!points.length||points.every(point=>Math.abs(point.valueDb-points[0].valueDb)<1e-9);

// Reserve the lower six CSS pixels for the lane-height grip and knob radius.
export const envelopePlotHeight=height=>Math.max(8,height-6);

export function drawClipEnvelope(canvas,points,duration,{active=false,selectedId=null,waveform=null,clip=null}={}){
 const rect=canvas.getBoundingClientRect(),ratio=Math.min(2,globalThis.devicePixelRatio||1),width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);const w=rect.width,h=envelopePlotHeight(rect.height),p=normalizeEnvelope(points,duration);ctx.clearRect(0,0,w,rect.height);
 if(waveform&&clip){ctx.strokeStyle=active?'#80aab6b0':'#80aab680';ctx.lineWidth=1;ctx.beginPath();const center=h*.59,amplitude=h*.34;for(let x=0;x<w;x+=2){const at=clip.in+sourceOffset(timeAt(x,duration,w),clip),bin=Math.min(4095,Math.max(0,Math.floor((clip.loop?at%waveform.duration:at)/waveform.duration*4096))),peak=waveform.peaks[bin]/Math.max(.01,waveform.maximum);ctx.moveTo(x,center-peak*amplitude);ctx.lineTo(x,center+peak*amplitude)}ctx.stroke()}
 const zero=dbToY(0,h);const zeroSelected=active&&p.some(point=>point.id===selectedId&&point.valueDb===0);ctx.strokeStyle=zeroSelected?'#e4f0aa99':active?'#dce9a94a':'#dce9a922';ctx.setLineDash(zeroSelected?[]:[3,3]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,zero);ctx.lineTo(w,zero);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle=active?'#e4f0aa':'#afc07888';ctx.lineWidth=active?1.7:1;ctx.beginPath();const startDb=p.length?p[0].valueDb:0;ctx.moveTo(0,dbToY(startDb,h));for(let index=0;index<p.length;index++){const point=p[index],x=xAt(point.time,duration,w),y=dbToY(point.valueDb,h),previous=p[index-1];if(previous?.interpolation==='hold'){ctx.lineTo(x,dbToY(previous.valueDb,h));ctx.lineTo(x,y)}else ctx.lineTo(x,y)}ctx.lineTo(w,dbToY(p.length?p.at(-1).valueDb:0,h));ctx.stroke();
 if(active&&!p.length){ctx.font='9px ui-monospace, monospace';ctx.fillStyle='#e4f0aa';ctx.fillText('0 dB',5,Math.min(h-2,zero+11))}
 if(active)for(const point of envelopeHandles(p,duration)){const selected=point.id===selectedId,x=envelopeHandleX(point,duration,w),y=dbToY(point.valueDb,h);ctx.fillStyle=selected?'#f2f8ca':'#172016';ctx.strokeStyle='#dce9a9';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,selected?5:3.5,0,Math.PI*2);ctx.fill();if(point.virtual)ctx.setLineDash([2,2]);ctx.stroke();ctx.setLineDash([]);if(selected){const label=`${Math.abs(point.valueDb)<.005?'0.0':point.valueDb.toFixed(1)} dB`,tx=Math.max(4,Math.min(w-58,x+7)),ty=Math.max(11,y-8);ctx.font='10px ui-monospace, monospace';const measure=ctx.measureText(label).width;ctx.fillStyle='#10150eee';ctx.fillRect(tx-3,ty-10,measure+6,14);ctx.fillStyle='#eef6c9';ctx.fillText(label,tx,ty)}}
}

const envelopeHits=new WeakMap(),envelopeDoubleTaps=new WeakMap();
const movingClip=()=>globalThis.document?.body?.classList?.contains('phone-moving');
export function clipEnvelopeDoubleTap(element,event){return !!element&&!!envelopeDoubleTaps.get(element)?.(event)}
export function clipEnvelopeOwnsPointer(element,event){return !!element&&!!envelopeHits.get(element)?.(event)}
const liveBindings=new Map();let removalObserver;
function watchRemoval(element,dispose){liveBindings.set(element,dispose);if(!removalObserver){removalObserver=new MutationObserver(()=>{for(const [node,cleanup]of liveBindings)if(!node.isConnected){liveBindings.delete(node);cleanup()}});removalObserver.observe(document.body,{childList:true,subtree:true})}}

export const videoEnvelopeEnabled=(clip,media)=>!!(clip&&!clip.gap&&!clip.freezeDuration&&!clip.audioDetached&&media?.audio&&media.kind!=='image'&&media.kind!=='audio');

export function bindClipEnvelope(element,{loadWaveform=true,file,url,getClip,getPoints,setPoints,duration,isActive,selectedId,setSelected,onBegin,onInput,onCommit,onContext,onLimit}){
 const canvas=element.querySelector('.gain-envelope-canvas');if(!canvas)return()=>{};
 let hovering=false,drag=null,waveform=null,lastTouchTap=null,ignoreDoubleUntil=0;
 const controller=new AbortController(),progress=loadWaveform?document.createElement('small'):null;
 if(progress){progress.className='waveform-progress';progress.style.pointerEvents='none';element.append(progress)}
 const render=()=>drawClipEnvelope(canvas,getPoints(),duration(),{active:isActive()||hovering,selectedId:selectedId(),waveform,clip:getClip?.()});
 const local=event=>{const rect=canvas.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top,width:rect.width,height:envelopePlotHeight(rect.height)}};
 const pointAt=event=>{
  const pos=local(event);if(pos.x<0||pos.x>pos.width||pos.y<0||pos.y>pos.height)return null;
  let best=null,distance=Infinity;
  for(const point of envelopeHandles(getPoints(),duration())){const d=Math.hypot(envelopeHandleX(point,duration(),pos.width)-pos.x,dbToY(point.valueDb,pos.height)-pos.y);if(d<distance){distance=d;best=point}}
  return distance<=(event.pointerType==='touch'?14:9)?best:null;
 };
 const lineHit=event=>{const pos=local(event);if(pos.x<0||pos.x>pos.width||pos.y<0||pos.y>pos.height)return false;return Math.abs(dbToY(envelopeDbAt(timeAt(pos.x,duration(),pos.width),getPoints(),0),pos.height)-pos.y)<=6};
 const owns=(event,point=pointAt(event))=>!movingClip()&&!event.altKey&&(!event.target.closest('[data-edge]')||!!point?.boundary)&&(!!point||flatEnvelope(normalizeEnvelope(getPoints(),duration()))&&lineHit(event));
 envelopeHits.set(element,owns);
 element.addEventListener('pointerenter',()=>{hovering=true;render()});element.addEventListener('pointerleave',()=>{if(!drag){hovering=false;render()}});
 const clean=()=>{element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',end);element.removeEventListener('pointercancel',end);element.removeEventListener('lostpointercapture',end)};
 const move=event=>{
  if(!drag||event.pointerId!==drag.pointer)return;
  const pos=local(event),dx=pos.x-drag.start.x,dy=pos.y-drag.start.y;
  if(Math.hypot(dx,dy)<3&&!drag.moved)return;drag.moved=true;lastTouchTap=null;
  if(drag.mode==='line'&&!drag.began){
   if(Math.hypot(dx,dy)<4)return;
   if(Math.abs(dx)>Math.abs(dy)){
    // Transfer the same pointer to the existing clip mover, without another capture owner.
    const original=drag.event;drag=null;lastTouchTap=null;clean();event.stopImmediatePropagation?.();
    element.onpointerdown?.({...original,timelineEnvelopeMove:true});element.onpointermove?.(event);return;
   }
  }
  if(!drag.began){onBegin?.();drag.began=true}
  const snapped=snapEnvelopeDrag(event.shiftKey?drag.startDb-dy*.025:yToDb(pos.y-drag.grabY,pos.height),pos.height,drag.latched,event.shiftKey);drag.latched=snapped.latched;
  let points=normalizeEnvelope(getPoints(),duration()),changed;
  if(drag.mode==='line'){
   points=materialize(points,duration());if(!points){onLimit?.();return}
   points=points.map(point=>({...point,valueDb:snapped.valueDb}));changed={time:0,valueDb:snapped.valueDb};
  }else{
   const index=points.findIndex(point=>point.id===drag.id);if(index<0)return;
   const old=points[index].time,previous=points[index-1]?.time,next=points[index+1]?.time;
   let min=index?previous+Math.min(.001,(old-previous)/2):0,max=index<points.length-1?next-Math.min(.001,(next-old)/2):duration();
   if(index&&min<=previous)min=old;if(index<points.length-1&&max>=next)max=old;
   let at=drag.boundary==='start'?0:drag.boundary==='end'?duration():timeAt(pos.x-drag.grabX,duration(),pos.width);
   if(!drag.boundary){if(!index&&at/Math.max(duration(),1e-6)*pos.width<6)at=0;if(index===points.length-1&&(duration()-at)/Math.max(duration(),1e-6)*pos.width<6)at=duration()}
   changed=points[index]={...points[index],time:Math.max(min,Math.min(max,at)),valueDb:snapped.valueDb};
  }
  setPoints(points);onInput?.(changed);render();
 };
 const end=event=>{
  if(!drag||event.pointerId!==drag.pointer)return;const state=drag;drag=null;clean();if(state.began)onCommit?.();
  if(!state.moved&&event.type==='pointerup'&&state.event.pointerType==='touch'){
   const at=performance.now(),tap={at,x:event.clientX,y:event.clientY};
   if(lastTouchTap&&at-lastTouchTap.at<350&&Math.hypot(tap.x-lastTouchTap.x,tap.y-lastTouchTap.y)<18){lastTouchTap=null;ignoreDoubleUntil=at+600;doubleClick(event)}else lastTouchTap=tap;
  }else lastTouchTap=null;
  render();
 };
 element.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;let point=pointAt(event);if(!owns(event,point))return;
  event.preventDefault();event.stopImmediatePropagation();let began=false;
  if(point?.virtual){const points=materialize(getPoints(),duration());if(!points){onLimit?.();return}onBegin?.();began=true;setPoints(points);point={...points.find(value=>Math.abs(value.time-point.time)<1e-6),boundary:point.boundary}}
  setSelected(point?.id||null);const start=local(event),startDb=point?.valueDb??envelopeDbAt(0,getPoints(),0);
  drag={mode:point?'point':'line',id:point?.id,boundary:point?.boundary,pointer:event.pointerId,start,startDb,grabY:start.y-dbToY(startDb,start.height),grabX:point?start.x-xAt(point.time,duration(),start.width):0,latched:startDb===0,began,moved:false,event:{button:0,pointerId:event.pointerId,pointerType:event.pointerType,clientX:event.clientX,clientY:event.clientY,target:event.target,shiftKey:event.shiftKey,altKey:event.altKey,metaKey:event.metaKey,ctrlKey:event.ctrlKey,preventDefault:()=>{},stopPropagation:()=>{}}};
  element.setPointerCapture?.(event.pointerId);render();element.addEventListener('pointermove',move);element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);element.addEventListener('lostpointercapture',end);
 },true);
 const doubleClick=event=>{
  const point=pointAt(event);if(movingClip()||event.altKey||event.target.closest('[data-edge]')&&!point?.boundary||!point&&!lineHit(event))return;
  event.preventDefault();event.stopImmediatePropagation();let points=normalizeEnvelope(getPoints(),duration());
  const pos=local(event),at=point?.boundary==='start'?0:point?.boundary==='end'?duration():point?.time??timeAt(pos.x,duration(),pos.width);
  if(!point&&points.length>=MAX_ENVELOPE_POINTS){onLimit?.();return}
  if(point&&!point.virtual){points=points.map(value=>value.id===point.id?{...value,valueDb:0}:value)}else if(point?.virtual){points=materialize(points,duration());points=addEnvelopePoint(points,at,envelopeDbAt(at,points,0))}else points=materialize(addEnvelopePoint(points,at,envelopeDbAt(at,points,0)),duration());
  onBegin?.();
  setPoints(points);setSelected(points.reduce((best,value)=>Math.abs(value.time-at)<Math.abs(best.time-at)?value:best).id);onCommit?.();render();return true;
 };
 envelopeDoubleTaps.set(element,doubleClick);element.addEventListener('dblclick',event=>{if(performance.now()<ignoreDoubleUntil){event.preventDefault();event.stopImmediatePropagation();return}doubleClick(event)},true);
 element.addEventListener('contextmenu',event=>{const point=pointAt(event);if(!point||point.virtual)return;event.preventDefault();event.stopImmediatePropagation();setSelected(point.id);onContext?.(event,point);render()},true);
 if(loadWaveform)waveformFor(file,url,{signal:controller.signal,onProgress:state=>{progress.hidden=state.phase==='ready';progress.textContent=state.phase==='queued'?'WAVEFORM · QUEUED':state.phase==='loading'?`WAVEFORM · ${Math.round(state.progress*100)}%`:'WAVEFORM · UNAVAILABLE'}}).then(value=>{waveform=value;if(element.isConnected)render()});
 const resize=new ResizeObserver(()=>{if(element.isConnected)render();else resize.disconnect()});resize.observe(canvas);watchRemoval(element,()=>{controller.abort();resize.disconnect();drag=null;clean()});requestAnimationFrame(render);return render;
}
