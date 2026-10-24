import {orderedEffects} from '../dist/effect-order.js?v=2.2.85';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {project,clip,sequence} from '../dist/model.js?v=2.2.85';
import {clipAlpha} from '../dist/creative.js?v=2.2.85';
import {locatePreviewRow} from '../dist/timeline-time.js?v=2.2.85';
import {transitionState,outgoingTransitionRow,applyTransitionStyles} from '../dist/transition.js?v=2.2.85';
const app=fs.readFileSync(new URL('../dist/app.js?v=2.2.85',import.meta.url),'utf8');
const start=app.indexOf('function paintPreview(){'),end=app.indexOf('\nfor(const sourceVideo',start);
assert.ok(start>=0&&end>start);
const media={id:'m',kind:'image',width:160,height:90,duration:4};
const base=(id,layer,start=0,out=4)=>({...clip(media),id,layer,start,in:0,out,opacity:1,fadeIn:0,fadeOut:0});
function scene(clips,time,hidden=[],setup=()=>{}){
 const p=project();p.media=[media];p.clips=clips;p.videoTracks=hidden.map(hidden=>({hidden}));
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{style:{},clientHeight:90,classList:{toggle(){}},replaceChildren(){}});return elements.get(id)};
 const lower=[{canvas:{style:{opacity:'0'}},updates:0,clears:0,ready(){return true},update(){this.updates++},clear(){this.clears++}},{canvas:{style:{opacity:'0'}},updates:0,clears:0,ready(){return true},update(){this.updates++},clear(){this.clears++}}];
 const canvas={style:{}},s={orderedEffects,previewTrace:null,playbackPlan:null,P:p,time,sequence,clipAlpha,transitionState,outgoingTransitionRow,applyTransitionStyles,canvas,$,lowerPreviews:lower,
  visibleVideoRows:rows=>rows.filter(r=>!p.videoTracks[r.layer]?.hidden),playbackRows:null,duration:()=>4,
  stillPreview:{key:'mock',bitmap:{}},playing:false,selected:'upper',tab:'cut',emptyPictureReleased:false,fxMarkup:'',
  paintRegionZoom(){$('#zoomComposition').style.transform='advanced'},paintStageSelection(){},fit(){},releasePictureResources(){},
  transitionPreview:{update(){},clear(){$('#transitionCanvas').style.opacity='0'}},
  textPreview:{update(){},clear(){}},video:{pause(){},playbackRate:1},painter:{black(){}},
  mediaOf:()=>null,linkURL:()=>null,localFiles:new Map(),pictureAspect:()=> '16:9',
  compare:false,lookBypass:false,stabilizationFor:()=>null,previewLongEdge:()=>160};
 s.previewRow=()=>locatePreviewRow(s.visibleVideoRows(sequence(p)),time,4);
 setup(s);vm.createContext(s);vm.runInContext(app.slice(start,end)+'\npaintPreview();',s);
 return {canvas,lower,outgoing:$('#transitionCanvas').style,zoom:$('#zoomComposition').style.transform,state:s};
}
const lower=base('lower',0),upper=base('upper',1);upper.opacity=.5;
let s=scene([lower,upper],1);assert.equal(s.canvas.style.opacity,'0.5');assert.equal(s.outgoing.opacity,'0');assert.equal(s.lower[0].updates,1);
upper.opacity=0;s=scene([lower,upper],1);assert.equal(s.canvas.style.opacity,'0');assert.equal(s.lower[0].updates,1);
upper.opacity=1;s=scene([lower,upper],1);assert.equal(s.lower[0].updates,0,'Opaque non-transition may skip its background');
upper.fadeIn=1;upper.fadeOut=1;
for(const [time,alpha] of [[.25,.25],[3.75,.25]]){s=scene([lower,upper],time);assert.equal(+s.canvas.style.opacity,alpha);assert.equal(s.lower[0].updates,1)}
upper.fadeIn=upper.fadeOut=0;
const previous=base('previous',1,0,2);previous.opacity=.25;
const incoming=base('upper',1,2,2);incoming.transition={type:'dissolve',duration:1,direction:'left'};
s=scene([lower,previous,incoming],2.5);assert.equal(s.canvas.style.opacity,'0.5');assert.equal(s.outgoing.opacity,'0.25','Outgoing surface retains clip opacity');assert.equal(s.lower[0].updates,1,'Transition must retain the visible background');
s=scene([lower,previous,incoming],3.5);assert.equal(s.outgoing.opacity,'0');assert.equal(s.lower[0].updates,0);
const middle=base('middle',1);middle.opacity=.5;const top=base('upper',2);top.opacity=.5;
s=scene([lower,middle,top],1);assert.deepEqual(s.lower.map(x=>x.updates),[1,1]);
s=scene([lower,middle,top],1,[false,true,false]);assert.deepEqual(s.lower.map(x=>x.updates),[1,0]);
middle.opacity=1;s=scene([lower,middle,top],1);assert.deepEqual(s.lower.map(x=>x.updates),[0,1]);
console.log('Actual preview paint: opacity, fades, transition alpha, background coverage, hidden layers and 3-layer stack PASS');

// A role change must keep the last composite until all participating frames exist.
const holdMain=s=>{s.playing=true;s.mediaOf=()=>({...media,kind:'video'});s.linkURL=()=> 'mock';s.activeVideoKey='old|mock';s.videoFrameReady=()=>false;s.canvas.style.opacity='.37'};
s=scene([lower,top],2,[],holdMain);assert.equal(s.canvas.style.opacity,'.37');assert.deepEqual(s.lower.map(x=>x.updates),[0,0]);
const holdLower=s=>{s.playing=true;s.mediaOf=()=>media;s.linkURL=()=> 'mock';s.canvas.style.opacity='.37';s.lowerPreviews.forEach(p=>p.ready=()=>false)};
s=scene([lower,top],2,[],holdLower);assert.equal(s.canvas.style.opacity,'.37','Fades wait for newly revealed lower frames');
console.log('Composite handoff: pending main and lower frames preserve the previous composition PASS');

const holdOpacity=s=>{holdLower(s);s.lowerPreviews[0].canvas.style.opacity='.19';s.lowerPreviews[1].canvas.style.opacity='.29';s.lowerPreviews[0].update=function(){this.canvas.style.opacity='.9'}};
s=scene([lower,top],2,[],holdOpacity);assert.deepEqual(s.lower.map(p=>p.canvas.style.opacity),['.19','.29']);assert.equal(s.lower[1].clears,0,'hidden-layer cleanup waits for composition commit');
console.log('Pending composition preserves lower opacity and defers decoder cleanup PASS');

const missingLower=s=>{holdLower(s);s.mediaOf=()=>null};
s=scene([lower,top],2,[],missingLower);assert.equal(s.canvas.style.opacity,'0.5','Unlinked lower media cannot freeze the visible clip');

// Zoom and caption geometry must commit with the corresponding video frame.
s=scene([lower,top],2,[],holdMain);assert.equal(s.zoom,undefined,'Pending main video must not advance FX or caption transforms');
s=scene([lower,top],2,[],holdLower);assert.equal(s.zoom,undefined,'Pending lower video must not advance FX or caption transforms');
s=scene([lower,top],2);assert.equal(s.zoom,'advanced','Paused editing applies geometry immediately');
console.log('FX/caption transforms remain on the previous complete composition while video is pending PASS');
// Exercise actual FX geometry and overlay filtering, including video-free scenes.
const {regionZoomTransform,normalizeRegionZoom}=await import('../dist/region-zoom.js?v=2.2.85');
const {previewZoomStyle,focusOverlayMarkup}=await import('../dist/preview-effects.js?v=2.2.85');
const {effectAlpha}=await import('../dist/creative.js?v=2.2.85');
const zoomStart=app.indexOf('function paintRegionZoom(){'),zoomEnd=app.indexOf('\nbindRegionZoomFrame(',zoomStart);
assert(zoomStart>=0&&zoomEnd>zoomStart);
const overlays=scene([],0);const ctx=overlays.state;let captions=[];
Object.assign(ctx,{document:{body:{dataset:{ui:'desktop'}}},selectedRegionZoom:()=>null,regionZoomTransform,normalizeRegionZoom,previewZoomStyle,focusOverlayMarkup,effectAlpha,focusRect:()=>({x:.5,y:.5,size:.4})});
ctx.textPreview={update(texts,t){captions.push({ids:texts.map(t=>t.id),time:t})},clear(){}};
const zoom={id:'zoom',type:'region-zoom',layer:0,start:.5,duration:1,zoomSize:.5,zoomX:.5,zoomY:.5,zoomIn:0,zoomReturn:false,zoomTexts:false};
const focus={id:'focus',type:'region-zoom',motionKind:'focus',layer:1,start:.5,duration:1,strength:.4};
const flash={id:'flash',type:'flash',layer:2,start:.5,duration:1,strength:.5};
ctx.P.effects=[zoom,focus,flash];ctx.P.texts=[{id:'caption',layer:0,start:.5,end:1.5}];
vm.runInContext(app.slice(zoomStart,zoomEnd),ctx);
const style=id=>ctx.$(id).style;
for(const [t,visible] of [[.49,false],[.5,true],[1,true],[1.5,false]]){
 ctx.time=t;ctx.paintPreview();assert.deepEqual(captions.at(-1).ids,visible?['caption']:[]);assert.equal(captions.at(-1).time,t);
 assert.equal(style('#zoomComposition').transform!=='none',visible);assert.equal(style('#textOverlay').transform,'none','Fixed captions do not inherit zoom');
 assert.equal(!!ctx.fxMarkup,visible,'Focus and flash obey half-open timing boundaries without video');
}
ctx.time=1;zoom.zoomTexts=true;ctx.paintPreview();assert.equal(style('#textOverlay').transform,style('#zoomComposition').transform);
ctx.P.overlayTracks=[{hidden:true},{hidden:true},{hidden:true}];ctx.paintPreview();assert.equal(style('#zoomComposition').transform,'none');assert.equal(style('#textOverlay').transform,'none');assert.equal(ctx.fxMarkup,'');assert.deepEqual(captions.at(-1).ids,[]);
ctx.P.overlayTracks=[];ctx.paintPreview();assert.notEqual(style('#zoomComposition').transform,'none');
ctx.P.effects=[];ctx.P.texts=[];ctx.paintPreview();assert.equal(style('#zoomComposition').transform,'none');assert.equal(style('#textOverlay').transform,'none');assert.equal(ctx.fxMarkup,'');assert.deepEqual(captions.at(-1).ids,[]);
ctx.P.effects=[zoom];ctx.P.texts=[{id:'caption',layer:0,start:.5,end:1.5}];ctx.paintPreview();assert.notEqual(style('#zoomComposition').transform,'none');assert.deepEqual(captions.at(-1).ids,['caption']);
console.log('Actual FX/text paint: video-free timing, fixed/zoomed captions, track visibility, deletion and Undo-style restoration PASS');

// A still image is asynchronous too: no new FX/fades until its bitmap exists.
const holdImage=s=>{s.playing=true;s.mediaOf=()=>media;s.linkURL=()=> 'mock';s.stillPreview={key:'old',bitmap:{}};s.engine=false;s.translate=t=>t;s.stabilizationPreview={state:()=>({status:'ready'})};s.assetName=()=>'';s.performanceMode=()=> 'balanced';s.performanceModes={balanced:{label:'balanced'}};s.canvas.style.opacity='.37'};
s=scene([lower,top],2,[],holdImage);assert.equal(s.zoom,undefined,'A previous bitmap cannot satisfy the new image clip');assert.equal(s.canvas.style.opacity,'.37');
s=scene([lower,top],2,[],s=>{holdImage(s);s.stillPreview={key:'mock',bitmap:null}});assert.equal(s.zoom,undefined,'A pending image must preserve the last composition');
console.log('Still-image handoff retains the previous composite until the matching bitmap is ready PASS');
ctx.time=1;ctx.P.texts=[];const white={id:'high-white',type:'flash',layer:2,start:0,duration:2,strength:1},black={id:'low-black',type:'black-in',layer:0,start:0,duration:2,strength:1};ctx.P.effects=[white,black];ctx.paintPreview();const orderedMarkup=ctx.fxMarkup;assert(orderedMarkup.indexOf('background:black')<orderedMarkup.indexOf('background:white'));
ctx.P.effects=[black,white];ctx.paintPreview();assert.equal(ctx.fxMarkup,orderedMarkup,'Actual preview color FX follow F/T order regardless of insertion order');
ctx.P.overlayTracks=[{}, {}, {hidden:true}];ctx.paintPreview();assert(!ctx.fxMarkup.includes('background:white'));
console.log('Actual preview FX stacking matches F/T order and still respects hidden planes PASS');
