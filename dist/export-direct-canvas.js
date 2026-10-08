import {sequence} from './model.js';
// Avoid copying GPU output through a second canvas when no composition is needed.
export function directCanvasEligible(project,duration,{texts=[],effects=[]}={}){
 if(texts.length||effects.length)return false;
 const rows=sequence(project).sort((a,b)=>a.start-b.start);let end=0;
 if(!rows.length)return false;
 for(const row of rows){const c=row.clip;if(c.gap||row.layer!==0||Math.abs(row.start-end)>1e-6||(c.opacity??1)!==1||c.fadeIn||c.fadeOut||c.opacityKeyframes?.length||c.transition?.type&&c.transition.type!=='none')return false;end=row.end}
 return Math.abs(end-duration)<1e-5;
}
