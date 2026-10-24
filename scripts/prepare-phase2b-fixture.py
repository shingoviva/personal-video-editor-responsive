"""Synthetic MV-like 30s 720p30 fixture. No user files; deterministic signed markers."""
import pathlib,sys,wave,math,struct,json,hashlib,subprocess
root=pathlib.Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True);rate=48000;marks=[.1,1,5,15,25,29.5]
# Music-like harmonic bed + unique deterministic chirp/noise markers.
state=10273;noise=[]
for i in range(2048):state=(1664525*state+1013904223)&0xffffffff;noise.append(((state/2**32)*2-1)*.55*math.sin(math.pi*i/2048)**2)
a=[]
for i in range(30*rate):
 t=i/rate;v=.025*(math.sin(2*math.pi*220*t)+math.sin(2*math.pi*330*t)+math.sin(2*math.pi*440*t))
 for m in marks:
  k=i-round(m*rate)
  if 0<=k<len(noise):v+=noise[k]
 a.append(max(-32767,min(32767,round(v*32767))))
with wave.open(str(root/'music.wav'),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(struct.pack('<'+'h'*len(a),*a))
cmd=['/opt/homebrew/bin/ffmpeg','-v','error','-y','-f','lavfi','-i','testsrc2=s=1280x720:r=30:d=30','-i',str(root/'music.wav'),'-vf',"drawbox=x=0:y=0:w=120:h=120:color=white:t=fill:enable='eq(n,3)+eq(n,30)+eq(n,150)+eq(n,450)+eq(n,750)+eq(n,885)'",'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t','30',str(root/'source.mp4')];subprocess.run(cmd,check=True)
(root/'fixture.json').write_text(json.dumps({'synthetic':True,'duration':30,'width':1280,'height':720,'fps':'30','sampleRate':rate,'markers':marks,'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'source.mp4',root/'music.wav']}},indent=2))
print('prepared synthetic 30s 720p30 motion + signed audio markers')
