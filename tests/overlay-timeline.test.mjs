import assert from 'node:assert/strict';
import {bindOverlayTimeline,snapOverlayStart} from '../dist/overlay-timeline.js';

let result=snapOverlayStart(4.94,.5,{duration:10,pixels:1000,targets:[5]});
assert.equal(result.start,5);assert.equal(result.snapped,true);assert.equal(result.target,5);
result=snapOverlayStart(4.45,.5,{duration:10,pixels:1000,targets:[5]});
assert.equal(result.start,4.5);assert.equal(result.snapped,true);
result=snapOverlayStart(4.94,.5,{duration:10,pixels:1000,targets:[5],bypass:true});
assert.equal(result.snapped,false);assert.ok(Math.abs(result.start-4.933333333333334)<1e-8);
assert.equal(snapOverlayStart(9.8,1,{duration:10,pixels:1000}).start,9);

const effect={id:'fx',start:1,duration:.5},text={id:'text',start:2,end:3};
const makeElement=dataset=>({dataset,style:{},classList:{add(){},remove(){}},setPointerCapture(){}}),fxElement=makeElement({fx:'fx'}),textElement=makeElement({textChip:'text'});
const root={getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[fxElement,textElement]};
let begins=0,finishes=0,cancels=0,previews=[];
bindOverlayTimeline({root,effects:[effect],texts:[text],duration:10,targets:()=>[3.02,4],snap:()=>true,select(){},begin(){begins++},finish(){finishes++},cancel(){cancels++},preview:(item,kind,snap)=>previews.push({item,kind,snap})});
const event=(x,y=10)=>({button:0,pointerId:1,clientX:x,clientY:y});
fxElement.onpointerdown(event(100));fxElement.onpointermove(event(300));fxElement.onpointerup(event(300));
assert.equal(effect.start,3.02);assert.equal(previews.at(-1).snap.snapped,true);
textElement.onpointerdown(event(100));textElement.onpointermove(event(297));textElement.onpointerup(event(297));
assert.equal(text.start,4);assert.equal(text.end,5);
assert.equal(begins,2);assert.equal(finishes,2);assert.equal(cancels,0);

const trimEffect={id:'trim',start:1,duration:2},trimElement=makeElement({fx:'trim'}),trimRoot={getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[trimElement]};
bindOverlayTimeline({root:trimRoot,effects:[trimEffect],texts:[],duration:10,targets:()=>[],snap:()=>false,select(){},begin(){},finish(){},cancel(){},preview(){}});
const trimEvent=(x,edge)=>({...event(x),target:{closest:()=>edge?{dataset:{overlayEdge:edge}}:null}});
trimElement.onpointerdown(trimEvent(100,'out'));trimElement.onpointermove(trimEvent(200,'out'));trimElement.onpointerup(trimEvent(200,'out'));
assert.ok(Math.abs(trimEffect.duration-3)<1e-8);
trimElement.onpointerdown(trimEvent(100,'in'));trimElement.onpointermove(trimEvent(150,'in'));trimElement.onpointerup(trimEvent(150,'in'));
assert.ok(Math.abs(trimEffect.start-1.5)<1e-8);assert.ok(Math.abs(trimEffect.duration-2.5)<1e-8);

const groupEffect={id:'group-fx',start:1,duration:.5},groupText={id:'group-text',start:3,end:4},groupVideo={id:'group-video',start:5},groupFxElement=makeElement({fx:'group-fx'}),groupTextElement=makeElement({textChip:'group-text'}),groupVideoElement=makeElement({clip:'group-video'}),groupSurface={querySelectorAll:()=>[groupFxElement,groupTextElement,groupVideoElement]},groupRoot={getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[groupFxElement,groupTextElement],closest:()=>groupSurface};
bindOverlayTimeline({root:groupRoot,effects:[groupEffect],texts:[groupText],duration:10,targets:()=>[],snap:()=>false,select(){},begin(){},finish(){},cancel(){},preview(){},groupItems:()=>[{item:groupEffect,kind:'effect',start:1,span:.5},{item:groupText,kind:'text',start:3,span:1},{item:groupVideo,kind:'video',start:5,span:1}]});
groupFxElement.onpointerdown(event(0));groupFxElement.onpointermove(event(100));groupFxElement.onpointerup(event(100));
assert.equal(groupEffect.start,2);assert.equal(groupText.start,4);assert.equal(groupText.end,5);assert.equal(groupVideo.start,6);

const spacingEffect={id:'spacing',start:1,duration:1},spacingElement=makeElement({fx:'spacing'}),spacingRoot={getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[spacingElement]};let spacingResult;
bindOverlayTimeline({root:spacingRoot,effects:[spacingEffect],texts:[],duration:10,targets:()=>[],snap:()=>true,select(){},begin(){},finish:(item,kind,result)=>spacingResult=result,cancel(){},preview(){},spacingItems:()=>[{item:{id:'left'},start:0,span:1},{item:{id:'right'},start:4,span:1}]});
spacingElement.onpointerdown(event(0));spacingElement.onpointermove(event(104));spacingElement.onpointerup(event(104));
assert.equal(spacingEffect.start,2);assert.equal(spacingResult.spacing.spacing,true);

const layerEffect={id:'layer-fx',start:1,duration:1,layer:0},layerElement=makeElement({fx:'layer-fx'}),layerRoot={getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[layerElement]};let layerResult;
bindOverlayTimeline({root:layerRoot,effects:[layerEffect],texts:[],duration:10,targets:()=>[],snap:()=>false,select(){},begin(){},finish:(item,kind,result)=>layerResult=result,cancel(){},preview(){},getLayer:y=>y>50?{layer:2,offset:80}:{layer:0,offset:0}});
layerElement.onpointerdown(event(100,10));layerElement.onpointermove(event(100,90));assert.equal(layerEffect.layer,2);assert.equal(layerElement.style.transform,'translateY(80px)');layerElement.onpointerup(event(100,90));assert.equal(layerResult.layerChanged,true);assert.equal(layerElement.style.transform,'');

console.log('FX/Text timeline drag: placement, vertical layer move, group move, edge trim, duration preservation and magnetic placement PASS');

let overlayCaptures=0;layerElement.setPointerCapture=()=>overlayCaptures++;
layerElement.onpointerdown({...event(100,10),timelineTouchManaged:true});layerElement.onpointermove(event(120,10));layerElement.onpointerup(event(120,10));assert.equal(overlayCaptures,0,'managed FX/text move must not steal timeline capture');
layerElement.onpointerdown(event(100,10));layerElement.onpointercancel();assert.equal(overlayCaptures,1,'direct overlay gesture retains its capture');
console.log('Overlay pointer capture respects the phone timeline touch owner PASS');
const guarded={id:'guarded',start:1,duration:1},guardEl=makeElement({fx:'guarded'}),guardRoot={getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[guardEl]};let ended=0;
bindOverlayTimeline({root:guardRoot,effects:[guarded],duration:10,targets:()=>[],snap:()=>false,select(){},begin(){},finish(){ended++},cancel(){},preview(){}});
guardEl.onpointerdown(event(0));guardEl.onpointermove({...event(100),pointerId:2});assert.equal(guarded.start,1);
guardEl.onpointermove(event(100));guardEl.onpointerup({...event(100),pointerId:2});guardEl.onpointercancel({pointerId:2});assert.equal(ended,0);assert(guardEl.onpointermove);guardEl.onpointerup(event(100));assert.equal(ended,1);
console.log('FX direct drag ignores other pointers and completes only for its owner PASS');

const originalFx={id:'late-option',start:1,duration:1,layer:0},copyFxElement=makeElement({fx:'late-option'}),copyFxRoot={getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[copyFxElement]};let lateFxCopies=0,copiedFx;
bindOverlayTimeline({root:copyFxRoot,effects:[originalFx],duration:10,targets:()=>[],snap:()=>false,select(){},begin(){},finish(){},cancel(){},preview(){},duplicate:item=>{lateFxCopies++;return copiedFx={...item,id:'late-copy'}}});
copyFxElement.onpointerdown(event(0));copyFxElement.onpointermove(event(50));copyFxElement.onpointermove({...event(100),altKey:true});assert.equal(originalFx.start,1);assert.equal(copiedFx.start,2);copyFxElement.onpointermove({...event(120),altKey:true});assert.equal(lateFxCopies,1);copyFxElement.onpointerup(event(120));
console.log('FX/text late Option drag restores source and copies exactly once PASS');
