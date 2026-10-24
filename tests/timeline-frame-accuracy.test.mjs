import assert from 'node:assert/strict';
import {EDIT_RATES,normalizeTimelineRate,editingFrameTime,quantizeTimelineTime,stepTimelineFrame} from '../dist/timeline-time.js?v=2.2.85';
import {snapClipPosition,bindTimeline} from '../dist/timeline-gestures.js?v=2.2.85';
import {snapOverlayStart,bindOverlayTimeline} from '../dist/overlay-timeline.js?v=2.2.85';
import {project,clip,sequence,sanitize,timing,splitClip,sourceOffset,outputOffset,trimClip} from '../dist/model.js?v=2.2.85';
import {outputSettings} from '../dist/mobile-model.js?v=2.2.85';
export const frameTimingResults={rows:[],maxSeconds:0,maxFrameError:0,maximum:null};
function close(actual,expected,rate,operation){const error=Math.abs(actual-expected),r=normalizeTimelineRate(rate),frames=error*r.numerator/r.denominator;if(error>frameTimingResults.maxSeconds){frameTimingResults.maxSeconds=error;frameTimingResults.maximum={rate,operation,actual,expected}}frameTimingResults.maxFrameError=Math.max(frameTimingResults.maxFrameError,frames);assert(error<=5e-10,JSON.stringify({rate,operation,actual,expected,error}))}
const event=(x,edge,overlay=false)=>({button:0,pointerId:1,clientX:x,clientY:0,target:{closest:()=>edge?{dataset:{[overlay?'overlayEdge':'edge']:edge}}:null},preventDefault(){}});
function element(dataset){return{dataset,style:{},classList:{add(){},remove(){}},setPointerCapture(){},getBoundingClientRect:()=>({left:0,width:10000}),clientWidth:10000}}
const width=100000,extent=10;
for(const[rate,label]of EDIT_RATES){
 const frame=editingFrameTime(1,rate),raw=frame*.73;
 const exportProject=project(),media={id:'rate-video',duration:1,width:160,height:90,fps:25};exportProject.media=[media];exportProject.clips=[clip(media)];exportProject.timelineRate=normalizeTimelineRate('60');exportProject.export.fps=label;assert(Math.abs(outputSettings(exportProject).fps-1/frame)<1e-12,'independent rational output fps');
 for(const enabled of [false,true]){
  const wanted=enabled?frame:raw;
  close(snapClipPosition(raw,0,{enabled,rate}).start,wanted,rate,'clip snap');
  close(snapOverlayStart(raw,0,{duration:10,pixels:width,enabled,rate}).start,wanted,rate,'overlay snap');
  close(snapClipPosition(raw,0,{enabled,rate:null}).start,raw,rate,'audio subframe');
  const exact=raw+.00001;
  close(snapClipPosition(raw,0,{enabled,rate,targets:[exact],threshold:.001}).start,enabled?exact:raw,rate,'magnet exact subframe');
  close(snapOverlayStart(raw,0,{enabled,rate,targets:[exact],duration:10,pixels:width}).start,enabled?exact:raw,rate,'overlay magnet exact subframe');
  close(snapOverlayStart(raw,0,{duration:10,pixels:width,enabled,rate,bypass:true}).start,raw,rate,'shift bypass');
  for(const kind of ['video','audio'])for(const edge of [null,'in','out']){
   const m={id:'m',kind:'video',duration:10,fps:60,audio:true},p=project(),c={...clip(m),kind,start:1,in:2,out:5};p.media=[m];p.clips=[c];const row=sequence(p)[0],el=element({clip:c.id}),root={getBoundingClientRect:()=>({width}),querySelectorAll:()=>[el]};let begins=0,finishes=0;
   bindTimeline({root,rows:[row],duration:extent,rate,media:()=>m,snap:()=>enabled,select(){},begin(){begins++},finish(){finishes++},cancel(){},preview(){},getLayer:()=>0});
   const origin=edge==='out'?row.end:row.start,delta=frame*.73,target=enabled&&kind==='video'?quantizeTimelineTime(origin+delta,rate):origin+delta;
   el.onpointerdown(event(0,edge));el.onpointermove(event(delta*width/extent,edge));el.onpointerup(event(delta*width/extent,edge));
   close(edge==='out'?c.start+timing(c).duration:c.start,target,rate,kind+' drag '+edge);assert.equal(begins,1);assert.equal(finishes,1);
  }
  for(const kind of ['effect','text'])for(const edge of [null,'in','out']){
   const item=kind==='effect'?{id:'overlay',start:1,duration:2}:{id:'overlay',start:1,end:3},el=element({[kind==='effect'?'fx':'textChip']:item.id}),root={getBoundingClientRect:()=>({width}),querySelectorAll:()=>[el]};
   bindOverlayTimeline({root,effects:kind==='effect'?[item]:[],texts:kind==='text'?[item]:[],duration:extent,rate,targets:()=>[],snap:()=>enabled,select(){},begin(){},finish(){},cancel(){},preview(){}});
   const delta=frame*.73,origin=edge==='out'?3:1,wanted=enabled?quantizeTimelineTime(origin+delta,rate):origin+delta;
   el.onpointerdown(event(0,edge,true));el.onpointermove(event(delta*width/extent,edge,true));el.onpointerup(event(delta*width/extent,edge,true));
   close(edge==='out'?(kind==='effect'?item.start+item.duration:item.end):item.start,wanted,rate,kind+' drag '+edge);
  }
 }
 let moved=editingFrameTime(100,rate);for(let index=1;index<=1000;index++){moved=snapClipPosition(moved+frame,0,{enabled:true,rate}).start;close(moved,editingFrameTime(100+index,rate),rate,'1000 repeated grid moves')}
 const repeatMedia={id:'repeat',duration:100},repeatClip=clip(repeatMedia);for(let index=1;index<=100;index++){const end=editingFrameTime(200-index,rate);trimClip(repeatClip,'out',end,100);close(timing(repeatClip).duration,end,rate,'100 repeated trims')}
 let at=0;for(let i=1;i<=20000;i++){at=stepTimelineFrame(at,1,rate);close(at,editingFrameTime(i,rate),rate,'repeated step')}
 for(let i=19999;i>=0;i--){at=stepTimelineFrame(at,-1,rate);close(at,editingFrameTime(i,rate),rate,'reverse step')}
 close(stepTimelineFrame(frame*.4,1,rate),frame,rate,'offgrid next');close(stepTimelineFrame(frame*.4,-1,rate),0,rate,'offgrid previous');
 close(stepTimelineFrame(editingFrameTime(2000000,rate),1,rate),editingFrameTime(2000001,rate),rate,'long coordinate');
 for(const curve of ['constant','linear','ease-in','ease-out','ease-in-out']){
  const m={id:'v',kind:'video',duration:12,fps:25,audio:true},p=project(),c={...clip(m),in:1,out:9,start:frame*7,speed:.7,endSpeed:2,curve};p.media=[m];p.clips=[c];p.timelineRate=normalizeTimelineRate(rate);p.export.fps='50';
  const cut=editingFrameTime(50,rate),source=c.in+sourceOffset(cut,c),original=timing(c).duration,right=splitClip(c,source);assert(right);close(right.start,c.start+cut,rate,'speed split boundary');close(timing(c).duration+timing(right).duration,original,rate,'speed split length');close(outputOffset(source-c.in,{...c,out:9}),cut,rate,'inverse mapping');p.clips.push(right);
  const restored=sanitize(JSON.parse(JSON.stringify(p)));assert.deepEqual(restored.timelineRate,p.timelineRate);assert.deepEqual(restored.clips.map(c=>[c.start,c.in,c.out]),p.clips.map(c=>[c.start,c.in,c.out]));assert.equal(outputSettings(restored).fps,50);assert.equal(restored.media[0].fps,25);
  const times=p.clips.map(c=>[c.start,c.in,c.out]);p.timelineRate=normalizeTimelineRate('60/1');assert.deepEqual(p.clips.map(c=>[c.start,c.in,c.out]),times);
 }
 frameTimingResults.rows.push({rate,label,snapOnOff:true,videoAudioGestures:true,textFXGestures:true,speedSplit:true,saveLoad:true,independentExportFPS:true,steps:40000});
}
const old=project();delete old.timelineRate;old.export.fps='24';assert.deepEqual(sanitize(old).timelineRate,{numerator:30,denominator:1});
console.log('B4 timing accuracy '+JSON.stringify(frameTimingResults));
