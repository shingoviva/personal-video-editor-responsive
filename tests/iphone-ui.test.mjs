import assert from 'node:assert/strict';
import {phoneLayout,phonePanelTrigger} from '../dist/iphone-ui.js';
import {bindTimeline} from '../dist/timeline-gestures.js';
import {project,clip,sequence} from '../dist/model.js';
assert.equal(phoneLayout({width:393,height:852,coarse:true,iphone:true}),true);
assert.equal(phoneLayout({width:852,height:393,coarse:true,iphone:true}),true);
assert.equal(phoneLayout({width:1440,height:900,coarse:false,iphone:false}),false);
assert.equal(phoneLayout({width:1024,height:768,coarse:true,iphone:false}),false);
assert.equal(phoneLayout({width:500,height:850,coarse:false,iphone:false}),true);
const m={id:'media',duration:10},p=project();p.media=[m];p.clips=[{...clip(m),start:0}];
let changes=0;const element={dataset:{clip:p.clips[0].id},style:{},classList:{add(){},remove(){}},setPointerCapture(){},clientWidth:1000,getBoundingClientRect:()=>({left:0,width:1000})};
const root={getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[element]};
let moving=false;globalThis.document={body:{dataset:{ui:'phone'},classList:{contains:()=>moving}}};
const bind=()=>bindTimeline({root,rows:sequence(p),duration:10,select(){},begin(){changes++},finish(){},cancel(){},preview(){},media:()=>m,snap:()=>false,getLayer:()=>0});
const event=x=>({button:0,pointerType:'touch',pointerId:1,clientX:x,clientY:0,target:{closest:()=>null}});
bind();element.onpointerdown(event(0));element.onpointermove(event(100));element.onpointercancel();assert.equal(changes,0);assert.equal(p.clips[0].start,0);
moving=true;bind();element.onpointerdown(event(0));element.onpointermove(event(100));element.onpointerup(event(100));assert.equal(changes,1);assert.equal(p.clips[0].start,1);
moving=false;element.classList.contains=()=>true;bind();const trimEvent=x=>({...event(x),target:{closest:()=>({dataset:{edge:'out'}})}});element.onpointerdown(trimEvent(1000));element.onpointermove(trimEvent(900));element.onpointerup(trimEvent(900));assert.equal(p.clips[0].out,9,'selected clip handles trim without move mode');
delete globalThis.document;
console.log('Phone portrait/landscape routing, desktop/tablet preservation and scroll vs move PASS');

// Sheet body has data-phone-panel for styling; clicks on inputs/empty space must not reopen it.
function node(tag,dataset={},parent=null){return{tag,dataset,parent,closest(selector){for(let n=this;n;n=n.parent)if((!selector.includes('button[')||n.tag==='button')&&(n.dataset.phonePanel||n.dataset.phoneCommand))return n;return null}}}
const sheetBody=node('body',{phonePanel:'motion'}),slider=node('input',{},sheetBody),closeButton=node('button',{},sheetBody),tabButton=node('button',{phonePanel:'fx'},sheetBody),icon=node('span',{},tabButton);
assert.equal(slider.closest('[data-phone-panel],[data-phone-command]'),sheetBody,'the previous selector incorrectly matched the sheet body');
assert.equal(phonePanelTrigger(slider),null);assert.equal(phonePanelTrigger(closeButton),null);assert.equal(phonePanelTrigger(sheetBody),null);assert.equal(phonePanelTrigger(icon),tabButton);
console.log('Phone sheet inputs and return button never resolve the body as a panel trigger PASS');
