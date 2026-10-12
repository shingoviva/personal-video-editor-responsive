import assert from 'node:assert/strict';
import {envelopeXAtTime,envelopeTimeAtX,bindClipEnvelope,dbToY,clipEnvelopeOwnsPointer,clipEnvelopeDoubleTap} from '../dist/clip-envelope-ui.js';
for(const width of [8,80,400,1200])for(const duration of [.16,3,8])for(const fraction of [0,.125,.5,.875,1]){
 const time=duration*fraction,x=envelopeXAtTime(time,duration,width);
 assert(Math.abs(x-width*fraction)<1e-9);
 assert(Math.abs(envelopeTimeAtX(x,duration,width)-time)<1e-9);
}
// A point selected off-center must retain its timestamp during vertical dragging.
const handlers=new Map(),ctx=new Proxy({measureText:()=>({width:30})},{get:(o,k)=>k in o?o[k]:()=>{}});
const canvas={width:400,height:24,getBoundingClientRect:()=>({left:100,top:50,width:400,height:24}),getContext:()=>ctx};
const element={isConnected:true,querySelector:()=>canvas,append(){},setPointerCapture(){},addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)};
globalThis.document={body:{},createElement:()=>({style:{}})};
globalThis.MutationObserver=class{observe(){}};globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.requestAnimationFrame=fn=>{fn();return 1};
let points=[{id:'p',time:1,valueDb:0}],selected=null,commits=0;
bindClipEnvelope(element,{getPoints:()=>points,setPoints:p=>points=p,duration:()=>8,isActive:()=>true,selectedId:()=>selected,setSelected:id=>selected=id,onCommit:()=>commits++});
const event=(x,y)=>({button:0,pointerId:1,pointerType:'mouse',clientX:100+x,clientY:50+y,target:{closest:()=>null},preventDefault(){},stopImmediatePropagation(){}});
const y=dbToY(0,24);handlers.get('pointerdown')(event(55,y));assert.equal(selected,'p');handlers.get('pointermove')(event(55,y+10));assert.equal(points[0].time,1);assert(points[0].valueDb<0);handlers.get('pointerup')(event(55,y+10));assert.equal(commits,1);
// Horizontal movement remains accurate despite the 5px initial grab offset.
const changedY=dbToY(points[0].valueDb,24);handlers.get('pointerdown')(event(55,changedY));handlers.get('pointermove')(event(155,changedY));assert.equal(points[0].time,3);handlers.get('pointerup')(event(155,changedY));
// Empty gain-line presses belong to clip moves, never add points.
points=[];selected=null;commits=0;
const empty=event(200,y);assert.equal(clipEnvelopeOwnsPointer(element,empty),false);
handlers.get('pointerdown')(empty);assert.equal(points.length,0);assert.equal(commits,0);
handlers.get('dblclick')(empty);assert.equal(points.length,1);assert.equal(points[0].time,4);assert.equal(commits,1);
// The same explicit action supports phone double taps; armed layer moves win over points.
points=[];assert.equal(clipEnvelopeDoubleTap(element,{...empty,pointerType:'touch'}),true);assert.equal(points.length,1);
assert.equal(clipEnvelopeOwnsPointer(element,empty),true);
globalThis.document.body.classList={contains:()=>true};assert.equal(clipEnvelopeOwnsPointer(element,empty),false);
handlers.get('pointerdown')(empty);assert.equal(points.length,1);
delete globalThis.document.body.classList;
// Lost capture ends point dragging, so future timeline gestures cannot be swallowed.
handlers.get('pointerdown')(empty);handlers.get('pointermove')(event(200,y+9));handlers.get('lostpointercapture')(event(200,y+9));assert.equal(handlers.has('pointermove'),false);
await Promise.resolve();delete globalThis.document;delete globalThis.MutationObserver;delete globalThis.ResizeObserver;delete globalThis.requestAnimationFrame;
console.log('Envelope points follow the full timeline width and retain timestamp under off-center vertical drag PASS');
