import assert from 'node:assert/strict';
import {project,clip,sanitize} from '../dist/model.js';
import {effectAlpha} from '../dist/creative.js';
import {sequentialCaptions,youtubeProgramPlan,applyYoutubeProgram} from '../dist/program-workflow.js';
import {captionPresets} from '../dist/caption-presets.js';
import {clampTimelineHeight,timelineRatio} from '../dist/workspace-splitter.js';

const ids=['a','b','c'];
const captions=sequentialCaptions('最初のセリフ\n\n次のセリフ\n強調',{start:2,duration:1.5,gap:.1,limit:8,id:()=>ids.shift(),style:captionPresets.varietyYellow.style});
assert.deepEqual(captions.map(value=>[value.id,value.text,value.start,value.end]),[['a','最初のセリフ',2,3.5],['b','次のセリフ',3.6,5.1],['c','強調',5.199999999999999,6.699999999999999]]);
assert.equal(captions[0].outline,7);assert.equal(captions[0].color,'#ffe64d');

const plan=youtubeProgramPlan(10,{title:'番組タイトル',hold:1.5,fade:1,outro:2});
const intro=plan.effects[0],outro=plan.effects[1];
assert.equal(effectAlpha(intro,.5),1);assert.equal(effectAlpha(intro,1.5),1);assert(Math.abs(effectAlpha(intro,2)-.5)<1e-9);assert.equal(effectAlpha(intro,2.5),0);
assert.equal(effectAlpha(outro,8),0);assert(effectAlpha(outro,9)>.5);assert.equal(effectAlpha(outro,9.9),1);
assert.equal(plan.text.text,'番組タイトル');assert.equal(plan.aspect,'16:9');assert.equal(plan.export.preset,'YOUTUBE');

const p=project(),media={id:'v',name:'video',kind:'video',duration:10};p.media=[media];p.clips=[clip(media)];const applied=applyYoutubeProgram(p,{title:'TEST'});
assert.equal(p.aspect,'16:9');assert.equal(p.effects.length,2);assert.equal(p.texts.length,1);assert.equal(applied.text.text,'TEST');
const restored=sanitize(JSON.parse(JSON.stringify(p)));assert.equal(restored.effects[0].hold,1.6);assert(restored.effects[1].hold>0);

assert.equal(clampTimelineHeight(50,800),190);assert.equal(clampTimelineHeight(900,800),610);assert(Math.abs(timelineRatio(500,100,900)-.5)<1e-9);
console.log('YouTube program flow: black hold/fades, sequential variety captions and workspace splitter PASS');
