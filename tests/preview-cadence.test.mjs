import assert from 'node:assert/strict';
import {previewCadence} from '../dist/preview-cadence.js?v=2.2.85';
for(const hz of [60,90,120,144])for(const fps of [24,30,60]){
 let previous=0,count=0;for(let i=1;i<=hz*20;i++){const now=i*1000/hz+(i%3-1)*.03,next=previewCadence(previous,now,1000/fps);if(next!==null){previous=next;count++}}
 assert(Math.abs(count-20*Math.min(hz,fps))<=2,`${fps} fps on ${hz} Hz produced ${count} draws`);
}
assert.equal(previewCadence(100,101,1000/30),null);
console.log('Draw cadence: stable 24/30/60 fps on 60/90/120/144 Hz with clock jitter PASS');
const fs=await import('node:fs'),vm=await import('node:vm');
const app=fs.readFileSync(new URL('../dist/app.js?v=2.2.85',import.meta.url),'utf8'),draw=app.split('\n').find(l=>l.startsWith('function draw(){'));
let now=1000,attempts=0;const c={previewMemoryReleased:false,document:{body:{dataset:{ui:'desktop'}}},playing:true,drawnAt:0,performance:{now:()=>now},previewFrameInterval:()=>1000/30,previewCadence,paintPreview(){return ++attempts===1?false:true}};
vm.createContext(c);vm.runInContext(draw,c);c.draw();assert.equal(c.drawnAt,0,'Waiting for a decoder does not consume a presentation slot');now=1001;c.draw();assert.equal(attempts,2,'The ready frame can paint on the next display refresh');now=1002;c.draw();assert.equal(attempts,2);
console.log('Draw integration: pending handoff retains its cadence slot for the first ready frame PASS');
