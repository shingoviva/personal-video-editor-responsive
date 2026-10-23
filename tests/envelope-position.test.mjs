import assert from 'node:assert/strict';
import {envelopeXAtTime,envelopeTimeAtX,bindClipEnvelope,dbToY,clipEnvelopeOwnsPointer,clipEnvelopeDoubleTap,videoEnvelopeEnabled,envelopeHandles,envelopeHandleX,snapEnvelopeDrag} from '../dist/clip-envelope-ui.js?v=2.2.84';
for(const width of [8,80,400,1200])for(const duration of [.16,3,8])for(const fraction of [0,.125,.5,.875,1]){
 const time=duration*fraction,x=envelopeXAtTime(time,duration,width);
 assert(Math.abs(x-width*fraction)<1e-9);
 assert(Math.abs(envelopeTimeAtX(x,duration,width)-time)<1e-9);
}
// A point selected off-center must retain its timestamp during vertical dragging.
const handlers=new Map(),ctx=new Proxy({measureText:()=>({width:30})},{get:(o,k)=>k in o?o[k]:()=>{}});
const canvas={width:400,height:24,getBoundingClientRect:()=>({left:100,top:50,width:400,height:24}),getContext:()=>ctx};
const element={isConnected:true,querySelector:()=>canvas,append(){},setPointerCapture(){},addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)};
globalThis.document={body:{},createElement:()=>({style:{}})};
globalThis.MutationObserver=class{observe(){}};globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.requestAnimationFrame=fn=>{fn();return 1};
let points=[{id:'p',time:1,valueDb:0}],selected=null,commits=0;
bindClipEnvelope(element,{getPoints:()=>points,setPoints:p=>points=p,duration:()=>8,isActive:()=>true,selectedId:()=>selected,setSelected:id=>selected=id,onCommit:()=>commits++});
const event=(x,y)=>({button:0,pointerId:1,pointerType:'mouse',clientX:100+x,clientY:50+y,target:{closest:()=>null},preventDefault(){},stopImmediatePropagation(){}});
const y=dbToY(0,18);handlers.get('pointerdown')(event(55,y));assert.equal(selected,'p');handlers.get('pointermove')(event(55,y+10));assert.equal(points[0].time,1);assert(points[0].valueDb<0);handlers.get('pointerup')(event(55,y+10));assert.equal(commits,1);
// Horizontal movement remains accurate despite the 5px initial grab offset.
const changedY=dbToY(points[0].valueDb,18);handlers.get('pointerdown')(event(55,changedY));handlers.get('pointermove')(event(155,changedY));assert.equal(points[0].time,3);handlers.get('pointerup')(event(155,changedY));
// A plain line press never writes points; a double action adds one interior point plus boundaries.
points=[];selected=null;commits=0;
const empty=event(200,y);assert.equal(clipEnvelopeOwnsPointer(element,empty),true);
handlers.get('pointerdown')(empty);handlers.get('pointerup')(empty);assert.equal(points.length,0);assert.equal(commits,0);
handlers.get('dblclick')(empty);assert.equal(points.length,3);assert.equal(points[1].time,4);assert.equal(commits,1);
// The same explicit action supports phone double taps; armed layer moves win over points.
points=[];assert.equal(clipEnvelopeDoubleTap(element,{...empty,pointerType:'touch'}),true);assert.equal(points.length,3);
assert.equal(clipEnvelopeOwnsPointer(element,empty),true);
globalThis.document.body.classList={contains:()=>true};assert.equal(clipEnvelopeOwnsPointer(element,empty),false);
handlers.get('pointerdown')(empty);assert.equal(points.length,3);
delete globalThis.document.body.classList;
// Lost capture ends point dragging, so future timeline gestures cannot be swallowed.
handlers.get('pointerdown')(empty);handlers.get('pointermove')(event(200,y+9));handlers.get('lostpointercapture')(event(200,y+9));assert.equal(handlers.has('pointermove'),false);
// Virtual boundaries preserve the existing evaluated curve until explicitly used.
points=[];let begins=0,limits=0,delegated=0;
assert.deepEqual(envelopeHandles([],8).map(p=>[p.time,p.valueDb,p.virtual]),[[0,0,true],[8,0,true]]);
assert.equal(points.length,0);
for(const [value,at] of [[-12,0],[-6,8]]){const p=envelopeHandles([{id:'inside',time:4,valueDb:value}],8).find(p=>p.time===at);assert.equal(p.valueDb,value)}
bindClipEnvelope(element,{loadWaveform:false,getPoints:()=>points,setPoints:p=>points=p,duration:()=>8,isActive:()=>true,selectedId:()=>selected,setSelected:id=>selected=id,onBegin:()=>begins++,onCommit:()=>commits++,onLimit:()=>limits++});
const startHandle=event(envelopeHandleX(envelopeHandles([],8)[0],8,400),y);
startHandle.target={closest:()=>({dataset:{edge:'in'}})};
assert.equal(clipEnvelopeOwnsPointer(element,startHandle),true,'boundary knob wins only in its lower gain region');
handlers.get('pointerdown')(startHandle);assert.equal(points.length,2);handlers.get('pointermove')({...startHandle,clientX:150,clientY:50+y+10});handlers.get('pointerup')({...startHandle,clientX:150,clientY:50+y+10});
assert.equal(points[0].time,0,'start handle stays exactly at zero');assert(points[0].valueDb<0);assert.equal(points[1].time,8);assert.equal(points[1].valueDb,0);
const endHandle=event(394,y);endHandle.target={closest:()=>({dataset:{edge:'out'}})};
handlers.get('pointerdown')(endHandle);handlers.get('pointermove')({...endHandle,clientX:350,clientY:50+y+10});handlers.get('pointerup')({...endHandle,clientX:350,clientY:50+y+10});assert.equal(points.at(-1).time,8);assert(points.at(-1).valueDb<0);
points=[];begins=commits=0;
handlers.get('pointerdown')(empty);handlers.get('pointermove')(event(201,y+1));handlers.get('pointerup')(event(201,y+1));assert.equal(points.length,0);assert.equal(begins,0);assert.equal(commits,0,'jitter is not a volume edit');
handlers.get('pointerdown')(empty);handlers.get('pointermove')(event(200,y+10));handlers.get('pointerup')(event(200,y+10));assert.deepEqual(points.map(p=>p.time),[0,8]);assert.equal(points[0].valueDb,points[1].valueDb);assert(points[0].valueDb<0);assert.equal(begins,1);assert.equal(commits,1);
points=[];begins=commits=0;element.onpointerdown=e=>{assert.equal(e.timelineEnvelopeMove,true);delegated++};element.onpointermove=()=>delegated++;
handlers.get('pointerdown')(empty);handlers.get('pointermove')(event(220,y+1));assert.equal(points.length,0);assert.equal(begins,0);assert.equal(delegated,2,'horizontal line drag transfers to existing clip mover');
points=Array.from({length:1024},(_,i)=>({id:'full-'+i,time:i/1024,valueDb:0}));const original=JSON.stringify(points);handlers.get('dblclick')(empty);assert.equal(limits,1);assert.equal(JSON.stringify(points),original,'point capacity never drops existing automation');
assert.equal(snapEnvelopeDrag(12,22,true).valueDb,12,'compact lane can leave the zero snap toward positive gain');
const {envelopeDbAt}=await import('../dist/clip-envelope.js?v=2.2.84');
points=[{id:'a',time:2,valueDb:-6,interpolation:'hold'},{id:'b',time:5,valueDb:3,interpolation:'linear'},{id:'c',time:6,valueDb:-12,interpolation:'hold'}];
const reference=Array.from({length:1601},(_,i)=>envelopeDbAt(i/200,points));
const boundaryPress=event(6,dbToY(-6,18));handlers.get('pointerdown')(boundaryPress);handlers.get('pointerup')(boundaryPress);
for(let i=0;i<reference.length;i++)assert.equal(envelopeDbAt(i/200,points),reference[i],'materializing boundaries preserves existing hold/linear evaluation exactly');
// Owned flat lines still recognize native touch double taps exactly once.
points=[{id:'s',time:0,valueDb:-12},{id:'e',time:8,valueDb:-12}];
bindClipEnvelope(element,{loadWaveform:false,getPoints:()=>points,setPoints:p=>points=p,duration:()=>8,isActive:()=>true,selectedId:()=>null,setSelected(){}});
const touchLine={...event(200,dbToY(-12,18)),pointerType:'touch'};
for(let i=0;i<2;i++){handlers.get('pointerdown')({...touchLine,type:'pointerdown'});handlers.get('pointerup')({...touchLine,type:'pointerup'})}
assert.equal(points.length,3);assert.equal(points[1].time,4);assert.equal(points[1].valueDb,-12);
handlers.get('dblclick')({...touchLine,type:'dblclick'});assert.equal(points[1].valueDb,-12,'ignore a browser compatibility double click after the owned touch action');
console.log('Boundary gain handles, exact endpoint times, horizontal level, jitter, clip handoff and capacity PASS');
await Promise.resolve();delete globalThis.document;delete globalThis.MutationObserver;delete globalThis.ResizeObserver;delete globalThis.requestAnimationFrame;
console.log('Envelope points follow the full timeline width and retain timestamp under off-center vertical drag PASS');

// Inline video gain controls are only meaningful for attached, moving-video audio.
const v={audio:{},out:8};const vm={kind:'video',audio:true};
assert.equal(videoEnvelopeEnabled(v,vm),true);
for(const [clip,media] of [[{...v,gap:true},vm],[{...v,freezeDuration:1},vm],[{...v,audioDetached:'a'},vm],[v,{kind:'image',audio:true}],[v,{kind:'video',audio:false}],[v,{kind:'audio',audio:true}],[v,null]])assert.equal(videoEnvelopeEnabled(clip,media),false);
assert.equal(videoEnvelopeEnabled({...v,audio:{mute:true}},vm),true,'muted original audio remains editable');
let allocated=0,appended=0;globalThis.document={body:{},createElement:()=>{allocated++;return{style:{}}}};
globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.requestAnimationFrame=fn=>{fn();return 1};
const videoElement={...element,append(){appended++}};
bindClipEnvelope(videoElement,{loadWaveform:false,getClip:()=>v,getPoints:()=>[],duration:()=>8,isActive:()=>true,selectedId:()=>null});
assert.equal(allocated,0,'video overlay does not create waveform progress UI');assert.equal(appended,0);
delete globalThis.document;delete globalThis.ResizeObserver;delete globalThis.requestAnimationFrame;
console.log('Video envelope eligibility and no-waveform lightweight binding PASS');

// A selection-only refresh must preserve the element between native double clicks.
const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm');
const app=await readFile(new URL('../dist/app.js?v=2.2.84',import.meta.url),'utf8');
const renderSource=app.split('\n').find(line=>line.startsWith('function render('));let rebuilt=0,selectedPaints=0;
const nodes=new Map(),noop=()=>{};
const scope={$:id=>{if(!nodes.has(id))nodes.set(id,{value:'',style:{}});return nodes.get(id)},$$:()=>[],P:{name:'Test',intent:'x'},intentHints:{x:''},time:0,clamp:x=>x,duration:()=>8,invalidateMaterialResults:noop,syncWorkspaceChrome:noop,renderMedia:noop,renderInspector:noop,renderTimeline:()=>rebuilt++,paintTimelineSelection:()=>selectedPaints++,draw:noop,updateClock:noop,history:[],future:[],current:()=>({}),selectedAudio:null,selectedEditMarker:null,selectedItems:()=>[{}],translateDOM:noop,document:{body:{}},syncLanguageButton:noop};
runInNewContext(renderSource+';render({preserveTimeline:true});',scope);assert.equal(rebuilt,0);assert.equal(selectedPaints,1);assert.equal(nodes.get('#copyClip').disabled,false);
runInNewContext('render();',scope);assert.equal(rebuilt,1,'edits/Undo keep the normal full render path');
console.log('Selection-only refresh retains timeline DOM while normal edits rebuild PASS');
