import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PreviewPlaybackClock} from '../dist/preview-playback-clock.js?v=2.2.84';
import {PreviewPlaybackScheduler} from '../dist/preview-playback-scheduler.js?v=2.2.84';
const source=fs.readFileSync(new URL('../dist/app.js?v=2.2.84',import.meta.url),'utf8');
const start=source.indexOf('function tickPlayback('),end=source.indexOf('\nlet drawnAt=',start);assert(start>=0&&end>start);
const clock=new PreviewPlaybackClock(),audioDevice={state:'running',currentTime:100};clock.start(2,{now:0,context:audioDevice});
let frames=0,audioSync=0,pendingVideo=0,finishVideo;
const ctx={loopPlayback:false,previewRow:()=>({clip:{id:'current'}}),mediaOf:()=>({kind:'video'}),activeVideoKey:'current|mock',cancelVideoSync(){},linkURL:()=> 'mock',time:2,playing:true,playbackClock:clock,playbackSession:{current:s=>s===1},previewTrace:null,
 audioPreview:{clock:()=>({waiting:true}),sync(){audioSync++}},duration:()=>20,
 primeNextVideo(){},previewPlaybackScheduler:new PreviewPlaybackScheduler(),syncVideo(){pendingVideo++;return new Promise(r=>finishVideo=r)},
 bgmAudio:{},P:{bgm:{volume:1,fadeIn:0,fadeOut:0}},gainAt:()=>1,clamp:v=>v,draw(){frames++},updateClock(){},requestAnimationFrame:()=>1,
 pause(){ctx.playing=false;clock.stop()},toast:e=>{throw Error(e)}};
vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
for(let i=1;i<=1200;i++){
 audioDevice.currentTime=100+i/120;
 // Changing/lagging media clocks and a blocked video load do not retime output.
 ctx.audioPreview.clock=()=>i%3?{time:Math.max(0,ctx.time-.2)}:{waiting:true};
 ctx.tickPlayback(i*1000/120,1);assert(Math.abs(ctx.time-(2+i/120))<1e-8);
 if(i%20===0)await Promise.resolve();
}
assert.equal(pendingVideo,1,'A pending decoder load is serialized');assert(audioSync>=100,'Audio envelopes continue during a blocked decoder');assert.equal(frames,1200);
const at=ctx.time;ctx.tickPlayback(500000,0);assert.equal(ctx.time,at,'Old sessions cannot advance the clock');
finishVideo();await new Promise(r=>setTimeout(r,0));
audioDevice.state='interrupted';ctx.tickPlayback(10010,1);assert.equal(ctx.playing,false,'Audio-device interruption pauses native decoders rather than changing clocks');
audioDevice.state='running';ctx.playing=true;clock.start(ctx.time,{now:10010,context:audioDevice});
audioDevice.currentTime=118;ctx.tickPlayback(18000,1);assert.equal(ctx.time,20);assert.equal(ctx.playing,false,'Completion stops rather than wraps');
console.log('Actual playback loop: fixed audio clock, 10 seconds of waiting/lagging decoders, audio updates, serialized video, stale sessions and completion PASS');

let loopTarget=null;ctx.playing=true;ctx.loopPlayback=true;ctx.seek=t=>{loopTarget=t};audioDevice.currentTime=130;clock.start(19.99,{now:0,context:audioDevice});audioDevice.currentTime+=.1;ctx.tickPlayback(600000,1);assert.equal(loopTarget,0);assert.equal(ctx.playing,true);
