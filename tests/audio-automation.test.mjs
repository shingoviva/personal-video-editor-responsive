import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gainAt,gainAtCompiled,compileGainKeyframes,declickGain} from '../dist/mobile-model.js';
import {AudioPreview} from '../dist/audio-preview.js';
import {referenceGainAt,referenceSchedule} from './fixtures/audio-automation-reference.mjs';
let samples=0,maxError=0;
function same(actual,expected){samples++;if(Number.isFinite(actual)&&Number.isFinite(expected))maxError=Math.max(maxError,Math.abs(actual-expected));assert(Object.is(actual,expected),`${actual} !== ${expected}`)}
const configurations=[
 {},{gainKeyframes:[{time:1,value:.3}]},
 {gainKeyframes:[{time:3,value:1},{time:0,value:0},{time:3,value:.2},{time:8,value:2}]},
 {gainKeyframes:[{time:0,value:1},{time:0,value:0},{time:8,value:1},{time:8,value:2}]},
 {gainKeyframes:[{time:-2,value:3},{time:'2',value:'.2'},{time:NaN,value:1},{time:4,value:Infinity}]},
 {gainKeyframes:null},
 {gainKeyframes:[{time:1,value:0},{time:1.0000001,value:2},{time:4,value:.5}],fadeIn:.2,fadeOut:.3},
 {gainEnvelope:[{time:0,valueDb:-96,interpolation:'hold'},{time:2,valueDb:12,interpolation:'linear'},{time:8,valueDb:-6}]},
 {gainEnvelope:{points:[{time:0,valueDb:-12,interpolation:'hold'},{time:.004,valueDb:0},{time:8,valueDb:-96}]}},
 {volume:0,fadeIn:3,fadeOut:6}, {volume:-1}, {volume:1.5,fadeIn:8,fadeOut:8}
];
const boundaries=[-1,0,1e-9,.002,.004,.008,.2,1,1.00000005,1.0000001,1.995,1.9975,2,3,4,7.7,7.999999,8,9,NaN,Infinity];
let seed=92751;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let j=0;j<80;j++)configurations.push({volume:random()*2,fadeIn:random(),fadeOut:random(),gainKeyframes:Array.from({length:j%33},()=>({time:Math.floor(random()*80)/10,value:random()*3-.5})),gainEnvelope:[{time:0,valueDb:-60*random(),interpolation:j%2?'hold':'linear'},{time:4,valueDb:12*random()},{time:8,valueDb:-96*random()}]});
for(const audio of configurations){const {volume=1,fadeIn=0,fadeOut=0,gainKeyframes=[],gainEnvelope=[]}=audio,points=compileGainKeyframes(gainKeyframes);for(const t of [...boundaries,...Array.from({length:1000},()=>random()*10-1)]){const expected=referenceGainAt(t,8,volume,fadeIn,fadeOut,gainKeyframes,gainEnvelope);same(gainAt(t,8,volume,fadeIn,fadeOut,gainKeyframes,gainEnvelope),expected);same(gainAtCompiled(t,8,volume,fadeIn,fadeOut,points,gainEnvelope),expected)}}
// Degenerate/very short clip lengths and fade overlap keep the same boundary arithmetic.
for(const duration of [0,.001,.008,.015,1,8])for(const audio of configurations.slice(0,12))for(const t of [-.001,0,duration/2,duration,duration+.001]){const {volume=1,fadeIn=0,fadeOut=0,gainKeyframes=[],gainEnvelope=[]}=audio;const expected=referenceGainAt(t,duration,volume,fadeIn,fadeOut,gainKeyframes,gainEnvelope);same(gainAtCompiled(t,duration,volume,fadeIn,fadeOut,compileGainKeyframes(gainKeyframes),gainEnvelope),expected);same(gainAt(t,duration,volume,fadeIn,fadeOut,gainKeyframes,gainEnvelope),expected)}
const makeGraph=()=>({output:{gain:{events:[],cancelScheduledValues(t){this.events.push(['cancel',t])},setValueAtTime(v,t){this.events.push(['value',v,t])},setValueCurveAtTime(curve,t,span){this.events.push(['curve',new Float32Array(curve),t,span])}}}});
const context={currentTime:2},oldGraph=makeGraph(),newGraph=makeGraph(),receiver={context};let curves=0;
function schedule(audio,local,playing=true,duration=8,trackVolume=.7){const c={audio:{volume:1,fadeIn:0,fadeOut:0,...audio}};referenceSchedule.call(receiver,oldGraph,c,local,duration,trackVolume,playing);AudioPreview.prototype.scheduleGain.call(receiver,newGraph,c,local,duration,trackVolume,playing);assert.deepEqual(newGraph.output.gain.events,oldGraph.output.gain.events);assert.equal(newGraph.until,oldGraph.until);}
// Forward, skipped scheduler ticks, reverse seek, end, paused/resume and lane gains.
for(const audio of configurations.slice(0,12))for(const local of [0,.001,.2,2,1.9975,7.999,8,8.1,4]){context.currentTime+=.16;schedule(audio,local);curves++}
context.currentTime+=.01;schedule({},4.01);schedule({},4.01,false);context.currentTime+=.2;schedule({},4.01,true);
for(const trackVolume of [0,.15,.7,1,2]){context.currentTime+=.2;schedule(configurations[7],2,true,8,trackVolume)}
// Same object in-place edits, Undo/Redo snapshots, replacement and project load.
const editable={volume:1,fadeIn:.1,fadeOut:.1,gainKeyframes:[{time:0,value:.2},{time:8,value:1}],gainEnvelope:[{time:0,valueDb:0},{time:8,valueDb:-12}]};
const saved=structuredClone(editable);schedule(editable,1);editable.gainKeyframes[0].value=.9;schedule(editable,1);editable.gainEnvelope[0].valueDb=-24;schedule(editable,1);schedule(saved,1);schedule(editable,1);schedule(JSON.parse(JSON.stringify(saved)),1,true,5);schedule({...saved,volume:.25},1);
// Compilation happens once per generated curve, never per sample or skipped tick.
let filters=0;const keys=[{time:0,value:.5},{time:8,value:1}];keys.filter=function(...args){filters++;return Array.prototype.filter.apply(this,args)};
const g=makeGraph(),c={audio:{volume:1,fadeIn:0,fadeOut:0,gainKeyframes:keys}};context.currentTime=100;AudioPreview.prototype.scheduleGain.call(receiver,g,c,1,8,1,true);assert.equal(filters,1);const curve=g.output.gain.events.at(-1)[1];assert.equal(curve.length,7200);context.currentTime+=.01;AudioPreview.prototype.scheduleGain.call(receiver,g,c,1.01,8,1,true);assert.equal(filters,1);c.audio.gainKeyframes[0].value=0;AudioPreview.prototype.scheduleGain.call(receiver,g,c,1.01,8,1,true);assert.equal(filters,2);
assert.equal(maxError,0);console.log(JSON.stringify({result:'PASS',doubleComparisons:samples,maxAbsoluteError:maxError,float32CurvesCompared:curves,curveSamples:7200,compilationsPerCurve:1,semantics:'duplicates, clamps, fades, hold, seek, pause/resume, lane gains, edits and Undo/import snapshots'}));

// A cached pre-compile mobile-model module must not satisfy a new release import.
const version=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).version;
for(const name of ['audio-preview.js','mobile-render-worker.js','material-fx-worker.js'])assert(fs.readFileSync(new URL('../dist/'+name,import.meta.url),'utf8').includes("from './mobile-model.js?v="+version+"'"),'Versioned gain module dependency: '+name);
