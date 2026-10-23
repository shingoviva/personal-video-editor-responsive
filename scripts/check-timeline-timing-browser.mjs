// Synthetic projects in isolated browser contexts; actual controls and pointer events.
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {project,clip} from '../dist/model.js?v=2.2.84';import {EDIT_RATES,normalizeTimelineRate,editingFrameTime,quantizeTimelineTime} from '../dist/timeline-time.js?v=2.2.84';
const[base,out]=process.argv.slice(2);await fs.mkdir(out,{recursive:true});const pw=await import(pathToFileURL(process.env.PVE_PLAYWRIGHT_MODULE)),reports=[];
for(const name of ['chromium','webkit']){
 const browser=await pw[name].launch(name==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1600,height:1100}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const app=await fs.readFile(new URL('../dist/app.js?v=2.2.84',import.meta.url),'utf8');await page.route('**/app.js*',r=>r.fulfill({contentType:'text/javascript',body:app+`\nwindow.__b4={get:()=>structuredClone(P),clock:()=>time,seek:t=>seek(t),extent:()=>timelineExtent(),choose:(id,t)=>{selected=id;selectedAudio=null;selectedText=null;selectedEffect=null;time=t;tab='cut';render()}};`}));
  const m={id:'b4-media',kind:'video',name:'B4 synthetic.mov',duration:12,width:1920,height:1080,fps:25,audio:true},p=project(),c={...clip(m),id:'b4-clip',in:2,out:5,start:1};p.media=[m];p.clips=[c];p.audioClips=[{...clip(m),id:'b4-audio',kind:'audio',in:0,out:2,start:6,layer:0}];p.texts=[{id:'b4-text',start:2,end:3,text:'B4',layer:0}];p.effects=[{id:'b4-fx',type:'flash',start:4,duration:.5,strength:.5,layer:1}];p.export.fps='50';
  await page.addInitScript(p=>{sessionStorage.setItem('pve.iphone.project-launcher-seen','1');localStorage.setItem('pve.iphone.autosave.v1',JSON.stringify(p))},p);
  await page.goto(new URL('dist/',base).href,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__b4);
  const get=()=>page.evaluate(()=>window.__b4.get());let max=0,worst=null,pointerCoordinateMaxSeconds=0;const rows=[];
  function close(a,b,info){const e=Math.abs(a-b);if(e>max){max=e;worst={...info,actual:a,expected:b}}if(e>1e-8)throw Error(JSON.stringify({...info,a,b,e}))}
  async function drag(selector,edge,delta){
   const locator=page.locator(selector);await locator.scrollIntoViewIfNeeded();const rect=await locator.boundingBox();const geom=await page.evaluate(()=>({width:document.querySelector('#timelineContent').getBoundingClientRect().width,extent:window.__b4.extent()}));
   let box=rect;if(edge)box=await locator.locator(`[data-${selector.includes('clip=')?'edge':'overlay-edge'}="${edge}"]`).boundingBox();if(!box)throw Error('missing handle '+selector+' '+edge);
   const x=box.x+box.width/2,y=box.y+5;
   await page.evaluate(()=>{window.__b4Pointer=[];document.addEventListener('pointermove',e=>window.__b4Pointer.push(e.clientX),{capture:true})});
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+delta*geom.width/geom.extent,y,{steps:3});await page.mouse.up();
   const xs=await page.evaluate(()=>window.__b4Pointer),actual=(xs.at(-1)-xs[0])*geom.extent/geom.width;pointerCoordinateMaxSeconds=Math.max(pointerCoordinateMaxSeconds,Math.abs(actual-delta));return{delta:actual,geom};
  }
  for(const[rate,label]of EDIT_RATES){
   const rateBefore=await get();await page.locator('#timelineRate').selectOption(rate);const stored=await get();await page.locator('#topUndo').click();if(JSON.stringify(await get())!==JSON.stringify(rateBefore))throw Error('rate Undo');await page.locator('#topRedo').click();if(JSON.stringify(await get())!==JSON.stringify(stored))throw Error('rate Redo');if(JSON.stringify(stored.timelineRate)!==JSON.stringify(normalizeTimelineRate(rate)))throw Error('rate not saved');if(stored.export.fps!=='50'||stored.media[0].fps!==25)throw Error('fps coupled');
   for(const enabled of [false,true]){
    if(await page.locator('#snapToggle').getAttribute('aria-pressed')!==String(enabled))await page.locator('#snapToggle').click();
    for(const[kind,selector]of [['video','[data-clip="b4-clip"]'],['audio','[data-clip="b4-audio"]'],['text','[data-text-chip="b4-text"]'],['fx','[data-fx="b4-fx"]']]){
     await page.evaluate(()=>window.__b4.choose('b4-clip',0));const before=await get(),item=kind==='video'?before.clips[0]:kind==='audio'?before.audioClips[0]:kind==='text'?before.texts[0]:before.effects[0];
     const move=await drag(selector,null,.2137),after=await get(),changed=kind==='video'?after.clips[0]:kind==='audio'?after.audioClips[0]:kind==='text'?after.texts[0]:after.effects[0];
     const raw=item.start+move.delta,expected=enabled&&kind!=='audio'?quantizeTimelineTime(raw,rate):raw;
     close(changed.start,expected,{rate,enabled,kind,operation:'native pointer move'});
     await page.locator('#topUndo').click();if(JSON.stringify(await get())!==JSON.stringify(before))throw Error('gesture undo '+kind);
     await page.locator('#topRedo').click();if(JSON.stringify(await get())!==JSON.stringify(after))throw Error('gesture redo '+kind);await page.locator('#topUndo').click();
    }
    await page.evaluate(()=>window.__b4.choose('b4-clip',0));const before=await get(),move=await drag('[data-clip="b4-clip"]','out',.2137),after=await get();const raw=4+move.delta,wanted=enabled?quantizeTimelineTime(raw,rate):raw;
    close(after.clips[0].start+after.clips[0].out-after.clips[0].in,wanted,{rate,enabled,operation:'native out trim'});await page.locator('#topUndo').click();if(JSON.stringify(await get())!==JSON.stringify(before))throw Error('trim undo');
   }
   const from=editingFrameTime(35,rate);await page.evaluate(t=>window.__b4.choose('b4-clip',t),from);await page.locator('#nextFrame').click();close(await page.evaluate(()=>window.__b4.clock()),editingFrameTime(36,rate),{rate,operation:'next frame'});await page.locator('#prevFrame').click();close(await page.evaluate(()=>window.__b4.clock()),from,{rate,operation:'previous frame'});
   await page.evaluate(async()=>{window.__b4.choose('b4-clip',9);await window.__b4.seek(9)});await page.locator('#nextFrame').click();const tail=await page.evaluate(()=>window.__b4.clock());if(tail<=9)throw Error('frame step jumped backward from empty tail');
   const cut=1+from;await page.evaluate(t=>window.__b4.choose('b4-clip',t),cut);const before=await get();await page.locator('#split').click();const after=await get();if(after.clips.length!==2)throw Error('split');close(after.clips[1].start,cut,{rate,operation:'split'});await page.locator('#topUndo').click();if(JSON.stringify(await get())!==JSON.stringify(before))throw Error('split undo');await page.locator('#topRedo').click();if(JSON.stringify(await get())!==JSON.stringify(after))throw Error('split redo');
   if(rate===EDIT_RATES.at(-1)[0]){
    const promise=page.waitForEvent('download');await page.locator('#saveProject').click();await page.locator('#modal .download-link').click();const file=path.join(out,name+'-timing.project');await(await promise).saveAs(file);const saved=JSON.parse(await fs.readFile(file,'utf8'));if(JSON.stringify(saved.timelineRate)!==JSON.stringify(after.timelineRate))throw Error('saved rate');await page.locator('#projectPicker').setInputFiles(file);await page.waitForFunction(()=>window.__b4.get().clips.length===2);close((await get()).clips[1].start,cut,{rate,operation:'file load'});
   }else await page.locator('#topUndo').click();
   rows.push({rate,label,nativePointerMoveOnOff:4,nativeVideoTrimOnOff:true,frameButtons:true,splitUndoRedo:true});
  }
  if(errors.length)throw Error(errors.join(';'));reports.push({browser:name,version:browser.version(),rows,maxSeconds:max,worst,saveLoad:true,rateUndoRedo:true,pointerCoordinateMaxSeconds,emptyTailStep:true,errors});console.log(name,'B4 PASS max',max);await context.close();
 }finally{await browser.close();await fs.writeFile(path.join(out,'browser.json'),JSON.stringify(reports,null,2)+'\n')}
}
