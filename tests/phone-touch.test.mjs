import assert from 'node:assert/strict';
import {bindPhoneTouch} from '../dist/phone-touch.js';
const events={},classes=new Set();let hold,menu=0,drag=0,down=0,up=0,cancel=0,dx=0,zoom=1;
globalThis.document={body:{classList:{contains:n=>classes.has(n),remove:(...n)=>n.forEach(x=>classes.delete(x))}}};
globalThis.setTimeout=fn=>(hold=fn,1);globalThis.clearTimeout=()=>{};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
const root={addEventListener:(name,fn)=>events[name]=fn,setPointerCapture(){},releasePointerCapture(){}};
const scroll={scrollLeft:100,scrollTop:40,getBoundingClientRect:()=>({left:0,right:300,top:0,bottom:200})};
let selected=false;
const clip={classList:{contains:()=>selected},dataset:{clip:'c'},onpointerdown:()=>down++,onpointermove:e=>dx=e.clientX,onpointerup:()=>up++,onpointercancel:()=>cancel++};
const target={closest:s=>s.includes('data-clip')?clip:null};
const e=(x,y)=>({pointerType:'touch',pointerId:1,clientX:x,clientY:y,target,preventDefault(){},stopImmediatePropagation(){}});
bindPhoneTouch({root,scroll,isPhone:()=>true,onMenu:()=>menu++,onDrag:()=>drag++,onHideMenu(){},getZoom:()=>zoom,setZoom:value=>zoom=value});
events.pointerdown(e(100,100));events.pointermove(e(80,80));assert.equal(scroll.scrollLeft,120);assert.equal(scroll.scrollTop,60);events.pointerup(e(80,80));assert.equal(down,0,'swipe must not move clips');
events.pointerdown(e(100,100));hold();assert.equal(menu,1);events.pointermove(e(120,100));assert.equal(drag,1);assert.equal(down,1);assert.equal(dx,120);events.pointerup(e(120,100));assert.equal(up,1);
events.pointerdown(e(100,100));hold();events.pointermove(e(120,100));events.pointercancel(e(120,100));assert.equal(cancel,1);
events.pointerdown(e(100,100));events.pointerup(e(100,100));assert.equal(up,2,'tap selects/seeks through existing handler');
classes.add('phone-moving');events.pointerdown(e(100,100));events.pointermove(e(130,100));assert.equal(drag,3,'menu drag mode requires no second hold');events.pointerup(e(130,100));
console.log('Phone swipe scroll, long press actions, held drag, cancellation, taps and armed drag PASS');

events.pointerdown(e(100,100));events.pointerdown({...e(200,100),pointerId:2});events.pointermove({...e(250,100),pointerId:2});assert.equal(zoom,1.5);events.pointerup({...e(250,100),pointerId:2});
console.log('Two-finger timeline pinch remains available alongside swipe and held drag PASS');

classes.delete('phone-moving');selected=true;
const before=drag;events.pointerdown(e(100,100));events.pointermove(e(130,102));assert.equal(drag,before+1,'selected horizontal drag starts without hold');events.pointerup(e(130,102));
const top=scroll.scrollTop;events.pointerdown(e(100,100));events.pointermove(e(102,80));assert.equal(scroll.scrollTop,top+20,'selected vertical swipe scrolls');events.pointerup(e(102,80));
let delegated=0;
bindPhoneTouch({root,scroll,isPhone:()=>true,delegatePointer:()=>{delegated++;return true},onMenu(){},onDrag(){},onHideMenu(){},getZoom:()=>zoom,setZoom(){}});
const left=scroll.scrollLeft;events.pointerdown(e(100,100));events.pointermove(e(140,100));events.pointerup(e(140,100));assert.equal(delegated,1);assert.equal(scroll.scrollLeft,left,'envelope owns its pointer without timeline scrolling');
console.log('Immediate selected horizontal move, vertical scroll and envelope pointer ownership PASS');
