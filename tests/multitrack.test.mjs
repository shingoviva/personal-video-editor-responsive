import assert from 'node:assert/strict';
import {project,clip,sequence,visibleSequence,total,locate,sanitize,splitClip,audioSequence} from '../dist/model.js';
import {detachAudio,appendAudio,audioWindows,trackGain,migrateBgm} from '../dist/audio-timeline.js';
import {usage,removeUnused} from '../dist/assets.js';
const m={id:'m',duration:10,width:160,height:90,kind:'video',audio:true},p=project();p.media=[m];
p.clips=[{...clip(m),layer:0,start:0},{...clip(m),layer:1,start:1,out:2},{...clip(m),layer:2,start:2,out:1}];
assert.equal(locate(p,2.5).layer,2);assert.equal(locate(p,1.5).layer,1);assert.equal(locate(p,4).layer,0);
assert.equal(sanitize(JSON.parse(JSON.stringify(p))).clips[2].layer,2);
const source=p.clips[0],audio=detachAudio(p,source.id,0);assert(audio);assert.equal(source.audio.mute,true);assert.equal(audio.audio.mute,false);assert.equal(audio.in,source.in);
source.in=2;source.speed=2;assert.equal(audio.in,0);assert.equal(audio.speed,1);
audio.start=3;audio.out=4;const right=splitClip(audio,2);p.audioClips.push(right);assert.equal(right.start,5);assert.equal(audio.out,2);
for(let k=1;k<4;k++){const a=appendAudio(p,m,0,k);a.out=1}
assert.equal(audioWindows(p).filter(r=>r.start===0).length,3);
assert.equal(trackGain(p,3),1);p.audioTracks[2].solo=true;assert.equal(trackGain(p,3),0);assert.equal(trackGain(p,2),1);p.audioTracks[2].mute=true;assert.equal(trackGain(p,2),0);
const extra=appendAudio(p,m,12,3);extra.out=2;assert.equal(total(p),14);assert(locate(p,13).clip.gap);assert.equal(visibleSequence(p).at(-1).end,14);
const used=usage(p,m.id);assert(used>p.clips.length);p.clips=[];assert.equal(removeUnused(p,[m.id]),0);assert.equal(p.media.length,1);
const restored=sanitize(JSON.parse(JSON.stringify(p)));assert.equal(restored.audioClips.length,p.audioClips.length);assert.equal(restored.audioTracks[2].solo,true);
const legacy=project();legacy.media=[m];legacy.clips=[clip(m)];legacy.bgm={media:'m',volume:.2};migrateBgm(legacy);assert.equal(legacy.audioClips[0].out,10);assert.equal(legacy.audioClips[0].layer,2);assert(legacy.audioClips[0].loop);assert(!legacy.bgm.media);
console.log('V3 priority, independent audio split/move, four lanes/solo, audio tail, protected assets, project restore, BGM migration PASS');
