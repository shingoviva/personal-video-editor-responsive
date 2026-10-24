import assert from 'node:assert/strict';
import {BrowserAudioOutput,calibrationPCM,measurePriming} from '../dist/browser-audio-output.js?v=2.2.85';
const reference=calibrationPCM();
for(const delay of [0,321,1024,2048,2112,4096,7200]){
 const decoded=new Float32Array(32000);decoded.set(reference.subarray(0,24000),delay);
 assert.equal(measurePriming(reference,decoded),delay);
}
assert.throws(()=>measurePriming(reference,new Float32Array(32000)),/確認できません/);
const changing=new Float32Array(32000);changing.set(reference.subarray(4544,5057),4544+100);changing.set(reference.subarray(9344,9857),9344+200);
assert.throws(()=>measurePriming(reference,changing),/一定ではありません/);
// A deliberately different encoder delay for every run. No fixed correction.
class Data{
 constructor(o){Object.assign(this,o)}copyTo(dst,{planeIndex}){dst.set(this.data.subarray(planeIndex*this.numberOfFrames,(planeIndex+1)*this.numberOfFrames))}close(){this.closed=true}
}
globalThis.AudioData=Data;
class Decoder{
 constructor(o){this.options=o;this.state='unconfigured'}configure(){this.state='configured'}decode(c){this.options.output(new Data({data:c.pcm,numberOfFrames:c.pcm.length,numberOfChannels:1,sampleRate:48000,timestamp:c.timestamp}))}close(){this.state='closed'}
}
globalThis.AudioDecoder=Decoder;
for(const delay of [0,321,2112,4096]){
 globalThis.AudioEncoder=class{
  constructor(o){this.options=o;this.state='unconfigured';this.encodeQueueSize=0;this.at=0;this.inputs=[]}
  configure(c){this.config=c;this.state='configured'}
  emit(data){const c={type:'key',timestamp:Math.round((this.at-(this.inputs.length>1?321:0))*1e6/48000),duration:Math.round(data.length*1e6/48000),byteLength:1,pcm:data,copyTo:d=>d.set([7])};this.at+=data.length;this.options.output(c,this.at===data.length?{decoderConfig:{codec:'mp4a.40.2',sampleRate:48000,numberOfChannels:2}}:{})}
  encode(s){this.inputs.push(s);if(this.inputs.length===1){const data=new Float32Array(24000+delay);data.set(s.data.subarray(0,24000),delay);this.emit(data)}else this.emit(s.data.subarray(0,s.numberOfFrames))}
  async flush(){this.emit(new Float32Array(1024))}close(){this.state='closed'}
 };
 const out=new BrowserAudioOutput({bitrate:192000,duration:.25}),packets=[];out.source={add:async(p,m)=>packets.push({p,m})};
 const data=new Float32Array(24000);data[0]=.7;data[11999]=-.6;data[12000]=.2;data[23999]=-.1;
 await out.add(new Data({data,numberOfFrames:12000,numberOfChannels:2,sampleRate:48000,timestamp:0}));
 await out.flush();assert.equal(out.priming,delay);assert.deepEqual(out.encoder.inputs[1].data,data);assert.equal(out.encoder.inputs[1].timestamp,500000);
 assert.equal(Math.round(packets[0].p.timestamp*48000),-24000-delay);
 assert.ok(Math.abs(packets.at(-1).p.timestamp+packets.at(-1).p.duration-.25)<1/48000);
 assert.equal(packets.filter(x=>x.p.timestamp>=.25).length,0);assert.ok(packets[0].m.decoderConfig);assert.equal(packets.length,2);assert.equal(packets[1].p.timestamp,0); // Ignore per-input timestamp resets; count coded samples.
 out.close();out.close();assert.equal(out.encoder.state,'closed');
}
const bad=new BrowserAudioOutput({bitrate:192000,duration:1});await assert.rejects(bad.flush(),/サンプル数/);bad.close();
const cancelled=new BrowserAudioOutput({bitrate:192000,duration:1,check:()=>{throw new DOMException('cancel','AbortError')}});await assert.rejects(cancelled.start(),{name:'AbortError'});cancelled.close();
console.log('Browser AAC: measured per-instance priming, varying delays, negative preroll, unchanged input, end padding, cancellation PASS');
