import os,sys,pathlib,subprocess,urllib.request,urllib.error,json,time,tempfile,http.cookiejar
repo=pathlib.Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='pve-http-') as td:
 token=pathlib.Path(td)/'token';env={**os.environ,'PVE_PORT':'8876','PVE_NO_BROWSER':'1','PVE_DATA':td+'/data','PVE_TEST_TOKEN_FILE':str(token)}
 proc=subprocess.Popen([sys.executable,str(repo/'engine/server.py')],env=env,stdout=subprocess.DEVNULL)
 try:
  for _ in range(100):
   if token.exists():break
   time.sleep(.05)
  base='http://127.0.0.1:8876';opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  try:urllib.request.urlopen(base+'/api/health');raise AssertionError('unauthenticated request accepted')
  except urllib.error.HTTPError as e:assert e.code==401
  assert opener.open(base+'/?token='+token.read_text()).status==200
  assert json.load(opener.open(base+'/api/health'))['ready']
  data={'version':1,'id':'test-project','name':'Save test','clips':[],'media':[]};req=urllib.request.Request(base+'/api/project',data=json.dumps(data).encode(),headers={'Content-Type':'application/json'});assert json.load(opener.open(req))['ok'];assert json.load(opener.open(base+'/api/project/test-project'))['name']=='Save test'
  req=urllib.request.Request(base+'/api/project',data=b'{}',headers={'Origin':'https://example.com'})
  try:opener.open(req);raise AssertionError('foreign origin accepted')
  except urllib.error.HTTPError as e:assert e.code==403
  req=urllib.request.Request(base+'/app.js',headers={'Range':'bytes=0-9'});r=opener.open(req);assert r.status==206 and len(r.read())==10
  module=opener.open(base+'/vendor/mediabunny.mjs');assert 'javascript' in module.headers.get('Content-Type','')
  fixture=repo/'dist/device-test.mp4';req=urllib.request.Request(base+'/api/upload',data=fixture.read_bytes(),headers={'X-Filename':'sample.mp4'});m=json.load(opener.open(req));assert m['width']==160
  assert len(json.load(opener.open(base+'/api/media')))==1
  req=urllib.request.Request(base+'/api/prepare',data=json.dumps({'media':m['id']}).encode());j=json.load(opener.open(req))['job']
  for _ in range(100):
   r=json.load(opener.open(base+'/api/job/'+j))
   if r['status'] in ('done','error'):break
   time.sleep(.1)
  assert r['status']=='done',r
  diagnostic=json.load(opener.open(base+'/api/diagnostic/'+j));assert diagnostic['job']==j and any(e.get('validation')=='passed' for e in diagnostic['events'])
  try:urllib.request.urlopen(base+'/api/diagnostic/'+j);raise AssertionError('unauthenticated diagnostic accepted')
  except urllib.error.HTTPError as e:assert e.code==401
  export_dir=pathlib.Path(td)/'data'/'exports';movie=export_dir/'internal-random-id.mp4';movie.write_bytes(fixture.read_bytes())
  for ext in ['mp4','mov']:
   output=export_dir/('internal-random-id.'+ext);output.write_bytes(fixture.read_bytes())
   filename='東京プロモーション.'+ext;query=urllib.parse.urlencode({'filename':filename})
   response=opener.open(base+'/exports/'+output.name+'?'+query);assert response.read()==fixture.read_bytes()
   header=response.headers['Content-Disposition'];assert header.startswith('inline;') and urllib.parse.quote(filename,safe='') in header
   req=urllib.request.Request(base+'/exports/'+output.name+'?'+query+'&download=1',headers={'Range':'bytes=0-9'});response=opener.open(req);assert response.status==206 and len(response.read())==10 and response.headers['Content-Disposition'].startswith('attachment;')
  response=opener.open(base+'/exports/internal-random-id.mp4?'+urllib.parse.urlencode({'filename':'bad\r\nX-Injection: yes.mp4','download':'1'}));assert response.headers.get('X-Injection')is None and '%0D' not in response.headers['Content-Disposition'] and '%0A' not in response.headers['Content-Disposition']
  assert opener.open(base+'/exports/internal-random-id.mp4').headers.get('Content-Disposition')is None
  project={'version':1,'name':'東京プロモーション','media':[m],'clips':[{'id':'c','media':m['id'],'in':0,'out':m['duration'],'speed':1,'endSpeed':1,'curve':'constant','start':0,'layer':0,'audio':{'volume':1},'color':{},'stabilization':'OFF'}],'effects':[],'texts':[],'export':{'fps':30,'resolution':'Source','quality':'Preview'}}
  for custom in ['', '別の保存名.mp4']:
   project['export']['fileName']=custom
   req=urllib.request.Request(base+'/api/render',data=json.dumps({'project':project}).encode());job=json.load(opener.open(req))['job']
   for _ in range(200):
    state=json.load(opener.open(base+'/api/job/'+job))
    if state['status']in ('done','error'):break
    time.sleep(.1)
   assert state['status']=='done',state
   result=state['result'];wanted=custom or '東京プロモーション.mp4'
   assert urllib.parse.parse_qs(urllib.parse.urlparse(result['url']).query)['filename']==[wanted]
   response=opener.open(base+result['url']+'&download=1');assert response.headers['Content-Disposition'].startswith('attachment;') and urllib.parse.quote(wanted,safe='')in response.headers['Content-Disposition'];assert len(response.read())>100
  print('Native render → project/custom UTF-8 filename → download response end-to-end PASS')
  print('Unicode movie names: inline preview, attachment download, MOV/MP4, range and header injection protection PASS')
  print('Auth, origin guard, range serving, project roundtrip, media streaming, async proxy job, protected diagnostics: PASS')
 finally:proc.terminate();proc.wait(timeout=10)
