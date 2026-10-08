import assert from'node:assert/strict';
import{clip,project,splitClip,trimClip,timing,sanitize}from'../dist/model.js';
import{dbToGain,envelopeDbAt,envelopeGainAt,addEnvelopePoint,snapEnvelopeDb,splitEnvelope,trimEnvelope,retimeEnvelope,normalizeEnvelope,STEP_RAMP_SECONDS}from'../dist/clip-envelope.js';
import{gainAt}from'../dist/mobile-model.js';
const close=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
let points=[];points=addEnvelopePoint(points,0,0);points=addEnvelopePoint(points,1,-12);points=addEnvelopePoint(points,2,0);
close(envelopeDbAt(0,points,0),0);close(envelopeDbAt(1,points,0),-12);close(envelopeDbAt(2,points,0),0);close(envelopeDbAt(.5,points,0),-6);
assert.equal(snapEnvelopeDb(.69),0);assert.equal(snapEnvelopeDb(-.69),0);assert.equal(snapEnvelopeDb(.16,true),.16);assert.equal(snapEnvelopeDb(.14,true),0);
points[1].valueDb=-8;points[1].valueDb=0;assert.equal(points[1].valueDb,0);
const hold=normalizeEnvelope([{id:'a',time:0,valueDb:-12,interpolation:'hold'},{id:'b',time:1,valueDb:0,interpolation:'linear'}],2);
assert.equal(envelopeDbAt(.9,hold),-12);assert.equal(envelopeDbAt(1,hold),0);assert(envelopeDbAt(1-STEP_RAMP_SECONDS/2,hold)>-12);assert(envelopeDbAt(1-STEP_RAMP_SECONDS/2,hold)<0);
const jumpBefore=envelopeGainAt(1-STEP_RAMP_SECONDS-.001,hold),jumpMid=envelopeGainAt(1-STEP_RAMP_SECONDS/2,hold),jumpAfter=envelopeGainAt(1,hold);assert(jumpBefore<jumpMid&&jumpMid<jumpAfter);
close(gainAt(.5,2,.5,0,0,[],points),.5*dbToGain(0));close(gainAt(0,2,1,.5,0,[],[]),0);close(gainAt(.25,2,1,.5,0,[],[]),.5);close(gainAt(1.75,2,1,0,.5,[],[]),.5);
const media={id:'audio',kind:'audio',duration:10,audio:true},source={...clip(media),kind:'audio',start:4,out:4};source.audio.gainEnvelope=normalizeEnvelope([{id:'p0',time:0,valueDb:0},{id:'p1',time:1,valueDb:-12},{id:'p2',time:3,valueDb:0}],4);
const right=splitClip(source,2);assert(right);close(timing(source).duration,2);close(timing(right).duration,2);close(envelopeDbAt(2,source.audio.gainEnvelope,0),-6);close(envelopeDbAt(0,right.audio.gainEnvelope,0),-6);close(envelopeDbAt(1,right.audio.gainEnvelope,0),0);assert.equal(right.start,6);
const baseAudio=clip(media).audio,trimmed={...clip(media),kind:'audio',out:4,audio:{...baseAudio,gainEnvelope:normalizeEnvelope([{time:0,valueDb:0},{time:2,valueDb:-12},{time:4,valueDb:0}],4)}};trimClip(trimmed,'in',1,10);close(timing(trimmed).duration,3);close(envelopeDbAt(0,trimmed.audio.gainEnvelope,0),-6);close(envelopeDbAt(1,trimmed.audio.gainEnvelope,0),-12);trimClip(trimmed,'out',3,10);close(timing(trimmed).duration,2);close(envelopeDbAt(2,trimmed.audio.gainEnvelope,0),-6);
const duplicate=structuredClone(trimmed);duplicate.id='copy';duplicate.start=8;assert.deepEqual(duplicate.audio.gainEnvelope,trimmed.audio.gainEnvelope);duplicate.audio.gainEnvelope[0].valueDb=-20;assert.notEqual(duplicate.audio.gainEnvelope[0].valueDb,trimmed.audio.gainEnvelope[0].valueDb);assert.equal(trimmed.start??0,0);
const retimed=retimeEnvelope(points,2,4);close(retimed[1].time,2);close(envelopeDbAt(2,retimed,0),0);
const legacy=project();legacy.media=[media];legacy.audioClips=[{...clip(media),kind:'audio',out:2,audio:{volume:1,gainKeyframes:[{time:0,value:1},{time:1,value:.25}]}}];const restored=sanitize(JSON.parse(JSON.stringify(legacy)));assert.equal(restored.audioClips[0].audio.gainKeyframes.length,0);close(restored.audioClips[0].audio.gainEnvelope[1].valueDb,-12.041199826559248,1e-9);
const many=Array.from({length:256},(_,index)=>({id:String(index),time:index/25.5,valueDb:index%2?-12:0,interpolation:index%5?'linear':'hold'})),began=performance.now();let checksum=0;for(let clipIndex=0;clipIndex<200;clipIndex++)for(let index=0;index<500;index++)checksum+=envelopeGainAt(index/50,many);assert(checksum>0);assert(performance.now()-began<2500,'Envelope evaluation became too slow');
const[left,rightPoints]=splitEnvelope(many,5,10);assert(left.length&&rightPoints.length);assert(trimEnvelope(many,2,8,10).length);
globalThis.document={createElement:()=>({dataset:{},paused:true,readyState:2,currentTime:0,seeking:false,pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},load(){},removeAttribute(){}})};
const{AudioPreview}=await import('../dist/audio-preview.js');const preview=new AudioPreview(),audioOnly=project();audioOnly.media=[media];audioOnly.audioClips=[{...clip(media),kind:'audio',out:2,audio:{...clip(media).audio,gainEnvelope:points}}];assert.doesNotThrow(()=>preview.sync(audioOnly,.5,false,()=>'/audio.wav'));preview.dispose();
console.log('Clip Gain Envelope: dB/linear/step, 0 dB snap/reset, fade, split/trim/duplicate/move, retime, migration, load and audio-only preview PASS');
const {remapEnvelope}=await import('../dist/clip-envelope.js');const {sourceOffset,outputOffset}=await import('../dist/model.js');
const before={...clip(media),out:10,curve:'ease-in',speed:.5,endSpeed:3},after={...before,curve:'ease-out',speed:2,endSpeed:.2};
const anchored=[{id:'speech',time:outputOffset(4,before),valueDb:-12,interpolation:'hold'}],mapped=remapEnvelope(anchored,timing(before).nodes,timing(after).nodes);close(sourceOffset(mapped[0].time,after),4);
const back=remapEnvelope(mapped,timing(after).nodes,timing(before).nodes);close(back[0].time,anchored[0].time);
const {dbToY,yToDb}=await import('../dist/clip-envelope-ui.js');for(const db of [-96,-24,-12,-6,0,12])close(yToDb(dbToY(db,60),60),db);
let curve;const graph={output:{gain:{cancelScheduledValues(){},setValueCurveAtTime(value){curve=value},setValueAtTime(){}}}};preview.context={currentTime:0};const automation={audio:{volume:.8,gainEnvelope:hold}};preview.scheduleGain(graph,automation,.9,2,1,true);assert(curve);for(const index of [0,Math.floor(curve.length*.5),curve.length-1])close(curve[index],gainAt(.9+.15*index/(curve.length-1),2,.8,0,0,[],hold)*Math.min(1,(2-(.9+.15*index/(curve.length-1)))/.008),1e-7);
console.log('Source-anchored speed ramps, readable dB scale and scheduled preview/export gain samples PASS');

const {snapEnvelopeDrag}=await import('../dist/clip-envelope-ui.js');
for(const height of [40,60,100]){
 const zero=dbToY(0,height);
 for(const direction of [-1,1]){
  const near=yToDb(zero+direction*4,height);
  assert.deepEqual(snapEnvelopeDrag(near,height),{valueDb:0,latched:true});
  assert.equal(snapEnvelopeDrag(yToDb(zero+direction*7,height),height,true).latched,true);
  assert.equal(snapEnvelopeDrag(yToDb(zero+direction*9,height),height,true).latched,false);
 }
 assert.equal(snapEnvelopeDrag(yToDb(zero+1,height),height,false,true).valueDb,0);
 assert.equal(snapEnvelopeDrag(yToDb(zero+5,height),height,true,true).latched,false);
}
console.log('Pixel-based 0 dB snap, hysteresis and fine dragging PASS');
