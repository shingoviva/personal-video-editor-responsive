import assert from 'node:assert/strict';
import {timeAtTimelinePoint,canSplitTimelineRow,contextMenuPosition} from '../dist/timeline-context.js';

const row={start:4,end:10,duration:6,clip:{}},rect={left:100,width:600};
assert.equal(timeAtTimelinePoint(row,100,rect),4);
assert.equal(timeAtTimelinePoint(row,400,rect),7);
assert.equal(timeAtTimelinePoint(row,800,rect),10);
assert.equal(canSplitTimelineRow(row,7),true);
assert.equal(canSplitTimelineRow(row,4),false);
assert.equal(canSplitTimelineRow({...row,clip:{gap:6}},7),false);
assert.equal(canSplitTimelineRow({...row,clip:{freezeDuration:2}},7),false);
assert.deepEqual(contextMenuPosition(980,760,220,260,1000,800),{left:772,top:532});
assert.deepEqual(contextMenuPosition(-20,-30,220,260,1000,800),{left:8,top:8});
console.log('Timeline context menu: exact time, split eligibility and viewport positioning PASS');
