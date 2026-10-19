import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {project,clip,sequence} from '../dist/model.js';
import {clipAlpha} from '../dist/creative.js';
import {locatePreviewRow} from '../dist/timeline-time.js';
import {transitionState,outgoingTransitionRow,applyTransitionStyles} from '../dist/transition.js';
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const start=app.indexOf('function paintPreview(){'),end=app.indexOf('\nfor(const sourceVideo',start);
assert.ok(start>=0&&end>start);
const media={id:'m',kind:'image',width:160,height:90,duration:4};
const base=(id,layer,start=0,out=4)=>({...clip(media),id,layer,start,in:0,out,opacity:1,fadeIn:0,fadeOut:0});
function scene(clips,time,hidden=[]){
 const p=project();p.media=[media];p.clips=clips;p.videoTracks=hidden.map(hidden=>({hidden}));
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{style:{},clientHeight:90,classList:{toggle(){}},replaceChildren(){}});return elements.get(id)};
 const lower=[{updates:0,clears:0,update(){this.updates++},clear(){this.clears++}},{updates:0,clears:0,update(){this.updates++},clear(){this.clears++}}];
 const canvas={style:{}},s={P:p,time,sequence,clipAlpha,transitionState,outgoingTransitionRow,applyTransitionStyles,canvas,$,lowerPreviews:lower,
  visibleVideoRows:rows=>rows.filter(r=>!p.videoTracks[r.layer]?.hidden),playbackRows:null,duration:()=>4,
  playing:false,selected:'upper',tab:'cut',emptyPictureReleased:false,fxMarkup:'',
  paintRegionZoom(){},paintStageSelection(){},fit(){},releasePictureResources(){},
  transitionPreview:{update(){},clear(){$('#transitionCanvas').style.opacity='0'}},
  textPreview:{update(){},clear(){}},video:{pause(){},playbackRate:1},painter:{black(){}},
  mediaOf:()=>null,linkURL:()=>null,localFiles:new Map(),pictureAspect:()=> '16:9',
  compare:false,lookBypass:false,stabilizationFor:()=>null,previewLongEdge:()=>160};
 s.previewRow=()=>locatePreviewRow(s.visibleVideoRows(sequence(p)),time,4);
 vm.createContext(s);vm.runInContext(app.slice(start,end)+'\npaintPreview();',s);
 return {canvas,lower,outgoing:$('#transitionCanvas').style};
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
