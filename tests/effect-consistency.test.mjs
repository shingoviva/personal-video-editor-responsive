import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {orderedEffects} from '../dist/effect-order.js?v=2.2.85';
import {materialSourceStamp,materialEffectStamp,invalidateMaterialResults} from '../dist/material-fx.js?v=2.2.85';
import {bindOverlayTimeline} from '../dist/overlay-timeline.js?v=2.2.85';
import {regionZoomTransform} from '../dist/region-zoom.js?v=2.2.85';
const high={id:'high',layer:2},low={id:'low',layer:0},mid={id:'mid',layer:1};
for(const input of [[high,low,mid],[low,mid,high]])assert.deepEqual(orderedEffects(input).map(e=>e.id),['low','mid','high']);
assert.deepEqual(orderedEffects([{id:'zoom',type:'region-zoom',layer:0},{id:'focus',type:'region-zoom',motionKind:'focus',layer:0},{id:'color',type:'flash',layer:2}]).map(e=>e.id),['color','focus','zoom']);
const input=[high,low];orderedEffects(input);assert.deepEqual(input,[high,low]);assert.deepEqual(orderedEffects([{id:'a'},{id:'b'}]).map(e=>e.id),['a','b']);
const zoom=layer=>({type:'region-zoom',start:0,duration:4,layer,zoomSize:.5,zoomX:layer?.7:.3,zoomY:.5,zoomIn:0,zoomReturn:false});
assert.deepEqual(regionZoomTransform([zoom(2),zoom(0)],1),regionZoomTransform([zoom(0),zoom(2)],1));
const source={id:'source',media:'m',in:0,out:10,start:0,speed:1,endSpeed:1,curve:'constant'};
const effect={id:'fx',type:'region-zoom',motionKind:'audio-pulse',start:1,duration:2,motionPath:[{time:0,scale:1},{time:.5,scale:1.1}],analysisSource:{id:source.id,media:source.media,stamp:materialSourceStamp(source)}};
const p={clips:[source],audioClips:[],effects:[effect]};invalidateMaterialResults(p);assert.equal(effect.analysisSource.effectStamp,materialEffectStamp(effect));
const original=structuredClone(p),el={dataset:{fx:'fx'},style:{},classList:{add(){},remove(){}},setPointerCapture(){}};
bindOverlayTimeline({root:{getBoundingClientRect:()=>({width:1000}),querySelectorAll:()=>[el]},effects:p.effects,duration:10,targets:()=>[],snap:()=>false,select(){},begin(){invalidateMaterialResults(p)},finish(){invalidateMaterialResults(p)},cancel(){},preview(){}});
const event=(x,edge)=>({button:0,pointerId:1,clientX:x,clientY:10,target:{closest:()=>edge?{dataset:{overlayEdge:edge}}:null}});
el.onpointerdown(event(100));el.onpointermove(event(300));el.onpointerup(event(300));assert.equal(effect.start,3);assert.equal(effect.motionPath,undefined);assert.equal(effect.analysisSource,undefined);
for(const key of ['start','duration','zoomX','zoomY','zoomSize']){const q=structuredClone(original);q.effects[0][key]=(q.effects[0][key]||0)+.1;invalidateMaterialResults(q);assert.equal(q.effects[0].motionPath,undefined,key)}
for(const key of ['strength','layer','zoomReturn','zoomTexts']){const q=structuredClone(original);q.effects[0][key]=key==='strength'?.8:key==='layer'?2:false;invalidateMaterialResults(q);assert(q.effects[0].motionPath,'Appearance-only change preserves analysis: '+key)}
const undo=structuredClone(original);invalidateMaterialResults(undo);assert(undo.effects[0].motionPath,'Undo retains valid stored analysis');
const bg={clips:[],audioClips:[],bgm:{media:'music'},effects:[{...structuredClone(original.effects[0]),analysisSource:{id:null,media:'music'}}]};invalidateMaterialResults(bg);bg.effects[0].start++;invalidateMaterialResults(bg);assert.equal(bg.effects[0].motionPath,undefined);
// Use actual save/checkpoint wiring: gestures and inspector share validation.
const app=fs.readFileSync(new URL('../dist/app.js?v=2.2.85',import.meta.url),'utf8');assert.match(app,/function checkpoint\(\)\{invalidateMaterialResults\(P\)/);assert.match(app,/function save\(\)\{invalidateMaterialResults\(P\)/);
assert.match(app,/const visibleFx=orderedEffects\(/);const worker=fs.readFileSync(new URL('../dist/mobile-render-worker.js?v=2.2.85',import.meta.url),'utf8');assert.match(worker,/effects=orderedEffects\(/);
console.log('FX consistency: layer order, stable same-layer order, composition, legacy analysis, real timeline move, timing/geometry invalidation, appearance preservation, BGM and Undo PASS');
const actual={P:structuredClone(original),history:[],future:[],busy:false,saveTimer:null,invalidateMaterialResults,serial(){return JSON.stringify(actual.P)},mediaResourceCache:{remember(){},prune(){}},clearTimeout(){},setTimeout(){return 1},$:()=>({textContent:''})};
vm.createContext(actual);
for(const name of ['checkpoint','save']){const start=app.indexOf('function '+name+'('),end=app.indexOf('\nfunction ',start+10);vm.runInContext(app.slice(start,end),actual)}
actual.checkpoint();actual.P.effects[0].duration+=1;actual.save();assert.equal(actual.P.effects[0].motionPath,undefined,'Actual autosave entry validates drag/trim edits');
actual.P=JSON.parse(actual.history.pop());invalidateMaterialResults(actual.P);assert(actual.P.effects[0].motionPath,'The actual checkpoint preserves analyzed data for Undo');
console.log('Actual checkpoint/save: trim invalidation and valid Undo snapshot PASS');

const aspectChange=structuredClone(original);aspectChange.aspect='9:16';invalidateMaterialResults(aspectChange);assert.equal(aspectChange.effects[0].motionPath,undefined,'Changing the picture aspect invalidates tracking coordinates');
