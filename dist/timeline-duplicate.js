import {uid,timing,MAX_EFFECTS,MAX_TEXT_LAYERS,validateEffectCapacity} from './model.js?v=2.2.85';

// Plan the whole operation before mutating any collection. Media files stay shared.
export function planTimelineDuplicate(project,selected,id=uid){
 const entries=selected.map(v=>({...v})),seen=new Set(entries.map(v=>v.item.id));
 for(const v of [...entries])if(v.kind==='video'){
  const audio=project.audioClips.find(a=>a.linked&&a.sourceClip===v.item.id);
  if(audio&&!seen.has(audio.id)){entries.push({item:audio,kind:'audio',start:audio.start,span:timing(audio).duration});seen.add(audio.id)}
 }
 const collections={video:project.clips,audio:project.audioClips,effect:project.effects,text:project.texts},limits={video:200,audio:200,effect:MAX_EFFECTS,text:MAX_TEXT_LAYERS};
 for(const kind of Object.keys(limits))if(collections[kind].length+entries.filter(v=>v.kind===kind).length>limits[kind])throw Error(`複製全体を追加できません（${kind}: 上限${limits[kind]}）。`);
 validateEffectCapacity([...project.effects,...entries.filter(v=>v.kind==='effect').map(v=>v.item)]);
 if(!entries.length||entries.some(v=>!collections[v.kind]||!Number.isFinite(v.start)||!Number.isFinite(v.span)||v.span<=0))throw Error('複製する項目の時刻が無効です。');
 const used=new Set(Object.values(collections).flat().map(v=>v.id)),ids=new Map();
 for(const v of entries){const next=id();if(!next||used.has(next))throw Error('複製IDが衝突しました。');used.add(next);ids.set(v.item.id,next)}
 return entries.map(v=>{const item=structuredClone(v.item);item.id=ids.get(v.item.id);item.start=v.start;
  if(item.audioDetached){if(ids.has(item.audioDetached))item.audioDetached=ids.get(item.audioDetached);else delete item.audioDetached}
  if(item.sourceClip){if(ids.has(item.sourceClip))item.sourceClip=ids.get(item.sourceClip);else{item.sourceClip=null;item.linked=false}}
  return{...v,sourceId:v.item.id,item,layer:v.item.layer||0};
 });
}
export function commitTimelineDuplicate(project,plan,delta){
 if(!Number.isFinite(delta)||plan.some(v=>v.start+delta<0||v.start+delta+v.span>86400))throw Error('複製先がタイムラインの範囲外です。');
 const collections={video:project.clips,audio:project.audioClips,effect:project.effects,text:project.texts};
 // Recheck against intervening edits before the first write.
 for(const [kind,limit] of Object.entries({video:200,audio:200,effect:MAX_EFFECTS,text:MAX_TEXT_LAYERS}))if(collections[kind].length+plan.filter(v=>v.kind===kind).length>limit)throw Error('複製全体を追加できません。');
 validateEffectCapacity([...project.effects,...plan.filter(v=>v.kind==='effect').map(v=>v.item)]);
 const existing=new Set(Object.values(collections).flat().map(v=>v.id));if(new Set(plan.map(v=>v.item.id)).size!==plan.length)throw Error('複製IDが衝突しました。');if(plan.some(v=>existing.has(v.item.id)))throw Error('複製IDが衝突しました。');
 for(const v of plan){v.item.start=v.start+delta;if(v.kind==='text')v.item.end=v.item.start+v.span;collections[v.kind].push(v.item)}
 return plan;
}
