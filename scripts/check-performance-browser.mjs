// Optional isolated browser QA. No dependency is added to PVE.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {performanceProject} from '../tests/fixtures/performance-projects.mjs';
const [url,fixture,output]=process.argv.slice(2);if(!url||!fixture||!output)throw Error('URL fixture output-directory required');await fs.mkdir(output,{recursive:true});const playwright=await import(pathToFileURL(process.env.PVE_PLAYWRIGHT_MODULE));const data=(await fs.readFile(fixture)).toString('base64'),results=[];
for(const name of ['chromium','webkit']){
 let browser;try{
 browser=await playwright[name].launch(name==='chromium'?{channel:'chrome',headless:true}:{headless:true});const context=await browser.newContext({viewport:name==='webkit'?{width:390,height:844}:{width:1440,height:900},isMobile:name==='webkit',hasTouch:name==='webkit'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>sessionStorage.setItem('pve.iphone.project-launcher-seen','1'));let equal=null,normalNoUI=null;
 if(name==='chromium'){
 await page.goto(url);await page.evaluate(async data=>{const{retainFile}=await import('./media-vault.js?v=2.2.85');await retainFile('fixture-media',new File([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],'fixture.mp4',{type:'video/mp4'}))},data);await page.addInitScript(p=>{localStorage.setItem('pve.iphone.autosave.v1',JSON.stringify(p));sessionStorage.setItem('pve.iphone.project-launcher-seen','1')},performanceProject('F'));
 await page.goto(url);await page.waitForTimeout(1200);await page.evaluate(()=>document.fonts.ready);const plain=await page.locator('#picture').screenshot();normalNoUI=await page.evaluate(()=>!document.querySelector('#pvePerformancePanel')&&!window.pvePerformance&&!document.querySelector('#previewDiagnostics'));
 await page.goto(url+'?previewDiagnostics');await page.waitForFunction(()=>!!window.pvePerformance);await page.waitForTimeout(1200);await page.evaluate(()=>document.fonts.ready);const idle=await page.locator('#picture').screenshot();equal=crypto.createHash('sha256').update(plain).digest('hex')===crypto.createHash('sha256').update(idle).digest('hex');
 }else{
 // Ephemeral Playwright WebKit cannot persist even a 100-byte Blob here.
 // Exercise the supported in-memory import/edit path instead; do not alter the vault.
 await page.goto(url+'?previewDiagnostics');await page.waitForFunction(()=>!!window.pvePerformance);await page.locator('#filePicker').setInputFiles(fixture);await page.locator('[data-use-asset]').first().waitFor({state:'visible',timeout:30000});await page.locator('[data-use-asset]').first().click();await page.waitForTimeout(800);
 }
 await page.locator('#pvePerformancePanel summary').click();await page.locator('[data-start]').fill('1');await page.locator('[data-end]').fill('2');await page.locator('[data-repeats]').fill('1');await page.locator('[data-mode]').selectOption('detailed');await page.locator('[data-scenario]').selectOption(name==='webkit'?'A':'F');await page.locator('[data-gpu]').check();await page.locator('[data-run]').click();await page.waitForFunction(()=>window.pvePerformance.reports().length>0,{},{timeout:20000});const reports=await page.evaluate(()=>window.pvePerformance.reports());if(!reports[0]?.measurementConfig.finishedRange)throw Error('Measured playback did not reach requested end');
 const jsonDownload=page.waitForEvent('download');await page.locator('[data-json]').click();await(await jsonDownload).saveAs(path.join(output,name+'-export.json'));const mdDownload=page.waitForEvent('download');await page.locator('[data-md]').click();await(await mdDownload).saveAs(path.join(output,name+'-summary.md'));await page.screenshot({path:path.join(output,name+'-panel.png')});
 await page.evaluate(()=>window.pvePerformance.clear());const cleared=await page.evaluate(()=>window.pvePerformance.reports().length===0);if(!cleared)throw Error('Clear failed');
 results.push({browser:name,normalNoDiagnosticUI:normalNoUI,idlePicturePixelsIdentical:equal,finishedRange:true,jsonExport:true,markdownExport:true,clear:true,scope:name==='webkit'?'single in-memory video, mobile viewport emulation; persistence excluded':'complex synthetic F',ui:await page.evaluate(()=>document.body.dataset.ui),errors});if(errors.length)throw Error(errors.join('; '));
 }catch(error){results.push({browser:name,error:error.message});process.exitCode=1}finally{await browser?.close()}
}
await fs.writeFile(path.join(output,'browser-qa.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
