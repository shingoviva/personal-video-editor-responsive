"""Optional real-media QA for every clip transition. Not run in CI."""
import os,sys,pathlib,tempfile,subprocess,shutil,json,array,math
from PIL import Image,ImageDraw
import numpy as np

repo=pathlib.Path(__file__).resolve().parent.parent
sources=[repo/'.qa-media/real/IMG_7917.mov',repo/'.qa-media/real/IMG_7697.MP4']
if not all(path.is_file() for path in sources):
 print('SKIP: place IMG_7917.mov and IMG_7697.MP4 in .qa-media/real/');raise SystemExit(0)
artifact=pathlib.Path('/tmp/pve-real-transition-qa');shutil.rmtree(artifact,ignore_errors=True);artifact.mkdir()

with tempfile.TemporaryDirectory(prefix='pve-real-transition-engine-') as data:
 os.environ['PVE_DATA']=data;sys.path.insert(0,str(repo/'engine'));import core
 media=[core.inspect(path,f'real-{i}',path.name) for i,path in enumerate(sources)]
 specs=[
  (media[0],2,4,None),(media[1],5,7,{'type':'dissolve','duration':.8,'direction':'left'}),
  (media[0],8,10,{'type':'slide','duration':.8,'direction':'left'}),(media[1],12,14,{'type':'wipe','duration':.8,'direction':'right'}),
  (media[0],15,17,{'type':'circle','duration':.8,'direction':'left'})]
 def clips(transitions=True):
  values=[]
  for i,(m,a,b,transition) in enumerate(specs):
   value={'id':f'c{i}','media':m['id'],'in':a,'out':b,'start':i*2,'layer':0,'speed':1,'endSpeed':1,'curve':'constant','stabilization':'OFF','audio':{'volume':1,'mute':False},'color':{}}
   if transitions and transition:value['transition']=transition
   values.append(value)
  return values
 def project(transitions=True,fps=30):return{'version':1,'media':media,'clips':clips(transitions),'audioClips':[],'videoTracks':[{'hidden':False,'volume':1} for _ in range(3)],'audioTracks':[{} for _ in range(4)],'texts':[],'effects':[],'bgm':{},'aspect':'Original','export':{'resolution':'Source','fps':fps,'quality':'Preview','codec':'H.264'}}
 base_result=core.render({'id':'real-transition-base','cancel':False},project(False),preview=True);base=core.ROOT/'cache'/base_result['file']
 test_result=core.render({'id':'real-transition-preview','cancel':False},project(True),preview=True);test=core.ROOT/'cache'/test_result['file']
 final_base_result=core.render({'id':'real-transition-final-base','cancel':False},project(False,60),preview=False);final_base=core.ROOT/'exports'/final_base_result['file']
 final_result=core.render({'id':'real-transition-final','cancel':False},project(True,60),preview=False);final=core.ROOT/'exports'/final_result['file']
 def tail_project(fps=30):
  values=[]
  for i,(m,a,b,_) in enumerate(specs[:-1]):
   available=max(0,m['duration']-b);span=min(available,.8);speed=max(.05,span/.8)
   values.append({'id':f'tail-{i}','media':m['id'],'in':b,'out':b+span,'start':2+i*2,'layer':0,'speed':speed,'endSpeed':speed,'curve':'constant','stabilization':'OFF','audio':{'volume':0,'mute':True},'color':{}})
  value=project(False,fps);value['clips']=values;return value
 tail_preview_result=core.render({'id':'real-transition-tail-preview','cancel':False},tail_project(),preview=True);tail_preview=core.ROOT/'cache'/tail_preview_result['file']
 tail_final_result=core.render({'id':'real-transition-tail-final','cancel':False},tail_project(60),preview=False);tail_final=core.ROOT/'exports'/tail_final_result['file']
 shutil.copy2(tail_preview,artifact/'preview-outgoing-tails.mp4');shutil.copy2(tail_final,artifact/'final-60fps-outgoing-tails.mp4')
 shutil.copy2(base,artifact/'preview-hard-cuts.mp4');shutil.copy2(test,artifact/'preview-all-transitions.mp4');shutil.copy2(final_base,artifact/'final-60fps-hard-cuts.mp4');shutil.copy2(final,artifact/'final-60fps-all-transitions.mp4')
 for path,result in ((test,test_result),(final,final_result)):
  info=core.validate_output(path,10,True);assert info['duration']>9.95 and info['audio'];assert result['duration']==10
 def frame(path,index):
  # Select by encoded frame number. Timestamp seeking can return the adjacent
  # 60fps frame around a concat boundary and would weaken the comparison.
  raw=subprocess.check_output(core.BASE+['-v','error','-i',path,'-vf',f'select=eq(n\\,{index})','-vsync','0','-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1'])
  import io;return np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'),dtype=np.float32)
 def frame_at_time(path,seconds):
  # Auxiliary tail renders can contain sparse leading time. Seek by their
  # project timestamp so the expected outgoing frame matches the transition.
  raw=subprocess.check_output(core.BASE+['-v','error','-ss',str(seconds),'-i',path,'-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1'])
  import io;return np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'),dtype=np.float32)
 def ease(u):u=max(0,min(1,u));return u*u*(3-2*u)
 boundaries=[(2,'dissolve','left'),(4,'slide','left'),(6,'wipe','right'),(8,'circle','left')];checks=[];thumbs=[]
 for boundary,kind,direction in boundaries:
  for offset in (.2,.4,.6):
   index=round((boundary+offset)*30);old=frame_at_time(tail_preview,boundary+offset);current=frame(base,index);actual=frame(test,index);p=ease(offset/.8);h,w=actual.shape[:2];expected=np.zeros_like(actual)
   if kind=='dissolve':expected=old*(1-p)+current*p
   elif kind=='slide':
    shift_old=round(p*w);shift_new=round((1-p)*w)
    if shift_old<w:expected[:,:w-shift_old]=old[:,shift_old:]
    if shift_new<w:expected[:,shift_new:]=current[:,:w-shift_new]
   elif kind=='wipe':
    expected[:]=old;edge=round(w*(1-p));expected[:,edge:]=current[:,edge:]
   else:
    expected[:]=old;y,x=np.ogrid[:h,:w];mask=np.hypot(x-w/2,y-h/2)<=math.hypot(w,h)/2*p;expected[mask]=current[mask]
   mae=float(np.mean(np.abs(actual-expected)));assert mae<9,(kind,offset,mae);checks.append({'render':'preview','type':kind,'offset':offset,'mae':round(mae,3)})
   image=Image.fromarray(actual.astype(np.uint8));ImageDraw.Draw(image).rectangle((0,0,210,28),fill=(8,12,10));ImageDraw.Draw(image).text((8,7),f'{kind}  +{offset:.1f}s  MAE {mae:.2f}',fill=(225,235,190));thumbs.append(image)
 # No black flashes and no duplicate run around any edit boundary.
 for boundary,kind,_ in boundaries:
  samples=[frame(test,round(boundary*30)+i) for i in range(-2,27)];luma=[float(np.mean(value)) for value in samples];assert min(luma)>3,(kind,min(luma));diffs=[float(np.mean(np.abs(a-b))) for a,b in zip(samples,samples[1:])];assert sum(d<.03 for d in diffs)<4,(kind,diffs)
 # Audio remains present across every cut; the transition changes picture only.
 raw=subprocess.check_output(core.BASE+['-v','error','-i',test,'-vn','-ac','1','-ar','48000','-f','f32le','pipe:1']);audio=array.array('f');audio.frombytes(raw)
 for boundary,kind,_ in boundaries:
  center=round(boundary*48000);window=audio[center-2400:center+2400];rms=math.sqrt(sum(v*v for v in window)/len(window));longest=run=0
  for value in window:
   if abs(value)<1e-7:run+=1;longest=max(longest,run)
   else:run=0
  assert rms>.0001 and longest<240,(kind,rms,longest)
 # Repeat the pixel-accurate geometry check on the 1080×1920 / 60fps final path.
 for boundary,kind,direction in boundaries:
  for offset in (.2,.4,.6):
   index=round((boundary+offset)*60);old=frame_at_time(tail_final,boundary+offset);current=frame(final_base,index);actual=frame(final,index);p=ease(offset/.8);h,w=actual.shape[:2];expected=np.zeros_like(actual)
   if kind=='dissolve':expected=old*(1-p)+current*p
   elif kind=='slide':
    shift_old=round(p*w);shift_new=round((1-p)*w)
    if shift_old<w:expected[:,:w-shift_old]=old[:,shift_old:]
    if shift_new<w:expected[:,shift_new:]=current[:,:w-shift_new]
   elif kind=='wipe':expected[:]=old;edge=round(w*(1-p));expected[:,edge:]=current[:,edge:]
   else:
    expected[:]=old;y,x=np.ogrid[:h,:w];mask=np.hypot(x-w/2,y-h/2)<=math.hypot(w,h)/2*p;expected[mask]=current[mask]
   mae=float(np.mean(np.abs(actual-expected)));assert mae<9,(kind,'final',offset,mae);checks.append({'render':'final-60fps','type':kind,'offset':offset,'mae':round(mae,3)})
 cols=3;tw,th=thumbs[0].size;sheet=Image.new('RGB',(tw*cols,th*math.ceil(len(thumbs)/cols)),(8,10,9))
 for i,image in enumerate(thumbs):sheet.paste(image,((i%cols)*tw,(i//cols)*th))
 sheet.save(artifact/'transition-contact-sheet.jpg',quality=92)
 report={'sources':[{'name':m['name'],'codec':m['codec'],'fps':m['fps'],'rotation':m['rotation'],'duration':m['duration']} for m in media],'preview':test_result,'final':final_result,'checks':checks}
 (artifact/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('Real transition QA PASS');print(json.dumps(report,ensure_ascii=False,indent=2));print('ARTIFACT',artifact)
