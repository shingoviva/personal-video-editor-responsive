import {Input,ALL_FORMATS,BlobSource,UrlSource,AudioSampleSink} from './vendor/mediabunny.mjs';
import {createWaveformJobs} from './waveform-jobs.js';
const keys=new WeakMap(),urls=new Map();
const request=createWaveformJobs(async({file,url},signal,notify)=>{
 const input=new Input({formats:ALL_FORMATS,source:file?new BlobSource(file):new UrlSource(url)}),abort=()=>input.dispose();signal.addEventListener('abort',abort,{once:true});
 try{
  const track=await input.getPrimaryAudioTrack();if(signal.aborted||!track||!await track.canDecode())return null;
  const duration=await input.computeDuration(),peaks=new Float32Array(4096),sink=new AudioSampleSink(track);let lastProgress=-1;
  for await(const sample of sink.samples()){
   try{if(signal.aborted)return null;const data=new Float32Array(sample.numberOfFrames);sample.copyTo(data,{planeIndex:0,format:'f32-planar'});for(let i=0;i<data.length;i++){const bin=Math.min(4095,Math.max(0,Math.floor((sample.timestamp+i/sample.sampleRate)/duration*4096)));peaks[bin]=Math.max(peaks[bin],Math.abs(data[i]))}const progress=Math.min(1,(sample.timestamp+sample.numberOfFrames/sample.sampleRate)/duration);if(progress-lastProgress>=.02){lastProgress=progress;notify({phase:'loading',progress})}}finally{sample.close()}
  }
  let maximum=0;for(const peak of peaks)maximum=Math.max(maximum,peak);return{peaks,duration,maximum};
 }finally{signal.removeEventListener('abort',abort);input.dispose()}
});
export function waveformFor(file,url,options){
 if(!file&&!url)return Promise.resolve(null);const store=file?keys:urls,key=file||url;
 if(!store.has(key)){if(!file&&urls.size>=32)urls.delete(urls.keys().next().value);store.set(key,{file,url})}
 return request(store.get(key),options);
}
