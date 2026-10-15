import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createMediaResourceCache} from '../dist/media-resource-cache.js';
import {StillPreview} from '../dist/image-media.js';
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const section=(start,end)=>{const i=app.indexOf(start),j=app.indexOf(end,i+start.length);assert(i>=0&&j>i,start);return app.slice(i,j)};
const line=start=>app.split('\n').find(l=>l.startsWith(start));
const project=(...ids)=>({media:ids.map(id=>({id})),clips:[],effects:[],texts:[],name:'Resource test'});
const files=new Map(),urls=new Map(),thumbs=new Map(),placements=new Map(),revoked=[];
const resources=createMediaResourceCache({files,urls,thumbs,placements,revoke:url=>revoked.push(url)});
function add(id,url='blob:'+id){files.set(id,{name:id});urls.set(id,url);thumbs.set(id,'thumb');placements.set(id,0)}
add('old');const old=JSON.stringify(project('old')),empty=JSON.stringify(project());
resources.remember(old,project('old'));assert.deepEqual(resources.prune(project(),[old],[]),[]);assert(files.has('old'),'Undo must keep file');
assert.deepEqual(resources.prune(project(),[],[old]),[]);assert(files.has('old'),'Redo must keep file');
assert.deepEqual(resources.prune(project('old'),[],[]),[]);assert(files.has('old'),'restored project must keep file');
assert.deepEqual(resources.prune(project(),[empty],[]),['old']);assert(!files.has('old'));assert(!urls.has('old'));assert(!thumbs.has('old'));assert(!placements.has('old'));assert.deepEqual(revoked,['blob:old']);
resources.prune(project(),[],[]);assert.equal(revoked.length,1,'do not revoke twice');
add('keep','blob:shared');add('gone','blob:shared');resources.prune(project('keep'),[],[]);assert(!revoked.includes('blob:shared'),'a live alias owns shared URL');resources.prune(project(),[],[]);assert.equal(revoked.filter(v=>v==='blob:shared').length,1);
add('invalid-history');assert.deepEqual(resources.prune(project(),['invalid JSON'],[]),[]);assert(files.has('invalid-history'),'uncertain history must fail closed');resources.prune(project(),[],[]);
add('remote','http://127.0.0.1/media/native');resources.prune(project(),[],[]);assert(!revoked.includes('http://127.0.0.1/media/native'),'do not revoke native URLs');
// Exercise the actual checkpoint order. Old redo can still be restored by a
// cancelled gesture; pruning must inspect it before clearing future.
const h={P:project(),history:[],future:[old],busy:false,mediaResourceCache:resources,serial(){return JSON.stringify(this.P)}};h.serial=()=>JSON.stringify(h.P);
add('old');vm.createContext(h);vm.runInContext(line('function checkpoint(){'),h);h.checkpoint();assert(files.has('old'));h.future=[old];h.checkpoint();assert(files.has('old'));h.checkpoint();assert(!files.has('old'),'abandoned redo can be released on the next edit');
add('importing');h.busy=true;h.checkpoint();assert(files.has('importing'),'pending import thumbnail/file cannot be pruned');h.busy=false;h.checkpoint();assert(!files.has('importing'));
add('aged');h.P=project('aged');h.checkpoint();h.P=project();for(let i=0;i<60;i++)h.checkpoint();assert(!files.has('aged'),'expired Undo references are released');
console.log('Media references: current project, Undo/Redo, gesture cancellation, expired history, importing, shared URLs and native media safety PASS');

const counts={picture:0,lower:0,transition:0,look:0,audio:0,abort:0,bitmap:0,load:0};
const nodes=new Map(),$=key=>{if(!nodes.has(key))nodes.set(key,{hidden:false,style:{},replaceChildren(){},textContent:''});return nodes.get(key)};
function voice(){return{src:'blob:old',dataset:{url:'blob:old',key:'old'},pause(){},removeAttribute(name){if(name==='src')this.src=''},load(){counts.load++}}}
globalThis.createImageBitmap=async()=>({width:1280,height:720,close(){counts.bitmap++}});
const still=new StillPreview();await still.load('old',async()=>({}),{width:1280,height:720});
const p=project();const sc={P:p,$,video:voice(),standbyVideo:voice(),painter:{black(){},release(){counts.picture++}},lowerPreviews:[{clear(){counts.lower++}}],transitionPreview:{clear(){counts.transition++}},stillPreview:still,lookThumbPainter:{dispose(){counts.look++}},lookThumbCanvas:{width:144,height:90},loadController:{abort(){counts.abort++}},loadGeneration:1,loadPromise:Promise.resolve(),activeMedia:'old',activeVideoKey:'old',loadedURL:'blob:old',textPreview:{clear(){},update(){}},emptyPictureReleased:false,duration:()=>0,previewRow:()=>null,paintRegionZoom(){},playing:false,tab:'import',selected:null,fxMarkup:'',audioPreview:{dispose(){counts.audio++},sync(){}}};
vm.createContext(sc);vm.runInContext(line('function releaseLookThumbnails(')+';'+line('function releasePictureResources(')+';'+section('function paintPreview(){','for(const sourceVideo of [video,standbyVideo])'),sc);
sc.paintPreview();const afterFirst={...counts};for(let i=0;i<120;i++)sc.paintPreview();assert.deepEqual(counts,afterFirst,'empty frames must not re-release GPU/decoder resources');
assert.equal(counts.bitmap,1);assert.equal(counts.look,1);assert.equal(counts.abort,1);assert.equal(sc.video.src,'');assert.equal(sc.standbyVideo.src,'');assert.equal(sc.lookThumbPainter,null);assert.equal(sc.loadGeneration,2);assert.equal(counts.audio,0,'picture cleanup cannot dispose audio-only playback');
// Make a fresh restored image row. Real StillPreview creates a new bitmap and
// actual syncVideo requests a paint when the asynchronous decode finishes.
const row={clip:{id:'restored',media:'m'},start:0,duration:2};sc.previewRow=()=>row;sc.mediaOf=()=>({id:'m',kind:'image',width:1280,height:720});sc.linkURL=()=> 'restored';sc.localFiles=new Map([['m',{}]]);sc.time=0;sc.previewMemoryReleased=false;sc.toast=message=>{throw Error(message)};
let repaint=0;sc.draw=()=>repaint++;vm.runInContext(section('async function syncVideo(','function localSpeed('),sc);assert.equal(await sc.syncVideo(true),true);assert.equal(repaint,1);assert(still.bitmap);assert.equal(await sc.syncVideo(true),true);assert.equal(repaint,1,'reusing a bitmap must not add repaint work');
sc.P.clips=[];sc.previewRow=()=>null;sc.paintPreview();assert.equal(counts.picture,2,'restored pictures are released again after deletion');assert.equal(counts.bitmap,2);sc.previewRow=()=>row;
// A late decode for a deleted clip must not paint or become a valid playback.
let resolveImage;still.clear();sc.stillPreview={bitmap:null,load:()=>new Promise(resolve=>resolveImage=resolve)};const pending=sc.syncVideo(true);sc.previewRow=()=>null;resolveImage({});assert.equal(await pending,false);assert.equal(repaint,1);
// Audio/FX-only projects may still draw their overlays; repeated picture cleanup is inert.
sc.stillPreview=still;sc.P=project();sc.P.audioClips=[{id:'audio'}];sc.duration=()=>3;sc.previewRow=()=>null;sc.fit=()=>{};sc.visibleVideoRows=()=>[];sc.sequence=()=>[];sc.playbackRows=null;sc.transitionState=()=>null;sc.applyTransitionStyles=()=>{};sc.canvas={style:{}};sc.time=1;sc.pictureAspect=()=> '16:9';sc.transitionPreview.clear=()=>{};sc.lowerPreviews=[{clear(){}},{clear(){}}];sc.paintPreview();assert.equal(counts.audio,0);
// Tab exit is wired independently from manual release, and manual release owns LOOK too.
assert.match(app,/function renderInspector\(\)\{if\(tab!=='look'\)releaseLookThumbnails\(\)/);
sc.lookThumbPainter={dispose(){counts.look++}};sc.lookThumbCanvas={width:144,height:90};sc.releaseLookThumbnails();sc.releaseLookThumbnails();assert.equal(counts.look,2,'LOOK disposal is idempotent and can be recreated');
delete globalThis.createImageBitmap;
console.log('Picture lifecycle: last deletion, 120 idle frames, decoder abort, bitmap/LOOK recreation, stale image rejection and audio-only preservation PASS');
