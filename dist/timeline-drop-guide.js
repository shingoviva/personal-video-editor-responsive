export function dropFamilies(types,kinds=[]){
 if(types.includes('application/x-pve-text')||types.includes('application/x-pve-effect'))return['overlay'];
 if(!types.includes('application/x-pve-media'))return[];
 return[...(kinds.some(kind=>kind!=='audio')?['video']:[]),...(kinds.includes('audio')?['audio']:[])];
}
export function bindTimelineDropGuide(panel,scroll,getKinds){
 const hint=document.createElement('span');hint.className='timeline-drop-hint';hint.setAttribute('role','status');hint.hidden=true;panel.append(hint);let families=[];
 const clear=()=>{families=[];hint.hidden=true;document.querySelectorAll('.drop-compatible').forEach(node=>node.classList.remove('drop-compatible'))};
 const paint=()=>{if(!families.length)return;const english=document.documentElement.lang==='en',names=families.map(family=>family==='audio'?'A1–A4':family==='video'?'V1–V3':'F/T1–F/T3'),tracks=[...scroll.querySelectorAll(families.map(family=>family==='audio'?'.editable-audio':family==='video'?'.video-track':'.overlay-track').join(','))],box=scroll.getBoundingClientRect(),visible=tracks.some(track=>{const r=track.getBoundingClientRect();return r.top>=box.top+40&&r.bottom<=box.bottom}),below=tracks.some(track=>track.getBoundingClientRect().top>=box.bottom);hint.textContent=names.join(' / ')+(english?' · Drop here':' · へ配置')+(!visible?(english?` · Hold near ${below?'bottom':'top'} edge to scroll`:` · ${below?'下':'上'}端でスクロール`):'');hint.hidden=false};
 const start=event=>{clear();families=dropFamilies(Array.from(event.dataTransfer?.types||[]),getKinds());for(const family of families){const selector=family==='audio'?'.audio-head,.editable-audio':family==='video'?'.video-head,.video-track':'.overlay-head,.overlay-track';document.querySelectorAll(selector).forEach(node=>node.classList.add('drop-compatible'))}paint()};
 const key=event=>{if(event.key==='Escape')clear()};
 document.addEventListener('dragstart',start);document.addEventListener('drop',clear);document.addEventListener('dragend',clear);document.addEventListener('keydown',key);window.addEventListener('blur',clear);scroll.addEventListener('scroll',paint,{passive:true});
 return()=>{clear();hint.remove();document.removeEventListener('dragstart',start);document.removeEventListener('drop',clear);document.removeEventListener('dragend',clear);document.removeEventListener('keydown',key);window.removeEventListener('blur',clear);scroll.removeEventListener('scroll',paint)};
}
