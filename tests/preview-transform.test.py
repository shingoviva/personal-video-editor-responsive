"""Direct preview placement exports at the same coordinates, without touching audio."""
import os,sys,pathlib,tempfile,subprocess,copy
with tempfile.TemporaryDirectory(prefix='pve-preview-transform-') as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'));import core
 source=pathlib.Path(tmp)/'source.mp4'
 subprocess.run(core.BASE+['-f','lavfi','-i','color=c=red:s=160x120:r=30:d=0.6','-f','lavfi','-i','sine=frequency=440:duration=0.6','-vf','drawbox=x=80:y=0:w=80:h=120:color=blue:t=fill','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',source],check=True,capture_output=True)
 m=core.inspect(source,'transform-source',source.name)
 base={'id':'clip','media':m['id'],'in':0,'out':.5,'start':0,'layer':0,'scale':1,'x':.5,'y':.5,'speed':1,'endSpeed':1,'curve':'constant','stabilization':'OFF','color':{},'audio':{'volume':1}}
 project={'version':1,'media':[m],'clips':[base],'effects':[],'texts':[],'bgm':{},'aspect':'Original','export':{'fps':'30','resolution':'Source','quality':'High'}}
 def pixel(out,x,y=50):return list(subprocess.check_output(core.BASE+['-v','error','-ss','0.2','-i',out,'-frames:v','1','-vf',f'crop=2:2:{x}:{y},scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 reference=None
 for name,values in [('baseline',{}),('right',{'offsetX':.25}),('up',{'offsetY':-.25}),('corner',{'scale':.5,'offsetX':-.25,'offsetY':-.25}),('larger',{'scale':1.5,'offsetX':.2})]:
  p=copy.deepcopy(project);p['clips'][0].update(values);r=core.render({'id':name,'cancel':False},p);out=core.ROOT/'exports'/r['file'];core.validate_output(out,.5,True)
  audio=subprocess.check_output(core.BASE+['-v','error','-i',out,'-map','0:a','-ac','1','-f','f32le','pipe:1'])
  if reference is None:reference=audio
  else:assert audio==reference,'Picture placement must preserve decoded audio samples'
  if name=='right':assert max(pixel(out,20))<10 and pixel(out,80)[0]>180 and pixel(out,140)[2]>180
  if name=='up':assert max(pixel(out,30,104))<10 and pixel(out,30,40)[0]>180
  if name=='corner':assert pixel(out,20,20)[0]>180 and pixel(out,60,20)[2]>180 and max(pixel(out,120,90))<10
  if name=='larger':assert pixel(out,100)[0]>180 and pixel(out,140)[2]>180
 print('Direct placement: free move at 1x, corner resize, enlarged source preservation, black frame bounds and identical PCM PASS')
