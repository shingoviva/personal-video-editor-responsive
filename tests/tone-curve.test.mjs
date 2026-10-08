import assert from 'node:assert/strict';
import {CURVE_IDENTITY,normalizeCurve,curveAt,curveColor,curveLUT,MAX_CURVE_POINTS} from '../dist/tone-curve.js';
import {colors,clip,project,sanitize} from '../dist/model.js';

assert.deepEqual(normalizeCurve(),CURVE_IDENTITY);
const custom=[[0,0],[.18,.08],[.43,.62],[.71,.79],[1,1]];
for(const point of custom)assert(Math.abs(curveAt(custom,point[0])-point[1])<1e-12,'curve passes through every point');
for(let x=0;x<=1;x+=.002){const y=curveAt(custom,x);assert(y>=0&&y<=1,'smooth curve does not overshoot')}
assert(Math.abs(curveAt(custom,.43-.0001)-curveAt(custom,.43+.0001))<.001,'curve is continuous around control points');
assert.deepEqual(normalizeCurve([0,.1,.5,.9,1]),[[0,0],[.25,.1],[.5,.5],[.75,.9],[1,1]],'legacy fixed points migrate');
assert.deepEqual(normalizeCurve([[-1,.3],[.4,.7],[2,.8]]),[[0,.3],[.4,.7],[1,.8]]);
assert.equal(normalizeCurve(Array.from({length:30},(_,i)=>[i/29,i/29])).length,MAX_CURVE_POINTS);
const bypass=curveColor({curveMaster:custom},0).curveMaster;for(let x=0;x<=1;x+=.05)assert(Math.abs(curveAt(bypass,x)-x)<1e-12);
assert.deepEqual(curveColor({curveMaster:custom},1).curveMaster,custom);
assert.equal(curveLUT({curveMaster:custom},1,64).length,256);
const media={id:'m',kind:'video',duration:2},p=project();p.media=[media];p.clips=[clip(media)];delete p.clips[0].color.curveBlue;p.clips[0].color.curveMaster=[-.5,.2,.55,1.5];
const restored=sanitize(JSON.parse(JSON.stringify(p))).clips[0].color;
assert.deepEqual(restored.curveMaster,[[0,0],[1/3,.2],[2/3,.55],[1,1]]);assert.deepEqual(restored.curveBlue,CURVE_IDENTITY);assert.equal(colors().brilliance,0);assert.equal(colors().noiseReduction,0);
console.log('Tone curve: arbitrary points, smooth interpolation, LUT, clamping and legacy migration PASS');
