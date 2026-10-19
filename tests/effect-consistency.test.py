"""Actual native pixels and unchanged audio for long FX and layer ordering."""
import os,sys,pathlib,tempfile,subprocess,copy
with tempfile.TemporaryDirectory(prefix='pve-fx-consistency-')as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'));import core
 src=pathlib.Path(tmp)/'red.mp4';core.run({'id':'source','cancel':False},['-f','lavfi','-i','color=c=red:s=160x90:r=24:d=40','-f','lavfi','-i','sine=frequency=440:duration=40','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',src],40)
 m=core.inspect(src,'red',src.name);c={'id':'c','media':m['id'],'in':0,'out':40,'start':0,'layer':0,'speed':1,'endSpeed':1,'curve':'constant','scale':1,'stabilization':'OFF','audio':{'volume':1},'color':{}}
 p={'version':1,'media':[m],'clips':[c],'texts':[],'effects':[],'bgm':{},'aspect':'Original','export':{'fps':'24','resolution':'Source','quality':'High'}}
 def render(name,effects):
  p['effects']=effects;r=core.render({'id':name,'cancel':False},p);out=core.ROOT/'exports'/r['file'];core.validate_output(out,p['clips'][0]['out'],True);return out
 def pixel(out,t):return list(subprocess.check_output(core.BASE+['-v','error','-ss',str(t),'-i',out,'-frames:v','1','-vf','crop=2:2:80:44,scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 def pcm(out):return subprocess.check_output(core.BASE+['-v','error','-i',out,'-map','0:a','-f','f32le','pipe:1'])
 reference=pcm(render('reference',[]))
 for kind in ['black-out','black-in','flash']:
  e={'id':'long','type':kind,'layer':0,'start':0,'duration':40,'strength':1,'hold':0};out=render('long-'+kind,[e]);actual=pixel(out,35)
  if kind=='black-out':assert actual[0]<45,actual
  elif kind=='black-in':assert actual[0]>205,actual
  else:assert 20<actual[1]<48 and 20<actual[2]<48,actual
  assert pcm(out)==reference,'FX must not change decoded audio';print('40s '+kind+': full duration, expected 35s pixels, identical PCM PASS')
 e={'id':'long','type':'black-out','start':0,'duration':40,'strength':1};out=render('batch-long',[{'type':'flash','start':0,'duration':.1,'strength':.2},e]);assert pixel(out,35)[0]<45;assert pcm(out)==reference;print('Batched 40s FX retains late fade and identical PCM PASS')
 p['clips'][0]['out']=2;reference=pcm(render('short-reference',[]));high={'id':'high','type':'flash','layer':2,'start':0,'duration':2,'strength':1};low={'id':'low','type':'black-in','layer':0,'start':0,'duration':2,'strength':1}
 outputs=[render('high-created-first',[high,low]),render('low-created-first',[low,high])];pixels=[pixel(out,1)for out in outputs];assert pixels[0]==pixels[1],pixels;assert pixels[0][0]>170 and pixels[0][1]>100,pixels
 for out in outputs:assert pcm(out)==reference
 print('F/T1→F/T3 native stacking is independent of insertion order; unchanged PCM PASS')
