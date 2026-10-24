// B3 evidence only; historical failure reproduction is separate from assertions.
// node scripts/check-envelope-limit.mjs output-directory
import fs from 'node:fs/promises';import path from 'node:path';
import * as e from '../dist/clip-envelope.js?v=2.2.85';import * as before from '../tests/fixtures/envelope-pre-b3.mjs';
import {mixWindow,gainAtCompiled} from '../dist/mobile-model.js?v=2.2.85';
import {b3Results,denseEnvelope} from '../tests/envelope-limit.test.mjs';
const out=process.argv[2];if(!out)throw Error('output directory required');await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'numeric.json'),JSON.stringify(b3Results,null,2)+'\n');
const fixtures=[],pcm=[];const rate=48000,source=[new Float32Array(rate),new Float32Array(rate)];
for(let c=0;c<2;c++)for(let i=0;i<rate;i++)source[c][i]=.25*Math.sin(2*Math.PI*(440+c*37)*i/rate);
for(const n of [254,255,256,257,512,1024,1026]){
 const points=denseEnvelope(n),cut=.9989,[left,right]=e.splitEnvelope(points,cut,1),trim=e.trimEnvelope(points,0,1,1),samples=[];
 function render(api,split){const dst=new Float32Array(rate*2),parts=split?api.splitEnvelope(points,cut,1).map((p,i)=>({points:p,from:i?cut:0,first:i?Math.ceil(cut*rate):0,last:i?rate:Math.ceil(cut*rate)})):[{points,from:0,first:0,last:rate}];
  for(const part of parts)mixWindow(dst,part.first,part.last-part.first,source,i=>part.first+i,i=>gainAtCompiled((part.first+i)/rate-part.from,1,1,0,0,[],part.points));return dst;
 }
 const target=render(e,false),old=render(before,true),actual=render(e,true);let beforeMax=0,afterMax=0,where=0;
 for(let i=0;i<target.length;i++){beforeMax=Math.max(beforeMax,Math.abs(target[i]-old[i]));const d=Math.abs(target[i]-actual[i]);if(d>afterMax){afterMax=d;where=(i%rate)/rate}}
 if(afterMax>1e-7)throw Error('PCM regression '+afterMax);
 pcm.push({points:n,samples:target.length,beforeMax,afterMax,sourceTime:where});
 // Independent JS sample-by-sample reference for native FFmpeg expression.
 for(let i=0;i<rate;i++)samples.push(.25*before.envelopeGainAt(i/rate,points));
 fixtures.push({n,duration:1,points,cut,left,right,trim,sampleExpected:samples});
}
await fs.writeFile(path.join(out,'pcm.json'),JSON.stringify({rate,channels:2,tolerance:1e-7,method:'actual mixWindow/gainAtCompiled; unchanged clip declick excluded from envelope-only comparison',rows:pcm},null,2)+'\n');
await fs.writeFile(path.join(out,'native-fixtures.json'),JSON.stringify(fixtures)+'\n');
const perf=[];let checksum=0;
for(const n of [256,1024])for(const operation of ['normalize','evaluate']){
 const points=denseEnvelope(n),times={before:[],after:[]},iterations=operation==='evaluate'?300000:2000;
 for(let round=-2;round<9;round++)for(const side of round%2?['after','before']:['before','after']){
  const api=side==='before'?before:e,start=performance.now();for(let i=0;i<iterations;i++)checksum+=operation==='evaluate'?api.envelopeGainAt((i%10000)/10000,points):api.normalizeEnvelope(points).length;
  if(round>=0)times[side].push(performance.now()-start);
 }
 const median=xs=>[...xs].sort((a,b)=>a-b)[4],b=median(times.before),a=median(times.after);
 perf.push({n,operation,iterations,times,beforeMs:b,afterMs:a,changePercent:(a/b-1)*100,note:operation==='normalize'&&n>256?'before discards excess points, not equivalent work':'same full input'});
}
await fs.writeFile(path.join(out,'performance.json'),JSON.stringify({node:process.version,order:'2 warmup + 9 alternating paired rounds',checksum,rows:perf},null,2)+'\n');
console.log(JSON.stringify({numeric:b3Results,pcm,performance:perf.map(p=>({n:p.n,operation:p.operation,beforeMs:p.beforeMs,afterMs:p.afterMs,changePercent:p.changePercent}))}));
