import assert from 'node:assert/strict';
import {bindTimeline,equalSpacingStart} from '../dist/timeline-gestures.js';
import {project,clip,sequence,anchor,timing} from '../dist/model.js';
const m={id:'m',duration:10},p=project();p.media=[m];p.clips=[{...clip(m),in:2,out:6,start:1,layer:0}];
let checkpoints=0,finishes=0,cancels=0,duplicates=0,ghostVisible=0;
const ghost={classList:{add(){}},removeAttribute(){},remove(){ghostVisible--}},element={dataset:{clip:p.clips[0].id},style:{},classList:{add(){}},setPointerCapture(){},cloneNode(){return ghost},parentNode:{insertBefore(){ghostVisible++}},getBoundingClientRect(){return{left:100,width:400}},clientWidth:400};
const root={getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[element]};
function bind(){bindTimeline({root,rows:sequence(p),duration:10,select(){},begin(){checkpoints++;anchor(p)},finish(){finishes++},cancel(){cancels++},preview(){},media:()=>m,snap:()=>false,getLayer:y=>y>100?1:0,duplicate:row=>{const copy={...structuredClone(row.clip),id:'dup-'+(++duplicates)};p.clips.push(copy);return{...row,clip:copy}}})}
const event=(x,y=0,edge,altKey=false)=>({button:0,pointerId:1,clientX:x,clientY:y,altKey,target:{closest:()=>edge?{dataset:{edge}}:null}});
bind();element.onpointerdown(event(0,0,'out'));element.onpointermove(event(-100));element.onpointermove(event(-150));element.onpointerup(event(-150));
assert.equal(checkpoints,1);assert.equal(finishes,1);assert.equal(p.clips[0].out,4.5);
assert.equal(element.onpointermove,null);
bind();element.onpointerdown(event(0,0,'in'));element.onpointermove(event(50));element.onpointerup(event(50));
assert.equal(p.clips[0].in,2.5);assert.equal(p.clips[0].start,1.5);assert.equal(p.clips[0].start+timing(p.clips[0]).duration,3.5);
const snapClip={...clip(m),in:0,out:4,start:0,layer:0},snapRow={clip:snapClip,start:0,end:4,duration:4,layer:0},snapElement={...element,dataset:{clip:snapClip.id},style:{}},snapRoot={getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[snapElement]};
bindTimeline({root:snapRoot,rows:[snapRow],duration:10,select(){},begin(){},finish(){},cancel(){},preview(){},media:()=>m,snap:()=>true,snapTargets:()=>[5.02],getLayer:()=>0});snapElement.onpointerdown(event(0,0,'out'));snapElement.onpointermove(event(100,0,'out'));snapElement.onpointerup(event(100,0,'out'));assert.equal(snapClip.out,5.02);
bind();element.onpointerdown(event(0));element.onpointermove(event(100,120));element.onpointerup(event(100,120));
assert.equal(p.clips[0].layer,1);assert.equal(p.clips[0].start,2.5);
bind();element.onpointerdown(event(0));element.onpointermove(event(20));element.onpointercancel();
assert.equal(cancels,1);assert.equal(element.onpointermove,null);
const before=p.clips.length;bind();element.onpointerdown(event(0,0,null,true));element.onpointermove(event(30,0,null,true));assert.equal(ghostVisible,1);element.onpointerup(event(30));assert.equal(ghostVisible,0);assert.equal(p.clips.length,before+1);assert.equal(duplicates,1);
console.log('Pointer unit checks: both trim handles, one checkpoint/drag, layer move, cancellation cleanup: PASS');

const spacingRows=[{clip:{id:'a'},layer:0,start:0,end:1},{clip:{id:'b'},layer:0,start:2,end:3},{clip:{id:'c'},layer:0,start:4,end:5}];
const spaced=equalSpacingStart(2.04,1,spacingRows[1],spacingRows,.01);assert.equal(spaced.start,2);assert.equal(spaced.spacing,true);

const groupClips=[{id:'group-a',in:0,out:1,start:1,layer:0,speed:1,endSpeed:1,curve:'constant'},{id:'group-b',in:0,out:1,start:4,layer:0,speed:1,endSpeed:1,curve:'constant'}];
const groupRows=groupClips.map(c=>({clip:c,start:c.start,end:c.start+1,duration:1,layer:0})),groupElements=groupClips.map(c=>({...element,dataset:{clip:c.id},style:{}})),other={id:'group-fx',start:6,duration:.5},otherElement={dataset:{fx:other.id},style:{}},groupRoot={getBoundingClientRect:()=>({width:1000}),querySelectorAll:selector=>selector==='[data-clip]'?groupElements:[...groupElements,otherElement]};
bindTimeline({root:groupRoot,rows:groupRows,duration:10,select(){},begin(){},finish(){},cancel(){},preview(){},media:()=>m,snap:()=>false,getLayer:()=>0,groupRows:()=>groupRows,groupOthers:()=>[{item:other,kind:'effect',start:6,span:.5}],timelineRoot:groupRoot});
groupElements[0].onpointerdown(event(0));groupElements[0].onpointermove(event(100));groupElements[0].onpointerup(event(100));
assert.equal(groupClips[0].start,2);assert.equal(groupClips[1].start,5);assert.equal(other.start,7);
console.log('Shift-selected clip group preserves spacing while moving: PASS');
