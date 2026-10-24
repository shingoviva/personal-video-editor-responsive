import {aacDecoderConfig} from './webkit-export-compat.js?v=2.2.85';
import {EncodedAudioPacketSource,EncodedPacket} from './vendor/mediabunny.mjs?v=2.2.85';

// AAC/WebCodecs does not expose encoder priming. Measure this encoder instance
// with disposable PCM preroll, then express it as negative MP4 packet time.
const RATE=48000,CHANNELS=2,PREFIX=24000,HALF=256;
export function calibrationPCM(){
 const data=new Float32Array(PREFIX*CHANNELS);let seed=1234567;
 for(const center of [4800,9600]){
  const noise=new Float32Array(2*HALF+5);
  for(let j=0;j<noise.length;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise[j]=(seed/4294967296*2-1)*.3}
  // Band-limited signed code remains identifiable at the supported 96kbps floor.
  for(let j=0;j<=2*HALF;j++){
   const value=(noise[j]+4*noise[j+1]+6*noise[j+2]+4*noise[j+3]+noise[j+4])/16;
   for(let ch=0;ch<CHANNELS;ch++)data[ch*PREFIX+center-HALF+j]=value;
  }
 }
 return data;
}
export function measurePriming(reference,decoded){
 const lags=[];
 for(const center of [4800,9600]){
  let best=-Infinity,at=0;const a=center-HALF,n=2*HALF+1;
  let rr=0;for(let j=0;j<n;j++)rr+=reference[a+j]**2;
  for(let lag=0;lag<=7200&&a+lag+n<=decoded.length;lag++){
   let xy=0,yy=0;for(let j=0;j<n;j++){const y=decoded[a+lag+j];xy+=reference[a+j]*y;yy+=y*y}
   const correlation=xy/Math.sqrt(rr*yy||1);if(correlation>best){best=correlation;at=lag}
  }
  if(best<.9)throw Error('AACエンコーダーの開始遅延を確認できません。');lags.push(at);
 }
 if(lags[0]!==lags[1])throw Error('AACエンコーダーの遅延が一定ではありません。');
 return lags[0];
}
export class BrowserAudioOutput{
 constructor({bitrate,duration,check=()=>{}}){
  this.source=new EncodedAudioPacketSource('aac');this.duration=duration;this.check=check;this.prerollFrames=PREFIX;
  this.packets=[];this.error=null;this.started=false;this.closed=false;this.inputFrames=0;this.encodedFrames=0;this.packetCount=0;
  this.encoder=new AudioEncoder({output:(chunk,meta)=>{try{
   if(!Number.isFinite(chunk.timestamp)||!Number.isFinite(chunk.duration)||chunk.duration<=0)throw Error('AACパケットの時刻を確認できません。');
   if(meta?.decoderConfig)meta={...meta,decoderConfig:aacDecoderConfig(meta.decoderConfig)};
   const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);
   // Contiguous input is enforced below. AAC packet durations, rather than
   // WebKit's per-input-buffer timestamp resets, define the coded sample clock.
   const frames=Math.round(chunk.duration*RATE/1e6),frame=this.encodedFrames;
   if(frames<=0)throw Error('AACパケットのサンプル数が不正です。');
   this.encodedFrames+=frames;
   this.packets.push({data,type:chunk.type,frame,frames,meta});
   if(this.decoder?.state==='configured')this.decoder.decode(chunk);
   else if(!this.started&&meta?.decoderConfig){this.decoder.configure(meta.decoderConfig);this.decoder.decode(chunk)}
  }catch(e){this.error=e}},error:e=>{this.error=e}});
  try{this.encoder.configure({codec:'mp4a.40.2',sampleRate:RATE,numberOfChannels:CHANNELS,bitrate,aac:{format:'aac'}})}catch(e){this.close();throw e}
 }
 async waitFor(predicate){
  const until=performance.now()+10000;
  while(!predicate()){this.check();if(this.error)throw this.error;if(performance.now()>until)throw Error('AACエンコーダーの応答を確認できません。');await new Promise(r=>setTimeout(r,5))}
  this.check();if(this.error)throw this.error;
 }
 async start(){
  const reference=calibrationPCM(),decoded=new Float32Array(PREFIX+8192);let frames=0;
  this.decoder=new AudioDecoder({output:sample=>{try{
   const plane=new Float32Array(sample.numberOfFrames);sample.copyTo(plane,{planeIndex:0,format:'f32-planar'});
   const offset=Math.round(sample.timestamp*RATE/1e6);if(offset>=0&&offset+plane.length<=decoded.length){decoded.set(plane,offset);frames=Math.max(frames,offset+plane.length)}
  }catch(e){this.error=e}finally{sample.close()}},error:e=>{this.error=e}});
  const sample=new AudioData({data:reference,format:'f32-planar',numberOfChannels:CHANNELS,sampleRate:RATE,numberOfFrames:PREFIX,timestamp:0});
  try{this.encoder.encode(sample)}finally{sample.close()}
  await this.waitFor(()=>frames>=19000);
  this.priming=measurePriming(reference,decoded);this.started=true;
  this.decoder.close();this.decoder=null;
  await this.drain();
 }
 async drain(){
  if(this.error)throw this.error;
  while(this.packets.length){
   this.check();if(this.error)throw this.error;const chunk=this.packets.shift();
   const timestamp=(chunk.frame-PREFIX-this.priming)/RATE;
   const duration=Math.min(chunk.frames/RATE,this.duration-timestamp);
   if(duration>0){await this.source.add(new EncodedPacket(chunk.data,chunk.type,timestamp,duration),chunk.meta);this.packetCount++}
  }
 }
 async add(sample){
  if(!this.started)await this.start();this.check();
  const frame=Math.round(sample.timestamp*RATE);
  if(frame!==this.inputFrames||sample.sampleRate!==RATE||sample.numberOfChannels!==CHANNELS)throw Error('音声入力の時刻が連続していません。');
  const data=new Float32Array(sample.numberOfFrames*CHANNELS);
  for(let ch=0;ch<CHANNELS;ch++)sample.copyTo(data.subarray(ch*sample.numberOfFrames,(ch+1)*sample.numberOfFrames),{planeIndex:ch,format:'f32-planar'});
  const input=new AudioData({data,format:'f32-planar',numberOfChannels:CHANNELS,sampleRate:RATE,numberOfFrames:sample.numberOfFrames,timestamp:Math.round((PREFIX+frame)*1e6/RATE)});
  try{this.encoder.encode(input);this.inputFrames+=sample.numberOfFrames}finally{input.close()}
  await this.waitFor(()=>this.encoder.encodeQueueSize<2);await this.drain();
 }
 async flush(){
  if(this.inputFrames!==Math.round(this.duration*RATE))throw Error('音声入力のサンプル数が一致しません。');
  await this.encoder.flush();if(this.error)throw this.error;await this.drain();
 }
 close(){if(this.closed)return;this.closed=true;if(this.decoder&&this.decoder.state!=='closed')this.decoder.close();this.decoder=null;if(this.encoder.state!=='closed')this.encoder.close();this.packets.length=0}
}
