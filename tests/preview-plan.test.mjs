import assert from 'node:assert/strict';
import {project,clip,sequence} from '../dist/model.js?v=2.2.84';
import {compilePreviewPlan} from '../dist/preview-plan.js?v=2.2.84';
const p=project(),m={id:'m',kind:'video',duration:6};p.media=[m];p.clips=[0,1,2].map(layer=>({...clip(m),id:'v'+layer,layer,start:layer,in:layer,out:layer===0?6:layer===1?5:4,fadeIn:layer?.1:0,fadeOut:layer?.6:0}));
const plan=compilePreviewPlan(sequence(p),6);
assert.equal(plan.next(.1).row.clip.id,'v1');assert.equal(plan.next(.1).at,1,'An upper-layer start precedes the current base clip end');
assert(plan.needsLower(0,'v0',.7,.35),'Brief fade-in is prepared even if it ends before the look-ahead endpoint');
assert(!plan.needsLower(0,'v0',1.2,.35),'Fully covered decoder is released when not needed soon');
assert(plan.needsLower(1,'v1',3.1,.35),'Prepare lower picture before the upper fade-out begins');
assert.equal(plan.next(3.5).row.clip.id,'v1');assert.equal(plan.next(3.5).at,4);
assert(!plan.needsLower(1,'wrong',3.1,.35));
p.clips[2].fadeOut=0;p.clips[2].opacityKeyframes=[{time:0,value:1},{time:.8,value:1},{time:1,value:.5},{time:2,value:1}];
assert(compilePreviewPlan(sequence(p),6).needsLower(1,'v1',2.5,.35),'Opacity automation also triggers look-ahead');
console.log('Preview plan: upper-layer starts, short fades, upcoming reveals, coverage release, opacity automation and return to lower layer PASS');
const {clipAlpha}=await import('../dist/creative.js?v=2.2.84');const {transitionState}=await import('../dist/transition.js?v=2.2.84');
for(let n=0;n<24;n++){
 const p=project();p.media=[m];p.clips=[0,1,2].map(layer=>({...clip(m),id:`case-${n}-${layer}`,layer,start:layer*.37,in:0,out:2+layer*.4,speed:[.5,1,2][n%3],endSpeed:[.5,1,2][n%3],opacity:n%4===0?.5:1,fadeIn:n%2?.4:0,fadeOut:n%3?.3:0,opacityKeyframes:n%5===0?[{time:0,value:1},{time:.8,value:.6},{time:1.5,value:1}]:[]}));
 const rows=sequence(p),end=Math.max(...rows.map(r=>r.end)),plan=compilePreviewPlan(rows,end);
 for(let t=.013;t<end;t+=.037){const active=[null,null,null];for(const r of rows)if(!r.clip.gap&&r.start<=t&&r.end>t)active[r.layer]=r;const top=active.filter(Boolean).at(-1);
  for(let k=0;k<2;k++){const r=active[k],visible=!!(r&&top.layer>k&&!active.some(v=>v?.layer>k&&clipAlpha(v,t)>=1&&!transitionState(v,rows,t)));assert.equal(plan.needsLower(k,r?.clip.id,t,1e-8),visible,`Preparation coverage case ${n}, layer ${k}, time ${t}`)}
 }
}
console.log('Preview-plan property checks: 24 overlapping speed/fade/opacity scenes agree with actual composition throughout playback PASS');
// Different from the smooth-overlap cases: empty spans, non-zero source trims,
// still/frozen clips, layer gaps, same-layer overlap and transitions.
for(const type of ['none','dissolve','slide','wipe','circle'])for(const speed of [.2,.5,1,5]){
 const p=project();p.media=[{...m,duration:40}];p.clips=[
  {...clip(p.media[0]),id:'base',layer:0,start:.2,in:2,out:5,speed,endSpeed:speed},
  {...clip(p.media[0]),id:'upper-a',layer:1,start:1,in:1,out:3,transition:{type,duration:.3,direction:'left'}},
  {...clip(p.media[0]),id:'upper-b',layer:1,start:2.5,in:4,out:5,fadeOut:.2},
  {...clip(p.media[0]),id:'frozen',layer:2,start:2,in:0,out:1,freezeAt:.4,freezeDuration:.8,opacity:.7}
 ];
 const rows=sequence(p),end=Math.max(...rows.map(r=>r.end))+.2,plan=compilePreviewPlan(rows,end);
 for(let t=.017;t<end;t+=.043){const active=[null,null,null];for(const r of rows)if(!r.clip.gap&&r.start<=t&&r.end>t)active[r.layer]=r;const top=active.filter(Boolean).at(-1);
  for(let k=0;k<2;k++){const r=active[k],visible=!!(r&&top?.layer>k&&!active.some(v=>v?.layer>k&&clipAlpha(v,t)>=1&&!transitionState(v,rows,t)));assert.equal(plan.needsLower(k,r?.clip.id,t,1e-8),visible,`${type}, speed ${speed}, layer ${k}, at ${t}`)}
 }
}
assert.equal(compilePreviewPlan([],4).next(0),null,'Audio/text-only project has no decoder target');
assert.equal(compilePreviewPlan([],4).needsLower(0,'missing',0),false);
console.log('Preview-plan edge cases: gaps, source trims, extreme speeds, freeze, same-layer overlaps, all transitions and no video PASS');
