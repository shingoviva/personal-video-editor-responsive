import assert from 'node:assert/strict';
import {sanitizeFontRecords,WEB_FONTS} from '../dist/font-library.js';
const records=sanitizeFontRecords([{id:'font-1',family:'PVE Test 1234',label:'Test',name:'test.otf',size:42,type:'file'},null,{id:'x',family:'Local Font',type:'local'}]);
assert.equal(records.length,2);assert.equal(records[0].label,'Test');assert.equal(records[0].type,'file');assert(WEB_FONTS.includes('Noto Sans JP'));assert(WEB_FONTS.includes('BIZ UDPGothic'));assert(WEB_FONTS.includes('RocknRoll One'));
console.log('Font library: bundled web choices and persisted font metadata PASS');
