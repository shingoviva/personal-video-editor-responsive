import assert from 'node:assert/strict';
import {advancePhoneClock,phonePaneSizes} from '../dist/phone-playback-clock.js';
import {AudioPreview} from '../dist/audio-preview.js';
import {project,clip} from '../dist/model.js';
for(const height of [300,400,480,650,800])for(const mode of ['balanced','preview','timeline']){const {preview,timeline}=phonePaneSizes(height,mode);assert(Math.abs(preview+timeline-(height-12))<=1);assert(preview>=80);assert(timeline>=Math.min(mode==='timeline'?224:152,(height-12)*.55)-1)}
assert(phonePaneSizes(480,'timeline').timeline>phonePaneSizes(480).timeline);
assert(phonePaneSizes(480,'preview').preview>phonePaneSizes(480).preview);
assert.equal(advancePhoneClock(2,.016,{waiting:true}),2,'decoder stall freezes the editing clock');
assert.equal(advancePhoneClock(2,.016,{time:1.8}),2,'clock never runs backward');
assert.equal(advancePhoneClock(2,.016,{time:2.03}),2.03);
assert.equal(advancePhoneClock(2,3,null),2.25,'foreground resumption cannot skip several seconds');
for(const height of [480,650,800]){const large=phonePaneSizes(height,'balanced',.84);assert(large.preview>phonePaneSizes(height).preview);assert(large.timeline>=151);assert.deepEqual(large,phonePaneSizes(height,'preview'))}
const voices=[];
globalThis.document={createElement(){let position=0;const voice={dataset:{},paused:true,readyState:2,seeking:false,ended:false,seeks:[],get currentTime(){return position},set currentTime(v){position=v;this.seeks.push(v)},decoded(v){position=v},load(){},pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},removeAttribute(){}};voices.push(voice);return voice}};
const audio=new AudioPreview();audio.continuous=true;
const p=project(),m={id:'v',kind:'video',duration:8,audio:true};p.media=[m];p.clips=[{...clip(m),id:'c',start:0}];const row={clip:p.clips[0],start:0,end:8,duration:8,layer:0};
audio.syncLane(audio.lanes[0],row,p,1,true,()=>'/test.mp4',1);
const voice=audio.lanes[0].voices[audio.lanes[0].active];voice.seeks=[];voice.decoded(1.1);
audio.syncLane(audio.lanes[0],row,p,2,true,()=>'/test.mp4',1);audio.syncLane(audio.lanes[0],row,p,.4,true,()=>'/test.mp4',1);
assert.deepEqual(voice.seeks,[],'continuous phone playback does not repeatedly seek under drift');
assert(Math.abs(audio.clock(1).time-1.1)<.001);
voice._wanted=false;assert.deepEqual(audio.clock(1),{waiting:true},'initial audio buffering freezes the clock');voice._wanted=true;voice.seeking=true;assert.deepEqual(audio.clock(1),{waiting:true});voice.seeking=false;
audio.syncLane(audio.lanes[0],row,p,3,false,()=>'/test.mp4',1);assert.equal(voice.currentTime,3,'explicit paused scrubbing still seeks');
p.clips[0].speed=2;p.clips[0].endSpeed=2;delete row._timing;row.end=4;
audio.syncLane(audio.lanes[0],row,p,1,true,()=>'/test.mp4',1);voice.decoded(2.5);assert(Math.abs(audio.clock(1).time-1.25)<.001,'source clock respects playback speed');
audio.dispose();delete globalThis.document;
console.log('Phone pane budget, decoder stalls, monotonic media clock, no drift re-seeking, speed and explicit scrubbing PASS');
