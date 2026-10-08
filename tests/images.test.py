"""Actual still + video + audio export, without private media."""
import os,sys,pathlib,tempfile,subprocess,hashlib
with tempfile.TemporaryDirectory(prefix='pve-images-') as tmp:
 os.environ['PVE_DATA']=tmp;root=pathlib.Path(__file__).resolve().parent.parent
 sys.path.insert(0,str(root/'engine'));import core
 image=pathlib.Path(tmp)/'still.png'
 subprocess.run(core.BASE+['-f','lavfi','-i','color=c=red:s=160x90','-frames:v','1',str(image)],check=True,capture_output=True)
 photo=core.inspect(image,'still','still.png');assert photo['kind']=='image' and photo['duration']==5
 sound=pathlib.Path(tmp)/'music.wav'
 subprocess.run(core.BASE+['-f','lavfi','-i','sine=frequency=440:duration=1','-c:a','pcm_s16le',str(sound)],check=True,capture_output=True)
 audio=core.inspect(sound,'music','music.wav');assert audio['kind']=='audio'
 movie=core.inspect(root/'dist/device-test.mp4','movie','device-test.mp4');assert movie['kind']=='video'
 original=hashlib.sha256(image.read_bytes()).hexdigest()
 def clip(m,start,out):return{'id':m['id'],'media':m['id'],'kind':m['kind'],'in':0,'out':out,'start':start,'layer':0,'speed':1,'endSpeed':1,'curve':'constant','audio':{'volume':1},'color':{},'stabilization':'OFF'}
 still=clip(photo,0,6);still.update(motionPreset='push-in',motionAmount=.15)
 p={'version':1,'media':[photo,movie,audio],'clips':[still,clip(movie,6,.5)],'bgm':{'media':'music','volume':.3},'texts':[],'aspect':'Original','export':{'fps':'Source','resolution':'Source','quality':'Preview'}}
 result=core.render({'id':'still-video-audio','cancel':False},p);out=core.ROOT/'exports'/result['file']
 assert abs(result['duration']-6.5)<.01;core.validate_output(out,6.5,True)
 pixel=list(subprocess.check_output(core.BASE+['-v','error','-ss','3','-i',str(out),'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 assert pixel[0]>150 and pixel[1]<80,(pixel,result)
 assert hashlib.sha256(image.read_bytes()).hexdigest()==original
 pattern=pathlib.Path(tmp)/'pattern.png'
 subprocess.run(core.BASE+['-f','lavfi','-i','testsrc2=s=320x180:r=1','-frames:v','1',str(pattern)],check=True,capture_output=True)
 patterned=core.inspect(pattern,'pattern','pattern.png');pattern_hash=hashlib.sha256(pattern.read_bytes()).hexdigest();moving=clip(patterned,0,2);moving.update(motionPreset='push-in',motionAmount=.3)
 q={'version':1,'media':[patterned],'clips':[moving],'bgm':{},'texts':[],'aspect':'Original','export':{'fps':'30','resolution':'Source','quality':'Preview'}}
 moved=core.render({'id':'still-motion','cancel':False},q);motion_out=core.ROOT/'exports'/moved['file'];core.validate_output(motion_out,2,True)
 frames=[subprocess.check_output(core.BASE+['-v','error','-ss',str(at),'-i',str(motion_out),'-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']) for at in (.05,1.8)]
 assert frames[0]!=frames[1] and hashlib.sha256(pattern.read_bytes()).hexdigest()==pattern_hash
 print('Native PNG still with push-in + video + WAV BGM: changed motion frames, H.264/AAC, full decode, originals unchanged PASS')
