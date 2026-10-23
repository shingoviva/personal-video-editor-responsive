"""Local-only QA server. Runtime comes from this checkout; generated media stays outside Git.
Usage: python3 scripts/serve-release-qa.py QA_ROOT PORT
"""
import pathlib,http.server,functools,sys,urllib.parse
repo=pathlib.Path(__file__).resolve().parents[1];qa=pathlib.Path(sys.argv[1]).resolve()
class Handler(http.server.SimpleHTTPRequestHandler):
 def translate_path(self,path):
  part=urllib.parse.unquote(urllib.parse.urlparse(path).path);prefix=part.strip('/').split('/')[0]
  root=qa if prefix in ['qa-browser-sync','qa-audio','qa-priming'] else repo
  target=(root/part.lstrip('/')).resolve()
  if target!=root and root not in target.parents:return str(root/'__invalid__')
  return str(target)
http.server.ThreadingHTTPServer.request_queue_size=128
http.server.ThreadingHTTPServer(('127.0.0.1',int(sys.argv[2])),Handler).serve_forever()
