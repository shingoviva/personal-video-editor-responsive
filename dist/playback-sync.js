// Allow normal decoder progress; seek only for scrubbing, drift or a new clip.
export function needsPreviewSeek(media,target,{playing=false,still=false,fps=30,continuous=false,speed=1}={}){
 if(media.seeking)return false;
 const tolerance=playing&&!still?(continuous?Math.max(.5*speed,2/Math.max(1,fps)):Math.max(.1,2/Math.max(1,fps))):1/Math.max(1,fps);
 return Math.abs(media.currentTime-target)>tolerance;
}

// Muted video decoders follow the timeline gently during one continuous clip.
// Repeated seeks for small clock differences discard otherwise usable frames.
export function previewPlaybackRate(media,target,speed){
 if(media.paused||media.seeking||media.ended)return speed;
 const error=(target-media.currentTime)/Math.max(.05,speed);
 if(Math.abs(error)<.015)return speed;
 return speed*(1+Math.max(-.04,Math.min(.04,error*.4)));
}

// End-of-file is terminal until a deliberate seek/new clip. Calling play() on
// an ended element implicitly rewinds it, including during tiny duration gaps.
export function previewMediaEnded(media,key,{playing=true,reset=false}={}){
 const fresh=reset||!playing||media._previewRunKey!==key;if(fresh){media._previewRunKey=key;media._previewEnded=false}
 if(playing&&!fresh&&media.ended)media._previewEnded=true;
 return !!(playing&&media._previewEnded);
}
