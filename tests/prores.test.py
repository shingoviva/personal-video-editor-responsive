"""Native ProRes 422 10-bit/PCM export and high-precision color path."""
import base64,json,os,pathlib,struct,subprocess,sys,tempfile,zlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='pve-prores-') as tmp:
 os.environ['PVE_DATA']=tmp;sys.path.insert(0,str(ROOT/'engine'));import core
 if not core.capabilities().get('prores'):
  print('ProRes test SKIP: prores_ks unavailable');raise SystemExit(0)
 src=pathlib.Path(tmp)/'gradient.mov'
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i','gradients=size=320x180:rate=30:c0=0x000000:c1=0xffffff:x0=0:y0=0:x1=320:y1=180','-f','lavfi','-i','sine=frequency=330:sample_rate=48000','-t','0.6','-c:v','prores_ks','-profile:v','lt','-pix_fmt','yuv422p10le','-c:a','pcm_s24le',str(src)],check=True)
 media=core.inspect(src,'prores-source','gradient.mov')
 clip={'id':'clip','media':media['id'],'in':0,'out':.5,'speed':1,'endSpeed':1,'curve':'constant','scale':1,'x':.5,'y':.5,'stabilization':'OFF','interpolation':'duplicate','color':{'exposure':.13,'contrast':7,'highlights':-4,'shadows':3,'temperature':2,'tint':1,'saturation':5,'vibrance':4},'audio':{'volume':1}}
 width,height=96,28;rows=b''.join(b'\0'+bytes((255,255,255,210))*width for _ in range(height));chunk=lambda kind,data:struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff);png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
 text={'text':'GRADE','start':.05,'end':.45,'size':36,'x':.5,'y':.8,'opacity':.8,'font':'Sans','raster':{'data':'data:image/png;base64,'+base64.b64encode(png).decode(),'width':width,'height':height}}
 project={'version':1,'clips':[clip],'aspect':'16:9','texts':[text],'effects':[{'type':'flash','start':.1,'duration':.1,'strength':.25}],'audioClips':[],'audioTracks':[],'export':{'resolution':'1080p','fps':30,'quality':'High','codec':'ProRes 422'}}
 result=core.render({'id':'prores-test','cancel':False},project,False);out=core.ROOT/'exports'/result['file']
 data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',out]));video=next(s for s in data['streams'] if s['codec_type']=='video');audio=next(s for s in data['streams'] if s['codec_type']=='audio')
 assert out.suffix=='.mov' and result['format']=='MOV';assert video['codec_name']=='prores' and video['pix_fmt']=='yuv422p10le';assert audio['codec_name'].startswith('pcm_')
 raw=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-i',str(out),'-frames:v','1','-vf','scale=320:180,format=gray16le','-f','rawvideo','-']);levels=struct.unpack('<'+'H'*(len(raw)//2),raw);assert len(set(levels))>256,len(set(levels))
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-xerror','-i',str(out),'-f','null','-'],check=True)
 print('ProRes 422 MOV: 10-bit 4:2:2, >256 gradient levels, PCM audio, effect, raster text and full decode PASS')
