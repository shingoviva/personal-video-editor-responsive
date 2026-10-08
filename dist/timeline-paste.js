import {MAX_TEXT_LAYERS,MAX_EFFECTS,uid} from './model.js';

const LIMITS={video:200,audio:200,effect:MAX_EFFECTS,text:MAX_TEXT_LAYERS};

export function pasteTimelineItems(project,source,at,id=uid){
 if(!source?.length)return[];
 const base=Math.min(...source.map(value=>value.start)),inserted=[];
 for(const entry of source){
  const collection=entry.kind==='video'?project.clips:entry.kind==='audio'?project.audioClips:entry.kind==='effect'?project.effects:entry.kind==='text'?project.texts:null;
  if(!collection||collection.length>=LIMITS[entry.kind])continue;
  const start=Math.max(0,at+(entry.start-base)),copy={...structuredClone(entry.data),id:id(),start};
  if(entry.kind==='video'){
   project.clips.push(copy);
   if(entry.linked&&project.audioClips.length<LIMITS.audio){const audio={...structuredClone(entry.linked),id:id(),sourceClip:copy.id,start,linked:true};project.audioClips.push(audio);copy.audioDetached=audio.id}
  }else if(entry.kind==='text'){
   copy.end=start+entry.span;project.texts.push(copy);
  }else collection.push(copy);
  inserted.push({kind:entry.kind,item:copy});
 }
 return inserted;
}
