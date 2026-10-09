from audio_engine import validate_audio,extent as audio_extent,render_tracks
"""Bounded-memory, non-destructive native media pipeline. Python standard library only."""
from color_engine import filters as matched_color_filters
import copy
import array, base64, binascii, bisect, collections, hashlib, json, math, os, pathlib, shutil, statistics, subprocess, threading, time, uuid, struct, zlib
ROOT=pathlib.Path(os.environ.get('PVE_DATA',str(pathlib.Path(__file__).resolve().parent.parent/'.local-data')))
ROOT.mkdir(parents=True,exist_ok=True)
for name in ('media','cache','exports','projects','logs'): (ROOT/name).mkdir(exist_ok=True)
FFMPEG=shutil.which('ffmpeg'); FFPROBE=shutil.which('ffprobe')
BASE=[FFMPEG or 'ffmpeg','-hide_banner','-loglevel','warning','-nostdin','-y','-threads','2','-filter_threads','2','-filter_complex_threads','2']
JOBS={}; MEDIA={}; GATE=threading.Lock()
for f in (ROOT/'media').glob('*.json'):
 try: MEDIA[f.stem]=json.loads(f.read_text())
 except Exception: pass

def number(v,default=0,lo=-1e9,hi=1e9):
 try: n=float(v); return max(lo,min(hi,n)) if math.isfinite(n) else default
 except (ValueError,TypeError): return default

def opacity_expression(clip,duration,offset=0):
 points=[]
 for value in clip.get('opacityKeyframes',[])[:32]:
  if not isinstance(value,dict):continue
  points.append((number(value.get('time'),0,0,duration),number(value.get('value'),1,0,1)))
 points=sorted(dict(points).items())
 if not points:return str(number(clip.get('opacity'),1,0,1))
 x=f'(T+{offset})';expr=str(points[-1][1])
 for (a,av),(b,bv) in reversed(list(zip(points,points[1:]))):
  u=f'max(0,min(1,(({x})-{a})/{max(1e-6,b-a)}))';smooth=f'({u})*({u})*(3-2*({u}))';value=f'({av}+({bv-av})*({smooth}))';expr=f'if(lt({x},{b}),{value},{expr})'
 return f'if(lt({x},{points[0][0]}),{points[0][1]},{expr})'

def keyframe_expression(points,duration,maximum=3,time_expr='t',minimum=0):
 values=[]
 for point in points[:32]:
  if isinstance(point,dict):values.append((number(point.get('time'),0,0,duration),number(point.get('value'),1,minimum,maximum)))
 values=sorted(dict(values).items())
 if not values:return '1'
 expr=str(values[-1][1])
 for (a,av),(b,bv) in reversed(list(zip(values,values[1:]))):
  u=f'max(0,min(1,(({time_expr})-{a:.9f})/{max(1e-6,b-a):.9f}))';smooth=f'({u})*({u})*(3-2*({u}))';expr=f'if(lt({time_expr},{b:.9f}),({av:.9f}+({bv-av:.9f})*({smooth})),{expr})'
 return f'if(lt({time_expr},{values[0][0]:.9f}),{values[0][1]:.9f},{expr})'

def gain_envelope_expression(points,duration,time_expr='t',step_ramp=.005):
 values=[]
 for point in (points or [])[:256]:
  if isinstance(point,dict):values.append((number(point.get('time'),0,0,duration),number(point.get('valueDb',point.get('db')),0,-96,12),'hold' if point.get('interpolation')=='hold' or point.get('curve')=='hold' else 'linear'))
 values=sorted({time:(db,curve) for time,db,curve in values}.items())
 if not values:return '1'
 gain=lambda db:f'pow(10,{db:.9f}/20)'
 expr=gain(values[-1][1][0])
 for (a,(av,curve)),(b,(bv,_)) in reversed(list(zip(values,values[1:]))):
  span=max(1e-6,b-a)
  if curve=='hold':
   ramp=min(max(0,step_ramp),span/2);start=b-ramp
   if ramp:segment=f'if(lt({time_expr},{start:.9f}),{gain(av)},pow(10,({av:.9f}+({bv-av:.9f})*max(0,min(1,(({time_expr})-{start:.9f})/{ramp:.9f})))/20))'
   else:segment=gain(av)
  else:
   u=f'max(0,min(1,(({time_expr})-{a:.9f})/{span:.9f}))';segment=f'pow(10,({av:.9f}+({bv-av:.9f})*({u}))/20)'
  expr=f'if(lt({time_expr},{b:.9f}),{segment},{expr})'
 return f'if(lt({time_expr},{values[0][0]:.9f}),{gain(values[0][1][0])},{expr})'

def scale_keyframe_expression(clip,duration,nodes):
 points=clip.get('scaleKeyframes',[])[:32]
 if not points:return None
 # Crop runs before setpts, so convert its source-time T to timeline-local time.
 local=str(nodes[-1][1])
 for (x0,y0),(x1,y1) in reversed(list(zip(nodes,nodes[1:]))):
  slope=(y1-y0)/(x1-x0);local=f'if(lt(t,{x1:.9f}),{y0:.9f}+(t-{x0:.9f})*{slope:.9f},{local})'
 return keyframe_expression(points,duration,3,local,.1)

def spatial_filters(width,height,scale_expr,x_expr,y_expr):
 """Scale from the historical cover=1 baseline, then crop or pad to a fixed black canvas."""
 base_w=f'max({width},{height}*iw/ih)';base_h=f'max({height},{width}*ih/iw)'
 scaled_w=f'max(2,trunc(({base_w})*({scale_expr})/2)*2)';scaled_h=f'max(2,trunc(({base_h})*({scale_expr})/2)*2)'
 return [
  f"scale=w='{scaled_w}':h='{scaled_h}':eval=frame:flags=lanczos",
  f"crop=w='min(iw,{width})':h='min(ih,{height})':x='max(0,(iw-ow)*({x_expr}))':y='max(0,(ih-oh)*({y_expr}))'",
  f"pad=w={width}:h={height}:x='max(0,(ow-iw)*({x_expr}))':y='max(0,(oh-ih)*({y_expr}))':color=black",
  'setsar=1'
 ]

def ratio(s):
 try:
  a,b=str(s).split('/');return float(a)/float(b)
 except Exception:return number(s,30)

def capabilities():
 if not FFMPEG or not FFPROBE:return {'ready':False,'error':'FFmpeg / ffprobe をインストールしてください。'}
 f=subprocess.run([FFMPEG,'-hide_banner','-filters'],capture_output=True,text=True).stdout
 e=subprocess.run([FFMPEG,'-hide_banner','-encoders'],capture_output=True,text=True).stdout
 ready='libx264' in e;stabilization='vidstabtransform' in f;hdr='zscale' in f and 'tonemap' in f;drawtext='drawtext' in f;text_raster='overlay' in f;text=drawtext or text_raster;prores='prores_ks' in e;motion='minterpolate' in f
 return {'ready':ready,'complete':ready and stabilization and hdr and text and prores and motion,'stabilization':stabilization,'hdr':hdr,'text':text,'drawtext':drawtext,'textRaster':text_raster,'prores':prores,'motionInterpolation':motion,'videotoolbox':'h264_videotoolbox' in e,'build':'2.2.43','engine':'Native FFmpeg','version':subprocess.run([FFMPEG,'-version'],capture_output=True,text=True).stdout.splitlines()[0]}

def preflight_render(project,clips=None,caps=None):
 """Fail before rendering when the chosen edit needs a missing FFmpeg feature."""
 clips=clips if clips is not None else project.get('clips',[]);caps=caps or capabilities();missing=[]
 if not caps.get('ready'):missing.append('H.264（libx264）')
 if any(c.get('stabilization','OFF')!='OFF' and not c.get('freezeDuration') for c in clips if not c.get('gap')) and not caps.get('stabilization'):missing.append('手ぶれ補正（vidstab）')
 if any(c.get('interpolation') in ('motion','motion-max') for c in clips if not c.get('gap')) and not caps.get('motionInterpolation'):missing.append('高品質スロー（minterpolate）')
 if project.get('export',{}).get('codec','H.264').startswith('ProRes') and not caps.get('prores'):missing.append('Apple ProRes（prores_ks）')
 if any(MEDIA.get(c.get('media'),{}).get('hdr') for c in clips if not c.get('gap')) and not caps.get('hdr'):missing.append('HDR→SDR（zscale / tonemap）')
 texts=[t for t in project.get('texts',[]) if str(t.get('text',''))]
 raster_ready=caps.get('textRaster') and all(isinstance(t.get('raster'),dict) and str(t['raster'].get('data','')).startswith('data:image/png;base64,') for t in texts)
 if texts and not (raster_ready or caps.get('drawtext')):missing.append('文字描画（ブラウザ文字画像 / drawtext）')
 if missing:raise ValueError('この編集に必要なFFmpeg機能がありません：'+ '、'.join(missing)+'。Macエンジンの情報をご確認ください。')
 return True

def inspect(path,id,name):
 r=subprocess.run([FFPROBE,'-v','error','-show_streams','-show_format','-of','json',str(path)],capture_output=True,text=True,timeout=90)
 if r.returncode:raise ValueError(r.stderr[-1000:])
 d=json.loads(r.stdout);v=next((s for s in d['streams'] if s['codec_type']=='video' and not s.get('disposition',{}).get('attached_pic')),None);a=next((s for s in d['streams'] if s['codec_type']=='audio'),None)
 if not v and not a:raise ValueError('映像・音声ストリームが見つかりません。')
 v=v or {}; fmt=d.get('format',{});rotation=0
 for s in v.get('side_data_list',[]):rotation=s.get('rotation',rotation)
 w,h=v.get('width',0),v.get('height',0)
 if abs(rotation)%180==90:w,h=h,w
 trc=v.get('color_transfer','unknown');dolby=next((s for s in v.get('side_data_list',[]) if 'DOVI' in s.get('side_data_type','')),None)
 m={'id':id,'name':name,'path':str(path),'width':w,'height':h,'duration':number(fmt.get('duration',v.get('duration')),0,0), 'fps':ratio(v.get('avg_frame_rate','30/1')) or 30,'rateMode':'Checking' if w else '—','codec':v.get('codec_name',a.get('codec_name') if a else 'unknown'),'container':fmt.get('format_name',''),'size':path.stat().st_size,'audio':bool(a),'hdr':trc in ('smpte2084','arib-std-b67') or bool(dolby),'transfer':trc,'primaries':v.get('color_primaries','unknown'),'matrix':v.get('color_space','unknown'),'dolby':dolby,'rotation':rotation,'proxy':None}
 kind='image' if pathlib.Path(name).suffix.lower() in ('.jpg','.jpeg','.png','.webp') else 'video' if w else 'audio'
 m['kind']=kind
 if kind=='image':
  if not w or w*h>80000000:raise ValueError('静止画は8,000万画素以下にしてください。')
  m.update(duration=5,fps=0,rateMode='STILL',audio=False)
  thumb=ROOT/'cache'/(id+'-still.jpg')
  result=subprocess.run(BASE+['-i',str(path),'-frames:v','1','-vf',"scale=320:320:force_original_aspect_ratio=decrease",str(thumb)],capture_output=True,timeout=30)
  if result.returncode==0:m['thumb']=thumb.name
 save_media(m);return m

def save_media(m):
 MEDIA[m['id']]=m;p=ROOT/'media'/f"{m['id']}.json";tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(m));tmp.replace(p)

def public_media(m):
 result={k:v for k,v in m.items() if k!='path'}
 if result.get('proxy') and not (ROOT/'cache'/result['proxy']).is_file():result['proxy']=None
 return result

def check(job):
 if job.get('cancel'):raise InterruptedError('処理をキャンセルしました。')

class OutputValidationError(RuntimeError):
 pass


def validate_output(path,expected_duration=None,require_audio=False):
 """Check finalized container metadata before another process may consume it."""
 path=pathlib.Path(path)
 if not path.is_file() or path.stat().st_size<64:
  raise OutputValidationError('生成ファイルが空、または完成していません。')
 r=subprocess.run([FFPROBE,'-v','error','-show_streams','-show_format','-of','json',str(path)],capture_output=True,text=True,timeout=60)
 if r.returncode:
  raise OutputValidationError('生成ファイルを読み取れません。'+r.stderr[-900:])
 try:d=json.loads(r.stdout)
 except ValueError:raise OutputValidationError('生成ファイルの情報を取得できません。')
 streams=d.get('streams',[]);video=next((v for v in streams if v.get('codec_type')=='video'),None);audio=next((a for a in streams if a.get('codec_type')=='audio'),None)
 if path.suffix in ('.mp4','.mov') and not video:raise OutputValidationError('生成した動画に映像がありません。')
 if path.suffix=='.wav' and not audio:raise OutputValidationError('生成した音声が空です。')
 if require_audio and not audio:raise OutputValidationError('書き出し音声が見つかりません。')
 primary=video or audio or {};duration=number(primary.get('duration',d.get('format',{}).get('duration')),0)
 if duration<=0:raise OutputValidationError('生成した映像・音声の長さが0です。')
 tolerance=max(.15,2/(ratio(video.get('avg_frame_rate','30/1')) or 30)) if video else .15
 if expected_duration is not None and abs(duration-expected_duration)>tolerance:
  raise OutputValidationError(f'出力の長さが一致しません（予定 {expected_duration:.3f}秒 / 出力 {duration:.3f}秒）。')
 if require_audio and video:
  audio_duration=number(audio.get('duration',d.get('format',{}).get('duration')),0)
  if abs(audio_duration-duration)>tolerance:raise OutputValidationError('映像と音声の長さが一致しません。')
 return {'duration':duration,'bytes':path.stat().st_size,'video':video.get('codec_name') if video else None,'audio':audio.get('codec_name') if audio else None}


def _record(job,entry):
 events=job.setdefault('_events',[]);events.append(entry)
 if len(events)>200:del events[:-200]
 id=job.get('id')
 if id and all(c.isalnum() or c in '-_' for c in str(id)):
  path=ROOT/'logs'/f'{id}.json';temp=path.with_suffix('.tmp')
  try:
   temp.write_text(json.dumps({'job':id,'events':events},ensure_ascii=False,indent=2));temp.replace(path)
  except OSError:pass # A log write must not turn a valid render into a failed render.


def _run_once(job,args,duration=1,start=0,span=1,cwd=None):
 check(job);log=collections.deque(maxlen=40);began=time.monotonic();stage=job.get('operation','動画処理')
 proc=subprocess.Popen(BASE+['-progress','pipe:1','-nostats']+list(map(str,args)),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,cwd=cwd)
 job['_proc']=proc
 def stderr():
  for line in proc.stderr:log.append(line)
 t=threading.Thread(target=stderr,daemon=True);t.start()
 try:
  for line in proc.stdout:
   check(job)
   if line.startswith('out_time_us='):
    value=number(line.split('=')[1])/1e6
    job['progress']=max(job.get('progress',0),min(.999,start+span*max(0,min(1,value/max(.001,duration)))))
  code=proc.wait();t.join();check(job)
  if code:raise RuntimeError(''.join(log)[-2200:] or f'動画処理を終了できませんでした（code {code}）。')
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
  t.join(timeout=2)
  _record(job,{'stage':stage,'exitCode':proc.returncode,'seconds':round(time.monotonic()-began,3),'stderr':''.join(log)[-2200:]})
  proc.stdout.close();proc.stderr.close();job.pop('_proc',None)


def run(job,args,duration=1,start=0,span=1,cwd=None,verify_decode=False):
 """Only expose completed outputs; retry invalid generated media once, never input/config errors."""
 args=list(map(str,args));suffix=pathlib.Path(args[-1]).suffix.lower()
 if suffix not in ('.mp4','.mov','.wav','.jpg','.png'):
  return _run_once(job,args,duration,start,span,cwd)
 out=pathlib.Path(args[-1]);out=out if out.is_absolute() else pathlib.Path(cwd or pathlib.Path.cwd())/out
 staged=out.with_name('.'+out.stem+'-'+uuid.uuid4().hex+'.tmp'+suffix)
 original_stage=job.get('operation','動画処理')
 try:
  for attempt in range(2):
   check(job);staged.unlink(missing_ok=True);call_args=[*args[:-1],str(staged)]
   try:
    job['operation']=original_stage if attempt==0 else original_stage+'（再生成）'
    _run_once(job,call_args,duration,start,span,cwd)
    check(job)
    if suffix in ('.mp4','.mov','.wav'):
     job['operation']='生成ファイルを検証中'
     verified=validate_output(staged,duration,require_audio=verify_decode)
     if verify_decode:
      job['operation']='映像・音声を最後まで検証中'
      try:_run_once(job,['-xerror','-err_detect','explode','-i',str(staged),'-map','0:v:0','-map','0:a:0','-f','null','-'],duration,.98,.019)
      except RuntimeError as e:raise OutputValidationError('完成動画の再生検証に失敗しました。'+str(e)) from e
     _record(job,{'stage':original_stage,'attempt':attempt+1,'validation':'passed',**verified})
    elif not staged.is_file() or staged.stat().st_size==0:
     raise OutputValidationError('画像の生成が完了していません。')
    check(job);staged.replace(out);job['operation']=original_stage;return
   except OutputValidationError as e:
    _record(job,{'stage':original_stage,'attempt':attempt+1,'validation':'failed','reason':str(e)})
    if attempt:raise
    job['recoveredOutputs']=job.get('recoveredOutputs',0)+1
 finally:staged.unlink(missing_ok=True)

def submit(kind,fn,*args):
 id=uuid.uuid4().hex;j={'id':id,'kind':kind,'status':'queued','progress':0,'operation':'待機中','cancel':False};JOBS[id]=j
 def work():
  with GATE:
   try:
    check(j);j['status']='running';j['result']=fn(j,*args);j['status']='done';j['progress']=1
   except InterruptedError as e:j.update(status='cancelled',error=str(e))
   except Exception as e:j.update(status='error',error=str(e))
   finally:
    j.pop('_proc',None)
    # Job history has a fixed upper bound; files stay on disk until explicit cleanup.
    finished=[k for k,v in JOBS.items() if v['status'] in ('done','error','cancelled')]
    for k in finished[:-30]:JOBS.pop(k,None)
 threading.Thread(target=work,daemon=True).start();return id

def cancel(id):
 j=JOBS[id];j['cancel']=True;p=j.get('_proc')
 if p and p.poll() is None:p.terminate()

def tone(m,small=None):
 vf=[]
 if m['hdr']:
  dv=m.get('dolby') or {}
  transfer={'pq':'smpte2084','hlg':'arib-std-b67'}.get(m.get('transfer'),m.get('transfer'))
  if transfer not in ('smpte2084','arib-std-b67'):
   # Dolby Vision 8.4 identifies its HLG-compatible base layer with id 4.
   # Profile 5 has no SDR base layer, so use its PQ transfer for a bounded
   # fallback instead of rejecting the whole export.
   transfer='arib-std-b67' if dv.get('dv_bl_signal_compatibility_id')==4 else 'smpte2084'
  resize=f'w={small}:h=-2:' if small else ''
  tags='' if m.get('transfer') in ('smpte2084','arib-std-b67') else f'tin={transfer}:pin=bt2020:min=bt2020nc:'
  vf=[f'zscale={resize}{tags}t=linear:npl=100','format=gbrpf32le','zscale=p=bt709','tonemap=hable:desat=0','zscale=t=bt709:m=bt709:r=tv','format=yuv420p']
 elif small:vf=[f"scale='min({small},iw)':-2"]
 return vf

def prepare(job,id):
 m=MEDIA[id];job['operation']='素材を解析中';path=m['path']
 if not m['width']:return public_media(m)
 # Streaming PTS inspection: full file, O(1) working storage. Avoid accumulating frame arrays.
 p=subprocess.Popen([FFPROBE,'-v','error','-select_streams','v:0','-show_entries','packet=pts_time','-of','csv=p=0',path],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True);job['_proc']=p
 prev=None;deltas=set();count=0
 try:
  # Packet reordering is accounted for by a tiny reorder window.
  window=[]
  def consume(x):
   nonlocal prev,count
   if prev is not None and x>prev:deltas.add(round(x-prev,4))
   prev=x;count+=1
  import heapq
  for line in p.stdout:
   check(job)
   try:x=float(line.strip().split(',')[0])
   except ValueError:continue
   heapq.heappush(window,x)
   if len(window)>32:consume(heapq.heappop(window))
   if len(deltas)>10:break
  while window:consume(heapq.heappop(window))
 finally:
  if p.poll() is None:p.terminate()
  p.wait();p.stdout.close();job.pop('_proc',None)
 # Small timestamp quantization differences do not imply VFR.
 m['rateMode']='VFR' if deltas and max(deltas)-min(deltas)>.001 else 'CFR';save_media(m)
 out=ROOT/'cache'/f'{id}-proxy.mp4';job['operation']='SDRプロキシを生成中' if m['hdr'] else '720pプロキシを生成中'
 if out.exists():
  try:validate_output(out,m['duration'])
  except OutputValidationError:out.unlink();m['proxy']=None;save_media(m)
 if not out.exists():
  vf=tone(m,1280)+["scale=w='if(gte(iw,ih),min(iw,1280),-2)':h='if(gte(iw,ih),-2,min(ih,720))'",'fps=30','setsar=1']
  temp=out.with_name(out.stem+'.part.mp4')
  run(job,['-i',path,'-map','0:v:0','-map','0:a:0?','-vf',','.join(vf),'-c:v','libx264','-threads','2','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:a','aac','-b:a','128k','-movflags','+faststart',temp],m['duration'],0,.86)
  temp.replace(out)
 m['proxy']=out.name;save_media(m)
 job['operation']='サムネイルを作成中'
 for i in range(8):
  f=ROOT/'cache'/f'{id}-thumb-{i}.jpg'
  if not f.exists():run(job,['-ss',max(0,m['duration']*(i+.5)/8),'-i',out,'-frames:v','1','-vf','scale=160:-2','-update','1',f],1,.86+i*.012,.012)
 if m['audio']:
  job['operation']='音声波形を作成中';f=ROOT/'cache'/f'{id}-wave.png'
  if not f.exists():waveform(job,out,f,m['duration'])
 return public_media(m)

def waveform(job,source,out,duration):
 width,height=1200,80;peaks=[0]*width;index=0;rate=8000;expected=max(1,duration*rate)
 proc=subprocess.Popen(BASE+['-v','error','-i',str(source),'-vn','-ac','1','-ar',str(rate),'-f','s16le','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL);job['_proc']=proc
 try:
  while True:
   check(job);b=proc.stdout.read(8192)
   if not b:break
   samples=array.array('h');samples.frombytes(b)
   for v in samples:
    bucket=min(width-1,int(index/expected*width));peaks[bucket]=max(peaks[bucket],abs(v));index+=1
   job['progress']=min(.999,.96+.039*index/expected)
  if proc.wait():raise ValueError('音声波形を生成できませんでした。')
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
  proc.stdout.close();job.pop('_proc',None)
 rows=bytearray()
 for y in range(height):
  rows.append(0)
  for x in range(width):
   on=abs(y-height/2)<=max(1,peaks[x]/32768*(height/2-2));rows.extend((155,173,169,220) if on else (0,0,0,0))
 def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
 out.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(rows)))+chunk(b'IEND',b''))

def curve_value(t,a,b,kind):
 if kind=='constant':return a
 if kind=='ease-in':t=t*t
 elif kind=='ease-out':t=1-(1-t)**2
 elif kind=='ease-in-out':t=t*t*(3-2*t)
 return a+(b-a)*t

def timing(c):
 if c.get('freezeDuration'):
  d=number(c['freezeDuration'],1,1/30,60);x=max(.00001,c['out']-c['in']);return [(0,0),(x,d)],[(0,x,1,d)]
 if c.get('timingBase') and not c.get('gap'):
  base={k:c['timingBase'].get(k) for k in ('in','out','speed','endSpeed','curve')}
  nodes0,pieces0=timing(base);pieces=[];nodes=[(0,0)];elapsed=0
  for a,b,s,*_ in [(-math.inf,0,pieces0[0][2])]+pieces0+[(nodes0[-1][0],math.inf,pieces0[-1][2])]:
   x=max(c['in'],base['in']+a);y=min(c['out'],base['in']+b)
   if y<=x:continue
   d=(y-x)/s;pieces.append((x-c['in'],y-c['in'],s,d));elapsed+=d;nodes.append((y-c['in'],elapsed))
  return nodes,pieces
 if c.get('gap'):
  d=number(c['gap'],1,.01,86400);return [(0,0),(d,d)],[(0,d,1,d)]
 d=c['out']-c['in'];a=number(c.get('speed'),1,.05,20);b=number(c.get('endSpeed'),a,.05,20);kind=c.get('curve','constant')
 n=1 if kind=='constant' or a==b else 32
 nodes=[(0,0)];pieces=[];elapsed=0
 for i in range(n):
  x=d*i/n;y=d*(i+1)/n;s=curve_value((i+.5)/n,a,b,kind);length=(y-x)/s
  pieces.append((x,y,s,length));elapsed+=length;nodes.append((y,elapsed))
 return nodes,pieces

def validate(project):
 if project.get('version')!=1:raise ValueError('対応していないプロジェクト形式です。')
 clips=project.get('clips',[])
 if not clips or len(clips)>200:raise ValueError('クリップ数は1〜200です。')
 for c in clips:
  if c.get('gap'):
   c['gap']=number(c['gap'],1,.01,86400);continue
  if c.get('media') not in MEDIA:raise ValueError('元素材を再リンクしてください。')
  m=MEDIA[c['media']]
  if not m['width']:raise ValueError('動画素材を選択してください。')
  c['in']=number(c.get('in'),0,0,3600 if m.get('kind')=='image' else m['duration']);c['out']=number(c.get('out'),m['duration'],0,3600 if m.get('kind')=='image' else m['duration'])
  if c['out']-c['in']<.001:raise ValueError('IN / OUT の範囲が無効です。')
 return clips

def output_size(project,m,preview=False):
 r=project.get('aspect','Original');ratios={'9:16':9/16,'4:5':.8,'1:1':1,'16:9':16/9};ar=ratios.get(r,m['width']/m['height']);res=project.get('export',{}).get('resolution','1080p')
 short=540 if preview else 2160 if res=='4K' else 1440 if res=='1440p' else min(m['width'],m['height']) if res=='Source' else 1080
 return (max(2,round((short*ar if ar>=1 else short)/2)*2),max(2,round((short if ar>=1 else short/ar)/2)*2))

def atempo(speed):
 filters=[]
 while speed<.5:filters.append('atempo=0.5');speed/=.5
 while speed>2:filters.append('atempo=2');speed/=2
 filters.append(f'atempo={speed:.9f}');return ','.join(filters)

def color_filters(col,amount=1):
 return matched_color_filters(col,ROOT/'cache',amount)

def freeze_seek(job,m,at):
 """Resolve the displayed frame by its timestamp, including VFR / end-of-file."""
 check(job)
 r=subprocess.run([FFPROBE,'-v','error','-select_streams','v:0','-read_intervals',f'{max(0,at-2)}%{at+.1}','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',m['path']],capture_output=True,text=True,timeout=90)
 check(job)
 if r.returncode:raise ValueError('静止フレームの時刻を確認できません。')
 stamps=[float(f['best_effort_timestamp_time']) for f in json.loads(r.stdout).get('frames',[]) if 'best_effort_timestamp_time' in f]
 previous=[s for s in stamps if s<=at+1e-7]
 if not previous:raise ValueError('静止フレームを読み込めません。少し前の位置で再試行してください。')
 return max(previous)

def visible_clips(clips,fps=None):
 """Absolute three-track visibility; upper/later clips replace image and source audio."""
 ends=[0.,0.,0.];rows=[]
 for c in clips:
  layer=int(number(c.get('layer'),0,0,2))
  d=timing(c)[0][-1][1]+(0 if c.get('gap') else number(c.get('hold'),0,0,10))
  start=number(c.get('start'),ends[layer],0,86400)
  rows.append((c,start,start+d,layer));ends[layer]=max(ends[layer],start+d)
 edges=sorted(set([0.]+[v for _,a,b,_ in rows for v in (a,b)]));windows=[]
 for a,b in zip(edges,edges[1:]):
  if b-a<1e-9:continue
  active=[r for r in rows if not r[0].get('gap') and r[1]<=(a+b)/2<r[2]]
  row=max(enumerate(active),key=lambda item:(item[1][3],item[0]))[1] if active else None
  c,start,_,_=row if row else ({'gap':b-a},a,b,0)
  if windows and row and windows[-1].get('_origin') is c:
   windows[-1]['_window'][1]=b-windows[-1]['_at'];continue
  copy=dict(c);copy['_origin']=c;copy['_at']=a;copy['_window']=[a-start,b-a];windows.append(copy)
 if fps:
  quantized=[]
  for c in windows:
   offset,d=c['_window'];a=math.ceil(c['_at']*fps-1e-8)/fps;b=math.ceil((c['_at']+d)*fps-1e-8)/fps
   if b-a<1e-8:continue
   c['_window']=[max(0,offset+a-c['_at']),b-a];c['_at']=a
   quantized.append(c)
  windows=quantized
 return windows

def text_raster(text,work,index):
 """Decode a browser-rasterized text layer with strict size and PNG checks."""
 raster=text.get('raster') if isinstance(text,dict) else None
 data=raster.get('data','') if isinstance(raster,dict) else ''
 prefix='data:image/png;base64,'
 if not data.startswith(prefix):return None
 try:payload=base64.b64decode(data[len(prefix):],validate=True)
 except (ValueError,binascii.Error):raise ValueError('文字画像を読み取れません。もう一度書き出してください。')
 if len(payload)>8*1024*1024 or not payload.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError('文字画像の形式またはサイズが無効です。')
 path=work/f'text-{index}.png';path.write_bytes(payload);return path

def output_encoding(export,preview,crf):
 """Return one uniform mezzanine/final encoding contract for concat-safe parts."""
 profiles={'ProRes 422 LT':'lt','ProRes 422':'standard','ProRes 422 HQ':'hq'}
 profile=None if preview else profiles.get(export.get('codec'))
 if profile:
  return {'extension':'.mov','pixel':'yuv422p10le','label':export.get('codec'),'video':['-c:v','prores_ks','-profile:v',profile,'-pix_fmt','yuv422p10le','-vendor','apl0'],'audio':['-c:a','pcm_s24le','-ar','48000']}
 requested_video=number(export.get('videoBitrate'),0,0,200) if export.get('videoBitrate') not in (None,'','Auto') else 0
 requested_audio=number(export.get('audioBitrate'),0,0,320) if export.get('audioBitrate') not in (None,'','Auto') else 0
 audio_rate=f'{round(requested_audio)}k' if requested_audio else ('320k' if export.get('preset')=='YOUTUBE' and export.get('quality') in ('High','Maximum') and not preview else '192k')
 rate=['-b:v',f'{requested_video:g}M','-maxrate',f'{requested_video*1.35:g}M','-bufsize',f'{requested_video*2:g}M'] if requested_video and not preview else ['-crf',str(crf)]
 return {'extension':'.mp4','pixel':'yuv420p','label':'H.264','video':['-c:v','libx264','-preset','veryfast' if preview else 'fast','-threads','2',*rate,'-pix_fmt','yuv420p'],'audio':['-c:a','aac','-b:a',audio_rate,'-ar','48000']}

def motion_interpolation_filter(fps, aggressive=False):
 # UMH searches a wider, less regular motion field than EPZS. This path is
 # explicitly selected as high-quality slow motion, so spend CPU to reduce
 # block-vector errors around diagonal and irregular movement.
 search=64 if aggressive else 32
 block=8 if aggressive else 16
 return f'minterpolate=fps={fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:me=umh:mb_size={block}:search_param={search}:vsbmc=1:scd=fdiff:scd_threshold=10'

def stabilization_filters(mode,trf='motion.trf'):
 """High accuracy detection plus conservative, profile-specific camera smoothing."""
 profiles={
  'WEAK':(3,6,0.28),'MEDIUM':(5,14,0.20),'STRONG':(8,28,0.12),
  'HANDHELD':(7,10,0.18),'NATURAL':(5,12,0.16),'GIMBAL':(6,24,0.10),'HORIZON':(8,42,0.07),'TRIPOD':(9,50,0.06)
 }
 profiles['AGGRESSIVE']=(10,72,0.025)
 shakiness,smoothing,zoomspeed=profiles.get(mode,profiles['MEDIUM'])
 detect=f'vidstabdetect=shakiness={shakiness}:accuracy=15:stepsize=2:mincontrast=0.15:show=0:result={trf}'
 transform=f'vidstabtransform=input={trf}:smoothing={smoothing}:optalgo=gauss:optzoom=2:zoomspeed={zoomspeed}:crop=black:interpol=bicubic'
 return detect,transform

def clip_transition(c,clips=None,fps=30):
 """Normalize a Canva-style transition attached to the incoming clip."""
 value=c.get('transition') if isinstance(c.get('transition'),dict) else {}
 kind=value.get('type','none')
 if kind not in ('dissolve','slide','wipe','circle'):return None
 previous_clip=None
 if clips is not None:
  layer=int(number(c.get('layer'),0,0,2));ends=[0.,0.,0.];rows=[]
  for item in clips:
   item_layer=int(number(item.get('layer'),0,0,2));duration=timing(item)[0][-1][1]+(0 if item.get('gap') else number(item.get('hold'),0,0,10));start=number(item.get('start'),ends[item_layer],0,86400);rows.append((item,start,start+duration,item_layer));ends[item_layer]=max(ends[item_layer],start+duration)
  current=next((row for row in rows if row[0].get('id')==c.get('id')),None)
  previous=max((row for row in rows if current and row[0] is not current[0] and row[3]==layer and not row[0].get('gap') and row[2]<=current[1]+1e-7),key=lambda row:row[2],default=None)
  if not current or not previous or abs(previous[2]-current[1])>1/max(1,fps):return None
  previous_clip=previous[0]
 direction=value.get('direction','left')
 if direction not in ('left','right','up','down'):direction='left'
 return {'type':kind,'direction':direction,'duration':number(value.get('duration'),.6,.1,2),'previous':previous_clip}

def transition_video_graph(value,duration,window_duration,w,h,fps,pixel):
 """Build the same smoothstep transition used by browser preview/export."""
 phase=f'min(max(T/{duration:.9f},0),1)';ease=f'({phase})*({phase})*(3-2*({phase}))'
 prepare=(f"[0:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={duration:.9f},format={pixel},settb=AVTB[old];"
          f"[1:v]format={pixel},settb=AVTB,setpts=PTS-STARTPTS[new];")
 kind=value['type'];direction=value['direction']
 if kind=='slide':
  p=f'min(max(t/{duration:.9f},0),1)';e=f'({p})*({p})*(3-2*({p}))'
  if direction=='left':old_x,new_x=f'-main_w*({e})',f'main_w*(1-({e}))';old_y=new_y='0'
  elif direction=='right':old_x,new_x=f'main_w*({e})',f'-main_w*(1-({e}))';old_y=new_y='0'
  elif direction=='up':old_y,new_y=f'-main_h*({e})',f'main_h*(1-({e}))';old_x=new_x='0'
  else:old_y,new_y=f'main_h*({e})',f'-main_h*(1-({e}))';old_x=new_x='0'
  return prepare+(f"color=c=black:s={w}x{h}:r={fps}:d={window_duration:.9f}[base];"
                  f"[base][old]overlay=x='{old_x}':y='{old_y}':eval=frame[tmp];"
                  f"[tmp][new]overlay=x='{new_x}':y='{new_y}':eval=frame,"
                  f"trim=duration={window_duration:.9f},setpts=PTS-STARTPTS[v]")
 if kind=='dissolve':expr=f'A*(1-({ease}))+B*({ease})'
 elif kind=='circle':expr=f'if(lte(hypot(X-W/2,Y-H/2),hypot(W,H)/2*({ease})),B,A)'
 elif direction=='left':expr=f'if(lt(X,W*({ease})),B,A)'
 elif direction=='right':expr=f'if(gte(X,W*(1-({ease}))),B,A)'
 elif direction=='up':expr=f'if(lt(Y,H*({ease})),B,A)'
 else:expr=f'if(gte(Y,H*(1-({ease}))),B,A)'
 return prepare+f"[old][new]blend=all_expr='{expr}',trim=duration={window_duration:.9f},setpts=PTS-STARTPTS[v]"

def render(job,project,preview=False,_token=None,_size=None):
 audio_clips=validate_audio(project)
 overlay_end=max([0]+[number(e.get('start'),0,0,86400)+number(e.get('duration'),.6,1/60,86400) for e in project.get('effects',[])]+[number(t.get('end'),0,0,86400) for t in project.get('texts',[])])
 render_project=project if project.get('clips') else {**project,'clips':[{'gap':max(overlay_end,audio_extent(audio_clips),1/30),'start':0}]}
 source_clips=validate(render_project);timeline_end=max([overlay_end]+[c['_at']+c['_window'][1] for c in visible_clips(source_clips)]);tracks=project.get('videoTracks',[]);clips=[c for c in source_clips if not (len(tracks)>int(number(c.get('layer'),0,0,2)) and tracks[int(number(c.get('layer'),0,0,2))].get('hidden'))];caps=capabilities();preflight_render(project,clips,caps=caps);first=next((MEDIA[c['media']] for c in clips if c.get('media') in MEDIA),next((MEDIA[c['media']] for c in source_clips if c.get('media') in MEDIA),{'width':1920,'height':1080,'fps':30}));w,h=_size or output_size(project,first,preview);exp=project.get('export',{});fps=number(exp.get('fps'),(first['fps'] or 30) if exp.get('fps')=='Source' else 30,1,240)
 if preview:fps=min(30,fps)
 fps=min(60,fps) # SNS V1 delivery contract
 video_end=max([0]+[c['_at']+c['_window'][1] for c in visible_clips(clips)]);required_end=max(timeline_end,audio_extent(audio_clips))
 if required_end>video_end:clips=[*clips,{'gap':required_end-video_end,'start':video_end}]
 raw_clips=copy.deepcopy(clips)
 clips=visible_clips(clips,fps)
 crf={'Preview':28,'Standard':21,'High':18,'Maximum':15}.get(exp.get('quality'),21)
 encoding=output_encoding(exp,preview,crf);ext=encoding['extension'];pixel=encoding['pixel'];video_args=encoding['video'];audio_args=encoding['audio']
 token=_token or job['id']
 work=ROOT/'cache'/('render-'+token);work.mkdir();outputs=[];total=sum(c['_window'][1] for c in clips);done=0;lower_paths={}
 try:
  for target in (1,2):
   if not any(c.get('layer')==target and (c.get('fadeIn') or c.get('fadeOut') or c.get('opacity',1)<1 or c.get('opacityKeyframes')) for c in raw_clips):continue
   ends=[0.,0.,0.];lower=[]
   for c in raw_clips:
    layer=int(number(c.get('layer'),0,0,2));d=timing(c)[0][-1][1]+c.get('hold',0);start=c.get('start',ends[layer]);ends[layer]=max(ends[layer],start+d)
    if layer<target:lower.append({**c,'start':start,'layer':layer})
   lower.append({'gap':.001,'start':max(0,total-.001)})
   base={**project,'clips':lower,'texts':[],'effects':[],'bgm':{},'audioClips':[]}
   lr=render(job,base,preview,_token=token+'-lower'+str(target),_size=(w,h));lower_paths[target]=ROOT/('cache' if preview else 'exports')/lr['file']
  for idx,c in enumerate(clips):
   if c.get('gap'):
    d=c['_window'][1];part=work/f'clip-{idx:04d}{ext}';outputs.append(part);job['operation']='空白区間を生成中'
    run(job,['-f','lavfi','-i',f'color=c=black:s={w}x{h}:r={fps}','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',d,*video_args,*audio_args,'-video_track_timescale','90000',part],d,done/max(total,.001)*.85,d/max(total,.001)*.85)
    done+=d;continue
   check(job);m=MEDIA[c['media']];nodes,pieces=timing(c);duration=nodes[-1][1];hold=number(c.get('hold'),0,0,10);vf=tone(m);source=m['path'];source_duration=c['out']-c['in'];seek=c['in'];audio_source=source;audio_seek=seek;job['operation']=f'クリップ {idx+1}/{len(clips)} を処理中'
   stabil='OFF' if m.get('kind')=='image' or c.get('freezeDuration') else c.get('stabilization','OFF')
   if stabil!='OFF':
    if not caps['stabilization']:raise ValueError('このFFmpegにはvidstabがありません。libvidstab対応版が必要です。')
    # Stabilize before time remapping. Each selected source segment is streamed to disk, not RAM.
    trf='motion.trf';pre=work/'stabilized.mov';detect_filter,transform_filter=stabilization_filters(stabil,trf)
    job['operation']=f'手ぶれの解析 {idx+1}/{len(clips)}'
    run(job,['-ss',seek,'-i',source,'-t',source_duration,'-an','-vf',','.join(vf+[detect_filter]),'-f','null','-'],source_duration,done/max(total,.001)*.85,.02,cwd=work)
    job['operation']='手ぶれを補正中'
    intermediate=['-c:v','prores_ks','-profile:v','hq','-pix_fmt','yuv422p10le','-vendor','apl0'] if caps.get('prores') else ['-c:v','libx264','-preset','fast','-crf','8','-pix_fmt','yuv420p']
    run(job,['-ss',seek,'-i',source,'-t',source_duration,'-an','-vf',','.join(vf+[transform_filter,'format=yuv422p10le' if caps.get('prores') else 'format=yuv420p']),*intermediate,pre],source_duration,done/max(total,.001)*.85,.03,cwd=work)
    source=str(pre);seek=0;vf=[]
   if c.get('freezeDuration'):
    if m.get('kind')!='image':seek=freeze_seek(job,m,number(c.get('freezeAt'),c['in'],0,m['duration']));source_duration=max(.2,source_duration)
    vf+=['select=eq(n\\,0)']
   if m.get('kind')=='image':vf+=['format=rgba','premultiply=inplace=1','format=rgb24']
   scale=number(c.get('scale'),1,.1,3);x=number(c.get('x'),.5,0,1);y=number(c.get('y'),.5,0,1)
   preset=c.get('motionPreset','none');amount=number(c.get('motionAmount'),.12,0,.5);progress=f'min(max(t/{max(source_duration,.001):.9f},0),1)';ease=f'({progress})*({progress})*(3-2*({progress}))';scale_expr=scale_keyframe_expression(c,duration,nodes) or str(scale);x_expr=str(x);y_expr=str(y)
   if preset=='pan-left':x_expr=f'max(0,min(1,{x}+{amount}*(.5-({ease}))))'
   elif preset=='pan-right':x_expr=f'max(0,min(1,{x}+{amount}*(({ease})-.5)))'
   elif preset=='pan-up':y_expr=f'max(0,min(1,{y}+{amount}*(.5-({ease}))))'
   elif preset=='pan-down':y_expr=f'max(0,min(1,{y}+{amount}*(({ease})-.5)))'
   grade=color_filters(c.get('color',{}),number(c.get('lookAmount'),1,0,1.5));vf+=(['format=gbrpf32le']+grade if grade else [])
   if preset=='push-in' and not c.get('scaleKeyframes'):scale_expr=f'min(3,{scale}*(1+{amount}*({ease})))'
   elif preset=='pull-out' and not c.get('scaleKeyframes'):scale_expr=f'min(3,{scale}*(1+{amount}*(1-({ease}))))'
   vf.extend(spatial_filters(w,h,scale_expr,x_expr,y_expr))
   vf+=['settb=AVTB','setpts=PTS-STARTPTS']
   # Use the same 32-piece integral as the browser timeline. Source PTS handles VFR.
   expr=f'{duration:.9f}'
   for (x0,y0),(x1,y1) in reversed(list(zip(nodes,nodes[1:]))):expr=f'if(lt(T,{x1:.9f}),{y0:.9f}+(T-{x0:.9f})*{(y1-y0)/(x1-x0):.9f},{expr})'
   vf.append(f"setpts='{expr}/TB'")
   if c.get('interpolation') in ('motion','motion-max'):vf.append(motion_interpolation_filter(fps,c.get('interpolation')=='motion-max'))
   elif c.get('interpolation')=='blend':vf.append(f'framerate=fps={fps}:interp_start=0:interp_end=255:scene=100')
   else:vf.append(f'fps={fps}')
   # Linux zscale cannot infer a conversion path from RGB stills or untagged
   # SDR video. Use it only when the source color space is explicit; 8-bit
   # untagged inputs use swscale's deterministic BT.709 conversion instead.
   tagged=all(m.get(k) not in (None,'','unknown') for k in ('transfer','primaries','matrix'))
   precision_convert='zscale=matrix=709:range=limited:dither=error_diffusion' if caps.get('hdr') and m.get('kind')!='image' and tagged else 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int:sws_dither=auto'
   vf+=['fps='+str(fps),'tpad=stop_mode=clone:stop=-1',f'trim=duration={duration+hold}',precision_convert,f'format={pixel}','setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709']
   # Source audio is mixed per video layer after picture compositing. Keeping
   # these clip parts silent avoids duplicating the visible layer's audio.
   graph=['[0:v]'+','.join(vf)+'[v]'];audio=c.get('audio',{});volume=0
   input_args=['-loop','1','-framerate',fps,'-t',source_duration,'-i',source] if m.get('kind')=='image' else ['-ss',seek,'-t',source_duration,'-i',source]
   if m['audio'] and not c.get('freezeDuration') and len(pieces)>1:
    # Render ramp audio pieces sequentially to disk. No full-length asplit queues in RAM.
    audio_parts=[]
    for k,(a,b,s,length) in enumerate(pieces):
     ap=work/f'audio-{k:03d}.wav';audio_parts.append(ap)
     af=f'atrim=duration={b-a},asetpts=PTS-STARTPTS,apad=pad_dur=1,{atempo(s)},apad,atrim=duration={length},asetpts=N/SR/TB'
     run(job,['-ss',audio_seek+a,'-i',audio_source,'-vn','-af',af,'-c:a','pcm_f32le','-ar','48000','-ac','2',ap],length,done/max(total,.001)*.85,0)
    alist=work/'audio-concat.txt';alist.write_text(''.join(f"file '{p.name}'\n" for p in audio_parts));audio_ramp=work/'ramp.wav'
    run(job,['-f','concat','-safe','0','-i',alist,'-c','copy',audio_ramp],duration,done/max(total,.001)*.85,0)
    input_args+=['-i',audio_ramp]
    graph.append(f'[1:a]volume={volume},apad,atrim=duration={duration+hold},asetpts=N/SR/TB[mix]')
   elif m['audio'] and not c.get('freezeDuration'):
    audio_index=0
    if source!=audio_source:
     audio_index=sum(1 for value in input_args if value=='-i');input_args+=['-ss',audio_seek,'-t',source_duration,'-i',audio_source]
    s=pieces[0][2]
    graph.append(f'[{audio_index}:a]asetpts=PTS-STARTPTS,apad=pad_dur=1,{atempo(s)},volume={volume},apad,atrim=duration={duration+hold},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=N/SR/TB[mix]')
   else:graph.append(f'anullsrc=r=48000:cl=stereo,atrim=duration={duration+hold}[mix]')
   fadein=number(audio.get('fadeIn'),0,0,duration/2);fadeout=number(audio.get('fadeOut'),0,0,duration/2);gain_keys=audio.get('gainKeyframes',[])
   gain_filter=f"volume='{keyframe_expression(gain_keys,duration+hold,2,'t')}':eval=frame," if gain_keys else ''
   graph.append(f'[mix]{gain_filter}afade=t=in:d={max(.001,fadein)},afade=t=out:st={max(0,duration+hold-fadeout)}:d={max(.001,fadeout)}[a]')
   offset,window_duration=c['_window']
   graph[0]=graph[0].replace('[v]',f',trim=start={offset}:duration={window_duration},setpts=PTS-STARTPTS[v]')
   graph[-1]=graph[-1].replace('[a]',f',atrim=start={offset}:duration={window_duration},asetpts=PTS-STARTPTS[a]')
   fi=number(c.get('fadeIn'),0,0,(duration+hold)/2);fo=number(c.get('fadeOut'),0,0,(duration+hold)/2);opacity=number(c.get('opacity'),1,0,1);opacity_keys=c.get('opacityKeyframes',[])
   if fi or fo or opacity<1 or opacity_keys:
    ai=f'(T+{offset})/{fi}' if fi else '1';ao=f'({duration+hold}-T-{offset})/{fo}' if fo else '1'
    alpha=f'({opacity_expression(c,duration+hold,offset)})*max(0,min(1,min({ai},{ao})))'
    graph[0]=graph[0].replace('[v]','[top]')
    if c.get('layer') in lower_paths:
     index=sum(1 for a in input_args if a=='-i');input_args+=['-ss',c['_at'],'-i',str(lower_paths[c.get('layer')])]
     graph.append(f'[{index}:v]setpts=PTS-STARTPTS[lower]')
    else:graph.append(f'color=c=black:s={w}x{h}:r={fps}:d={window_duration}[lower]')
    graph.append(f"[lower][top]blend=all_expr='A*(1-({alpha}))+B*({alpha})':shortest=1[v]")
   part=work/f'clip-{idx:04d}{ext}';outputs.append(part)
   script=work/'graph.txt';script.write_text(';\n'.join(graph))
   job['operation']=f'クリップ {idx+1}/{len(clips)} を書き出し中'
   run(job,input_args+['-filter_complex_script',script,'-map','[v]','-map','[a]',*video_args,*audio_args,'-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-video_track_timescale','90000',part],window_duration,done/max(total,.001)*.85,window_duration/max(total,.001)*.85)
   transition=clip_transition(c,raw_clips,fps)
   if transition and len(outputs)>1 and offset<1/fps+1e-7:
    td=min(transition['duration'],window_duration);previous=outputs[-2];blended=work/f'clip-{idx:04d}-transition{ext}'
    # Continue the outgoing source beyond its edit point when a media handle is
    # available. Only clips cut at the physical end of a file fall back to the
    # final frame, matching the browser and device renderers.
    previous_clip=transition.get('previous') or {};previous_media=MEDIA.get(previous_clip.get('media'));old_input=['-sseof',str(-1/max(1,fps)),'-i',previous]
    available=max(0,number(previous_media.get('duration'),0)-number(previous_clip.get('out'),0)) if previous_media and previous_media.get('kind')!='image' and not previous_clip.get('freezeDuration') else 0
    if available>1e-4:
     natural_speed=max(.05,number(previous_clip.get('endSpeed'),previous_clip.get('speed',1),.05,20));source_span=min(available,td*natural_speed);tail_speed=max(.05,source_span/td);tail=work/f'clip-{idx:04d}-outgoing{ext}'
     tail_vf=tone(previous_media);tail_grade=color_filters(previous_clip.get('color',{}),number(previous_clip.get('lookAmount'),1,0,1.5));tail_vf+=(['format=gbrpf32le']+tail_grade if tail_grade else [])
     tail_vf+=spatial_filters(w,h,number(previous_clip.get('scale'),1,.1,3),number(previous_clip.get('x'),.5,0,1),number(previous_clip.get('y'),.5,0,1))
     tagged=all(previous_media.get(k) not in (None,'','unknown') for k in ('transfer','primaries','matrix'));tail_precision='zscale=matrix=709:range=limited:dither=error_diffusion' if caps.get('hdr') and tagged else 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int:sws_dither=auto'
     tail_vf+=['settb=AVTB',f'setpts=(PTS-STARTPTS)/{tail_speed:.9f}',f'fps={fps}',f'tpad=stop_mode=clone:stop_duration={td:.9f}',f'trim=duration={td:.9f}',tail_precision,f'format={pixel}','setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709']
     run(job,['-ss',number(previous_clip.get('out'),0),'-t',source_span,'-i',previous_media['path'],'-an','-vf',','.join(tail_vf),*video_args,'-video_track_timescale','90000',tail],td,done/max(total,.001)*.85,0);old_input=['-i',tail]
    graph=transition_video_graph(transition,td,window_duration,w,h,fps,pixel)
    job['operation']=f"トランジション {idx+1}/{len(clips)} を合成中"
    run(job,[*old_input,'-i',part,'-filter_complex',graph,'-map','[v]','-map','1:a?',*video_args,'-c:a','copy','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-video_track_timescale','90000',blended],window_duration,done/max(total,.001)*.85,0)
    part.unlink();blended.replace(part)
   done+=window_duration
   if (work/'stabilized.mov').exists():(work/'stabilized.mov').unlink()
  concat=work/'concat.txt';concat.write_text(''.join(f"file '{p.name}'\n" for p in outputs));joined=work/('joined'+ext)
  job['operation']='クリップを結合中';run(job,['-f','concat','-safe','0','-i',concat,'-c','copy',joined],total,.85,.04)
  overlay_tracks=project.get('overlayTracks',[]);overlay_visible=lambda item:not (len(overlay_tracks)>int(number(item.get('layer'),0,0,2)) and overlay_tracks[int(number(item.get('layer'),0,0,2))].get('hidden'));effects=[e for e in project.get('effects',[]) if overlay_visible(e)]
  if len(effects)>100:raise ValueError('画面効果は最大100個です。')
  for i,e in enumerate(effects):
   kind=e.get('type')
   if kind not in ('flash','black-in','black-out'):continue
   start=number(e.get('start'),0,0,total);d=number(e.get('duration'),.6,1/60,30);hold=number(e.get('hold'),0,0,max(0,d-1/60));transition=max(1/60,d-hold);strength=number(e.get('strength'),1,0,1)
   if start>=total or strength==0:continue
   color='white' if kind=='flash' else 'black';direction='in' if kind=='black-out' else 'out';fade_start=hold if kind=='black-in' else 0;fade_duration=transition if kind!='flash' else d;fx=work/f'fx-{i}{ext}'
   graph=f"[1:v]format=rgba,colorchannelmixer=aa={strength},fade=t={direction}:st={fade_start}:d={fade_duration}:alpha=1,setpts=PTS-STARTPTS+{start}/TB[fx];[0:v][fx]overlay=eof_action=pass:repeatlast=0:enable='gte(t,{start})*lt(t,{start+d})'[v]"
   job['operation']=f'画面効果 {i+1}/{len(effects)} を合成中'
   run(job,['-i',joined,'-f','lavfi','-t',d,'-i',f'color=c={color}:s={w}x{h}:r={fps}','-filter_complex',graph,'-map','[v]','-map','0:a','-t',total,*video_args,'-c:a','copy',fx],total,.89,0)
   joined=fx
  bgm=project.get('bgm',{});texts=[t for t in project.get('texts',[]) if overlay_visible(t)];final_vf=[];raster_layers=[]
  if len(texts)>300:raise ValueError('テロップは最大300個です。')
  for i,t in enumerate(texts):
   text=str(t.get('text',''))[:2000]
   if not text:continue
   size=number(t.get('size'),48,8,300)*h/1080;tx=number(t.get('x'),.5,0,1);ty=number(t.get('y'),.85,0,1);op=number(t.get('opacity'),1,0,1);a=number(t.get('start'),0,0,total);b=number(t.get('end'),total,0,total);fade=number(t.get('fade'),0,0,max(0,(b-a)/2));font={'Sans':'Arial','Serif':'Times New Roman','Mono':'Courier New'}.get(t.get('font'),'Arial');align=t.get('align','center')
   if b<=a:continue
   fi=number(t.get('fadeIn',fade),0,0,max(0,(b-a)/2));fo=number(t.get('fadeOut',fade),0,0,max(0,(b-a)/2));md=number(t.get('motionDuration'),.4,.001,max(.001,(b-a)/2))
   ai=f'(t-{a})/{fi}' if fi else '1';ao=f'({b}-t)/{fo}' if fo else '1';alpha=f'{op}*max(0,min(1,min({ai},{ao})))'
   u=f'clip((t-{a})/{md},0,1)';v=f'clip((t-({b}-{md}))/{md},0,1)';shift=f'.06*(1-({u})*({u})*(3-2*({u}))-({v})*({v})*(3-2*({v})))';yp=f'h*{ty}-th/2'
   raster=text_raster(t,work,i)
   if raster:
    d=b-a;raster_info=t.get('raster',{});rw=max(1,number(raster_info.get('width'),1,1,8192));rh=max(1,number(raster_info.get('height'),1,1,8192));anchor_x=number(raster_info.get('anchorX'),rw/2,0,rw)/rw;anchor_y=number(raster_info.get('anchorY'),rh/2,0,rh)/rh;xp=f'main_w*{tx}-overlay_w*{anchor_x:.9f}';yp=f'main_h*{ty}-overlay_h*{anchor_y:.9f}'
    if t.get('motion')=='rise':yp+=f'+main_h*({shift})'
    if t.get('motion')=='slide-left':xp+=f'+main_w*({shift})'
    ref_h=max(1,number(raster_info.get('referenceHeight'),1080,1,8192));base_scale=min(h/ref_h,w*.92/rw,h*.9/rh);scale_filter=f"scale=w='iw*{base_scale:.9f}':h=-1:flags=lanczos"
    if t.get('motion')=='pop':
     phase=f'max(0,min(1,t/{md}))';ease_scale=f'({phase})*({phase})*(3-2*({phase}))';scale_filter=f"scale=w='iw*{base_scale:.9f}*(.82+.18*({ease_scale}))':h=-1:flags=lanczos:eval=frame"
    elif t.get('motion')=='scale':
     motion_start=number(t.get('motionStart'),0,0,d);motion_end=max(motion_start+.001,number(t.get('motionEnd'),min(d,md),0,d));scale_from=number(t.get('motionScaleFrom'),1,.1,4);scale_to=number(t.get('motionScaleTo'),1,.1,4)
     phase=f'max(0,min(1,(t-{motion_start})/{motion_end-motion_start}))';ease_scale=f'({phase})*({phase})*(3-2*({phase}))';factor=f'({scale_from}+({scale_to-scale_from})*({ease_scale}))';scale_filter=f"scale=w='iw*{base_scale:.9f}*{factor}':h=-1:flags=lanczos:eval=frame"
    filters=[scale_filter,'format=rgba',f'colorchannelmixer=aa={op}']
    if fi:filters.append(f'fade=t=in:st=0:d={fi}:alpha=1')
    if fo:filters.append(f'fade=t=out:st={max(0,d-fo)}:d={fo}:alpha=1')
    raster_layers.append({'path':raster,'duration':d,'start':a,'end':b,'x':xp,'y':yp,'filters':filters})
   elif caps.get('drawtext'):
    txt=work/f'text-{i}.txt';txt.write_text(text,encoding='utf-8');xp=f'w*{tx}' if align=='left' else f'w*{tx}-tw' if align=='right' else f'w*{tx}-tw/2'
    if t.get('motion')=='rise':yp+=f'+h*({shift})'
    if t.get('motion')=='slide-left':xp+=f'+w*({shift})'
    fill=t.get('color','#ffffff');border=number(t.get('outline'),0,0,20)*h/1080;border_color=t.get('outlineColor','#000000');shadow_x=number(t.get('shadowX'),0,-50,50)*h/1080 if t.get('shadow') else 0;shadow_y=number(t.get('shadowY'),0,-50,50)*h/1080 if t.get('shadow') else 0;shadow_color=t.get('shadowColor','#000000')
    final_vf.append(f"drawtext=textfile={txt}:expansion=none:font='{font}':fontcolor={fill}:fontsize={size}:borderw={border}:bordercolor={border_color}:shadowx={shadow_x}:shadowy={shadow_y}:shadowcolor={shadow_color}:x='{xp}':y='{yp}':alpha='{alpha}':enable='gte(t,{a})*lt(t,{b})'")
  if raster_layers:
   # Compose all browser-rasterized captions in one encode. This preserves
   # quality and avoids re-decoding/re-encoding the full movie per caption.
   text_args=['-i',joined];text_graph=[];previous='0:v'
   for j,layer in enumerate(raster_layers,1):
    text_args+=['-loop','1','-framerate',fps,'-t',layer['duration'],'-i',layer['path']]
    label=f'text{j}';out_label=f'caption{j}'
    text_graph.append(f"[{j}:v]{','.join(layer['filters'])},setpts=PTS-STARTPTS+{layer['start']}/TB[{label}]")
    text_graph.append(f"[{previous}][{label}]overlay=x='{layer['x']}':y='{layer['y']}':eof_action=pass:repeatlast=0:enable='gte(t,{layer['start']})*lt(t,{layer['end']})'[{out_label}]")
    previous=out_label
   texted=work/f'texted{ext}';job['operation']=f'{len(raster_layers)}個のテロップを一括合成中'
   run(job,text_args+['-filter_complex',';'.join(text_graph),'-map',f'[{previous}]','-map','0:a','-t',total,*video_args,'-c:a','copy',texted],total,.89,0)
   joined=texted
  out=ROOT/('cache' if preview else 'exports')/(token+ext)
  args=['-i',joined];bg=MEDIA.get(bgm.get('media'));graph=[]
  if bg:
   args+=['-stream_loop','-1','-i',bg['path']];vol=number(bgm.get('volume'),.3,0,2);fi=number(bgm.get('fadeIn'),0,0,total/2);fo=number(bgm.get('fadeOut'),0,0,total/2)
   bgexpr=keyframe_expression(bgm.get('gainKeyframes',[]),total,2,'t') if bgm.get('gainKeyframes') else None
   automation=f"volume='{bgexpr}':eval=frame," if bgexpr else ''
   graph=[f'[1:a]volume={vol},{automation}atrim=duration={total},afade=t=in:d={max(fi,.001)},afade=t=out:st={total-fo}:d={max(fo,.001)}[bg]','[0:a][bg]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=0:latency=1[a]'];args+=['-filter_complex',';'.join(graph),'-map','0:v','-map','[a]']
  independent=render_tracks(job,project,audio_clips,work,total)
  video_audio=[];ends=[0.,0.,0.]
  if not any(t.get('solo') for t in project.get('audioTracks',[])):
   for original in project.get('clips',[]):
    layer=int(number(original.get('layer'),0,0,2));duration=timing(original)[0][-1][1]+number(original.get('hold'),0,0,10);start=number(original.get('start'),ends[layer],0,86400);ends[layer]=max(ends[layer],start+duration);media=MEDIA.get(original.get('media'))
    if media and media.get('audio') and not original.get('freezeDuration') and not (len(tracks)>layer and tracks[layer].get('hidden')):video_audio.append({**copy.deepcopy(original),'start':start,'layer':layer})
  video_sources=render_tracks(job,project,video_audio,work,total,track_key='videoTracks',layers=3,prefix='video')
  mixed_tracks=[*video_sources,*independent]
  if mixed_tracks:
   # Rebuild one final mix from every audible video and independent audio lane.
   args=['-i',joined];graph=[];labels=['[0:a]'];index=1
   if bg:
    args+=['-stream_loop','-1','-i',bg['path']]
    graph.append(f'[1:a]volume={vol},{automation}atrim=duration={total},afade=t=in:d={max(fi,.001)},afade=t=out:st={total-fo}:d={max(fo,.001)}[bg]');labels.append('[bg]');index+=1
   for path in mixed_tracks:args+=['-i',path];labels.append(f'[{index}:a]');index+=1
   graph.append(''.join(labels)+f'amix=inputs={len(labels)}:duration=first:normalize=0,alimiter=limit=0.95:level=0:latency=1[a]')
   args+=['-filter_complex',';'.join(graph),'-map','0:v','-map','[a]']
  if final_vf:args+=['-vf',','.join(final_vf),*video_args]
  else:args+=['-c:v','copy']
  if bg or mixed_tracks:args+=audio_args
  else:args+=['-c:a','copy']
  args+=['-t',total,'-movflags','+faststart',out]
  job['operation']=encoding['label']+'を仕上げ中';run(job,args,total,.89,.09,verify_decode=True)
  return {'file':out.name,'url':('/cache/' if preview else '/exports/')+out.name,'duration':total,'width':w,'height':h,'fps':fps,'preview':preview,'format':'MOV' if ext=='.mov' else 'MP4','codec':encoding['label'],'verified':True,'recoveredOutputs':job.get('recoveredOutputs',0)}
 finally:
  shutil.rmtree(work,ignore_errors=True)
  for lower_path in lower_paths.values():lower_path.unlink(missing_ok=True)

def analyze(job,id,intent='HIGH FASHION'):
 m=MEDIA[id];src=ROOT/'cache'/m['proxy'] if m.get('proxy') else pathlib.Path(m['path']);fps=min(4,18000/max(m['duration'],1));w=h=64;n=w*h
 job['operation']='動き・静止・鮮鋭度を解析中'
 proc=subprocess.Popen(BASE+['-v','error','-i',str(src),'-an','-vf',f'fps={fps},scale={w}:{h},format=gray','-f','rawvideo','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL);job['_proc']=proc
 samples=[];prev=None
 try:
  while True:
   check(job);buf=bytearray()
   while len(buf)<n:
    chunk=proc.stdout.read(n-len(buf))
    if not chunk:break
    buf.extend(chunk)
   if len(buf)!=n:break
   gray=buf;motion=sum(abs(a-b) for a,b in zip(gray,prev))/n/255 if prev else 0;mean=sum(gray)/n/255
   sharp=sum(abs(4*gray[i]-gray[i-1]-gray[i+1]-gray[i-w]-gray[i+w]) for i in range(w+1,n-w-1) if i%w not in (0,w-1))/(n*255)
   clipped=sum(v<5 or v>250 for v in gray)/n
   t=len(samples)/fps;samples.append({'time':round(t,3),'motion':round(motion,5),'sharpness':round(sharp,5),'exposure':round(mean,4),'clipping':round(clipped,4)})
   prev=gray;job['progress']=min(.98,t/max(m['duration'],.001))
  code=proc.wait();check(job)
  if code:raise ValueError('フレーム解析に失敗しました。')
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
  proc.stdout.close();job.pop('_proc',None)
 if not samples:raise ValueError('解析できるフレームがありません。')
 motion=[s['motion'] for s in samples];sharp=[s['sharpness'] for s in samples];med=statistics.median(motion);sm=max(sharp) or 1;mm=max(motion) or 1;markers=[]
 weight={'HIGH FASHION':.65,'RAW':.2,'CINEMATIC':.8,'CLUB':-.4,'DOCUMENTARY':.4}.get(intent,.65)
 ranked=sorted(samples,key=lambda s:s['sharpness']/sm-weight*s['motion']/mm-s['clipping']*.4,reverse=True)
 chosen=[]
 for s in ranked:
  if all(abs(s['time']-t)>2 for t in chosen):
   chosen.append(s['time']);markers.append({'time':s['time'],'type':'best','label':'BEST MOMENT','detail':'鮮鋭度・動き・白黒の飽和率から候補化'})
  if len(chosen)>=min(12,max(1,math.ceil(m['duration']/8))):break
 min_gap={'CLUB':.6,'HIGH FASHION':1.5,'DOCUMENTARY':4,'CINEMATIC':2,'RAW':3}.get(intent,2);last=-10
 for i,s in enumerate(samples[1:-1],1):
  if s['motion']>max(.012,med*1.5) and s['motion']>=motion[i-1] and s['motion']>motion[i+1] and s['time']-last>min_gap:
   markers.append({'time':s['time'],'type':'motion','label':'MOTION ACCENT','detail':'画面内の動きのピーク。被写体の種類は未分類。'});last=s['time']
 last=-10
 for i,s in enumerate(samples[2:-2],2):
  if s['motion']<max(.005,med*.5) and max(motion[i-2:i])>max(.015,med*1.3) and s['time']-last>min_gap:
   markers.append({'time':s['time'],'type':'still','label':'STILLNESS','detail':'動きの直後に静止する候補'});last=s['time']
 low=None;threshold=max(.003,min(.012,med*.4));minimum={'HIGH FASHION':5,'CLUB':1.5,'RAW':7,'DOCUMENTARY':8,'CINEMATIC':4}.get(intent,4)
 for i,s in enumerate(samples+[{'motion':1,'time':m['duration']}]):
  if s['motion']<threshold and low is None:low=s['time']
  elif s['motion']>=threshold and low is not None:
   if s['time']-low>=minimum:markers.append({'time':low,'end':s['time'],'type':'quiet','label':'LOW VISUAL CHANGE','detail':f"{s['time']-low:.1f} sec — 意図的な間は残せます。"})
   low=None
 luminance=sorted(s['exposure'] for s in samples);low=luminance[int((len(luminance)-1)*.1)];high=luminance[int((len(luminance)-1)*.9)]
 stats={'luma':sum(luminance)/len(luminance),'low':low,'high':high,'contrast':high-low,'clipping':sum(s['clipping'] for s in samples)/len(samples),'motion':med}
 result={'media':id,'intent':intent,'sampleFps':fps,'method':'低解像度フレームの鮮鋭度・輝度・差分解析。顔・視線・ポーズの認識は未実装。','markers':sorted(markers,key=lambda x:x['time'])[:250],'stats':stats,'samples':samples}
 p=ROOT/'cache'/f'{id}-analysis.json';p.write_text(json.dumps(result));return result
