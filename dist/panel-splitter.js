const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function panelWidths(pointerX,left,right,{minMedia=150,minViewer=360,minInspector=230}={}){
 const width=right-left,media=clamp(pointerX-left,minMedia,width-minViewer-minInspector),inspector=clamp(right-pointerX,minInspector,width-minViewer-minMedia);
 return{media,inspector};
}
export function bindPanelSplitters({workspace,leftSplitter,rightSplitter,onResize=()=>{},storage=localStorage}){
 let media=clamp(+(storage.getItem('pve.iphone.media.width')||220),150,420),inspector=clamp(+(storage.getItem('pve.iphone.inspector.width')||302),230,520);
 const apply=()=>{workspace.style.setProperty('--media-width',media+'px');workspace.style.setProperty('--inspector-width',inspector+'px');onResize()};
 const bind=(splitter,side)=>{splitter.onpointerdown=event=>{
  if(event.button!==0)return;event.preventDefault();splitter.setPointerCapture(event.pointerId);
  const initialMedia=media,initialInspector=inspector;
  splitter.classList.add('dragging');document.body.classList.add('resizing-columns');
  const move=e=>{if(e.pointerId!==event.pointerId)return;const box=workspace.getBoundingClientRect(),available=box.width-14;if(side==='media')media=clamp(e.clientX-box.left,150,available-inspector-360);else inspector=clamp(box.right-e.clientX,230,available-media-360);apply()};
  const finish=(e,cancel=false)=>{
   if(e.pointerId!==event.pointerId)return;
   splitter.onpointermove=splitter.onpointerup=splitter.onpointercancel=splitter.onlostpointercapture=null;
   splitter.classList.remove('dragging');document.body.classList.remove('resizing-columns');
   if(cancel){media=initialMedia;inspector=initialInspector;apply()}else{storage.setItem('pve.iphone.media.width',String(media));storage.setItem('pve.iphone.inspector.width',String(inspector));onResize()}
   try{splitter.releasePointerCapture(e.pointerId)}catch{}
  };
  splitter.onpointermove=move;splitter.onpointerup=e=>finish(e);splitter.onpointercancel=splitter.onlostpointercapture=e=>finish(e,true);
 };splitter.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();if(side==='media')media=e.key==='Home'?220:clamp(media+(e.key==='ArrowRight'?16:-16),150,420);else inspector=e.key==='Home'?302:clamp(inspector+(e.key==='ArrowLeft'?16:-16),230,520);apply()}};
 bind(leftSplitter,'media');bind(rightSplitter,'inspector');apply();return apply;
}
