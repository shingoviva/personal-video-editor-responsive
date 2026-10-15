"""Export regressions: single-frame blends, moving padding and isolated workers."""
import os,sys,pathlib,tempfile,subprocess,copy,json,time,threading
with tempfile.TemporaryDirectory(prefix='pve-export-optimization-') as tmp:
 os.environ['PVE_DATA']=tmp
 sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'))
 import core
 from export_pipeline import ClipRenderer,sparse_lower,batch_screen_effects,worker_count
 root=pathlib.Path(tmp)
 def command(args):subprocess.run(core.BASE+list(map(str,args)),capture_output=True,check=True)
 png=root/'red.png';video=root/'motion.mp4'
 command(['-f','lavfi','-i','color=red:s=160x160:r=1:d=1','-frames:v','1',png])
 command(['-f','lavfi','-i','testsrc2=s=160x90:r=60:d=4','-f','lavfi','-i','sine=f=440:r=48000:d=4','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',video])
 image=core.inspect(png,'image',png.name);motion=core.inspect(video,'video',video.name)
 def clip(id,media='video',start=0,duration=1,layer=0,**kw):return {'id':id,'media':media,'in':0,'out':duration,'start':start,'layer':layer,'speed':1,'stabilization':'OFF','audio':{'volume':.4},'color':{},**kw}
 def project(clips,fps=30):return {'version':1,'media':[image,motion],'clips':clips,'texts':[],'effects':[],'audioClips':[],'videoTracks':[{} for _ in range(3)],'audioTracks':[{} for _ in range(4)],'bgm':{},'aspect':'16:9','export':{'resolution':'Source','fps':str(fps),'quality':'High','codec':'H.264'}}
 def render(name,p):
  result=core.render({'id':name,'cancel':False},p,_size=(160,90));out=core.ROOT/'exports'/result['file'];core.validate_output(out,result['duration'],True);return out
 def centroid(path,at):
  raw=subprocess.check_output(core.BASE+['-v','error','-ss',str(at),'-i',path,'-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-']);points=[(i//3%160,i//3//160) for i in range(0,len(raw),3) if raw[i]>120 and raw[i+1]<70 and raw[i+2]<70];assert points
  return tuple(sum(p[axis] for p in points)/len(points) for axis in (0,1))
 for direction,axis,sign in [('right',0,1),('left',0,-1),('down',1,1),('up',1,-1)]:
  out=render('pan-'+direction,project([clip('pan','image',duration=.8,scale=.3,motionPreset='pan-'+direction,motionAmount=.3)]));a,b=centroid(out,.1),centroid(out,.65);assert (b[axis]-a[axis])*sign>(15 if axis==0 else 5),(direction,a,b)
 # Upper clips split a lower alpha clip into a single, fractional-offset frame.
 for fps in (24,30,60):
  clips=[clip(str(i),'video' if i%2==0 else 'image',i*.65,.65,transition={'type':kind,'duration':.25,'direction':'right'}) for i,kind in enumerate(('none','dissolve','slide','wipe','circle'))]
  clips += [clip('alpha','image',1.35,.22,1,opacity=.5),clip('upper','image',1.4,.1,2,opacity=.3)]
  out=render('one-frame-'+str(fps),project(clips,fps));count=subprocess.check_output([core.FFPROBE,'-v','error','-select_streams','v:0','-show_entries','stream=nb_frames','-of','csv=p=0',out],text=True).strip();assert int(count)==__import__('math').ceil(3.25*fps-1e-8),(fps,count)
 # A dissolve requires the preceding source even outside the alpha interval.
 lower=[clip('first',duration=.8),clip('second',start=.8,duration=.8,transition={'type':'dissolve','duration':.6})];clips=lower+[clip('alpha',start=1,duration=.4,layer=1,opacity=.5)]
 assert sparse_lower(lower,clips,1,30,core.visible_clips,core.timing)==lower
 # Immutable scripts, bounded queue, parent cancellation and failure isolation.
 work=root/'workers';work.mkdir();active=[0,0];seen={};lock=threading.Lock()
 def fake(job,args,*_):
  index=args.index('-filter_complex_script')+1
  with lock:active[0]+=1;active[1]=max(active[1],active[0])
  try:
   time.sleep(.02)
   if job.get('cancel'):raise InterruptedError('cancel')
   seen[pathlib.Path(args[-1]).name]=pathlib.Path(args[index]).read_text();job['recoveredOutputs']=1
  finally:
   with lock:active[0]-=1
 parent={'id':'workers','cancel':False};renderer=ClipRenderer(parent,fake,work,2)
 for i in range(12):
  script=work/'graph.txt';script.write_text(str(i));renderer.submit(['-i',video,'-filter_complex_script',script,work/f'clip-{i}.mp4'],1,0,0)
 renderer.close();assert active==[0,2] and parent['recoveredOutputs']==12;assert seen=={f'clip-{i}.mp4':str(i) for i in range(12)}
 parent={'cancel':False};renderer=ClipRenderer(parent,fake,work,2);renderer.submit(['-i',video,'-filter_complex_script',script,work/'cancel.mp4'],1,0,0);parent['cancel']=True
 try:renderer.close();raise AssertionError('cancellation returned success')
 except InterruptedError:pass
 assert not renderer.pending and active[0]==0
 def fail(job,args,*_):raise RuntimeError('intentional')
 renderer=ClipRenderer({'cancel':False},fail,work,2);renderer.submit(['-i',video,'-filter_complex_script',script,work/'bad.mp4'],1,0,0)
 try:renderer.close();raise AssertionError('worker failure lost')
 except RuntimeError as e:assert 'intentional' in str(e)
 assert not renderer.pending
 # Public API cancellation must also stop a worker waiting on a silent process.
 started=threading.Event();parent={'id':'silent-worker','cancel':False};core.JOBS[parent['id']]=parent
 def silent(job,args,*_):
  proc=subprocess.Popen([sys.executable,'-c','import time;time.sleep(60)'])
  job['_proc']=proc;started.set()
  try:
   proc.wait()
   if job.get('cancel'):raise InterruptedError('cancel')
  finally:
   if proc.poll() is None:proc.kill();proc.wait()
   job.pop('_proc',None)
 renderer=ClipRenderer(parent,silent,work,2);renderer.submit(['-i',video,'-filter_complex_script',script,work/'silent.mp4'],1,0,0)
 assert started.wait(5);start=time.monotonic();core.cancel(parent['id']);renderer.close(aborting=True)
 assert time.monotonic()-start<2 and '_clip_renderers' not in parent
 core.JOBS.pop(parent['id'])
 calls=[]
 def collect(job,args,*_):calls.append(args)
 fx=[{'type':'flash','start':0,'duration':.2} for _ in range(99)]
 batch_screen_effects({},root/'first.mp4',fx,160,90,30,1,work,'.mp4',[],collect,core.number)
 assert len(calls)==4 and all(sum(str(a)=='-i' for a in args)<=33 for args in calls)
 calls.clear();batch_screen_effects({},root/'first.mp4',fx,3840,2160,30,1,work,'.mp4',[],collect,core.number)
 assert len(calls)==13 and all(sum(str(a)=='-i' for a in args)<=9 for args in calls)
 assert worker_count(160,90,preview=True)==1 and worker_count(7680,4320)<=2
 print('Export optimization: four dynamic pans, single-frame alpha at 24/30/60fps, transition dependency, worker script/queue/cancel/failure isolation and bounded FX batches PASS')
