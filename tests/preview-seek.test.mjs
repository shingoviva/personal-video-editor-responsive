import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createPreviewSeek} from '../dist/preview-seek.js';
let playing=true,at=0,starts=0,errors=0,stops=0,pending=[];
const s=createPreviewSeek({isPlaying:()=>playing,stop:()=>{playing=false;stops++},position:t=>{at=t},prepare:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),ready(){},start:async()=>{starts++;playing=true;s.cancel()},error(){errors++}});
const a=s.seek(1),b=s.seek(2);assert.equal(at,2);assert(s.resuming);pending[0].reject(new Error('old seek aborted'));await a;assert.equal(starts,0);pending[1].resolve();await b;assert.equal(starts,1);assert(playing);
const c=s.seek(3);s.cancel();playing=false;pending[2].resolve();await c;assert.equal(starts,1,'explicit stop suppresses pending automatic resume');
const d=s.seek(4);pending[3].resolve();await d;assert.equal(starts,1,'paused seeking remains paused');
playing=true;const e=s.seek(5);pending[4].reject(new Error('decode failed'));await e;assert.equal(errors,1);assert(!s.resuming);
playing=true;const f=s.seek(6),g=s.seek(7);pending[6].resolve();await g;pending[5].resolve();await f;assert.equal(at,7);assert.equal(starts,2,'late success cannot revive an old position');
playing=false;const h=s.seek(8);s.cancel();playing=true;pending[7].reject(new Error('aborted by new play'));await h;assert.equal(errors,1,'explicit play invalidates an old paused seek failure');assert(playing);
assert.equal(stops,8);console.log('Latest-seek resume: rapid scrub, stale success/error, manual stop/start, paused seek and current failure PASS');

// Closing save/load/export dialogs restores the preview without scrub-local state.
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),line=app.split('\n').find(line=>line.startsWith("$('#modal').addEventListener('close'"));let close,restored=0,painted=0;
const ctx={$:()=>({addEventListener(type,handler){close=handler}}),stopDialogMedia(){},busy:false,audioPreview:{unlock(){}},syncVideo:()=>{restored++;return Promise.resolve()},draw:()=>painted++};vm.createContext(ctx);vm.runInContext(line,ctx);close();await Promise.resolve();assert.equal(restored,1);assert.equal(painted,1);

playing=false;const forced=s.seek(9,{resume:true});pending[8].resolve();await forced;assert.equal(starts,3,'FX preview requests one guarded start, not seek then toggle');
const button={},fxContext={$:()=>button,selectedRegionZoom:()=>({start:2}),seek:(at,options)=>{assert.equal(at,2);assert.equal(options.resume,true)}};vm.createContext(fxContext);vm.runInContext(app.split('\n').find(line=>line.trim().startsWith("if($('#previewRegionZoom'))")),fxContext);button.onclick();
