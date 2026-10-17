// Classic worker permits MediaPipe's WASM loader; model is loaded only on Analyze.
onmessage=async({data})=>{let input,detector;try{
 const [{Input,ALL_FORMATS,BlobSource,UrlSource,CanvasSink},{FilesetResolver,FaceDetector},{sourceTime},{followFace},{compactTrackPath}]=await Promise.all([
 import('./vendor/mediabunny.mjs'),import('./vendor/face/vision_bundle.mjs'),import('./mobile-model.js'),import('./face-follow.js'),import('./material-fx.js')]);
 const {row,start,duration,region}=data;if(duration<=0||duration>30)throw Error('顔追従の解析区間は30秒以内にしてください。');
 postMessage({type:'progress',value:0});
 const files=await FilesetResolver.forVisionTasks(new URL('./vendor/face/wasm/',self.location.href).href);
 detector=await FaceDetector.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/face/blaze_face_short_range.tflite',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',minDetectionConfidence:.65});
 input=new Input({formats:ALL_FORMATS,source:data.file?new BlobSource(data.file):new UrlSource(data.url)});
 const track=await input.getPrimaryVideoTrack();if(!track||!await track.canDecode())throw Error('解析できる映像トラックがありません。');
 const ar=data.aspect==='Original'?track.displayWidth/track.displayHeight:data.aspect.split(':').map(Number).reduce((a,b)=>a/b);
 const sink=new CanvasSink(track,{width:384,height:Math.max(2,Math.round(384*track.displayHeight/track.displayWidth)),poolSize:1,fit:'fill'});
 const canvas=new OffscreenCanvas(ar>=1?384:Math.max(2,Math.round(384*ar)),ar>=1?Math.max(2,Math.round(384/ar)):384),ctx=canvas.getContext('2d');
 const path=[],count=Math.ceil(duration*8)+1;let previous=null,lost=0,detected=0;
 for(let i=0;i<count;i++){
  const local=Math.min(duration,i/8),frame=await sink.getCanvas(sourceTime(row,start+local));if(!frame)throw Error('映像フレームを取得できません。');
  const sw=frame.canvas.width,sh=frame.canvas.height,cw=Math.min(sw,sh*ar)/(row.clip.scale||1),ch=Math.min(sh,sw/ar)/(row.clip.scale||1);
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(frame.canvas,(sw-cw)*(row.clip.x??.5)-(row.clip.offsetX||0)*cw,(sh-ch)*(row.clip.y??.5)-(row.clip.offsetY||0)*ch,cw,ch,0,0,canvas.width,canvas.height);
  const faces=detector.detectForVideo(canvas,1+local*1000).detections.map(d=>({x:(d.boundingBox.originX+d.boundingBox.width/2)/canvas.width,y:(d.boundingBox.originY+d.boundingBox.height/2)/canvas.height,width:d.boundingBox.width/canvas.width,height:d.boundingBox.height/canvas.height,score:d.categories[0]?.score||0}));
  const result=followFace(faces,previous,{x:region.zoomX,y:region.zoomY},local,region.zoomSize);previous=result.previous;path.push(result.point);if(result.point.confidence)detected++;else lost++;
  if(i%4===0)postMessage({type:'progress',value:i/count});await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(!detected)throw Error('顔を検出できませんでした。FX開始画面で顔を枠に入れ、明るさや顔の大きさをご確認ください。');
 postMessage({type:'done',trackPath:compactTrackPath(path),samples:count,lost,detected,sourceName:data.file?.name||data.sourceName||'Source'});
}catch(error){postMessage({type:'error',error:error.message})}finally{detector?.close();input?.dispose()}};
