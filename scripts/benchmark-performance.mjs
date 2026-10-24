// Optional developer harness. Playwright is supplied by the environment, never a production dependency.
// PVE_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/benchmark-performance.mjs URL fixture.mp4 output-directory
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performanceProject} from '../tests/fixtures/performance-projects.mjs';
const [baseURL,fixture,output]=process.argv.slice(2);if(!baseURL||!fixture||!output)throw Error('URL fixture.mp4 output-directory required');
const {chromium}=await import(process.env.PVE_PLAYWRIGHT_MODULE?pathToFileURL(process.env.PVE_PLAYWRIGHT_MODULE):'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});await fs.mkdir(output,{recursive:true});const errors=[],overview=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message)});
 await page.addInitScript(()=>sessionStorage.setItem('pve.iphone.project-launcher-seen','1'));await page.goto(baseURL+'?previewDiagnostics');await page.waitForFunction(()=>!!window.pvePerformance).catch(async error=>{console.error('Startup state',await page.evaluate(()=>({url:location.href,ready:document.readyState,panel:!!document.querySelector('#pvePerformancePanel'),diag:!!document.querySelector('#previewDiagnostics'),text:document.body.innerText.slice(-300)})));throw error});const bytes=await fs.readFile(fixture);
 await page.evaluate(async data=>{const {retainFile}=await import('./media-vault.js?v=2.2.85');await retainFile('fixture-media',new File([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],'fixture.mp4',{type:'video/mp4'}))},bytes.toString('base64'));
 const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
 for(const scenario of (process.env.PVE_SCENARIOS||'A,B,C,D,E,F,G').split(',')){
 const project=performanceProject(scenario,{size:bytes.length});await page.addInitScript(project=>{localStorage.setItem('pve.iphone.autosave.v1',JSON.stringify(project));sessionStorage.setItem('pve.iphone.project-launcher-seen','1')},project);await page.reload();await page.waitForFunction(()=>!!window.pvePerformance);await page.waitForTimeout(300);await page.locator('#pvePerformancePanel summary').click();await page.locator('#pvePerformancePanel summary').click();
 for(const mode of (process.env.PVE_MODES||'off,light,detailed').split(',')){
 const before=(await cdp.send('Performance.getMetrics')).metrics;const reports=await page.evaluate(async ({scenario,mode})=>{window.pvePerformance.clear();return window.pvePerformance.runRange({start:1,end:5,scenario,mode,warmup:.5,repeats:3,gpuTiming:mode==='detailed'})},{scenario,mode});const after=(await cdp.send('Performance.getMetrics')).metrics;
 const task=name=>(after.find(x=>x.name===name)?.value||0)-(before.find(x=>x.name===name)?.value||0);
 await fs.writeFile(path.join(output,`${scenario}-${mode}.json`),JSON.stringify({schemaVersion:'1.0.0',runs:reports},null,2));
 overview.push({scenario,mode,runs:reports.length,taskDurationSeconds:task('TaskDuration'),scriptDurationSeconds:task('ScriptDuration'),layoutDurationSeconds:task('LayoutDuration'),observedRange:reports.map(r=>[r.measurementConfig.observedStart,r.measurementConfig.observedEnd]),cpu:reports.map(r=>r.cpuMetrics),drawP95:reports.map(r=>r.playbackMetrics.drawIntervals.p95)});console.log(scenario,mode,'complete',reports.length);
 }
 }
 await page.screenshot({path:path.join(output,'diagnostics-ui.png')});await fs.writeFile(path.join(output,'overview.json'),JSON.stringify({method:'isolated headless Chrome; synthetic 1080p30 H.264/AAC, 4s measured ranges x3, .5s warmup, CDP TaskDuration covers whole batch incl preparation; not physical iPhone/Safari',overview,errors},null,2));if(errors.length)throw Error('Browser errors: '+errors.join('; '));
}finally{await browser.close()}
