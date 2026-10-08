import assert from 'node:assert/strict';
import{waitForMedia,seekMedia}from'../dist/media-state.js';
// EventTarget reproduces event ordering, not decoding or browser rendering.
class Media extends EventTarget{readyState=0;_time=0;get currentTime(){return this._time}set currentTime(t){this._time=t;this.dispatchEvent(new Event('seeked'))}}
let media=new Media();let p=waitForMedia(media,'loadedmetadata');media.dispatchEvent(new Event('loadedmetadata'));await p;
media.readyState=2;await waitForMedia(media,'loadedmetadata',{ready:()=>media.readyState>=1});await seekMedia(media,2);assert.equal(media.currentTime,2);media.seeking=true;let resumed=false;const pendingSeek=seekMedia(media,2).then(()=>{resumed=true});await Promise.resolve();assert.equal(resumed,false,'same target must still wait while an earlier seek is in progress');media.seeking=false;media.dispatchEvent(new Event('seeked'));await pendingSeek;assert.equal(resumed,true);
let ac=new AbortController();p=waitForMedia(media,'loadeddata',{signal:ac.signal});ac.abort();await assert.rejects(p,{name:'AbortError'});
p=waitForMedia(media,'loadeddata',{timeout:5});await assert.rejects(p,/タイムアウト/);
p=waitForMedia(media,'loadeddata');media.dispatchEvent(new Event('error'));await assert.rejects(p,/読み込めません/);
console.log('Media events: load, cached load, immediate seek, cancellation, timeout, decode error: PASS');
