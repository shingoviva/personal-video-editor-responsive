// Allow normal decoder progress; seek only for scrubbing, drift or a new clip.
export function needsPreviewSeek(media,target,{playing=false,still=false,fps=30}={}){
 if(media.seeking)return false;
 const tolerance=playing&&!still?Math.max(.1,2/Math.max(1,fps)):1/Math.max(1,fps);
 return Math.abs(media.currentTime-target)>tolerance;
}
