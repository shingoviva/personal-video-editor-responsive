import assert from 'node:assert/strict';
import {seekVideoFrame,videoFrameReady,cancelVideoFrame} from '../dist/media-state.js?v=2.2.85';
class Video extends EventTarget{
 constructor(){super();this.readyState=4;this.seeking=false;this._time=1;this.callbacks=new Map();this.next=0;this.cancelled=0}
 get currentTime(){return this._time}set currentTime(t){this._time=t;this.seeking=true}
 requestVideoFrameCallback(fn){const id=++this.next;this.callbacks.set(id,fn);return id}
 cancelVideoFrameCallback(id){this.callbacks.delete(id);this.cancelled++}
 frame(t){const callbacks=[...this.callbacks.values()];this.callbacks.clear();for(const cb of callbacks)cb(0,{mediaTime:t})}
 seeked(){this.seeking=false;this.dispatchEvent(new Event('seeked'))}
}
const flush=()=>new Promise(r=>setTimeout(r,0));
const v=new Video();let done=false;
const pending=seekVideoFrame(v,2,{fps:30,timeout:100}).then(()=>done=true);
v.seeked();await flush();assert.equal(done,false,'seeked alone does not prove the new frame is presented');
v.frame(1);await flush();assert.equal(done,false,'a queued frame from the old clip cannot complete handoff');
v.frame(2);await pending;assert.equal(done,true);assert.equal(v.callbacks.size,0);
await seekVideoFrame(v,2,{fps:30,timeout:100});assert.equal(v.callbacks.size,0,'unchanged ready frame needs no callback');
const near=new Video();const np=seekVideoFrame(near,2.02,{fps:30,timeout:100});near.frame(2);near.seeked();await np;
const abort=new Video(),controller=new AbortController();const ap=seekVideoFrame(abort,3,{signal:controller.signal,timeout:100});controller.abort();await assert.rejects(ap,{name:'AbortError'});assert.equal(abort.callbacks.size,0);
const fail=new Video();const fp=seekVideoFrame(fail,3,{timeout:10});fail.seeked();await assert.rejects(fp,/タイムアウト/);assert.equal(fail.callbacks.size,0);
const fallback=new Video();fallback.requestVideoFrameCallback=undefined;const bp=seekVideoFrame(fallback,3,{timeout:100});fallback.seeked();await bp;
const error=new Video();const ep=seekVideoFrame(error,4,{timeout:100});error.dispatchEvent(new Event('error'));await assert.rejects(ep,/読み込めません/);assert.equal(error.callbacks.size,0);
console.log('Video handoff: seeked + matching presented frame, stale callbacks, frame rounding, cancellation, timeout, error and legacy fallback PASS');
// Repeated seeks own a single cancellable request. An old completion cannot
// clear the readiness flag of its successor or leak a callback after pause.
const racing=new Video();const oldSeek=seekVideoFrame(racing,2,{timeout:100}).catch(e=>e.name);
const newSeek=seekVideoFrame(racing,3,{timeout:100});await flush();assert.equal(await oldSeek,'AbortError');assert.equal(videoFrameReady(racing),false);
racing.seeked();racing.frame(2);await flush();assert.equal(videoFrameReady(racing),false);racing.frame(3);await newSeek;assert.equal(videoFrameReady(racing),true);
const cancelled=seekVideoFrame(racing,4,{timeout:100});cancelVideoFrame(racing);await assert.rejects(cancelled,{name:'AbortError'});assert.equal(racing.callbacks.size,0);assert.equal(videoFrameReady(racing),false,'A cancelled native seek is not a presented frame');
console.log('Frame-seek ownership: replacement, stale frames, successor readiness and pause cleanup PASS');
// Exercise LayerPreview's actual event handlers; a seeked event with an old
// picture must not repaint a layer that has just moved beneath a fading clip.
const {LayerPreview}=await import('../dist/layer-preview.js?v=2.2.85');
const {clip}=await import('../dist/model.js?v=2.2.85');
let decoded=1,draws=[];
const lv=new Video();lv.paused=true;lv.muted=true;lv.src='mock';lv.getAttribute=()=>lv.src;
lv.pause=()=>lv.paused=true;lv.play=async()=>{lv.paused=false};lv.removeAttribute=()=>{};lv.load=()=>{};
globalThis.document={createElement:()=>lv,body:{dataset:{ui:'desktop'}}};
const layer=new LayerPreview({style:{},getContext:()=>null});layer.url='mock';layer.controller=new AbortController();layer.painter={draw(){draws.push(decoded)},release(){},dispose(){}};
const media={id:'m',kind:'video',duration:6,fps:30};const row={clip:clip(media),start:0,end:6,duration:6};
const rendering=layer.update(row,2,media,'mock',null,'Original',false,true);
lv.seeked();lv.onseeked();assert.deepEqual(draws,[],'old picture stays out of the newly revealed layer');
decoded=2;lv.frame(2);await rendering;assert.deepEqual(draws,[2]);
const waiting=layer.update(row,3,media,'mock',null,'Original',false,true);layer.clear();await waiting;
assert.equal(lv.callbacks.size,0);assert.deepEqual(draws,[2],'deleting a layer cancels its pending frame');
// A failed lower decoder presents its existing black/error surface instead
// of holding the whole composite indefinitely.
layer.url='mock';lv.src='mock';layer.controller=new AbortController();layer.painter.black=()=>{};lv._time=1;lv.seeking=false;lv.requestVideoFrameCallback=()=>{throw Error('decoder failed')};
await layer.update(row,2,media,'mock',null,'Original',false,true);assert.equal(layer.ready(row),true);
layer.dispose();delete globalThis.document;
console.log('Layer presentation: no seeked flash, matching decoded frame, deletion cancellation PASS');
// An async handoff must not install a now-expired clip, even when the next
// clip uses the exact same media file (a common three-layer fade setup).
const fs=await import('node:fs'),vm=await import('node:vm');
const app=fs.readFileSync(new URL('../dist/app.js?v=2.2.85',import.meta.url),'utf8');
const a=app.indexOf('async function syncVideo('),b=app.indexOf('\nfunction localSpeed(',a);
const first={clip:{id:'first',media:'m'}},next={clip:{id:'next',media:'m'}};
let current=first,completeFrame,frameStarted;
const started=new Promise(r=>frameStarted=r),frameReady=new Promise(r=>completeFrame=r);
const ctx={previewTrace:null,previewPreloader:{cancel(){},claim:async()=>{}},videoSwitch:null,previewMemoryReleased:false,playing:true,previewRow:()=>current,mediaOf:()=>media,linkURL:()=> 'mock',
 stillPreview:{clear(){}},activeVideoKey:'old|mock',video:{pause(){}},standbyVideo:{dataset:{url:'mock'},readyState:4,pause(){}},
 loadController:null,loadGeneration:0,AbortController,waitForMedia:async()=>{},seekVideoFrame:()=>{frameStarted();return frameReady},sourcePosition:()=>2,
 previewMediaEnded,toast:()=>{},pause:()=>{}};
function previewMediaEnded(){}
vm.createContext(ctx);vm.runInContext(app.slice(a,b),ctx);
const switching=ctx.syncVideo();await started;current=next;completeFrame();assert.equal(await switching,false);assert.equal(ctx.activeVideoKey,'old|mock');
console.log('Async handoff rejects an expired clip with the same media URL PASS');
