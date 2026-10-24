import assert from 'node:assert/strict';
import {relinkScore,rankRelinkCandidates} from '../dist/relink.js?v=2.2.85';
const media={name:'IMG_7917.mov',size:1000,kind:'video'},exact={name:'IMG_7917.MOV',size:1000,kind:'video'},near={name:'IMG-7917 copy.mov',size:1010,kind:'video'},wrong={name:'music.wav',size:1000,kind:'audio'};
assert(relinkScore(media,exact).score>=95);assert(relinkScore(media,near).score>relinkScore(media,wrong).score);assert.equal(rankRelinkCandidates(media,[wrong,exact])[0].file,exact);
console.log('Relink candidates: normalized name, size and media type ranking PASS');

const {missingLinkCounts}=await import('../dist/relink.js?v=2.2.85');
const offlineProject={media:[{id:'a'},{id:'b'},{id:'c'}],clips:[{media:'a'},{media:'a'},{media:'b'},{media:'a',gap:true}],audioClips:[{media:'b'}]};
assert.deepEqual(missingLinkCounts(offlineProject,m=>m.id==='c'),{media:2,clips:4});
assert.deepEqual(missingLinkCounts(offlineProject,()=>true),{media:0,clips:0});
console.log('Offline counts distinguish media and repeated video/audio clips, excluding gaps PASS');
