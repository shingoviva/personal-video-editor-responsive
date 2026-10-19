"""Per-render, bounded clip workers. No shared executor or encoding overrides."""
import concurrent.futures
import os
import pathlib
import threading


class ChildJob(dict):
 def __init__(self,parent,lock,operation):
  super().__init__(operation=operation,cancel=False)
  self.parent=parent
  self.record_lock=lock

 def get(self,key,default=None):
  if key=='cancel':return super().get(key,False) or self.parent.get('cancel',False)
  return super().get(key,default)

 def __setitem__(self,key,value):
  super().__setitem__(key,value)
  # Cancellation may race Popen, before the parent sees the new process.
  if key=='_proc' and self.get('cancel'):
   try:value.kill()
   except OSError:pass


def worker_count(width,height,preview=False,prores=False,source_pixels=0):
 # Preview remains sequential. Large frames/ProRes get a smaller working set.
 count=max(1,min(4,(os.cpu_count() or 2)//3))
 if preview:return 1
 if prores or max(width*height,source_pixels)>=3840*2160:count=min(count,2)
 return count


class ClipRenderer:
 def __init__(self,job,runner,work,workers):
  self.job,self.runner,self.work=job,runner,pathlib.Path(work)
  self.pool=concurrent.futures.ThreadPoolExecutor(max_workers=workers)
  self.workers=workers
  self.pending=[]
  self.children=[]
  self.lock=threading.Lock()
  self.serial=0
  job.setdefault('_clip_renderers',[]).append(self)

 def cancel(self):
  for future,_ in list(self.pending):future.cancel()
  for child in list(self.children):
   child['cancel']=True
   proc=child.get('_proc')
   if proc and proc.poll() is None:
    try:proc.kill()
    except OSError:pass

 def wait(self,aborting=False):
  error=None
  if aborting or self.job.get('cancel'):
   self.cancel()
  for future,child in self.pending:
   try:future.result()
   except BaseException as exc:
    if error is None:error=exc
    self.cancel()
  self.pending.clear()
  self.children.clear()
  if self.job.get('cancel') and not aborting:raise InterruptedError('処理をキャンセルしました。')
  if error is not None and not aborting:raise error

 def submit(self,args,duration,start,span):
  args=list(args)
  # A ramp/stabilized input is reused or removed by the caller's next iteration.
  if any(str(value)=='-i' and pathlib.Path(str(args[i+1])).parent==self.work for i,value in enumerate(args[:-1])):
   self.wait()
   return self.runner(self.job,args,duration,start,span)
  # Bound queued jobs as well as running jobs; surface failures before admitting more.
  if len(self.pending)>=2*self.workers:
   done,_=concurrent.futures.wait([f for f,_ in self.pending],return_when=concurrent.futures.FIRST_COMPLETED)
   try:
    for future in done:future.result()
   except BaseException:
    self.wait(aborting=True)
    if self.job.get('cancel'):raise InterruptedError('処理をキャンセルしました。')
    raise
   self.pending=[pair for pair in self.pending if pair[0] not in done]
   self.children=[child for _,child in self.pending]
  self.serial+=1
  index=args.index('-filter_complex_script')+1
  script=self.work/f'clip-graph-{self.serial:04d}.txt'
  script.write_text(pathlib.Path(args[index]).read_text())
  args[index]=script
  child=ChildJob(self.job,self.lock,self.job.get('operation','クリップを書き出し中'))
  self.children.append(child)
  def task():
   result=self.runner(child,args,duration,start,span)
   with self.lock:
    self.job['progress']=max(self.job.get('progress',0),child.get('progress',0))
    if child.get('recoveredOutputs'):self.job['recoveredOutputs']=self.job.get('recoveredOutputs',0)+child['recoveredOutputs']
   return result
  self.pending.append((self.pool.submit(task),child))

 def close(self,aborting=False):
  try:self.wait(aborting)
  finally:
   self.pool.shutdown(wait=True,cancel_futures=True)
   renderers=self.job.get('_clip_renderers',[])
   if self in renderers:renderers.remove(self)
   if not renderers:self.job.pop('_clip_renderers',None)


def sparse_lower(lower,clips,target,fps,visible,timing):
 # Dissolves and other transitions also sample outgoing media outside the window.
 if any(isinstance(c.get('transition'),dict) and c['transition'].get('type') in ('dissolve','slide','wipe','circle') for c in clips):return lower
 needed=[(c['_at'],c['_at']+c['_window'][1]) for c in visible(clips,fps) if c.get('layer')==target and (c.get('fadeIn') or c.get('fadeOut') or c.get('opacity',1)<1 or c.get('opacityKeyframes'))]
 return [c for c in lower if c.get('gap') or any(c['start']<b+1/fps and c['start']+timing(c)[0][-1][1]+c.get('hold',0)>a-1/fps for a,b in needed)]


def batch_screen_effects(job,joined,effects,w,h,fps,total,work,ext,video_args,run,number):
 active=[e for e in effects if e.get('type') in ('flash','black-in','black-out') and number(e.get('start'),0,0,total)<total and number(e.get('strength'),1,0,1)>0]
 # The caller has already encoded the first FX, preserving the original CFR clock.
 # Cap simultaneous color inputs rather than growing one unbounded filter graph.
 batch_size=max(1,min(32,1920*1080*32//max(1,w*h)))
 for batch in range(0,len(active),batch_size):
  args=['-i',joined];graph=['[0:v]setpts=PTS-STARTPTS[base0]'];previous='base0'
  group=active[batch:batch+batch_size]
  for index,e in enumerate(group,1):
   kind=e['type'];start=number(e.get('start'),0,0,total);d=number(e.get('duration'),.6,1/60,86400);hold=number(e.get('hold'),0,0,max(0,d-1/60));strength=number(e.get('strength'),1,0,1)
   color='white' if kind=='flash' else 'black';direction='in' if kind=='black-out' else 'out';fade_start=hold if kind=='black-in' else 0;fade_duration=d if kind=='flash' else max(1/60,d-hold)
   args+=['-f','lavfi','-t',d,'-i',f'color=c={color}:s={w}x{h}:r={fps}']
   graph.append(f'[{index}:v]format=rgba,colorchannelmixer=aa={strength},fade=t={direction}:st={fade_start}:d={fade_duration}:alpha=1,setpts=PTS-STARTPTS+{start}/TB[fx{index}]')
   graph.append(f"[{previous}][fx{index}]overlay=eof_action=pass:repeatlast=0:enable='gte(t,{start})*lt(t,{start+d})'[base{index}]");previous=f'base{index}'
  output=work/f'fx-batch-{batch//batch_size}{ext}';job['operation']=f'画面効果 {len(group)}個を一括合成中'
  run(job,args+['-filter_complex',';'.join(graph),'-map',f'[{previous}]','-map','0:a','-t',total,*video_args,'-c:a','copy',output],total,.89,0)
  joined=output
 return joined
