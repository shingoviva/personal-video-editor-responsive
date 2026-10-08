import os,sys,pathlib,subprocess,json,time,resource,hashlib
ROOT=pathlib.Path('/tmp/pve-formats');ROOT.mkdir(exist_ok=True);os.environ['PVE_DATA']=str(ROOT/'data');sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'));import core
results={}
def ff(args):
 r=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-threads','2','-filter_threads','2']+list(map(str,args)),capture_output=True,text=True)
 if r.returncode:raise RuntimeError(r.stderr)
def run(name,fn):
 t=time.time()
 try:results[name]={'pass':True,'result':fn(),'seconds':round(time.time()-t,2)};print(name,'PASS',flush=True)
 except Exception as e:results[name]={'pass':False,'error':str(e)};print(name,'FAIL',str(e),flush=True)
 (ROOT/'results.json').write_text(json.dumps(results,indent=2))
def render(m):
 p={'version':1,'clips':[{'id':'x','media':m['id'],'in':0,'out':m['duration'],'speed':1,'endSpeed':1,'curve':'constant','audio':{},'color':{}}],'aspect':'16:9','export':{'resolution':'1080p','fps':'60','quality':'Preview'}}
 j={'id':core.uuid.uuid4().hex,'cancel':False};out=core.render(j,p,False);f=core.ROOT/'exports'/out['file'];d=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',f]));v=d['streams'][0];assert v['codec_name']=='h264';assert v['color_transfer']=='bt709';assert abs(float(v['duration'])-m['duration'])<.08;return {'duration':v['duration'],'fps':v['avg_frame_rate'],'size':[v['width'],v['height']]}
def hdr():
 source=ROOT/'hdr.mov'
 if not source.exists():ff(['-f','lavfi','-i','testsrc2=size=3840x2160:rate=60','-t','0.6','-vf','format=yuv420p10le','-c:v','libx265','-preset','ultrafast','-x265-params','pools=2:frame-threads=2:log-level=error','-color_primaries','bt2020','-color_trc','arib-std-b67','-colorspace','bt2020nc','-tag:v','hvc1',source])
 m=core.inspect(source,'hdr4k','hdr4k.mov');assert m['hdr'] and m['fps']==60 and m['width']==3840
 core.prepare({'cancel':False},m['id']);return render(m)
if core.capabilities().get('hdr'):run('4k60_hlg_hevc_to_1080_sdr',hdr)
else:results['4k60_hlg_hevc_to_1080_sdr']={'pass':True,'supported':False,'preflight':'zscale / tonemap unavailable'}
def vfr():
 f=ROOT/'vfr.mov';ff(['-f','lavfi','-i','testsrc2=size=640x360:rate=60','-t','2','-vf',"select='if(lt(t,1),not(mod(n,2)),not(mod(n,3)))'",'-fps_mode','vfr','-c:v','libx264','-preset','ultrafast',f]);m=core.inspect(f,'vfr','vfr.mov');p=core.prepare({'cancel':False},m['id']);assert p['rateMode']=='VFR',p;return {'detected':p['rateMode'],'export':render(m)}
run('variable_frame_rate',vfr)
def highfps():
 f=ROOT/'240.mov';ff(['-f','lavfi','-i','testsrc2=size=640x360:rate=240','-t','1','-c:v','libx264','-preset','ultrafast',f]);m=core.inspect(f,'highfps','240.mov');assert m['fps']==240;return render(m)
run('240fps_input',highfps)
def cancelling():
 j={'id':core.uuid.uuid4().hex,'cancel':True}
 target='hdr4k' if 'hdr4k' in core.MEDIA else 'vfr'
 try:core.prepare(j,target)
 except InterruptedError:return {'cancelled':True}
 raise AssertionError('did not cancel')
run('cancellation',cancelling)
print('REPORT',ROOT/'results.json');sys.exit(0 if all(x['pass'] for x in results.values()) else 1)
