export function nearestLaneScroll(value,stops){
 const ordered=[...new Set(stops.filter(Number.isFinite).map(v=>Math.max(0,v)))].sort((a,b)=>a-b);
 return ordered.reduce((best,next)=>Math.abs(next-value)<Math.abs(best-value)?next:best,ordered[0]??0);
}

export function timelineLabelTransform(scrollTop){return`translate3d(0,-${Math.max(0,Number(scrollTop)||0)}px,0)`}

export function bindTimelineLaneScroll({scroll,labels,header,lanes,delay=100}){
 let frame=0;
 const paint=()=>{frame=0;labels.style.transform=timelineLabelTransform(scroll.scrollTop)};
 const sync=()=>{if(!frame)frame=requestAnimationFrame(paint)};
 scroll.addEventListener('scroll',sync,{passive:true});sync();
 return()=>{if(frame)cancelAnimationFrame(frame);scroll.removeEventListener('scroll',sync)};
}
