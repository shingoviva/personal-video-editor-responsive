"""Formal export QA only: unchanged file copies / independent PCM comparison.
Usage: prepare|verify RESULT_ROOT SERVED_DIR. No MP4 rewriting or repair code.
"""
import pathlib,sys,json,shutil,subprocess,array
root=pathlib.Path(sys.argv[2]).resolve();served=pathlib.Path(sys.argv[3]).resolve();sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'tests'));from av_sync_helpers import lag
if sys.argv[1]=='prepare':
 served.mkdir(parents=True,exist_ok=True);rows=[]
 for c in json.load(open(root/'inputs.json')):
  name=c['name']+'--current';target=served/(name+'.mp4');assert target.resolve()!=pathlib.Path(c['path']).resolve();shutil.copyfile(c['path'],target);rows.append(dict(name=name,url=target.name,markers=c['markers']))
 (served/'manifest.json').write_text(json.dumps(rows,indent=2));print('Copied',len(rows),'unchanged formal outputs')
else:
 out=root/'decoders';entries=json.load(open(out/'decoded.json'));cases=json.load(open(served/'manifest.json'));rows=[]
 for case in cases:
  raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(served/case['url']),'-map','0:a','-af','pan=mono|c0=c0','-ar','48000','-f','f32le','pipe:1']);ref=array.array('f');ref.frombytes(raw)
  for engine in ['ffmpeg','chrome','webkit']:
   actual=array.array('f');error=None
   if engine=='ffmpeg':actual.frombytes(raw)
   else:
    entry=next(e for e in entries if e['engine']==engine and e['name']==case['name']);error=entry.get('error')
    if not error:actual.frombytes((out/(engine+'-'+case['name']+'.f32')).read_bytes())
   checks=[] if error else [lag(ref,actual,t,t,radius=4096) for t in case['markers']];good=[x for x in checks if x['correlation']>.99]
   rows.append(dict(engine=engine,name=case['name'],error=error,markers=checks,allMarkersWithin2ms=not error and bool(checks) and len(good)==len(checks) and all(abs(x['lagSeconds'])<=.002 for x in checks),maxLagSamples=max((abs(x['lagSamples']) for x in good),default=None),driftSamples=max((x['lagSamples'] for x in good),default=0)-min((x['lagSamples'] for x in good),default=0),minimumCorrelation=min((x['correlation'] for x in checks),default=0)))
 (out/'comparison.json').write_text(json.dumps(rows,indent=2));assert len(rows)==len(cases)*3 and all(r['allMarkersWithin2ms'] for r in rows);print('Independent decoder comparisons',len(rows),'PASS')
