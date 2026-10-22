import assert from 'node:assert/strict';
import {zoomFromPinch,anchoredScroll,bindTimelinePinch} from '../dist/timeline-zoom.js';

assert.equal(zoomFromPinch(2,100,150),3);
assert.equal(zoomFromPinch(9,100,200),10);
assert.equal(zoomFromPinch(1.5,100,20),.3);
assert.equal(zoomFromPinch(1,100,1),.01);
assert.equal(zoomFromPinch(.25,100,200),.5);
assert.equal(anchoredScroll(.5,2000,200,400),800);
assert.equal(anchoredScroll(0,2000,200,400),0);
assert.equal(anchoredScroll(1,2000,200,400),1600);

class FakeTimeline{
 constructor(){this.handlers={};this.scrollLeft=100;this.scrollWidth=1000;this.clientWidth=400}
 addEventListener(name,handler){(this.handlers[name]??=[]).push(handler)}
 getBoundingClientRect(){return{left:20}}
 setPointerCapture(){}
 emit(name,event){for(const handler of this.handlers[name]??[])handler({...event,preventDefault:event.preventDefault||(()=>{}),stopPropagation:event.stopPropagation||(()=>{})})}
}
const root=new FakeTimeline(),cancelled=[],captured=[];let zoom=2,renders=0,message='';
const target=id=>({onpointercancel:event=>cancelled.push(event.pointerId),releasePointerCapture:id=>captured.push(id)});
bindTimelinePinch({root,getZoom:()=>zoom,setZoom:value=>zoom=value,render:()=>{root.scrollWidth=1500;renders++},status:value=>message=value});
root.emit('pointerdown',{pointerType:'touch',pointerId:11,clientX:120,clientY:50,target:target(11)});
root.emit('pointerdown',{pointerType:'touch',pointerId:22,clientX:220,clientY:50,target:target(22)});
root.emit('pointermove',{pointerType:'touch',pointerId:22,clientX:270,clientY:50,target:target(22)});
assert.equal(zoom,3);
assert.equal(renders,1);
assert.deepEqual(cancelled,[11,22]);
assert.deepEqual(captured,[11,22]);
assert.match(message,/ピンチ/);
assert.equal(root.scrollLeft,200);
let wheelPrevented=false;root.emit('wheel',{ctrlKey:true,metaKey:false,deltaY:-10,clientX:120,preventDefault(){wheelPrevented=true}});assert.ok(zoom>3);assert.ok(renders>1);assert.equal(wheelPrevented,true);
const wheelZoom=zoom;root.emit('gesturestart',{clientX:220,scale:1});root.emit('gesturechange',{clientX:220,scale:.5});root.emit('gestureend',{clientX:220,scale:.5});assert.ok(zoom<wheelZoom);
console.log('Timeline pinch zoom: limits, pointer binding and focal-point scroll anchoring PASS');

// A wider time range at fixed viewport width keeps the gesture anchored in time.
const rangeRoot=new FakeTimeline();rangeRoot.scrollLeft=0;rangeRoot.scrollWidth=400;
let rangeZoom=1;
bindTimelinePinch({root:rangeRoot,getZoom:()=>rangeZoom,getExtent:()=>10/Math.min(1,rangeZoom),setZoom:v=>rangeZoom=v,render(){}});
rangeRoot.emit('wheel',{ctrlKey:true,deltaY:Math.log(2)*100,clientX:220});
assert.ok(Math.abs(rangeZoom-.5)<1e-12);
assert.equal(rangeRoot.scrollLeft,0);

const {readFileSync}=await import('node:fs');
const {runInNewContext}=await import('node:vm');
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const extentSource=app.match(/const timelineExtent=(\(\)=>[^;\n]+);/)[1];
for(const ui of ['phone','desktop'])for(const zoom of [1,.1,.01,10]){
 const extent=runInNewContext('('+extentSource+')',{Math,zoom,duration:()=>8,document:{body:{dataset:{ui}}}})();
 assert.equal(extent,(ui==='phone'?8.8:18)/Math.min(1,zoom));
}
assert.equal(runInNewContext('('+extentSource+')',{Math,zoom:.01,duration:()=>86400,document:{body:{dataset:{ui:'phone'}}}})(),86400);
assert.match(app,/clientWidth\)\*Math.max\(1,zoom\)/);
console.log('Zoom-out expands editable time while retaining full lane width and the 24-hour bound PASS');
