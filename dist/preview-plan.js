import {clipAlpha} from './creative.js?v=2.2.79';
import {timing} from './model.js?v=2.2.79';
import {transitionState,normalizeTransition} from './transition.js?v=2.2.79';
// Compile once per playback, not per animation frame. Includes brief fades and
// opacity points that a single look-ahead sample could miss.
export function compilePreviewPlan(rows,end){
 const points=new Set([0,end]);
 for(const r of rows){if(r.clip.gap)continue;const c=r.clip,d=timing(c).duration,offset=r.offset||0,transition=normalizeTransition(c.transition);
  for(const at of [r.start,r.end,r.start+Math.min(c.fadeIn||0,d/2)-offset,r.start+d-Math.min(c.fadeOut||0,d/2)-offset,...(transition.type==='none'?[]:[r.start+Math.min(transition.duration,r.duration)]),...(c.opacityKeyframes||[]).map(p=>r.start+p.time-offset)])if(at>=0&&at<=end)points.add(at);
 }
 const boundaries=[...points].sort((a,b)=>a-b),segments=[],ranges=[[],[]];
 for(let i=1;i<boundaries.length;i++){
  const start=boundaries[i-1],finish=boundaries[i];if(finish<=start)continue;
  const t=(start+finish)/2,active=[null,null,null];for(const r of rows)if(!r.clip.gap&&r.start<=t&&r.end>t)active[r.layer]=r;
  const top=active.filter(Boolean).at(-1);segments.push({start,end:finish,row:top});
  for(let k=0;k<2;k++)if(active[k]&&top?.layer>k&&!active.some(r=>r?.layer>k&&clipAlpha(r,t)>=1&&!transitionState(r,rows,t))){
   const list=ranges[k],last=list.at(-1),id=active[k].clip.id;
   if(last?.id===id&&last.end===start)last.end=finish;else list.push({id,start,end:finish});
  }
 }
 return {
  next(at){const current=segments.find(s=>s.start<=at&&at<s.end)?.row?.clip.id;const next=segments.find(s=>s.start>at+1e-6&&s.row?.clip.id!==current);return next?{at:next.start,row:next.row}:null},
  needsLower(layer,id,at,ahead=.35){return !!id&&ranges[layer].some(r=>r.id===id&&r.end>at&&r.start<at+ahead)},
 };
}
