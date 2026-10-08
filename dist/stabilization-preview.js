import {correctionAt} from './mobile-stabilize.js';

const keyFor=(clip,media,file)=>JSON.stringify([clip.id,media?.id,file?.name,file?.size,file?.lastModified,clip.in,clip.out,clip.stabilization]);

export class StabilizationPreview{
 constructor(onChange=()=>{}){this.cache=new Map();this.pending=new Map();this.failed=new Set();this.onChange=onChange}
 state(clip,media,file){
  if(!clip||!media||clip.stabilization==='OFF'||clip.freezeDuration)return{status:'off',correction:null};
  const key=keyFor(clip,media,file),path=this.cache.get(key);
  return path?{status:'ready',correctionAt:t=>({...correctionAt(path,t),scale:path.scale})}:{status:this.pending.has(key)?'analyzing':this.failed.has(key)?'error':'idle',correction:null};
 }
 ensure(clip,media,file){
  const key=keyFor(clip,media,file);if(!file||this.cache.has(key)||this.pending.has(key)||this.failed.has(key)||clip.stabilization==='OFF'||clip.freezeDuration)return;
  const worker=new Worker('stabilization-preview-worker.js',{type:'module'});this.pending.set(key,worker);this.onChange('analyzing',clip.id,0);
  worker.onmessage=({data})=>{
   if(data.type==='progress'){this.onChange('analyzing',clip.id,data.value);return}
   this.pending.delete(key);worker.terminate();
   if(data.type==='done'){this.cache.set(key,data.path);this.onChange('ready',clip.id,1)}
   else{this.failed.add(key);this.onChange('error',clip.id,0,data.error)}
  };
  worker.onerror=event=>{this.pending.delete(key);this.failed.add(key);worker.terminate();this.onChange('error',clip.id,0,event.message)};
  worker.postMessage({file,clip:{id:clip.id,in:clip.in,out:clip.out,stabilization:clip.stabilization}});
 }
 correction(clip,media,file,sourceTime){const state=this.state(clip,media,file);return state.correctionAt?.(sourceTime)||null}
 clear(){for(const worker of this.pending.values())worker.terminate();this.pending.clear();this.cache.clear();this.failed.clear()}
}
