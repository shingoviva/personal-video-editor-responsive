import os,pathlib,sys,tempfile

with tempfile.TemporaryDirectory(prefix='pve-caps-') as tmp:
 os.environ['PVE_DATA']=tmp
 root=pathlib.Path(__file__).resolve().parent.parent
 sys.path.insert(0,str(root/'engine'))
 import core
 core.MEDIA['plain']={'id':'plain','width':1920,'height':1080,'hdr':False}
 core.MEDIA['hdr']={'id':'hdr','width':1920,'height':1080,'hdr':True}
 base={'clips':[{'media':'plain','stabilization':'OFF'}],'texts':[]}
 full={'ready':True,'stabilization':True,'hdr':True,'text':True,'drawtext':True,'textRaster':True,'prores':True,'motionInterpolation':True}
 assert core.preflight_render(base,caps=full)
 for project,caps,word in [
  ({**base,'clips':[{'media':'plain','stabilization':'NATURAL'}]},{**full,'stabilization':False},'vidstab'),
  ({**base,'clips':[{'media':'hdr','stabilization':'OFF'}]},{**full,'hdr':False},'zscale'),
  ({**base,'texts':[{'text':'TITLE'}]},{**full,'text':False,'drawtext':False,'textRaster':False},'文字描画'),
  ({**base,'clips':[{'media':'plain','stabilization':'OFF','interpolation':'motion'}]},{**full,'motionInterpolation':False},'minterpolate'),
  ({**base,'export':{'codec':'ProRes 422'}},{**full,'prores':False},'ProRes'),
 ]:
  try:core.preflight_render(project,caps=caps);raise AssertionError('missing capability accepted')
  except ValueError as e:assert word in str(e)
 detect,transform=core.stabilization_filters('HORIZON')
 assert 'accuracy=15' in detect and 'stepsize=2' in detect
 assert 'smoothing=42' in transform and 'optalgo=gauss' in transform and 'interpol=bicubic' in transform
 assert 'me=umh' in core.motion_interpolation_filter(60) and 'search_param=32' in core.motion_interpolation_filter(60)
 aggressive_detect,aggressive_transform=core.stabilization_filters('AGGRESSIVE')
 assert 'shakiness=10' in aggressive_detect and 'smoothing=72' in aggressive_transform and 'zoomspeed=0.025' in aggressive_transform
 max_slow=core.motion_interpolation_filter(60,True)
 assert 'mb_size=8' in max_slow and 'search_param=64' in max_slow
 print('Mac capability preflight: H.264, refined stabilization sampling, high-accuracy slow motion, HDR, text and ProRes requirements PASS')
