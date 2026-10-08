import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');

assert.match(css,/--control-standard:34px/);
assert.match(css,/\.media-panel>\.panel-title,\.viewer-top,\.inspector>\.panel-title\{height:44px/);
assert.match(css,/\.transform-guides:not\(\[hidden\]\).*border:1px solid/);
assert.match(css,/\.stage-scale-handle::after\{content:'SIZE'/);
assert.match(css,/\.picture:hover \.transform-guides:not\(\[hidden\]\),\.transform-guides\.is-active/);
assert.match(css,/--timeline-overlay-lane:52px/);
assert.match(css,/--timeline-audio-lane:44px/);
assert.match(css,/dialog:has\(\.help-intro\).*820px/);
assert.match(app,/画面の見方/);
assert.match(app,/プレビューの直接操作/);
assert.match(app,/keyboard-sections/);
assert.match(html,/style\.css\?v=2\.2\.26/);
assert.match(html,/app\.js\?v=2\.2\.26/);
console.log('UI polish: aligned lanes, contextual resize affordance and structured help PASS');
