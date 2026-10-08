import {anchor,audioSequence,sequence,sourceOffset,timing,total} from './model.js';

const EPSILON=1e-6;

export function timelineEditPoints(project){
 const points=[0,total(project)];
 for(const row of [...sequence(project),...audioSequence(project)])points.push(row.start,row.end);
 for(const effect of project.effects||[])points.push(effect.start,effect.start+effect.duration);
 for(const text of project.texts||[])points.push(text.start,text.end);
 return [...new Set(points.filter(Number.isFinite).map(value=>Math.max(0,value).toFixed(6)))].map(Number).sort((a,b)=>a-b);
}

export function adjacentEditPoint(points,current,direction){
 if(direction<0)return[...points].reverse().find(point=>point<current-EPSILON)??0;
 return points.find(point=>point>current+EPSILON)??points.at(-1)??0;
}

export function selectionFrameDuration(project,ids=[]){
 const selected=new Set(ids),item=[...project.clips,...project.audioClips].find(value=>selected.has(value.id)),media=item&&project.media.find(value=>value.id===item.media),fps=Number(media?.fps)||Number(project.export?.fps)||30;
 return 1/Math.max(1,Math.min(240,fps));
}

export function nudgeTimelineSelection(project,ids,delta){
 const selected=new Set(ids);
 for(const audio of project.audioClips||[])if(selected.has(audio.id)&&audio.linked!==false&&audio.sourceClip)selected.add(audio.sourceClip);
 anchor(project);
 const items=[];
 for(const item of project.clips)if(selected.has(item.id))items.push({kind:'video',item,start:item.start,span:timing(item).duration});
 for(const item of project.audioClips||[])if(selected.has(item.id)&&!(item.linked!==false&&selected.has(item.sourceClip)))items.push({kind:'audio',item,start:item.start,span:timing(item).duration});
 for(const item of project.effects||[])if(selected.has(item.id))items.push({kind:'effect',item,start:item.start,span:item.duration});
 for(const item of project.texts||[])if(selected.has(item.id))items.push({kind:'text',item,start:item.start,span:item.end-item.start});
 if(!items.length)return 0;
 const minimum=Math.min(...items.map(value=>value.start)),maximum=Math.max(...items.map(value=>value.start+value.span)),applied=Math.max(-minimum,Math.min(86400-maximum,delta));
 if(Math.abs(applied)<EPSILON)return 0;
 for(const {kind,item} of items){if(kind==='text'){item.start+=applied;item.end+=applied}else item.start+=applied}
 for(const audio of project.audioClips||[]){const source=project.clips.find(item=>item.id===audio.sourceClip);if(audio.linked!==false&&source&&selected.has(source.id))audio.start=source.start}
 return applied;
}

export function rippleTrimToPlayhead(project,id,edge,playhead){
 const selectedAudio=(project.audioClips||[]).find(value=>value.id===id);
 if(selectedAudio?.linked!==false&&selectedAudio?.sourceClip)id=selectedAudio.sourceClip;
 anchor(project);
 let collection=project.clips,rows=sequence(project),row=rows.find(value=>value.clip.id===id);
 if(!row){collection=project.audioClips||[];rows=audioSequence(project);row=rows.find(value=>value.clip.id===id)}
 if(!row||row.clip.gap||playhead<=row.start+EPSILON||playhead>=row.end-EPSILON)return null;
 const item=row.clip,source=item.in+sourceOffset(playhead-row.start,item),oldEnd=row.end,oldDuration=row.duration;
 if(edge==='in')item.in=source;else item.out=source;
 const removed=Math.max(0,oldDuration-timing(item).duration);
 if(removed<EPSILON)return null;
 for(const other of collection)if(other!==item&&(other.layer||0)===row.layer&&(other.start??0)>=oldEnd-EPSILON)other.start=Math.max(row.start,(other.start??0)-removed);
 const linked=(project.audioClips||[]).find(audio=>audio.linked!==false&&audio.sourceClip===item.id);
 if(linked)for(const key of ['start','in','out','speed','endSpeed','curve','hold','timingBase'])item[key]===undefined?delete linked[key]:linked[key]=structuredClone(item[key]);
 return{clip:item,kind:collection===project.clips?'video':'audio',removed,start:row.start};
}
