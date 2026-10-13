"""Verify LOOK values survive real native H.264 export, including upper layers."""
import os,sys,pathlib,tempfile,subprocess,json,hashlib
root=pathlib.Path(__file__).resolve().parent.parent
looks=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {lookPresets} from './dist/look.js';console.log(JSON.stringify(lookPresets))"],cwd=root))
with tempfile.TemporaryDirectory(prefix='pve-look-export-') as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(root/'engine'));import core
 source=pathlib.Path(tmp)/'warm.mp4'
 core.run({'id':'source','cancel':False},['-f','lavfi','-i','color=c=0xc87838:s=160x90:r=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','0.5','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source],.5)
 m=core.inspect(source,'look-source','warm.mp4');original=hashlib.sha256(source.read_bytes()).hexdigest()
 def exported(name,amount=1,layer=0):
  c={'id':'look-clip','media':m['id'],'in':0,'out':.5,'start':0,'layer':layer,'speed':1,'endSpeed':1,'curve':'constant','scale':1,'x':.5,'y':.5,'stabilization':'OFF','lookName':name,'lookAmount':amount,'color':looks[name],'audio':{'volume':1}}
  p={'version':1,'media':[m],'clips':[c],'bgm':{},'texts':[],'aspect':'Original','export':{'fps':'24','resolution':'Source','quality':'High'}}
  result=core.render({'id':f'{name}-{amount}-{layer}','cancel':False},p);out=core.ROOT/'exports'/result['file'];core.validate_output(out,.5,True)
  return list(subprocess.check_output(core.BASE+['-v','error','-ss','0.2','-i',out,'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 baseline=exported('CLEAN');pixels={name:exported(name) for name in looks if name!='CLEAN'}
 for name,pixel in pixels.items():assert max(abs(a-b) for a,b in zip(pixel,baseline))>5,(name,pixel,baseline)
 mono=pixels['MONO'];assert max(mono)-min(mono)<=4,mono
 zero=exported('MONO',0);assert max(abs(a-b) for a,b in zip(zero,baseline))<=4,(zero,baseline)
 half=exported('MONO',.5);assert 4<max(half)-min(half)<max(baseline)-min(baseline),(half,baseline)
 upper=exported('MONO',1,2);assert max(upper)-min(upper)<=4,upper
 assert hashlib.sha256(source.read_bytes()).hexdigest()==original
 print(json.dumps({'baseline':baseline,'looks':pixels,'zero':zero,'half':half,'upper':upper}))
 print('Native LOOK actual H.264/AAC export: all presets, strengths 0/.5/1, V3 and source integrity PASS')
