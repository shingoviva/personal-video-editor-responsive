import assert from 'node:assert/strict';
import {panelWidths} from '../dist/panel-splitter.js';

assert.deepEqual(panelWidths(260,0,1200),{media:260,inspector:690});
assert.equal(panelWidths(20,0,900).media,150);
assert.equal(panelWidths(890,0,900).inspector,230);
console.log('Workspace column splitters: desktop width constraints PASS');
