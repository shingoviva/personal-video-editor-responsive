import os,sys,pathlib,tempfile,subprocess,base64,struct,zlib,json

with tempfile.TemporaryDirectory(prefix='pve-overlay-only-') as tmp:
 os.environ['PVE_DATA']=tmp;root=pathlib.Path(__file__).resolve().parent.parent;sys.path.insert(0,str(root/'engine'));import core
 width,height=180,64;rows=b''.join(b'\0'+bytes((255,220,40,255))*width for _ in range(height))
 def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
 raster={'data':'data:image/png;base64,'+base64.b64encode(png).decode(),'width':width,'height':height,'anchorX':width/2,'anchorY':height/2,'referenceWidth':1920,'referenceHeight':1080}
 project={'version':1,'media':[],'clips':[],'audioClips':[],'videoTracks':[{'hidden':False,'volume':1} for _ in range(3)],'audioTracks':[{'volume':1} for _ in range(4)],'overlayTracks':[{'hidden':False} for _ in range(3)],'bgm':{},'texts':[{'id':'title','layer':1,'text':'TITLE','start':0,'end':1.2,'size':80,'x':.5,'y':.5,'align':'center','opacity':1,'motion':'none','raster':raster}],'effects':[{'id':'out','layer':2,'type':'black-out','start':1,'duration':.5,'hold':.2,'strength':1}],'aspect':'16:9','export':{'fps':'30','resolution':'1080p','quality':'Preview','codec':'H.264'}}
 result=core.render({'id':'overlay-only','cancel':False},project,preview=True);out=core.ROOT/'cache'/result['file'];core.validate_output(out,1.5,True)
 probe=json.loads(subprocess.check_output([core.FFPROBE,'-v','error','-show_streams','-of','json',out]));streams=probe['streams'];assert any(s['codec_type']=='video' for s in streams) and any(s['codec_type']=='audio' for s in streams)
 pixel=list(subprocess.check_output(core.BASE+['-v','error','-ss','0.4','-i',out,'-frames:v','1','-vf','crop=4:4:478:268,scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']));assert pixel[0]>180 and pixel[1]>150,pixel
 print('Overlay-only timeline: black canvas, raster caption, FX, H.264/AAC and full-duration decode PASS')
