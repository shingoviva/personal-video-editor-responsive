"""Export the saved synthetic browser project through the actual native engine."""
import pathlib,sys,os,json,time,shutil
repo,fixture,out,project=map(lambda v:pathlib.Path(v).resolve(),sys.argv[1:]);out.mkdir(parents=True,exist_ok=True);os.environ['PVE_DATA']=str(out/'mac-data');sys.path.insert(0,str(repo/'engine'));import core
p=json.loads(project.read_text());stages=[];run=core.run
for m in p['media']:core.inspect(fixture/m['name'],m['id'],m['name'])
def timed(job,args,*a,**kw):
 t=time.perf_counter();result=run(job,args,*a,**kw);stages.append({'operation':job.get('operation'),'seconds':time.perf_counter()-t,'output':pathlib.Path(str(args[-1])).name});return result
core.run=timed;t=time.perf_counter();result=core.render({'id':'representative','cancel':False},p);elapsed=time.perf_counter()-t;file=core.ROOT/'exports'/result['file'];core.validate_output(file,30,True);shutil.copy2(file,out/'mac.mp4');(out/'mac.json').write_text(json.dumps({'seconds':elapsed,'projectFormat':p['version'],'result':result,'stages':stages},indent=2));print('Mac 30s PASS',elapsed)
