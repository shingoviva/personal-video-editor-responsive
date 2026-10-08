import os,pathlib,subprocess,sys,tempfile

with tempfile.TemporaryDirectory(prefix='pve-spatial-') as tmp:
 os.environ['PVE_DATA']=tmp
 root=pathlib.Path(__file__).resolve().parent.parent
 sys.path.insert(0,str(root/'engine'))
 import core
 source=pathlib.Path(tmp)/'portrait.mp4';out=pathlib.Path(tmp)/'letterbox.png'
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=red:s=180x320:r=30','-t','0.2','-c:v','libx264',source],check=True)
 filters=','.join(core.spatial_filters(640,360,'0.3','0.5','0.5'))
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',source,'-vf',filters,'-frames:v','1',out],check=True)
 def pixel(x,y):
  return list(subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-i',out,'-vf',f'crop=1:1:{x}:{y}','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 assert max(pixel(10,180))<4 and pixel(320,180)[0]>240 and max(pixel(630,180))<4
 assert '.1' in core.scale_keyframe_expression({'scaleKeyframes':[{'time':0,'value':.1}]},1,[(0,0),(1,1)])
 unknown={'hdr':True,'transfer':'unknown','dolby':{'dv_profile':5}}
 assert any('tin=smpte2084' in value for value in core.tone(unknown))
 print('Spatial scale: portrait media can shrink below 1× with black padding; unknown HDR has SDR fallback PASS')
