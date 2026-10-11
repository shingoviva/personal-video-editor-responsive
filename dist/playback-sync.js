// Allow normal decoder progress; seek only for scrubbing, drift or a new clip.
export function needsPreviewSeek(media,target,{playing=false,still=false,fps=30}={}){
 if(media.seeking)return false;
 const tolerance=playing&&!still?Math.max(.1,2/Math.max(1,fps)):1/Math.max(1,fps);
 return Math.abs(media.currentTime-target)>tolerance;
}

// End-of-file is terminal until a deliberate seek/new clip. Calling play() on
// an ended element implicitly rewinds it, including during tiny duration gaps.
export function previewMediaEnded(media,key,{playing=true,reset=false}={}){
 const fresh=reset||!playing||media._previewRunKey!==key;if(fresh){media._previewRunKey=key;media._previewEnded=false}
 if(playing&&!fresh&&media.ended)media._previewEnded=true;
 return !!(playing&&media._previewEnded);
}

// Seek-driven previews must not use the paused decoder as their time source.
export function usesVideoClock(clip,speed,video){
 return !!clip&&!clip.freezeDuration&&speed>=.25&&speed<=4&&(!video.paused||video.seeking||video.ended||video._previewEnded);
}
