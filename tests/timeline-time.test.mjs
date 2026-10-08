import assert from 'node:assert/strict';
import {timelineXAtTime,timelineTimeAtX,locatePreviewRow} from '../dist/timeline-time.js';

const duration=9,extent=duration+10,width=1360,clipStart=3,clipEnd=9;
assert.equal(timelineXAtTime(clipStart,extent,width),width*clipStart/extent);
assert.equal(timelineTimeAtX(width*clipStart/extent,width,extent),clipStart);
assert.equal(timelineTimeAtX(width*clipEnd/extent,width,extent),clipEnd);
assert.equal(timelineTimeAtX(width*6.17/extent,width,extent),6.17);
for(const time of [0,1,3,4,6.17,9,12,extent]){
  assert.ok(Math.abs(timelineTimeAtX(timelineXAtTime(time,extent,width),width,extent)-time)<1e-9);
}
assert.equal(timelineTimeAtX(-100,width,extent),0);
assert.equal(timelineTimeAtX(width+100,width,extent),extent);
const video={clip:{id:'video'},layer:2,start:3,end:9};
assert.ok(locatePreviewRow([video],2,9).clip.gap,'before the clip is black');
assert.equal(locatePreviewRow([video],4,9),video,'inside the clip shows the video');
assert.ok(locatePreviewRow([video],9,9).clip.gap,'the exact end is black');
assert.ok(locatePreviewRow([video],10,12).clip.gap,'the editable tail stays black even when overlays extend the project');
console.log('Timeline ruler, clip and playhead use the same editable extent: PASS');
