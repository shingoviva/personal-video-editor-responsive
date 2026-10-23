import assert from 'node:assert/strict';
import {audioAccents,accentPath,trackPatch,pathAt,drawFocus,materialSourceStamp,invalidateMaterialResults,compactTrackPath,motionAccents} from '../dist/material-fx.js?v=2.2.84';
import {regionZoomPose,normalizeRegionZoom} from '../dist/region-zoom.js?v=2.2.84';
import {project,sanitize} from '../dist/model.js?v=2.2.84';
import {addEffect} from '../dist/creative.js?v=2.2.84';
assert.deepEqual(audioAccents(Array(100).fill(0)),[]);assert.deepEqual(audioAccents(Array(100).fill(.1)),[]);
const energies=Array(200).fill(.01);for(const i of [25,75,125])energies[i]=.5;const accents=audioAccents(energies);assert.equal(accents.length,3);assert.equal(accents[0].time,.5);
const path=accentPath(accents,4,{strength:1});assert.equal(pathAt(path,0).scale,1);assert(pathAt(path,.57).scale>1);assert.equal(pathAt(path,.9).scale,1);
const bump=accentPath(accents,4,{bump:true,strength:1,direction:{x:1,y:0},motion:0}),shaky=accentPath(accents,4,{bump:true,strength:1,direction:{x:1,y:0},motion:.1});assert(pathAt(bump,.57).x>pathAt(shaky,.57).x);
const n=96,a=new Float32Array(n*n),b=new Float32Array(n*n);let seed=33;for(let y=25;y<65;y++)for(let x=25;x<65;x++){seed=(seed*1664525+1013904223)>>>0;a[y*n+x]=seed%240;b[(y+2)*n+x+3]=a[y*n+x]}
const tracked=trackPatch(a,b,n,{x:.5,y:.5},.3);assert(tracked.confidence>.5);assert(Math.abs(tracked.x-(.5+3/n))<1e-6);assert.equal(trackPatch(new Float32Array(n*n),b,n,{x:.5,y:.5},.3).confidence,0);
const p=project(),effect=addEffect(p,'camera-bump',0);effect.motionPath=bump;effect.duration=4;effect.strength=1;assert.equal(effect.type,'region-zoom');assert.equal(regionZoomPose(effect,.57).x,pathAt(bump,.57).x);assert.equal(regionZoomPose(effect,4).scale,1);assert.equal(sanitize(JSON.parse(JSON.stringify(p))).effects[0].motionKind,'camera-bump');
const track={type:'region-zoom',start:0,duration:4,zoomSize:.4,zoomX:.5,zoomY:.5,zoomIn:0,zoomReturn:false,trackPath:[{time:0,x:.3,y:.5},{time:4,x:.7,y:.5}]};assert(regionZoomPose(track,1).x>regionZoomPose(track,3).x);
let rectangles=0;const focus={...track,motionKind:'focus',strength:.5};assert.equal(regionZoomPose(focus,2).scale,1);drawFocus({save(){},restore(){},fillRect(){rectangles++}},[focus],2,100,100);assert.equal(rectangles,4);
const invalid=normalizeRegionZoom({...track,motionPath:[{time:-1,scale:999,x:999,y:999}]});assert.equal(invalid.motionPath[0].scale,1.2);assert.equal(invalid.motionPath[0].x,.03);
console.log('Material FX: audio onset rejection, restrained pulses, confidence tracking, bounds, persistence and focus PASS');

const source={id:'source',media:'m',in:0,out:2,start:0,speed:1,endSpeed:1,curve:'constant'},q=project();q.clips=[source];q.effects=[{type:'region-zoom',motionKind:'camera-bump',motionPath:bump,analysisInfo:'ready',analysisSource:{id:source.id,media:source.media,stamp:materialSourceStamp(source)}}];invalidateMaterialResults(q);assert.equal(q.effects[0].motionPath,bump);source.speed=2;invalidateMaterialResults(q);assert.equal(q.effects[0].motionPath,undefined);assert.equal(q.effects[0].analysisSource,undefined);assert.equal(normalizeRegionZoom(effect,{paths:false}).motionPath,effect.motionPath,'playback must not clone analysis paths');
console.log('Analysis is invalidated by source edits; playback reuses bounded paths PASS');

const longTrack=Array.from({length:241},(_,i)=>({time:i/8,x:.5+Math.sin(i/20)*.2,y:.5+Math.cos(i/25)*.1})),compact=compactTrackPath(longTrack);assert(compact.length<=80);assert.equal(compact[0],longTrack[0]);assert.equal(compact.at(-1),longTrack.at(-1));

assert.deepEqual(motionAccents(Array.from({length:20},(_,i)=>({time:i/8,value:.02}))),[]);const motionSamples=Array.from({length:20},(_,i)=>({time:i/8,value:i===8?.07:.01}));assert.equal(motionAccents(motionSamples).length,1);
