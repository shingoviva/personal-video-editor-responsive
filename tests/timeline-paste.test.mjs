import assert from 'node:assert/strict';
import {project,MAX_EFFECTS,MAX_TEXT_LAYERS} from '../dist/model.js';
import {pasteTimelineItems} from '../dist/timeline-paste.js';

let serial=0;const next=()=>`copy-${++serial}`,p=project();
p.effects=Array.from({length:MAX_EFFECTS},(_,i)=>({id:`fx-${i}`}));
p.texts=Array.from({length:MAX_TEXT_LAYERS-1},(_,i)=>({id:`text-${i}`}));
const source=[
 {kind:'effect',start:0,span:1,data:{id:'blocked',type:'flash',start:0,duration:1}},
 {kind:'text',start:2,span:3,data:{id:'caption',text:'字幕',start:2,end:5}},
];
const inserted=pasteTimelineItems(p,source,10,next);
assert.deepEqual(inserted.map(value=>value.kind),['text']);
assert.equal(p.effects.length,MAX_EFFECTS);
assert.equal(p.texts.length,MAX_TEXT_LAYERS);
assert.equal(p.texts.at(-1).start,12);
assert.equal(p.texts.at(-1).end,15);

const full=pasteTimelineItems(p,[source[1]],20,next);
assert.deepEqual(full,[]);
assert.equal(p.texts.length,MAX_TEXT_LAYERS);

const linkedProject=project();
const video={kind:'video',start:3,span:4,data:{id:'video',media:'m',start:3},linked:{id:'audio',media:'m',start:3,sourceClip:'video',linked:true}};
const [linked]=pasteTimelineItems(linkedProject,[video],8,next);
assert.equal(linked.item.start,8);
assert.equal(linkedProject.audioClips[0].sourceClip,linked.item.id);
assert.equal(linked.item.audioDetached,linkedProject.audioClips[0].id);

console.log('Timeline paste: capacity limits, valid selection results and linked audio duplication PASS');
