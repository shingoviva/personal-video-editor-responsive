import assert from 'node:assert/strict';
import {AudioPreview} from '../dist/audio-preview.js';
import {PlaybackSession} from '../dist/playback-session.js';
const voices=[];globalThis.document={createElement(){let resolve;const voice={dataset:{},paused:true,preload:'',pause(){this.paused=true},play(){this.calls=(this.calls||0)+1;return new Promise(r=>resolve=()=>{this.paused=false;r()})},complete(){resolve()},removeAttribute(){},load(){}};voices.push(voice);return voice}};
const audio=new AudioPreview(),voice=voices[0];voice.dataset.key='first';audio.startVoice(voice);audio.startVoice(voice);assert.equal(voice.calls,1,'one pending play per voice');audio.pause();voice.complete();await new Promise(r=>setTimeout(r,0));assert.equal(voice.paused,true,'late play completion cannot resume stopped voice');
const values=[];audio.context={currentTime:1};const param={cancelScheduledValues(){},setValueAtTime(v){values.push(v)}};audio.graphs.set(voice,{output:{gain:param},feedback:{gain:param},wet:{gain:param}});audio.stopVoice(voice);assert.deepEqual(values,[0,0,0],'pause mutes output and delay feedback');
const playback=new PlaybackSession(),old=playback.begin();playback.stop();const fresh=playback.begin();assert.equal(playback.current(old),false);assert.equal(playback.current(fresh),true);audio.context=null;audio.graphs=new WeakMap();audio.dispose();delete globalThis.document;
console.log('Audio pending-play cancellation, one play request, muted delay tails and stale playback sessions PASS');
