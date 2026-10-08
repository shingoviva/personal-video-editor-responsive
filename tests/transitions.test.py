"""Canva-style clip transitions preserve timeline duration and source audio."""
import os,sys,pathlib,tempfile,subprocess,array
with tempfile.TemporaryDirectory(prefix='pve-transition-') as tmp:
 os.environ['PVE_DATA']=tmp;root=pathlib.Path(__file__).resolve().parent.parent;sys.path.insert(0,str(root/'engine'));import core
 media=[]
 for name,color,freq in [('first','red',440),('second','blue',660)]:
  path=pathlib.Path(tmp)/(name+'.mp4')
  if name=='first':args=['-f','lavfi','-i',f'color=c={color}:s=160x90:r=30:d=1.4','-f','lavfi','-i','color=white:s=20x15:r=30:d=1.4','-f','lavfi','-i',f'sine=frequency={freq}:sample_rate=48000:duration=1.4','-filter_complex',"[0:v][1:v]overlay=x='mod(t*80,140)':y=4[v]",'-map','[v]','-map','2:a']
  else:args=['-f','lavfi','-i',f'color=c={color}:s=160x90:r=30:d=1.4','-f','lavfi','-i',f'sine=frequency={freq}:sample_rate=48000:duration=1.4']
  subprocess.run(core.BASE+args+['-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',path],capture_output=True,check=True);media.append(core.inspect(path,name,path.name))
 def clip(m,start):return{'id':f"{m['id']}-{start}",'media':m['id'],'in':0,'out':.8,'start':start,'layer':0,'speed':1,'endSpeed':1,'curve':'constant','stabilization':'OFF','audio':{'volume':1,'mute':False},'color':{}}
 clips=[clip(media[i%2],i*.8) for i in range(5)]
 for value,kind,direction in zip(clips[1:],('dissolve','slide','wipe','circle'),('left','left','right','left')):value['transition']={'type':kind,'duration':.6,'direction':direction}
 project={'version':1,'media':media,'clips':clips,'audioClips':[],'videoTracks':[{'hidden':False,'volume':1} for _ in range(3)],'audioTracks':[{} for _ in range(4)],'texts':[],'effects':[],'bgm':{},'aspect':'Original','export':{'resolution':'Source','fps':30,'quality':'High','codec':'H.264'}}
 result=core.render({'id':'transition','cancel':False},project);out=core.ROOT/'exports'/result['file'];core.validate_output(out,4,True)
 def pixel(t,x=.5,y=.5):return list(subprocess.check_output(core.BASE+['-v','error','-ss',str(t),'-i',out,'-frames:v','1','-vf',f'crop=2:2:{round(159*x)}:{round(89*y)},scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 before,middle,after=pixel(.79),pixel(1.1),pixel(1.5)
 assert before[0]>150 and before[2]<80,before
 assert middle[0]>50 and middle[2]>50,middle
 assert after[2]>150 and after[0]<80,after
 # The outgoing red source has a moving white marker after its edit point.
 # Green at x=90 during the dissolve proves that the tail is decoded instead
 # of holding the frame captured at 0.8 seconds (where the marker ends at x=84).
 moving_tail=pixel(.9,90/159,.1);assert moving_tail[1]>100,moving_tail
 slide_left,slide_right=pixel(1.9,.2),pixel(1.9,.8);assert slide_left[2]>120 and slide_right[0]>120,(slide_left,slide_right)
 wipe_left,wipe_right=pixel(2.7,.2),pixel(2.7,.8);assert wipe_left[0]>120 and wipe_right[2]>120,(wipe_left,wipe_right)
 circle_center,circle_corner=pixel(3.5,.5,.5),pixel(3.5,.05,.05);assert circle_center[0]>120 and circle_corner[2]>120,(circle_center,circle_corner)
 raw=subprocess.check_output(core.BASE+['-v','error','-i',out,'-vn','-ac','1','-ar','48000','-f','f32le','pipe:1']);samples=array.array('f');samples.frombytes(raw)
 for boundary in (.8,1.6,2.4,3.2):
  center=round(boundary*48000);window=samples[center-1600:center+1600];assert max(abs(v) for v in window)>.01
 assert 'overlay=' in core.transition_video_graph({'type':'slide','direction':'left'},.6,.8,160,90,30,'yuv420p')
 assert 'gte(Y,H*' in core.transition_video_graph({'type':'wipe','direction':'down'},.6,.8,160,90,30,'yuv420p')
 assert 'hypot(X-W/2' in core.transition_video_graph({'type':'circle','direction':'right'},.6,.8,160,90,30,'yuv420p')
 print('Native transitions: four rendered effects, direction geometry, exact duration and continuous audio PASS')
