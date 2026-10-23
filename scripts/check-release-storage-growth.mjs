// Disposable OPFS generations, integrated project save/load, and ordinary overwrites.
import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const[url,output]=process.argv.slice(2),pw=await import(pathToFileURL(process.env.PVE_PLAYWRIGHT_MODULE)),browser=await pw.chromium.launch({channel:'chrome',headless:true});
try{const context=await browser.newContext(),page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded'});const result=await page.evaluate(async()=>{
 const s=await import('/dist/project-storage.js'),m=await import('/dist/model.js'),root=await navigator.storage.getDirectory(),name='pve-284-'+crypto.randomUUID(),dir=await root.getDirectoryHandle(name,{create:true});
 const bytes=new Uint8Array(1048576);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;const file=new File([bytes],'synthetic.mov'),media={id:'generation-media',name:file.name,kind:'video',duration:2,width:160,height:90,fps:25,audio:true},p=m.project();p.timelineRate={numerator:24000,denominator:1001};p.media=[media];const clip=m.clip(media);clip.audio.gainEnvelope=Array.from({length:1024},(_,i)=>({id:'p'+i,time:i/1023*2,valueDb:i%2?-12:0,interpolation:i%3?'linear':'hold',...(i===1022?{holdRampSeconds:.001,editBoundary:true}:{})}));p.clips=[clip];
 const hash=async file=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join(''),expected=await hash(file),generations=[];
 try{
  for(let i=0;i<20;i++){media.projectPath=await s.copyMediaToProject(dir,media,file);generations.push(media.projectPath);await s.saveFolderProject(p,dir)}
  const original=await dir.getDirectoryHandle('Originals');let entries=0,total=0;for await(const h of original.values()){entries++;total+=(await h.getFile()).size}
  if(entries!==20||total!==20*file.size)throw Error('unexpected generation count');for(const path of generations)if(await hash(await s.restoreProjectMediaFile(dir,path))!==expected)throw Error('old generation changed');
  const saved=JSON.parse(await(await(await dir.getFileHandle('Project.pve')).getFile()).text()),restored=m.sanitize(saved);if(restored.clips[0].audio.gainEnvelope.length!==1024||restored.timelineRate.numerator!==24000)throw Error('B2/B3/B4 save/load');
  for(let i=0;i<20;i++){p.name='ordinary overwrite '+i;await s.saveFolderProject(p,dir)}let after=0;for await(const h of original.values())after++;if(after!==20)throw Error('ordinary save recopied media');
  return{result:'PASS',backend:'Chrome isolated OPFS',copyRequests:20,ordinaryOverwrites:20,generations:entries,mediaBytes:file.size,totalMediaBytes:total,liveReferencedBytes:file.size,unreferencedGenerationBytes:total-file.size,allOldContentHashesMatch:true,ordinarySaveAddedGenerations:after-entries,saveLoad1024PointsAndRationalEditRate:true};
 }finally{await s.removeRecentProject(p.id);await root.removeEntry(name,{recursive:true})}
});await fs.writeFile(output,JSON.stringify({browser:browser.version(),...result},null,2)+'\n');console.log(JSON.stringify(result));await context.close()}finally{await browser.close()}
