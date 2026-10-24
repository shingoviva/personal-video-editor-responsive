import assert from 'node:assert/strict';
import {StabilizationPreview} from '../dist/stabilization-preview.js?v=2.2.85';

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

// New menus are deliberately small; old projects retain their exact setting.
const {stabilizationOptions,STABILIZATION_MODES,LEGACY_STABILIZATION_MODES}=await import('../dist/stabilization-presets.js?v=2.2.85');
assert.deepEqual(STABILIZATION_MODES,['OFF','WEAK','MEDIUM','STRONG']);
for(const mode of [...STABILIZATION_MODES,...LEGACY_STABILIZATION_MODES]){
 const options=stabilizationOptions(mode);assert.deepEqual(options.slice(0,4).map(v=>v[0]),STABILIZATION_MODES);
 assert.equal(options.length,LEGACY_STABILIZATION_MODES.includes(mode)?5:4);
 if(options.length===5)assert.equal(options.at(-1)[0],mode,'only the saved legacy setting is retained');
}
assert.equal(stabilizationOptions('UNKNOWN').length,4);
const {stabilizationPathFromFrames,smoothPath,motionEstimate}=await import('../dist/mobile-stabilize.js?v=2.2.85');
const size=72,frames=[],raw=[];
for(let n=0;n<30;n++){
 const data=new Uint8ClampedArray(size*size*4),gray=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,value=((x+(n%3))*17+y*31+(x*y)%23)%240;data.set([value,value,value,255],i*4);gray[i]=.299*value+.587*value+.114*value}
 raw.push(gray);frames.push({timestamp:4+n/18,canvas:{getContext:()=>({getImageData:()=>({data})})}});
}
let x=0,y=0,angle=0;const expected=[];
for(let i=0;i<raw.length;i++){if(i){const m=motionEstimate(raw[i-1],raw[i],size);x+=m.x;y+=m.y;angle+=m.angle}expected.push({time:frames[i].timestamp,x,y,angle})}
const progress=[],pathShared=await stabilizationPathFromFrames(frames,'MEDIUM',{size,count:30,onProgress:v=>progress.push(v)});
assert.deepEqual(pathShared,smoothPath(expected,'MEDIUM'),'shared path retains the established algorithm and source timestamps');assert.deepEqual(progress,[.8]);
await assert.rejects(stabilizationPathFromFrames([],'WEAK'),/No decodable/);
let closed=false,checks=0;async function* cancellable(){try{for(const frame of frames)yield frame}finally{closed=true}}
await assert.rejects(stabilizationPathFromFrames(cancellable(),'WEAK',{check:()=>{if(++checks===3)throw Error('cancelled')}}),/cancelled/);assert.equal(closed,true,'cancellation closes the frame iterator');
const {readFile}=await import('node:fs/promises');
const shaderSource=await readFile(new URL('../dist/preview.js?v=2.2.85',import.meta.url),'utf8');
assert.match(shaderSource,/sn\*centered\.y\*\(texel\.x\/texel\.y\)/,'portrait rotation uses physical pixels');
assert.match(shaderSource,/-sn\*centered\.x\*\(texel\.y\/texel\.x\)/,'landscape rotation uses physical pixels');
for(const worker of ['stabilization-preview-worker.js','mobile-render-worker.js']){
 const source=await readFile(new URL('../dist/'+worker,import.meta.url),'utf8');assert.match(source,/stabilizationPathFromFrames\(/);assert.doesNotMatch(source,/motionEstimate\(/,'workers cannot restore divergent analysis copies');
}
console.log('Stabilization shared analysis: legacy compatibility, cancellation, empty decode and aspect-correct rendering PASS');

const {project,sanitize,clip:makeClip}=await import('../dist/model.js?v=2.2.85');
const legacyMedia={id:'legacy-media',name:'camera.mov',kind:'video',duration:8,width:1080,height:1920,fps:60};
for(const mode of LEGACY_STABILIZATION_MODES){const p=project();p.media.push(legacyMedia);p.clips.push({...makeClip(legacyMedia),stabilization:mode});assert.equal(sanitize(JSON.parse(JSON.stringify(p))).clips[0].stabilization,mode,'saved legacy stabilization must not change on reload')}
const appSource=await readFile(new URL('../dist/app.js?v=2.2.85',import.meta.url),'utf8');
assert.match(appSource,/if\(state==='ready'\)\{if\(id===selected\)status\('手ぶれ補正の解析が完了しました。'\);draw\(\)\}/,'successful analysis replaces the last progress percentage');
