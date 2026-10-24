import {quantizeTimelineTime} from './timeline-time.js?v=2.2.85';
import {clamp} from './model.js?v=2.2.85';
import {equalSpacingStart} from './timeline-gestures.js?v=2.2.85';

// With snapping enabled, quantize on the editing grid, then magnetize to the playhead
// or an edit boundary. Twelve screen pixels is forgiving without feeling sticky.
export function snapOverlayStart(value,span,{duration,pixels,enabled=true,bypass=false,targets=[],rate=30}={}){
 const limit=Math.max(0,(duration||0)-Math.max(0,span||0)),raw=clamp(value,0,limit);
 let start=enabled&&!bypass&&rate!==null?quantizeTimelineTime(raw,rate):raw,snapped=false,target=null,best=Infinity;
 if(enabled&&!bypass){
  const threshold=Math.max(duration||0,.001)/Math.max(pixels||0,1)*12;
  for(const point of new Set(targets.filter(Number.isFinite))){
   for(const edge of [0,span]){
    const candidate=point-edge,distance=Math.abs(candidate-raw);
    if(candidate>=0&&candidate<=limit&&distance<=threshold&&distance<best){start=candidate;best=distance;snapped=true;target=point}
   }
  }
 }
 return{start:clamp(start,0,limit),snapped,target};
}

export function bindOverlayTimeline({root,effects=[],texts=[],duration,targets,snap,select,begin,finish,cancel,preview,duplicate,getLayer,groupItems=()=>[],spacingItems=()=>[],rate=30}){
 const pixels=Math.max(1,root.getBoundingClientRect().width),secondsPerPixel=Math.max(duration,.001)/pixels;
 const surface=root.closest?.('.timeline-content')||root;
 for(const el of root.querySelectorAll('[data-fx],[data-text-chip]')){
  el.onpointerdown=event=>{
   if(event.button!==0)return;
   const kind=el.dataset.fx?'effect':'text';let item=(kind==='effect'?effects:texts).find(value=>value.id===(el.dataset.fx||el.dataset.textChip));
   if(!item)return;const elementById=new Map([...surface.querySelectorAll('[data-clip],[data-fx],[data-text-chip]')].map(node=>[node.dataset.clip||node.dataset.fx||node.dataset.textChip,node]));
   const origin=structuredClone(item),originStart=origin.start,originSpan=kind==='effect'?origin.duration:origin.end-origin.start,x=event.clientX,y=event.clientY,edge=event.target?.closest?.('[data-overlay-edge]')?.dataset.overlayEdge;
   const phoneScroll=event.pointerType==='touch'&&globalThis.document?.body?.dataset.ui==='phone'&&!edge&&!globalThis.document.body.classList.contains('phone-moving');
   let moved=false,copied=false,lastResult={snapped:false,target:null,spacing:{spacing:false}},ghost=null,companions=[];if(event.pointerType!=='touch')event.preventDefault?.();select(kind,item.id,event);if(!event.timelineTouchManaged)el.setPointerCapture(event.pointerId);
   el.onpointermove=move=>{if(move.pointerId!==undefined&&move.pointerId!==event.pointerId)return;
    if(phoneScroll)return;
    if(!moved&&Math.hypot(move.clientX-x,(move.clientY??y)-y)<5)return;
    move.preventDefault?.();
    if(!moved){begin();if(!edge)companions=groupItems(item,kind).filter(v=>v.item.id!==item.id);moved=true;el.classList.add('dragging')}
    if(!copied&&!edge&&(event.altKey||move.altKey)&&duplicate){
     Object.assign(item,structuredClone(origin));for(const v of companions){v.item.start=v.start;if(v.kind==='text')v.item.end=v.start+v.span;const node=elementById.get(v.item.id);if(node)node.style.left=v.start/Math.max(duration,.001)*100+'%'}
     const clone=duplicate(item,kind);if(!clone||clone.id===item.id){cleanup();cancel();return}
     ghost=el.cloneNode?.(true)||null;if(ghost){ghost.classList.add('duplicate-origin');if(ghost.style){ghost.style.left=originStart/Math.max(duration,.001)*100+'%';ghost.style.transform=''}el.parentNode?.insertBefore(ghost,el)}item=clone;copied=true;companions=[];select(kind,item.id,{...event,shiftKey:false});
    }
    // Retain the existing minimum overlay duration independently of editing fps.
    const delta=(move.clientX-x)*secondsPerPixel,minimumSpan=1/30;
    if(edge==='in'){const end=originStart+originSpan;lastResult=snapOverlayStart(originStart+delta,0,{duration:end-minimumSpan,pixels,enabled:snap(),targets:targets(item,kind),rate});item.start=Math.min(end-minimumSpan,lastResult.start);if(kind==='effect')item.duration=end-item.start;else item.end=end}
    else if(edge==='out'){const endResult=snapOverlayStart(originStart+originSpan+delta,0,{duration,pixels,enabled:snap(),targets:targets(item,kind),rate}),end=Math.max(originStart+minimumSpan,endResult.start);lastResult={...endResult,start:originStart};item.start=originStart;if(kind==='effect')item.duration=end-originStart;else item.end=end}
    else{const destination=getLayer?.(move.clientY);if(destination&&Number.isInteger(destination.layer))item.layer=clamp(destination.layer,0,2);lastResult=snapOverlayStart(originStart+delta,originSpan,{duration,pixels,enabled:snap(),targets:targets(item,kind),rate});let spacing={spacing:false};if(snap()){const peers=spacingItems(item,kind);spacing=equalSpacingStart(Math.max(0,originStart+delta),originSpan,{id:item.id,layer:0},[{id:item.id,layer:0,start:originStart,end:originStart+originSpan},...peers.map(v=>({id:v.item.id,layer:0,start:v.start,end:v.start+v.span}))],secondsPerPixel);if(spacing.spacing&&(!lastResult.snapped||Math.abs(spacing.start-(originStart+delta))<=Math.abs(lastResult.start-(originStart+delta))+1e-6)){lastResult.start=spacing.start;lastResult.snapped=false;lastResult.target=null}else if(lastResult.snapped)spacing={spacing:false}}lastResult.spacing=spacing;const low=Math.min(originStart,...companions.map(v=>v.start)),high=Math.max(originStart+originSpan,...companions.map(v=>v.start+v.span)),actual=clamp(lastResult.start-originStart,-low,duration-high);item.start=originStart+actual;if(kind==='text')item.end=item.start+originSpan;if(destination&&Number.isInteger(destination.layer)){item.layer=clamp(destination.layer,0,2);el.style.transform=`translateY(${destination.offset||0}px)`;lastResult.layer=item.layer;lastResult.layerChanged=item.layer!==(origin.layer||0)}for(const value of companions){value.item.start=value.start+actual;if(value.kind==='text')value.item.end=value.item.start+value.span;const node=elementById.get(value.item.id);if(node)node.style.left=value.item.start/Math.max(duration,.001)*100+'%'}}
    const itemSpan=kind==='effect'?item.duration:item.end-item.start;el.style.left=item.start/Math.max(duration,.001)*100+'%';el.style.width=itemSpan/Math.max(duration,.001)*100+'%';preview(item,kind,lastResult,edge);
   };
   const cleanup=()=>{ghost?.remove?.();ghost=null;el.style.transform='';el.classList.remove('dragging');el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;el.onlostpointercapture=null};
   el.onpointerup=next=>{if(next?.pointerId!==undefined&&next.pointerId!==event.pointerId)return;cleanup();if(moved)finish(item,kind,lastResult)};
   el.onpointercancel=next=>{if(next?.pointerId!==undefined&&next.pointerId!==event.pointerId)return;cleanup();if(moved)cancel()};
   el.onlostpointercapture=next=>{if(next?.pointerId!==undefined&&next.pointerId!==event.pointerId)return;cleanup();if(moved)cancel()};
  };
 }
}
