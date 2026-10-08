import {Input,ALL_FORMATS,BlobSource,CanvasSink} from './vendor/mediabunny.mjs';
import {motionEstimate,smoothPath,stabilizationSampleCount} from './mobile-stabilize.js';

onmessage=async({data})=>{
 let input;
 try{
  input=new Input({formats:ALL_FORMATS,source:new BlobSource(data.file)});
  const track=await input.getPrimaryVideoTrack();
  if(!track)throw Error('映像トラックがありません。');
  if(!await track.canDecode())throw Error('この動画をブラウザで解析できません。');
  const size=72,sink=new CanvasSink(track,{width:size,height:size,fit:'fill',poolSize:1}),points=[];
  let last=null,x=0,y=0,angle=0;
  const start=Math.max(0,+data.clip.in||0),end=Math.max(start,+data.clip.out||start),count=stabilizationSampleCount(end-start);
  function* stamps(){for(let i=0;i<count;i++)yield start+i*(end-start)/count}
  for await(const frame of sink.canvasesAtTimestamps(stamps())){
   if(!frame)continue;
   const pixels=frame.canvas.getContext('2d').getImageData(0,0,size,size).data,gray=new Float32Array(size*size);
   for(let i=0;i<gray.length;i++)gray[i]=.299*pixels[4*i]+.587*pixels[4*i+1]+.114*pixels[4*i+2];
   if(last){const motion=motionEstimate(last,gray,size);x+=motion.x;y+=motion.y;angle+=motion.angle}
   points.push({time:frame.timestamp,x,y,angle});last=gray;
   if(points.length%36===0)postMessage({type:'progress',value:points.length/count});
  }
  postMessage({type:'done',path:smoothPath(points,data.clip.stabilization)});
 }catch(error){postMessage({type:'error',error:error.message})}
 finally{input?.dispose()}
};
