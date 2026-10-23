import{mediaKind}from'./assets.js?v=2.2.84';
// Only the selected timeline occurrence is replaced; source and edit settings stay intact.
export function replacementCheck(project,id,media){
 const video=project.clips.find(c=>c.id===id),clip=video||project.audioClips.find(c=>c.id===id);
 if(!clip||clip.gap)return{ok:false,reason:'差し替えるクリップが見つかりません。'};
 const old=project.media.find(m=>m.id===clip.media),kind=video?mediaKind(old):'audio';
 if(!media||mediaKind(media)!==kind)return{ok:false,reason:'同じ種類の素材を選択してください。'};
 const linked=video?project.audioClips.filter(a=>a.linked&&a.sourceClip===id):[];
 if(linked.length&&!media.audio)return{ok:false,reason:'リンク音声を保つため、音声付きの動画を選択してください。'};
 const required=Math.max(...[clip,...linked].map(c=>Math.max(Number(c.out)||0,Number(c.freezeAt)||0)));
 if(kind!=='image'&&(!Number.isFinite(media.duration)||media.duration+1e-6<required))return{ok:false,reason:'素材が短いため、現在の長さを保てません。',required};
 return{ok:true,clip,linked,kind,required,detach:!video&&!!clip.linked};
}
export function replaceClipMedia(project,id,media){
 const check=replacementCheck(project,id,media);if(!check.ok)throw Error(check.reason);
 check.clip.media=media.id;for(const c of check.linked)c.media=media.id;
 if(check.detach){const parent=project.clips.find(c=>c.id===check.clip.sourceClip);if(parent?.audioDetached===id)delete parent.audioDetached;check.clip.linked=false;check.clip.sourceClip=null;}
 return check;
}
export function requiredMediaEnd(project,id){return Math.max(0,...[...project.clips,...project.audioClips].filter(c=>c.media===id&&!c.gap).map(c=>Math.max(Number(c.out)||0,Number(c.freezeAt)||0)));}
