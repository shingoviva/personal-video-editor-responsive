import assert from 'node:assert/strict';
import {project,clip,sanitize,MAX_EFFECTS} from '../dist/model.js?v=2.2.85';
import {planTimelineDuplicate,commitTimelineDuplicate} from '../dist/timeline-duplicate.js?v=2.2.85';
const flash=(i)=>({id:'fx'+i,type:'flash',start:1+i*.25123456789,duration:.16,layer:i%3,strength:.8});
for(const n of [2,10,50,100,200]){
 const p=project();p.effects=Array.from({length:n},(_,i)=>flash(i));const before=structuredClone(p);const chosen=p.effects.map(item=>({kind:'effect',item,start:item.start,span:item.duration}));const plan=planTimelineDuplicate(p,chosen);assert.deepEqual(p,before);commitTimelineDuplicate(p,plan,4);
 assert.equal(p.effects.length,n*2);assert.deepEqual(p.effects.slice(0,n),before.effects);
 for(let i=0;i<n;i++){const a=p.effects[i],b=p.effects[n+i];assert.notEqual(a.id,b.id);assert.equal(b.start,a.start+4);assert.equal(b.layer,a.layer);assert.equal(b.duration,a.duration)}
 assert.equal(new Set(p.effects.map(v=>v.id)).size,n*2);assert.equal(sanitize(structuredClone(p)).effects.length,n*2);
}
const p=project(),m={id:'m',duration:3,kind:'video',audio:true};p.media=[m];const v={...clip(m),id:'v',start:1,layer:2,audioDetached:'a'};v.audio.gainEnvelope=[{time:0,valueDb:-2,interpolation:'hold',holdRampSeconds:.005,editBoundary:true},{time:1,valueDb:0}];const a={...structuredClone(v),id:'a',kind:'audio',sourceClip:'v',audioDetached:undefined,linked:true,layer:3};p.clips=[v];p.audioClips=[a];p.texts=[{id:'t',text:'T',start:1.25,end:2,layer:0}];p.effects=[flash(0)];
const source=[{item:v,kind:'video',start:1,span:3},{item:a,kind:'audio',start:1,span:3},{item:p.texts[0],kind:'text',start:1.25,span:.75},{item:p.effects[0],kind:'effect',start:1,span:.16}];
const before=structuredClone(p),plan=planTimelineDuplicate(p,source);assert.equal(plan.length,4);commitTimelineDuplicate(p,plan,4);const vc=p.clips[1],ac=p.audioClips[1];assert.equal(vc.audioDetached,ac.id);assert.equal(ac.sourceClip,vc.id);assert.equal(ac.linked,true);assert.equal(vc.media,v.media);assert.deepEqual(vc.audio,v.audio);v.audio.gainEnvelope[0].valueDb=12;assert.equal(vc.audio.gainEnvelope[0].valueDb,-2);assert.equal(p.texts[1].end,6);assert.equal(vc.layer,2);assert.equal(ac.layer,3);
const again=planTimelineDuplicate(p,plan.map(v=>({...v,start:v.item.start})));commitTimelineDuplicate(p,again,4);assert.equal(new Set([...p.clips,...p.audioClips,...p.effects,...p.texts].map(x=>x.id)).size,12);
const solo=planTimelineDuplicate(p,[source[1]]);assert.equal(solo.length,1);assert.equal(solo[0].item.linked,false);assert.equal(solo[0].item.sourceClip,null);
const auto=planTimelineDuplicate(p,[source[0]]);assert.equal(auto.length,2);assert.equal(auto[1].item.sourceClip,auto[0].item.id);
for(const delta of [-10,86400,NaN]){const snapshot=structuredClone(p);assert.throws(()=>commitTimelineDuplicate(p,auto,delta));assert.deepEqual(p,snapshot)}
assert.throws(()=>planTimelineDuplicate(p,source,()=>p.effects[0].id),/ID/);
const full=project();full.effects=Array.from({length:MAX_EFFECTS},(_,i)=>flash(i));let snap=structuredClone(full);assert.throws(()=>planTimelineDuplicate(full,[{item:full.effects[0],kind:'effect',start:1,span:.16}]));assert.deepEqual(full,snap);full.effects.push(flash(401));assert.throws(()=>sanitize(full),/400/);
const complex=project();complex.effects=Array.from({length:100},(_,i)=>({...flash(i),type:'black-in'}));assert.throws(()=>planTimelineDuplicate(complex,[{item:complex.effects[0],kind:'effect',start:1,span:.16}]),/100/);
const race=project();race.effects=[flash(0)];const pending=planTimelineDuplicate(race,[{item:race.effects[0],kind:'effect',start:1,span:.16}]);race.effects=Array.from({length:MAX_EFFECTS},(_,i)=>flash(i));snap=structuredClone(race);assert.throws(()=>commitTimelineDuplicate(race,pending,1));assert.deepEqual(race,snap);
console.log('Timeline duplicate: 2/10/50/100/200, atomic capacity, deep clone, internal links, media, B2 metadata, repeat, boundary safety PASS');
