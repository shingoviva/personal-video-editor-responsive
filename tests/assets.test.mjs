import assert from 'node:assert/strict';
import {mediaKind,assetName,fileKind,usage,filterAssets,removeUnused,sourceLimit} from '../dist/assets.js';
import {project,clip,pasteClip,total,sanitize} from '../dist/model.js';
import {StillPreview} from '../dist/image-media.js';
const p=project(),photo={id:'photo',name:'A.jpg',kind:'image',width:2000,height:3000,duration:5},audio={id:'audio',name:'Music.wav',kind:'audio',duration:20,width:0},unused={id:'unused',name:'Another.mp3',kind:'audio',width:0};
p.media=[photo,audio,unused];p.clips=[clip(photo)];p.bgm.media=audio.id;
assert.equal(total(p),5);p.clips[0].out=12;assert.equal(total(p),12);assert.equal(sourceLimit(photo),3600);
assert.equal(mediaKind({width:1920}),'video');assert.equal(mediaKind({width:0}),'audio');
photo.label='EDITORIAL';assert.equal(assetName(photo),'EDITORIAL');assert.equal(photo.name,'A.jpg');
assert.equal(filterAssets(p,{kind:'audio'}).length,2);assert.equal(filterAssets(p,{query:'a.jpg'})[0],photo);
assert.equal(usage(p,photo.id),1);assert.equal(usage(p,audio.id),1);
const saved=JSON.stringify(p);assert.equal(removeUnused(p,p.media.map(m=>m.id)),1);assert.equal(p.media.length,2);
assert.equal(sanitize(JSON.parse(saved)).media.length,3);
assert.equal(fileKind({name:'photo.JPEG',type:''}),'image');assert.equal(fileKind({name:'recording.m4a',type:''}),'audio');
assert.throws(()=>fileKind({name:'photo.HEIC',type:'image/heic'}),/JPEG/);
// A stale image decode must close itself rather than replacing a later source.
let finish,closed=0;globalThis.createImageBitmap=()=>new Promise(r=>finish=()=>r({close(){closed++}}));
const preview=new StillPreview(),pending=preview.load('a',async()=>({}),photo);await Promise.resolve();preview.clear();finish();assert.equal(await pending,null);assert.equal(closed,1);
console.log('Assets: type filters/search, rename without relink damage, protected cleanup/restore, still duration, stale bitmap disposal: PASS');
