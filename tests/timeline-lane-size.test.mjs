import assert from 'node:assert/strict';
import {laneHeight} from '../dist/timeline-lane-size.js?v=2.2.85';
for(const standard of[40,44,48,52,64,76]){assert.deepEqual(laneHeight(standard+6,standard),{height:standard,snapped:true});assert.equal(laneHeight(standard+12,standard,true).snapped,true);assert.equal(laneHeight(standard+16,standard,true).snapped,false);assert.equal(laneHeight(standard+40,standard).height,standard+40);assert(laneHeight(-100,standard).height>=32&&laneHeight(-100,standard).height<=standard);assert.equal(laneHeight(9999,standard).height,320)}
console.log('Individual lane sizing range and default snap hysteresis across phone/desktop defaults PASS');
// Real handle bindings: another finger cannot resize/end; lost capture restores both sides.
const {createTimelineLaneSizing}=await import('../dist/timeline-lane-size.js?v=2.2.85');
let stored=null;
globalThis.localStorage={getItem:()=>stored,setItem:(k,v)=>stored=v};
const makeNode=id=>{const values={},children=[];return{id,style:{setProperty:(k,v)=>values[k]=v,removeProperty:k=>delete values[k]},querySelector:()=>children[0]||null,querySelectorAll:()=>children,append:n=>children.push(n),getBoundingClientRect:()=>({height:parseFloat(values['--timeline-video-lane'])||52})}};
const track=makeNode('videoTrack'),head=makeNode('head');
globalThis.document={body:{dataset:{ui:'desktop'}},getElementById:id=>id==='videoTrack'?track:null,querySelector:s=>s==='[data-videohead="0"]'?head:null,createElement:()=>({dataset:{},setAttribute(){},classList:{add(){},remove(){},toggle(){}},setPointerCapture(){},releasePointerCapture(){}})};
globalThis.getComputedStyle=()=>({getPropertyValue:()=>52});
createTimelineLaneSizing().apply();const handle=track.querySelector(),ev=(y,id=1)=>({button:0,pointerId:id,clientY:y,preventDefault(){},stopPropagation(){}});
handle.onpointerdown(ev(0));handle.onpointermove(ev(60,2));assert.equal(track.getBoundingClientRect().height,52);
handle.onpointermove(ev(60));assert.equal(track.getBoundingClientRect().height,112);assert.equal(head.getBoundingClientRect().height,112);
handle.onpointerup(ev(60,2));assert(handle.onpointermove);assert.equal(stored,null);
handle.onlostpointercapture(ev(60));assert.equal(track.getBoundingClientRect().height,52);assert.equal(head.getBoundingClientRect().height,52);assert.equal(handle.onpointermove,null);assert.equal(stored,null);
handle.onpointerdown(ev(0));handle.onpointermove(ev(80));handle.onpointerup(ev(80));assert.equal(JSON.parse(stored)['desktop:videoTrack'],132);assert.equal(handle.onlostpointercapture,null);
delete globalThis.document;delete globalThis.localStorage;delete globalThis.getComputedStyle;
console.log('Lane resize pointer ownership, capture cancellation, matching header and recovery PASS');
