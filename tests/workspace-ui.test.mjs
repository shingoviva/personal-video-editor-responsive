import assert from 'node:assert/strict';
import {videoTabs,tabMetadata,tabForSelection,inspectorHeading} from '../dist/workspace-ui.js';

assert.deepEqual(videoTabs,['cut','motion','adjust','look']);
assert.equal(tabForSelection('video','text'),'cut');
assert.equal(tabForSelection('video','motion'),'motion');
assert.equal(tabForSelection('text','cut'),'text');
assert.equal(tabForSelection('effect','text'),'fx');
assert.equal(tabForSelection('audio','look'),'sound');
assert.deepEqual(tabMetadata('adjust'),{workspace:'video',scope:'VIDEO',label:'COLOR'});
assert.equal(inspectorHeading('text'),'GRAPHICS · TEXT');
assert.equal(inspectorHeading('unknown'),'MEDIA · LIBRARY');
console.log('V2 workspace: object routing, video submodes and inspector headings PASS');
