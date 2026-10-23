import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {movieName,movieURL} from '../dist/device-save.js?v=2.2.84';
const names=['東京プロモーション','My film','Film.mp4','Film.MOV','  海辺の撮影  ','','A/B:C\r\nTest','e\u0301tude','名'.repeat(90)];
for(const ext of ['mp4','mov']){
 const native=JSON.parse(execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,'engine');from core import export_file_name;v=json.load(sys.stdin);print(json.dumps([export_file_name({'name':n},v['ext']) for n in v['names']]))"],{input:JSON.stringify({names,ext}),encoding:'utf8'}));
 assert.deepEqual(names.map(n=>movieName(n,ext)),native,'Mac and browser names match');
}
assert.equal(movieName('日本語プロジェクト.mp4','mp4'),'日本語プロジェクト.mp4');
assert.equal(movieName('日本語プロジェクト.mp4','mov'),'日本語プロジェクト.mov');
assert.equal(movieName('  ','mp4'),'Untitled film.mp4');
const media=new URL(movieURL('/exports/internal-id.mp4?existing=ok&filename=old&download=1','東京プロモーション','mp4',{base:'http://127.0.0.1:8765/'}));
assert.equal(media.pathname,'/exports/internal-id.mp4');assert.equal(media.searchParams.get('filename'),'東京プロモーション.mp4');assert.equal(media.searchParams.getAll('filename').length,1);assert.equal(media.searchParams.get('existing'),'ok');assert.equal(media.searchParams.has('download'),false);
const download=new URL(movieURL(media.href,'東京プロモーション','mp4',{download:true}));assert.equal(download.searchParams.get('download'),'1');
const app=readFileSync(new URL('../dist/app.js?v=2.2.84',import.meta.url),'utf8');assert.match(app,/id="exportFileName"[^>]*value="\$\{esc\(P\.name\|\|'Untitled film'\)\}"/);assert.match(app,/href="\$\{esc\(downloadURL\)\}"/);assert.match(app,/src="\$\{esc\(mediaURL\)\}"/);
const mobile=readFileSync(new URL('../dist/mobile-export.js?v=2.2.84',import.meta.url),'utf8');assert.match(mobile,/new File\(\[result\.file\],movieName\(name,'mp4'\)/);
console.log('Movie names: project default, Unicode, extensions, Mac/browser parity, internal IDs and download links PASS');
