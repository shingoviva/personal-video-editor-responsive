import assert from 'node:assert/strict';
import {laneHeight} from '../dist/timeline-lane-size.js';
for(const standard of[40,44,48,52,64,76]){assert.deepEqual(laneHeight(standard+6,standard),{height:standard,snapped:true});assert.equal(laneHeight(standard+12,standard,true).snapped,true);assert.equal(laneHeight(standard+16,standard,true).snapped,false);assert.equal(laneHeight(standard+40,standard).height,standard+40);assert(laneHeight(-100,standard).height>=32&&laneHeight(-100,standard).height<=standard);assert.equal(laneHeight(9999,standard).height,320)}
console.log('Individual lane sizing range and default snap hysteresis across phone/desktop defaults PASS');
