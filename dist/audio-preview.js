import {silenceOutput,openOutput,createDelayEffect,resetDelayEffect} from './audio-preview-output.js';
import {waitForMedia,seekMedia} from './media-state.js';
import {audioWindows,trackGain} from './audio-timeline.js';
import {sourceTime,gainAt,held,declickGain} from './mobile-model.js';
import {sequence,timing,outputOffset} from './model.js';
const mediaVoice=()=>{const value=document.createElement('audio');value.preload='auto';value.preservesPitch=false;value.muted=true;return value};
export const previewDriftTolerance=playing=>playing?.32:.035;
const keyFor=(row,url)=>row&&url?`${row.clip.id}|${url}`:'';
const groupRows=(rows,count)=>{const grouped=Array.from({length:count},()=>[]);for(const row of rows)grouped[row.layer||0]?.push(row);return grouped};
const currentRow=(rows,t)=>{for(let i=rows.length-1;i>=0;i--){const row=rows[i];if(row.start<=t&&t<row.end)return row}return null};
const nextRow=(rows,t)=>{for(const row of rows)if(row.start>t&&row.start-t<1.5)return row;return null};

// Two voices per lane predecode clip boundaries. Web Audio adds a filtered
// feedback delay without replacing the media element playback clock.
export class AudioPreview{
 constructor(){this.continuous=false;this.context=null;this.master=null;this.suspending=null;this.pauseGeneration=0;this.graphs=new WeakMap();this.videoKey=null;this.videoByLayer=Array.from({length:3},()=>[]);this.lanes=Array.from({length:7},()=>({voices:[mediaVoice(),mediaVoice()],active:0}));this.voices=this.lanes.flatMap(lane=>lane.voices)}
 async unlock(){const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;const generation=this.pauseGeneration;try{if(this.suspending)await this.suspending;if(generation!==this.pauseGeneration)return;if(!this.context||this.context.state==='closed'){this.context=new Context({latencyHint:'interactive'});this.master=null}if(this.context.state!=='running')await this.context.resume();if(generation!==this.pauseGeneration)this.suspendContext()}catch{}}
 suspendContext(){if(!this.context?.suspend||this.context.state!=='running'||this.suspending)return;let pending;try{pending=Promise.resolve(this.context.suspend()).catch(()=>{}).finally(()=>{if(this.suspending===pending)this.suspending=null});this.suspending=pending}catch{}}
 setOutputEnabled(enabled){if(!this.master||this.outputEnabled===enabled)return;this.outputEnabled=enabled;this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setValueAtTime(enabled?1:0,this.context.currentTime)}

 graph(voice){
 const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return null;
 try{
 if(!this.context)this.context=new Context({latencyHint:'interactive'});
 let graph=this.graphs.get(voice);if(graph)return graph;
 const source=this.context.createMediaElementSource(voice),dry=this.context.createGain(),output=this.context.createGain(),gate=this.context.createGain();
 output.gain.value=0;gate.gain.value=0;
 if(!this.master){this.master=this.context.createGain();this.master.gain.value=0;this.outputEnabled=false;this.master.connect(this.context.destination)}
 source.connect(dry).connect(output);output.connect(gate).connect(this.master);
 graph={source,dry,output,gate,...createDelayEffect(this.context,source,output)};this.graphs.set(voice,graph);return graph;
 }catch{return null}
 }

 configure(voice,audio,playing){const enabled=!!audio?.delayEnabled,graph=this.graphs.get(voice)||this.graph(voice);if(!graph)return null;if(graph.resetEffect){resetDelayEffect(this.context,graph);graph.resetEffect=false}graph.effectEnabled=enabled;const mix=enabled?audio.delayMix??.25:0,now=this.context.currentTime;graph.delay.delayTime.setTargetAtTime(audio?.delayTime??.28,now,.01);graph.feedback.gain.setTargetAtTime(enabled?audio?.delayFeedback??.35:0,now,.01);graph.wet.gain.setTargetAtTime(mix,now,.01);graph.dry.gain.setTargetAtTime(1-mix*.25,now,.01);if(playing&&this.context.state!=='running')this.context.resume().catch(()=>{});return graph}
 stopVoice(voice){voice.muted=true;voice._wanted=false;voice._alignedKey=null;voice._alignmentKey=null;voice._alignmentSeeked=false;voice._clockRow=null;voice._playGeneration=(voice._playGeneration||0)+1;voice.pause();const graph=this.graphs.get(voice);if(graph){const now=this.context.currentTime;if(graph.gate)silenceOutput(graph.gate.gain,now);graph.resetEffect ||= !!graph.effectEnabled;silenceOutput(graph.output.gain,now);silenceOutput(graph.feedback.gain,now);silenceOutput(graph.wet.gain,now);graph.gainKey=null}}
 startVoice(voice){
 if(!voice.loop&&(voice.ended||voice._endedKey===voice.dataset.key)){this.stopVoice(voice);return}
 voice.muted=false;voice._wanted=true;if(voice._playPending||!voice.paused)return;
 const generation=voice._playGeneration||0,key=voice.dataset.key;let pending;
 try{pending=Promise.resolve(voice.play())}catch{return}
 voice._playPending=pending;
 pending.then(()=>{
 if(!voice._wanted||generation!==(voice._playGeneration||0)||key!==voice.dataset.key){voice.pause();return}
 const graph=this.graphs.get(voice);if(graph?.gate)openOutput(graph.gate.gain,this.context.currentTime);
 }).catch(()=>{}).finally(()=>{if(voice._playPending===pending)voice._playPending=null});
 }

 prepare(lane,row,p,urlOf){const c=row?.clip,m=p.media.find(item=>item.id===c?.media),url=m&&urlOf(m),key=keyFor(row,url);if(!key)return null;let index=lane.voices.findIndex(voice=>voice.dataset.key===key);if(index<0){index=1-lane.active;const voice=lane.voices[index];this.stopVoice(voice);voice._endedKey=null;voice._endedRow=null;voice.dataset.key=key;voice.dataset.url=url;voice.src=url;voice.load()}return index}

 alignVoice(voice,source,media){
 voice._alignedKey=voice.dataset.key;voice._alignmentKey=voice.dataset.key;voice._alignmentSeeked=true;
 voice._loopCycle=Math.floor(source/Math.max(.001,media.duration));voice._lastSource=voice.currentTime;
 }
 syncLane(lane,row,p,t,playing,urlOf,gain,loop=false){
 const c=row?.clip,m=p.media.find(item=>item.id===c?.media),url=m&&urlOf(m);
 if(!row||!url||!m?.audio||c.audio?.mute||!gain||held(row,t)){lane.voices.forEach(voice=>this.stopVoice(voice));return}
 const index=this.prepare(lane,row,p,urlOf);
 if(index!==lane.active){this.stopVoice(lane.voices[lane.active]);lane.active=index}
 const voice=lane.voices[index];
 if(playing&&!loop&&((voice.ended&&voice._alignedKey===voice.dataset.key)||voice._endedKey===voice.dataset.key)){
 voice._endedKey=voice.dataset.key;voice._endedRow=row;this.stopVoice(voice);return;
 }
 const source=sourceTime(row,t),local=t-row.start+(row.offset||0),tm=(row._timing??=timing(c)),i=tm.nodes.findIndex(node=>node[1]>=local),speed=tm.pieces[Math.max(0,i-1)]?.[2]||1,at=loop?source%m.duration:source;
 const graph=this.configure(voice,c.audio,playing);
 voice.loop=loop;
 if(graph){voice.volume=1;this.scheduleGain(graph,c,local,tm.duration,gain,playing)}
 else voice.volume=Math.min(1,gain*gainAt(local,tm.duration,c.audio.volume,c.audio.fadeIn,c.audio.fadeOut,c.audio.gainKeyframes,c.audio.gainEnvelope)*declickGain(local,tm.duration));
 voice._clockRow=row;voice._clockMedia=m;
 if(!playing){if(voice.readyState>=1&&!voice.seeking)try{voice.currentTime=at}catch{}this.stopVoice(voice);return}
 if(voice._alignedKey!==voice.dataset.key){
 if(voice._alignmentKey!==voice.dataset.key){voice._alignmentKey=voice.dataset.key;voice._alignmentTarget=at;voice._alignmentSeeked=false}
 if(voice.readyState>=1&&!voice.seeking&&!voice._alignmentSeeked){
 voice._alignmentSeeked=true;
 if(Math.abs(voice.currentTime-voice._alignmentTarget)>.00001)try{voice.currentTime=voice._alignmentTarget}catch{voice._alignmentSeeked=false}
 }
 if(voice.readyState>=2&&!voice.seeking&&voice._alignmentSeeked)this.alignVoice(voice,source,m);
 }else if(voice.readyState>=2&&!voice.seeking&&!this.continuous&&voice._wanted&&!voice.paused&&Math.abs(voice.currentTime-at)>previewDriftTolerance(playing)){
 try{voice.currentTime=at}catch{}
 }
 if(speed>=.25&&speed<=4&&!c.freezeDuration){
 voice.playbackRate=speed;
 if(voice.readyState>=2&&!voice.seeking&&voice._alignedKey===voice.dataset.key)this.startVoice(voice);
 }else this.stopVoice(voice);
 }

 scheduleGain(graph,c,local,duration,trackVolume,playing){const now=this.context.currentTime,key=JSON.stringify([c.audio,trackVolume,duration]);if(!playing||graph.gainKey!==key||Math.abs(local-(graph.local+(now-graph.clock)))>.03||now>=graph.until-.04){const param=graph.output.gain;param.cancelScheduledValues(now);const span=playing?Math.min(.15,Math.max(.001,duration-local)):.001,count=Math.max(2,Math.ceil(span*48000)),curve=new Float32Array(count);for(let i=0;i<count;i++){const at=local+span*i/(count-1);curve[i]=trackVolume*gainAt(at,duration,c.audio.volume,c.audio.fadeIn,c.audio.fadeOut,c.audio.gainKeyframes,c.audio.gainEnvelope)*declickGain(at,duration)}if(playing)param.setValueCurveAtTime(curve,now,span);else param.setValueAtTime(curve[0],now);graph.gainKey=key;graph.local=local;graph.clock=now;graph.until=now+span}}
 primeNext(lane,rows,p,t,urlOf){const next=nextRow(rows,t);if(next)this.prepare(lane,next,p,urlOf)}
 // Structural edits pause playback first; never reuse windows after pause/export.
 beginPlayback(p){this.playbackProject=p;this.playbackAudio=groupRows(audioWindows(p),4);this.playbackVideo=groupRows(sequence(p).filter(value=>!value.clip.gap),3)}
 async preparePlayback(p,t,urlOf){
 this.prepareController?.abort();const controller=new AbortController();this.prepareController=controller;const signal=controller.signal;
 const groups=[...this.playbackVideo,...this.playbackAudio],solo=p.audioTracks?.some(track=>track.solo);
 try{await Promise.all(groups.map(async(rows,i)=>{const row=currentRow(rows,t),c=row?.clip,m=p.media.find(item=>item.id===c?.media),url=m&&urlOf(m),gain=i<3?(solo||p.videoTracks?.[i]?.hidden?0:p.videoTracks?.[i]?.volume??1):trackGain(p,i-3);if(!row||!url||!m.audio||c.audio?.mute||!gain||held(row,t))return;
 const lane=this.lanes[i],index=this.prepare(lane,row,p,urlOf),voice=lane.voices[index],key=voice.dataset.key;this.stopVoice(lane.voices[lane.active]);lane.active=index;voice._endedKey=null;voice._endedRow=null;voice.loop=!!c.loop;const source=sourceTime(row,t),at=c.loop?source%m.duration:source;
 await waitForMedia(voice,'loadedmetadata',{signal,timeout:8000,ready:()=>voice.readyState>=1});if(signal.aborted||voice.dataset.key!==key)return;
 if(!c.loop&&Number.isFinite(voice.duration)&&at>=voice.duration){voice._endedKey=key;voice._endedRow=row;return}
 await seekMedia(voice,at,{signal,timeout:8000});await waitForMedia(voice,'loadeddata',{signal,timeout:8000,ready:()=>voice.readyState>=2&&!voice.seeking});if(signal.aborted||voice.dataset.key!==key)return;
 this.alignVoice(voice,source,m);
 }));}catch(error){controller.abort();throw error}finally{if(this.prepareController===controller)this.prepareController=null}
 }
 sync(p,t,playing,urlOf){if(!playing){this.pause();return}const cached=playing&&this.playbackProject===p,audioByLayer=cached?this.playbackAudio:groupRows(audioWindows(p),4);for(let layer=0;layer<4;layer++){const rows=audioByLayer[layer],row=currentRow(rows,t);this.syncLane(this.lanes[3+layer],row,p,t,playing,urlOf,trackGain(p,layer),!!row?.clip.loop);this.primeNext(this.lanes[3+layer],rows,p,t,urlOf)}const solo=!!p.audioTracks?.some(track=>track.solo),videoKey=cached?this.videoKey:p.clips.map(c=>[c.id,c.start,c.layer,c.in,c.out,c.speed,c.endSpeed,c.curve,c.hold].join(':')).join('|');if(videoKey!==this.videoKey){this.videoKey=videoKey;this.videoByLayer=groupRows(sequence(p).filter(value=>!value.clip.gap),3)}for(let layer=0;layer<3;layer++){const rows=(cached?this.playbackVideo:this.videoByLayer)[layer],row=currentRow(rows,t),track=p.videoTracks?.[layer]||{};this.syncLane(this.lanes[layer],row,p,t,playing,urlOf,solo||track.hidden?0:Math.max(0,Math.min(2,track.volume??1)));this.primeNext(this.lanes[layer],rows,p,t,urlOf)}this.setOutputEnabled(true)}
 clock(t){let terminal=null;for(const lane of this.lanes){const voice=lane.voices[lane.active],row=voice._clockRow||voice._endedRow;if(!row||t<row.start||t>=row.end-.00001)continue;if(!row.clip.loop&&(voice.ended||voice._endedKey===voice.dataset.key)){terminal={ended:true,time:t};continue}if(!voice._wanted||voice.readyState<2||voice.seeking||voice._alignedKey!==voice.dataset.key)return{waiting:true};const m=voice._clockMedia,c=row.clip;if(c.loop&&voice.currentTime<(voice._lastSource||0)-.5)voice._loopCycle=(voice._loopCycle||0)+1;voice._lastSource=voice.currentTime;const source=voice.currentTime+(c.loop?(voice._loopCycle||0)*m.duration:0),at=row.start+outputOffset(Math.max(0,source-c.in),c)-(row.offset||0);return{time:Math.min(row.end,at),waiting:voice.paused&&!voice.ended}}return terminal}

 pause(){this.prepareController?.abort();this.prepareController=null;this.pauseGeneration++;this.setOutputEnabled(false);this.playbackProject=null;this.playbackAudio=this.playbackVideo=null;this.voices.forEach(voice=>{this.stopVoice(voice);voice._endedKey=null;voice._endedRow=null});this.suspendContext()}
 dispose(){this.pause();this.voices.forEach(voice=>{voice.pause();voice.removeAttribute('src');voice.load();delete voice.dataset.key;delete voice.dataset.url});this.context?.close?.();this.context=null;this.master=null;this.suspending=null;this.graphs=new WeakMap();this.videoKey=null;this.lanes=Array.from({length:7},()=>({voices:[mediaVoice(),mediaVoice()],active:0}));this.voices=this.lanes.flatMap(lane=>lane.voices)}
}
