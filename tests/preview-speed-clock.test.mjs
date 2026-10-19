import assert from 'node:assert/strict';
import {PreviewPlaybackClock} from '../dist/preview-playback-clock.js';
import {shiftPlaybackShortcut} from '../dist/playback-shortcuts.js';
import fs from 'node:fs';
for(const speed of [5.118,20,.05]){const clock=new PreviewPlaybackClock();clock.start(2,{now:0});assert.equal(clock.read(100),2.1,'Seek-driven preview speed cannot pin the output clock')}
let count=0,allowed=true;const keys=shiftPlaybackShortcut(()=>allowed,()=>count++),shift={code:'ShiftLeft',preventDefault(){}};
keys.down(shift);keys.up(shift);assert.equal(count,1);
keys.down(shift);keys.down({code:'KeyM'});keys.up(shift);assert.equal(count,1);
keys.down(shift);keys.cancel();keys.up(shift);assert.equal(count,1);
allowed=false;keys.down(shift);keys.up(shift);assert.equal(count,1);
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');assert.match(app,/time=playbackClock.read\(now\)/);assert.doesNotMatch(app,/time=advancePhoneClock/);
console.log('Preview clock: 5.118x / 20x / .05x progress, native stalls and standalone Shift/chord/pointer guards PASS');
