"""Read-only MP4 test parser. No mutation, free rewriting, or mux fallback."""
import struct
def boxes(b,start=0,end=None):
 end=len(b) if end is None else end
 while start+8<=end:
  n=struct.unpack_from('>I',b,start)[0];t=b[start+4:start+8];h=8
  if n==1:n=struct.unpack_from('>Q',b,start+8)[0];h=16
  if n==0:n=end-start
  if n<h or start+n>end:raise ValueError((t,start,n,end))
  yield(start,n,t,h);start+=n

def child(b,node,kind):return next(x for x in boxes(b,node[0]+node[3],node[0]+node[1]) if x[2]==kind)

def inspect(b):
 top=list(boxes(b));moov=next(x for x in top if x[2]==b'moov');tracks=[]
 for trak in boxes(b,moov[0]+8,moov[0]+moov[1]):
  if trak[2]!=b'trak':continue
  mdia=child(b,trak,b'mdia');hdlr=child(b,mdia,b'hdlr');kind=b[hdlr[0]+16:hdlr[0]+20].decode();mdhd=child(b,mdia,b'mdhd');version=b[mdhd[0]+8];at=mdhd[0]+(28 if version else 20);rate=struct.unpack_from('>I',b,at)[0];duration=struct.unpack_from('>Q' if version else '>I',b,at+4)[0];minf=child(b,mdia,b'minf');stbl=child(b,minf,b'stbl');stsz=child(b,stbl,b'stsz');count=struct.unpack_from('>I',b,stsz[0]+16)[0];stts=child(b,stbl,b'stts');n=struct.unpack_from('>I',b,stts[0]+12)[0];times=[struct.unpack_from('>II',b,stts[0]+16+i*8) for i in range(n)];edits=[]
  try:
   elst=child(b,child(b,trak,b'edts'),b'elst');version=b[elst[0]+8];n=struct.unpack_from('>I',b,elst[0]+12)[0];assert version==0
   edits=[{'duration':struct.unpack_from('>I',b,elst[0]+16+i*12)[0],'media_time':struct.unpack_from('>i',b,elst[0]+20+i*12)[0]} for i in range(n)]
  except StopIteration:elst=None
  tracks.append(dict(kind=kind,timescale=rate,duration=duration,packets=count,stts=times,edits=edits,nodes={'trak':trak,'mdia':mdia,'minf':minf,'stbl':stbl,'mdhd':mdhd,'stts':stts,'elst':elst}))
 movie=None
 try:
  mvhd=child(b,moov,b'mvhd');at=mvhd[0]+(28 if b[mvhd[0]+8] else 20);movie={'timescale':struct.unpack_from('>I',b,at)[0],'duration':struct.unpack_from('>Q' if b[mvhd[0]+8] else '>I',b,at+4)[0]}
 except StopIteration:pass
 return {'top':top,'tracks':tracks,'moov':moov,'movie':movie}

def structure(b):
 i=inspect(b);result=[]
 for t in i['tracks']:
  stbl=t['nodes']['stbl'];groups=[]
  for p,n,k,h in boxes(b,stbl[0]+8,sum(stbl[:2])):
   if k in [b'sgpd',b'sbgp']:groups.append({'type':k.decode(),'hex':b[p:p+n].hex()})
  result.append({**{k:v for k,v in t.items() if k!='nodes'},'groups':groups})
 return result
