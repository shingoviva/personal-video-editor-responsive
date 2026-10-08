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
  print('Auth, origin guard, range serving, project roundtrip, media streaming, async proxy job, protected diagnostics: PASS')
 finally:proc.terminate();proc.wait(timeout=10)
