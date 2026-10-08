import assert from 'node:assert/strict';
import {frameAtTimestamp} from '../dist/frame-source.js';
const calls=[],sink={async getCanvas(timestamp){calls.push(timestamp);return{timestamp,canvas:{id:timestamp}}}},state={frame:null,source:-1};
const first=await frameAtTimestamp(sink,.1,state),second=await frameAtTimestamp(sink,.2,state),held=await frameAtTimestamp(sink,.2,state);
assert.notEqual(first.canvas.id,second.canvas.id);assert.equal(held,second);assert.deepEqual(calls,[.1,.2]);
console.log('Device export requests each changing source timestamp and caches only an identical hold: PASS');
