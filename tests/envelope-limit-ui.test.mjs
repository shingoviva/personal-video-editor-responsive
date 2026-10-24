import assert from 'node:assert/strict';
import {bindClipEnvelope,dbToY,envelopeHandleX} from '../dist/clip-envelope-ui.js?v=2.2.85';
import {denseEnvelope} from './envelope-limit.test.mjs';
const old={};for(const key of ['document','MutationObserver','ResizeObserver','requestAnimationFrame'])old[key]=Object.getOwnPropertyDescriptor(globalThis,key);
try{
 const handlers=new Map(),ctx=new Proxy({measureText:()=>({width:30})},{get:(o,k)=>k in o?o[k]:()=>{}}),width=4000,height=80;
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width,height}),getContext:()=>ctx},element={isConnected:true,querySelector:()=>canvas,append(){},setPointerCapture(){},addEventListener:(k,f)=>handlers.set(k,f),removeEventListener:k=>handlers.delete(k)};
 globalThis.document={body:{},createElement:()=>({style:{}})};globalThis.MutationObserver=class{observe(){}};globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.requestAnimationFrame=f=>{f();return 1};
 let points=denseEnvelope(256,.004),span=.004,begins=0,commits=0,limits=0,sets=0,selection=null;
 bindClipEnvelope(element,{loadWaveform:false,getPoints:()=>points,setPoints:p=>{points=p;sets++},duration:()=>span,isActive:()=>true,selectedId:()=>selection,setSelected:id=>selection=id,onBegin:()=>begins++,onCommit:()=>commits++,onLimit:()=>limits++});
 const event=(x,y)=>({button:0,pointerId:1,pointerType:'mouse',clientX:x,clientY:y,target:{closest:()=>null},preventDefault(){},stopImmediatePropagation(){}});
 // Densely packed (<1ms) points must not cross their neighbors on drag.
 const chosen=points[128],at=chosen.time/span*width,y=dbToY(chosen.valueDb,height-6),beforeTimes=points.map(p=>p.time);
 handlers.get('pointerdown')(event(at,y));handlers.get('pointermove')(event(at+500,y));handlers.get('pointerup')(event(at+500,y));
 assert.equal(points.length,256);assert.equal(selection,chosen.id);assert(points[128].time>beforeTimes[128]);assert(points[128].time<beforeTimes[129]);
 for(let i=0;i<256;i++)if(i!==128)assert.equal(points[i].time,beforeTimes[i]);
 // Refusal cannot materialize endpoints or create Undo history as a side effect.
 span=8;points=Array.from({length:1024},(_,i)=>({id:'full-'+i,time:i/1024,valueDb:0}));begins=commits=sets=0;const snapshot=JSON.stringify(points);
 handlers.get('dblclick')(event(2000,dbToY(0,height-6)));assert.equal(limits,1);assert.equal(begins,0);assert.equal(commits,0);assert.equal(sets,0);assert.equal(JSON.stringify(points),snapshot);
 // Structural endpoints do not consume the last manual addition allowance.
 points=Array.from({length:1023},(_,i)=>({id:'last-'+i,time:(i+1)/1025,valueDb:0}));
 handlers.get('dblclick')(event(2000,dbToY(0,height-6)));assert.equal(points.length,1026);assert.equal(begins,1);assert.equal(commits,1);assert.equal(limits,1);
 begins=commits=sets=0;
 // Existing flat-curve level editing and structural endpoints may exceed the
 // manual point budget; no previously stored point can be dropped.
 points=Array.from({length:1025},(_,i)=>({id:'over-'+i,time:i/1025,valueDb:0}));const ids=points.map(p=>p.id);
 handlers.get('pointerdown')(event(2000,dbToY(0,height-6)));handlers.get('pointermove')(event(2000,dbToY(0,height-6)+15));handlers.get('pointerup')(event(2000,dbToY(0,height-6)+15));
 assert.equal(points.length,1026);assert(ids.every(id=>points.some(p=>p.id===id)));assert.equal(points.at(-1).time,8);assert.equal(commits,1);
 console.log('B3 actual gesture handlers: dense-point order, atomic refused add, over-budget level/boundary editing PASS');
}finally{for(const [key,value]of Object.entries(old)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key]}}
