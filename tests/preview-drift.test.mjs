import assert from 'node:assert/strict';
import * as sync from '../dist/playback-sync.js';
const running={currentTime:1,seeking:false,paused:false,ended:false};
assert.equal(sync.needsPreviewSeek(running,1.16,{playing:true,continuous:true}),false,'Small drift during the same clip must not trigger periodic video seeks');
assert.equal(sync.needsPreviewSeek(running,1.7,{playing:true,continuous:true}),true,'A real discontinuity still requires a seek');
assert.equal(sync.needsPreviewSeek(running,1.02,{playing:false,continuous:true,fps:60}),true,'Scrubbing stays frame precise');
assert.equal(sync.needsPreviewSeek(running,1.16,{playing:true,continuous:true,still:true}),true,'Freeze and extreme-speed modes remain seek driven');
for(const speed of [.25,.5,1,2,4]){
 const at=10*speed,media={...running,currentTime:at};
 assert.equal(sync.needsPreviewSeek(media,at+.2*speed,{playing:true,continuous:true,speed}),false);
 assert.equal(sync.needsPreviewSeek(media,at+.7*speed,{playing:true,continuous:true,speed}),true);
 let source=0,seeks=0,maxError=0;
 for(let i=1;i<=1800;i++){
  const target=i/60*speed;media.currentTime=source;
  const rate=sync.previewPlaybackRate(media,target,speed);
  assert(Math.abs(rate/speed-1)<=.040001,'Correction is bounded to four percent');
  source+=rate*.98/60;media.currentTime=source;
  if(sync.needsPreviewSeek(media,target,{playing:true,continuous:true,speed})){seeks++;source=target}
  maxError=Math.max(maxError,Math.abs(source-target)/speed);
 }
 assert.equal(seeks,0,'Thirty seconds of decoder clock skew must not periodically seek');
 assert(maxError<.08,'Smooth correction keeps drift below 80 ms');
}
assert.equal(sync.previewPlaybackRate({...running,paused:true},1.2,1),1);
assert.equal(sync.previewPlaybackRate({...running,seeking:true},1.2,1),1);
assert.equal(sync.previewPlaybackRate(running,1.001,1),1,'Tiny drift has a dead band');
console.log('Continuous preview: smooth bounded rate sync, 30-second skew without seeks, speed normalization, real discontinuity and precise scrub PASS');
const {LayerPreview}=await import('../dist/layer-preview.js');
const {clip}=await import('../dist/model.js');
let seeks=0,draws=0,errors=0;
const decoder={readyState:4,seeking:false,paused:false,ended:false,get currentTime(){return 1},set currentTime(t){seeks++;throw Error('Unexpected steady-state seek')},getAttribute(){return 'mock'},play:async()=>{},pause(){this.paused=true},removeAttribute(){},load(){}};
globalThis.document={body:{dataset:{ui:'desktop'}},createElement:()=>decoder};
const media={id:'m',kind:'video',duration:6,fps:30},row={clip:clip(media),start:0,end:6,duration:6};
const layer=new LayerPreview({style:{},getContext:()=>null});layer.url='mock';layer.clipKey=`${row.clip.id}|mock`;layer.painter={draw(){draws++},black(){errors++},release(){},dispose(){}};
await layer.update(row,1.16,media,'mock',null,'Original',false,true);
assert.equal(seeks,0);assert.equal(errors,0);assert.equal(draws,1);assert(decoder.playbackRate>1&&decoder.playbackRate<=1.04);
layer.busy=true;layer.framePending=true;layer.pending=[];assert.equal(layer.ready(row),true,'An already presented layer cannot stall the entire composite during correction');
assert.equal(layer.ready({...row,clip:{...row.clip,id:'next'}}),false,'A new clip still needs its first matching frame');
layer.pending=null;layer.dispose();delete globalThis.document;
console.log('Actual lower-layer update: steady skew does not seek or block other layers; first-frame protection retained PASS');
// Run the actual main-video sync path, rather than only the timing helper.
const fs=await import('node:fs'),vm=await import('node:vm'),{timing}=await import('../dist/model.js');
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),a=app.indexOf('async function syncVideo('),b=app.indexOf('\nfunction localSpeed(',a);
const main={...decoder,paused:false,playbackRate:1,currentTime:1};let mainSeeks=0;
const context={previewTrace:null,previewPreloader:{cancel(){},claim:async()=>{}},videoSwitch:null,time:1.16,playing:true,preparingPlayback:false,previewRow:()=>row,mediaOf:()=>media,linkURL:()=> 'mock',stillPreview:{clear(){}},
 activeVideoKey:`${row.clip.id}|mock`,video:main,loadGeneration:1,loadPromise:Promise.resolve(),sourcePosition:()=>1.16,localSpeed:()=>1,timing,
 previewMediaEnded:sync.previewMediaEnded,needsPreviewSeek:sync.needsPreviewSeek,previewPlaybackRate:sync.previewPlaybackRate,
 seekVideoFrame:()=>{mainSeeks++;throw Error('Unexpected main-video seek')}};
vm.createContext(context);vm.runInContext(app.slice(a,b),context);assert.equal(await context.syncVideo(),true);assert.equal(mainSeeks,0);assert(main.playbackRate>1&&main.playbackRate<=1.04);
console.log('Actual main-video sync: 160 ms skew adjusts muted video rate without seeking PASS');
// A cancelled standby load must not poison the still-valid active decoder.
// Stop during B's load, seek back to A, then replay A without replacing it.
const cancelledLoad=Promise.reject(new DOMException('cancelled standby','AbortError'));cancelledLoad.catch(()=>{});
context.loadPromise=cancelledLoad;context.playing=false;context.P={};context.audioPreview={sync(){}};
context.seekVideoFrame=async()=>{mainSeeks++};main.paused=true;
assert.equal(await context.syncVideo(true),true,'Returning to the active clip after a cancelled standby load must remain playable');
console.log('Cancelled standby loading cannot poison active-clip seek/replay PASS');
let loadingStarted;
const enteredLoad=new Promise(resolve=>loadingStarted=resolve);
context.AbortController=AbortController;context.loadController=null;
context.standbyVideo={dataset:{url:'mock'},readyState:0,pause(){}};
context.previewRow=()=>({...row,clip:{...row.clip,id:'next-loading'}});
context.waitForMedia=(_target,_event,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true});loadingStarted()});
const interruptedSwitch=context.syncVideo();await enteredLoad;
context.loadGeneration++;context.loadController.abort();context.previewRow=()=>row;
assert.equal(await interruptedSwitch,false);
assert.equal(await context.syncVideo(true),true,'Actual aborted loading followed by seeking the original clip recovers');
assert.equal(context.video,main);assert.equal(context.videoSwitch,null);
console.log('Actual interrupted handoff: original decoder retained, request ownership cleared, seek/replay recovers PASS');
