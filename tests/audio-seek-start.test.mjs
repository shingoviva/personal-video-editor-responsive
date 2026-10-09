import assert from 'node:assert/strict';
import {AudioPreview} from '../dist/audio-preview.js';
import {declickGain} from '../dist/mobile-model.js';
import {project,clip} from '../dist/model.js';
const voices=[];globalThis.document={createElement(){let at=0;const events=new Map(),v={dataset:{},paused:true,seeking:false,readyState:1,ended:false,duration:8,seeks:[],calls:0,get currentTime(){return at},set currentTime(x){at=x;this.seeking=true;this.readyState=1;this.seeks.push(x)},load(){},pause(){this.paused=true},play(){this.calls++;this.paused=false;return Promise.resolve()},removeAttribute(){},addEventListener(k,fn){const set=events.get(k)||new Set();set.add(fn);events.set(k,set)},removeEventListener(k,fn){events.get(k)?.delete(fn)},emit(k){for(const fn of [...events.get(k)||[]])fn()},seekSettled(){this.seeking=false;this.emit('seeked')},decoded(){this.readyState=2;this.emit('loadeddata')}};voices.push(v);return v}};
const a=new AudioPreview(),p=project(),m={id:'m',kind:'video',audio:true,duration:8};p.media=[m];p.clips=[{...clip(m),id:'c',start:0}];a.beginPlayback(p);a.sync(p,2,true,()=>'/test.mp4');const v=a.lanes[0].voices[a.lanes[0].active],count=v.seeks.length;
// Seeked may arrive before enough data to play. UI ticks must not chase it.
for(let i=1;i<=6;i++){v.seekSettled();a.sync(p,2+i*.05,true,()=>'/test.mp4')}
assert.equal(v.seeks.length,count,'buffering initial alignment is one seek, not repeated moving targets');v.decoded();v.seekSettled();a.sync(p,2.3,true,()=>'/test.mp4');assert.equal(v.calls,1,'first attempt starts after data is ready');a.pause();a.beginPlayback(p);
let ready=false;const pending=a.preparePlayback(p,4,()=>'/test.mp4').then(()=>ready=true);
await Promise.resolve();await Promise.resolve();
assert.equal(v.currentTime,4,'prepare uses requested source position');
assert.equal(ready,false,'clock cannot start before seek completes');
v.seekSettled();await Promise.resolve();await Promise.resolve();
assert.equal(ready,false,'seek completion alone is not playable data');
v.decoded();await pending;assert.equal(v._alignedKey,v.dataset.key);
a.sync(p,4,true,()=>'/test.mp4');assert.equal(v.calls,2,'first play after arbitrary seek starts audio');
a.pause();a.beginPlayback(p);const cancelled=a.preparePlayback(p,5,()=>'/test.mp4');await Promise.resolve();a.pause();await assert.rejects(cancelled,{name:'AbortError'});
a.dispose();delete globalThis.document;console.log('Cold seek alignment is stable until playable data arrives PASS');

assert.equal(declickGain(7.98,8),1);assert.equal(declickGain(7.991,8),1);assert.ok(declickGain(7.996,8)>0);console.log('Default tail remains full volume until the final 8 ms PASS');
