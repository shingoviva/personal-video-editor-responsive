"""Synthetic AV QA helpers; standard library only, no user media."""
import array,json,math,pathlib,random,subprocess,wave
RATE=48000

def command(core,args):
 subprocess.run(core.BASE+['-v','error',*map(str,args)],check=True,capture_output=True)

def decode(core,path):
 raw=subprocess.check_output(core.BASE+['-v','error','-i',path,'-map','0:a:0','-ac','1','-ar',str(RATE),'-f','f32le','pipe:1']);a=array.array('f');a.frombytes(raw);return a

def fixture(core,folder,rate,codec,duration=2,markers=(.5,1,1.5)):
 name=f'{rate}-{codec}-{duration}';wav=folder/(name+'.wav');a=array.array('h',[0])*round(rate*duration)
 for j,t in enumerate(markers):
  center=round(t*rate);rng=random.Random(712+j)
  for k in range(-40,41):a[center+k]=round(rng.uniform(-.12,.12)*32767)
  a[center]=18000
 with wave.open(str(wav),'wb') as f:f.setparams((1,2,rate,0,'NONE','not compressed'));f.writeframes(a.tobytes())
 path=folder/(name+('.mp4' if codec=='aac' else '.mov'))
 enable='+'.join(f'between(t,{t},{t+.05-1e-7})' for t in markers)
 args=['-f','lavfi','-i',f"color=black:s=96x54:r=60:d={duration},drawbox=color=white:t=fill:enable='{enable}'",'-i',wav,'-t',duration]
 args+=['-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k'] if codec=='aac' else ['-c:v','prores_ks','-profile:v','hq','-pix_fmt','yuv422p10le','-c:a','pcm_s24le']
 command(core,[*args,path]);return path

def lag(reference,actual,source_time,output_time,radius=2048):
 """Normalized waveform cross-correlation, full one-sample lag resolution."""
 center=round(source_time*RATE);half=64;template=reference[center-half:center+half];energy=sum(x*x for x in template);assert energy>0
 base=round(output_time*RATE)-half;lo=max(0,base-radius);hi=min(len(actual)-len(template),base+radius);prefix=[0.]
 for x in actual[lo:hi+len(template)]:prefix.append(prefix[-1]+x*x)
 best=(-1.,None)
 for at in range(lo,hi+1):
  e=prefix[at-lo+len(template)]-prefix[at-lo]
  if e<energy*1e-8:continue
  score=sum(x*actual[at+i] for i,x in enumerate(template))/math.sqrt(energy*e)
  if score>best[0]:best=(score,at-base)
 assert best[1] is not None,('marker lost',source_time,output_time)
 # A trim can fall halfway between 44.1kHz samples. Its resampled phase
 # need not match a full-file decode at an integer 48kHz lag. Refine only
 # around the integer peak; do not widen the accepted timing tolerance.
 refined=(best[0],float(best[1]))
 for fraction in [-.75,-.5,-.25,.25,.5,.75]:
  at=base+best[1];shift=math.floor(fraction);alpha=fraction-shift
  if at+shift<0 or at+shift+len(template)+1>=len(actual):continue
  window=[actual[at+shift+i]*(1-alpha)+actual[at+shift+i+1]*alpha for i in range(len(template))]
  e=sum(x*x for x in window)
  if e:
   score=sum(x*y for x,y in zip(template,window))/math.sqrt(energy*e)
   if score>refined[0]:refined=(score,best[1]+fraction)
 return {'sourceTime':source_time,'sourceSampleAt48k':round(source_time*RATE),'outputTime':output_time,'expectedOutputSample':round(output_time*RATE),'matchedOutputSample':round(output_time*RATE)+best[1],'lagSamples':best[1],'lagSeconds':best[1]/RATE,'correlation':refined[0],'integerCorrelation':best[0],'fractionalLagSamples':refined[1]}

def probe(core,path):
 return json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-show_streams','-show_entries','stream=index,codec_type,codec_name,sample_rate,time_base,start_time,duration:packet=stream_index,pts,dts,duration,side_data_list','-read_intervals','%+#3','-show_packets','-of','json',str(path)]))
