import {audioWindows,trackGain} from './audio-timeline.js';
import {Input,ALL_FORMATS,BlobSource,CanvasSink,AudioSampleSink,VideoSampleSink,Output,Mp4OutputFormat,StreamTarget,CanvasSource,AudioSampleSource,AudioSample,Quality,canEncodeVideo,canEncodeAudio} from './vendor/mediabunny.mjs';
import {clipAlpha,effectAlpha} from './creative.js';
import {imageBitmap} from './image-media.js';
import {renderer} from './preview.js';
import {sequence,visibleSequence,timing,sourceOffset,total} from './model.js';
import {outputSettings,sourceTime,gainAt,held,mixWindow,limitStereo,declickGain} from './mobile-model.js';
import {motionEstimate,smoothPath,correctionAt,stabilizationSampleCount} from './mobile-stabilize.js';
import {drawTextCanvas,drawTextRasterCanvas} from './text-render.js';
import {motionTransform} from './motion-transform.js';
import {frameAtTimestamp} from './frame-source.js';
import {transitionState,drawTransitionLayer,outgoingTransitionRow} from './transition.js';
let cancelled=false,limiter={gain:1};
const check=()=>{if(cancelled)throw new DOMException('書き出しを中止しました。','AbortError')};
const progress=(operation,value)=>postMessage({type:'progress',operation,value});
const open=file=>new Input({formats:ALL_FORMATS,source:new BlobSource(file)});
const canvas=(w,h)=>new OffscreenCanvas(w,h);
export const isHDRColor=(flag,color={})=>!!flag||['smpte2084','arib-std-b67','pq','hlg'].includes(color?.transfer);
export async function audioRange(track,start,end){
 const rate=track.sampleRate,length=Math.ceil((end-start)*rate)+2;if(length>rate*6)throw Error('音声処理の区間が長すぎます。');const planes=[new Float32Array(length),new Float32Array(length)];
 const sink=new AudioSampleSink(track);for await(const sample of sink.samples(Math.max(0,start),end)){try{check();const offset=Math.round((sample.timestamp-start)*rate);for(let ch=0;ch<2;ch++){const data=new Float32Array(sample.numberOfFrames);sample.copyTo(data,{planeIndex:Math.min(ch,sample.numberOfChannels-1),format:'f32-planar'});const a=Math.max(0,-offset),b=Math.min(data.length,length-offset);if(b>a)planes[ch].set(data.subarray(a,b),offset+a)}}finally{sample.close()}}
 return{planes,rate,start};
}
const delayStates=new Map();
export function delayTaps(audio={}){if(!audio.delayEnabled||!(audio.delayMix>0))return[{offset:0,gain:1}];const time=Math.max(.02,Math.min(2,+audio.delayTime||.28)),feedback=Math.max(0,Math.min(.85,+audio.delayFeedback||.35)),mix=Math.max(0,Math.min(.8,+audio.delayMix||.25));return[{offset:0,gain:1-mix*.25},{offset:time,gain:mix},{offset:time*2,gain:mix*feedback}]}
function mixClipRange(data,lo,count,chunk,row,start,rate,begin,stop,trackVolume){
 const c=row.clip,audio=c.audio||{},duration=row.originalDuration??row.duration,enabled=!!audio.delayEnabled&&audio.delayMix>0,temp=enabled?new Float32Array(data.length):data;
 mixWindow(temp,lo,count,chunk.planes,i=>{const s=sourceTime(row,start+(lo+i)/rate),pos=c.loop?s%chunk.duration:s;return pos>=begin&&pos<stop?(pos-begin)*chunk.rate:-1},i=>{const local=start+(lo+i)/rate-row.start+(row.offset||0);return trackVolume*gainAt(local,duration,audio.volume,audio.fadeIn,audio.fadeOut,audio.gainKeyframes,audio.gainEnvelope)*declickGain(local,duration)});
 if(!enabled)return;const samples=Math.max(1,Math.round(Math.max(.02,Math.min(2,+audio.delayTime||.28))*rate)),at=start+lo/rate;let state=delayStates.get(c.id);if(!state||Math.abs(state.time-at)>2/rate||state.samples!==samples){state={samples,pos:0,time:at,ring:[new Float32Array(samples),new Float32Array(samples)],low:[0,0]};delayStates.set(c.id,state)}const n=data.length/2,mix=Math.max(0,Math.min(.8,+audio.delayMix||.25)),feedback=Math.max(0,Math.min(.85,+audio.delayFeedback||.35));for(let i=lo;i<lo+count;i++){for(let ch=0;ch<2;ch++){const input=temp[ch*n+i],delayed=state.ring[ch][state.pos];state.low[ch]+=(delayed-state.low[ch])*.32;state.ring[ch][state.pos]=input+state.low[ch]*feedback;data[ch*n+i]+=input*(1-mix*.25)+state.low[ch]*mix}state.pos=(state.pos+1)%samples}state.time=start+(lo+count)/rate;
}
export async function mixAudio(rows,resources,p,start,end){
 const rate=48000,n=Math.round((end-start)*rate),data=new Float32Array(n*2);if(!n)return null;
 for(const row of [...rows,...audioWindows(p)]){const c=row.clip;if(c.kind!=='audio'&&(p.audioTracks||[]).some(t=>t.solo))continue;if(c.gap||c.freezeDuration||c.audio.mute||!c.audio.volume)continue;const track=resources.get(c.media).audio;if(!track)continue;const a=Math.max(start,row.start),b=Math.min(end,row.end,row.start+timing(c).nodes.at(-1)[1]-(row.offset||0));if(b<=a)continue;
 const lo=Math.max(0,Math.round((a-start)*rate)),hi=Math.min(n,Math.round((b-start)*rate));const from=sourceTime(row,a),to=sourceTime(row,b),res=resources.get(c.media),trackVolume=c.kind==='audio'?trackGain(p,row.layer):p.videoTracks?.[row.layer||0]?.hidden?0:Math.max(0,Math.min(2,p.videoTracks?.[row.layer||0]?.volume??1));if(!trackVolume)continue;
 const ranges=[];if(!c.loop)ranges.push([from,to+.002]);else{const d=res.duration,span=to-from,f=from%d;if(span>=d)ranges.push([0,d]);else{ranges.push([f,Math.min(d,f+span+.002)]);if(f+span>d)ranges.push([0,f+span-d+.002])}}
 for(const [begin,stop] of ranges){const chunk=await audioRange(track,begin,stop);mixClipRange(data,lo,hi-lo,{...chunk,duration:res.duration},row,start,rate,begin,stop,trackVolume);}
 }
 const bg=resources.get(p.bgm.media);if(bg?.audio&&p.bgm.volume){let cursor=start;while(cursor<end-1e-8){check();const local=cursor%bg.duration,stop=Math.min(end,cursor+bg.duration-local);if(stop<=cursor)break;const chunk=await audioRange(bg.audio,local,local+stop-cursor+.002),lo=Math.max(0,Math.round((cursor-start)*rate)),hi=Math.min(n,Math.round((stop-start)*rate));mixWindow(data,lo,hi-lo,chunk.planes,i=>i*chunk.rate/rate,i=>gainAt(start+(lo+i)/rate,total(p),p.bgm.volume,p.bgm.fadeIn,p.bgm.fadeOut,p.bgm.gainKeyframes));cursor=stop;}}
 limitStereo(data,limiter,rate);return new AudioSample({data,format:'f32-planar',numberOfChannels:2,sampleRate:rate,timestamp:start});
}
async function stabilize(track,c,onProgress){
 const size=72,sink=new CanvasSink(track,{width:size,height:size,fit:'fill',poolSize:1});let last=null,x=0,y=0,angle=0;const points=[];const count=stabilizationSampleCount(c.out-c.in);function* stamps(){for(let i=0;i<count;i++)yield c.in+i*(c.out-c.in)/count}
 for await(const frame of sink.canvasesAtTimestamps(stamps())){check();if(!frame)continue;const pixels=frame.canvas.getContext('2d').getImageData(0,0,size,size).data,gray=new Float32Array(size*size);for(let i=0;i<gray.length;i++)gray[i]=.299*pixels[4*i]+.587*pixels[4*i+1]+.114*pixels[4*i+2];if(last){const motion=motionEstimate(last,gray,size);x+=motion.x;y+=motion.y;angle+=motion.angle}points.push({time:frame.timestamp,x,y,angle});last=gray;if(points.length%24===0)onProgress(points.length/count);}
 return smoothPath(points,c.stabilization);
}
async function frameReader(row,res,cfg,start=row.start){
 const c=row.clip;let still,pathData,blend,stable;const frameState={frame:null,source:-1};
 try{
 if(res.imageFile){still=await imageBitmap(res.imageFile,res.metadata,Math.min(8192,Math.max(cfg.width,cfg.height)*(c.scale||1)));return{frame:async()=>still,close:async()=>still.close()}}
 if(!res.video)throw Error('映像トラックがありません。');
 if(c.stabilization!=='OFF'&&!c.freezeDuration){progress('手ぶれの動きを解析中',0);pathData=await stabilize(res.video,c,()=>{});}
 const scale=Math.min(1,Math.max(cfg.width/res.video.displayWidth,cfg.height/res.video.displayHeight)*(c.scale||1)*(pathData?.scale||1));
 const sw=Math.max(2,Math.round(res.video.displayWidth*scale)),sh=Math.max(2,Math.round(res.video.displayHeight*scale)),sink=new CanvasSink(res.video,{width:sw,height:sh,fit:'fill',poolSize:3});
 blend=canvas(sw,sh);const bc=blend.getContext('2d',{alpha:false});if(pathData)stable=canvas(sw,sh);
 return{async frame(t){
 const source=sourceTime(row,t);
 // CanvasSink recycles iterator canvases. Keeping one of those canvases across
 // encoder awaits can therefore repeat the same picture. A timestamp lookup
 // gives each output timestamp the correct decoded VFR frame before painting.
 const current=await frameAtTimestamp(sink,source,frameState);
 if(!current)throw Error('映像フレームを読み込めません。');
 bc.globalAlpha=1;bc.drawImage(current.canvas,0,0);
 if(c.interpolation==='blend'&&!c.freezeDuration){const following=await sink.getCanvas(Math.min(c.out-1e-7,source+1/cfg.fps));if(following&&following.timestamp>current.timestamp){bc.globalAlpha=Math.max(0,Math.min(1,(source-current.timestamp)/(following.timestamp-current.timestamp)));bc.drawImage(following.canvas,0,0);bc.globalAlpha=1}}
 if(stable){const sc=stable.getContext('2d',{alpha:false}),corr=correctionAt(pathData,source);sc.save();sc.fillStyle='#000';sc.fillRect(0,0,sw,sh);sc.translate(sw/2+corr.x*sw,sh/2+corr.y*sh);sc.rotate(corr.angle||0);sc.scale(pathData.scale,pathData.scale);sc.drawImage(blend,-sw/2,-sh/2);sc.restore()}
 return stable||blend;
 },async close(){blend.width=blend.height=1;if(stable)stable.width=stable.height=1}};
 }catch(e){still?.close();throw e}
}
async function render(p,files,preview,outputPath){limiter={gain:1};delayStates.clear();
 const cfg=outputSettings(p,preview),hidden=layer=>!!p.videoTracks?.[layer]?.hidden,overlayHidden=item=>!!p.overlayTracks?.[item.layer||0]?.hidden,videoProject={...p,clips:p.clips.filter(c=>!hidden(c.layer||0)),audioClips:[]},rows=visibleSequence(videoProject),sourceAudioRows=sequence(videoProject),effects=(p.effects||[]).filter(e=>!overlayHidden(e)),texts=(p.texts||[]).filter(t=>!overlayHidden(t)),resources=new Map(),textBitmaps=new Map();let output,handle,fileHandle,root,path,success=false;const activeInputs=[],sessions=[null,null,null],transitionSessions=[null,null,null];let painter;
 try{
 if(!globalThis.VideoEncoder||!globalThis.AudioEncoder||!globalThis.OffscreenCanvas)throw Error('このブラウザは端末内書き出しに未対応です。最新のiOSのSafariで開いてください。');
 if(!await canEncodeVideo('avc',{width:cfg.width,height:cfg.height,bitrate:cfg.bitrate})||!await canEncodeAudio('aac',{sampleRate:48000,numberOfChannels:2}))throw Error('選択したH.264/AAC設定に端末が対応していません。1080p・30fpsをお試しください。');
 const needed=new Set([...videoProject.clips,...p.audioClips||[]].filter(c=>!c.gap).map(c=>c.media));if(p.bgm.media)needed.add(p.bgm.media);
 for(const id of needed){check();const file=files.find(x=>x.id===id)?.file;if(!file)throw Error('元素材を再リンクしてください。');const metadata=p.media.find(m=>m.id===id);if(metadata?.kind==='image'){resources.set(id,{imageFile:file,metadata,audio:null,duration:5});continue}const input=open(file);activeInputs.push(input);const video=await input.getPrimaryVideoTrack(),audio=await input.getPrimaryAudioTrack();let color=null,hdr=false;if(video&&p.clips.some(c=>c.media===id)){if(!await video.canDecode())throw Error(file.name+' の映像を端末でデコードできません。');color=await video.getColorSpace();hdr=isHDRColor(await video.hasHighDynamicRange(),color);}
 const needsAudio=(p.audioClips||[]).some(c=>c.media===id)||id===p.bgm.media||sourceAudioRows.some(r=>r.clip.media===id&&!r.clip.audio?.mute&&r.clip.audio?.volume);if(audio&&needsAudio&&audio.numberOfChannels>2)throw Error('端末版の音声はモノラル・ステレオのみ対応しています。');if(audio&&needsAudio&&!await audio.canDecode())throw Error(file.name+' の音声をデコードできません。');resources.set(id,{input,video,audio:needsAudio?audio:null,duration:await input.computeDuration(),hdr,color});}
 for(const text of texts)if(text.raster?.data)try{textBitmaps.set(text.id,await createImageBitmap(await(await fetch(text.raster.data)).blob()))}catch{}
 check();const estimate=await navigator.storage.estimate();const expectedBytes=(cfg.bitrate+cfg.audioBitrate)*cfg.duration/8;if(estimate.quota&&estimate.quota-estimate.usage<expectedBytes*1.2)throw Error('書き出し用の空き容量が不足しています。画質か解像度を下げてください。');root=await navigator.storage.getDirectory();root=await root.getDirectoryHandle('pve-iphone-renders',{create:true});path=outputPath;fileHandle=await root.getFileHandle(path,{create:true});handle=await fileHandle.createSyncAccessHandle();
 const stream=new WritableStream({write({data,position}){check();if(handle.write(data,{at:position})!==data.byteLength)throw Error('端末の空き容量が不足しています。');}});
 output=new Output({format:new Mp4OutputFormat({fastStart:'reserve'}),target:new StreamTarget(stream,{chunked:true,chunkSize:1024*1024})});
 const picture=canvas(cfg.width,cfg.height),processed=canvas(cfg.width,cfg.height),ctx=picture.getContext('2d',{alpha:false,colorSpace:'srgb'});painter=renderer(processed,{width:cfg.width,height:cfg.height,preserve:true});if(!painter)throw Error('映像処理用GPUを利用できません。');
 const videoSource=new CanvasSource(picture,{codec:'avc',quality:new Quality({bitrate:cfg.bitrate}),keyFrameInterval:2});const audioSource=new AudioSampleSource({codec:'aac',quality:new Quality({bitrate:cfg.audioBitrate})});output.addVideoTrack(videoSource,{frameRate:cfg.fps,maximumPacketCount:cfg.frames+8});output.addAudioTrack(audioSource,{maximumPacketCount:Math.ceil(cfg.duration*48000/1024)+100});await output.start();let frameIndex=0,audioTime=0;
 const timelineRows=sequence(videoProject),originalLayerRows=[0,1,2].map(layer=>timelineRows.filter(row=>row.layer===layer)),layerRows=[0,1,2].map(layer=>visibleSequence({...videoProject,clips:timelineRows.filter(r=>r.layer===layer).map(r=>({...r.clip,start:r.start}))})),indices=[0,0,0];
 while(frameIndex<cfg.frames){
 check();const t=frameIndex/cfg.fps;ctx.globalAlpha=1;ctx.fillStyle='#000';ctx.fillRect(0,0,cfg.width,cfg.height);
 const active=layerRows.map((list,k)=>{while(indices[k]<list.length&&list[indices[k]].end<=t+1e-8)indices[k]++;const r=list[indices[k]];return r&&r.start<=t&&!r.clip.gap?r:null});
 for(let k=0;k<3;k++){
 const row=active[k],alpha=clipAlpha(row,t),state=row&&transitionState(row,originalLayerRows[k],t),occluded=active.some((r,j)=>j>k&&clipAlpha(r,t)>=1&&!transitionState(r,originalLayerRows[j],t));
 if(!row||occluded){if(sessions[k]){await sessions[k].reader.close();sessions[k]=null}continue}
 if(state){
  const previous=state.previous,key=previous.clip.id+'|'+row.clip.id,outgoingState=outgoingTransitionRow(state,row,resources.get(previous.clip.media)?.duration);
  if(transitionSessions[k]?.key!==key){if(transitionSessions[k])await transitionSessions[k].reader.close();transitionSessions[k]={key,reader:await frameReader(outgoingState.row,resources.get(previous.clip.media),cfg,t)}}
  const outgoing=await transitionSessions[k].reader.frame(t);painter.draw(outgoing,motionTransform(outgoingState.row.clip,t-row.start,outgoingState.row.duration),`${cfg.width}:${cfg.height}`);ctx.globalAlpha=outgoingState.row.clip.opacity??1;drawTransitionLayer(ctx,processed,state,cfg.width,cfg.height,'outgoing');
 }else if(transitionSessions[k]){await transitionSessions[k].reader.close();transitionSessions[k]=null}
 if(sessions[k]?.row!==row){if(sessions[k])await sessions[k].reader.close();sessions[k]={row,reader:await frameReader(row,resources.get(row.clip.media),cfg,t)}}
 const frame=await sessions[k].reader.frame(t);painter.draw(frame,motionTransform(row.clip,t-row.start,row.duration),`${cfg.width}:${cfg.height}`);ctx.globalAlpha=alpha;drawTransitionLayer(ctx,processed,state,cfg.width,cfg.height,'incoming');ctx.globalAlpha=1;
 }
 for(const e of effects){const alpha=effectAlpha(e,t);if(alpha){ctx.globalAlpha=alpha;ctx.fillStyle=e.type==='flash'?'#fff':'#000';ctx.fillRect(0,0,cfg.width,cfg.height)}}ctx.globalAlpha=1;
 for(const text of texts){const bitmap=textBitmaps.get(text.id);bitmap?drawTextRasterCanvas(ctx,text,bitmap,t,cfg.width,cfg.height):drawTextCanvas(ctx,text,t,cfg.width,cfg.height)}await videoSource.add(t,Math.min(1/cfg.fps,cfg.duration-t));frameIndex++;
 const target=Math.min(cfg.duration,frameIndex/cfg.fps);while(audioTime<target-1e-8){const end=Math.min(cfg.duration,audioTime+.25),sample=await mixAudio(sourceAudioRows,resources,p,audioTime,end);if(sample){try{await audioSource.add(sample)}finally{sample.close()}}audioTime=end;}
 if(frameIndex%5===0)progress('MP4を書き出し中',frameIndex/cfg.frames*.95);
 }
 check();progress('MP4を確定中',.96);await output.finalize();handle.flush();handle.close();handle=null;const file=await fileHandle.getFile();const verify=open(file);let videoDuration=0,audioDuration=0;try{const v=await verify.getPrimaryVideoTrack(),a=await verify.getPrimaryAudioTrack();videoDuration=await v?.computeDuration()||0;audioDuration=await a?.computeDuration()||0;const videoTolerance=Math.max(.001,1/cfg.fps);if(v?.codec!=='avc'||a?.codec!=='aac'||Math.abs(videoDuration-cfg.duration)>videoTolerance||audioDuration<cfg.duration-1/48000||audioDuration>cfg.duration+.12)throw Error('生成した動画の検証に失敗しました。');let count=0;for await(const sample of new VideoSampleSink(v).samples()){try{check();count++;if(count%30===0)progress('完成動画を検証中',.96+.025*count/cfg.frames)}finally{sample.close()}}if(count!==cfg.frames)throw Error('完成動画のフレーム数が一致しません。');let audioPackets=0;for await(const sample of new AudioSampleSink(a).samples()){sample.close();check();if(++audioPackets%200===0)progress('完成音声を検証中',.99);}}finally{verify.dispose()}
 check();success=true;return{file,path,verified:true,videoDuration,audioDuration,...cfg};
 }finally{for(const session of [...sessions,...transitionSessions])await session?.reader.close();if(output&&output.state!=='finalized')await output.cancel().catch(()=>{});handle?.close();if(!success&&root&&path)await root.removeEntry(path).catch(()=>{});painter?.dispose();for(const bitmap of textBitmaps.values())bitmap.close();for(const input of activeInputs)input.dispose();}
}
onmessage=async({data})=>{if(data.type==='cancel'){cancelled=true;return}if(data.type!=='render')return;cancelled=false;try{const result=await render(data.project,data.files,data.preview,data.outputPath);postMessage({type:'done',result})}catch(e){postMessage({type:'error',error:e.message,cancelled:cancelled||e.name==='AbortError'})}};
