import assert from 'node:assert/strict';
import * as e from '../dist/clip-envelope.js?v=2.2.84';
import * as before from './fixtures/envelope-pre-b3.mjs';
import {project,clip,trimClip,splitClip,sanitize,timing} from '../dist/model.js?v=2.2.84';
import {splitLinkedPair,syncLinkedAudio} from '../dist/linked-audio.js?v=2.2.84';
export function denseEnvelope(count,duration=1){return Array.from({length:count},(_,i)=>({id:'dense-'+i,time:duration*(i+1)/(count+1),valueDb:-6+6*Math.sin(i*.3),interpolation:i%4?'linear':'hold'}))}
export const b3Results={boundaries:[],samples:0,maxDb:0,maxPosition:null};
function compare(points,from,to,actual,name){
 const sample=t=>{if(t<from||t>to)return;const local=t-from,error=Math.abs(e.envelopeDbAt(local,actual)-before.envelopeDbAt(t,points));b3Results.samples++;if(error>b3Results.maxDb){b3Results.maxDb=error;b3Results.maxPosition={name,sourceTime:t,localTime:local}};assert(error<=1e-8,JSON.stringify({name,t,error}))};
 for(let i=0;i<=5000;i++)sample(from+(to-from)*i/5000);
 for(const p of points)for(const delta of [-.005,-1e-9,-1e-12,0,1e-12,1e-9])sample(p.time+delta);
}
for(const n of [254,255,256,257,1023,1024,1025]){
 const p=denseEnvelope(n),snapshot=JSON.stringify(p),normalized=e.normalizeEnvelope(p,1);assert.equal(normalized.length,n);
 assert.deepEqual(normalized.map(p=>p.id),p.map(p=>p.id));
 const tr=e.trimEnvelope(p,0,1,1);assert.equal(tr.length,n+2);assert.equal(tr[0].time,0);assert.equal(tr.at(-1).time,1);compare(p,0,1,tr,'trim-'+n);
 const cut=(p.at(-1).time+1)/2,[left,right]=e.splitEnvelope(p,cut,1);assert.equal(left.length,n+1);assert.equal(left.at(-1).time,cut);assert.equal(right[0].time,0);
 compare(p,0,cut,left,'split-left-'+n);compare(p,cut,1,right,'split-right-'+n);
 for(const at of [0,.500123,1]){
  if(n<e.MAX_ENVELOPE_POINTS){const added=e.addEnvelopePoint(p,at,-3);assert.equal(added.length,n+1);assert(added.some(p=>p.time===at));assert(p.every(old=>added.some(next=>next.id===old.id)))}
  else assert.throws(()=>e.addEnvelopePoint(p,at,-3),error=>error.code==='ENVELOPE_POINT_LIMIT'&&error.message.includes('1024'));
  assert.equal(JSON.stringify(p),snapshot,'request never mutates source');
 }
 // Updating and deleting existing points remains possible even above budget.
 const updated=e.addEnvelopePoint(p,p[10].time,-3,'hold');assert.equal(updated.length,n);assert.equal(updated.find(v=>v.id===p[10].id).valueDb,-3);
 const deleted=e.normalizeEnvelope(normalized.filter(v=>v.id!==p[10].id),1);assert.equal(deleted.length,n-1);
 const media={id:'m'+n,kind:'audio',duration:1,audio:true},pr=project(),c=clip(media);c.audio.gainEnvelope=tr;pr.media=[media];pr.audioClips=[c];
 const restored=sanitize(JSON.parse(JSON.stringify(pr)));assert.deepEqual(restored.audioClips[0].audio.gainEnvelope,tr);
 const undo=structuredClone(pr),redo=structuredClone(restored);assert.deepEqual(undo.audioClips[0].audio.gainEnvelope,redo.audioClips[0].audio.gainEnvelope);
 b3Results.boundaries.push({input:n,normalized:n,trim:tr.length,leftSplit:left.length,manualAddition:n<e.MAX_ENVELOPE_POINTS?'preserved':'refused unchanged'});
}
// At the manual budget, only the requested update is allowed; no tail eviction.
assert.equal(e.MAX_ENVELOPE_POINTS,1024);
// Short dense clips and B2 micro-boundaries inside hold ramps.
for(const duration of [.004,1]){
 const p=denseEnvelope(256,duration),index=100,a=p[index],b=p[index+1];a.interpolation='hold';
 const ramp=Math.min(.005,(b.time-a.time)/2),cut=b.time-ramp/2;
 const [left,right]=e.splitEnvelope(p,cut,duration);compare(p,0,cut,left,'hold-short-left');compare(p,cut,duration,right,'hold-short-right');
 const from=b.time-1e-12,to=b.time+1e-12,micro=e.trimEnvelope(p,from,to,duration);assert.equal(micro[0].time,0);assert.equal(micro.at(-1).time,to-from);compare(p,from,to,micro,'micro-boundary');
 let fromTime=0,toTime=duration,edited=e.normalizeEnvelope(p,duration);
 for(let round=0;round<8;round++){const length=toTime-fromTime,from=length*.01,to=length*.99;edited=e.trimEnvelope(edited,from,to,length);fromTime+=from;toTime=fromTime+(to-from);compare(p,fromTime,toTime,edited,'repeat-trim');assert.equal(edited[0].time,0);assert.equal(edited.at(-1).time,to-from)}
}
// Model/linked edits publish every boundary and preserve original clip lengths.
{
 const m={id:'linked-dense',kind:'video',duration:1,audio:true},p=project(),v=clip(m),a={...clip(m),id:'linked-a',sourceClip:v.id,linked:true};
 v.audio.gainEnvelope=denseEnvelope(256);a.audio.gainEnvelope=denseEnvelope(256);p.media=[m];p.clips=[v];p.audioClips=[a];
 const saved=structuredClone(p),cut=.9989;const right=splitLinkedPair(p,v,cut);assert(right);assert.equal(v.out,cut);assert.equal(right.in,cut);assert.equal(timing(v).duration+timing(right).duration,1);
 assert.equal(v.audio.gainEnvelope.at(-1).time,cut);assert.equal(p.audioClips[0].audio.gainEnvelope.at(-1).time,cut);
 const back=sanitize(JSON.parse(JSON.stringify(p)));assert.deepEqual(back.clips.map(c=>c.audio.gainEnvelope),p.clips.map(c=>c.audio.gainEnvelope));assert.deepEqual(back.audioClips.map(c=>c.audio.gainEnvelope),p.audioClips.map(c=>c.audio.gainEnvelope));assert.deepEqual(back.clips.map(c=>[c.in,c.out]),p.clips.map(c=>[c.in,c.out]));
 assert.equal(saved.clips[0].out,1);assert.equal(saved.audioClips[0].audio.gainEnvelope.length,256);
 const c=clip(m);c.audio.gainEnvelope=denseEnvelope(256);trimClip(c,'out',.999,1);assert.equal(c.out,.999);assert.equal(c.audio.gainEnvelope.at(-1).time,.999);
}
console.log(JSON.stringify({B3:'PASS',...b3Results,toleranceDb:1e-8}));
