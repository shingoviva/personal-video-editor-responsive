"""Synthetic-only Chrome AAC regression: prepare fixtures / verify independent FFmpeg PCM.
Usage: python3 scripts/check-browser-av-sync.py prepare|verify SERVED_DIR RESULT_DIR
Run check-browser-av-sync.mjs between prepare and verify. No production/user media.
"""
import argparse,array,base64,json,math,os,pathlib,subprocess,sys
repo=pathlib.Path(__file__).resolve().parent.parent
p=argparse.ArgumentParser();p.add_argument('mode',choices=['prepare','verify']);p.add_argument('served');p.add_argument('output');p.add_argument('--reference',action='store_true');args=p.parse_args()
served=pathlib.Path(args.served).resolve();out=pathlib.Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True);os.environ['PVE_DATA']=str(out/'data');sys.path[:0]=[str(repo/'engine'),str(repo/'tests')];import core
from av_sync_helpers import fixture,decode,lag,probe,command
if args.mode=='prepare':
 served.mkdir(parents=True,exist_ok=True);cases=[]
 for rate in [44100,48000]:
  for duration,marks in [(2,[.01,.5,1,1.5,1.99]),(.04,[.01,.02,.03]),(60,[.01,.5,30,59.5,59.99])]:
   source=fixture(core,served,rate,'aac',duration=duration,markers=marks)
   if args.reference:
    decoded=source.with_name(source.stem+'-decoded.wav');command(core,['-i',source,'-map','0:a','-c:a','pcm_f32le',decoded])
    if duration==2:command(core,['-i',source,'-i',decoded,'-map','0:v','-map','1:a','-c:v','copy','-c:a','pcm_f32le',source.with_name(source.stem+'-decoded.mov')])
   if duration==2:command(core,['-i',source,'-i',source.with_suffix('.wav'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','pcm_s16le',source.with_suffix('.mov')])
   for codec in ['aac','pcm']:
    media=source.name if codec=='aac' else source.with_suffix('.wav').name
    modes=['base','trim','multi','envelope','linked','split'] if duration==2 else ['short' if duration<1 else 'long']
    for mode in modes:
     rates=['24','29.97','30','60'] if mode=='base' else ['30']
     for fps in rates:
      cases.append(dict(id=f'{rate}-{codec}-{duration}-{mode}-{fps}',rate=rate,codec=codec,duration=duration,markers=marks,source=source.name,media=media,mode=mode,fps=fps))
 # Lowest supported bitrate checks the calibration confidence, not a different tolerance.
 for bitrate in [96,128,256]:
  cases.append(dict(cases[0],id='bitrate-'+str(bitrate),bitrate=bitrate))
 (served/'manifest.json').write_text(json.dumps(cases));print('prepared',len(cases),'Chrome cases')
else:
 rows=[];renders=json.load(open(out/'renders.json'));assert renders.get('variant','fixed')=='fixed','Frozen investigation is not a passing regression oracle'
 for row in renders['rows']:
  case=row['case'];path=out/(case['id']+'.mp4');pcm=decode(core,path);events=json.load(open(out/(case['id']+'-inputs.json')))
  expected=array.array('f',[0])*row['result']['audioTiming']['inputFrames']
  for event in events:
   if event['timestamp']==0:continue # disposable calibration, never user PCM
   a=array.array('f');a.frombytes(base64.b64decode(event['plane']));at=round(event['timestamp']*.048)-row['result']['audioTiming']['prerollSamples'];expected[at:at+len(a)]=a
  times=[(t,t) for t in case['markers']]
  if case['mode']=='trim':times=[(t,t-.123+.211) for t in case['markers'] if .123<t<1.877]
  elif case['mode']=='split':times=[(t,t) for t in case['markers']]
  checks=[lag(expected,pcm,dest,dest,radius=256) for src,dest in times]
  # Source decode to final compare on unmodified gain paths, separate from mixer reference.
  source=decode(core,served/case['media']);source_checks=[lag(source,pcm,src,dest,radius=256) for src,dest in times]
  info=probe(core,path);audio=next(x for x in info['streams'] if x['codec_type']=='audio');video=next(x for x in info['streams'] if x['codec_type']=='video')
  assert abs(float(audio['start_time']))<1/48000,(case['id'],audio)
  assert abs(float(audio['duration'])-row['result']['duration'])<=1/48000,(case['id'],audio)
  encoder_ok=all(abs(x['lagSeconds'])<=.002 and x['correlation']>.8 for x in checks)
  source_ok=all(abs(x['lagSeconds'])<=.002 and x['correlation']>.8 for x in source_checks)
  assert len(pcm)>=len(expected),(case['id'],'missing tail',len(pcm),len(expected))
  # Quality and full tail against the exact PCM handed to AudioEncoder, not thresholds.
  channel=array.array('f');channel.frombytes(subprocess.check_output(core.BASE+['-v','error','-i',str(path),'-map','0:a:0','-af','pan=mono|c0=c0','-ar','48000','-f','f32le','pipe:1']))
  signal=sum(x*x for x in expected);noise=sum((a-b)**2 for a,b in zip(expected,channel));snr=10*math.log10(signal/noise) if noise else 999
  video_markers=[]
  if case['mode']=='base':
   fps=30000/1001 if case['fps']=='29.97' else float(case['fps']);luma=subprocess.check_output(core.BASE+['-v','error','-i',str(path),'-map','0:v:0','-vf','scale=1:1','-pix_fmt','gray','-f','rawvideo','pipe:1'])
   assert len(luma)==math.ceil(case['duration']*fps),(case['id'],'video count',len(luma))
   for marker in [.5,1,1.5]:
    frame=math.ceil(marker*fps-1e-8);assert luma[frame]>128 and luma[frame-1]<128,(case['id'],'flash ownership',frame)
    audio_marker=next(x for x in checks if x['sourceTime']==marker);error=frame/fps-marker-audio_marker['lagSeconds'];assert abs(error)<.002,(case['id'],'AV',error)
    video_markers.append(dict(sourceTime=marker,firstFlashFrame=frame,videoTime=frame/fps,avDifferenceSeconds=error))
  drift=max(x['lagSamples'] for x in checks)-min(x['lagSamples'] for x in checks)
  rows.append(dict(encoderPathPass=encoder_ok,sourceDecodePass=source_ok,case=case,primingSamples=row['result']['audioTiming']['primingSamples'],markers=checks,sourceMarkers=source_checks,videoMarkers=video_markers,driftSamples=drift,snrDB=snr,inputSamples=len(expected),decodedSamples=len(pcm),audio=audio,video=video,firstPackets=info['packets'][:3],elapsedSeconds=row['elapsedSeconds']))
 encoder_ok=all(r['encoderPathPass'] for r in rows);source_ok=all(r['sourceDecodePass'] for r in rows)
 report=dict(result='PASS' if encoder_ok and source_ok else 'FAIL',encoderPathResult='PASS' if encoder_ok else 'FAIL',sourceDecodeResult='PASS' if source_ok else 'FAIL',rows=rows,maxEncoderLagSamples=max(abs(m['lagSamples']) for r in rows for m in r['markers']),maxSourceLagSamples=max(abs(m['lagSamples']) for r in rows for m in r['sourceMarkers']),maxDriftSamples=max(r['driftSamples'] for r in rows),minimumSNRdB=min(r['snrDB'] for r in rows));(out/'verified.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='rows'},indent=2));print('cases',len(rows));sys.exit(0 if encoder_ok and source_ok else 1)
