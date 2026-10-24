// Isolated B2 actual Web Audio PCM and actual app Undo/Redo/save-load controls.
// PVE_PLAYWRIGHT_MODULE=... node scripts/check-envelope-edit-browser.mjs http://127.0.0.1:8876/ output-dir
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {project,clip} from '../dist/model.js?v=2.2.85';
import {envelopeEditCases} from '../tests/fixtures/envelope-edit-cases.mjs';
const [base,output]=process.argv.slice(2);if(!base||!output)throw Error('base URL and output-dir required');await fs.mkdir(output,{recursive:true});
const pw=await import(pathToFileURL(process.env.PVE_PLAYWRIGHT_MODULE)),reports=[];
for(const name of ['chromium','webkit']){
 const browser=await pw[name].launch(name==='chromium'?{channel:'chrome',headless:true}:{headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const audio=await page.evaluate(async()=>{
   const current=await import('/dist/clip-envelope.js'),old=await import('/tests/fixtures/envelope-pre-b2.mjs'),{AudioPreview}=await import('/dist/audio-preview.js'),{declickGain}=await import('/dist/mobile-model.js');
   const points=[{time:0,valueDb:-12,interpolation:'hold'},{time:1,valueDb:0,interpolation:'linear'},{time:2,valueDb:-6,interpolation:'linear'}],rate=48000,begin=.9,span=.2;
   async function render(api,cut,expected=false){
    const ctx=new OfflineAudioContext(2,Math.round(span*rate),rate),buffer=ctx.createBuffer(2,rate*2,rate);let compiles=0;
    for(let c=0;c<2;c++)for(let i=0;i<buffer.length;i++)buffer.getChannelData(c)[i]=.3*Math.sin(2*Math.PI*(440+c*37)*i/rate);
    const parts=cut===null?[{from:0,start:begin,end:begin+span,local:begin,duration:2,points}]:api.splitEnvelope(points,cut,2).map((p,i)=>i?{from:cut,start:cut,end:begin+span,local:0,duration:2-cut,points:p}:{from:0,start:begin,end:cut,local:begin,duration:cut,points:p});
    for(const part of parts){const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.connect(gain);gain.connect(ctx.destination);const at=part.start-begin;
     if(expected){const length=Math.min(.15,Math.max(.001,part.duration-part.local)),count=Math.max(2,Math.ceil(length*48000)),curve=new Float32Array(count);
      for(let i=0;i<count;i++){const local=part.local+length*i/(count-1);curve[i]=old.envelopeGainAt(part.from+local,points)*declickGain(local,part.duration)}gain.gain.setValueCurveAtTime(curve,at,length);
     }else{const keys=[];keys.filter=function(...args){compiles++;return Array.prototype.filter.apply(this,args)};AudioPreview.prototype.scheduleGain.call({context:{currentTime:at}},{output:gain},{audio:{volume:1,fadeIn:0,fadeOut:0,gainKeyframes:keys,gainEnvelope:part.points}},part.local,part.duration,1,true)}
     source.start(at,part.start,part.end-part.start);
    }
    return{buffer:await ctx.startRendering(),compiles};
   }
   const diff=(a,b)=>{let max=0,sourceTime=0,different=0;for(let c=0;c<2;c++)for(let i=0;i<a.length;i++){const d=Math.abs(a.getChannelData(c)[i]-b.getChannelData(c)[i]);if(d)different++;if(d>max){max=d;sourceTime=begin+i/rate}}return{max,samples:a.length*2,different,sourceTime}};
   const rows=[];
   for(const cut of [.994,.9975,.998,1,.997503]){
    const reference=await render(current,cut,true),before=await render(old,cut),after=await render(current,cut),control=await render(current,null);
    const fixed=diff(after.buffer,reference.buffer),broken=diff(before.buffer,reference.buffer),raw=diff(after.buffer,control.buffer);
    if(fixed.max>1e-7||after.compiles!==2)throw Error('Web Audio PCM or compile count regression');rows.push({cut,before:broken,after:fixed,rawOriginalWithExistingDeclick:raw,compilations:after.compiles});
   }
   return{rate,channels:2,tolerance:1e-7,rows};
  });
  const app=await fs.readFile(new URL('../dist/app.js?v=2.2.85',import.meta.url),'utf8');
  await page.route('**/app.js*',r=>r.fulfill({contentType:'text/javascript',body:app+`\nwindow.__b2={get:()=>structuredClone(P),choose:(id,t)=>{selected=id;selectedAudio=null;selectedText=null;selectedEffect=null;time=t;tab='cut';render()}};`}));
  const media={id:'b2-fixture',name:'B2 synthetic.mov',kind:'video',audio:true,duration:2,fps:30,width:1920,height:1080};
  const p=project();p.name='B2 test';p.media=[media];const c=clip(media);c.id='b2-clip';c.audio.gainEnvelope=envelopeEditCases[0].points;p.clips=[c];
  await page.addInitScript(p=>{sessionStorage.setItem('pve.iphone.project-launcher-seen','1');localStorage.setItem('pve.iphone.autosave.v1',JSON.stringify(p))},p);
  await page.goto(new URL('dist/',base).href,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__b2);
  await page.evaluate(()=>window.__b2.choose('b2-clip',.998));await page.locator('#split').click();
  const edited=await page.evaluate(()=>window.__b2.get());if(edited.clips.length!==2)throw Error('split control failed');
  const envelopes=p=>p.clips.map(c=>c.audio.gainEnvelope),splitState=JSON.stringify(envelopes(edited));
  await page.locator('#topUndo').click();if((await page.evaluate(()=>window.__b2.get())).clips.length!==1)throw Error('Undo failed');
  await page.locator('#topRedo').click();if(JSON.stringify(envelopes(await page.evaluate(()=>window.__b2.get())))!==splitState)throw Error('Redo lost envelope');
  const downloadPromise=page.waitForEvent('download');await page.locator('#saveProject').click();await page.locator('#modal .download-link').click();const download=await downloadPromise;
  const savedPath=path.join(output,name+'-saved.project');await download.saveAs(savedPath);const saved=JSON.parse(await fs.readFile(savedPath,'utf8'));
  if(JSON.stringify(envelopes(saved))!==splitState)throw Error('save changed envelope');
  await page.locator('#projectPicker').setInputFiles(savedPath);await page.waitForFunction(()=>window.__b2.get().clips.length===2);
  if(JSON.stringify(envelopes(await page.evaluate(()=>window.__b2.get())))!==splitState)throw Error('load dropped envelope metadata');
  await page.reload({waitUntil:'networkidle'}); // init fixture gives a fresh one-clip history for trim controls.
  await page.waitForFunction(()=>!!window.__b2);await page.evaluate(()=>window.__b2.choose('b2-clip',.998));
  await page.locator('[data-number="in"]').fill('.998');await page.locator('[data-number="in"]').press('Tab');
  const trimState=JSON.stringify(envelopes(await page.evaluate(()=>window.__b2.get())));
  await page.locator('#topUndo').click();if((await page.evaluate(()=>window.__b2.get())).clips[0].in!==0)throw Error('trim Undo');
  await page.locator('#topRedo').click();if(JSON.stringify(envelopes(await page.evaluate(()=>window.__b2.get())))!==trimState)throw Error('trim Redo');
  const evaluated=await page.evaluate(async()=>{const e=await import('./clip-envelope.js?v=2.2.85'),p=window.__b2.get();return e.envelopeDbAt(0,p.clips[0].audio.gainEnvelope)});
  if(Math.abs(evaluated+4.8)>1e-8)throw Error('trim start value');
  if(errors.length)throw Error('page errors '+errors.join(';'));
  reports.push({browser:name,version:browser.version(),audio,app:{split:true,splitUndoRedo:true,trim:true,trimUndoRedo:true,downloadSave:true,fileInputLoad:true,preservedOptionalFields:true,trimStartDb:evaluated},errors});
  await context.close();console.log(name,'OfflineAudioContext PCM + actual split/trim Undo/Redo/save/load PASS');
 }finally{await browser.close();await fs.writeFile(path.join(output,'browser.json'),JSON.stringify(reports,null,2)+'\n')}
}
