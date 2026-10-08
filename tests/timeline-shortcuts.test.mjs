import assert from 'node:assert/strict';
import {clip,project,sequence} from '../dist/model.js';
import {timelineEditPoints,adjacentEditPoint,selectionFrameDuration,nudgeTimelineSelection,rippleTrimToPlayhead} from '../dist/timeline-shortcuts.js';

const p=project(),media={id:'video',kind:'video',duration:12,fps:60};p.media=[media];
const first={...clip(media),id:'first',start:0,out:4},second={...clip(media),id:'second',start:4,in:4,out:8};p.clips=[first,second];
p.effects=[{id:'fx',type:'flash',start:1,duration:.5}];p.texts=[{id:'text',text:'TITLE',start:2,end:3}];
const points=timelineEditPoints(p);assert.deepEqual(points,[0,1,1.5,2,3,4,8]);assert.equal(adjacentEditPoint(points,2.5,-1),2);assert.equal(adjacentEditPoint(points,2.5,1),3);assert.equal(selectionFrameDuration(p,['first']),1/60);
assert.equal(nudgeTimelineSelection(p,['first','fx','text'],1/60),1/60);assert.equal(first.start,1/60);assert.equal(p.effects[0].start,1+1/60);assert.equal(p.texts[0].end,3+1/60);
first.start=0;p.effects[0].start=1;p.texts[0].start=2;p.texts[0].end=3;
const result=rippleTrimToPlayhead(p,'first','out',3);assert.ok(result);assert.equal(result.removed,1);assert.equal(first.out,3);assert.equal(second.start,3);assert.equal(sequence(p).find(row=>row.clip===second).start,3);
const linked={...clip(media),id:'linked',kind:'audio',start:0,in:0,out:3,sourceClip:'first',linked:true};p.audioClips=[linked];const linkedResult=rippleTrimToPlayhead(p,'linked','in',1);assert.equal(linkedResult.clip,first);assert.equal(linked.in,first.in);assert.equal(linked.out,first.out);
console.log('Timeline shortcuts: edit navigation, frame nudge and ripple trim PASS');
