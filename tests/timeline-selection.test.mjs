import assert from 'node:assert/strict';
import {normalizedRect,rectsIntersect,idsInRect,bindTimelineMarquee} from '../dist/timeline-selection.js';

assert.deepEqual(normalizedRect({x:80,y:70},{x:20,y:10}),{left:20,top:10,right:80,bottom:70,width:60,height:60});
assert.equal(rectsIntersect({left:0,top:0,right:20,bottom:20},{left:20,top:20,right:30,bottom:30}),true);
const item=(id,left,top,right,bottom)=>({dataset:{clip:id},getBoundingClientRect:()=>({left,top,right,bottom,width:right-left,height:bottom-top})});
assert.deepEqual(idsInRect([item('video',10,40,80,80),item('audio',12,100,90,125),item('outside',200,200,240,230)],{left:0,top:30,right:100,bottom:130}),['video','audio']);

let down,move,up,previewed=[],finished=[];const guide={hidden:true,style:{}},surface={closest:selector=>selector.includes('.video-track')?surface:null},video=item('video',10,40,80,80),audio={...item('audio',12,100,90,125),dataset:{clip:'audio'}};
const root={addEventListener:(type,fn)=>{if(type==='pointerdown')down=fn},removeEventListener(){},setPointerCapture(){},querySelectorAll:()=>[video,audio],getBoundingClientRect:()=>({left:0,top:0,right:500,bottom:300,width:500,height:300})};
bindTimelineMarquee({root,guide,getSelected:()=>new Set(),preview:ids=>previewed=ids,finish:ids=>finished=ids,cancel(){},click(){}});
const event=(x,y)=>({pointerType:'mouse',button:0,pointerId:1,clientX:x,clientY:y,target:surface,preventDefault(){},stopPropagation(){}});
down(event(0,30));move=root.onpointermove;up=root.onpointerup;move(event(100,130));assert.equal(guide.hidden,false);assert.deepEqual(previewed,['video','audio']);up(event(100,130));assert.equal(guide.hidden,true);assert.deepEqual(finished,['video','audio']);

console.log('Timeline marquee: rectangle geometry, cross-layer hit testing and visual lifecycle PASS');
