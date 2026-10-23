// Current release identities and transitive JS/Worker cache contract. Read-only.
import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';
const root=process.cwd(),pkg=JSON.parse(fs.readFileSync('package.json')),version=pkg.version,lock=JSON.parse(fs.readFileSync('package-lock.json'));
assert.equal(lock.version,version);assert.equal(lock.packages[''].version,version);assert.equal(pkg.dependencies.mediabunny,'1.56.0');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)]);let references=0;
for(const file of walk('dist').filter(p=>/\.(?:m?js|html)$/.test(p))){const source=fs.readFileSync(file,'utf8');assert(!source.includes('2.2.83'),file+' stale release id');
 for(const m of source.matchAll(/(["'])(\.\.?\/[^"'`\s?]+\.m?js)(\?v=[\d.]+)?\1/g)){const target=path.resolve(path.dirname(file),m[2]);if(!fs.existsSync(target))continue;assert.equal(m[3],'?v='+version,file+' '+m[2]);references++;}}
assert(fs.readFileSync('dist/index.html','utf8').includes('style.css?v='+version));assert(fs.readFileSync('engine/core.py','utf8').includes("'build':'"+version+"'"));
for(const file of ['dist/feature-lab.html','dist/lab','tests/feature-lab.test.mjs'])assert(!fs.existsSync(file),file+' must be excluded');assert(!('test:feature-lab'in pkg.scripts));
console.log('Release '+version+': package/lock/UI/engine, dependency pin, '+references+' JS/Worker cache references and held-feature exclusion PASS');
