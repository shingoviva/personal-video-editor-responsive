import {markdown,compareReports,comparisonMarkdown} from './performance-report.js?v=2.2.85';
const save=(name,text,type)=>{const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
export function mountDiagnostics(trace,adapter){
 const host=document.createElement('details');host.id='pvePerformancePanel';host.style.cssText='position:fixed;right:8px;top:8px;z-index:10000;max-width:min(360px,94vw);color:#e4eadb;background:#121a17;border:1px solid #65785a;border-radius:6px;font:12px system-ui;box-shadow:0 3px 16px #0008';
 host.innerHTML='<summary style="cursor:pointer;padding:7px">PVE 診断 <span data-drag style="float:right;cursor:move;margin-left:18px" title="ドラッグで移動">移動</span></summary><div style="padding:10px;max-height:65vh;overflow:auto"><p>描画提出を測定します。画面のpresent FPSではありません。</p><label>モード <select data-mode><option value="light">軽量</option><option value="detailed">詳細</option><option value="off">OFF対照</option></select></label> <label><input data-gpu type="checkbox">GPU timer（任意）</label><br><label>シナリオ <select data-scenario>'+['A','B','C','D','E','F','G'].map(v=>'<option>'+v+'</option>').join('')+'</select></label><br><label>開始秒 <input data-start type="number" value="0" min="0" step=".1" style="width:65px"></label> <label>終了秒 <input data-end type="number" value="5" min=".1" step=".1" style="width:65px"></label><br><label>ウォームアップ秒 <input data-warmup type="number" min="0" max="30" value="0" style="width:55px"></label> <label>回数 <input data-repeats type="number" min="1" max="6" value="3" style="width:40px"></label><p><button data-run>区間測定</button> <button data-stop>停止</button> <button data-clear>消去</button></p><p><button data-json>JSON保存</button> <button data-md>要約保存</button> <button data-compare>直近2回比較</button></p><pre data-summary style="white-space:pre-wrap;overflow-wrap:anywhere">待機中</pre></div>';
 document.body.append(host);const $=s=>host.querySelector(s),summary=$('[data-summary]');let generation=0;
 const show=()=>{const report=trace.runs.at(-1);summary.textContent=report?markdown(report):'待機中'};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 $('[data-drag]').onpointerdown=event=>{event.preventDefault();event.stopPropagation();const grip=event.currentTarget,rect=host.getBoundingClientRect(),x=event.clientX,y=event.clientY;grip.setPointerCapture(event.pointerId);grip.onpointermove=next=>{host.style.right='auto';host.style.left=Math.max(0,Math.min(innerWidth-host.offsetWidth,rect.left+next.clientX-x))+'px';host.style.top=Math.max(0,Math.min(innerHeight-30,rect.top+next.clientY-y))+'px'};const finish=()=>{grip.onpointermove=grip.onpointerup=grip.onpointercancel=null};grip.onpointerup=grip.onpointercancel=finish};
 async function runRange(config){
 const token=++generation;for(const key of ['mode','scenario','start','end','warmup','repeats'])if(config[key]!==undefined)$('[data-'+key+']').value=config[key];$('[data-gpu]').checked=!!config.gpuTiming;adapter.pause();await adapter.unlock();const start=+config.start,end=+config.end,duration=adapter.state().duration;if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>duration+.001)throw Error('タイムライン内の開始・終了秒を指定してください。');
 const reports=[];for(let i=0;i<Math.max(1,Math.min(6,config.repeats||1));i++){
 if(token!==generation)break;if(config.warmup>0){await adapter.seek(start);if(token!==generation)break;await adapter.play();const until=performance.now()+Math.min(config.warmup,end-start)*1000;while(token===generation&&performance.now()<until)await wait(100);if(token!==generation)break;adapter.pause();}
 await adapter.seek(start);if(token!==generation)break;trace.start({...config,repeatGroup:'range',start,end});await adapter.play();
 while(trace.measuring&&token===generation){if(!adapter.state().playing){trace.stop(adapter.state().time>=end-.001);break}await wait(100)}
 if(token!==generation){trace.stop();break}reports.push(trace.runs.at(-1));show();await wait(150);
 }return reports;
 }
 const stop=()=>{generation++;trace.stop();adapter.pause();show()};
 $('[data-run]').onclick=()=>{summary.textContent='測定中（パネルは折り畳めます）';runRange({mode:$('[data-mode]').value,gpuTiming:$('[data-gpu]').checked,scenario:$('[data-scenario]').value,start:+$('[data-start]').value,end:+$('[data-end]').value,warmup:+$('[data-warmup]').value,repeats:+$('[data-repeats]').value}).catch(error=>{stop();summary.textContent=error.message})};
 $('[data-stop]').onclick=stop;$('[data-clear]').onclick=()=>{stop();trace.clear();show()};
 $('[data-json]').onclick=()=>save('pve-diagnostics.json',JSON.stringify(trace.runs.length===1?trace.runs[0]:{schemaVersion:'1.0.0',runs:trace.runs},null,2),'application/json');
 $('[data-md]').onclick=()=>save('pve-diagnostics.md',trace.runs.map(markdown).join('\n\n---\n\n'),'text/markdown');
 $('[data-compare]').onclick=()=>{if(trace.runs.length<2){summary.textContent='2回以上測定してください。';return}summary.textContent=comparisonMarkdown(compareReports(...trace.runs.slice(-2)))};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&trace.measuring){stop();summary.textContent+='\n非表示により中止：比較対象から除外してください。'}});
 // Developer-only surface; no project mutation or media contents exposed.
 window.pvePerformance={runRange,stop,clear:()=>{stop();trace.clear()},reports:()=>structuredClone(trace.runs),summary:()=>trace.runs.map(markdown).join('\n')};
}
