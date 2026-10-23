// AAC-LC has one preceding transform packet dependency (roll_distance = -1).
// Apple QTFF explicit priming requires BOTH roll sgpd and sbgp beside elst.
const fail=(reason='group')=>{throw Error('MP4 AAC priming構造が一致しません（'+reason+'）。書き出しを中止しました。')};
const u32=(a,offset,value)=>new DataView(a.buffer).setUint32(offset,value);
function group(type,count){
 const a=new Uint8Array(type==='sgpd'?18:20);a[0]=type==='sgpd'?1:0;
 a.set([114,111,108,108],4);
 if(type==='sgpd'){u32(a,8,2);u32(a,12,1);a.set([255,255],16)}
 else{u32(a,8,1);u32(a,12,count);u32(a,16,1)}
 return{type,contents:a};
}
const roll=b=>b?.contents instanceof Uint8Array&&b.contents.length>=8&&String.fromCharCode(...b.contents.subarray(4,8))==='roll';
const equal=(a,b)=>a instanceof Uint8Array&&a.length===b.length&&a.every((v,i)=>v===b[i]);
export class AacPrimingMux{
 constructor(){this.counts=new Map()}
 record(id,count){this.counts.set(id,count)}
 verify(count){if(this.counts.size!==1||!Number.isSafeInteger(count)||count<=0||[...this.counts.values()][0]!==count)fail('packet count: '+count+'/'+[...this.counts.values()])}
}
// Called inside Mediabunny's box-tree construction, including its reserve-size pass.
export function appendAacRollGroups(track,children){
 const policy=track.muxer.formatOptions.pveAacPriming;
 if(!policy||track.type!=='audio'||track.track.source._codec!=='aac'||track.info.decoderConfig.codec!=='mp4a.40.2')return children;
 if(!(policy instanceof AacPrimingMux)||track.muxer.isFragmented||track.muxer.isQuickTime)fail('unsupported mode');
 // reserve measures a zero-sample tree before moving its pending sample queue.
 // Final zero-sample output is rejected independently by policy.verify().
 const count=track.samples.length;
 if(!Number.isSafeInteger(count)||count<0||count>0xffffffff||(count>0&&track.timeToSampleTable.reduce((s,r)=>s+r.sampleCount,0)!==count))fail('sample table: '+count+'/'+track.timeToSampleTable.reduce((s,r)=>s+r.sampleCount,0));
 const expected=[group('sgpd',count),group('sbgp',count)];
 const existing=children.filter(b=>b&&['sgpd','sbgp'].includes(b.type)&&roll(b));
 if(existing.length){
  if(existing.length!==2)fail();
  for(const e of expected){const matches=existing.filter(b=>b.type===e.type);if(matches.length!==1||!equal(matches[0].contents,e.contents)||matches[0].children?.length)fail()}
 }else{
  // A malformed group box cannot be classified safely; never guess or overwrite it.
  if(children.some(b=>b&&['sgpd','sbgp'].includes(b.type)&&(!(b.contents instanceof Uint8Array)||b.contents.length<8)))fail();
  children=[...children,...expected];
 }
 policy.record(track.track.id,count);return children;
}

// Read only box headers and fixed-size group fields, never mdat/media payloads.
// This independent check also fails closed if a future muxer loses the hook.
export async function verifyAacPrimingFile(file,count,{check=()=>{},firstSample}={}){
 const read=async(at,n)=>{check();if(!Number.isSafeInteger(at)||at<0||at+n>file.size)fail('box range');const b=new Uint8Array(await file.slice(at,at+n).arrayBuffer());if(b.length!==n)fail('short read');return b};
 const list=async(start,end)=>{const result=[];while(start<end){if(end-start<8)fail('box header');const b=await read(start,Math.min(16,end-start)),v=new DataView(b.buffer);let size=v.getUint32(0),header=8;if(size===1){if(b.length<16)fail('large box');const big=v.getBigUint64(8);if(big>BigInt(Number.MAX_SAFE_INTEGER))fail('large range');size=Number(big);header=16}else if(size===0)size=end-start;if(size<header||size>end-start)fail('box size');result.push({type:String.fromCharCode(...b.subarray(4,8)),start,end:start+size,payload:start+header,size,header});start+=size}return result};
 const one=(nodes,type)=>{const found=nodes.filter(b=>b.type===type);if(found.length!==1)fail('unique '+type);return found[0]};
 const children=b=>list(b.payload,b.end),top=await list(0,file.size),moov=one(top,'moov');one(top,'mdat');
 const audio=[];
 for(const track of (await children(moov)).filter(b=>b.type==='trak')){
  const tc=await children(track),mdia=one(tc,'mdia'),mc=await children(mdia),hdlr=one(mc,'hdlr');
  if(hdlr.end-hdlr.payload<12)fail('handler');const h=await read(hdlr.payload,12);if(String.fromCharCode(...h.subarray(8,12))!=='soun')continue;
  const stbl=one(await children(one(mc,'minf')),'stbl'),nodes=await children(stbl),stsz=one(nodes,'stsz');if(stsz.end-stsz.payload<12)fail('stsz');
  const sampleCount=new DataView((await read(stsz.payload,12)).buffer).getUint32(8);if(sampleCount!==count||count<=0)fail('file packet count');
  const groups=[];for(const b of nodes.filter(b=>b.type==='sgpd'||b.type==='sbgp')){if(b.end-b.payload<8)fail('group header');const head=await read(b.payload,8);if(String.fromCharCode(...head.subarray(4,8))==='roll')groups.push(b)}
  if(groups.length!==2)fail('file roll groups');for(const expected of [group('sgpd',count),group('sbgp',count)]){const b=one(groups,expected.type);if(b.end-b.payload!==expected.contents.length||!equal(await read(b.payload,expected.contents.length),expected.contents))fail('file group data')}
  if(firstSample!==undefined){const elst=one(await children(one(tc,'edts')),'elst');const len=elst.end-elst.payload;if(len<20)fail('elst');const b=await read(elst.payload,Math.min(28,len)),v=new DataView(b.buffer);if(v.getUint32(4)!==1||b[0]>1)fail('elst entries');if(b[0]===1&&len<28)fail('elst v1');const media=b[0]===1?Number(v.getBigInt64(16)):v.getInt32(12);if(media!==firstSample)fail('elst media_time')}
  audio.push(sampleCount);
 }
 if(audio.length!==1)fail('audio track count');check();return{packetCount:count,rollDistance:-1};
}
