// TEST ORACLE ONLY: frozen pre-B3 code. Never import into the application.
export const ENVELOPE_MIN_DB=-96;
export const ENVELOPE_MAX_DB=12;
export const STEP_RAMP_SECONDS=.005;
export const MAX_ENVELOPE_POINTS=256;
const finite=(value,fallback=0)=>Number.isFinite(+value)?+value:fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
export const dbToGain=db=>Math.pow(10,clamp(db,ENVELOPE_MIN_DB,ENVELOPE_MAX_DB)/20);
export const gainToDb=gain=>clamp(20*Math.log10(Math.max(dbToGain(ENVELOPE_MIN_DB),finite(gain,1))),ENVELOPE_MIN_DB,ENVELOPE_MAX_DB);
export function snapEnvelopeDb(value,fine=false){const db=clamp(value,ENVELOPE_MIN_DB,ENVELOPE_MAX_DB),threshold=fine ? .15 : .7;return Math.abs(db)<=threshold?0:Math.round(db*(fine?100:10))/(fine?100:10)}

export function normalizeEnvelope(value,duration=86400){
 const source=Array.isArray(value)?value:value?.points;
 const points=(Array.isArray(source)?source:[]).slice(0,MAX_ENVELOPE_POINTS).map((point,index)=>({
  id:String(point?.id||`gain-${index}-${finite(point?.time).toFixed(6)}`),
  time:clamp(point?.time,0,Math.max(0,duration)),
  valueDb:clamp(point?.valueDb??point?.db,ENVELOPE_MIN_DB,ENVELOPE_MAX_DB),
  interpolation:point?.interpolation==='hold'||point?.curve==='hold'?'hold':'linear',
  holdRampSeconds:point?.holdRampSeconds!=null&&Number.isFinite(+point.holdRampSeconds)?clamp(point.holdRampSeconds,0,86400):undefined,
  editBoundary:point?.editBoundary===true?true:undefined
 })).sort((a,b)=>a.time-b.time);
 return points.filter((point,index)=>!index||point.time-points[index-1].time>((point.editBoundary||points[index-1].editBoundary)?0:1e-6));
}

export function legacyGainEnvelope(points,duration=86400){
 return normalizeEnvelope((points||[]).map((point,index)=>({id:point.id||`legacy-${index}`,time:point.time,valueDb:gainToDb(point.value),interpolation:'linear'})),duration);
}

export function envelopeDbAt(time,points=[],stepRamp=STEP_RAMP_SECONDS){
 const p=Array.isArray(points)?points:(Array.isArray(points?.points)?points.points:[]);if(!p.length)return 0;
 const t=Math.max(0,finite(time));if(t<=p[0].time)return p[0].valueDb;if(t>=p.at(-1).time)return p.at(-1).valueDb;
 let lo=1,hi=p.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(t<=p[mid].time)hi=mid;else lo=mid+1}
 const a=p[lo-1],b=p[lo],span=Math.max(1e-9,b.time-a.time);
 if(a.interpolation==='hold'){
  if(a.holdRampSeconds!==undefined)return editedSegmentDbAt(t,a,b,stepRamp);
  const ramp=Math.min(Math.max(0,stepRamp),span/2),start=b.time-ramp;
  if(!ramp||t<=start)return a.valueDb;
  return a.valueDb+(b.valueDb-a.valueDb)*((t-start)/ramp);
 }
 if(span===1e-9&&(a.editBoundary||b.editBoundary))return editedSegmentDbAt(t,a,b,stepRamp);
 return a.valueDb+(b.valueDb-a.valueDb)*((t-a.time)/span);
}
function editedSegmentDbAt(t,a,b,stepRamp){
 const span=Math.max(Number.MIN_VALUE,b.time-a.time);
 if(a.interpolation==='hold'){
  const ramp=stepRamp<=0?0:a.holdRampSeconds===undefined?Math.min(Math.max(0,stepRamp),span/2):Math.min(Math.max(0,a.holdRampSeconds),span),start=b.time-ramp;
  if(!ramp||t<=start)return a.valueDb;
  return a.valueDb+(b.valueDb-a.valueDb)*((t-start)/ramp);
 }
 return a.valueDb+(b.valueDb-a.valueDb)*((t-a.time)/span);
}
export const envelopeGainAt=(time,points,stepRamp=STEP_RAMP_SECONDS)=>dbToGain(envelopeDbAt(time,points,stepRamp));

export function addEnvelopePoint(points,time,valueDb=0,interpolation='linear'){
 const next=normalizeEnvelope(points,86400),at=Math.max(0,finite(time)),existing=next.find(point=>Math.abs(point.time-at)<1e-4);
 if(existing){existing.valueDb=clamp(valueDb,ENVELOPE_MIN_DB,ENVELOPE_MAX_DB);existing.interpolation=interpolation==='hold'?'hold':'linear';return next}
 next.push({id:globalThis.crypto?.randomUUID?.()||`gain-${Date.now()}-${Math.random()}`,time:at,valueDb:clamp(valueDb,ENVELOPE_MIN_DB,ENVELOPE_MAX_DB),interpolation:interpolation==='hold'?'hold':'linear'});return next.sort((a,b)=>a.time-b.time).slice(0,MAX_ENVELOPE_POINTS);
}

export function splitEnvelope(points,at,duration){
 const boundary=clamp(at,0,duration),normalized=normalizeEnvelope(points,duration);
 if(!normalized.length)return[[],[]];
 const exact=normalized.find(point=>point.time===boundary);
 return[sliceEnvelope(normalized,0,boundary,null,exact?.id||`split-left-${boundary}`),sliceEnvelope(normalized,boundary,duration,exact?`${exact.id}-right`:`split-right-${boundary}`,null)];
}

export function trimEnvelope(points,from,to,duration){
 const start=clamp(from,0,duration),end=clamp(to,start,duration),normalized=normalizeEnvelope(points,duration);if(!normalized.length)return[];
 return sliceEnvelope(normalized,start,end,`trim-start-${start}`,`trim-end-${end}`);
}

// Clip the audible curve, not an unsmoothed step. A clipped hold keeps its
// remaining ramp width (which may exceed half the new interval). No helper
// points are inserted; MAX_ENVELOPE_POINTS and its existing limit remain intact.
function sliceEnvelope(points,start,end,startId,endId){
 const boundary=(at,id)=>({at,point:{id,time:at-start,valueDb:envelopeDbAt(at,points),interpolation:'linear',editBoundary:true}}),entries=[];
 if(startId!==null)entries.push(boundary(start,startId));
 for(const point of points)if((startId===null?point.time>=start:point.time>start)&&(endId===null?point.time<=end:point.time<end))entries.push({at:point.time,point:{...point,time:point.time-start}});
 if(endId!==null)entries.push(boundary(end,endId));
 let source=0;
 for(let i=0;i<entries.length-1;i++){
  const from=entries[i].at,to=entries[i+1].at,point=entries[i].point;
  while(source+1<points.length&&points[source+1].time<=from)source++;
  const a=points[source],b=points[source+1];
  if(from>=a.time&&b&&a.interpolation==='hold'){
   const span=b.time-a.time,ramp=a.holdRampSeconds===undefined?Math.min(STEP_RAMP_SECONDS,span/2):Math.min(a.holdRampSeconds,span);
   point.interpolation='hold';point.holdRampSeconds=Math.max(0,to-Math.max(from,b.time-ramp));
  }
 }
 return normalizeEnvelope(entries.map(entry=>entry.point),Math.max(0,end-start));
}

export function retimeEnvelope(points,oldDuration,newDuration){
 const ratio=oldDuration>1e-9?newDuration/oldDuration:1;return normalizeEnvelope((points||[]).map(point=>({...point,time:finite(point.time)*ratio})),newDuration);
}

// Map through source time rather than scaling the output duration. This keeps
// points attached to the same spoken word when the speed curve changes.
export function remapEnvelope(points,oldNodes,newNodes,oldIn=0,newIn=oldIn){
 const interpolate=(value,nodes,axis)=>{for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i];if(value<=b[axis])return a[1-axis]+(value-a[axis])*(b[1-axis]-a[1-axis])/Math.max(1e-9,b[axis]-a[axis])}return nodes.at(-1)[1-axis]};
 // Linked-audio trims reach this function instead of trimEnvelope. Restrict the
 // audible curve only if the source-time mapping is unchanged; speed edits keep
 // the existing point-remapping path below.
 const oldEnd=oldIn+oldNodes.at(-1)[0],newEnd=newIn+newNodes.at(-1)[0];
 if(newIn>=oldIn&&newEnd<=oldEnd&&(newIn>oldIn||newEnd<oldEnd)){
  const start=interpolate(newIn-oldIn,oldNodes,0),end=interpolate(newEnd-oldIn,oldNodes,0);
  const knots=[...oldNodes.map(node=>node[0]+oldIn),...newNodes.map(node=>node[0]+newIn)].filter(source=>source>=newIn&&source<=newEnd);
  if(knots.every(source=>Math.abs(interpolate(source-oldIn,oldNodes,0)-start-interpolate(source-newIn,newNodes,0))<=1e-9))return trimEnvelope(points,start,end,oldNodes.at(-1)[1]);
 }
 return normalizeEnvelope((points||[]).map(point=>({...point,time:interpolate(Math.max(0,oldIn+interpolate(point.time,oldNodes,1)-newIn),newNodes,0)})),newNodes.at(-1)[1]);
}
