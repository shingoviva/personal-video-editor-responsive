import assert from 'node:assert/strict';
import {panelWidths,bindPanelSplitters} from '../dist/panel-splitter.js?v=2.2.85';

assert.deepEqual(panelWidths(260,0,1200),{media:260,inspector:690});
assert.equal(panelWidths(20,0,900).media,150);
assert.equal(panelWidths(890,0,900).inspector,230);
console.log('Workspace column splitters: desktop width constraints PASS');

const classes=()=>{const values=new Set();return{add:value=>values.add(value),remove:value=>values.delete(value),contains:value=>values.has(value)}};
const previousDocument=globalThis.document;
globalThis.document={body:{classList:classes()}};
try{
 const values=new Map(),writes=[],workspace={style:{setProperty:(key,value)=>values.set(key,value)},getBoundingClientRect:()=>({left:0,right:1200,width:1200})};
 const makeSplitter=()=>({classList:classes(),setPointerCapture(){},releasePointerCapture(){}});
 const left=makeSplitter(),right=makeSplitter(),storage={getItem:()=>null,setItem:(key,value)=>writes.push([key,value])};
 bindPanelSplitters({workspace,leftSplitter:left,rightSplitter:right,storage});
 for(const splitter of[left,right]){
  const property=splitter===left?'--media-width':'--inspector-width',initial=values.get(property),event=(pointerId,clientX)=>({button:0,pointerId,clientX,preventDefault(){}});
  splitter.onpointerdown(event(1,300));splitter.onpointermove(event(2,600));assert.equal(values.get(property),initial);
  splitter.onpointerup(event(2,600));assert.equal(splitter.classList.contains('dragging'),true);
  splitter.onpointermove(event(1,500));assert.notEqual(values.get(property),initial);
  splitter.onlostpointercapture(event(2,500));assert.equal(splitter.classList.contains('dragging'),true);
  splitter.onlostpointercapture(event(1,500));assert.equal(values.get(property),initial);assert.equal(globalThis.document.body.classList.contains('resizing-columns'),false);assert.equal(splitter.onpointermove,null);assert.equal(writes.length,0);
  splitter.onpointerdown(event(3,300));splitter.onpointermove(event(3,500));splitter.onpointercancel(event(3,500));assert.equal(values.get(property),initial);assert.equal(writes.length,0);
 }
 left.onpointerdown({button:0,pointerId:4,preventDefault(){}});left.onpointermove({pointerId:4,clientX:280});left.onpointerup({pointerId:4});assert.equal(values.get('--media-width'),'280px');assert.equal(writes.length,2);assert.equal(left.onlostpointercapture,null);
}finally{globalThis.document=previousDocument}
console.log('Column resize pointer ownership, interrupted rollback and subsequent save PASS');

const {bindWorkspaceSplitter}=await import('../dist/workspace-splitter.js?v=2.2.85');
const oldWindow=globalThis.window,oldDocument=globalThis.document;
globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.document={body:{classList:classes()}};
try{
 let height;const writes=[],workspace={clientHeight:800,style:{setProperty:(key,value)=>height=value},getBoundingClientRect:()=>({top:0,bottom:800})},splitter={classList:classes(),setPointerCapture(){},releasePointerCapture(){}};
 bindWorkspaceSplitter({workspace,splitter,storage:{getItem:()=>null,setItem:(key,value)=>writes.push(value)}});
 const initial=height,event=(pointerId,clientY=300)=>({button:0,pointerId,clientY,preventDefault(){}});
 splitter.onpointerdown(event(1));splitter.onpointermove(event(2));assert.equal(height,initial);splitter.onpointerup(event(2));assert.equal(splitter.classList.contains('dragging'),true);
 splitter.onpointermove(event(1));assert.notEqual(height,initial);splitter.onlostpointercapture(event(1));assert.equal(height,initial);assert.equal(writes.length,0);assert.equal(globalThis.document.body.classList.contains('resizing-workspace'),false);assert.equal(splitter.onpointermove,null);
 splitter.onpointerdown(event(3));splitter.onpointermove(event(3));splitter.onpointercancel(event(3));assert.equal(height,initial);assert.equal(writes.length,0);
 splitter.onpointerdown(event(4));splitter.onpointermove(event(4));splitter.onpointerup(event(4));assert.equal(height,'500px');assert.equal(writes.length,1);assert.equal(splitter.onlostpointercapture,null);
}finally{globalThis.window=oldWindow;globalThis.document=oldDocument}
console.log('Preview/timeline split resize cancellation, pointer ownership and subsequent save PASS');
