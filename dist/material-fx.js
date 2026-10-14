// Offline analysis products only: no detector runs in the playback loop.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function pathAt(points,t,fallback={scale:1,x:0,y:0}){
 if(!points?.length)return fallback;let lo=0,hi=points.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(points[mid].time<=t)lo=mid;else hi=mid-1}const a=points[lo],b=points[Math.min(lo+1,points.length-1)],u=b.time>a.time?clamp((t-a.time)/(b.time-a.time),0,1):0;return Object.fromEntries(['scale','x','y'].map(k=>[k,(a[k]??fallback[k])+((b[k]??fallback[k])-(a[k]??fallback[k]))*u]));
}
export function audioAccents(energies,step=.02){
 const positive=energies.filter(x=>x>1e-5);if(!positive.length)return[];const median=[...positive].sort((a,b)=>a-b)[positive.length>>1],peak=Math.max(...positive);const result=[];
 for(let i=2;i<energies.length-2;i++){const value=energies[i],before=(energies[i-1]+energies[i-2])/2,local=energies.slice(Math.max(0,i-20),i).reduce((s,x)=>s+x,0)/Math.min(i,20);if(value<Math.max(.008,median*.8)||value<before*1.6||value<local*1.35||value<energies[i+1])continue;if(result.length&&(i*step-result.at(-1).time)<.45)continue;result.push({time:i*step,strength:clamp((value-before)/Math.max(peak,.01),.15,1)})}return result.slice(0,60);
}
export function accentPath(accents,duration,{bump=false,direction={x:0,y:-1},motion=0,strength=.5}={}){
 const points=[{time:0,scale:1,x:0,y:0}],length=Math.hypot(direction.x,direction.y)||1,gain=clamp(strength,0,1)/(1+Math.max(0,motion)*15);
 for(const a of accents){const time=clamp(a.time,0,duration),amount=gain*a.strength;points.push({time,scale:1,x:0,y:0},{time:Math.min(duration,time+.07),scale:1+amount*(bump?.035:.06),x:bump?direction.x/length*amount*.007:0,y:bump?direction.y/length*amount*.007:0},{time:Math.min(duration,time+.32),scale:1,x:0,y:0})}
 points.push({time:duration,scale:1,x:0,y:0});return points.sort((a,b)=>a.time-b.time).filter((p,i,a)=>!i||p.time>a[i-1].time);
}
// Match a user-selected textured patch. Reject ambiguous/occluded matches.
export function trackPatch(previous,current,n,center,size,search=7){
 const cx=Math.round(center.x*n),cy=Math.round(center.y*n),radius=Math.max(3,Math.min(12,Math.round(size*n*.35))),samples=[];let sum=0,sq=0;
 for(let y=-radius;y<=radius;y+=2)for(let x=-radius;x<=radius;x+=2){const xx=cx+x,yy=cy+y;if(xx<0||yy<0||xx>=n||yy>=n)continue;const value=previous[yy*n+xx];samples.push({x:xx,y:yy,value});sum+=value;sq+=value*value}
 if(samples.length<12||sq/samples.length-(sum/samples.length)**2<30)return{...center,confidence:0};
 const candidates=[];for(let dy=-search;dy<=search;dy++)for(let dx=-search;dx<=search;dx++){let error=0,count=0;for(const p of samples){const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=n||y>=n)continue;error+=Math.min(80,Math.abs(p.value-current[y*n+x]));count++}if(count>=samples.length*.9)candidates.push({dx,dy,error:error/count})}
 candidates.sort((a,b)=>a.error-b.error);const best=candidates[0];if(!best)return{...center,confidence:0};const other=candidates.find(p=>Math.hypot(p.dx-best.dx,p.dy-best.dy)>2);if(!best||best.error>8||!other||other.error-best.error<2)return{...center,confidence:0};return{x:clamp(center.x+best.dx/n,size/2,1-size/2),y:clamp(center.y+best.dy/n,size/2,1-size/2),confidence:clamp(1-best.error/12,0,1)};
}
export function focusRect(effect,t){const p=pathAt(effect.trackPath,t-effect.start,{scale:1,x:effect.zoomX??.5,y:effect.zoomY??.5});return{x:p.x,y:p.y,size:effect.zoomSize??.4};}
export function drawFocus(ctx,effects,t,w,h){for(const e of effects){if(e.motionKind!=='focus'||t<e.start||t>=e.start+e.duration)continue;const p=focusRect(e,t),x=(p.x-p.size/2)*w,y=(p.y-p.size/2)*h,r=p.size*w,b=p.size*h;ctx.save();ctx.globalAlpha=clamp(e.strength??.45,0,.85);ctx.fillStyle='#000';ctx.fillRect(0,0,w,y);ctx.fillRect(0,y+b,w,h-y-b);ctx.fillRect(0,y,x,b);ctx.fillRect(x+r,y,w-x-r,b);ctx.restore()}}

export function materialSourceStamp(c){return JSON.stringify([c.media,c.in,c.out,c.speed,c.endSpeed,c.curve,c.timingBase,c.start,c.scale,c.x,c.y,c.motionPreset,c.stabilization,c.scaleKeyframes])}
export function invalidateMaterialResults(project){if(!(project.effects||[]).some(e=>e.analysisSource))return;const sources=new Map([...project.clips,...project.audioClips].map(c=>[c.id,c]));for(const e of project.effects||[]){if(!e.analysisSource)continue;if(!e.analysisSource.id){if(e.analysisSource.media!==project.bgm?.media){delete e.motionPath;delete e.analysisInfo;delete e.analysisSource}continue;}const c=sources.get(e.analysisSource.id);if(!c||materialSourceStamp(c)!==e.analysisSource.stamp){delete e.trackPath;delete e.motionPath;delete e.analysisInfo;delete e.analysisSource}}}
// Keep native filter expressions bounded while preserving the track's turns.
export function compactTrackPath(points,maximum=80){
 if(!points?.length)return[];let tolerance=.002,result=points;
 for(let pass=0;result.length>maximum&&pass<12;pass++,tolerance*=1.5){const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];while(stack.length){const [a,b]=stack.pop(),first=points[a],last=points[b];let worst=-1,index=-1;for(let i=a+1;i<b;i++){const u=(points[i].time-first.time)/Math.max(1e-9,last.time-first.time),error=Math.hypot(points[i].x-first.x-(last.x-first.x)*u,points[i].y-first.y-(last.y-first.y)*u);if(error>worst){worst=error;index=i}}if(worst>tolerance){keep.add(index);stack.push([a,index],[index,b])}}result=[...keep].sort((a,b)=>a-b).map(i=>points[i])}
 if(result.length>maximum)result=Array.from({length:maximum},(_,i)=>result[Math.round(i*(result.length-1)/(maximum-1))]);return result;
}
export function motionAccents(samples){const result=[];for(let i=3;i<samples.length;i++){const value=samples[i].value,previous=samples.slice(Math.max(0,i-5),i),baseline=previous.reduce((s,p)=>s+p.value,0)/previous.length;if(value<.008||value<baseline*1.6||value-baseline<.012)continue;if(result.length&&samples[i].time-result.at(-1).time<.45)continue;result.push({time:samples[i].time,strength:clamp((value-baseline)*15,.15,1)})}return result.slice(0,60)}
