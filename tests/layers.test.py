"""Two-layer native export: coverage, fractional boundaries and bounded originals."""
import pathlib,sys,os,tempfile,copy,subprocess,hashlib
with tempfile.TemporaryDirectory(prefix='pve-layers-') as tmp:
 os.environ['PVE_DATA']=tmp
 sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'))
 import core
 media=[]
 for name in ('red','blue'):
  path=pathlib.Path(tmp)/(name+'.mp4')
  core.run({'id':'fixture-'+name},['-f','lavfi','-i',f'color=c={name}:s=160x90:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t',2,'-c:v','libx264','-threads',2,'-c:a','aac',path],2)
  media.append(core.inspect(path,name,name+'.mp4'))
 hashes=[hashlib.sha256(pathlib.Path(m['path']).read_bytes()).hexdigest() for m in media]
 base={'id':'base','media':'red','in':0,'out':2,'speed':1,'endSpeed':1,'curve':'constant','layer':0,'start':0,'audio':{'volume':1},'color':{},'stabilization':'OFF'}
 upper={**copy.deepcopy(base),'id':'upper','media':'blue','start':.417,'out':.611,'layer':1}
 project={'version':1,'clips':[base,upper],'aspect':'Original','texts':[],'export':{'fps':30,'resolution':'Source','quality':'Preview'}}
 windows=core.visible_clips(project['clips'],30)
 ramp={**base,'speed':.05,'endSpeed':20,'curve':'ease-in-out'}
 timing_base={k:ramp[k] for k in ('in','out','speed','endSpeed','curve')}
 left={**ramp,'out':.813,'timingBase':timing_base};right={**ramp,'in':.813,'timingBase':timing_base}
 assert abs(core.timing(left)[0][-1][1]+core.timing(right)[0][-1][1]-core.timing(ramp)[0][-1][1])<1e-8
 assert [c['media'] for c in windows]==['red','blue','red']
 assert abs(sum(c['_window'][1] for c in windows)-2)<1e-8
 result=core.render({'id':'layers','cancel':False},copy.deepcopy(project))
 path=core.ROOT/'exports'/result['file']
 core.validate_output(path,2,True)
 def rgb(t):
  return list(subprocess.check_output(core.BASE+['-v','error','-ss',str(t),'-i',str(path),'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 for t,channel in [(.2,0),(.7,2),(1.5,0)]:
  pixel=rgb(t);assert pixel[channel]>150,(t,pixel)
 hidden=copy.deepcopy(project);hidden['videoTracks']=[{'hidden':False},{'hidden':True},{'hidden':False}]
 hidden_result=core.render({'id':'hidden-layer','cancel':False},hidden);hidden_path=core.ROOT/'exports'/hidden_result['file'];core.validate_output(hidden_path,2,True)
 hidden_pixel=list(subprocess.check_output(core.BASE+['-v','error','-ss','0.7','-i',str(hidden_path),'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 assert hidden_pixel[0]>150 and hidden_pixel[2]<40,hidden_pixel
 assert hashes==[hashlib.sha256(pathlib.Path(m['path']).read_bytes()).hexdigest() for m in media]
 print('Native H.264/AAC layers: visibility switch, red → blue → red, fractional boundaries, full decode, originals unchanged: PASS')
