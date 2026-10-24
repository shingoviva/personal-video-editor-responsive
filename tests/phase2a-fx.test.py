"""Synthetic-only native large flash patterns: timing, picture, AAC, capacity."""
import os,sys,pathlib,tempfile,subprocess,json,time,copy
with tempfile.TemporaryDirectory(prefix='pve-phase2a-native-') as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'engine'));import core
 root=pathlib.Path(tmp);source=root/'source.mp4'
 subprocess.run(core.BASE+['-f','lavfi','-i','color=c=blue:s=320x180:r=30:d=2','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-t','2',source],capture_output=True,check=True)
 m=core.inspect(source,'s',source.name);p={'version':1,'media':[m],'clips':[{'id':'v','media':'s','start':0,'in':0,'out':2,'layer':0,'speed':1,'curve':'constant','stabilization':'OFF','color':{},'audio':{'volume':1}}],'texts':[],'effects':[],'export':{'fps':'30','resolution':'Source','quality':'High'},'aspect':'Original'}
 rows=[]
 for n in [50,100,200,400]:
  q=copy.deepcopy(p);q['effects']=[{'id':f'f{i}','type':'flash','start':i/n*1.8,'duration':.08,'layer':i%3,'strength':.1} for i in range(n)]
  t=time.perf_counter();result=core.render({'id':f'fx{n}','cancel':False},q);out=core.ROOT/'exports'/result['file'];seconds=time.perf_counter()-t;core.validate_output(out,2,True)
  streams=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-show_streams','-of','json',str(out)]))['streams'];v=next(s for s in streams if s['codec_type']=='video');assert int(v['nb_frames'])==60
  subprocess.run(core.BASE+['-v','error','-i',out,'-f','null','-'],capture_output=True,check=True)
  rows.append({'count':n,'seconds':seconds,'bytes':out.stat().st_size,'frames':int(v['nb_frames']),'duration':v['duration']})
 q=copy.deepcopy(p);q['effects']=[{'type':'flash','start':0,'duration':.1} for _ in range(401)]
 try:core.render({'id':'invalid','cancel':False},q);raise AssertionError('401 accepted')
 except ValueError as e:assert '400' in str(e)
 print(json.dumps({'largeFlashExports':'PASS','rows':rows,'overLimitRejected':True},ensure_ascii=False))
