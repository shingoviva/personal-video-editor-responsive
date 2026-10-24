"""Independent sample/PTS/content checks for 30s representative exports."""
import pathlib,sys,os,json,subprocess,hashlib,importlib.util
repo=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path(sys.argv[1]).resolve();os.environ['PVE_DATA']=str(root/'output-verify-data');sys.path[:0]=[str(repo/'engine'),str(repo/'tests')];import core
from av_sync_helpers import decode,lag
spec=importlib.util.spec_from_file_location('boxes',repo/'scripts/mp4-structure.py');q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
reference=decode(core,root/'representative/music.wav');marks=json.loads((root/'representative/fixture.json').read_text())['markers'];rows=[]
def framehash(path):return subprocess.check_output(core.BASE+['-v','error','-i',str(path),'-map','0:v:0','-f','framemd5','-']).decode().splitlines()
for engine in ['chrome','webkit','mac']:
 paths=[root/f'representative-{variant}'/(engine+'.mp4') for variant in ['before','after']]
 if not all(p.exists() for p in paths):continue
 audios=[];images=[]
 for variant,path in zip(['before','after'],paths):
  pcm=decode(core,path);audios.append(pcm);checks=[lag(reference,pcm,t,t,radius=256) for t in marks];assert all(abs(x['lagSamples'])<=96 for x in checks),(engine,variant,checks)
  streams=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-show_streams','-of','json',str(path)]))['streams'];video=next(s for s in streams if s['codec_type']=='video');assert int(video['nb_frames'])==900
  frames=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-select_streams','v','-show_frames','-show_entries','frame=pts_time','-of','json',str(path)]))['frames'];error=max(abs(float(f['pts_time'])-i/30) for i,f in enumerate(frames));assert error<.000002
  if engine!='mac':
   a=q.structure(path.read_bytes())[-1];assert len(a['groups'])==2 and a['packets']==sum(n for n,d in a['stts']);report=next(r for r in json.loads((path.parent/'representative.json').read_text()) if r['engine']==engine);timing=report['result']['audioTiming'];assert a['edits'][0]['media_time']==timing['prerollSamples']+timing['primingSamples']
  images.append(framehash(path));rows.append({'engine':engine,'variant':variant,'frames':900,'samples':len(pcm),'maxPTSErrorSeconds':error,'markers':checks})
 assert audios[0]==audios[1],('PCM changed',engine)
 same=images[0]==images[1];rows.append({'engine':engine,'PCMIdentical':True,'allDecodedFramesIdentical':same})
 if not same:
  r=subprocess.check_output(core.BASE+['-i',str(paths[0]),'-i',str(paths[1]),'-lavfi','ssim','-f','null','-'],stderr=subprocess.STDOUT).decode();(root/(engine+'-ssim.log')).write_text(r)
(root/'representative-independent.json').write_text(json.dumps(rows,indent=2));print('Independent 30s output PASS',[(r['engine'],r.get('allDecodedFramesIdentical'))for r in rows if'PCMIdentical'in r])
