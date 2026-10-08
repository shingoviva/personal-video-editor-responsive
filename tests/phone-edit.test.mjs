import assert from 'node:assert/strict';
import {project,clip,sequence,timing} from '../dist/model.js';
import {reorderPhoneClip,trimPhoneClip} from '../dist/iphone-edit.js';
import {detachAudio} from '../dist/audio-timeline.js';
const p=project(),m={id:'m',duration:20,audio:true,kind:'video'};p.media=[m];const a={...clip(m),start:0,out:8},b={...clip(m),start:8,out:3},c={...clip(m),start:11,out:2};p.clips=[a,b,c];const linked=detachAudio(p,a.id,0);
assert(reorderPhoneClip(p,a.id,1));assert.equal(b.start,0);assert.equal(a.start,3);assert.equal(c.start,11);assert.equal(linked.start,3);assert.equal(reorderPhoneClip(p,b.id,-1),false);
trimPhoneClip(p,a,{input:2,output:6,limit:20,ripple:true});assert.equal(timing(a).duration,4);assert.equal(c.start,7);assert.equal(linked.in,2);assert.equal(linked.out,6);assert.throws(()=>trimPhoneClip(p,a,{input:4,output:4,limit:20}));
const img={id:'img',kind:'image',duration:0};p.media.push(img);const still={...clip(img),start:9};p.clips.push(still);trimPhoneClip(p,still,{length:2,limit:3600});assert.equal(timing(still).duration,2);
console.log('Phone trim/ripple, unequal-length reorder, linked audio, still duration and invalid range PASS');
