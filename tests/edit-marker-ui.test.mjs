import assert from 'node:assert/strict';
import {bindEditMarker} from '../dist/edit-marker-ui.js';
for(const pointerType of ['mouse','touch']){
 let time=2,selected=0,begun=0,finished=[],cancelled=0,edited=0;
 const el={setPointerCapture(){},releasePointerCapture(){}},event=x=>({button:0,pointerId:1,pointerType,clientX:x,preventDefault(){},stopPropagation(){}});
 bindEditMarker(el,{getTime:()=>time,getGeometry:()=>({width:1000,duration:10}),select:()=>selected++,begin:()=>begun++,move:v=>time=v,finish:v=>finished.push(v),cancel:()=>{cancelled++;time=2},edit:()=>edited++});
 el.onpointerdown(event(100));el.onpointerup(event(100));el.onclick(event(100));assert.equal(selected,1);assert.deepEqual(finished,[false]);assert.equal(begun,0);assert.equal(edited,0,'click only selects, never opens details');
 el.onpointerdown(event(100));el.onpointermove(event(102));assert.equal(begun,0);el.onpointermove(event(150));el.onpointermove(event(200));el.onpointerup(event(200));assert.equal(time,3);assert.equal(begun,1,'one history transaction per drag');assert.deepEqual(finished,[false,true]);assert.equal(el.onpointermove,null);
 el.onpointerdown(event(100));el.onpointermove(event(2000));assert.equal(time,10);el.onpointercancel(event(2000));assert.equal(time,2);assert.equal(cancelled,1,'cancel restores original transaction');
 el.onpointerdown(event(100));el.onpointermove(event(-1000));assert.equal(time,0);el.onlostpointercapture(event(100));assert.equal(cancelled,2);
 el.ondblclick(event(100));assert.equal(edited,1);el.oncontextmenu(event(100));assert.equal(edited,2);
}
console.log('Mouse/touch marker selection, drag transaction, boundary clamp, cancellation and details PASS');
