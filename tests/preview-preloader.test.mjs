import assert from 'node:assert/strict';
import {PreviewPreloader} from '../dist/preview-preloader.js?v=2.2.85';
class Video extends EventTarget{
 dataset={};readyState=0;paused=true;seeking=false;_time=0;callbacks=new Map();serial=0;listeners=0;seeks=[];
 set src(v){this._src=v;this.readyState=0}get src(){return this._src}
 get currentTime(){return this._time}set currentTime(v){this.seeks.push(v);this._time=v;this.seeking=true}
 pause(){this.paused=true}load(){}
 ready(){this.readyState=2;this.dispatchEvent(new Event('loadeddata'))}
 frame(t){this.seeking=false;this.dispatchEvent(new Event('seeked'));const c=[...this.callbacks.values()];this.callbacks.clear();for(const f of c)f(0,{mediaTime:t})}
 requestVideoFrameCallback(f){const n=++this.serial;this.callbacks.set(n,f);return n}cancelVideoFrameCallback(n){this.callbacks.delete(n)}
}
const flush=()=>new Promise(r=>setTimeout(r,0));
const preloader=new PreviewPreloader(),a=new Video(),b=new Video();
const first=preloader.prime(a,'first','a',1);await flush();a.ready();await flush();a.frame(1);assert.equal(await first,true);assert.deepEqual(a.seeks,[1]);
assert.equal(preloader.prime(a,'first','a',1),first,'Repeated frame ticks reuse the same preparation');
assert.equal(await preloader.claim(a,'first'),true,'A fully prepared matching frame can be adopted without seeking again');
const pending=preloader.prime(a,'second','b',2);await flush();const claimed=preloader.claim(a);assert.equal(await claimed,false);assert.equal(await pending,false);assert.equal(a.callbacks.size,0);
a.ready();await flush();assert.deepEqual(a.seeks,[1],'A late loadeddata after claim cannot write currentTime');
const old=preloader.prime(a,'old','old-url',3);await flush();const next=preloader.prime(b,'next','next-url',4);await flush();a.ready();b.ready();await flush();b.frame(4);assert.equal(await old,false);assert.equal(await next,true);assert.equal(a.currentTime,1,'Old callbacks cannot seek either decoder after ownership changes');
assert.equal(b.currentTime,4);await preloader.cancel();assert.equal(preloader.request,null);assert.equal(b.callbacks.size,0);
console.log('Standby ownership: deduplication, frame-ready preload, claim cancellation, late loadeddata, decoder swap and cleanup PASS');
// The application must not use standby for the following clip while it is
// still about to adopt standby as the *current* clip at a layer boundary.
const fs=await import('node:fs'),vm=await import('node:vm'),source=fs.readFileSync(new URL('../dist/app.js?v=2.2.85',import.meta.url),'utf8');
const start=source.indexOf('function primeNextVideo(){'),end=source.indexOf('\nfunction tick(',start);let primes=0;
const current={clip:{id:'now'}},future={clip:{id:'later'}};
const scope={playbackPlan:{next:()=>({at:2,row:future})},time:1,previewRow:()=>current,mediaOf:()=>({kind:'video',fps:30}),linkURL:()=> 'url',sourcePositionFor:()=>2,activeVideoKey:'old|url',standbyVideo:{},videoSwitch:null,previewPreloader:{prime(){primes++}}};
vm.createContext(scope);vm.runInContext(source.slice(start,end),scope);scope.primeNextVideo();assert.equal(primes,0,'Boundary adoption has priority over future preloading');
scope.activeVideoKey='now|url';scope.primeNextVideo();assert.equal(primes,1);
scope.videoSwitch={target:scope.standbyVideo};scope.primeNextVideo();assert.equal(primes,1,'An in-flight handoff owns standby exclusively');
console.log('Actual preloading integration: current-boundary adoption and loading ownership take priority over the following clip PASS');
