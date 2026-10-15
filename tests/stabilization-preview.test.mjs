import assert from 'node:assert/strict';
import {StabilizationPreview} from '../dist/stabilization-preview.js';

class WorkerStub{
 constructor(url,options){this.url=url;this.options=options;WorkerStub.instances.push(this)}
 postMessage(message){this.message=message;queueMicrotask(()=>this.onmessage({data:{type:'done',path:{scale:1.08,points:[{time:1,x:.02,y:-.01,angle:.01},{time:3,x:.06,y:.03,angle:.03}]}}}))}
 terminate(){this.terminated=true}
}
WorkerStub.instances=[];globalThis.Worker=WorkerStub;

const changes=[],preview=new StabilizationPreview((...args)=>changes.push(args));
const clip={id:'clip-1',in:1,out:3,stabilization:'NATURAL'},media={id:'media-1'},file={name:'camera.mov',size:42,lastModified:7};
assert.equal(preview.state(clip,media,file).status,'idle');
preview.ensure(clip,media,file);assert.equal(preview.state(clip,media,file).status,'analyzing');
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(preview.state(clip,media,file).status,'ready');
const correction=preview.correction(clip,media,file,2);assert.ok(Math.abs(correction.x-.04)<1e-12);assert.ok(Math.abs(correction.y-.01)<1e-12);assert.ok(Math.abs(correction.angle-.02)<1e-12);assert.equal(correction.scale,1.08);
assert.equal(WorkerStub.instances[0].options.type,'module');assert.equal(WorkerStub.instances[0].message.clip.stabilization,'NATURAL');assert.equal(WorkerStub.instances[0].terminated,true);
assert.equal(preview.state({...clip,in:1.5},media,file).status,'idle');
assert.equal(preview.state({...clip,stabilization:'OFF'},media,file).status,'off');
preview.clear();assert.equal(preview.state(clip,media,file).status,'idle');
assert.deepEqual(changes.map(value=>value[0]),['analyzing','ready']);
console.log('Stabilization preview: cache identity, worker lifecycle and interpolated correction PASS');

// Pending decodes must not survive OFF, deletion, changed ranges or memory release.
class DelayedWorker{constructor(){this.terminated=false;DelayedWorker.all.push(this)}postMessage(){}terminate(){this.terminated=true}}
DelayedWorker.all=[];globalThis.Worker=DelayedWorker;
const notifications=[],managed=new StabilizationPreview((...a)=>notifications.push(a));
const reconcile=clips=>managed.reconcile(clips,()=>media,()=>file);
managed.ensure(clip,media,file);const old=DelayedWorker.all.at(-1);
reconcile([{...clip,stabilization:'OFF'}]);assert.equal(old.terminated,true);assert.equal(managed.pending.size,0);
const count=notifications.length;old.onmessage({data:{type:'progress',value:.5}});old.onmessage({data:{type:'done',path:{scale:9,points:[]}}});old.onerror({message:'late'});
assert.equal(notifications.length,count);assert.equal(managed.cache.size,0);assert.equal(managed.failed.size,0);
managed.ensure(clip,media,file);const original=DelayedWorker.all.at(-1);
managed.ensure({...clip,in:1.5},media,file);assert.equal(original.terminated,true);assert.equal(managed.pending.size,1);
reconcile([]);assert.equal(managed.pending.size,0);assert.equal(DelayedWorker.all.at(-1).terminated,true);
managed.ensure(clip,media,file);const beforeClear=DelayedWorker.all.at(-1);managed.clear();managed.ensure(clip,media,file);const afterClear=DelayedWorker.all.at(-1);
beforeClear.onmessage({data:{type:'done',path:{scale:9,points:[]}}});assert.equal(managed.pending.size,1);assert.equal(managed.cache.size,0,'late completion cannot overwrite a restarted request with the same key');
const path={scale:1.08,points:[{time:1,x:0,y:0,angle:0},{time:3,x:.02,y:.01,angle:0}]};
afterClear.onmessage({data:{type:'done',path}});assert.equal(managed.state(clip,media,file).status,'ready');
const workersBefore=DelayedWorker.all.length;reconcile([clip]);managed.ensure(clip,media,file);assert.equal(DelayedWorker.all.length,workersBefore,'valid completed paths survive timeline redraws');
reconcile([{...clip,stabilization:'OFF'}]);assert.equal(managed.cache.size,0);managed.ensure(clip,media,file);assert.equal(managed.pending.size,1,'undo/re-enable can request a fresh path');
const other={...clip,id:'other'};managed.ensure(other,media,file);const kept=DelayedWorker.all.at(-1);reconcile([other]);assert.equal(managed.pending.size,1);assert.equal(kept.terminated,false,'removing one clip must not interrupt another valid analysis');
managed.reconcile([other],()=>media,()=>({...file,lastModified:8}));assert.equal(kept.terminated,true,'relinking the same media ID invalidates its old source');
managed.ensure({...other,freezeDuration:2},media,file);assert.equal(managed.pending.size,0);managed.clear();delete globalThis.Worker;
console.log('Stabilization resource lifecycle: OFF/delete/range/relink, stale completion, cache reuse and re-enable PASS');
