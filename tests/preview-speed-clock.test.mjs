import assert from 'node:assert/strict';
import {usesVideoClock} from '../dist/playback-sync.js';
import {advancePhoneClock} from '../dist/phone-playback-clock.js';
import {shiftPlaybackShortcut} from '../dist/playback-shortcuts.js';
import fs from 'node:fs';
const paused={paused:true,seeking:false,ended:false};
for(const speed of [5.118,20,.05]){assert.equal(usesVideoClock({},speed,paused),false);assert.equal(advancePhoneClock(2,.1,null),2.1)}
assert.equal(usesVideoClock({},1,{...paused,paused:false}),true);
assert.equal(usesVideoClock({},1,{...paused,seeking:true}),true);
assert.equal(usesVideoClock({freezeDuration:2},1,{paused:false}),false);
let count=0,allowed=true;const keys=shiftPlaybackShortcut(()=>allowed,()=>count++),shift={code:'ShiftLeft',preventDefault(){}};
keys.down(shift);keys.up(shift);assert.equal(count,1);
keys.down(shift);keys.down({code:'KeyM'});keys.up(shift);assert.equal(count,1);
keys.down(shift);keys.cancel();keys.up(shift);assert.equal(count,1);
allowed=false;keys.down(shift);keys.up(shift);assert.equal(count,1);
assert.match(fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),/usesVideoClock\(c,localSpeed\(row,time-row.start\),video\)/);
console.log('Preview clock: 5.118x / 20x / .05x progress, native stalls and standalone Shift/chord/pointer guards PASS');
