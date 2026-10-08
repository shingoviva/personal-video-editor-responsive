#!/usr/bin/env python3
"""Loopback-only application server. No network upload or shell-based media commands."""
import http.server, json, os, pathlib, re, secrets, socket, sys, threading, urllib.parse, uuid, webbrowser
from http.cookies import SimpleCookie
import core
APP=pathlib.Path(__file__).resolve().parent.parent/'dist'
TOKEN=secrets.token_urlsafe(32);PORT=int(os.environ.get('PVE_PORT','8765'))
class QuietServer(http.server.ThreadingHTTPServer):
 def handle_error(self,request,client_address):
  if isinstance(sys.exc_info()[1],(BrokenPipeError,ConnectionResetError)):return
  super().handle_error(request,client_address)
class Handler(http.server.BaseHTTPRequestHandler):
 protocol_version='HTTP/1.1'
 def log_message(self,format,*args):pass
 def auth(self):
  c=SimpleCookie();c.load(self.headers.get('Cookie',''));return c.get('pve_session') and secrets.compare_digest(c['pve_session'].value,TOKEN)
 def allowed(self):
  host=self.headers.get('Host','');origin=self.headers.get('Origin')
  return host in (f'127.0.0.1:{PORT}',f'localhost:{PORT}') and (not origin or origin in (f'http://127.0.0.1:{PORT}',f'http://localhost:{PORT}'))
 def send_json(self,data,status=200):
  b=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(b)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(b)
 def do_GET(self):
  try:
   if not self.allowed():return self.send_json({'error':'Origin rejected'},403)
   u=urllib.parse.urlparse(self.path);p=u.path;query=urllib.parse.parse_qs(u.query)
   if p=='/' and secrets.compare_digest(query.get('token',[''])[0],TOKEN):
    self.send_response(303);self.send_header('Set-Cookie',f'pve_session={TOKEN}; HttpOnly; SameSite=Strict; Path=/');self.send_header('Location','/');self.send_header('Content-Length','0');self.end_headers();return
   if not self.auth():return self.send_json({'error':'Launch.command から起動してください。'},401)
   if p=='/api/health':return self.send_json(core.capabilities())
   if p=='/api/media':return self.send_json([core.public_media(m) for m in core.MEDIA.values()])
   if p.startswith('/api/diagnostic/'):
    id=p.rsplit('/',1)[1]
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}',id):raise ValueError('Invalid job id')
    f=core.ROOT/'logs'/f'{id}.json'
    if not f.is_file():return self.send_json({'error':'診断記録がありません。'},404)
    return self.send_json(json.loads(f.read_text()))
   if p.startswith('/api/job/'):
    j=core.JOBS.get(p.rsplit('/',1)[1]);return self.send_json({k:v for k,v in j.items() if not k.startswith('_')} if j else {'error':'Job not found'},200 if j else 404)
   if p=='/api/projects':return self.send_json([{'id':f.stem,'name':json.loads(f.read_text()).get('name',f.stem)} for f in (core.ROOT/'projects').glob('*.json')])
   if p.startswith('/api/project/'):
    id=p.rsplit('/',1)[1]
    if not re.fullmatch(r'[a-zA-Z0-9-]{1,80}',id):raise ValueError('Invalid project id')
    return self.send_json(json.loads((core.ROOT/'projects'/f'{id}.json').read_text()))
   if p.startswith('/media/'):
    m=core.MEDIA[p.split('/')[2]];return self.serve(pathlib.Path(m['path']))
   for prefix,folder in [('/cache/',core.ROOT/'cache'),('/exports/',core.ROOT/'exports')]:
    if p.startswith(prefix):
     f=(folder/urllib.parse.unquote(p[len(prefix):])).resolve()
     if f.parent!=folder.resolve():return self.send_json({'error':'Forbidden'},403)
     return self.serve(f)
   f=(APP/('index.html' if p=='/' else urllib.parse.unquote(p.lstrip('/')))).resolve()
   if not f.is_relative_to(APP):return self.send_json({'error':'Forbidden'},403)
   self.serve(f)
  except (BrokenPipeError,ConnectionResetError):pass
  except Exception as e:self.send_json({'error':str(e)},400)
 def serve(self,p):
  if not p.is_file():return self.send_json({'error':'Not found'},404)
  import mimetypes
  size=p.stat().st_size;start=0;end=size-1;partial=False;r=self.headers.get('Range','');match=re.fullmatch(r'bytes=(\d*)-(\d*)',r)
  if match:
   if match[1]:start=int(match[1]);end=min(size-1,int(match[2])) if match[2] else size-1
   elif match[2]:start=max(0,size-int(match[2]))
   if start>end or start>=size:
    self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.send_header('Content-Length','0');self.end_headers();return
   partial=True
  self.send_response(206 if partial else 200);self.send_header('Content-Type',mimetypes.guess_type(str(p))[0] or 'application/octet-stream');self.send_header('Accept-Ranges','bytes');self.send_header('Content-Length',str(end-start+1));self.send_header('X-Content-Type-Options','nosniff')
  if partial:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
  if p.suffix in ('.mp4','.mov','.m4a','.json'):self.send_header('Cache-Control','no-store')
  self.end_headers()
  with p.open('rb') as f:
   f.seek(start);left=end-start+1
   while left>0:
    b=f.read(min(left,256*1024))
    if not b:break
    self.wfile.write(b);left-=len(b)
 def do_POST(self):
  try:
   if not self.allowed() or not self.auth():return self.send_json({'error':'Unauthorized'},403)
   p=urllib.parse.urlparse(self.path).path;n=int(self.headers.get('Content-Length','0'))
   if p=='/api/upload':
    if n<=0:raise ValueError('空のファイルです。')
    id=uuid.uuid4().hex;name=urllib.parse.unquote(self.headers.get('X-Filename','media.mov'));name=pathlib.Path(name).name;suffix=pathlib.Path(name).suffix.lower()
    if suffix not in ('.mov','.mp4','.m4v','.webm','.mkv','.mxf','.mp3','.wav','.m4a','.aac','.aiff','.aif','.flac','.ogg','.opus','.jpg','.jpeg','.png','.webp'):raise ValueError('動画・音声、またはJPEG・PNG・WebPの静止画を選んでください。')
    target=core.ROOT/'media'/(id+suffix);part=target.with_suffix('.upload')
    try:
     with part.open('wb') as f:
      remaining=n
      while remaining:
       data=self.rfile.read(min(remaining,1024*1024))
       if not data:raise ValueError('読み込みが中断されました。')
       f.write(data);remaining-=len(data)
     part.replace(target);m=core.inspect(target,id,name)
    except Exception:
     part.unlink(missing_ok=True);target.unlink(missing_ok=True);raise
    return self.send_json(core.public_media(m))
   if n>4*1024*1024:raise ValueError('プロジェクトデータが大きすぎます。')
   d=json.loads(self.rfile.read(n) or b'{}')
   if p=='/api/prepare':return self.send_json({'job':core.submit('prepare',core.prepare,d['media'])})
   if p=='/api/analyze':return self.send_json({'job':core.submit('analyze',core.analyze,d['media'],d.get('intent','HIGH FASHION'))})
   if p=='/api/render':return self.send_json({'job':core.submit('render',core.render,d['project'],bool(d.get('preview')))})
   if p=='/api/cancel':core.cancel(d['job']);return self.send_json({'ok':True})
   if p=='/api/project':
    id=d.get('id','')
    if not re.fullmatch(r'[a-zA-Z0-9-]{1,80}',id):raise ValueError('Invalid project id')
    if d.get('version')!=1:raise ValueError('Invalid project')
    f=core.ROOT/'projects'/f'{id}.json';temp=f.with_name(f.stem+'-'+uuid.uuid4().hex+'.tmp');temp.write_text(json.dumps(d,ensure_ascii=False));temp.replace(f);return self.send_json({'ok':True})
   return self.send_json({'error':'Unknown route'},404)
  except (BrokenPipeError,ConnectionResetError):pass
  except Exception as e:self.send_json({'error':str(e)},400)
if __name__=='__main__':
 if not core.FFMPEG or not core.FFPROBE:sys.exit('FFmpeg が必要です。README のインストール手順を確認してください。')
 server=QuietServer(('127.0.0.1',PORT),Handler);server.daemon_threads=True
 url=f'http://127.0.0.1:{PORT}/?token={TOKEN}'
 print('PERSONAL VIDEO EDITOR — 起動しました。終了: Control+C',flush=True)
 if not os.environ.get('PVE_NO_BROWSER'):webbrowser.open(url)
 # Tests can opt into a token file outside the application; tokens are not logged.
 if os.environ.get('PVE_TEST_TOKEN_FILE'):pathlib.Path(os.environ['PVE_TEST_TOKEN_FILE']).write_text(TOKEN)
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:
  for id in list(core.JOBS):core.cancel(id)
  server.server_close()
