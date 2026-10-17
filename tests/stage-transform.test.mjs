import assert from 'node:assert/strict';
import {centeredTransform,scaleFromWheel,scaleFromDrag,bindStageTransform} from '../dist/stage-transform.js';
assert.deepEqual(centeredTransform({x:.45,y:.55},-5,5,100,100),{x:.5,y:.5,snapX:true,snapY:true});
assert.deepEqual(centeredTransform({x:.5,y:.5},20,-10,100,100,8,1),{x:.7,y:.4,snapX:false,snapY:false});
assert.equal(scaleFromWheel(1,-100)>1,true);
assert.equal(scaleFromWheel(3,-100),3);
assert.equal(scaleFromWheel(.1,100),.1);
assert.equal(scaleFromWheel(1,100)<1,true);
assert.ok(scaleFromDrag(1,40,-20)>1);
assert.equal(scaleFromDrag(3,40,-20),3);
assert.equal(scaleFromDrag(.1,-40,20),.1);
console.log('Stage transform: position, center snapping and 0.1–3× scale limits PASS');

const handlers=new Map(),target={x:.5,y:.5,scale:1};let begins=0,finishes=0,lastGuide;
const root={addEventListener:(name,callback)=>handlers.set(name,callback),setPointerCapture(){},getBoundingClientRect:()=>({width:100,height:100})};
bindStageTransform({root,getClip:()=>target,enabled:()=>true,begin:()=>begins++,change:next=>Object.assign(target,next),finish:()=>finishes++,guides:next=>lastGuide=next,direction:()=>1});
const event=(pointerId,x=0)=>({pointerId,button:0,pointerType:'mouse',clientX:x,clientY:0,target:{closest:()=>null},preventDefault(){}});
handlers.get('pointerdown')(event(1));handlers.get('pointermove')(event(1,20));assert.equal(target.x,.7);
handlers.get('pointerdown')(event(2));handlers.get('pointermove')(event(2,40));assert.equal(target.x,.7);handlers.get('lostpointercapture')(event(2));assert.equal(finishes,0);
handlers.get('lostpointercapture')(event(1));assert.equal(finishes,1);assert.equal(lastGuide,null);handlers.get('pointermove')(event(1,40));assert.equal(target.x,.7);
handlers.get('pointerup')(event(1));assert.equal(finishes,1);
handlers.get('pointerdown')(event(3));handlers.get('pointermove')(event(3,-20));handlers.get('pointerup')(event(3));assert.ok(Math.abs(target.x-.5)<1e-9);assert.equal(begins,2);assert.equal(finishes,2);
console.log('Stage transform ignores concurrent presses and recovers after capture loss PASS');

const {snapScaleToFrame}=await import('../dist/stage-transform.js');
const centered={x:.5,y:.5},frame={width:400,height:300};
assert.deepEqual(snapScaleToFrame(.98,centered,frame,{width:800,height:600}),{scale:1,snapEdges:['left','right','top','bottom']});
assert.equal(snapScaleToFrame(.85,centered,frame,{width:800,height:600}).scale,.85);
assert.equal(snapScaleToFrame(1.02,centered,frame,{width:800,height:600}).scale,1);
assert.equal(snapScaleToFrame(.99,{x:0,y:1},frame,{width:800,height:600}).scale,1);
assert.equal(snapScaleToFrame(.8,{x:.001,y:.5},frame,{width:800,height:600}).scale,.8,'nearly anchored edge cannot pull a distant size');
const wide=snapScaleToFrame(.755,centered,frame,{width:1600,height:900});
assert.equal(wide.scale,.75);assert.deepEqual(wide.snapEdges,['left','right']);
const tall=snapScaleToFrame(.56,centered,frame,{width:900,height:1200});assert.equal(tall.scale,.5625);assert.deepEqual(tall.snapEdges,['top','bottom']);
// Real gesture binding: snapped values reach change; metadata stays in the guide channel.
const events=new Map(),resized={x:.5,y:.5,scale:.9};let guide=null;
const surface={addEventListener:(n,f)=>events.set(n,f),setPointerCapture(){},getBoundingClientRect:()=>frame};
bindStageTransform({root:surface,getClip:()=>resized,getSource:()=>({width:800,height:600}),enabled:()=>true,begin(){},change:next=>{resized.scale=next.scale},finish(){},guides:n=>guide=n,scaleHandle:{contains:()=>true}});
events.get('pointerdown')(event(9));events.get('pointermove')(event(9,16));assert.equal(resized.scale,1);assert.equal(guide.snapEdges.length,4);
events.get('pointermove')(event(9,60));assert.ok(resized.scale>1.2,'continued drag escapes snap');events.get('pointerup')(event(9,60));assert.equal(guide,null);
console.log('Frame-edge resize snapping: all edges, aspect fit, anchored bounds and escape PASS');
resized.scale=.98;for(let i=0;i<80;i++)events.get('wheel')({ctrlKey:true,deltaY:-1,preventDefault(){}});
assert.ok(resized.scale>1.1,'small wheel deltas accumulate beyond the snapped value');
await new Promise(resolve=>setTimeout(resolve,180));assert.equal(guide,null);
console.log('Wheel resizing escapes frame snap and clears guides after completion PASS');

const single=snapScaleToFrame(1.2,{x:.05,y:.5},{width:400,height:300},{width:800,height:600});assert.equal(single.scale,1.2);assert.equal(single.x,0);assert.deepEqual(single.snapEdges,['left']);
for(const [pos,edge,key] of [[{x:.95,y:.5},'right','x'],[{x:.5,y:.05},'top','y'],[{x:.5,y:.95},'bottom','y']]){const snap=snapScaleToFrame(1.2,pos,frame,{width:800,height:600});assert(snap.snapEdges.includes(edge));assert.equal(snap[key],edge==='right'||edge==='bottom'?1:0);}
console.log('Resize can snap a single nearby edge without forcing the opposite edge or changing scale PASS');

const {clipPreviewBounds,movePreviewClip,resizePreviewClip}=await import('../dist/preview-transform-geometry.js');
const frameBox={left:20,top:30,width:400,height:300},image={width:800,height:600},pose={scale:1,x:.5,y:.5};
const moved=movePreviewClip(pose,50,20,frameBox,image);assert.equal(moved.offsetX,.125);assert.ok(Math.abs(moved.offsetY-20/300)<1e-9);assert.equal(clipPreviewBounds({...pose,...moved},frameBox,image).left,70,'100% image follows cursor');
const se=resizePreviewClip(pose,'se',80,60,frameBox,image,false,0),sb=clipPreviewBounds({...pose,...se},frameBox,image);assert.equal(sb.left,20);assert.equal(sb.top,30);assert.ok(Math.abs(sb.width-480)<1e-7);assert.ok(Math.abs(sb.height-360)<1e-7);
for(const handle of ['nw','ne','sw','se']){const result=resizePreviewClip(pose,handle,handle.includes('w')?-40:40,handle.includes('n')?-30:30,frameBox,image,false,0),bounds=clipPreviewBounds({...pose,...result},frameBox,image);assert.ok(Math.abs(bounds.width/bounds.height-4/3)<1e-9);assert.ok(bounds.width>400);if(handle.includes('w'))assert.ok(Math.abs(bounds.left+bounds.width-420)<1e-6);else assert.equal(bounds.left,20);}
const center=resizePreviewClip(pose,'se',40,30,frameBox,image,true,0),cb=clipPreviewBounds({...pose,...center},frameBox,image);assert.ok(Math.abs(cb.left+cb.width/2-220)<1e-9);assert.ok(Math.abs(cb.top+cb.height/2-180)<1e-9);
console.log('Conventional image gestures: cursor-follow at 100%, four anchored corners, aspect lock and Option-center resize PASS');

// All four visible corners use the same source-space bounds as frame snapping.
for(const dims of [[400,300,800,600],[300,500,1920,1080],[640,360,720,1280]])for(const scale of [.35,.8,1,1.5,2.7])for(const handle of ['nw','ne','sw','se']){
 const frame={left:17,top:29,width:400,height:300},west=handle.includes('w'),north=handle.includes('n'),origin={scale:.75,x:west?1:0,y:north?1:0};
 const result=resizePreviewClip(origin,handle,(west?-1:1)*103,(north?-1:1)*78,frame,image),after=clipPreviewBounds({...origin,...result},frame,image);
 assert.equal(result.scale,1);assert.deepEqual(result.snapEdges,['left','right','top','bottom']);
 assert.ok(Math.abs(after.left-frame.left)<1e-6);assert.ok(Math.abs(after.top-frame.top)<1e-6);assert.equal(after.width,frame.width);assert.equal(after.height,frame.height);
}
const fs=await import('node:fs');const css=fs.readFileSync(new URL('../dist/style.css',import.meta.url),'utf8'),app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
assert.match(css,/\.stage-transform-box\{[^}]*border:0;outline:/);assert.doesNotMatch(app,/handle\.style\.(?:left|top)=\(clamp/,'Never move corner handles away from actual image bounds');
console.log('60 aspect/scale/corner combinations retain opposite anchor; all frame-edge corners and handle geometry agree PASS');

const zoomedFrame={left:-180,top:-120,width:800,height:600},outputFrame={left:20,top:30,width:400,height:300};
const zoomPose={scale:.4,x:.5,y:.5},zoomBounds=clipPreviewBounds(zoomPose,zoomedFrame,image);
const zoomResize=resizePreviewClip(zoomPose,'se',43,33,zoomedFrame,image,true,8,outputFrame),zoomAfter=clipPreviewBounds({...zoomPose,...zoomResize},zoomedFrame,image);
assert.ok(Math.abs(zoomAfter.left-outputFrame.left)<1e-6);assert.ok(Math.abs(zoomAfter.top-outputFrame.top)<1e-6);assert.equal(zoomAfter.width,outputFrame.width);assert.equal(zoomAfter.height,outputFrame.height);assert.deepEqual(zoomResize.snapEdges,['left','right','top','bottom']);
const zoomMove=movePreviewClip(zoomPose,31,21,zoomedFrame,image,0,outputFrame),zoomMoved=clipPreviewBounds({...zoomPose,...zoomMove},zoomedFrame,image);assert.ok(Math.abs(zoomMoved.left-zoomBounds.left-31)<1e-6);assert.ok(Math.abs(zoomMoved.top-zoomBounds.top-21)<1e-6);
assert.match(app,/getSnapFrame:\(\)=>\$\('#picture'\)/);assert.match(app,/const frame=\$\('#zoomComposition'\)\.getBoundingClientRect/);
console.log('Active zoom FX: handles follow displayed image, movement follows pixels, snapping retains output frame PASS');
