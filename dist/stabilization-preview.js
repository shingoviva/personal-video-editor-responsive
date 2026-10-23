import {correctionAt} from './mobile-stabilize.js?v=2.2.84';

const keyFor=(clip,media,file)=>JSON.stringify([clip.id,media?.id,file?.name,file?.size,file?.lastModified,clip.in,clip.out,clip.stabilization]);

export class StabilizationPreview{
 constructor(onChange=()=>{}){this.cache=new Map();this.pending=new Map();this.failed=new Set();this.onChange=onChange}
 prune(keep){
  for(const [key,worker] of this.pending)if(!keep(key)){this.pending.delete(key);worker.terminate()}
  for(const key of this.cache.keys())if(!keep(key))this.cache.delete(key);
  for(const key of this.failed)if(!keep(key))this.failed.delete(key);
 }
 reconcile(clips,mediaOf,fileOf){
  const wanted=new Set();
  for(const clip of clips){const media=mediaOf(clip),file=media&&fileOf(media);if(media&&file&&!clip.gap&&clip.stabilization!=='OFF'&&!clip.freezeDuration)wanted.add(keyFor(clip,media,file))}
  this.prune(key=>wanted.has(key));
 }
 state(clip,media,file){
  if(!clip||!media||clip.stabilization==='OFF'||clip.freezeDuration)return{status:'off',correction:null};
  const key=keyFor(clip,media,file),path=this.cache.get(key);
  return path?{status:'ready',correctionAt:t=>({...correctionAt(path,t),scale:path.scale})}:{status:this.pending.has(key)?'analyzing':this.failed.has(key)?'error':'idle',correction:null};
 }
 ensure(clip,media,file){
  const key=file&&media&&clip.stabilization!=='OFF'&&!clip.freezeDuration?keyFor(clip,media,file):null;
  this.prune(old=>JSON.parse(old)[0]!==clip.id||old===key);
  if(!key||this.cache.has(key)||this.pending.has(key)||this.failed.has(key))return;
  const worker=new Worker('stabilization-preview-worker.js?v=2.2.84',{type:'module'});this.pending.set(key,worker);this.onChange('analyzing',clip.id,0);
  worker.onmessage=({data})=>{
   if(this.pending.get(key)!==worker)return;
   if(data.type==='progress'){this.onChange('analyzing',clip.id,data.value);return}
   this.pending.delete(key);worker.terminate();
   if(data.type==='done'){this.cache.set(key,data.path);this.onChange('ready',clip.id,1)}
   else{this.failed.add(key);this.onChange('error',clip.id,0,data.error)}
  };
  worker.onerror=event=>{if(this.pending.get(key)!==worker)return;this.pending.delete(key);this.failed.add(key);worker.terminate();this.onChange('error',clip.id,0,event.message)};
  worker.postMessage({file,clip:{id:clip.id,in:clip.in,out:clip.out,stabilization:clip.stabilization}});
 }
 correction(clip,media,file,sourceTime){const state=this.state(clip,media,file);return state.correctionAt?.(sourceTime)||null}
 clear(){this.prune(()=>false)}
}
