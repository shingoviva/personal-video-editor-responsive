import {timing,sourceOffset,clamp,trimClip} from './model.js';
import {sourceLimit} from './assets.js';

// A pointer gesture is a single history transaction, including touch/pen.
// Only geometry changes during dragging; no thumbnail DOM is rebuilt.
export function equalSpacingStart(value,span,row,rows,secondsPerPixel){
 const id=value=>value.clip?.id||value.item?.id||value.id,layer=value=>value.layer??value.item?.layer??0;
 const peers=rows.filter(r=>id(r)!==id(row)&&layer(r)===layer(row)).sort((a,b)=>a.start-b.start),previous=peers.filter(r=>r.end<=value+.0001).at(-1),next=peers.find(r=>r.start>=value+span-.0001);
 if(!previous||!next)return{start:value,spacing:false};
 const target=(previous.end+next.start-span)/2;
 return Math.abs(target-value)<=secondsPerPixel*8?{start:Math.max(0,target),spacing:true,previous:previous.end,next:next.start}:{start:value,spacing:false};
}

// Magnetize either end when moving, and the edited edge when trimming.
export function snapClipPosition(value,span,{targets=[],enabled=true,threshold=0}={}){
 let start=Math.max(0,Math.round(value*30)/30),target=null,best=Infinity;
 if(enabled)for(const point of new Set(targets.filter(Number.isFinite)))for(const edge of [0,Math.max(0,span)]){const candidate=point-edge,distance=Math.abs(candidate-value);if(candidate>=0&&distance<=threshold&&distance<best){start=candidate;target=point;best=distance}}
 return{start,snapped:target!==null,target};
}

export function bindTimeline({root,rows,duration,select,begin,finish,cancel,preview,media,snap,getLayer,duplicate,groupRows=()=>[],groupOthers=()=>[],timelineRoot=root,snapTargets=()=>[]}){
 const pixels=root.getBoundingClientRect().width;
 const secondsPerPixel=Math.max(duration,.001)/Math.max(pixels,1);
 const rowById=new Map(rows.map(row=>[row.clip.id,row]));
 for(const el of root.querySelectorAll('[data-clip]')){
  el.onpointerdown=e=>{
   if(e.button!==0)return;
   let row=rowById.get(el.dataset.clip);if(!row)return;const elementById=new Map([...timelineRoot.querySelectorAll('[data-clip],[data-fx],[data-text-chip]')].map(node=>[node.dataset.clip||node.dataset.fx||node.dataset.textChip,node]));
   const rawEdge=e.target.closest('[data-edge]')?.dataset.edge;
   const edge=globalThis.document?.body?.dataset.ui==='phone'&&!globalThis.document.body.classList.contains('phone-moving')&&!el.classList.contains?.('selected')?null:rawEdge;
   const phoneScroll=e.pointerType==='touch'&&globalThis.document?.body?.dataset.ui==='phone'&&!edge&&!globalThis.document.body.classList.contains('phone-moving');
   const origin=structuredClone(row.clip),x=e.clientX,y=e.clientY;
   let moved=false,lastPreview=0,ghost=null,companions=[],others=[];
   select(row.clip.id,e);el.setPointerCapture(e.pointerId);
   el.onpointermove=ev=>{
    if(phoneScroll)return;
    if(!moved&&Math.hypot(ev.clientX-x,ev.clientY-y)<5)return;
    if(!moved){begin();if(e.altKey&&!edge&&duplicate){ghost=el.cloneNode?.(true)||null;if(ghost){ghost.classList.add('duplicate-origin');ghost.removeAttribute?.('data-clip');el.parentNode?.insertBefore(ghost,el)}row=duplicate(row)||row;select(row.clip.id,e)}else if(!edge){companions=groupRows(row).filter(r=>r.clip.id!==row.clip.id).map(r=>({row:r,start:r.start,layer:r.layer}));others=groupOthers(row).filter(v=>v.item.id!==row.clip.id)}moved=true;el.classList.add('dragging')}
    let delta=(ev.clientX-x)*secondsPerPixel;
    const selectedIds=new Set([row.clip.id,...companions.map(g=>g.row.clip.id)]),targets=[0,...snapTargets(),...rows.filter(r=>r!==row&&!selectedIds.has(r.clip.id)).flatMap(r=>[r.start,r.end])];let didSnap=false,snapPoint=null;
    let spacingResult={spacing:false};const snapped=(t,span=0)=>{const result=snapClipPosition(t,span,{targets,enabled:snap(),threshold:secondsPerPixel*12});didSnap=result.snapped;snapPoint=result.target;return result.start};
    const c=row.clip;
    const laneTop=(kind,layer)=>globalThis.document?.getElementById?.(kind==='audio'?'audioTrack'+layer:['videoTrack','videoTrackUpper','videoTrackTop'][layer])?.getBoundingClientRect().top;
    const laneDelta=(kind,from,to)=>{const a=laneTop(kind,from),b=laneTop(kind,to);return Number.isFinite(a)&&Number.isFinite(b)?b-a:(to-from)*(kind==='audio'?44:-52)};
    if(!edge){
     c.start=snapped(row.start+delta,timing(origin).duration);c.layer=getLayer(ev.clientY)??row.layer;if(snap()&&!didSnap){const spacingRows=[row,...rows.filter(r=>!selectedIds.has(r.clip.id))];spacingResult=equalSpacingStart(c.start,timing(c).duration,{...row,layer:c.layer},spacingRows,secondsPerPixel);c.start=spacingResult.start}
     const minimum=Math.min(row.start,...companions.map(g=>g.start),...others.map(v=>v.start)),actual=Math.max(-minimum,c.start-row.start);c.start=row.start+actual;
     for(const g of companions){g.row.clip.start=g.start+actual;g.row.clip.layer=clamp(g.layer+c.layer-row.layer,0,c.kind==='audio'?3:2);const node=elementById.get(g.row.clip.id);if(node){node.style.left=g.row.clip.start/Math.max(duration,.001)*100+'%';node.style.top=laneDelta(g.row.clip.kind,g.layer,g.row.clip.layer)+'px'}}
     for(const value of others){value.item.start=value.start+actual;if(value.kind==='text')value.item.end=value.item.start+value.span;const node=elementById.get(value.item.id);if(node)node.style.left=value.item.start/Math.max(duration,.001)*100+'%'}
     el.style.top=laneDelta(c.kind,row.layer,c.layer)+'px';
    }else{
     Object.assign(c,structuredClone(origin));c.start=row.start;c.layer=row.layer;
     const d=timing(origin).nodes.at(-1)[1],sourceAt=t=>t<0?t*origin.speed:t>d?origin.out-origin.in+(t-d)*(origin.curve==='constant'?origin.speed:origin.endSpeed):sourceOffset(t,origin);
     if(origin.freezeDuration){
      if(edge==='in'){c.start=clamp(snapped(row.start+delta),Math.max(0,row.end-60),row.end-1/30);c.freezeDuration=row.end-c.start}
      else c.freezeDuration=clamp(snapped(row.end+delta)-row.start,1/30,60);
     }else if(edge==='in'){
      const desired=snapped(row.start+delta)-row.start;
      trimClip(c,'in',origin.in+sourceAt(desired),sourceLimit(media(c)));
      c.start=Math.max(0,row.end-timing(c).duration);
      if(timing(c).duration>row.end){Object.assign(c,origin);c.start=row.start}
     }else trimClip(c,'out',origin.in+sourceAt(snapped(row.end+delta)-row.start-(origin.hold||0)),sourceLimit(media(c)));
    }
    el.style.left=c.start/Math.max(duration,.001)*100+'%';
    el.style.width=timing(c).duration/Math.max(duration,.001)*100+'%';
    const now=performance.now();if(!edge||now-lastPreview>50){lastPreview=now;preview(c,edge,didSnap,spacingResult,snapPoint)}
   };
   const cleanup=()=>{ghost?.remove?.();ghost=null;el.classList.remove?.('dragging');el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;el.onlostpointercapture=null};
   el.onpointerup=ev=>{cleanup();if(moved)finish();else{const t=row.start+clamp((ev.clientX-el.getBoundingClientRect().left)/Math.max(el.clientWidth,1),0,1)*row.duration;finish(t,false)}};
   el.onpointercancel=()=>{cleanup();if(moved)cancel()};
   el.onlostpointercapture=()=>{cleanup();if(moved)cancel()};
  };
 }
}
