"""Sequential video cuts keep picture coverage and continuous, de-clicked audio."""
import os,sys,pathlib,tempfile,subprocess,array
with tempfile.TemporaryDirectory(prefix='pve-boundary-') as tmp:
 os.environ['PVE_DATA']=tmp;root=pathlib.Path(__file__).resolve().parent.parent;sys.path.insert(0,str(root/'engine'));import core
 media=[]
 for name,color,freq in [('first','red',440),('second','blue',660)]:
  path=pathlib.Path(tmp)/(name+'.mp4');subprocess.run(core.BASE+['-f','lavfi','-i',f'color=c={color}:s=160x90:r=30:d=1.2','-f','lavfi','-i',f'sine=frequency={freq}:sample_rate=48000:duration=1.2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',path],capture_output=True,check=True);media.append(core.inspect(path,name,path.name))
 cut=.973
 def clip(m,start,out):return{'id':m['id'],'media':m['id'],'in':0,'out':out,'start':start,'layer':0,'speed':1,'endSpeed':1,'curve':'constant','stabilization':'OFF','audio':{'volume':1,'mute':False},'color':{}}
 project={'version':1,'media':media,'clips':[clip(media[0],0,cut),clip(media[1],cut,1.2)],'audioClips':[],'videoTracks':[{'hidden':False,'volume':1} for _ in range(3)],'audioTracks':[{} for _ in range(4)],'texts':[],'effects':[],'bgm':{},'aspect':'Original','export':{'resolution':'Source','fps':30,'quality':'High','codec':'H.264'}}
 result=core.render({'id':'boundary','cancel':False},project);out=core.ROOT/'exports'/result['file'];core.validate_output(out,result['duration'],True)
 def pixel(t):return list(subprocess.check_output(core.BASE+['-v','error','-ss',str(t),'-i',out,'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 before,after=pixel(cut-.04),pixel(cut+.04);assert before[0]>120 and max(before)>150,before;assert after[2]>120 and max(after)>150,after
 raw=subprocess.check_output(core.BASE+['-v','error','-i',out,'-vn','-ac','1','-ar','48000','-f','f32le','pipe:1']);samples=array.array('f');samples.frombytes(raw);center=round(cut*48000);window=samples[center-2400:center+2400];longest=run=0
 for value in window:
  if abs(value)<1e-7:run+=1;longest=max(longest,run)
  else:run=0
 assert longest<240,(longest,'samples of silence around cut')
 print('Native sequential cut: red to blue coverage, full decode and de-clicked audio without silent gaps PASS')
