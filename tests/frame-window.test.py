"""Fractional edit boundaries must preserve every frame without retiming audio."""
import os,sys,pathlib,tempfile,subprocess,json,copy,array,math
with tempfile.TemporaryDirectory(prefix='pve-frame-window-') as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'));import core
 src=pathlib.Path(tmp)/'source.mp4';core.run({'id':'source','cancel':False},['-f','lavfi','-i','color=c=red:s=160x90:r=60:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',src],3)
 m=core.inspect(src,'source',src.name);clips=[];start=0
 for i,frames in enumerate([43,21,11,5,9,7,13,11]):
  duration=frames/60;speed=[1,1.5,2][i%3];clips.append({'id':f'c{i}','media':m['id'],'in':0,'out':duration*speed,'start':start,'layer':0,'speed':speed,'endSpeed':speed,'curve':'constant','scale':1,'audio':{'volume':0},'color':{}});start+=duration
 assert abs(start-2)<1e-8
 p={'version':1,'media':[m],'clips':clips,'audioClips':[{'id':'score','kind':'audio','media':m['id'],'start':0,'layer':2,'in':0,'out':2,'speed':1,'endSpeed':1,'audio':{'volume':.5}}],'audioTracks':[{} for _ in range(4)],'texts':[],'effects':[{'type':'flash','start':.7,'duration':.1,'strength':.2,'layer':0},{'type':'black-out','start':1.7,'duration':.3,'strength':.4,'layer':0}],'bgm':{},'aspect':'Original','export':{'resolution':'Source','quality':'High'}}
 for fps in [24,30,60]:
  p['export']['fps']=str(fps);r=core.render({'id':f'fps-{fps}','cancel':False},copy.deepcopy(p));out=core.ROOT/'exports'/r['file'];core.validate_output(out,2,True)
  q=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-show_entries','stream=codec_type,nb_frames,duration','-of','json',str(out)]));v=next(s for s in q['streams'] if s['codec_type']=='video');assert int(v['nb_frames'])==2*fps,q;assert abs(float(v['duration'])-2)<1e-5,q
  raw=subprocess.check_output(core.BASE+['-v','error','-i',out,'-map','0:a','-ac','1','-ar','48000','-f','f32le','pipe:1']);a=array.array('f');a.frombytes(raw)
  for t in [.2,.8,1.4,1.85]:
   data=a[int(t*48000):int((t+.08)*48000)];assert math.sqrt(sum(x*x for x in data)/len(data))>.03,(fps,t)
  assert subprocess.run(core.BASE+['-v','error','-i',out,'-f','null','-'],capture_output=True).returncode==0
 print('Fractional cuts / speeds / FX at 24,30,60fps: exact frame count, duration, audio continuity and full decode PASS')
