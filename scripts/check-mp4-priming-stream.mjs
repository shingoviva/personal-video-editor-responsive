// No encoders: remux frozen AAC/AVC packets through the actual box writer/StreamTarget.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {Input,ALL_FORMATS,BlobSource,EncodedPacketSink,Output,Mp4OutputFormat,StreamTarget,EncodedAudioPacketSource,EncodedVideoPacketSource} from '../dist/vendor/mediabunny.mjs?v=2.2.84';
import {AacPrimingMux} from '../dist/mp4-aac-roll.js?v=2.2.84';
const[out,...sources]=process.argv.slice(2);if(!sources.length)throw Error('Usage: node scripts/check-mp4-priming-stream.mjs OUTPUT SOURCE.mp4 ...');fs.mkdirSync(out,{recursive:true});const rows=[];
const open=file=>new Input({formats:ALL_FORMATS,source:new BlobSource(new Blob([fs.readFileSync(file)]))});
async function signature(track){const hash=createHash('sha256'),clock=[];for await(const p of new EncodedPacketSink(track).packets()){hash.update(p.data);clock.push([p.timestamp,p.duration,p.type])}return{hash:hash.digest('hex'),clock}}
for(const file of sources)for(const fastStart of ['reserve',false,'in-memory']){
 const input=open(file);const v=await input.getPrimaryVideoTrack(),a=await input.getPrimaryAudioTrack(),before=[await signature(v),await signature(a)],policy=new AacPrimingMux();
 const name=path.basename(file,'.mp4')+'-'+String(fastStart)+'.mp4',target=path.join(out,name),fd=fs.openSync(target,'w');let maximumWriteBytes=0,writes=0,ok=false;
 try{
 const stream=new WritableStream({write({data,position}){maximumWriteBytes=Math.max(maximumWriteBytes,data.byteLength);writes++;fs.writeSync(fd,data,0,data.byteLength,position)}});
 const output=new Output({format:new Mp4OutputFormat({fastStart,pveAacPriming:policy}),target:new StreamTarget(stream,{chunked:true,chunkSize:16384})});
 const vs=new EncodedVideoPacketSource('avc'),as=new EncodedAudioPacketSource('aac');output.addVideoTrack(vs,{maximumPacketCount:before[0].clock.length+8});output.addAudioTrack(as,{maximumPacketCount:before[1].clock.length+8});await output.start();
 const vi=new EncodedPacketSink(v).packets()[Symbol.asyncIterator](),ai=new EncodedPacketSink(a).packets()[Symbol.asyncIterator]();let vp=await vi.next(),ap=await ai.next(),count=0;const vc={decoderConfig:await v.getDecoderConfig()},ac={decoderConfig:await a.getDecoderConfig()};
 while(!vp.done||!ap.done){if(!ap.done&&(vp.done||ap.value.timestamp<=vp.value.timestamp)){await as.add(ap.value,ac);count++;ap=await ai.next()}else{await vs.add(vp.value,vc);vp=await vi.next()}}
 await output.finalize();policy.verify(count);fs.fsyncSync(fd);ok=true;
 }finally{fs.closeSync(fd);input.dispose();if(!ok)fs.unlinkSync(target)}
 const verify=open(target);try{const after=[await signature(await verify.getPrimaryVideoTrack()),await signature(await verify.getPrimaryAudioTrack())];
 const equalPayload=before.every((r,i)=>r.hash===after[i].hash),equalClock=before.every((r,i)=>r.clock.length===after[i].clock.length&&r.clock.every((p,n)=>p[2]===after[i].clock[n][2]&&Math.abs(p[0]-after[i].clock[n][0])<1e-6&&Math.abs(p[1]-after[i].clock[n][1])<1e-6));
 if(!equalPayload||!equalClock||maximumWriteBytes>16384)throw Error('Streaming packet/clock identity failed');rows.push({source:file,target,fastStart,equalPayload,equalClock,maximumWriteBytes,writes,packets:before.map(x=>x.clock.length)});console.log(name,'PASS');
 }finally{verify.dispose()}
}
fs.writeFileSync(path.join(out,'stream.json'),JSON.stringify(rows,null,2));
