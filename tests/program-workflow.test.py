import os,sys,pathlib,tempfile,subprocess,base64,struct,zlib,json

with tempfile.TemporaryDirectory(prefix='pve-program-') as tmp:
 os.environ['PVE_DATA']=tmp;root=pathlib.Path(__file__).resolve().parent.parent
 sys.path.insert(0,str(root/'engine'));import core
 source=pathlib.Path(tmp)/'source.mp4'
 subprocess.run(core.BASE+['-f','lavfi','-i','color=c=red:s=640x360:r=30:d=6','-f','lavfi','-i','sine=frequency=440:duration=6','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',source],check=True,capture_output=True)
 media=core.inspect(source,'program-source',source.name)
 def png(color,width=240,height=80,align='center'):
  rows=b''.join(b'\0'+bytes(color)*width for _ in range(height))
  def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
  payload=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
  anchor={'left':8,'right':width-8}.get(align,width/2)
  return {'data':'data:image/png;base64,'+base64.b64encode(payload).decode(),'width':width,'height':height,'anchorX':anchor,'anchorY':height/2}
 clip={'id':'c','media':media['id'],'in':0,'out':6,'start':0,'layer':0,'speed':1,'endSpeed':1,'curve':'constant','audio':{'volume':1},'color':{},'stabilization':'OFF'}
 texts=[
  {'id':'title','text':'TITLE','start':0,'end':2.2,'size':88,'x':.5,'y':.5,'align':'center','opacity':1,'raster':png((255,255,255,255))},
  {'id':'line-a','text':'LINE A','start':2.5,'end':3.3,'size':68,'x':.5,'y':.82,'align':'center','opacity':1,'raster':png((255,230,40,255))},
  {'id':'line-b','text':'LINE B','start':3.3,'end':4.2,'size':68,'x':.08,'y':.82,'align':'left','opacity':1,'raster':png((70,210,255,255),align='left')}
 ]
 project={'version':1,'media':[media],'clips':[clip],'audioClips':[],'videoTracks':[{'hidden':False} for _ in range(3)],'audioTracks':[{'volume':1} for _ in range(4)],'bgm':{},'texts':texts,'effects':[{'type':'black-in','start':0,'duration':2.5,'hold':1.5,'strength':1},{'type':'black-out','start':4.5,'duration':1.5,'hold':.3,'strength':1}],'aspect':'16:9','export':{'preset':'YOUTUBE','fps':'30','resolution':'Source','quality':'High','codec':'H.264'}}
 result=core.render({'id':'program','cancel':False},project);out=core.ROOT/'exports'/result['file'];core.validate_output(out,6,True)
 def pixel(t,x,y):return list(subprocess.check_output(core.BASE+['-v','error','-ss',str(t),'-i',out,'-frames:v','1','-vf',f'crop=4:4:{x}:{y},scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 corner=[pixel(t,10,10) for t in (.5,1.75,2.25,2.6,5.1,5.8)]
 assert max(corner[0])<20,corner
 assert 35<corner[1][0]<100 and corner[1][1]<20,corner
 assert 150<corner[2][0]<225 and corner[2][1]<30,corner
 assert corner[3][0]>220 and corner[3][1]<30,corner
 assert 75<corner[4][0]<180 and corner[4][1]<30,corner
 assert max(corner[5])<25,corner
 assert min(pixel(.5,320,180))>225
 yellow=pixel(2.8,320,295);assert yellow[0]>200 and yellow[1]>170 and yellow[2]<100,yellow
 blue=pixel(3.6,55,295);assert blue[2]>180 and blue[1]>150 and blue[0]<130,blue
 # At the exact caption boundary, the first line is gone and the second line is active.
 boundary=pixel(3.3,55,295);assert boundary[2]>150,boundary
 probe=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-show_streams','-of','json',out]));video=next(s for s in probe['streams'] if s['codec_type']=='video')
 assert (video['width'],video['height'],video['codec_name'])==(640,360,'h264')
 print('YouTube program export: held black title, exact caption swaps, picture fade-in/out, size/position and full decode PASS')
