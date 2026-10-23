"""B3 dense automation: real FFmpeg PCM and production render_tracks, disposable data."""
import array,json,os,pathlib,subprocess,sys,tempfile
fixtures=json.loads(pathlib.Path(sys.argv[1]).read_text());output=pathlib.Path(sys.argv[2])
with tempfile.TemporaryDirectory(prefix='pve-b3-native-') as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'))
 import core,audio_engine
 root=pathlib.Path(tmp);rows=[]
 def render(points,duration,block=False,offset=0,source_duration=None):
  expr=core.gain_envelope_expression(points,source_duration or duration,f'(t+{offset:.17g})' if offset else 't')
  filt=f"asetnsamples=n=64:p=0,volume='{expr}':eval=frame" if block else f"aeval='val(0)*({expr})'"
  script=root/'test.filter';script.write_text(filt)
  proc=subprocess.run([core.FFMPEG,'-v','error','-f','lavfi','-i',f'aevalsrc=0.25:s=48000:d={duration:.17g}','-/filter:a',str(script),'-ac','1','-f','f32le','pipe:1'],capture_output=True)
  assert proc.returncode==0,proc.stderr.decode()[-2000:]
  data=array.array('f');data.frombytes(proc.stdout);return data
 for f in fixtures:
  a=render(f['points'],1);expected=f['sampleExpected'];assert len(a)==len(expected)
  error,index=max((abs(x-y),i) for i,(x,y) in enumerate(zip(a,expected)))
  assert error<=2e-7,(f['n'],error,index)
  rows.append({'points':f['n'],'samples':len(a),'maxAbsolutePCM':error,'sourceTime':index/48000})
 # Same source-time grid for split/trim, both sample and production 64-frame evaluation.
 edits=[]
 for f in fixtures:
  parts=[('left',0,f['cut'],f['left']),('right',f['cut'],1-f['cut'],f['right']),('trim',0,1,f['trim'])]
  for label,start,length,points in parts:
   for block in [False,True]:
    a=render(points,length,block);b=render(f['points'],length,block,start,1)
    assert len(a)==len(b)
    error,index=max((abs(x-y),i) for i,(x,y) in enumerate(zip(a,b)))
    assert error<=2e-7,(f['n'],label,block,error,index)
    edits.append({'points':f['n'],'edit':label,'block64':block,'samples':len(a),'maxAbsolutePCM':error,'sourceTime':start+index/48000})
 # Production export path, including >32KB option-file transport and cleanup.
 source=root/'source.wav';subprocess.run([core.FFMPEG,'-v','error','-f','lavfi','-i','aevalsrc=0.25:s=48000:d=1','-c:a','pcm_f32le',str(source)],check=True)
 core.MEDIA['b3-tone']={'path':str(source),'duration':1,'audio':True,'kind':'audio'}
 production=[];original=core.run
 for fail in [False,True]:
  folder=root/('failure' if fail else 'success');folder.mkdir();used=[]
  def run(job,args,*rest):
   if '-/filter:a' in args:
    file=pathlib.Path(args[args.index('-/filter:a')+1]);used.append(file);assert file.exists()
    if fail:raise RuntimeError('injected filter execution failure')
   return original(job,args,*rest)
  core.run=run
  project={'audioTracks':[{'volume':1}],'audioClips':[{'id':'b3','media':'b3-tone','in':0,'out':1,'start':0,'speed':1,'endSpeed':1,'curve':'constant','layer':0,'audio':{'volume':1,'gainEnvelope':fixtures[-1]['points']}}]}
  snapshot=json.dumps(project,sort_keys=True)
  try:
   paths=audio_engine.render_tracks({'id':'b3-native','cancel':False},project,audio_engine.validate_audio(project),folder,1)
   assert not fail and len(paths)==1
   pcm=subprocess.run([core.FFMPEG,'-v','error','-i',str(paths[0]),'-f','f32le','pipe:1'],check=True,capture_output=True).stdout
   data=array.array('f');data.frombytes(pcm);assert len(data)==96000
   assert max(abs(x) for x in data[90000:94000])>.01
   production.append({'result':'PASS','points':fixtures[-1]['n'],'samples':len(data),'longFilterFile':True})
  except RuntimeError:
   assert fail;production.append({'injectedFailure':'PASS','cleanup':True})
  finally:core.run=original
  assert used and all(not file.exists() for file in used)
  assert json.dumps(project,sort_keys=True)==snapshot
 result={'result':'PASS','ffmpeg':core.FFMPEG,'tolerancePCM':2e-7,'rows':rows,'edits':edits,'production':production}
 output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
