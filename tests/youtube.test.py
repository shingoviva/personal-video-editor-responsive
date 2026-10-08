import os,sys,pathlib,tempfile,subprocess,base64,struct,zlib,json

with tempfile.TemporaryDirectory(prefix='pve-youtube-') as tmp:
 os.environ['PVE_DATA']=tmp;root=pathlib.Path(__file__).resolve().parent.parent
 sys.path.insert(0,str(root/'engine'));import core
 source=pathlib.Path(tmp)/'source.mp4'
 subprocess.run(core.BASE+['-f','lavfi','-i','testsrc2=s=320x180:r=30:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',source],check=True,capture_output=True)
 media=core.inspect(source,'youtube-source',source.name)
 def png(color,width=240,height=80):
  rows=b''.join(b'\0'+bytes(color)*width for _ in range(height))
  def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
  payload=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
  return {'data':'data:image/png;base64,'+base64.b64encode(payload).decode(),'width':width,'height':height}
 colors=[(255,0,0,255),(0,255,0,255),(0,0,255,255)]
 texts=[{'id':f't{i}','text':f'caption {i}','start':i,'end':i+1,'size':80,'x':.5,'y':.5,'opacity':1,'motion':'pop' if i==0 else 'none','motionDuration':.2,'raster':png(value)} for i,value in enumerate(colors)]
 clip={'id':'c','media':media['id'],'in':0,'out':3,'start':0,'layer':0,'speed':1,'endSpeed':1,'curve':'constant','audio':{'volume':1},'color':{},'stabilization':'OFF'}
 project={'version':1,'media':[media],'clips':[clip],'audioClips':[],'videoTracks':[{'hidden':False} for _ in range(3)],'audioTracks':[{'volume':1} for _ in range(4)],'bgm':{},'texts':texts,'effects':[],'aspect':'16:9','export':{'preset':'YOUTUBE','fps':'30','resolution':'1080p','quality':'High','codec':'H.264','videoBitrate':'12','audioBitrate':'256'}}
 assert core.output_size({**project,'export':{**project['export'],'resolution':'1440p'}},media)==(2560,1440)
 assert core.output_size({**project,'export':{**project['export'],'resolution':'4K'}},media)==(3840,2160)
 result=core.render({'id':'youtube','cancel':False},project);out=core.ROOT/'exports'/result['file'];core.validate_output(out,3,True)
 probe=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-show_streams','-of','json',out]));video=next(s for s in probe['streams'] if s['codec_type']=='video');audio=next(s for s in probe['streams'] if s['codec_type']=='audio')
 assert (video['width'],video['height'],video['codec_name'])==(1920,1080,'h264');assert audio['codec_name']=='aac'
 def pixel(t):return list(subprocess.check_output(core.BASE+['-v','error','-ss',str(t),'-i',out,'-frames:v','1','-vf','crop=4:4:958:538,scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']))
 samples=[pixel(.5),pixel(1.5),pixel(2.5)]
 assert samples[0][0]>180 and samples[0][1]<80,(samples)
 assert samples[1][1]>180 and samples[1][0]<80,(samples)
 assert samples[2][2]>180 and samples[2][0]<80,(samples)
 print('YouTube 16:9: 1080p H.264/AAC, 1440p/4K sizing and three-caption single-pass render PASS')
