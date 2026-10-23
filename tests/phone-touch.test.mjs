import assert from 'node:assert/strict';
import {bindPhoneTouch} from '../dist/phone-touch.js?v=2.2.84';
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

bindPhoneTouch({root,scroll,isPhone:()=>true,onMenu(){},onDrag(){},onHideMenu(){}});
let resizePrevented=0;const resizeTarget={closest:selector=>selector.includes('[data-lane-resize]')?{}:null};
events.pointerdown({...e(100,100),target:resizeTarget,preventDefault(){resizePrevented++}});
assert.equal(resizePrevented,0,'lane resizing must own its touch without swipe interception');
console.log('Lane resizing remains independent from phone timeline swipe PASS');

let markerIntercepted=0;const markerTarget={closest:selector=>selector.includes('[data-edit-marker]')?{}:null};
events.pointerdown({...e(100,100),target:markerTarget,preventDefault(){markerIntercepted++}});assert.equal(markerIntercepted,0,'marker drag owns touch outside the ruler');
console.log('Phone marker drag is independent from timeline swipe PASS');

// Losing capture or opening a sheet must never turn the next finger into a
// phantom second finger, leaving every clip stuck in scroll/pinch mode.
let resets=0,managed=false;
bindPhoneTouch({root,scroll,isPhone:()=>true,onMenu(){},onDrag(){classes.add('phone-moving')},onHideMenu(){resets++}});
clip.onpointerdown=event=>{managed=event.timelineTouchManaged===true};
selected=true;
assert.equal(typeof events.lostpointercapture,'function','lost capture must reset the touch owner');
for(let i=0;i<20;i++){
 const id=10+i*2;
 events.pointerdown({...e(100,100),pointerId:id,isPrimary:true});
 events.pointermove({...e(120,100),pointerId:id});
 assert(managed,'delegated clip must not steal capture from timeline owner');
 events.lostpointercapture({...e(120,100),pointerId:id,target:root});
 const oldLeft=scroll.scrollLeft;
 events.pointerdown({...e(100,100),pointerId:id+1,isPrimary:true});
 events.pointermove({...e(130,100),pointerId:id+1});
 assert.equal(scroll.scrollLeft,oldLeft,'next clip drag must recover after lost capture');
 events.pointerup({...e(130,100),pointerId:id+1});
 assert(!classes.has('phone-moving'),'temporary drag mode must be released');
}
assert.equal(typeof events['pve-phone-interaction-reset'],'function');
events.pointerdown(e(100,100));events['pve-phone-interaction-reset']({});
const beforeReset=scroll.scrollLeft;
events.pointerdown({...e(100,100),pointerId:99,isPrimary:true});events.pointermove({...e(130,100),pointerId:99});events.pointerup({...e(130,100),pointerId:99});
assert.equal(scroll.scrollLeft,beforeReset,'sheet transitions reset pending touch state');
console.log('Repeated caption sheet/lost-capture recovery and single touch capture owner PASS');

// A clip's own capture loss bubbles; it must not cancel the root's gesture.
let recoveryDrag=0;
bindPhoneTouch({root,scroll,isPhone:()=>true,onMenu(){},onDrag(){recoveryDrag++;classes.add('phone-moving')},onHideMenu(){}});
events.pointerdown({...e(100,100),pointerId:200,isPrimary:true});
events.lostpointercapture({...e(100,100),pointerId:200,target:clip});
events.pointermove({...e(130,100),pointerId:200});events.pointerup({...e(130,100),pointerId:200});assert.equal(recoveryDrag,1);
// A new primary pointer recovers even if Safari did not deliver the previous up.
events.pointerdown({...e(100,100),pointerId:201,isPrimary:true});
events.pointerdown({...e(100,100),pointerId:202,isPrimary:true});
events.pointermove({...e(130,100),pointerId:202});events.pointerup({...e(130,100),pointerId:202});assert.equal(recoveryDrag,2);
// Re-rendered captions no longer leave the detached clip as touch owner.
events.pointerdown({...e(100,100),pointerId:203,isPrimary:true});clip.isConnected=false;
events.pointermove({...e(130,100),pointerId:203});delete clip.isConnected;
events.pointerdown({...e(100,100),pointerId:204,isPrimary:true});events.pointermove({...e(130,100),pointerId:204});events.pointerup({...e(130,100),pointerId:204});assert.equal(recoveryDrag,3);
console.log('Bubbled capture loss, missing pointerup and detached caption DOM recover without phantom pinch PASS');

// Pinch rebuilds clip DOM on each zoom change; that is not a lost gesture.
let pinchValues=[];
bindPhoneTouch({root,scroll,isPhone:()=>true,onMenu(){},onDrag(){},onHideMenu(){},getZoom:()=>1,setZoom:value=>{pinchValues.push(value);clip.isConnected=false}});
events.pointerdown({...e(100,100),pointerId:301,isPrimary:true});events.pointerdown({...e(200,100),pointerId:302,isPrimary:false});
events.pointermove({...e(250,100),pointerId:302});events.pointermove({...e(300,100),pointerId:302});events.pointerup({...e(300,100),pointerId:302});delete clip.isConnected;
assert.deepEqual(pinchValues,[1.5,2],'pinch must continue across its own timeline re-render');
console.log('Pinch zoom survives replacement of clip DOM PASS');

// Double taps survive clip DOM replacement after the first selection/seek.
let doubleTaps=0;classes.delete('phone-moving');
bindPhoneTouch({root,scroll,isPhone:()=>true,onMenu(){},onDrag(){},onHideMenu(){},onDoubleTap:()=>{doubleTaps++;return true}});
events.pointerdown(e(150,110));events.pointerup(e(150,110));
const replacement={...clip,dataset:{clip:'c'}},replacementTarget={closest:s=>s.includes('data-clip')?replacement:null};
events.pointerdown({...e(150,110),target:replacementTarget});events.pointerup({...e(150,110),target:replacementTarget});assert.equal(doubleTaps,1);
events.pointerdown(e(150,110));events.pointermove(e(180,110));events.pointerup(e(180,110));
events.pointerdown(e(150,110));events.pointerup(e(150,110));assert.equal(doubleTaps,1,'a drag must not count as a tap');
console.log('Explicit envelope double taps survive selection redraw; swipes never add points PASS');
