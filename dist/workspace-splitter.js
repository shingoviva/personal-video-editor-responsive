export const clampTimelineHeight=(height,total,minTimeline=190,minPreview=190)=>{const low=Math.min(minTimeline,total/2),high=Math.max(low,total-Math.min(minPreview,total/2));return Math.max(low,Math.min(high,height))};
export const timelineRatio=(pointerY,top,bottom)=>clampTimelineHeight(bottom-pointerY,bottom-top)/(bottom-top);

export function bindWorkspaceSplitter({workspace,splitter,onResize=()=>{},storage=localStorage}){
 const key='pve.iphone.timeline.ratio',read=()=>Math.max(.2,Math.min(.66,+(storage.getItem(key)||.4))),apply=ratio=>{const h=clampTimelineHeight(workspace.clientHeight*ratio,workspace.clientHeight);workspace.style.setProperty('--timeline-height',h+'px');onResize(h)};let ratio=read();apply(ratio);
 const resize=()=>apply(ratio);window.addEventListener('resize',resize);
 splitter.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();splitter.setPointerCapture(event.pointerId);splitter.classList.add('dragging');document.body.classList.add('resizing-workspace');const move=e=>{const box=workspace.getBoundingClientRect();ratio=timelineRatio(e.clientY,box.top,box.bottom);apply(ratio)};const finish=()=>{splitter.onpointermove=null;splitter.onpointerup=null;splitter.onpointercancel=null;splitter.classList.remove('dragging');document.body.classList.remove('resizing-workspace');storage.setItem(key,String(ratio));onResize()};splitter.onpointermove=move;splitter.onpointerup=finish;splitter.onpointercancel=finish};
 splitter.onkeydown=event=>{if(!['ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();ratio=event.key==='Home'?.4:Math.max(.2,Math.min(.66,ratio+(event.key==='ArrowUp'?.04:-.04)));storage.setItem(key,String(ratio));apply(ratio)};
 return()=>window.removeEventListener('resize',resize)
}
