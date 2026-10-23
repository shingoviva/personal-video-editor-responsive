// Chrome WebCodecs/OPFS actual MP4 export, isolated synthetic image sources.
import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const[base,file]=process.argv.slice(2),pw=await import(pathToFileURL(process.env.PVE_PLAYWRIGHT_MODULE));const browser=await pw.chromium.launch({channel:'chrome',headless:true});
try{const context=await browser.newContext(),page=await context.newPage();await page.goto(base,{waitUntil:'domcontentloaded'});
 const report=await page.evaluate(async()=>{
  const {project,clip}=await import('/dist/model.js'),{EDIT_RATES,normalizeTimelineRate,frameRateValue}=await import('/dist/timeline-time.js'),{renderOnDevice,deleteRender}=await import('/dist/mobile-export.js'),{Input,ALL_FORMATS,BlobSource,EncodedPacketSink,CanvasSink}=await import('/dist/vendor/mediabunny.mjs');
  const p=project(),files=[];for(const color of ['red','blue']){const canvas=new OffscreenCanvas(160,90),ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,160,90);files.push({id:color,file:await canvas.convertToBlob({type:'image/png'})});p.media.push({id:color,name:color+'.png',kind:'image',duration:5,width:160,height:90,fps:25,audio:false})}
  const cut=2*1001/24000;p.clips=p.media.map((m,i)=>({...clip(m),start:i?cut:0,out:i?.5-cut:cut}));p.timelineRate=normalizeTimelineRate('24000/1001');p.export.resolution='Source';const rows=[];let max=0,worst=null;
  for(const[rate,label]of EDIT_RATES){p.export.fps=label;const snapshot=JSON.stringify(p),fps=frameRateValue(label),result=await renderOnDevice(p,files),dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('pve-iphone-renders'),file=await(await dir.getFileHandle(result.path)).getFile();const input=new Input({formats:ALL_FORMATS,source:new BlobSource(file)});
   try{const track=await input.getPrimaryVideoTrack(),sink=new EncodedPacketSink(track),packets=[];for await(const packet of sink.packets(undefined,undefined,{metadataOnly:true}))packets.push({timestamp:packet.timestamp,duration:packet.duration});packets.sort((a,b)=>a.timestamp-b.timestamp);const frames=Math.ceil(.5*fps);if(packets.length!==frames)throw Error('frame count '+label+' '+packets.length);
    for(let index=0;index<packets.length;index++){const error=Math.abs(packets[index].timestamp-index/fps);if(error>max){max=error;worst={rate,frame:index}}if(error>1e-6)throw Error('timestamp '+label+' '+error)}
    const decoded=new CanvasSink(track),boundary=Math.ceil(cut*fps-1e-8);for(const index of [Math.max(0,boundary-1),boundary,frames-1]){const frame=await decoded.getCanvas(index/fps+1e-7),data=frame.canvas.getContext('2d').getImageData(80,45,1,1).data;if(index<boundary?data[0]<=data[2]:data[2]<=data[0])throw Error('sample ownership '+label+' '+index)}
    if(JSON.stringify(p)!==snapshot)throw Error('export mutated project');rows.push({rate,fps,frames,firstBlueFrame:boundary,sourceFPS:25,editRate:p.timelineRate});
   }finally{input.dispose();await deleteRender(result.path)}
  }return{result:'PASS',rows,maxSeconds:max,worst,toleranceSeconds:1e-6};
 });await fs.writeFile(file,JSON.stringify({browser:browser.version(),...report},null,2)+'\n');console.log('Chrome real MP4 export',JSON.stringify(report));await context.close();
}finally{await browser.close()}
