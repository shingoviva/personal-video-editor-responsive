"""Four independently editable audio tracks, streamed through bounded disk intermediates."""
import copy
def validate_audio(project):
 import core
 clips=copy.deepcopy(project.get('audioClips',[]))
 if len(clips)>200:raise ValueError('音声クリップは200個までです。')
 for c in clips:
  m=core.MEDIA.get(c.get('media'))
  if not m or not m.get('audio'):raise ValueError('音声素材を再リンクしてください。')
  c['start']=core.number(c.get('start'),0,0,86400);c['layer']=int(core.number(c.get('layer'),0,0,3))
  c['in']=core.number(c.get('in'),0,0,86400 if c.get('loop') else m['duration'])
  c['out']=core.number(c.get('out'),m['duration'],0,86400 if c.get('loop') else m['duration'])
  if c['out']-c['in']<.001:raise ValueError('音声のIN / OUTが無効です。')
 return clips
def extent(clips):
 import core
 return max([0]+[c['start']+core.timing(c)[0][-1][1]+core.number(c.get('hold'),0,0,10) for c in clips])
def render_tracks(job,project,clips,work,total,track_key='audioTracks',layers=4,prefix='audio'):
 import core
 result=[];tracks=project.get(track_key,[]);solo=any(t.get('solo') for t in tracks) if track_key=='audioTracks' else False
 for layer in range(layers):
  track=tracks[layer] if layer<len(tracks) else {};gain=core.number(track.get('volume'),1,0,2)
  if track.get('mute') or solo and not track.get('solo') or not gain:continue
  source=[{**c,'layer':0} for c in clips if c['layer']==layer]
  if not source:continue
  source.append({'gap':.00001,'start':max(0,total-.00001)})
  windows=core.visible_clips(source);files=[]
  folder=work/f'{prefix}-track-{layer}';folder.mkdir()
  for n,c in enumerate(windows):
   core.check(job);offset,d=c['_window'];part=folder/f'window-{n}.wav';files.append(part);audio=c.get('audio',{})
   if c.get('gap') or audio.get('mute') or not core.number(audio.get('volume'),1,0,2):
    core.run(job,['-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',d,'-c:a','pcm_f32le',part],d,.9,0);continue
   m=core.MEDIA[c['media']];nodes,pieces=core.timing(c);duration=nodes[-1][1];hold=core.number(c.get('hold'),0,0,10);segments=[]
   for k,(a,b,s,length) in enumerate(pieces):
    segment=folder/f'piece-{n}-{k}.wav';segments.append(segment);seek=c['in']+a
    args=['-stream_loop','-1'] if c.get('loop') else []
    if c.get('loop'):seek%=m['duration']
    args+=['-ss',seek,'-i',m['path'],'-vn','-af',f'atrim=duration={b-a},asetpts=PTS-STARTPTS,apad=pad_dur=1,{core.atempo(s)},apad,atrim=duration={length},asetpts=N/SR/TB','-ar','48000','-ac','2','-c:a','pcm_f32le',segment]
    job['operation']=f'{"V" if track_key=="videoTracks" else "A"}{layer+1} の音声を処理中';core.run(job,args,length,.9,0)
   listing=folder/'pieces.txt';listing.write_text(''.join(f"file '{p.name}'\n" for p in segments));joined=folder/'remapped.wav'
   core.run(job,['-f','concat','-safe','0','-i',listing,'-c','copy',joined],duration,.9,0)
   # Sub-frame ramps remove waveform discontinuities at hard cuts. Explicit
   # longer fades continue to take precedence.
   edge=min(.008,(duration+hold)/2);fi=max(edge,core.number(audio.get('fadeIn'),0,0,(duration+hold)/2));fo=max(edge,core.number(audio.get('fadeOut'),0,0,(duration+hold)/2));volume=gain*core.number(audio.get('volume'),1,0,2)
   af=f'volume={volume},'
   if audio.get('gainKeyframes'):af+=f"volume='{core.keyframe_expression(audio['gainKeyframes'],duration+hold,2,'t')}':eval=frame,"
   if audio.get('gainEnvelope'):af+=f"asetnsamples=n=64:p=0,volume='{core.gain_envelope_expression(audio['gainEnvelope'],duration+hold,'t')}':eval=frame,"
   af+=f'apad,atrim=duration={duration+hold}'
   if audio.get('delayEnabled'):
    delay_ms=round(core.number(audio.get('delayTime'),.28,.02,2)*1000);decay=core.number(audio.get('delayFeedback'),.35,0,.85)*core.number(audio.get('delayMix'),.25,0,.8)
    if decay:af+=f',aecho=1:1:{delay_ms}:{decay}'
   af+=f',atrim=duration={duration+hold}'
   if fi:af+=f',afade=t=in:d={fi}'
   if fo:af+=f',afade=t=out:st={duration+hold-fo}:d={fo}'
   af+=f',atrim=start={offset}:duration={d},asetpts=N/SR/TB,apad,atrim=duration={d}'
   core.run(job,['-i',joined,'-af',af,'-c:a','pcm_f32le',part],d,.9,0)
   for segment in segments:segment.unlink()
   joined.unlink()
  listing=folder/'track.txt';listing.write_text(''.join(f"file '{p.name}'\n" for p in files));out=work/f'{prefix}-track-{layer}.wav'
  core.run(job,['-f','concat','-safe','0','-i',listing,'-t',total,'-c','copy',out],total,.9,0);result.append(out)
 return result
