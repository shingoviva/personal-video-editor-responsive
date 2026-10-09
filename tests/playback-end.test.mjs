import assert from 'node:assert/strict';
import {AudioPreview} from '../dist/audio-preview.js';
import {advancePhoneClock} from '../dist/phone-playback-clock.js';
import {previewMediaEnded} from '../dist/playback-sync.js';
import {project,clip} from '../dist/model.js';
// HTMLMediaElement.play() restarts an ended non-looping element from zero.
const media=[];globalThis.document={createElement(){let at=0;const el={dataset:{},paused:true,readyState:2,seeking:false,ended:false,duration:2,calls:0,seeks:[],get currentTime(){return at},set currentTime(v){at=v;this.ended=false;this.seeks.push(v)},finish(){at=2;this.ended=true;this.paused=true},load(){},pause(){this.paused=true},play(){this.calls++;if(this.ended){at=0;this.ended=false}this.paused=false;return Promise.resolve()},removeAttribute(){}};media.push(el);return el}};
for(const continuous of [false,true]){
 const a=new AudioPreview();a.continuous=continuous;const p=project(),m={id:'media',kind:'video',audio:true,duration:2.05};p.media=[m];p.clips=[{...clip(m),id:'clip',start:0}];a.beginPlayback(p);a.sync(p,1.9,true,()=>'/audio.wav');await Promise.resolve();await Promise.resolve();await Promise.resolve();const voice=a.lanes[0].voices[a.lanes[0].active],calls=voice.calls;voice.finish();
 const endedSample=a.clock(1.99);
 for(let i=0;i<20;i++)a.sync(p,1.99+i*.002,true,()=>'/audio.wav');
 assert.equal(voice.calls,calls,`${continuous?'phone':'Mac'} must not restart ended source during duration mismatch`);assert.equal(endedSample?.ended,true,'decoder end must release the phone clock instead of pinning it');assert.equal(voice.currentTime,2);assert.equal(voice.muted,true);
 let t=1.99;for(let i=0;i<10;i++)t=advancePhoneClock(t,.016,{ended:true,time:2});assert(t>2.05,'clock crosses project end after decoder EOF');
 a.pause();a.beginPlayback(p);a.sync(p,0,true,()=>'/audio.wav');assert(voice.calls>calls,'explicit replay still works');a.dispose();
}
// End latch survives a decoder clearing ended during an unwanted seek.
const video={ended:false};assert.equal(previewMediaEnded(video,'clip-a'),false);video.ended=true;assert.equal(previewMediaEnded(video,'clip-a'),true);video.ended=false;assert.equal(previewMediaEnded(video,'clip-a'),true);assert.equal(previewMediaEnded(video,'clip-a',{reset:true}),false);video.ended=true;assert.equal(previewMediaEnded(video,'clip-b'),false,'new clip clears previous EOF');assert.equal(previewMediaEnded(video,'clip-b',{playing:false}),false);
// Intentional looping is the only path allowed to wrap a source.
const loopAudio=new AudioPreview(),lp=project(),lm={id:'loop',kind:'audio',audio:true,duration:2};lp.media=[lm];lp.audioClips=[{...clip(lm),id:'loop-clip',kind:'audio',start:0,out:6,layer:0,loop:true}];loopAudio.sync(lp,3,true,()=>'/loop.wav');const lv=loopAudio.lanes[3].voices[loopAudio.lanes[3].active];assert.equal(lv.loop,true);assert.equal(lv.currentTime,1);assert.equal(lv.paused,false);loopAudio.dispose();
delete globalThis.document;console.log('Non-looping media EOF, duration mismatch, no automatic rewind, clock completion and explicit replay PASS');
