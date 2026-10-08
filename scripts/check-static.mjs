import fs from 'node:fs';import path from 'node:path';import{execFileSync}from'node:child_process';
const root=path.resolve('dist');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const [,ref]of html.matchAll(/(?:src|href)="([^"]+)"/g)){if(ref==='./'||/^(https?:|#)/.test(ref))continue;const file=ref.split(/[?#]/)[0];if(!fs.existsSync(path.join(root,file)))throw Error('Missing asset: '+ref)}
for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.js'))){execFileSync(process.execPath,['--check',path.join(root,name)]);for(const [,ref]of fs.readFileSync(path.join(root,name),'utf8').matchAll(/from\s*['"](\.\/[^'"]+)['"]/g))if(!fs.existsSync(path.join(root,ref)))throw Error('Missing module: '+ref)}
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');if(/(?<!\$)\$\([^;\n]*?\)\.forEach/.test(app))throw Error('Single-element selector used as a collection');
const workflowGroups=[...html.matchAll(/class="[^"]*workflow-group[^"]*"/g)];if(workflowGroups.length!==5)throw Error('Workspace navigation must keep five functional groups');
for(const label of ['MEDIA','VIDEO','GRAPHICS','AUDIO','ASSIST','BASIC','COLOR','履歴','クリップ','範囲'])if(!html.includes(label))throw Error('Missing workspace label: '+label);
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);if(new Set(ids).size!==ids.length)throw Error('Duplicate HTML id found');
console.log('Static assets, JavaScript entrypoints and workflow structure verified.');
