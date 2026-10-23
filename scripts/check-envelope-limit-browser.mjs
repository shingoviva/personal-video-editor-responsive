// Disposable synthetic projects; actual application controls and Web Audio.
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {project,clip} from '../dist/model.js?v=2.2.84';
import {denseEnvelope} from '../tests/envelope-limit.test.mjs';
const [base,output]=process.argv.slice(2);await fs.mkdir(output,{recursive:true});
const pw=await import(pathToFileURL(process.env.PVE_PLAYWRIGHT_MODULE)),reports=[];
for(const name of ['chromium','webkit']){
 const browser=await pw[name].launch(name==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const app=await fs.readFile(new URL('../dist/app.js?v=2.2.84',import.meta.url),'utf8');
  await page.route('**/app.js*',r=>r.fulfill({contentType:'text/javascript',body:app+`\nwindow.__b3={get:()=>structuredClone(P),choose:(id,t,sound=false)=>{selected=id;selectedAudio=null;selectedText=null;selectedEffect=null;time=t;tab=sound?'sound':'cut';render()}};`}));
  const media={id:'b3-fixture',name:'B3 synthetic.mov',kind:'video',audio:true,duration:2,fps:30,width:1920,height:1080};
  const p=project();p.name='B3 test';p.media=[media];const c=clip(media);c.id='b3-clip';c.out=1;c.audio.gainEnvelope=denseEnvelope(256);p.clips=[c];
  await page.addInitScript(p=>{sessionStorage.setItem('pve.iphone.project-launcher-seen','1');localStorage.setItem('pve.iphone.autosave.v1',JSON.stringify(p))},p);
  await page.goto(new URL('dist/',base).href,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__b3);
  await page.evaluate(()=>window.__b3.choose('b3-clip',.9989));await page.locator('#split').click();
  const get=()=>page.evaluate(()=>window.__b3.get()),env=p=>p.clips.map(c=>c.audio.gainEnvelope);
  const edited=await get();if(edited.clips.length!==2||env(edited)[0].at(-1).time!==.9989||env(edited)[0].length!==257)throw Error('split boundary lost');
  const state=JSON.stringify(env(edited));await page.locator('#topUndo').click();if((await get()).clips.length!==1)throw Error('Undo');await page.locator('#topRedo').click();if(JSON.stringify(env(await get()))!==state)throw Error('Redo');
  const promise=page.waitForEvent('download');await page.locator('#saveProject').click();await page.locator('#modal .download-link').click();const savedPath=path.join(output,name+'-saved.project');await(await promise).saveAs(savedPath);
  if(JSON.stringify(env(JSON.parse(await fs.readFile(savedPath,'utf8'))))!==state)throw Error('save');await page.locator('#projectPicker').setInputFiles(savedPath);await page.waitForFunction(()=>window.__b3.get().clips.length===2);if(JSON.stringify(env(await get()))!==state)throw Error('load');
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__b3);await page.evaluate(()=>window.__b3.choose('b3-clip',.5));await page.locator('[data-number="out"]').fill('.999');await page.locator('[data-number="out"]').press('Tab');
  const trimmed=await get();if(trimmed.clips[0].out!==.999||trimmed.clips[0].audio.gainEnvelope.at(-1).time!==.999)throw Error('trim boundary');
  await page.locator('#topUndo').click();await page.locator('#topRedo').click();if(JSON.stringify(env(await get()))!==JSON.stringify(env(trimmed)))throw Error('trim redo');
  // Replace only test fixture on a fresh navigation, without touching real user storage.
  const large=structuredClone(p);large.clips[0].out=2;large.clips[0].audio.gainEnvelope=denseEnvelope(1024);
  await page.evaluate(p=>localStorage.setItem('b3-fixture',JSON.stringify(p)),large);
  await page.addInitScript(()=>{const p=localStorage.getItem('b3-fixture');if(p)localStorage.setItem('pve.iphone.autosave.v1',p)});
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__b3);await page.evaluate(()=>window.__b3.choose('b3-clip',1.5,true));
  const set=page.locator('[data-envelope-set="orig"]');await set.waitFor();const before=JSON.stringify(await get()),undo=await page.locator('#topUndo').isDisabled();
  await set.click();if(JSON.stringify(await get())!==before||await page.locator('#topUndo').isDisabled()!==undo)throw Error('rejected addition modified project/history');
  if(!(await page.locator('body').innerText()).includes('1024'))throw Error('missing limit explanation');
  await page.evaluate(t=>window.__b3.choose('b3-clip',t,true),large.clips[0].audio.gainEnvelope[0].time);
  await page.locator('[data-envelope-value="orig"]').fill('-20');await page.locator('[data-envelope-set="orig"]').click();
  const updated=await get();if(updated.clips[0].audio.gainEnvelope.length!==1024||updated.clips[0].audio.gainEnvelope[0].valueDb!==-20)throw Error('existing point update');
  await page.locator('[data-envelope-delete="orig:0"]').click();if((await get()).clips[0].audio.gainEnvelope.length!==1023)throw Error('delete');
  await page.locator('#topUndo').click();if((await get()).clips[0].audio.gainEnvelope.length!==1024)throw Error('delete undo');
  const audio=await page.evaluate(async()=>{
   const {AudioPreview}=await import('./audio-preview.js?v=2.2.84'),e=await import('./clip-envelope.js?v=2.2.84'),{declickGain}=await import('./mobile-model.js?v=2.2.84');const p=window.__b3.get().clips[0].audio.gainEnvelope,rate=48000;
   async function render(reference){const ctx=new OfflineAudioContext(1,4800,rate),source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=ctx.createBuffer(1,rate,rate);source.buffer.getChannelData(0).fill(.25);source.connect(gain);gain.connect(ctx.destination);
    if(reference){const length=.15,count=Math.ceil(length*rate),curve=new Float32Array(count);for(let i=0;i<count;i++){const t=.9+length*i/(count-1);curve[i]=e.envelopeGainAt(t,p)*declickGain(t,2)}gain.gain.setValueCurveAtTime(curve,0,length)}
    else AudioPreview.prototype.scheduleGain.call({context:{currentTime:0}},{output:gain},{audio:{volume:1,fadeIn:0,fadeOut:0,gainKeyframes:[],gainEnvelope:p}},.9,2,1,true);
    source.start(0,.9,.1);return(await ctx.startRendering()).getChannelData(0)}const a=await render(false),b=await render(true);let max=0;for(let i=0;i<a.length;i++)max=Math.max(max,Math.abs(a[i]-b[i]));if(max>1e-7)throw Error('PCM '+max);return{points:p.length,samples:a.length,maxAbsolutePCM:max,tolerance:1e-7};
  });
  if(errors.length)throw Error(errors.join(';'));reports.push({browser:name,version:browser.version(),splitUndoRedo:true,trimUndoRedo:true,saveLoad:true,limitRefusalUnchanged:true,existingUpdateAndDelete:true,audio,errors});console.log(name,'B3 PASS');await context.close();
 }finally{await browser.close();await fs.writeFile(path.join(output,'browser.json'),JSON.stringify(reports,null,2)+'\n')}
}
