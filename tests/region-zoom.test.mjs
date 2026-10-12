import {regionZoomDrag} from '../dist/region-zoom-ui.js';
import assert from 'node:assert/strict';
import {normalizeRegionZoom,regionZoomPose,regionZoomTransform,drawRegionZoom} from '../dist/region-zoom.js';
import {project,sanitize} from '../dist/model.js';
import {addEffect,effectAlpha} from '../dist/creative.js';
const e={type:'region-zoom',start:2,duration:4,zoomSize:.25,zoomX:.25,zoomY:.75,zoomIn:.2,zoomOut:.4,returnAt:2,zoomReturn:true};
assert.equal(regionZoomPose(e,1).scale,1);assert.equal(regionZoomPose(e,2).scale,1);assert.ok(Math.abs(regionZoomPose(e,2.1).scale-2.5)<1e-9);assert.equal(regionZoomPose(e,3).scale,4);assert.equal(regionZoomPose(e,4.4).scale,1);assert.equal(regionZoomPose({...e,zoomReturn:false},5.99).scale,4);assert.equal(regionZoomPose(e,6).scale,1);
const pose=regionZoomPose(e,3);assert.equal((.25-.5)*pose.scale+.5+pose.x, .5);assert.equal((.75-.5)*pose.scale+.5+pose.y,.5);
const n=normalizeRegionZoom({...e,zoomSize:.01,zoomX:-100,zoomY:9,zoomIn:9,zoomOut:9,returnAt:-2});assert.equal(n.zoomSize,.1);assert.equal(n.zoomX,.05);assert.equal(n.zoomY,.95);assert.equal(n.zoomIn,4);assert.equal(n.zoomOut,0);assert.equal(n.returnAt,4);
assert.equal(regionZoomPose({...e,zoomSize:1},3).scale,1);assert.equal(regionZoomPose({...e,zoomIn:0,zoomOut:0},2).scale,4);assert.equal(effectAlpha(e,3),0);
assert.equal(normalizeRegionZoom(e).zoomTexts,true);assert.equal(normalizeRegionZoom({...e,zoomTexts:false}).zoomTexts,false);
const p=project(),added=addEffect(p,'region-zoom',2);assert.equal(added.zoomSize,.4);const loaded=sanitize({...p,effects:[e,{type:'flash',start:1,duration:.2}]});assert.equal(loaded.effects[0].zoomSize,.25);assert.equal(sanitize({...p,effects:[{...e,zoomTexts:false}]}).effects[0].zoomTexts,false);assert.equal(loaded.effects[1].type,'flash');assert.equal(regionZoomTransform([],3).scale,1);
let matrix;const ctx={save(){},restore(){},setTransform(...a){matrix=a},drawImage(){}};drawRegionZoom(ctx,{}, {getContext(){return{drawImage(){}}}},[e],3,400,200);assert.deepEqual(matrix,[4,0,0,4,-200,-500]);
assert.equal(regionZoomDrag(normalizeRegionZoom(e),-.05,0,true).zoomSize,.15);assert.equal(regionZoomDrag(normalizeRegionZoom(e),0,-.05,true).zoomSize,.15);assert.equal(regionZoomDrag(normalizeRegionZoom(e),10,10).zoomX,.875);
console.log('Region zoom geometry, timing, instant/return/hold, bounds, persistence and composed canvas PASS');

// A phone touch owns only its pointer, blocks sheet scroll and rolls back when
// Safari cancels capture. The next gesture must remain usable.
const {bindRegionZoomFrame,regionZoomHandlePosition}=await import('../dist/region-zoom-ui.js');
let down,changes=[],starts=0,ends=[],capture;
const frame={parentElement:{getBoundingClientRect:()=>({width:400,height:200})},addEventListener:(name,fn)=>{if(name==='pointerdown')down=fn},setPointerCapture:id=>capture=id,releasePointerCapture:id=>{assert.equal(id,capture)}};
bindRegionZoomFrame(frame,{getEffect:()=>({...e,zoomSize:.4,zoomX:.5,zoomY:.5}),begin:()=>starts++,change:value=>changes.push(value),finish:(cancel,initial)=>ends.push({cancel,initial})});
let prevented=0,stopped=0;
const pointer=(x,y,id=7,type='pointermove',resize=false)=>({button:0,pointerType:'touch',pointerId:id,isPrimary:true,clientX:x,clientY:y,type,target:{closest:()=>resize?{}:null},preventDefault(){prevented++},stopPropagation(){stopped++}});
down(pointer(100,80,7,'pointerdown'));frame.onpointermove(pointer(140,100));assert.equal(changes.at(-1).zoomX,.6);assert.equal(changes.at(-1).zoomY,.6);
const count=changes.length;frame.onpointermove(pointer(300,200,8));assert.equal(changes.length,count,'another finger cannot move the frame');
assert(prevented>=2&&stopped>=2,'touch move must not scroll the inspector');
frame.onlostpointercapture(pointer(140,100,7,'lostpointercapture'));assert.equal(ends.at(-1).cancel,true);assert.equal(frame.onpointermove,null);
down(pointer(100,80,7,'pointerdown',true));frame.onpointermove(pointer(80,80));frame.onpointerup(pointer(80,80,7,'pointerup'));assert.ok(Math.abs(changes.at(-1).zoomSize-.3)<1e-9);assert.equal(ends.at(-1).cancel,false);assert.equal(starts,2);
assert.equal(frame.onlostpointercapture,null);
for(const target of [{zoomSize:.1,zoomX:.05,zoomY:.05},{zoomSize:.1,zoomX:.95,zoomY:.95},{zoomSize:1,zoomX:.5,zoomY:.5}]){
 const pos=regionZoomHandlePosition(target,200,100),left=(target.zoomX-target.zoomSize/2)*200+pos.left,top=(target.zoomY-target.zoomSize/2)*100+pos.top;
 assert(left>=0&&left+44<=200&&top>=0&&top+44<=100,'phone resize target stays inside the preview');
 if(pos.compact){const labelLeft=(target.zoomX-target.zoomSize/2)*200+pos.labelLeft;assert(labelLeft+74<=left||labelLeft>=left+44,'small-frame move grip stays separate from resize');}
}
console.log('Phone region frame touch move/resize, scroll exclusion, lost capture recovery and edge handle bounds PASS');
