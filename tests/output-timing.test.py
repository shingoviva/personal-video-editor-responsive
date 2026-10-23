"""Native B4 clock regression: packet clocks and decoded picture identity are separate.

Synthetic fixtures are always available. Real-camera transition QA remains in
real-transitions.qa.py (same MAE < 9 oracle, optional private input files).
"""
import copy,hashlib,json,os,pathlib,subprocess,sys,tempfile
from fractions import Fraction

repo=pathlib.Path(__file__).resolve().parent.parent
rates=[('23.976',24000,1001),('24',24,1),('25',25,1),('29.97',30000,1001),('30',30,1),('50',50,1),('59.94',60000,1001),('60',60,1)]
with tempfile.TemporaryDirectory(prefix='pve-output-clock-') as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(repo/'engine'));import core
 tmp=pathlib.Path(tmp);runner=core.run;rows=[];captures={};calls=[];stage_info={}
 def command(args):subprocess.run([core.FFMPEG,'-v','error','-nostdin','-y',*map(str,args)],check=True)
 def info(path):
  streams=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-show_streams','-of','json',str(path)]))['streams']
  video=next(x for x in streams if x['codec_type']=='video');audio=next((x for x in streams if x['codec_type']=='audio'),{})
  fields=['codec_name','profile','pix_fmt','color_range','color_space','color_transfer','color_primaries']
  return {**{k:video.get(k) for k in fields},'audioCodec':audio.get('codec_name')}
 def hashes(path):
  data=subprocess.check_output(core.BASE+['-v','error','-i',path,'-map','0:v','-vsync','0','-f','framemd5','pipe:1'],text=True)
  return [line.split(',')[-1].strip() for line in data.splitlines() if line and not line.startswith('#')]
 def clock(path,n,num,den):
  data=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-select_streams','v','-show_entries','stream=time_base:frame=best_effort_timestamp','-of','json',str(path)]));tb=Fraction(data['streams'][0]['time_base']);frames=data['frames'];assert len(frames)==n
  errors=[abs(int(f['best_effort_timestamp'])*tb-Fraction(i*den,num)) for i,f in enumerate(frames)];assert max(errors)==0,(path,errors);return 0
 def trace(job,args,*rest,**kw):
  value=runner(job,args,*rest,**kw);p=pathlib.Path(str(args[-1]));calls.append(list(map(str,args)))
  if p.name.startswith('clip-') and p.suffix in ('.mp4','.mov'):
   key=p.name.replace('-transition','');captures[key]=hashes(p);stage_info[key]=info(p)
  if p.stem=='joined':
   expected=[h for name in sorted(captures) for h in captures[name]];actual=hashes(p);assert actual==expected,('joined picture order/bytes',len(expected),len(actual));captures['joined']=actual;stage_info['joined']=info(p)
   for name in captures:
    if name!='joined':assert stage_info[name]==stage_info['joined'],('joined metadata',name,stage_info)
   assert '-c' in args and args[args.index('-c')+1]=='copy';assert '-vf' not in args
  return value
 core.run=trace
 # High-detail moving texture, 60fps source; rate is independent of edit/export.
 src=tmp/'source.mp4';command(['-f','lavfi','-i','testsrc2=s=192x108:r=60:d=2','-f','lavfi','-i','sine=frequency=997:sample_rate=48000:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',src]);m=core.inspect(src,'source',src.name)
 for label,num,den in rates:
  for codec in ['H.264','ProRes 422 HQ']:
   fps=num/den;clips=[]
   # One- and two-picture segments have different reorder depths from long ones.
   for i,(start,count) in enumerate([(0,1),(1,2),(3,9)]):clips.append({'id':str(i),'media':m['id'],'in':i*.25,'out':i*.25+count/fps,'audio':{'volume':1}})
   project={'version':1,'timelineRate':{'numerator':25,'denominator':1},'clips':clips,'texts':[],'effects':[],'export':{'fps':label,'codec':codec,'resolution':'Source','quality':'High'}}
   captures.clear();stage_info.clear();calls.clear();result=core.render({'id':'clock-'+label+'-'+codec,'cancel':False},copy.deepcopy(project));out=core.ROOT/'exports'/result['file'];assert hashes(out)==captures['joined'];assert info(out)==stage_info['joined'];clock(out,12,num,den);assert not any(pathlib.Path(args[-1]).stem=='timed' for args in calls)
   assert sum('-c:v' in args and args[args.index('-c:v')+1]!='copy' for args in calls)==3
   assert info(out)['audioCodec']==('aac' if codec=='H.264' else 'pcm_s24le')
   rows.append({'metadata':info(out),'fps':label,'codec':codec,'frames':12,'maxExactPTSSeconds':0,'joinedAndDeliveredDecodedHashesEqual':True,'clockOnlyVideoEncodes':0})
 # Same clocks with intentional transition + FX + browser-rasterized TEXT.
 import base64,struct,zlib
 chunk=lambda kind,data:struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',32,12,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(b'\0'+bytes((255,255,255,200))*32 for _ in range(12))))+chunk(b'IEND',b'')
 composite=[]
 for label,num,den in rates:
  for codec in ['H.264','ProRes 422 HQ']:
   fps=num/den
   p={'version':1,'clips':[{'media':m['id'],'in':0,'out':3/fps},{'media':m['id'],'in':.5,'out':.5+9/fps,'transition':{'type':'dissolve','duration':2/fps}}],'effects':[{'type':'flash','start':1/fps,'duration':2/fps,'strength':.2}],'texts':[{'text':'CLOCK','start':1/fps,'end':10/fps,'x':.5,'y':.8,'size':24,'raster':{'data':'data:image/png;base64,'+base64.b64encode(png).decode(),'width':32,'height':12}}],'export':{'fps':label,'codec':codec,'resolution':'Source','quality':'High'}}
   captures.clear();stage_info.clear();calls.clear();r=core.render({'id':'composite-'+label+'-'+codec,'cancel':False},p);path=core.ROOT/'exports'/r['file'];clock(path,12,num,den);assert info(path)==stage_info['joined'];assert not any(pathlib.Path(a[-1]).stem=='timed' for a in calls)
   composite.append({'fps':label,'codec':codec,'frames':12,'maxExactPTSSeconds':0,'transitionFXText':True,'clockOnlyVideoEncodes':0})
 # 10-bit gradient: compare native decoded planes; no RGB/8-bit conversion.
 gradient=tmp/'gradient.mov';command(['-f','lavfi','-i','gradients=size=192x108:rate=30:c0=0x000000:c1=0xffffff:x0=0:y0=0:x1=192:y1=108','-t','1','-c:v','prores_ks','-profile:v','hq','-pix_fmt','yuv422p10le',gradient]);gm=core.inspect(gradient,'gradient',gradient.name)
 gp={'version':1,'clips':[{'media':gm['id'],'in':0,'out':.3},{'media':gm['id'],'in':.3,'out':.6}],'export':{'fps':30,'codec':'ProRes 422 HQ','resolution':'Source'}}
 captures.clear();stage_info.clear();calls.clear();gr=core.render({'id':'gradient-clock','cancel':False},gp);gout=core.ROOT/'exports'/gr['file'];assert hashes(gout)==captures['joined'];assert info(gout)==stage_info['joined'];assert info(gout)['pix_fmt']=='yuv422p10le'
 import array
 plane=subprocess.check_output(core.BASE+['-v','error','-i',gout,'-frames:v','1','-vf','extractplanes=y','-f','rawvideo','pipe:1']);samples=array.array('H');samples.frombytes(plane);levels=len(set(samples));assert levels>256,levels
 gradient_result={'distinctLumaLevels':levels,'allDecodedNativePlanesEqual':True,'metadata':info(gout)}
 # Detector: same frame count and cadence summary cannot conceal interior jitter.
 normal=tmp/'normal.mp4';command(['-f','lavfi','-i','testsrc2=s=160x90:r=30:d=1','-c:v','libx264','-pix_fmt','yuv420p','-video_track_timescale','90000',normal]);assert core.video_timing_matches(normal,30,30)
 leading=tmp/'leading.mp4';command(['-itsoffset','0.021','-i',normal,'-c','copy',leading]);assert not core.video_timing_matches(leading,30,30)
 jitter=tmp/'jitter.mp4';command(['-i',normal,'-vf','settb=1/90000,setpts=PTS+if(eq(N\\,10)\\,900\\,0)','-fps_mode','passthrough','-enc_time_base','1/90000','-c:v','libx264','-pix_fmt','yuv420p','-video_track_timescale','90000',jitter]);assert not core.video_timing_matches(jitter,30,30)
 assert len(hashes(jitter))==30
 summary=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-select_streams','v','-show_entries','stream=nb_frames,start_time,avg_frame_rate,duration','-of','json',str(jitter)]))['streams'][0]
 assert summary=={'avg_frame_rate':'30/1','start_time':'0.000000','duration':'1.000000','nb_frames':'30'},summary
 # A bad intermediate must abort, never fall back to a lossy timing repair.
 def bad_part(job,args,*rest,**kw):
  value=runner(job,args,*rest,**kw);path=pathlib.Path(str(args[-1]))
  if path.name=='clip-0000.mp4':
   shifted=tmp/'bad-part.mp4';command(['-itsoffset','0.021','-i',path,'-c','copy',shifted]);path.write_bytes(shifted.read_bytes())
  return value
 core.run=bad_part
 bad={'version':1,'clips':[{'media':m['id'],'in':0,'out':.5}],'export':{'fps':30,'resolution':'Source'}}
 try:core.render({'id':'bad-clock','cancel':False},bad);raise AssertionError('invalid input clock accepted')
 except ValueError as e:assert '時刻' in str(e)
 core.run=runner
 result={'result':'PASS','gradient10bit':gradient_result,'composite':composite,'rows':rows,'normalCFR':True,'leading21msRejected':True,'interiorFrame10Plus10msRejected':True,'badIntermediateAborts':True}
 if len(sys.argv)>1:pathlib.Path(sys.argv[1]).write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result))
