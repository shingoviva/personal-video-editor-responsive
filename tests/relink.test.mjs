import assert from 'node:assert/strict';
import {relinkScore,rankRelinkCandidates} from '../dist/relink.js';
const media={name:'IMG_7917.mov',size:1000,kind:'video'},exact={name:'IMG_7917.MOV',size:1000,kind:'video'},near={name:'IMG-7917 copy.mov',size:1010,kind:'video'},wrong={name:'music.wav',size:1000,kind:'audio'};
assert(relinkScore(media,exact).score>=95);assert(relinkScore(media,near).score>relinkScore(media,wrong).score);assert.equal(rankRelinkCandidates(media,[wrong,exact])[0].file,exact);
console.log('Relink candidates: normalized name, size and media type ranking PASS');
