const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function clipPreviewBounds(clip,frame,source={}){
 const ar=source.width>0&&source.height>0?source.width/source.height:frame.width/frame.height;
 const baseWidth=Math.max(frame.width,frame.height*ar),baseHeight=Math.max(frame.height,frame.width/ar),scale=clip.scale??1,width=baseWidth*scale,height=baseHeight*scale;
 return {left:(frame.left||0)+(frame.width-width)*(clip.x??.5)+(clip.offsetX||0)*frame.width,top:(frame.top||0)+(frame.height-height)*(clip.y??.5)+(clip.offsetY||0)*frame.height,width,height,baseWidth,baseHeight};
}
function pose(bounds,clip,frame){return {scale:bounds.width/bounds.baseWidth,offsetX:clamp((bounds.left-(frame.left||0)-(frame.width-bounds.width)*(clip.x??.5))/frame.width,-4,4),offsetY:clamp((bounds.top-(frame.top||0)-(frame.height-bounds.height)*(clip.y??.5))/frame.height,-4,4)}}
function edges(bounds,frame){const out=[];if(Math.abs(bounds.left-(frame.left||0))<.6)out.push('left');if(Math.abs(bounds.left+bounds.width-(frame.left||0)-frame.width)<.6)out.push('right');if(Math.abs(bounds.top-(frame.top||0))<.6)out.push('top');if(Math.abs(bounds.top+bounds.height-(frame.top||0)-frame.height)<.6)out.push('bottom');return out}
export function movePreviewClip(clip,dx,dy,frame,source={},threshold=8,snapFrame=frame){
 const b=clipPreviewBounds(clip,frame,source);b.left+=dx;b.top+=dy;let snapX=false,snapY=false;
 for(const [key,size,axis] of [['left','width','x'],['top','height','y']]){
  const start=snapFrame[key]||0,span=snapFrame[size],candidates=[{d:start-b[key],center:false},{d:start+span-b[key]-b[size],center:false},{d:start+span/2-b[key]-b[size]/2,center:true}].filter(c=>Math.abs(c.d)<=threshold).sort((a,b)=>Math.abs(a.d)-Math.abs(b.d));
  if(candidates.length){b[key]+=candidates[0].d;if(axis==='x')snapX=candidates[0].center;else snapY=candidates[0].center}
 }
 return {...pose(b,clip,frame),transformMode:'move',snapX,snapY,snapEdges:edges(b,snapFrame)};
}
export function resizePreviewClip(clip,handle,dx,dy,frame,source={},fromCenter=false,threshold=8,snapFrame=frame){
 const b=clipPreviewBounds(clip,frame,source),west=handle.includes('w'),north=handle.includes('n'),sx=west?-1:1,sy=north?-1:1;
 const ax=fromCenter?b.left+b.width/2:west?b.left+b.width:b.left,ay=fromCenter?b.top+b.height/2:north?b.top+b.height:b.top;
 const vx=sx*b.width/(fromCenter?2:1),vy=sy*b.height/(fromCenter?2:1),px=ax+vx+dx,py=ay+vy+dy;
 let factor=clamp(((px-ax)*vx+(py-ay)*vy)/Math.max(1,vx*vx+vy*vy),.1/(clip.scale||1),3/(clip.scale||1));
 const candidates=[];for(const [a,v,start,span] of [[ax,vx,snapFrame.left||0,snapFrame.width],[ay,vy,snapFrame.top||0,snapFrame.height]])for(const edge of [start,start+span]){const f=(edge-a)/v,d=Math.abs(a+v*factor-edge);if(f>0&&f*(clip.scale||1)>=.1&&f*(clip.scale||1)<=3&&d<=threshold)candidates.push({f,d})}
 candidates.sort((a,b)=>a.d-b.d);if(candidates.length)factor=candidates[0].f;
 const width=b.width*factor,height=b.height*factor,left=fromCenter?ax-width/2:west?ax-width:ax,top=fromCenter?ay-height/2:north?ay-height:ay,next={...b,left,top,width,height};
 return {...pose(next,clip,frame),transformMode:'resize',snapEdges:edges(next,snapFrame)};
}
