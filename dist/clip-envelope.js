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
  interpolation:point?.interpolation==='hold'||point?.curve==='hold'?'hold':'linear'
 })).sort((a,b)=>a.time-b.time);
 return points.filter((point,index)=>!index||point.time-points[index-1].time>1e-6);
}

export function legacyGainEnvelope(points,duration=86400){
 return normalizeEnvelope((points||[]).map((point,index)=>({id:point.id||`legacy-${index}`,time:point.time,valueDb:gainToDb(point.value),interpolation:'linear'})),duration);
}

export function envelopeDbAt(time,points=[],stepRamp=STEP_RAMP_SECONDS){
 const p=Array.isArray(points)?points:(Array.isArray(points?.points)?points.points:[]);if(!p.length)return 0;
 const t=Math.max(0,finite(time));if(t<=p[0].time)return p[0].valueDb;if(t>=p.at(-1).time)return p.at(-1).valueDb;
 let lo=1,hi=p.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(t<=p[mid].time)hi=mid;else lo=mid+1}const index=lo;{
  const a=p[index-1],b=p[index],span=Math.max(1e-9,b.time-a.time);
  if(a.interpolation==='hold'){
   const ramp=Math.min(Math.max(0,stepRamp),span/2),start=b.time-ramp;
   if(!ramp||t<=start)return a.valueDb;
   return a.valueDb+(b.valueDb-a.valueDb)*((t-start)/ramp);
  }
  return a.valueDb+(b.valueDb-a.valueDb)*((t-a.time)/span);
 }
 return p.at(-1).valueDb;
}
export const envelopeGainAt=(time,points,stepRamp=STEP_RAMP_SECONDS)=>dbToGain(envelopeDbAt(time,points,stepRamp));

export function addEnvelopePoint(points,time,valueDb=0,interpolation='linear'){
 const next=normalizeEnvelope(points,86400),at=Math.max(0,finite(time)),existing=next.find(point=>Math.abs(point.time-at)<1e-4);
 if(existing){existing.valueDb=clamp(valueDb,ENVELOPE_MIN_DB,ENVELOPE_MAX_DB);existing.interpolation=interpolation==='hold'?'hold':'linear';return next}
 next.push({id:globalThis.crypto?.randomUUID?.()||`gain-${Date.now()}-${Math.random()}`,time:at,valueDb:clamp(valueDb,ENVELOPE_MIN_DB,ENVELOPE_MAX_DB),interpolation:interpolation==='hold'?'hold':'linear'});return next.sort((a,b)=>a.time-b.time).slice(0,MAX_ENVELOPE_POINTS);
}

export function splitEnvelope(points,at,duration){
 const boundary=clamp(at,0,duration),normalized=normalizeEnvelope(points,duration),valueDb=envelopeDbAt(boundary,normalized,0);
 if(!normalized.length)return[[],[]];
 const left=normalized.filter(point=>point.time<boundary-1e-6),right=normalized.filter(point=>point.time>boundary+1e-6).map(point=>({...point,time:point.time-boundary}));
 const exact=normalized.find(point=>Math.abs(point.time-boundary)<=1e-6),curve=exact?.interpolation||normalized.filter(point=>point.time<boundary).at(-1)?.interpolation||'linear';
 left.push({id:exact?.id||`split-left-${boundary}`,time:boundary,valueDb:exact?.valueDb??valueDb,interpolation:curve});
 right.unshift({id:exact?`${exact.id}-right`:`split-right-${boundary}`,time:0,valueDb:exact?.valueDb??valueDb,interpolation:exact?.interpolation||curve});
 return[normalizeEnvelope(left,boundary),normalizeEnvelope(right,Math.max(0,duration-boundary))];
}

export function trimEnvelope(points,from,to,duration){
 const start=clamp(from,0,duration),end=clamp(to,start,duration),normalized=normalizeEnvelope(points,duration);if(!normalized.length)return[];
 const startDb=envelopeDbAt(start,normalized,0),endDb=envelopeDbAt(end,normalized,0),inside=normalized.filter(point=>point.time>start+1e-6&&point.time<end-1e-6).map(point=>({...point,time:point.time-start}));
 return normalizeEnvelope([{id:`trim-start-${start}`,time:0,valueDb:startDb,interpolation:normalized.filter(point=>point.time<=start).at(-1)?.interpolation||'linear'},...inside,{id:`trim-end-${end}`,time:end-start,valueDb:endDb,interpolation:normalized.filter(point=>point.time<=end).at(-1)?.interpolation||'linear'}],end-start);
}

export function retimeEnvelope(points,oldDuration,newDuration){
 const ratio=oldDuration>1e-9?newDuration/oldDuration:1;return normalizeEnvelope((points||[]).map(point=>({...point,time:finite(point.time)*ratio})),newDuration);
}

// Map through source time rather than scaling the output duration. This keeps
// points attached to the same spoken word when the speed curve changes.
export function remapEnvelope(points,oldNodes,newNodes,oldIn=0,newIn=oldIn){
 const interpolate=(value,nodes,axis)=>{for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i];if(value<=b[axis])return a[1-axis]+(value-a[axis])*(b[1-axis]-a[1-axis])/Math.max(1e-9,b[axis]-a[axis])}return nodes.at(-1)[1-axis]};
 return normalizeEnvelope((points||[]).map(point=>({...point,time:interpolate(Math.max(0,oldIn+interpolate(point.time,oldNodes,1)-newIn),newNodes,0)})),newNodes.at(-1)[1]);
}
