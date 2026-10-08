import os,sys,pathlib,tempfile,subprocess,copy,array,math
with tempfile.TemporaryDirectory(prefix='pve-multitrack-') as tmp:
 os.environ['PVE_DATA']=tmp;root=pathlib.Path(__file__).resolve().parent.parent;sys.path.insert(0,str(root/'engine'));import core
 def video(name,color,freq):
  path=pathlib.Path(tmp)/(name+'.mp4');subprocess.run(core.BASE+['-f','lavfi','-i',f'color=c={color}:s=160x90:r=30:d=2','-f','lavfi','-i',f'sine=frequency={freq}:sample_rate=48000:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',path],capture_output=True,check=True);return core.inspect(path,name,path.name)
 def sound(name,freq):
  path=pathlib.Path(tmp)/(name+'.wav');subprocess.run(core.BASE+['-f','lavfi','-i',f'sine=frequency={freq}:sample_rate=48000:duration=1','-c:a','pcm_s16le',path],capture_output=True,check=True);return core.inspect(path,name,path.name)
 def clip(m,layer):return {'id':m['id'],'media':m['id'],'in':0,'out':2,'start':0,'layer':layer,'speed':1,'endSpeed':1,'curve':'constant','stabilization':'OFF','audio':{'volume':.4,'mute':False},'color':{}}
 media=[video('red','red',220),video('blue','blue',330),video('green','green',550)]+[sound('tone'+str(k),f) for k,f in enumerate([440,660,880,1100])]
 p={'version':1,'media':media,'clips':[clip(m,i) for i,m in enumerate(media[:3])],'audioClips':[{**clip(m,i),'kind':'audio','out':1.5,'start':i*.1,'loop':True} for i,m in enumerate(media[3:])],'audioTracks':[{} for _ in range(4)],'texts':[],'bgm':{},'aspect':'Original','export':{'resolution':'Source','fps':'30','quality':'High'}}
 p['clips'][1]['opacity']=.5;p['clips'][2]['opacity']=.5;p['clips'][0]['scaleKeyframes']=[{'time':0,'value':1},{'time':1,'value':1.35},{'time':2,'value':1}]
 def render(p,name):
  r=core.render({'id':name,'cancel':False},copy.deepcopy(p));out=core.ROOT/'exports'/r['file'];core.validate_output(out,r['duration'],True);return out,r
 def amplitudes(out):
  raw=subprocess.check_output(core.BASE+['-v','error','-ss','0.7','-i',out,'-t','0.2','-vn','-ac','1','-ar','8000','-f','f32le','pipe:1']);samples=array.array('f');samples.frombytes(raw)
  return [2*abs(sum(v*complex(math.cos(2*math.pi*f*i/8000),math.sin(2*math.pi*f*i/8000)) for i,v in enumerate(samples)))/len(samples) for f in [220,330,550,440,660,880,1100]]
 out,r=render(p,'four-tracks');rgb=list(subprocess.check_output(core.BASE+['-v','error','-ss','0.7','-i',out,'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']));assert min(rgb)>35,rgb
 amps=amplitudes(out);assert min(amps)>.012,amps
 p['audioTracks'][2]['solo']=True;p['audioClips'][2]['out']=2.5
 out,r=render(p,'solo-tail');assert abs(r['duration']-2.7)<.04,r
 amps=amplitudes(out);assert amps[5]>.02 and max(amps[:5]+amps[6:])<.004,amps
 curve=copy.deepcopy(p);curve['clips']=[];curve['audioTracks']=[{} for _ in range(4)];curve['audioClips']=[{**clip(media[3],0),'kind':'audio','in':0,'out':1.5,'start':0,'loop':True,'audio':{'volume':.5,'gainKeyframes':[{'time':0,'value':.08},{'time':.5,'value':1.8},{'time':1.3,'value':.08}]}}];curve['bgm']={'media':media[4]['id'],'volume':.5,'fadeIn':0,'fadeOut':0,'gainKeyframes':[{'time':0,'value':.08},{'time':.5,'value':1.8},{'time':1.3,'value':.08}]};out,r=render(curve,'gain-automation');assert abs(r['duration']-1.5)<.05,r
 def tone_amp(out,at,freq=440):
  raw=subprocess.check_output(core.BASE+['-v','error','-ss',str(at),'-i',out,'-t','0.12','-vn','-ac','1','-ar','8000','-f','f32le','pipe:1']);samples=array.array('f');samples.frombytes(raw);return 2*abs(sum(v*complex(math.cos(2*math.pi*freq*i/8000),math.sin(2*math.pi*freq*i/8000)) for i,v in enumerate(samples)))/len(samples)
 low,high,low2=tone_amp(out,.12),tone_amp(out,.65),tone_amp(out,1.15);assert high>low*2 and high>low2*2,(low,high,low2);bg_low,bg_high,bg_low2=tone_amp(out,.12,660),tone_amp(out,.65,660),tone_amp(out,1.15,660);assert bg_high>bg_low*2 and bg_high>bg_low2*2,(bg_low,bg_high,bg_low2)
 envelope=copy.deepcopy(curve);envelope['bgm']={};envelope['audioClips'][0]['audio']={'volume':.8,'gainEnvelope':[{'time':0,'valueDb':0,'interpolation':'linear'},{'time':.4,'valueDb':-12,'interpolation':'hold'},{'time':.8037,'valueDb':0,'interpolation':'linear'},{'time':1.1,'valueDb':0,'interpolation':'linear'},{'time':1.4,'valueDb':-96,'interpolation':'linear'},{'time':1.5,'valueDb':0,'interpolation':'linear'}]};out,r=render(envelope,'clip-gain-envelope');a0,a12,a1=tone_amp(out,.12),tone_amp(out,.52),tone_amp(out,.85);assert a0>a12*1.8 and a1>a12*2.8,(a0,a12,a1)
 raw=subprocess.check_output(core.BASE+['-v','error','-ss','0.795','-i',out,'-t','0.02','-vn','-ac','1','-ar','48000','-f','f32le','pipe:1']);samples=array.array('f');samples.frombytes(raw);assert max(abs(samples[i]-samples[i-1]) for i in range(1,len(samples)))<.16
 print('Native layers, four tracks, clip gain dB envelope/step de-click, legacy automation and H264/AAC full decode PASS')
