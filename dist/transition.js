export const TRANSITION_TYPES=['none','dissolve','slide','wipe','circle'];
export const TRANSITION_DIRECTIONS=['left','right','up','down'];
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
export function normalizeTransition(value={}){return{type:TRANSITION_TYPES.includes(value?.type)?value.type:'none',duration:clamp(value?.duration??.6,.1,2),direction:TRANSITION_DIRECTIONS.includes(value?.direction)?value.direction:'left'}}
export function transitionState(row,rows,time){
 const transition=normalizeTransition(row?.clip?.transition);if(!row||transition.type==='none')return null;
 const local=time-row.start;if(local<0||local>=Math.min(transition.duration,row.duration))return null;
 const previous=rows.filter(candidate=>candidate!==row&&candidate.layer===row.layer&&!candidate.clip.gap&&candidate.end<=row.start+1e-5).sort((a,b)=>b.end-a.end)[0];
 if(!previous||Math.abs(previous.end-row.start)>1/30)return null;
 const raw=clamp(local/Math.min(transition.duration,row.duration)),progress=raw*raw*(3-2*raw);
 return{...transition,raw,progress,previous};
}
export function outgoingTransitionRow(state,incomingRow,mediaDuration=0){
 if(!state?.previous||!incomingRow)return null;const previous=state.previous,clip=previous.clip,duration=Math.min(state.duration,incomingRow.duration),endTransform={scale:clip.scale,x:clip.x,y:clip.y};
 const speed=Math.max(.05,Number(clip.endSpeed??clip.speed)||1),available=Math.max(0,Number(mediaDuration||0)-Number(clip.out||0));
 if(!clip.freezeDuration&&clip.kind!=='image'&&available>1e-4){const span=Math.min(available,duration*speed),tailSpeed=Math.max(.05,span/duration),tail={...clip,...endTransform,motionPreset:'none',scaleKeyframes:[],in:clip.out,out:clip.out+span,speed:tailSpeed,endSpeed:tailSpeed,curve:'constant',hold:0,opacity:clip.opacity??1,opacityKeyframes:[],fadeIn:0,fadeOut:0};return{row:{clip:tail,layer:previous.layer,start:incomingRow.start,end:incomingRow.start+duration,duration},moving:true}}
 const freezeAt=clip.freezeAt??Math.max(clip.in,clip.out-1e-6),frozen={...clip,...endTransform,motionPreset:'none',scaleKeyframes:[],freezeDuration:duration,freezeAt,opacity:clip.opacity??1,opacityKeyframes:[],fadeIn:0,fadeOut:0};return{row:{clip:frozen,layer:previous.layer,start:incomingRow.start,end:incomingRow.start+duration,duration},moving:false};
}
export function transitionStyles(state){
 const base={opacity:'1',transform:'none',clipPath:'none'};if(!state)return{incoming:base,outgoing:base};const p=state.progress,d=state.direction;
 if(state.type==='dissolve')return{incoming:{...base,opacity:String(p)},outgoing:base};
 if(state.type==='slide'){const incoming={...base},outgoing={...base},axis=d==='left'||d==='right'?'X':'Y',sign=d==='left'||d==='up'?1:-1;incoming.transform=`translate${axis}(${sign*(1-p)*100}%)`;outgoing.transform=`translate${axis}(${-sign*p*100}%)`;return{incoming,outgoing}}
 if(state.type==='circle')return{incoming:{...base,clipPath:`circle(${p*71}% at 50% 50%)`},outgoing:base};
 const inset=d==='left'?`0 ${(1-p)*100}% 0 0`:d==='right'?`0 0 0 ${(1-p)*100}%`:d==='up'?`0 0 ${(1-p)*100}% 0`:`${(1-p)*100}% 0 0 0`;return{incoming:{...base,clipPath:`inset(${inset})`},outgoing:base};
}
export function applyTransitionStyles(incoming,outgoing,state){const styles=transitionStyles(state);for(const [element,style]of[[incoming,styles.incoming],[outgoing,styles.outgoing]])if(element)Object.assign(element.style,style)}
export function drawTransitionLayer(ctx,image,state,width,height,role='incoming'){
 if(!image)return;const p=state?.progress??1,type=state?.type||'none',direction=state?.direction||'left';ctx.save();
 if(role==='outgoing'&&type==='slide'){const x=(direction==='left'?-p:direction==='right'?p:0)*width,y=(direction==='up'?-p:direction==='down'?p:0)*height;ctx.drawImage(image,x,y,width,height);ctx.restore();return}
 if(role==='outgoing'){ctx.drawImage(image,0,0,width,height);ctx.restore();return}
 if(type==='dissolve')ctx.globalAlpha*=p;
 if(type==='slide'){const x=(direction==='left'?1-p:direction==='right'?p-1:0)*width,y=(direction==='up'?1-p:direction==='down'?p-1:0)*height;ctx.drawImage(image,x,y,width,height);ctx.restore();return}
 if(type==='wipe'){const w=(direction==='left'||direction==='right')?width*p:width,h=(direction==='up'||direction==='down')?height*p:height,x=direction==='right'?width-w:0,y=direction==='down'?height-h:0;ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip()}
 if(type==='circle'){ctx.beginPath();ctx.arc(width/2,height/2,Math.hypot(width,height)/2*p,0,Math.PI*2);ctx.clip()}
 ctx.drawImage(image,0,0,width,height);ctx.restore();
}
