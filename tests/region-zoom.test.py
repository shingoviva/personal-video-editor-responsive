import os,sys,pathlib,tempfile,subprocess,copy
with tempfile.TemporaryDirectory(prefix='pve-region-zoom-') as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'engine'));import core
 path=pathlib.Path(tmp)/'quadrants.mp4'
 subprocess.run(core.BASE+['-f','lavfi','-i','color=c=red:s=160x90:r=30:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-vf','drawbox=x=80:y=0:w=80:h=90:color=blue:t=fill','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',path],check=True,capture_output=True)
 m=core.inspect(path,'quadrants',path.name);clip={'id':'c','media':m['id'],'in':0,'out':3,'start':0,'layer':0,'speed':1,'endSpeed':1,'curve':'constant','audio':{'volume':1},'color':{},'stabilization':'OFF'}
 p={'version':1,'media':[m],'clips':[clip],'texts':[],'effects':[{'type':'region-zoom','start':.5,'duration':2.5,'zoomSize':.4,'zoomX':.25,'zoomY':.5,'zoomIn':.2,'zoomOut':.2,'returnAt':1.5,'zoomReturn':True}],'aspect':'Original','bgm':{},'export':{'fps':'30','resolution':'Source','quality':'High'}}
 def pixel(path,t,x):return list(subprocess.check_output(core.BASE+['-v','error','-ss',str(t),'-i',path,'-frames:v','1','-vf',f'crop=2:2:{x}:44,scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 for back in [True,False]:
  p['effects'][0]['zoomReturn']=back;r=core.render({'id':'zoom'+str(back),'cancel':False},p);out=core.ROOT/'exports'/r['file'];core.validate_output(out,3,True)
  before=pixel(out,.1,120);zoomed=pixel(out,1,120);after=pixel(out,2.5,120)
  assert before[2]>180 and zoomed[0]>180,(before,zoomed)
  assert (after[2]>180 if back else after[0]>180),after
  audio=subprocess.check_output(core.BASE+['-v','error','-i',out,'-map','0:a','-f','f32le','pipe:1']);assert len(audio)>48000*3*4*.95
  print('Region zoom return='+str(back)+': full decode, target pixels, duration and audio PASS')
 # Both FFmpeg drawtext and browser-rasterized captions must remain transparent.
 import base64,struct,zlib
 def png():
  def chunk(k,d):return struct.pack('!I',len(d))+k+d+struct.pack('!I',zlib.crc32(k+d)&0xffffffff)
  return 'data:image/png;base64,'+base64.b64encode(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',12,12,8,6,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+bytes((255,255,255,255))*12)*12))+chunk(b'IEND',b'')).decode()
 for raster in [False,True]:
  if not raster and not core.capabilities().get('drawtext'):
   print('drawtext unavailable: raster captions tested instead');continue
  p['texts']=[{'id':'title','text':'WWW','start':0,'end':3,'x':.75,'y':.5,'size':22,'font':'Sans','color':'#ffffff','opacity':1,'fade':0,'outline':0,'shadow':0}]
  if raster:p['texts'][0]['raster']={'data':png(),'width':12,'height':12,'referenceHeight':90,'anchorX':6,'anchorY':6}
  for captions in [True,False]:
   p['effects'][0]['zoomTexts']=captions;p['effects'][0]['zoomReturn']=False
   r=core.render({'id':'caption'+str(raster)+str(captions),'cancel':False},p);out=core.ROOT/'exports'/r['file'];core.validate_output(out,3,True)
   sample=subprocess.check_output(core.BASE+['-v','error','-ss','1','-i',out,'-frames:v','1','-vf','crop=30:30:105:30','-pix_fmt','rgb24','-f','rawvideo','pipe:1'])
   white=sum(min(sample[i:i+3])>170 for i in range(0,len(sample),3))
   assert (white==0 if captions else white>20),(raster,captions,white)
   assert pixel(out,1,10)[0]>180 # Transparent caption plane must not cover the video.
   print('Caption raster='+str(raster)+' zoom='+str(captions)+': glyph position/size, transparent video and full decode PASS')
 mixed=copy.deepcopy(p['effects'][0]);mixed['zoomTexts']=True
 p['effects']=[{**mixed,'start':0,'duration':.2,'zoomIn':0,'zoomReturn':False,'zoomTexts':False},mixed]
 r=core.render({'id':'mixed-caption','cancel':False},p);out=core.ROOT/'exports'/r['file'];core.validate_output(out,3,True)
 assert pixel(out,1,10)[0]>180
 print('Mixed caption-follow settings: transparent zoomed caption plane and full decode PASS')
