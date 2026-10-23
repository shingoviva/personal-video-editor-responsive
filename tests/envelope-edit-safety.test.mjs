import assert from 'node:assert/strict';
import * as current from '../dist/clip-envelope.js?v=2.2.84';
import * as oracle from './fixtures/envelope-pre-b2.mjs';
import {envelopeEditCases} from './fixtures/envelope-edit-cases.mjs';
import {clip,project,splitClip,trimClip,sanitize,timing,sourceOffset,outputOffset} from '../dist/model.js?v=2.2.84';
// Declared before measurement: 1e-8 dB / 5e-9 linear gain, for these <=2s
// cases, including sub-microsecond boundary distances. Not a PCM/declick budget.
export const tolerances={db:1e-8,gain:5e-9};
export function measureEdits(api,steps=10000){
 const result={samples:0,db:{max:0},gain:{max:0},cases:[]};
 for(const fixture of envelopeEditCases){
  const p=oracle.normalizeEnvelope(fixture.points,fixture.duration),edits=[];
  for(const cut of fixture.cuts){const [left,right]=api.splitEnvelope(p,cut,fixture.duration);edits.push({kind:'split-left',from:0,to:cut,points:left},{kind:'split-right',from:cut,to:fixture.duration,points:right})}
  for(const [from,to]of fixture.ranges)edits.push({kind:'trim',from,to,points:api.trimEnvelope(p,from,to,fixture.duration)});
  const row={name:fixture.name,edits:edits.length,maxDb:0,maxGain:0};
  for(const edit of edits){
   const sample=(sourceTime)=>{
    if(sourceTime<edit.from||sourceTime>edit.to)return;
    const local=sourceTime-edit.from,expectedDb=oracle.envelopeDbAt(sourceTime,p),expectedGain=oracle.envelopeGainAt(sourceTime,p);
    const db=Math.abs(api.envelopeDbAt(local,edit.points)-expectedDb),gain=Math.abs(api.envelopeGainAt(local,edit.points)-expectedGain);result.samples++;
    row.maxDb=Math.max(row.maxDb,db);row.maxGain=Math.max(row.maxGain,gain);
    for(const [key,error]of [['db',db],['gain',gain]])if(error>result[key].max)result[key]={max:error,fixture:fixture.name,edit:edit.kind,range:[edit.from,edit.to],sourceTime,localTime:local};
   };
   for(let i=0;i<=steps;i++)sample(edit.from+(edit.to-edit.from)*i/steps);
   // Independently dense windows at hold ramp starts/ends and both crop edges.
   for(const point of p)for(const delta of [-.005,-.0025,-1e-6,-1e-9,-1e-12,0,1e-12,1e-9,1e-6,.0025,.005])sample(point.time+delta);
   for(const boundary of [edit.from,edit.to])for(let i=-100;i<=100;i++)sample(boundary+i*1e-7);
  }
  result.cases.push(row);
 }
 return result;
}
const measured=measureEdits(current);
assert(measured.db.max<=tolerances.db,JSON.stringify(measured.db));assert(measured.gain.max<=tolerances.gain,JSON.stringify(measured.gain));
// Existing unedited hold semantics remain byte-for-byte in double evaluation.
let legacyComparisons=0;
for(const {points,duration}of envelopeEditCases)for(let i=0;i<=20000;i++){
 const p=oracle.normalizeEnvelope(points,duration),t=duration*i/20000;
 assert.equal(current.envelopeDbAt(t,p),oracle.envelopeDbAt(t,p));legacyComparisons++;
}
// Model operations, including nonconstant speed: compare the same source frame,
// not equal timeline offsets on differently located clips.
const media={id:'b2-media',kind:'audio',audio:true,duration:2};
for(const speed of [{speed:1,endSpeed:1,curve:'constant'},{speed:.5,endSpeed:2,curve:'ease-in'}]){
 const original={...clip(media),...speed,out:2};original.audio.gainEnvelope=current.normalizeEnvelope(envelopeEditCases[0].points,2);
 const sourceCut=sourceOffset(.998,original),offset=outputOffset(sourceCut,original),left=structuredClone(original),right=splitClip(left,sourceCut);
 assert(right);for(let i=0;i<=1000;i++){const source=original.in+(original.out-original.in)*i/1000,c=source<=sourceCut?left:right;
  const expected=oracle.envelopeDbAt(outputOffset(source-original.in,original),original.audio.gainEnvelope),actual=current.envelopeDbAt(outputOffset(source-c.in,c),c.audio.gainEnvelope);
  assert(Math.abs(expected-actual)<tolerances.db,'source-time split');
 }
 const p=project();p.media=[media];p.audioClips=[structuredClone(left),structuredClone(right)];
 const restored=sanitize(JSON.parse(JSON.stringify(p)));assert.deepEqual(restored.audioClips.map(c=>c.audio.gainEnvelope),p.audioClips.map(c=>c.audio.gainEnvelope));
 const pre=structuredClone(original),edited=structuredClone(original);trimClip(edited,'in',sourceCut,2);const post=structuredClone(edited);
 // The app uses whole-project structuredClone snapshots; normalization on load
 // must not erase the ramp width or near-boundary points.
 const history=[pre],future=[];let state=post;future.push(structuredClone(state));state=history.pop();assert.deepEqual(state,pre);history.push(structuredClone(state));state=future.pop();assert.deepEqual(state,post);
 for(let i=0;i<=1000;i++){const t=offset+(timing(original).duration-offset)*i/1000;assert(Math.abs(current.envelopeDbAt(t-offset,state.audio.gainEnvelope)-oracle.envelopeDbAt(t,original.audio.gainEnvelope))<tolerances.db)}
}
// Nested edits retain widths across repeated normalization/serialization.
{
 const fixture=envelopeEditCases[0],p=current.trimEnvelope(fixture.points,.992,1.2,2),[l,r]=current.splitEnvelope(p,.006,.208);
 const copy=current.normalizeEnvelope(JSON.parse(JSON.stringify(r)),.202);
 for(let i=0;i<=10000;i++){const t=.998+.202*i/10000;assert(Math.abs(current.envelopeDbAt(t-.998,copy)-oracle.envelopeDbAt(t,fixture.points))<tolerances.db)}
 assert(Math.abs(current.envelopeDbAt(.006,l)-current.envelopeDbAt(0,r))<tolerances.db);
}
// B3's point-count limit is unchanged. Bug reproduction lives in the separate
// evidence script, never in assertions that define correct B2 behavior.
assert.equal(current.MAX_ENVELOPE_POINTS,1024);
console.log(JSON.stringify({B2:'PASS',...measured,legacyComparisons,tolerances,modelSplitTrim:true,snapshotUndoRedo:true,saveRestore:true,nestedEdits:true,B3:'manual creation budget 1024; no data truncation'}));
// Linked structural trims use remapEnvelope, while speed changes must retain
// their original source-anchored remapping behavior.
{
 const {syncLinkedAudio,splitLinkedPair}=await import('../dist/linked-audio.js?v=2.2.84');
 for(const cut of [.992,.996,.998,1.000000001]){
  const p=project(),videoMedia={...media,kind:'video'},video=clip(videoMedia);video.id='linked-video';video.out=2;
  const audio={...clip(media),id:'linked-audio',sourceClip:video.id,linked:true,out:2};audio.audio.gainEnvelope=current.normalizeEnvelope(envelopeEditCases[0].points,2);
  p.media=[videoMedia];p.clips=[video];p.audioClips=[audio];
  trimClip(video,'in',cut,2);syncLinkedAudio(p,video);
  for(let i=0;i<=10000;i++){const t=cut+(2-cut)*i/10000;assert(Math.abs(current.envelopeDbAt(t-cut,audio.audio.gainEnvelope)-oracle.envelopeDbAt(t,envelopeEditCases[0].points))<tolerances.db,'linked trim')}
 }
 const p=project(),v=clip({...media,kind:'video'}),a={...clip(media),id:'paired-audio',sourceClip:v.id,linked:true};
 v.audio.gainEnvelope=current.normalizeEnvelope(envelopeEditCases[0].points,2);a.audio.gainEnvelope=structuredClone(v.audio.gainEnvelope);p.media=[media];p.clips=[v];p.audioClips=[a];splitLinkedPair(p,v,.998);
 for(const c of p.audioClips)for(let i=0;i<=1000;i++){const t=c.in+(c.out-c.in)*i/1000;assert(Math.abs(current.envelopeDbAt(t-c.in,c.audio.gainEnvelope)-oracle.envelopeDbAt(t,envelopeEditCases[0].points))<tolerances.db,'linked split')}
}
console.log('B2 linked-audio trim/split preserves the same source-time curve PASS');
// Supplemental long-coordinate diagnostics. Keep the <=2s budget unchanged;
// account separately for absolute-time cancellation at up to the 24h limit.
export const longCoordinateResults=[];
for(const offset of [1200,86398]){
 const p=[{time:offset,valueDb:-12,interpolation:'hold'},{time:offset+1,valueDb:0,interpolation:'linear'},{time:offset+2,valueDb:-6,interpolation:'linear'}],cut=offset+.998,[left,right]=current.splitEnvelope(p,cut,offset+2);
 let maxDb=0,sourceTime=0;
 for(let i=0;i<=20000;i++){const t=offset+.99+.02*i/20000,actual=current.envelopeDbAt(t<=cut?t:t-cut,t<=cut?left:right),error=Math.abs(actual-oracle.envelopeDbAt(t,p));if(error>maxDb){maxDb=error;sourceTime=t}}
 // First-order cancellation budget: 8 roundoffs in the time arithmetic, times
 // the steepest 12dB/5ms slope. This is not a relaxation of the short-time tests.
 const budgetDb=8*Number.EPSILON*(offset+2)*(12/.005);
 assert(maxDb<=budgetDb,JSON.stringify({offset,maxDb,budgetDb}));longCoordinateResults.push({offset,samples:20001,maxDb,sourceTime,budgetDb});
}
console.log(JSON.stringify({B2LongCoordinates:longCoordinateResults}));
// Same-source validation for linked trims on all existing speed curve modes;
// this does not change the speed engine or introduce new curve modes.
{
 const {syncLinkedAudio}=await import('../dist/linked-audio.js?v=2.2.84');let maxDb=0;
 for(const curve of ['linear','ease-in','ease-out','ease-in-out'])for(const cut of [.992,.998,1.001]){
  const p=project(),v={...clip({...media,kind:'video'}),speed:.5,endSpeed:2,curve},original=structuredClone(v),a={...structuredClone(v),id:'ramp-audio',sourceClip:v.id,linked:true};
  a.audio.gainEnvelope=current.normalizeEnvelope(envelopeEditCases[0].points,timing(v).duration);const reference=structuredClone(a.audio.gainEnvelope);
  p.media=[media];p.clips=[v];p.audioClips=[a];const sourceCut=sourceOffset(cut,v);trimClip(v,'in',sourceCut,2);syncLinkedAudio(p,v);
  for(let i=0;i<=10000;i++){const source=sourceCut+(2-sourceCut)*i/10000;maxDb=Math.max(maxDb,Math.abs(current.envelopeDbAt(outputOffset(source-sourceCut,a),a.audio.gainEnvelope)-oracle.envelopeDbAt(outputOffset(source,original),reference)))}
 }
 assert(maxDb<tolerances.db,'linked existing-speed-curve trim');console.log(JSON.stringify({B2LinkedExistingSpeedCurves:12,samples:120012,maxDb}));
}
