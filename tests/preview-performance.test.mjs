import assert from 'node:assert/strict';
import {performanceModes,performanceMode,setPerformanceMode,previewFrameInterval,memorySnapshot,cancelIdleRelease} from '../dist/preview-performance.js';

assert.deepEqual(Object.keys(performanceModes),['eco','balanced','quality']);
setPerformanceMode('eco');assert.equal(performanceMode(),'eco');assert.equal(previewFrameInterval(),1000/24);
setPerformanceMode('quality');assert.equal(previewFrameInterval(),1000/60);
assert.equal(setPerformanceMode('invalid'),'quality');assert.equal(memorySnapshot().mode,'quality');cancelIdleRelease();
console.log('Preview performance: selectable FPS budget and safe memory snapshot PASS');

const {needsPreviewSeek}=await import('../dist/playback-sync.js');
assert.equal(needsPreviewSeek({currentTime:1,seeking:false},1.06,{playing:true,fps:60}),false,'ordinary decoder drift does not repeatedly seek');
assert.equal(needsPreviewSeek({currentTime:1,seeking:false},1.2,{playing:true,fps:60}),true,'large drift is corrected');
assert.equal(needsPreviewSeek({currentTime:1,seeking:false},1.06,{playing:false,fps:60}),true,'scrubbing stays frame precise');
assert.equal(needsPreviewSeek({currentTime:1,seeking:true},3,{playing:true}),false,'pending seek is not overwritten');
assert.equal(needsPreviewSeek({currentTime:1,seeking:false},1.06,{playing:true,still:true,fps:60}),true,'extreme slow and freeze remain precise');
const {clipAlpha,textPose}=await import('../dist/creative.js');
const {clip}=await import('../dist/model.js');
for(const speed of [1,.5,2]){const c={...clip({id:'m',duration:1}),speed,fadeIn:.1,fadeOut:.1};const duration=1/speed;for(let t=0;t<duration;t+=.01)assert.ok(Math.abs(clipAlpha({clip:c,start:0,end:duration},t)-textPose({start:0,end:duration,fadeIn:.1,fadeOut:.1},t).alpha)<1e-6,'logo/video and text fades share local timing');}
console.log('Short-cut playback: bounded drift correction and matching fade timing PASS');
