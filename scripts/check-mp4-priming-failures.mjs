// Real OPFS failure/cancel/retry. Test routing never changes production modules.
import fs from 'node:fs/promises';import{pathToFileURL}from'node:url';
const[origin,out,...selected]=process.argv.slice(2);await fs.mkdir(out,{recursive:true});const{chromium,webkit}=await import(pathToFileURL(process.env.PVE_PLAYWRIGHT_MODULE));
const isWebKit=process.env.PVE_BROWSER==='webkit',browser=isWebKit?null:await chromium.launch({channel:'chrome',headless:true}),rows=[];
try{for(const fault of(selected.length?selected:['count','missing-hook','write','flush','file-group','file-box','cancel','cancel-final','worker'])){
 const context=isWebKit?await webkit.launchPersistentContext(out+'/profile-'+fault,{headless:true}):await browser.newContext();let inject=true;
 // WebKit caches fulfilled fault responses. Fresh worker/storage URLs keep retry honest.
 await context.route('**/mobile-export.js*',async route=>{const r=await route.fetch();const body=(await r.text()).replace("new URL('./mobile-render-worker.js?v=2.2.84',import.meta.url)","new URL('./mobile-render-worker.js?v=2.2.84&qa='+crypto.randomUUID(),import.meta.url)");await route.fulfill({response:r,body})});
 await context.route('**/mobile-render-worker.js*',async route=>{
  const r=await route.fetch();let body=(await r.text()).replace("'./mobile-storage-output.js?v=2.2.84'","'./mobile-storage-output.js?qa="+crypto.randomUUID()+"'");
  if(inject){
   if(fault==='count')body=body.replace('primingMux.verify(audioSource.packetCount)','primingMux.verify(audioSource.packetCount+1)');
   if(fault==='missing-hook')body=body.replace('pveAacPriming:primingMux','pveAacPriming:undefined');
   if(fault==='flush')body=body.replace('handle.flush();','throw Error("Injected final flush");handle.flush();');
   if(fault==='worker')body=body.replace('const primingMux=new AacPrimingMux();','setTimeout(()=>{throw Error("Injected worker fault")},0);const primingMux=new AacPrimingMux();');
   if(fault.startsWith('file-')){
    const corrupt=fault==='file-box'?"hh.write(new Uint8Array([0,0,0,4]),{at:28})":"const bb=new Uint8Array(await(await fileHandle.getFile()).slice(0,4096).arrayBuffer());let at=-1;for(let i=0;i<bb.length-4;i++)if(bb[i]===115&&bb[i+1]===98&&bb[i+2]===103&&bb[i+3]===112){at=i+16;break}if(at<0)throw Error('fixture group missing');hh.write(new Uint8Array([1]),{at})";
    body=body.replace('const file=await fileHandle.getFile();',`{const hh=await fileHandle.createSyncAccessHandle();try{${corrupt};hh.flush()}finally{hh.close()}}const file=await fileHandle.getFile();`);
   }
  }
  await route.fulfill({response:r,body});
 });
 await context.route('**/mobile-storage-output.js*',async route=>{const r=await route.fetch();let body=await r.text();if(inject&&fault==='write')body=body.replace('const bytes=new Uint8Array','throw Error("Injected stream write");const bytes=new Uint8Array');await route.fulfill({response:r,body})});
 const page=await context.newPage();await page.goto(origin);
 const inventory=async()=>page.evaluate(async()=>{const d=await(await navigator.storage.getDirectory()).getDirectoryHandle('pve-iphone-renders',{create:true}),result=[];for await(const[n,h]of d.entries()){const f=await h.getFile();result.push({name:n,size:f.size,modified:f.lastModified})}return result.sort((a,b)=>a.name.localeCompare(b.name))});
 const baseline=await inventory();
 const run=async cancel=>page.evaluate(async cancel=>{
  const{project,clip}=await import('/dist/model.js'),{renderOnDevice,deleteRender}=await import('/dist/mobile-export.js');
  const file=new File([await(await fetch('/qa-audio/48000.mp4')).blob()],'synthetic.mp4'),media={id:'x',kind:'video',width:96,height:54,fps:60,duration:2,audio:true},p=project();p.media=[media];p.clips=[clip(media)];p.export.resolution='Source';
  const ctrl=new AbortController();let watchdog=false,error,result;const start=performance.now(),timer=setTimeout(()=>{watchdog=true;ctrl.abort()},10000);
  try{result=await renderOnDevice(p,[{id:'x',file}],{signal:ctrl.signal,onProgress:(op,value)=>{if(cancel&&(cancel==='cancel-final'?value>=.96:value>.05&&value<.95))ctrl.abort()}});if(!await deleteRender(result.path))throw Error('QA completed export cleanup failed')}catch(e){error={name:e.name,message:e.message}}finally{clearTimeout(timer)}
  return{error,verified:result?.verified,watchdog,elapsedMs:performance.now()-start};
 },cancel);
 const failed=await run(fault.startsWith('cancel')?fault:false),afterFailure=await inventory();inject=false;const retry=await run(false),afterRetry=await inventory();
 const unchanged=list=>JSON.stringify(list)===JSON.stringify(baseline);failed.newFiles=afterFailure.filter(x=>!baseline.some(b=>b.name===x.name));retry.newFiles=afterRetry.filter(x=>!baseline.some(b=>b.name===x.name));
 const pass=!!failed.error&&!failed.verified&&!failed.watchdog&&unchanged(afterFailure)&&retry.verified&&!retry.error&&unchanged(afterRetry);
 rows.push({fault,pass,baseline,baselinePreserved:unchanged(afterFailure)&&unchanged(afterRetry),failed,retry});console.log(fault,JSON.stringify(rows.at(-1)));await context.close();await fs.writeFile(out+'/failures.json',JSON.stringify(rows,null,2));
}if(rows.some(r=>!r.pass))process.exitCode=1;}finally{await browser?.close()}
