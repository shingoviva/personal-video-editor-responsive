"""Run the actual isolated candidate, writing all logs outside the checkout.
Usage: python3 scripts/validate-release-native.py OUTPUT_DIR
PVE_QA_MEDIA_DIR may point to read-only real QA sources; never packaged.
"""
import pathlib,subprocess,json,sys,os,time
repo=pathlib.Path(__file__).resolve().parents[1];out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True);env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1');commands=[['npm','test'],['npm','run','build'],['node','scripts/check-envelope-limit.mjs',str(out/'b3-fixtures')]]
for p in sorted((repo/'tests').glob('*.py')):
 if not(p.name.endswith('.test.py') or p.name in ['validate_pipeline.py','validate_formats.py','real-transitions.qa.py']):continue
 args=[]
 if p.name=='envelope-edit-native.test.py':args=['tests/fixtures/envelope-native.json',str(out/'b2-native.json')]
 if p.name=='envelope-limit-native.test.py':args=[str(out/'b3-fixtures/native-fixtures.json'),str(out/'b3-native.json')]
 if p.name=='timeline-timing-native.test.py':args=[str(out/'b4-native.json')]
 commands.append([sys.executable,str(p.relative_to(repo)),*args])
commands.append([sys.executable,'scripts/package-mac.py']);rows=[]
for index,command in enumerate(commands):
 name=(command[1] if command[0]!='npm' else 'npm-'+command[-1]).replace('/','-');start=time.monotonic()
 with(out/(name+'.log')).open('w') as log:result=subprocess.run(command,cwd=repo,env=env,stdout=log,stderr=subprocess.STDOUT)
 text=(out/(name+'.log')).read_text();rows.append(dict(command=command,exitCode=result.returncode,seconds=time.monotonic()-start,log=name+'.log',skips=[x for x in text.splitlines() if 'SKIP' in x]));(out/'results.json').write_text(json.dumps(rows,indent=2));print(name,result.returncode,round(rows[-1]['seconds'],1),flush=True)
print('All',len(rows),'commands; failures',sum(r['exitCode']!=0 for r in rows),flush=True);raise SystemExit(int(any(r['exitCode'] for r in rows)))
