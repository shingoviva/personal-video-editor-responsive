import assert from 'node:assert/strict';
import fs from 'node:fs';
import {appendAacRollGroups,AacPrimingMux,verifyAacPrimingFile} from '../dist/mp4-aac-roll.js?v=2.2.84';
const track=(n=120)=>({type:'audio',muxer:{formatOptions:{pveAacPriming:new AacPrimingMux()}},track:{id:1,source:{_codec:'aac'}},info:{decoderConfig:{codec:'mp4a.40.2'}},samples:{length:n},timeToSampleTable:[{sampleCount:n}]});
const t=track(),groups=appendAacRollGroups(t,[]);
assert.deepEqual(groups.map(x=>[x.type,x.contents.length]),[['sgpd',18],['sbgp',20]]);
assert.equal(new DataView(groups[0].contents.buffer).getInt16(16),-1);
assert.equal(new DataView(groups[1].contents.buffer).getUint32(12),120);t.muxer.formatOptions.pveAacPriming.verify(120);
assert.throws(()=>t.muxer.formatOptions.pveAacPriming.verify(121));
assert.equal(appendAacRollGroups(t,groups),groups);
assert.throws(()=>appendAacRollGroups(t,[...groups,...groups]));
assert.throws(()=>appendAacRollGroups(t,[groups[0]]));
const corrupt=structuredClone(groups);corrupt[1].contents[15]=121;assert.throws(()=>appendAacRollGroups(t,corrupt));
assert.throws(()=>appendAacRollGroups(t,[{type:'sgpd',contents:new Uint8Array(1)}]));
const measuring=track(0);measuring.timeToSampleTable[0].sampleCount=34;appendAacRollGroups(measuring,[]);assert.throws(()=>measuring.muxer.formatOptions.pveAacPriming.verify(0));
const mismatch=track();mismatch.timeToSampleTable[0].sampleCount=119;assert.throws(()=>appendAacRollGroups(mismatch,[]));
const unrelated={type:'sgpd',contents:new Uint8Array([1,0,0,0,116,101,115,116])};assert.equal(appendAacRollGroups(t,[unrelated])[0],unrelated);
for(const n of [0,1,28,120,2838,0xffffffff]){const x=track(n);assert.equal(new DataView(appendAacRollGroups(x,[])[1].contents.buffer).getUint32(12),n)}
for(const n of [-1,1.2,0x100000000])assert.throws(()=>appendAacRollGroups(track(n),[]));
for(const codec of ['opus','mp3']){const x=track();x.track.source._codec=codec;assert.deepEqual(appendAacRollGroups(x,[]),[])}
const he=track();he.info.decoderConfig.codec='mp4a.40.5';assert.deepEqual(appendAacRollGroups(he,[]),[]);
const fragment=track();fragment.muxer.isFragmented=true;assert.throws(()=>appendAacRollGroups(fragment,[]));
assert.throws(()=>new AacPrimingMux().verify(1));assert.throws(()=>t.muxer.formatOptions.pveAacPriming.verify(0));
// The dependency hook must be present; missing/changed vendor requires a reviewed port.
const hashes=JSON.parse(fs.readFileSync(new URL('../scripts/mediabunny-priming-patch.json',import.meta.url)));
const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../dist/vendor/mediabunny.mjs?v=2.2.84',import.meta.url))).digest('hex'),hashes.after);
console.log('MP4 priming: exact groups/counts, duplicate/conflict/malformed rejection, non-AAC, reserve/large counts, pinned dependency hook PASS');

const frozen=new Blob([fs.readFileSync(new URL('./fixtures/mp4/formal-chrome-two.mp4',import.meta.url))]);
assert.deepEqual(await verifyAacPrimingFile(frozen,120,{firstSample:26112}),{packetCount:120,rollDistance:-1});
await assert.rejects(verifyAacPrimingFile(frozen,121));await assert.rejects(verifyAacPrimingFile(frozen,120,{firstSample:24000}));
await assert.rejects(verifyAacPrimingFile(new Blob([fs.readFileSync(new URL('./fixtures/mp4/chrome-two.mp4',import.meta.url))]),120));
await assert.rejects(verifyAacPrimingFile(new Blob([new Uint8Array([0,0,0,4,109,111,111,118])]),120));
await assert.rejects(verifyAacPrimingFile(frozen,120,{check(){throw Error('cancelled')}}));
let maxRead=0;const bounded={size:frozen.size,slice(a,b){maxRead=Math.max(maxRead,b-a);assert.ok(b-a<=28);return frozen.slice(a,b)}};await verifyAacPrimingFile(bounded,120);assert.ok(maxRead<=28);
// A logical >4GiB mdat hole: verify seeks over it, never reads/allocates it.
const hole=2**32,largeHeader=new Uint8Array(16);new DataView(largeHeader.buffer).setUint32(0,1);largeHeader.set([109,100,97,116],4);new DataView(largeHeader.buffer).setBigUint64(8,BigInt(hole));
const synthetic={size:hole+frozen.size,slice(a,b){assert.ok(b-a<=28);if(a<hole){assert.equal(a,0);return new Blob([largeHeader.subarray(a,b)])}return frozen.slice(a-hole,b-hole)}};
// Two mdats must be rejected; the parser still traverses >4GiB offsets with bounded reads.
await assert.rejects(verifyAacPrimingFile(synthetic,120),/unique mdat/);
console.log('Independent file validation: groups/stsz/elst, malformed boxes, missing hook, cancellation and bounded 64-bit reads PASS');
largeHeader.set([102,114,101,101],4);await verifyAacPrimingFile(synthetic,120,{firstSample:26112});console.log('Logical >4GiB metadata seek uses <=28-byte reads PASS');
for(const [file,count] of [['ffmpeg-44100.mp4',88],['ffmpeg-48000.mp4',95]]){
 const b=new Blob([fs.readFileSync(new URL('./fixtures/mp4/'+file,import.meta.url))]);
 await verifyAacPrimingFile(b,count,{firstSample:1024});
}
console.log('Explicit priming 1024 and 26112, independent 44.1/48k track clocks PASS');
