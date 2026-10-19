import assert from 'node:assert/strict';
import {previewDiagnostics} from '../dist/preview-diagnostics.js';
let created=0,node;const doc={createElement(){created++;return node={}},body:{append(){}}};
assert.equal(previewDiagnostics(doc,false),null);assert.equal(created,0,'Normal playback has no trace or DOM work');
const trace=previewDiagnostics(doc,true,3);for(let i=0;i<5;i++)trace.record('clock',{time:i});assert.equal(node.textContent,undefined,'No per-frame DOM writes');trace.flush();const saved=JSON.parse(node.textContent);assert.equal(saved.events.length,3);assert.equal(saved.dropped,2);assert.deepEqual(saved.events.map(e=>e.time),[2,3,4]);
console.log('Opt-in preview diagnostics: no default allocation, bounded records and deferred DOM flush PASS');
