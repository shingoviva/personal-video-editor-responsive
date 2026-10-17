const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Geometric continuity, not identity recognition: avoid jumping to another face.
export function followFace(detections,previous,seed,time,size=.4){
 const candidates=detections.filter(d=>d.score>=.65&&d.width>0&&d.height>0&&[d.x,d.y,d.width,d.height].every(Number.isFinite));
 const origin=previous||seed,dt=previous?Math.max(0,time-previous.time):0;
 const ranked=candidates.map(face=>({face,distance:Math.hypot(face.x-origin.x,face.y-origin.y)})).filter(({face,distance})=>distance<=(previous?.18:.45)&&(!previous||Math.max(face.width/previous.width,previous.width/face.width)<2.2)).sort((a,b)=>a.distance-b.distance);
 if(!ranked.length)return {point:{time,x:clamp(origin.x,size/2,1-size/2),y:clamp(origin.y,size/2,1-size/2),confidence:0},previous};
 const face=ranked[0].face,alpha=previous?1-Math.exp(-Math.min(dt,.25)/.18):1;
 const next={x:origin.x+(face.x-origin.x)*alpha,y:origin.y+(face.y-origin.y)*alpha,width:face.width,height:face.height,time};
 return {point:{time,x:clamp(next.x,size/2,1-size/2),y:clamp(next.y,size/2,1-size/2),confidence:face.score},previous:next};
}
