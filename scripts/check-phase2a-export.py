"""Read-only independent FFmpeg verification of check-phase2a-export.mjs outputs."""
import pathlib,sys,os,json,subprocess,hashlib,importlib.util
repo=pathlib.Path(__file__).resolve().parents[1];sys.path[:0]=[str(repo/'engine'),str(repo/'tests')];os.environ['PVE_DATA']=str(pathlib.Path(sys.argv[2])/'verify-data');import core
from av_sync_helpers import decode,lag
spec=importlib.util.spec_from_file_location('boxes',repo/'scripts/mp4-structure.py');q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
source=pathlib.Path(sys.argv[1]);reference=decode(core,source);rows=[]
def packets(path):
 data=path.read_bytes();a=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-select_streams','a','-show_packets','-show_entries','packet=pos,size','-of','json',str(path)]))['packets'];return hashlib.sha256(b''.join(data[int(p['pos']):int(p['pos'])+int(p['size'])] for p in a)).hexdigest()
def pixels(path):return subprocess.check_output(core.BASE+['-v','error','-ss','1.7','-i',path,'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'])
for folder in map(pathlib.Path,sys.argv[2:]):
 for engine in ['chrome','webkit']:
  base=folder/(engine+'-0.mp4')
  if not base.exists():continue
  audio=decode(core,base);payload=packets(base);basepixel=pixels(base)
  for n in [0,50,100,200,400]:
   if not (folder/(engine+f'-{n}.mp4')).exists():continue
   path=folder/(engine+f'-{n}.mp4');pcm=decode(core,path);assert pcm==audio,('FX changed audio samples',engine,n);assert packets(path)==payload,('FX changed AAC packets',engine,n)
   a=q.structure(path.read_bytes())[-1];assert len(a['groups'])==2 and a['packets']==sum(c for c,d in a['stts'])
   frames=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-select_streams','v','-show_frames','-show_entries','frame=pts_time','-of','json',str(path)]))['frames'];assert len(frames)==60;error=max(abs(float(f['pts_time'])-i/30) for i,f in enumerate(frames));assert error<.000002
   marker=[lag(reference,pcm,t,t,radius=256) for t in [.01,.5,1,1.5,1.99]];assert all(abs(m['lagSamples'])<=96 for m in marker),marker
   pixel=pixels(path);assert n==0 or sum(pixel)>sum(basepixel)+3,('late FX missing',engine,n,pixel,basepixel)
   rows.append({'browser':engine,'n':n,'frames':60,'maxPTSErrorSeconds':error,'audioPCMAndPacketsIdenticalToNoFX':True,'lateFXPresent':n>0,'markers':marker})
result={'result':'PASS','outputs':len(rows),'maxLagSamples':max(abs(m['lagSamples']) for r in rows for m in r['markers']),'rows':rows};(pathlib.Path(sys.argv[2])/'independent.json').write_text(json.dumps(result,indent=2));print({k:v for k,v in result.items() if k!='rows'})
