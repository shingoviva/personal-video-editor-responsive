import {AudioSampleSink} from './vendor/mediabunny.mjs';
// Keep a bounded PCM window and one decoder per active clip instead of reopening
// the same source for every quarter-second mix block.
export class AudioWindowReader{
 constructor(track){this.track=track;this.iterator=null;this.chunks=[];this.done=false;this.start=-Infinity}
 async close(){await this.iterator?.return?.();this.iterator=null;this.chunks=[];this.done=false}
 async read(start,end){
 const rate=this.track.sampleRate,length=Math.ceil((end-start)*rate)+2;if(length>rate*6)throw Error('音声処理の区間が長すぎます。');
 const tail=this.chunks.at(-1);if(!this.iterator||start<this.start-1e-6||(tail&&start>tail.end+1)){await this.close();this.iterator=new AudioSampleSink(this.track).samples(Math.max(0,start));}
 this.start=start;this.chunks=this.chunks.filter(c=>c.end>=start-.05);
 while(!this.done&&(!this.chunks.length||this.chunks.at(-1).end<end)){
  const next=await this.iterator.next();if(next.done){this.done=true;break}const sample=next.value;
  try{const planes=[0,1].map(ch=>{const data=new Float32Array(sample.numberOfFrames);sample.copyTo(data,{planeIndex:Math.min(ch,sample.numberOfChannels-1),format:'f32-planar'});return data});this.chunks.push({start:sample.timestamp,end:sample.timestamp+sample.duration,planes})}finally{sample.close()}
 }
 const planes=[new Float32Array(length),new Float32Array(length)];for(const c of this.chunks){const offset=Math.round((c.start-start)*rate);for(let ch=0;ch<2;ch++){const a=Math.max(0,-offset),b=Math.min(c.planes[ch].length,length-offset);if(b>a)planes[ch].set(c.planes[ch].subarray(a,b),offset+a)}}
 return{planes,rate,start};
 }
}
