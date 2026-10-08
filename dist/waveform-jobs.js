// Shared jobs survive timeline redraws; only jobs with no remaining consumers are cancelled.
export function createWaveformJobs(decode){
 const cache=new WeakMap();let queue=Promise.resolve();
 return function request(key,{signal,onProgress=()=>{}}={}){
  if(signal?.aborted)return Promise.resolve(null);
  let job=cache.get(key);
  if(!job){job={controller:new AbortController(),listeners:new Set(),state:{phase:'queued',progress:0},timer:0,done:false};cache.set(key,job);
   const notify=state=>{job.state=state;for(const callback of job.listeners)callback(state)};
   job.promise=queue.then(async()=>{if(job.controller.signal.aborted)return null;notify({phase:'loading',progress:0});return decode(key,job.controller.signal,notify)}).then(value=>{job.done=true;notify({phase:value?'ready':'unavailable',progress:value?1:0});if(!value&&cache.get(key)===job)cache.delete(key);return value}).catch(()=>{job.done=true;notify({phase:job.controller.signal.aborted?'cancelled':'unavailable',progress:0});if(cache.get(key)===job)cache.delete(key);return null});
   queue=job.promise.then(()=>{});
  }
  clearTimeout(job.timer);onProgress(job.state);job.listeners.add(onProgress);
  return new Promise(resolve=>{let finished=false;const release=value=>{if(finished)return;finished=true;signal?.removeEventListener('abort',abort);job.listeners.delete(onProgress);resolve(value);if(!job.done&&!job.listeners.size)job.timer=setTimeout(()=>{if(!job.listeners.size){job.controller.abort();if(cache.get(key)===job)cache.delete(key)}},0)};const abort=()=>release(null);signal?.addEventListener('abort',abort,{once:true});job.promise.then(release);});
 };
}
