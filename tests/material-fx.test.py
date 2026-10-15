"""Real native export of analyzed FX paths; audio remains unchanged."""
import os,sys,pathlib,tempfile,subprocess,copy,array,math
with tempfile.TemporaryDirectory(prefix='pve-material-fx-') as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'));import core
 path=pathlib.Path(tmp)/'target.mp4';core.run({'id':'source','cancel':False},['-f','lavfi','-i','color=c=red:s=160x90:r=24:d=2','-f','lavfi','-i','sine=frequency=440:duration=2','-vf','drawbox=x=80:y=0:w=80:h=90:color=blue:t=fill','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-t','2',path],2)
 m=core.inspect(path,'target',path.name);c={'id':'c','media':m['id'],'in':0,'out':2,'start':0,'layer':0,'speed':1,'endSpeed':1,'curve':'constant','scale':1,'stabilization':'OFF','audio':{'volume':1},'color':{}}
 p={'version':1,'media':[m],'clips':[c],'texts':[],'effects':[],'bgm':{},'aspect':'Original','export':{'fps':'24','resolution':'Source','quality':'High'}}
 reference_audio=None
 def render(name,e):
  q=copy.deepcopy(p);q['effects']=e if isinstance(e,list) else [e];r=core.render({'id':name,'cancel':False},q);out=core.ROOT/'exports'/r['file'];core.validate_output(out,2,True);audio=array.array('f');audio.frombytes(subprocess.check_output(core.BASE+['-v','error','-i',out,'-map','0:a','-ac','1','-f','f32le','pipe:1']));tail_rms=math.sqrt(sum(v*v for v in audio[91200:96000])/4800);assert len(audio)>=96000 and tail_rms>.04,(name,len(audio),tail_rms)
  if reference_audio is not None:assert audio.tobytes()==reference_audio,'Video FX must preserve every decoded audio sample'
  return out
 reference=render('reference',[]);reference_audio=subprocess.check_output(core.BASE+['-v','error','-i',reference,'-map','0:a','-ac','1','-f','f32le','pipe:1'])
 def pixel(out,t,x):return list(subprocess.check_output(core.BASE+['-v','error','-ss',str(t),'-i',out,'-frames:v','1','-vf',f'crop=2:2:{x}:44,scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 base={'type':'region-zoom','start':0,'duration':2,'zoomSize':.4,'zoomX':.25,'zoomY':.5,'zoomIn':0,'zoomReturn':False,'strength':.6}
 focus=render('focus',{**base,'motionKind':'focus'});assert pixel(focus,1,40)[0]>180 and pixel(focus,1,120)[2]<150
 tracking=render('tracking',{**base,'trackPath':[{'time':0,'x':.25,'y':.5},{'time':1,'x':.75,'y':.5}]});assert pixel(tracking,.1,80)[0]>180 and pixel(tracking,1.5,80)[2]>180
 for kind in ['audio-pulse','camera-bump']:
  output=render(kind,{**base,'motionKind':kind,'strength':1,'motionPath':[{'time':0,'scale':1,'x':0,'y':0},{'time':.5,'scale':1.12,'x':.02,'y':0},{'time':1,'scale':1,'x':0,'y':0},{'time':2,'scale':1,'x':0,'y':0}]});assert pixel(output,.5,82)[0]>150
 combined=render('combined',[base,{**base,'motionKind':'focus'}]);assert pixel(combined,1,120)[0]>180
 print('Native analyzed audio-pulse/camera-bump/tracking/focus: pixel behavior, full decode, duration and audible AAC PASS')
