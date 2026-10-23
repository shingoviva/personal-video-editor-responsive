"""B4: actual native export cadence, cut ownership and subframe audio; synthetic data only."""
import array,copy,json,math,os,pathlib,subprocess,sys,tempfile,time
from fractions import Fraction
rates=[('23.976',24000,1001),('24',24,1),('25',25,1),('29.97',30000,1001),('30',30,1),('50',50,1),('59.94',60000,1001),('60',60,1)]
with tempfile.TemporaryDirectory(prefix='pve-b4-native-') as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'));import core
 media=[]
 for color in ['red','blue']:
  src=pathlib.Path(tmp)/(color+'.mp4');core.run({'id':color,'cancel':False},['-f','lavfi','-i',f'color=c={color}:s=160x90:r=60:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',src],1);media.append(core.inspect(src,color,src.name))
 cut=2*1001/24000;clips=[]
 for i,(start,end) in enumerate([(0,cut),(cut,.5)]):clips.append({'id':f'v{i}','media':media[i]['id'],'in':0,'out':end-start,'start':start,'layer':0,'speed':1,'endSpeed':1,'curve':'constant','scale':1,'audio':{'volume':0},'color':{}})
 p={'version':1,'timelineRate':{'numerator':24000,'denominator':1001},'media':media,'clips':clips,'audioClips':[{'id':'a','kind':'audio','media':media[0]['id'],'start':.00037,'layer':0,'in':0,'out':.49963,'speed':1,'endSpeed':1,'curve':'constant','audio':{'volume':.5}}],'audioTracks':[{} for _ in range(4)],'texts':[],'effects':[],'bgm':{},'aspect':'Original','export':{'resolution':'Source','quality':'High'}}
 rows=[];maximum=0;position=None;exact_max=Fraction(0);repair_seconds=[];original_run=core.run
 def timed_run(job,args,*rest,**kwargs):
  begin=time.perf_counter()
  result=original_run(job,args,*rest,**kwargs)
  if pathlib.Path(str(args[-1])).stem=='timed':repair_seconds.append(time.perf_counter()-begin)
  return result
 core.run=timed_run
 for label,numerator,denominator in rates:
  fps=numerator/denominator;p['export']['fps']=label;snapshot=json.dumps(p,sort_keys=True);r=core.render({'id':'b4-'+label,'cancel':False},copy.deepcopy(p));out=core.ROOT/'exports'/r['file'];core.validate_output(out,.5,True)
  probe=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-select_streams','v:0','-show_entries','stream=avg_frame_rate,nb_frames,time_base:frame=best_effort_timestamp,best_effort_timestamp_time','-of','json',str(out)]));stream=probe['streams'][0];actual=core.ratio(stream['avg_frame_rate']);
  if abs(actual-fps)>=1e-8:
   import shutil;shutil.copyfile(out,pathlib.Path('/tmp/pve-b4')/('failed-'+label+'.mp4'));print(json.dumps(probe),flush=True)
  assert abs(actual-fps)<1e-8,(label,stream)
  frames=math.ceil(.5*fps-1e-8);assert int(stream['nb_frames'])==frames,(label,stream)
  for index,frame in enumerate(probe['frames']):
   exact_error=abs(Fraction(int(frame['best_effort_timestamp']))*Fraction(stream['time_base'])-Fraction(index*denominator,numerator));exact_max=max(exact_max,exact_error);assert exact_error==0,(label,index,str(exact_error))
   error=abs(float(frame['best_effort_timestamp_time'])-index*denominator/numerator)
   if error>maximum:maximum=error;position={'fps':label,'frame':index}
   assert error<=1e-6,(label,index,error)
  rgb=subprocess.check_output(core.BASE+['-v','error','-i',out,'-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);boundary=math.ceil(cut*fps-1e-8)
  for index in range(frames):
   red,green,blue=rgb[index*3:index*3+3];assert (red>blue if index<boundary else blue>red),(label,index,boundary,list(rgb[index*3:index*3+3]))
  raw=subprocess.check_output(core.BASE+['-v','error','-i',out,'-map','0:a','-ac','1','-ar','48000','-f','f32le','pipe:1']);a=array.array('f');a.frombytes(raw);segment=a[4800:19200];assert math.sqrt(sum(x*x for x in segment)/len(segment))>.02
  assert json.dumps(p,sort_keys=True)==snapshot;rows.append({'fps':label,'rational':f'{numerator}/{denominator}','frames':frames,'firstBlueFrame':boundary,'cutSecondsUnchanged':cut,'audioStartSecondsUnchanged':.00037,'fullDecode':True})
 result={'result':'PASS','rows':rows,'maxExactPTSSeconds':float(exact_max),'repairPassSeconds':repair_seconds,'maxPTSDisplaySeconds':maximum,'maximum':position,'PTSDisplayTolerance':1e-6,'note':'ffprobe timestamps are printed to six decimal places; sample ownership checked by decoded frame colors'};pathlib.Path(sys.argv[1]).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
