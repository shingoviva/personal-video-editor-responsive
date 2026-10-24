// Numeric/PCM/performance evidence, separate from the historical bug probe.
// node scripts/check-envelope-edit-safety.mjs output-directory
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as current from '../dist/clip-envelope.js?v=2.2.85';
import * as before from '../tests/fixtures/envelope-pre-b2.mjs';
import * as mixer from '../dist/mobile-model.js?v=2.2.85';
import {measureEdits,tolerances,longCoordinateResults} from '../tests/envelope-edit-safety.test.mjs';
import {envelopeEditCases} from '../tests/fixtures/envelope-edit-cases.mjs';
const output=process.argv[2];if(!output)throw Error('output directory required');await fs.mkdir(output,{recursive:true});
const numeric={before:measureEdits(before),after:measureEdits(current),tolerances,longCoordinateResults};
await fs.writeFile(path.join(output,'numeric.json'),JSON.stringify(numeric,null,2)+'\n');
const denseLimit=Array.from({length:256},(_,i)=>({id:'p'+i,time:(i+1)/257,valueDb:i%2?-12:0,interpolation:'linear'}));
const diagnoseLimit=api=>({trimEnd:api.trimEnvelope(denseLimit,0,1,1).at(-1).time,splitEnd:api.splitEnvelope(denseLimit,.999,1)[0].at(-1).time,limit:api.MAX_ENVELOPE_POINTS});
await fs.writeFile(path.join(output,'b3-dependency.json'),JSON.stringify({expectedEnds:{trim:1,split:.999},before:diagnoseLimit(before),after:diagnoseLimit(current),note:'Diagnostic of a separate known B3 bug, not a correct-behavior assertion'},null,2)+'\n');
const rate=48000,count=rate*2,source=[new Float32Array(count),new Float32Array(count)];
for(let ch=0;ch<2;ch++)for(let i=0;i<count;i++)source[ch][i]=.3*Math.sin(2*Math.PI*(440+ch*37)*i/rate);
const fixture=envelopeEditCases[0],points=before.normalizeEnvelope(fixture.points,2);
function pcm(api,cut,dec){
 const dest=new Float32Array(count*2),parts=cut===null?[{start:0,end:count,from:0,duration:2,points}]:api.splitEnvelope(points,cut,2).map((points,index)=>({start:index?Math.ceil(cut*rate):0,end:index?count:Math.ceil(cut*rate),from:index?cut:0,duration:index?2-cut:cut,points}));
 for(const part of parts)mixer.mixWindow(dest,part.start,part.end-part.start,source,i=>part.start+i,i=>{
  const global=(part.start+i)/rate,local=global-part.from;
  return mixer.gainAtCompiled(local,part.duration,1,0,0,[],part.points)*(dec?mixer.declickGain(local,part.duration):1);
 });return dest;
}
function diff(a,b,cut,exclude=0){let max=0,at=-1,different=0,samples=0,energy=0,outsideMax=0;for(let i=0;i<a.length;i++){
 const d=Math.abs(a[i]-b[i]),time=(i%count)/rate;samples++;energy+=d*d;if(d){different++;if(d>max){max=d;at=time}}if(Math.abs(time-cut)>=exclude)outsideMax=Math.max(outsideMax,d);
 }return{samples,different,maxAbsoluteError:max,sourceTime:at,rms:Math.sqrt(energy/samples),outsideBoundaryMax:outsideMax,excludedRadius:exclude};}
const pcmReport=[];
for(const cut of [.994,.995,.9975,.998,.999999999,1,1.000000001,.997503]){
 const control=pcm(current,null,false),old=pcm(before,cut,false),next=pcm(current,cut,false);
 const originalWithDeclick=pcm(current,null,true),editedWithDeclick=pcm(current,cut,true);
 const envelope=diff(next,control,cut),raw=diff(editedWithDeclick,originalWithDeclick,cut,.008);
 if(envelope.maxAbsoluteError>1e-7||raw.outsideBoundaryMax>1e-7)throw Error('PCM precision regression');
 pcmReport.push({cut,beforeEnvelope:diff(old,control,cut),afterEnvelope:envelope,actualClipDeclickDifference:raw});
}
await fs.writeFile(path.join(output,'pcm.json'),JSON.stringify({rate,channels:2,source:'deterministic stereo sine, actual mixWindow/gainAtCompiled',tolerance:1e-7,rows:pcmReport},null,2)+'\n');
// Preserve the optimized mobile-model implementation, changing only its envelope
// import in a temporary comparison module; no production source is rewritten.
const tempPath=path.join(path.resolve(output),'before-mobile-model.mjs'),root=new URL('../dist/',import.meta.url);
let sourceModule=await fs.readFile(new URL('mobile-model.js',root),'utf8');
sourceModule=sourceModule.replace("'./model.js?v=2.2.85'",JSON.stringify(new URL('model.js',root).href)).replace("'./clip-envelope.js?v=2.2.85'",JSON.stringify(new URL('../tests/fixtures/envelope-pre-b2.mjs',import.meta.url).href));
await fs.writeFile(tempPath,sourceModule);const oldMixer=await import(pathToFileURL(tempPath));
const dense=Array.from({length:256},(_,i)=>({time:i/25.5,valueDb:i%2?-12:0,interpolation:i%3?'linear':'hold'})),keys=mixer.compileGainKeyframes(Array.from({length:32},(_,i)=>({time:i/3.1,value:.25+i/40}))),edited=current.trimEnvelope(points,.992,1.2,2);
const workloads=[{name:'raw-legacy-256',before:t=>before.envelopeGainAt(t,dense),after:t=>current.envelopeGainAt(t,dense)},
 {name:'compiled-legacy-256',before:t=>oldMixer.gainAtCompiled(t,10,.8,0,0,keys,dense),after:t=>mixer.gainAtCompiled(t,10,.8,0,0,keys,dense)},
 {name:'compiled-edited',before:t=>oldMixer.gainAtCompiled(t/50,.208,.8,0,0,keys,edited),after:t=>mixer.gainAtCompiled(t/50,.208,.8,0,0,keys,edited)}];
const performanceResults=[],iterations=300000;
for(const workload of workloads){const timings={before:[],after:[]};let checksum=0;
 for(let round=-2;round<9;round++)for(const side of round%2?['after','before']:['before','after']){
  const started=performance.now();for(let i=0;i<iterations;i++)checksum+=workload[side]((i%10000)/1000);const ms=performance.now()-started;if(round>=0)timings[side].push(ms);
 }
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)],b=median(timings.before),a=median(timings.after);
 performanceResults.push({workload:workload.name,iterations,rounds:9,timings,medianBeforeMs:b,medianAfterMs:a,changePercent:(a/b-1)*100,checksum});
}
await fs.writeFile(path.join(output,'performance.json'),JSON.stringify({node:process.version,order:'2 warmup + 9 alternating paired rounds per workload',rows:performanceResults},null,2)+'\n');await fs.unlink(tempPath);
// Fixtures for the native FFmpeg expression tests; values generated only by the
// production JS split/trim. FFmpeg evaluation is independently executed in Python.
const pythonFixtures=[];
for(const fixture of envelopeEditCases.filter(f=>f.points.length>1)){
 for(const cut of fixture.cuts){const [left,right]=current.splitEnvelope(fixture.points,cut,fixture.duration);pythonFixtures.push({name:fixture.name,kind:'split',source:fixture.points,duration:fixture.duration,cut,left,right})}
 for(const [from,to]of fixture.ranges)pythonFixtures.push({name:fixture.name,kind:'trim',source:fixture.points,duration:fixture.duration,from,to,points:current.trimEnvelope(fixture.points,from,to,fixture.duration)});
}
await fs.writeFile(path.join(output,'native-fixtures.json'),JSON.stringify(pythonFixtures,null,2)+'\n');
console.log(JSON.stringify({numericBefore:numeric.before.db,numericAfter:numeric.after.db,PCM:pcmReport.map(r=>({cut:r.cut,before:r.beforeEnvelope.maxAbsoluteError,after:r.afterEnvelope.maxAbsoluteError,rawDeclick:r.actualClipDeclickDifference.maxAbsoluteError})),performance:performanceResults.map(r=>({name:r.workload,changePercent:r.changePercent}))}));
