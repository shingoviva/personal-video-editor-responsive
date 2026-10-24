import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sanitize,project} from '../dist/model.js?v=2.2.85';
const source=fs.readFileSync(new URL('../dist/app.js?v=2.2.85',import.meta.url),'utf8');
const fn=source.split('\n').find(line=>line.startsWith('async function loadProject('));
for(const invalid of [{version:999,media:[],clips:[]},{...project(),media:[],clips:[{media:'missing',in:0,out:1}]}]){
 const current=project(),files=new Map([['m',{name:'original.mov'}]]),urls=new Map([['m','blob:current']]);let paused=0,revoked=0;
 const ctx={sanitize,P:current,localFiles:files,urls,pause:()=>paused++,URL:{revokeObjectURL:()=>revoked++}};
 vm.createContext(ctx);vm.runInContext(fn,ctx);
 await assert.rejects(ctx.loadProject(invalid));
 assert.equal(ctx.P,current);assert.equal(files.size,1);assert.equal(urls.get('m'),'blob:current');assert.equal(paused,0);assert.equal(revoked,0);
}
console.log('Invalid project is rejected before playback, files or URLs are changed PASS');
