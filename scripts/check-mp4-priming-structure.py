"""Read-only QA of real exported files. Never writes media or changes timestamps.
Usage: python3 scripts/check-mp4-priming-structure.py RESULT_ROOT
Expected chrome/ and webkit/ renders from check-browser-av-sync.mjs.
"""
import pathlib,json,importlib.util,sys,subprocess,hashlib
repo=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('boxes',repo/'scripts/mp4-structure.py');q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
root=pathlib.Path(sys.argv[1]);rows=[];inputs=[]
def signatures(path):
 data=path.read_bytes();packets=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_packets','-show_entries','packet=stream_index,pts,dts,duration,pos,size','-of','json',str(path)]))['packets'];result={}
 for index in [0,1]:
  p=[x for x in packets if x['stream_index']==index];result[str(index)]={'payload':hashlib.sha256(b''.join(data[int(x['pos']):int(x['pos'])+int(x['size'])] for x in p)).hexdigest(),'clock':[(x.get('pts'),x.get('dts'),x.get('duration')) for x in p]}
 return result
for engine,baseline in [('chrome','matrix'),('webkit','webkit-matrix')]:
 report=json.load(open(root/engine/'renders.json'))
 for r in report['rows']:
  c=r['case'];file=root/engine/(c['id']+'.mp4');t=q.structure(file.read_bytes())[-1];count=t['packets'];g=t['groups'];assert len(g)==2,(engine,c['id'],g)
  assert g[0]['hex']=='0000001a7367706401000000726f6c6c0000000200000001ffff'
  assert g[1]['hex']=='0000001c7362677000000000726f6c6c00000001'+count.to_bytes(4,'big').hex()+'00000001'
  assert t['edits'][0]['media_time']==r['result']['audioTiming']['prerollSamples']+r['result']['audioTiming']['primingSamples']
  assert count==sum(n for n,d in t['stts'])
  row=dict(engine=engine,id=c['id'],packets=count,groups=g,edits=t['edits'],timescale=t['timescale'])
  rows.append(row);marks=c['markers'];marks=[x-.123+.211 for x in marks if .123<=x<=1.877] if c['mode']=='trim' else marks
  inputs.append(dict(name=engine+'-'+c['id'],path=str(file),markers=marks,modes=['current']))
(root/'structure.json').write_text(json.dumps(rows,indent=2));(root/'inputs.json').write_text(json.dumps(inputs,indent=2));print('structure PASS',len(rows),'exports')
if '--verify-decoders' in sys.argv:
 comparisons=json.load(open(root/'decoders/comparison.json'));expected={x['name']+'--current' for x in inputs}
 assert len(comparisons)==3*len(inputs)
 for engine in ['ffmpeg','chrome','webkit']:
  subset=[r for r in comparisons if r['engine']==engine];assert len(subset)==len(inputs) and {r['name'] for r in subset}==expected
 assert all(r.get('allMarkersWithin2ms') for r in comparisons),[r for r in comparisons if not r.get('allMarkersWithin2ms')]
 summary=dict(result='PASS',files=len(inputs),comparisons=len(comparisons),markers=sum(len(r['markers']) for r in comparisons),maxLagSamples=max(r['maxLagSamples'] for r in comparisons),maxDriftSamples=max(r['driftSamples'] for r in comparisons),minimumCorrelation=min(r['minimumCorrelation'] for r in comparisons))
 (root/'independent-verified.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary))
