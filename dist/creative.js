import {clamp,timing,sequence,uid,pasteClip,sourceOffset} from './model.js';
export function opacityAt(clip,local,duration=Infinity){
 const points=(clip?.opacityKeyframes||[]).filter(k=>Number.isFinite(+k.time)&&Number.isFinite(+k.value)).map(k=>({time:clamp(+k.time,0,duration),value:clamp(+k.value,0,1)})).sort((a,b)=>a.time-b.time);
 if(!points.length)return clamp(clip?.opacity??1,0,1);if(local<=points[0].time)return points[0].value;if(local>=points.at(-1).time)return points.at(-1).value;
 for(let i=1;i<points.length;i++)if(local<=points[i].time){const a=points[i-1],b=points[i],u=clamp((local-a.time)/Math.max(1e-6,b.time-a.time),0,1),ease=u*u*(3-2*u);return a.value+(b.value-a.value)*ease}
 return points.at(-1).value;
}
export function scaleAt(clip,local,duration=Infinity){
 const points=(clip?.scaleKeyframes||[]).filter(k=>Number.isFinite(+k.time)&&Number.isFinite(+k.value)).map(k=>({time:clamp(+k.time,0,duration),value:clamp(+k.value,1,3)})).sort((a,b)=>a.time-b.time);
 if(!points.length)return clamp(clip?.scale??1,1,3);if(local<=points[0].time)return points[0].value;if(local>=points.at(-1).time)return points.at(-1).value;
 for(let i=1;i<points.length;i++)if(local<=points[i].time){const a=points[i-1],b=points[i],u=clamp((local-a.time)/Math.max(1e-6,b.time-a.time),0,1),ease=u*u*(3-2*u);return a.value+(b.value-a.value)*ease}
 return points.at(-1).value;
}
export function clipAlpha(row,t){if(!row||t<row.start||t>=row.end)return 0;const c=row.clip,d=timing(c).duration,local=t-row.start+(row.offset||0),fi=Math.min(c.fadeIn||0,d/2),fo=Math.min(c.fadeOut||0,d/2);return opacityAt(c,local,d)*Math.max(0,Math.min(1,fi?local/fi:1,fo?(d-local)/fo:1))}
export function effectAlpha(e,t){if(t<e.start||t>=e.start+e.duration)return 0;const elapsed=t-e.start,d=Math.max(1/60,e.duration),hold=clamp(e.hold||0,0,Math.max(0,d-1/60)),transition=Math.max(1/60,d-hold),strength=clamp(e.strength??1,0,1);if(e.type==='black-in')return strength*(elapsed<=hold?1:1-clamp((elapsed-hold)/transition,0,1));if(e.type==='black-out')return strength*clamp(elapsed/transition,0,1);return strength*(1-clamp(elapsed/d,0,1))}
export function textPose(text,t){
 const d=Math.max(.001,text.end-text.start),fi=Math.min(text.fadeIn??text.fade??0,d/2),fo=Math.min(text.fadeOut??text.fade??0,d/2);
 const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x)},md=Math.min(text.motionDuration??.4,d/2);
 const shift=.06*(1-ease((t-text.start)/Math.max(.001,md))-ease((t-(text.end-md))/Math.max(.001,md)));
 const enter=ease((t-text.start)/Math.max(.001,md)),motionStart=clamp(text.motionStart??0,0,d),motionEnd=Math.max(motionStart+.001,clamp(text.motionEnd??Math.min(d,md),0,d)),scaleProgress=ease((t-text.start-motionStart)/Math.max(.001,motionEnd-motionStart));
 const scale=text.motion==='pop'?.82+.18*enter:text.motion==='scale'?(text.motionScaleFrom??1)+((text.motionScaleTo??1)-(text.motionScaleFrom??1))*scaleProgress:1;
 return{alpha:t<text.start||t>=text.end?0:clamp(text.opacity??1,0,1)*Math.max(0,Math.min(1,fi?(t-text.start)/fi:1,fo?(text.end-t)/fo:1)),x:(text.x??.5)+(text.motion==='slide-left'?shift:0),y:(text.y??.85)+(text.motion==='rise'?shift:0),scale};
}
export function frozenClip(p,id,t,seconds=1){
 const row=sequence(p).find(r=>r.clip.id===id);if(!row||row.clip.gap)return null;
 const c=row.clip,source=c.kind==='image'?0:c.freezeAt??Math.min(c.out-.001,c.in+sourceOffset(clamp(t-row.start,0,row.duration),c));
 const frozen={...structuredClone(c),freezeAt:source,freezeDuration:clamp(seconds,1/30,60),in:source,out:Math.max(source+.001,Math.min(c.out,source+1/30)),hold:0,speed:1,endSpeed:1,curve:'constant',stabilization:'OFF',fadeIn:0,fadeOut:0};
 delete frozen.timingBase;frozen.audio={...c.audio,mute:true};return pasteClip(p,frozen,Math.max(0,t),2);
}
export function addEffect(p,type,t){const e={id:uid(),type,start:Math.max(0,t),duration:type==='flash'?.16:.6,hold:0,strength:1};(p.effects??=[]).push(e);return e}
