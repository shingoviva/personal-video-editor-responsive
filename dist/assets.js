export const mediaKind=m=>m?.kind||(m?.width?'video':'audio');
export const assetName=m=>m?.label||m?.name||'Missing';
export function fileKind(file){
 const ext=file.name.split('.').at(-1).toLowerCase();
 if(['jpg','jpeg','png','webp'].includes(ext)||['image/jpeg','image/png','image/webp'].includes(file.type))return'image';
 if(file.type?.startsWith('image/')||['heic','heif','gif','svg','tif','tiff'].includes(ext))throw Error('静止画はJPEG・PNG・WebPを選んでください。HEIC・RAWなどはJPEGへ変換してから追加してください。');
 if(file.type?.startsWith('audio/')||['mp3','wav','m4a','aac','aiff','aif','flac','ogg','opus'].includes(ext))return'audio';
 return'video';
}
export const usage=(p,id)=>[...p.clips,...p.audioClips||[]].filter(c=>!c.gap&&c.media===id).length+(p.bgm?.media===id?1:0);
export function filterAssets(p,{kind='all',query='',sort='recent'}={}){
 const q=query.trim().toLocaleLowerCase();
 const result=p.media.filter(m=>(kind==='all'||mediaKind(m)===kind)&&(!q||(assetName(m)+' '+m.name).toLocaleLowerCase().includes(q)));
 if(sort==='name')result.sort((a,b)=>assetName(a).localeCompare(assetName(b),'ja'));
 else result.reverse();
 return result;
}
export function removeUnused(p,ids){const remove=new Set(ids.filter(id=>!usage(p,id)));p.media=p.media.filter(m=>!remove.has(m.id));p.analysis=p.analysis.filter(a=>!remove.has(a.media));return remove.size}
export const sourceLimit=m=>mediaKind(m)==='image'?3600:m.duration;
