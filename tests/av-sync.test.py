"""Equal-speed native AV regression: samples/correlation, codecs/rates, edit paths.
The unchanged historical flash/beep QA is a separate 2ms acceptance oracle.
"""
import copy,json,math,os,pathlib,subprocess,sys,tempfile
from av_sync_helpers import fixture,decode,lag,RATE
repo=pathlib.Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='pve-av-regression-') as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(repo/'engine'));import core
 folder=pathlib.Path(tmp);rows=[]
 assert core.atempo(1)=='anull'
 for speed in [.25,.5,.75,1.25,1.5,2,4]:assert 'atempo=' in core.atempo(speed)
 for rate in [44100,48000]:
  for input_codec in ['aac','pcm']:
   src=fixture(core,folder,rate,input_codec);reference=decode(core,src);m=core.inspect(src,str(rate)+input_codec,src.name)
   for fps in ['24','29.97','30','60']:
    for codec in ['H.264','ProRes 422 HQ']:
     p={'version':1,'clips':[{'id':'v','media':m['id'],'in':0,'out':2,'audio':{'volume':.5}}],'effects':[],'texts':[],'export':{'fps':fps,'codec':codec,'quality':'High','resolution':'Source'}}
     result=core.render({'id':rate.__str__()+input_codec+fps+codec,'cancel':False},p);out=core.ROOT/'exports'/result['file'];actual=decode(core,out);checks=[lag(reference,actual,t,t) for t in [.5,1,1.5]]
     assert all(abs(x['lagSamples'])<=1 and x['correlation']>.8 for x in checks),(rate,input_codec,fps,codec,checks)
     cadence=float(core.export_frame_rate(fps));luma=subprocess.check_output(core.BASE+['-v','error','-i',out,'-map','0:v','-vf','scale=1:1','-pix_fmt','gray','-f','rawvideo','pipe:1']);video=[]
     for marker,check in zip([.5,1,1.5],checks):
      expected=math.ceil(marker*cadence-1e-8);assert luma[expected]>128 and (expected==0 or luma[expected-1]<128),(fps,marker,expected)
      av=expected/cadence-marker-check['lagSeconds'];assert abs(av)<.002,(fps,marker,av)
      video.append({'marker':marker,'firstFlashFrame':expected,'videoTime':expected/cadence,'AVDifferenceSeconds':av})
     rows.append({'inputRate':rate,'inputCodec':input_codec,'outputCodec':codec,'fps':fps,'markers':checks,'videoMarkers':video})
   # A linked extracted audio row, trim/split, and two independently timed lanes.
   for scenario in ['trim-split-video','linked-audio','two-lanes']:
    base={'media':m['id'],'audio':{'volume':.4},'speed':1,'endSpeed':1,'curve':'constant'}
    p={'version':1,'clips':[{'media':m['id'],'in':0,'out':2,'audio':{'volume':0}}],'audioClips':[],'texts':[],'effects':[],'export':{'fps':30,'codec':'ProRes 422 HQ','resolution':'Source'}}
    mappings=[]
    if scenario=='trim-split-video':
     p['clips']=[{**base,'in':.125,'out':.875,'start':.125},{**base,'in':.875,'out':1.875,'start':.875}];mappings=[(t,t) for t in [.5,1,1.5]]
    elif scenario=='linked-audio':
     p['audioClips']=[{**base,'id':'linked','kind':'audio','linkedVideoId':'v','in':.25,'out':1.75,'start':.375,'layer':0}];mappings=[(t,t+.125) for t in [.5,1,1.5]]
    else:
     p['audioClips']=[{**base,'id':'a','kind':'audio','in':.25,'out':1.75,'start':.125,'layer':0},{**base,'id':'b','kind':'audio','in':0,'out':1.75,'start':.25,'layer':1}];mappings=[(t,t-.125) for t in [.5,1,1.5]]+[(t,t+.25) for t in [.5,1,1.5]]
    r=core.render({'id':str(rate)+input_codec+scenario,'cancel':False},p);actual=decode(core,core.ROOT/'exports'/r['file']);checks=[lag(reference,actual,a,b) for a,b in mappings];assert all(abs(x['lagSamples'])<=1 and x['correlation']>.8 for x in checks),(scenario,checks);rows.append({'inputRate':rate,'inputCodec':input_codec,'scenario':scenario,'markers':checks})
 result={'result':'PASS','rows':rows,'sampleRate':RATE,'maxAbsoluteLagSamples':max(abs(m['lagSamples']) for row in rows for m in row['markers']),'note':'Waveform correlation precision <=1 sample; speed !=1 is investigated separately, not declared passing.'}
 if len(sys.argv)>1:pathlib.Path(sys.argv[1]).write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'result':result['result'],'cases':len(rows),'maxAbsoluteLagSamples':result['maxAbsoluteLagSamples']}))
