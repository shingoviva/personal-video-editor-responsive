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
