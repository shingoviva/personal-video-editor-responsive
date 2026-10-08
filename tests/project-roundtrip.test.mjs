import assert from 'node:assert/strict';
import {clip,project,sanitize} from '../dist/model.js';
import {captionDefaults} from '../dist/caption-presets.js';

const p=project();
p.id='complex-roundtrip';p.name='YouTube variety edit';p.aspect='16:9';p.intent='CINEMATIC';
p.media=[
 {id:'video-main',name:'IMG_7697.MP4',kind:'video',duration:67.95,width:1920,height:1080,fps:59.94,audio:true,hdr:false,rateMode:'VFR'},
 {id:'still-cutaway',name:'portrait.jpg',kind:'image',duration:5,width:4032,height:3024,audio:false,hdr:false},
 {id:'music-bed',name:'bgm.m4a',kind:'audio',duration:120,audio:true}
];
const base={...clip(p.media[0]),id:'v1',start:0,layer:0,out:12,speed:.75,endSpeed:1.25,curve:'ease-in-out',stabilization:'SMOOTH',interpolation:'motion',fadeIn:.5,fadeOut:.6,scaleKeyframes:[{time:0,value:1},{time:6,value:2.25},{time:12,value:1}],opacity:.94,opacityKeyframes:[{time:0,value:0},{time:1.2,value:.94},{time:11,value:.94},{time:12,value:0}],motionPreset:'push-in',motionAmount:.16,color:{...clip(p.media[0]).color,exposure:-.18,contrast:22,highlights:-35,saturation:-8,gamma:8,fade:4,sharpness:12,vignette:16}};
const cutaway={...clip(p.media[1]),id:'v2',start:2.4,layer:1,out:5,scale:1.12,x:.48,y:.46,opacity:.72,fadeIn:.3,fadeOut:.4,motionPreset:'pan-right',motionAmount:.11};
const overlay={...clip(p.media[0]),id:'v3',start:6.25,layer:2,in:20,out:24.5,scale:.56,x:.76,y:.28,opacity:.58,fadeIn:.25,fadeOut:.35};
p.clips=[base,cutaway,overlay];
p.videoTracks=[{name:'MAIN',hidden:false,volume:.85},{name:'CUTAWAY',hidden:false,volume:.45},{name:'OVERLAY',hidden:true,volume:1.2}];p.overlayTracks=[{name:'CAPTIONS',hidden:false},{name:'TITLES',hidden:false},{name:'FX',hidden:true}];
p.audioClips=[
 {id:'a1',media:'video-main',kind:'audio',sourceClip:'v1',linked:true,start:0,layer:0,in:0,out:12,speed:.75,endSpeed:1.25,curve:'ease-in-out',audio:{volume:.82,mute:false,fadeIn:.4,fadeOut:.5,gainKeyframes:[{time:.2,value:.1},{time:2.5,value:1.4}]}},
 {id:'a3',media:'music-bed',kind:'audio',sourceClip:null,linked:false,start:0,layer:2,in:0,out:22,speed:1,endSpeed:1,curve:'constant',loop:true,audio:{volume:.24,mute:false,fadeIn:1.2,fadeOut:2.4}}
];
p.audioTracks=[{name:'Dialogue',mute:false,solo:true,volume:1.05},{name:'Ambience',mute:true,solo:false,volume:.7},{name:'Music',mute:false,solo:false,volume:.46},{name:'SFX',mute:false,solo:false,volume:1.2}];
p.effects=[{id:'fx-in',type:'black-in',layer:0,start:0,duration:1.4,hold:.5,strength:1},{id:'fx-pop',type:'flash',layer:1,start:6.2,duration:.14,hold:0,strength:.72},{id:'fx-out',type:'black-out',layer:2,start:18,duration:2,hold:.75,strength:1}];
p.texts=[
 {...captionDefaults(0,1.4,'headline'),id:'title',text:'旅のはじまり',font:'Hiragino Sans'},
 {...captionDefaults(2,5,'tvBlueRed'),id:'caption-a',layer:1,text:'一回戦での敗退は\nショックでした',italic:true,lineColors:['#ffffff','#b71318'],accentWords:'敗退,ショック',letterSpacing:-1.25,lineHeight:1.04,x:.5,y:.78},
 {...captionDefaults(7,9.5,'tvImpact'),id:'caption-b',layer:2,text:'ネタ作りに欠かせないモノ',accentWords:'欠かせない',accentColor:'#ff817b',outerOutline:7,shadowX:6,shadowY:8,x:.5,y:.84}
];
p.bgm={media:'music-bed',volume:.26,fadeIn:1.2,fadeOut:2.5,gainKeyframes:[{time:0,value:.2},{time:10,value:1.4}]};
p.analysis=[{media:'video-main',intent:'CINEMATIC',sampleFps:3,markers:[{time:3.2,type:'motion',score:.91},{time:9.8,type:'still',score:.84}]}];
p.fonts=[{id:'font-variety',family:'PVE Variety 1234abcd',label:'Variety Gothic',name:'variety-gothic.woff2',size:48321,type:'file'}];
p.export={preset:'YOUTUBE',aspect:'AUTO',resolution:'4K',fps:'60',quality:'Maximum',codec:'H.264'};

const expected=sanitize(structuredClone(p));
const saved=JSON.stringify(expected,null,2);
const restored=sanitize(JSON.parse(saved));
assert.deepEqual(restored,expected);
assert.equal(restored.clips.length,3);assert.equal(restored.audioTracks.length,4);
assert.equal(restored.texts.length,3);assert.equal(restored.effects.length,3);
assert.equal(restored.videoTracks[2].hidden,true);assert.equal(restored.audioClips[0].linked,true);assert.deepEqual(restored.audioClips[0].audio.gainKeyframes,[]);assert.deepEqual(restored.audioClips[0].audio.gainEnvelope,expected.audioClips[0].audio.gainEnvelope);assert.equal(restored.audioClips[0].audio.gainEnvelope.length,2);
assert.equal(restored.videoTracks[1].volume,.45);assert.equal(restored.overlayTracks[2].hidden,true);assert.equal(restored.texts[2].layer,2);assert.equal(restored.effects[1].layer,1);
assert.equal(restored.clips[0].opacityKeyframes.length,4);assert.deepEqual(restored.clips[0].scaleKeyframes,[{time:0,value:1},{time:6,value:2.25},{time:12,value:1}]);assert.deepEqual(restored.bgm.gainKeyframes,[{time:0,value:.2},{time:10,value:1.4}]);assert.deepEqual(restored.clips[0].scaleKeyframes,[{time:0,value:1},{time:6,value:2.25},{time:12,value:1}]);assert.deepEqual(restored.bgm.gainKeyframes,[{time:0,value:.2},{time:10,value:1.4}]);assert.equal(restored.clips[0].color.vignette,16);assert.equal(restored.texts[1].italic,true);
assert.deepEqual(restored.fonts,p.fonts);
assert.deepEqual(restored.export,{preset:'YOUTUBE',aspect:'AUTO',resolution:'4K',fps:'60',quality:'Maximum',codec:'H.264'});
console.log('Complex project save/reload round-trip: video, audio, FX, captions, tracks and export state PASS');
