import {clip,uid,sequence,audioSequence,timing,visibleSequence,clamp,total} from './model.js';
const cache=new WeakMap();
export function audioWindows(p){
 const key=(p.audioClips||[]).map(c=>[c.id,c.start,c.layer,c.in,c.out,c.speed,c.endSpeed,c.curve,c.hold,c.loop,JSON.stringify(c.timingBase)].join(':')).join('|'),old=cache.get(p);
 if(old?.key===key)return old.rows;
 const rows=audioSequence(p),result=[0,1,2,3].flatMap(layer=>visibleSequence({clips:rows.filter(r=>r.layer===layer).map(r=>({...r.clip,start:r.start})),audioClips:[]}).filter(r=>!r.clip.gap).map(r=>({...r,layer})));
 cache.set(p,{key,rows:result});return result;
}
export function trackGain(p,layer){const tracks=p.audioTracks||[],track=tracks[layer]||{},solo=tracks.some(t=>t.solo);return track.mute||solo&&!track.solo?0:clamp(track.volume??1,0,2)}
export function detachAudio(p,id,layer=0){
 const row=sequence(p).find(r=>r.clip.id===id),m=p.media.find(m=>m.id===row?.clip.media);
 if(!row||!m?.audio||row.clip.freezeDuration||row.clip.audioDetached)return null;
 const c=row.clip,a={...structuredClone(c),id:uid(),kind:'audio',start:row.start,layer,sourceClip:id,linked:true};
 delete a.freezeAt;delete a.freezeDuration;delete a.audioDetached;
 (p.audioClips??=[]).push(a);c.audioDetached=a.id;c.audio.mute=true;return a;
}
export function appendAudio(p,media,start=0,layer=2){
 const a={...clip(media),kind:'audio',layer,start,loop:false,linked:false,sourceClip:null};(p.audioClips??=[]).push(a);return a;
}
export function migrateBgm(p){
 if(!p.bgm?.media)return;
 const m=p.media.find(m=>m.id===p.bgm.media);if(!m)return;
 const d=total(p);if(d<=0)return;
 const a=appendAudio(p,m,0,2);a.out=d;a.loop=true;a.audio={volume:p.bgm.volume??.3,fadeIn:p.bgm.fadeIn||0,fadeOut:p.bgm.fadeOut||0,mute:false};p.bgm={volume:.3};
}
