import {sequence,splitClip,sourceOffset,timing} from './model.js';
import {remapEnvelope} from './clip-envelope.js';

export function linkedAudio(project,videoId){
 return (project.audioClips||[]).find(a=>a.linked!==false&&a.sourceClip===videoId);
}

export function linkedVideo(project,audio){
 return audio?.sourceClip ? project.clips.find(c=>c.id===audio.sourceClip) : null;
}

export function syncLinkedAudio(project,video){
 const audio=video&&linkedAudio(project,video.id);if(!audio)return null;
 const oldNodes=timing(audio).nodes,oldIn=audio.in;
 for(const key of ['start','in','out','speed','endSpeed','curve','hold','timingBase']){
  if(video[key]===undefined)delete audio[key];else audio[key]=structuredClone(video[key]);
 }
 if(audio.audio?.gainEnvelope?.length)audio.audio.gainEnvelope=remapEnvelope(audio.audio.gainEnvelope,oldNodes,timing(audio).nodes,oldIn,audio.in);
 audio.layer=Math.max(0,Math.min(3,audio.layer||0));return audio;
}

export function setAudioLinked(project,audio,linked){
 if(!audio?.sourceClip)return false;
 const video=linkedVideo(project,audio);if(!video)return false;
 audio.linked=!!linked;if(linked)syncLinkedAudio(project,video);return true;
}

export function splitLinkedPair(project,video,source){
 const audio=linkedAudio(project,video.id),index=project.clips.indexOf(video),right=splitClip(video,source);
 if(!right)return null;
 project.clips.splice(index+1,0,right);
 if(audio){
  const audioRight=splitClip(audio,source);
  if(audioRight){
   const ai=project.audioClips.indexOf(audio);audioRight.sourceClip=right.id;audioRight.linked=true;
   project.audioClips.splice(ai+1,0,audioRight);right.audioDetached=audioRight.id;video.audioDetached=audio.id;
   syncLinkedAudio(project,video);syncLinkedAudio(project,right);
  }
 }
 return right;
}

export function removeLinkedAudio(project,videoId){
 const before=(project.audioClips||[]).length;
 project.audioClips=(project.audioClips||[]).filter(a=>!(a.sourceClip===videoId&&a.linked!==false));
 return before-project.audioClips.length;
}

export function linkedSourceAt(project,audio,timelineTime){
 const video=linkedVideo(project,audio),row=video&&sequence(project).find(r=>r.clip===video);
 if(!row)return null;
 return video.in+sourceOffset(timelineTime-row.start,video);
}
