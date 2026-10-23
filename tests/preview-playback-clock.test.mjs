import assert from 'node:assert/strict';
import {PreviewPlaybackClock} from '../dist/preview-playback-clock.js?v=2.2.84';
const clock=new PreviewPlaybackClock();clock.start(2,{now:1000});assert.equal(clock.read(2500),3.5);
// A new top clip, lagging decoder and a pending video seek cannot move its anchor.
for(let ms=2600;ms<=6500;ms+=100)assert(Math.abs(clock.read(ms)-(2+(ms-1000)/1000))<1e-9);
clock.stop();assert.equal(clock.read(999999),7.5);
const audio={state:'running',currentTime:40};clock.start(8,{now:1000,context:audio});audio.currentTime=41.25;assert.equal(clock.read(900000),9.25,'UI delays cannot change the audio master');
audio.state='suspended';assert.equal(clock.read(1000000),9.25,'Audio interruption does not switch to a different clock');
audio.state='running';audio.currentTime=41.5;assert.equal(clock.read(1000100),9.5);
clock.stop();clock.start(.5,{now:10000});assert(Math.abs(clock.read(10100)-.6)<1e-9,'Explicit seek/replay creates a new anchor');
clock.start(1,{now:0,context:{state:'suspended',currentTime:100}});assert.equal(clock.read(250),1.25);
console.log('Playback session clock: fixed wall/audio anchor, decoder-independent progress, interruptions, pause and replay PASS');
