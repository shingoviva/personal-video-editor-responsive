import assert from 'node:assert/strict';
const root=new URL('../dist/',import.meta.url).href;
const {project,clip,timing}=await import(root+'model.js');
const {rippleTrimToPlayhead}=await import(root+'timeline-shortcuts.js');
const {detachAudio}=await import(root+'audio-timeline.js');
const p=project(),media={id:'m',kind:'video',duration:8,audio:true};p.media=[media];
const one={...clip(media),id:'one',start:0,out:4},two={...clip(media),id:'two',start:4,in:4,out:8};p.clips=[one,two];const linked=detachAudio(p,'two',0);rippleTrimToPlayhead(p,'one','out',3);
assert.equal(two.start,3);assert.equal(linked.start,3);
const {referencedMediaIds,saveBrowserProject,saveFolderProject}=await import(root+'project-storage.js');
globalThis.indexedDB={open(){const r={error:Error('read failed')};queueMicrotask(()=>r.onerror());return r}};
await assert.rejects(referencedMediaIds(),/read failed/);
let opens=0,closes=0;globalThis.indexedDB={open(){opens++;const r={};queueMicrotask(()=>{r.result={close(){closes++},transaction(){return {objectStore(){return {put(){}}},set oncomplete(fn){queueMicrotask(fn)},set onerror(fn){},set onabort(fn){}}}};r.onsuccess()});return r}};
for(let n=0;n<5;n++)await saveBrowserProject({...p,name:'save '+n});assert.equal(opens,5);assert.equal(closes,5);
// A failing read must never turn into an empty reference set; close on error too.
let failedReadCloses=0;
globalThis.indexedDB={open(){const request={};queueMicrotask(()=>{request.result={close(){failedReadCloses++},transaction(){const tx={objectStore(){return {getAll(){const read={error:Error('getAll failed')};queueMicrotask(()=>{read.onerror();tx.error=read.error;tx.onerror()});return read}}}};return tx}};request.onsuccess()});return request}};
await assert.rejects(referencedMediaIds(),/getAll failed/);assert.equal(failedReadCloses,1);
let blockedRequest,lateCloses=0;
globalThis.indexedDB={open(){blockedRequest={};queueMicrotask(()=>blockedRequest.onblocked());return blockedRequest}};
await assert.rejects(saveBrowserProject(p),/他の画面/);blockedRequest.result={close(){lateCloses++}};blockedRequest.onsuccess();assert.equal(lateCloses,1);
// Restore successful DB transactions for the folder-save tests.
globalThis.indexedDB={open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){return {objectStore(){return {put(){}}},set oncomplete(fn){queueMicrotask(fn)}}}};request.onsuccess()});return request}};
let releaseOld,oldStarted;const blocked=new Promise(r=>oldStarted=r),unblock=new Promise(r=>releaseOld=r);const saved=new Map();
const directory={async queryPermission(){return 'granted'},async getDirectoryHandle(){return this},async getFileHandle(name){return {async createWritable(){let text;return {async write(value){text=value;if(name==='Latest.project'&&JSON.parse(value).name==='old'){oldStarted();await unblock}},async close(){saved.set(name,text)},async abort(){}}}}}};
const oldSave=saveFolderProject({...p,name:'old'},directory);await blocked;const nextProject={...p,name:'new'};const newSave=saveFolderProject(nextProject,directory);nextProject.name='mutated after save';releaseOld();await Promise.all([oldSave,newSave]);assert.equal(JSON.parse(saved.get('Project.pve')).name,'new');assert.equal(JSON.parse(saved.get('Latest.project')).name,'new');
// A failed save must not block a later save for the same project.
const denied={...directory,async queryPermission(){return 'denied'}};
await assert.rejects(saveFolderProject({...p,name:'failed'},denied),/アクセス/);
await saveFolderProject({...p,name:'recovered'},directory);assert.equal(JSON.parse(saved.get('Project.pve')).name,'recovered');
const {LayerPreview}=await import(root+'layer-preview.js');
let video;globalThis.document={body:{dataset:{ui:'desktop'}},createElement(){const events=new Map();return video={paused:true,readyState:0,currentTime:0,ended:false,plays:0,addEventListener(name,fn){events.set(name,fn)},removeEventListener(name){events.delete(name)},load(){},pause(){this.paused=true},play(){this.plays++;this.paused=false;return Promise.resolve()},removeAttribute(){},getAttribute(){return this.src},metadata(){this.readyState=2;events.get('loadedmetadata')?.()}}}};
const layer=new LayerPreview({style:{},getContext(){return null}});const row={clip:clip(media),start:0,end:8,duration:8};const load=layer.update(row,.2,media,'test.mp4',null,'Original',false,true);layer.pause();video.metadata();await load;assert.equal(video.plays,0);assert.equal(video.paused,true);layer.dispose();
// Clear during decoding also cancels playback. A fresh update remains usable.
const cleared=new LayerPreview({style:{},getContext(){return null}});
const clearLoad=cleared.update(row,.2,media,'clear.mp4',null,'Original',false,true);cleared.clear();await clearLoad;assert.equal(video.plays,0);assert.equal(cleared.state,null);
const fresh=cleared.update(row,.2,media,'fresh.mp4',null,'Original',false,true);video.metadata();await fresh;assert.equal(video.plays,1);cleared.pause();assert.equal(video.paused,true);cleared.dispose();delete globalThis.document;
const {bindTimeline}=await import(root+'timeline-gestures.js');
const main={...clip(media),id:'main',start:0,layer:0},comp={...clip(media),id:'comp',start:8,layer:0};const rows=[{clip:main,layer:0,start:0,end:8,duration:8},{clip:comp,layer:0,start:8,end:16,duration:8}];
const elements=rows.map(row=>({dataset:{clip:row.clip.id},style:{},classList:{add(){},remove(){}},setPointerCapture(){},getBoundingClientRect(){return {left:0}},clientWidth:80}));
const surface={getBoundingClientRect(){return {width:160}},querySelectorAll(){return elements}};
globalThis.document={body:{dataset:{ui:'desktop'}},getElementById(id){return {getBoundingClientRect(){return {top:id==='videoTrack'?500:id==='videoTrackUpper'?300:100}}}}};
bindTimeline({root:surface,timelineRoot:surface,rows,duration:16,select(){},begin(){},finish(){},cancel(){},preview(){},media(){return media},snap(){return false},getLayer(){return 1},groupRows(){return rows}});
elements[0].onpointerdown({button:0,clientX:0,clientY:500,pointerId:1,target:{closest(){return null}}});elements[0].onpointermove({clientX:10,clientY:300});assert.equal(elements[0].style.top,'-200px');assert.equal(elements[1].style.top,'-200px');
// Audio lanes use their actual, independently resized heights too.
main.kind=comp.kind='audio';main.layer=comp.layer=0;
globalThis.document.getElementById=id=>({getBoundingClientRect(){return {top:id==='audioTrack0'?500:680}}});
elements[0].onpointerdown({button:0,clientX:0,clientY:500,pointerId:2,target:{closest(){return null}}});elements[0].onpointermove({clientX:10,clientY:680});assert.equal(elements[0].style.top,'180px');assert.equal(elements[1].style.top,'180px');delete globalThis.document;
const {sourceOffset,trimClip}=await import(root+'model.js');const curveProject=project();curveProject.media=[media];const curved={...clip(media),id:'curve',speed:.5,endSpeed:4,curve:'ease-in-out',start:0};curveProject.clips=[curved];const before=timing(curved).duration,cut=before/2,expected=structuredClone(curved);trimClip(expected,'out',sourceOffset(cut,curved),8);rippleTrimToPlayhead(curveProject,'curve','out',cut);assert(Math.abs(timing(curved).duration-cut)<.0001);assert.deepEqual(curved.timingBase,expected.timingBase);
// IN and OUT must share normal trim semantics, including gain envelopes.
for(const edge of ['in','out']){
 const p=project();p.media=[media];const c={...clip(media),id:'curve-'+edge,start:0,speed:.5,endSpeed:4,curve:'ease-in-out'};
 const span=timing(c).duration;c.audio.gainEnvelope=[{time:0,gain:0},{time:span/2,gain:1},{time:span,gain:.5}];p.clips=[c];
 const reference=structuredClone(c),at=span/2;trimClip(reference,edge,c.in+sourceOffset(at,c),media.duration);
 const linked=detachAudio(p,c.id,0);rippleTrimToPlayhead(p,c.id,edge,at);
 assert.equal(timing(c).duration,timing(reference).duration);assert.deepEqual(c.audio.gainEnvelope,reference.audio.gainEnvelope);
 assert.equal(timing(linked).duration,timing(c).duration);assert.equal(linked.start,c.start);
}


console.log('Audit regression: protected cleanup, linked ripple, speed curve, ordered snapshot saves, closed DB, pause cancellation and variable lanes PASS');
