"""B2: real FFmpeg expression/PCM regression; temporary files only.
python3 tests/envelope-edit-native.test.py fixtures.json output.json
"""
import array, json, math, os, pathlib, shutil, subprocess, sys, tempfile
fixtures=json.loads(pathlib.Path(sys.argv[1]).read_text());output=pathlib.Path(sys.argv[2])
work=tempfile.TemporaryDirectory(prefix='pve-b2-native-');os.environ['PVE_DATA']=work.name
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'))
import core
# Frozen old expression generator for old projects, without importing the old
# engine module or touching its configured data directories.
# The legacy expression oracle below is independently frozen before B2.
def legacy(points,duration,time_expr='t',step_ramp=.005):
 values=[]
 for point in (points or [])[:256]:
  if isinstance(point,dict):values.append((core.number(point.get('time'),0,0,duration),core.number(point.get('valueDb',point.get('db')),0,-96,12),'hold' if point.get('interpolation')=='hold' or point.get('curve')=='hold' else 'linear'))
 values=sorted({time:(db,curve) for time,db,curve in values}.items())
 if not values:return '1'
 gain=lambda db:f'pow(10,{db:.9f}/20)';expr=gain(values[-1][1][0])
 for (a,(av,curve)),(b,(bv,_)) in reversed(list(zip(values,values[1:]))):
  span=max(1e-6,b-a)
  if curve=='hold':
   ramp=min(max(0,step_ramp),span/2);start=b-ramp
   segment=f'if(lt({time_expr},{start:.9f}),{gain(av)},pow(10,({av:.9f}+({bv-av:.9f})*max(0,min(1,(({time_expr})-{start:.9f})/{ramp:.9f})))/20))' if ramp else gain(av)
  else:
   u=f'max(0,min(1,(({time_expr})-{a:.9f})/{span:.9f}))';segment=f'pow(10,({av:.9f}+({bv-av:.9f})*({u}))/20)'
  expr=f'if(lt({time_expr},{b:.9f}),{segment},{expr})'
 return f'if(lt({time_expr},{values[0][0]:.9f}),{gain(values[0][1][0])},{expr})'
def render(expr,length,block,edges=False):
 samples=max(1,math.ceil(length*48000));seconds=samples/48000
 if block:
  filters=f"asetnsamples=n=64:p=0,volume='{expr}':eval=frame"
  if edges:
   edge=min(.008,length/2);filters+=f',afade=t=in:d={edge:.12f},afade=t=out:st={length-edge:.12f}:d={edge:.12f}'
  args=['-f','lavfi','-i',f'aevalsrc=0.25:s=48000:d={seconds:.12f}','-af',filters]
 else:args=['-f','lavfi','-i',f"aevalsrc='0.25*({expr})':s=48000:d={seconds:.12f}"]
 command=[core.FFMPEG,'-hide_banner','-loglevel','error','-nostdin',*args,'-ac','1','-ar','48000','-f','f32le','pipe:1']
 result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=False)
 if result.returncode:raise AssertionError(result.stderr.decode()[-2000:])
 data=array.array('f');data.frombytes(result.stdout);return data
maximum={'value':0};rows=[];samples=0;legacy_count=0
for f in fixtures:
 assert core.gain_envelope_expression(f['source'],f['duration'])==legacy(f['source'],f['duration']);legacy_count+=1
 parts=[(0,f['cut'],f['left']),(f['cut'],f['duration'],f['right'])] if f['kind']=='split' else [(f['from'],f['to'],f['points'])]
 for start,end,points in parts:
  if end<=start:continue
  # The reference uses the original time axis, evaluated at the exact same frame
  # grid. This does not hide the existing native volume filter's 64-sample steps.
  expected=legacy(f['source'],f['duration'],f'(t+{start:.17g})')
  actual=core.gain_envelope_expression(points,end-start)
  for block in [False,True]:
   a,b=render(expected,end-start,block),render(actual,end-start,block);assert len(a)==len(b),(len(a),len(b))
   worst=max((abs(x-y),i) for i,(x,y) in enumerate(zip(a,b)));samples+=len(a)
   row={'fixture':f['name'],'kind':f['kind'],'range':[start,end],'backend':'production-volume-64' if block else 'sample-accurate-expression','samples':len(a),'maxAbsolutePCM':worst[0],'sourceTime':start+worst[1]/48000}
   rows.append(row)
   if worst[0]>maximum['value']:maximum={'value':worst[0],**row}
   assert worst[0]<=2e-7,row
# Raw before/after concatenation is a separate diagnostic: existing 64-sample
# frame-grid phase and per-clip 8ms fades are not an envelope precision budget.
f=next(f for f in fixtures if f['name']=='reported-5ms' and f.get('cut')==.998)
raw=[]
for edges in [False,True]:
 a=render(core.gain_envelope_expression(f['source'],2),2,True,edges)
 b=render(core.gain_envelope_expression(f['left'],.998),.998,True,edges)+render(core.gain_envelope_expression(f['right'],1.002),1.002,True,edges)
 assert len(a)==len(b)
 error,index=max((abs(x-y),i) for i,(x,y) in enumerate(zip(a,b)))
 raw.append({'withExisting8msFades':edges,'maxAbsolutePCM':error,'sourceTime':index/48000,'samples':len(a),'note':'Unchanged block-grid/fade behavior; not claimed identical to unsplit raw PCM'})
output.write_text(json.dumps({'result':'PASS','sampleRate':48000,'tolerancePCM':2e-7,'cases':len(rows),'samples':samples,'max':maximum,'legacyExpressionsIdentical':legacy_count,'rawConcatenation':raw,'rows':rows},indent=2)+'\n')
work.cleanup();print(json.dumps({'result':'PASS','cases':len(rows),'samples':samples,'max':maximum,'legacyExpressionsIdentical':legacy_count}))
