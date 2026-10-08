import assert from 'node:assert/strict';
import {bindAssetVideoPreviews,startAssetVideoPreview,stopAssetVideoPreviews} from '../dist/asset-preview.js';

const video={muted:false,playsInline:false,duration:3,currentTime:0,played:0,paused:0,async play(){this.played++},pause(){this.paused++}};
const root={querySelectorAll:()=>[video]};
assert.equal(bindAssetVideoPreviews(root),1);
await video.onpointerenter();assert.equal(video.played,1);assert.equal(video.muted,true);assert.equal(video.playsInline,true);assert.equal(video.currentTime,.12);
video.onpointerleave();assert.equal(video.paused,1);
await startAssetVideoPreview(video);stopAssetVideoPreviews(root);assert.equal(video.played,2);assert.equal(video.paused,2);
console.log('Media library video preview: muted hover/focus playback and cleanup PASS');
