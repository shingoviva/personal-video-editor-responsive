import {Input,ALL_FORMATS,BlobSource,CanvasSink} from './vendor/mediabunny.mjs';
export async function probeFile(file,{thumbnail=false,signal}={}){
 const input=new Input({formats:ALL_FORMATS,source:new BlobSource(file)});const abort=()=>input.dispose();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,20000);
 try{if(signal?.aborted)throw signal.reason;const v=await input.getPrimaryVideoTrack(),a=await input.getPrimaryAudioTrack();if(!v)return{audio:!!a};const stats=await v.computePacketStats(120),hdr=await v.hasHighDynamicRange(),width=await v.getDisplayWidth(),height=await v.getDisplayHeight();const result={duration:await input.computeDuration(),codec:(await v.getCodec())?.toUpperCase(),audio:!!a,hdr,width,height,fps:stats.averagePacketRate||null,rateMode:'先頭区間の推定',transfer:(await v.getColorSpace()).transfer||'unknown'};
 if(thumbnail&&await v.canDecode()){const sink=new CanvasSink(v,{width:Math.round(320*width/Math.max(width,height)),height:Math.round(320*height/Math.max(width,height)),poolSize:1});const frame=await sink.getCanvas(Math.min(.1,result.duration/2));if(frame&&typeof frame.canvas.toDataURL==='function')result.thumbnail=frame.canvas.toDataURL('image/jpeg',.8);}
 return result;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);input.dispose()}
}
