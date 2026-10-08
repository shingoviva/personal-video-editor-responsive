import assert from 'node:assert/strict';
import {defaultForSetting,resetAudioAdjustments,resetMotionAppearance} from '../dist/setting-resets.js';
import {clip,project} from '../dist/model.js';
const c=clip({id:'source',duration:8});Object.assign(c,{start:3,layer:2,in:1,out:7,speed:.5,endSpeed:.8,curve:'linear',stabilization:'STRONG',motionPreset:'push-in',scale:2,opacity:.4,scaleKeyframes:[{time:2,value:2}],opacityKeyframes:[{time:1,value:.3}]});
const preserved=Object.fromEntries(['start','layer','in','out','speed','endSpeed','curve','stabilization'].map(k=>[k,c[k]]));resetMotionAppearance(c);for(const[k,v]of Object.entries(preserved))assert.equal(c[k],v);assert.equal(c.scale,1);assert.equal(c.opacity,1);assert.equal(c.motionPreset,'none');assert.deepEqual(c.scaleKeyframes,[]);assert.deepEqual(c.opacityKeyframes,[]);
const audio={volume:.2,mute:true,fadeIn:2,fadeOut:3,gainEnvelope:[{time:2,valueDb:-6}],delayEnabled:true,delayTime:.7};resetAudioAdjustments(audio);assert.equal(audio.mute,true,'reset must preserve detached original mute');assert.equal(audio.volume,1);assert.equal(audio.fadeIn,0);assert.deepEqual(audio.gainEnvelope,[]);assert.equal(audio.delayEnabled,false);
const bgm=project().bgm;bgm.media='music';resetAudioAdjustments(bgm,{bgm:true});assert.equal(bgm.media,'music');assert.equal(bgm.volume,.3);
assert.equal(defaultForSetting('soundclip.audio.volume'),1);assert.equal(defaultForSetting('color.gamma'),0);assert.equal(defaultForSetting('speed'),undefined);assert.equal(defaultForSetting('in'),undefined);assert.equal(defaultForSetting('effect.duration'),undefined);
console.log('Scope-limited resets preserve timing, placement, mute and links PASS');
