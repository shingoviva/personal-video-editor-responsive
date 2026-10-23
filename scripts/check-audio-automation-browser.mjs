// Browser PCM equivalence; uses an isolated context, no user projects or media.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const [baseURL,output]=process.argv.slice(2);
if(!baseURL||!output)throw Error('URL output.json required');
const {chromium,webkit}=await import(process.env.PVE_PLAYWRIGHT_MODULE?pathToFileURL(process.env.PVE_PLAYWRIGHT_MODULE):'playwright');
const oracle=(await fs.readFile(new URL('../tests/fixtures/audio-automation-reference.mjs',import.meta.url),'utf8')).replace(/^import .*$/gm,'').replaceAll('export function ','function ');
const reports=[];
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(name==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 try{const page=await browser.newPage();await page.addInitScript(()=>sessionStorage.setItem('pve.iphone.project-launcher-seen','1'));await page.goto(baseURL);
 const report=await page.evaluate(async oracle=>{
  const {AudioPreview}=await import('./audio-preview.js?v=2.2.84'),{envelopeGainAt}=await import('./clip-envelope.js?v=2.2.84'),{declickGain}=await import('./mobile-model.js?v=2.2.84');
  const {referenceSchedule}=new Function('envelopeGainAt','declickGain',oracle+';return {referenceSchedule}')(envelopeGainAt,declickGain);
  async function render(schedule,local,separate=false){const rate=48000,length=24000,ctx=new OfflineAudioContext(separate?14:2,length,rate),rows=[];
   const merger=separate?ctx.createChannelMerger(14):null;merger?.connect(ctx.destination);
   for(let lane=0;lane<7;lane++){
    const source=ctx.createBufferSource(),buffer=ctx.createBuffer(2,length,rate);
    for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<length;i++)data[i]=.03*Math.sin(2*Math.PI*(220+lane*70+ch*11)*i/rate)}
    source.buffer=buffer;const gain=ctx.createGain(),graph={output:gain};source.connect(gain);
    if(separate){const splitter=ctx.createChannelSplitter(2);gain.connect(splitter);for(let ch=0;ch<2;ch++)splitter.connect(merger,ch,lane*2+ch)}else gain.connect(ctx.destination);
    const audio={volume:.1+lane*.1,fadeIn:.05,fadeOut:.1,gainKeyframes:lane===0?[]:[{time:0,value:.2},{time:2,value:1},{time:2,value:0},{time:2.000001,value:2},{time:8,value:.5}],gainEnvelope:lane%2?[]:[{time:0,valueDb:-6,interpolation:'hold'},{time:2,valueDb:6},{time:8,valueDb:-12}]};
    rows.push({graph,audio});source.start(0);
   }
   const update=()=>{for(const {graph,audio}of rows)schedule.call({context:ctx},graph,{audio},local+ctx.currentTime,8,.8,true)};
   update();const updates=[.11,.22,.33,.44].map(now=>ctx.suspend(now).then(async()=>{update();await ctx.resume()}));const result=ctx.startRendering();await Promise.all(updates);return result;
  }
  const diff=(a,b)=>{let maxAbsoluteError=0,differingSamples=0,samples=0;for(let ch=0;ch<a.numberOfChannels;ch++){const x=a.getChannelData(ch),y=b.getChannelData(ch);for(let i=0;i<x.length;i++){maxAbsoluteError=Math.max(maxAbsoluteError,Math.abs(x[i]-y[i]));samples++;if(!Object.is(x[i],y[i]))differingSamples++}}return{maxAbsoluteError,differingSamples,samples}};
  const cases=[];let pcmSamples=0;
  for(const local of [0,1.997,7.8]){
   const old=await render(referenceSchedule,local,true),optimized=await render(AudioPreview.prototype.scheduleGain,local,true),lanes=diff(old,optimized);
   if(lanes.differingSamples)throw Error('Per-lane PCM mismatch '+JSON.stringify(lanes));pcmSamples+=lanes.samples;
   // Identical per-lane inputs also give identical sums in a fixed arithmetic order.
   let summedError=0;for(let ch=0;ch<2;ch++)for(let i=0;i<old.length;i++){let a=0,b=0;for(let lane=0;lane<7;lane++){a+=old.getChannelData(lane*2+ch)[i];b+=optimized.getChannelData(lane*2+ch)[i]}summedError=Math.max(summedError,Math.abs(a-b))}if(summedError)throw Error('Summed lane mismatch');
   // Native mixer summation order can vary between contexts. Record old/old control;
   // do not treat its small rounding noise as an optimization error or hide it.
   const mixedOld=await render(referenceSchedule,local),mixedNew=await render(AudioPreview.prototype.scheduleGain,local),mixedControl=await render(referenceSchedule,local);
   cases.push({local,lanes,fixedOrderSumMaxError:summedError,nativeMixBeforeAfter:diff(mixedOld,mixedNew),nativeMixBeforeBefore:diff(mixedOld,mixedControl)});
  }
  return{result:'PASS exact per-lane PCM and fixed-order sums',pcmSamples,maxAbsoluteError:0,rate:48000,channelsPerLane:2,lanes:7,cases,method:'OfflineAudioContext, actual incremental scheduling at suspended render quantum boundaries; deterministic stereo sources; native mixer old/old control recorded separately; not a live listening/latency test'};
 },oracle);reports.push({browser:name,...report});console.log(name,report.result,report.pcmSamples,report.maxAbsoluteError);
 }finally{await browser.close()}
}
await fs.writeFile(output,JSON.stringify({reports},null,2));
