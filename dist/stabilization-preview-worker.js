import {Input,ALL_FORMATS,BlobSource,CanvasSink} from './vendor/mediabunny.mjs';
import {stabilizationPathFromFrames,stabilizationSampleCount} from './mobile-stabilize.js?v=2.2.81';

onmessage=async({data})=>{
 let input;
 try{
  input=new Input({formats:ALL_FORMATS,source:new BlobSource(data.file)});
  const track=await input.getPrimaryVideoTrack();
  if(!track)throw Error('映像トラックがありません。');
  if(!await track.canDecode())throw Error('この動画をブラウザで解析できません。');
  const size=72,sink=new CanvasSink(track,{width:size,height:size,fit:'fill',poolSize:1});
  const start=Math.max(0,+data.clip.in||0),end=Math.max(start,+data.clip.out||start),count=stabilizationSampleCount(end-start);
  function* stamps(){for(let i=0;i<count;i++)yield start+i*(end-start)/count}
  const path=await stabilizationPathFromFrames(sink.canvasesAtTimestamps(stamps()),data.clip.stabilization,{size,count,onProgress:value=>postMessage({type:'progress',value})});
  postMessage({type:'done',path});
 }catch(error){postMessage({type:'error',error:error.message})}
 finally{input?.dispose()}
};
