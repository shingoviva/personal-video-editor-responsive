"""Functional pipeline validation using deterministic synthetic fixtures, not iPhone certification."""
import os,pathlib,sys,subprocess,json,time,copy,hashlib,base64,struct,zlib
HERE=pathlib.Path(__file__).resolve().parent.parent
TEST=pathlib.Path(os.environ.get('PVE_TEST_DIR','/tmp/pve-validation'));TEST.mkdir(exist_ok=True)
os.environ['PVE_DATA']=str(TEST/'data');sys.path.insert(0,str(HERE/'engine'));import core
results={}
def command(args):
 r=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-threads','2','-filter_threads','2','-y']+list(map(str,args)),capture_output=True,text=True)
 if r.returncode:raise RuntimeError(r.stderr)
def fixture(name,rate=60,audio=True):
 f=TEST/(name+'.mp4');args=['-f','lavfi','-i',f'testsrc2=size=640x360:rate={rate}']
 if audio:args+=['-f','lavfi','-i','sine=frequency=440:sample_rate=48000']
 args+=['-t','1.6','-c:v','libx264','-threads','2','-preset','ultrafast']
 if audio:args+=['-c:a','aac']
 command(args+[f]);return core.inspect(f,name,name+'.mp4')
def text_png(width=320,height=120):
 rows=b''.join(b'\0'+bytes((255,255,255,255))*width for _ in range(height))
 def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
 return 'data:image/png;base64,'+base64.b64encode(png).decode()
m=fixture('source');original=hashlib.sha256(pathlib.Path(m['path']).read_bytes()).hexdigest()
c={'id':'c1','media':m['id'],'in':0,'out':1.5,'speed':1,'endSpeed':1,'curve':'constant','scale':1,'x':.5,'y':.5,'color':{},'audio':{'volume':.7,'fadeIn':.1,'fadeOut':.2},'stabilization':'OFF'}
p={'version':1,'clips':[c],'aspect':'9:16','export':{'resolution':'1080p','fps':30,'quality':'Preview'},'texts':[]}
def test(name,fn):
 t=time.time()
 try:result=fn();results[name]={'pass':True,'seconds':round(time.time()-t,2),'result':result};print(name,'PASS',flush=True)
 except Exception as e:results[name]={'pass':False,'seconds':round(time.time()-t,2),'error':str(e)};print(name,'FAIL',str(e)[-900:],flush=True)
 (TEST/'results.json').write_text(json.dumps(results,indent=2))
def render(p):
 j={'id':core.uuid.uuid4().hex,'cancel':False};r=core.render(j,copy.deepcopy(p),True);path=core.ROOT/'cache'/r['file'];probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',path]));v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio');duration=float(probe['format']['duration']);assert abs(duration-r['duration'])<.15,(duration,r);assert v['codec_name']=='h264' and a['codec_name']=='aac';assert v['width']==r['width'] and v['height']==r['height'];assert abs(float(v.get('duration',duration))-float(a.get('duration',duration)))<.15,('av duration',v.get('duration'),a.get('duration'));return {'duration':duration,'expected':r['duration'],'size':[v['width'],v['height']],'audio':a['codec_name']}
test('prepare_proxy_and_metadata',lambda:core.prepare({'cancel':False},m['id']))
test('cut_crop_audio',lambda:render(p))
q=copy.deepcopy(p);q['clips'][0]['audio'].update(delayEnabled=True,delayTime=.18,delayFeedback=.45,delayMix=.35);test('high_quality_audio_delay',lambda:render(q))
for speed in (.05,20):
 q=copy.deepcopy(p);q['clips'][0].update(speed=speed,out=.5 if speed==.05 else 1.5)
 test('speed_'+str(speed),lambda q=q:render(q))
q=copy.deepcopy(p);q['clips'][0].update(speed=1.2375,out=.8)
test('speed_custom_decimal',lambda:render(q))
q=copy.deepcopy(p);q['clips'][0].update(speed=.1,endSpeed=8,curve='ease-in-out');test('ramp_audio_sync',lambda:render(q))
caps=core.capabilities()
q=copy.deepcopy(p);q['clips'][0].update(speed=.3,interpolation='blend',hold=.5);q['clips'][0]['color']={'exposure':.4,'contrast':20,'shadows':10,'temperature':-20,'vibrance':10};q['texts']=[{'text':"PERSONAL : 50% 'test' \\ 中文",'start':0,'end':2,'fade':.2,'size':30,'x':.5,'y':.8,'opacity':1,'font':'Sans','raster':{'data':text_png(),'width':320,'height':120}}] if caps.get('textRaster') else [];test('blend_color_hold'+('_text' if q['texts'] else ''),lambda:render(q));results['text_capability']={'pass':True,'supported':bool(caps.get('text')),'browserRaster':bool(caps.get('textRaster')),'drawtext':bool(caps.get('drawtext'))}
if caps.get('motionInterpolation'):
 q=copy.deepcopy(p);q['clips'][0].update(out=.6,speed=.25,interpolation='motion');test('motion_compensated_slow',lambda:render(q))
 q=copy.deepcopy(p);q['clips'][0].update(out=.6,speed=.25,interpolation='motion-max');test('motion_compensated_slow_maximum',lambda:render(q))
q=copy.deepcopy(p);q['clips'][0]['stabilization']='NATURAL'
if caps.get('stabilization'):test('stabilizer',lambda:render(q))
else:
 try:core.preflight_render(q,caps=caps);raise AssertionError('missing vidstab accepted')
 except ValueError as e:assert 'vidstab' in str(e);results['stabilizer']={'pass':True,'supported':False,'preflight':str(e)}
q=copy.deepcopy(p);q['clips']=[{**c,'out':.5},{'id':'gap','gap':.4,'media':m['id']},{**c,'id':'c2','in':.5,'out':1.5,'speed':2}];q['bgm']={'media':m['id'],'volume':.2,'fadeIn':.1,'fadeOut':.2};test('multi_clip_gap_bgm',lambda:render(q))
def analyze(mode):
 result=core.analyze({'cancel':False},m['id'],mode);assert all(k in result['stats'] for k in ('luma','low','high','contrast','clipping','motion'));return {k:v for k,v in result.items() if k!='samples'}
for mode in ('HIGH FASHION','CLUB'):
 test('analyze_'+mode,lambda mode=mode:analyze(mode))
mute=fixture('noaudio',120,False);q=copy.deepcopy(p);q['clips'][0]['media']=mute['id'];test('120fps_no_audio',lambda:render(q))
assert original==hashlib.sha256(pathlib.Path(m['path']).read_bytes()).hexdigest();results['source_unchanged']={'pass':True}
(TEST/'results.json').write_text(json.dumps(results,indent=2));print('REPORT',TEST/'results.json');sys.exit(0 if all(r['pass'] for r in results.values()) else 1)
