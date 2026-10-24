import {snapClipPosition,equalSpacingStart} from './timeline-gestures.js?v=2.2.85';
import {planTimelineDuplicate,commitTimelineDuplicate} from './timeline-duplicate.js?v=2.2.85';

// Capture only copy gestures. The existing move/trim/touch handlers remain owners
// of all other gestures. Ghosts never enter the project or its save/history paths.
export function bindTimelineDuplicate({root,project,items,select,targets,snap,rate,extent,commit,error,preview=()=>{}}){
 let active=null,suppressClick=false;
 const context=e=>{if(active&&e.ctrlKey){e.preventDefault();e.stopImmediatePropagation()}};
 const click=e=>{if(suppressClick){suppressClick=false;e.preventDefault();e.stopImmediatePropagation()}};
 const down=e=>{
  if(active||!((e.button===0)||(e.button===2&&e.ctrlKey))||!(e.ctrlKey||e.altKey)||e.pointerType==='touch')return;
  const el=e.target.closest('[data-clip],[data-fx],[data-text-chip]');if(!el||e.target.closest('[data-edge],[data-overlay-edge]'))return;
  e.preventDefault();e.stopImmediatePropagation();
  const id=el.dataset.clip||el.dataset.fx||el.dataset.textChip;select(id);
  const source=items(),anchor=source.find(v=>v.item.id===id);if(!anchor)return;
  const geometry=root.getBoundingClientRect(),timelineSeconds=extent(),secondsPerPixel=timelineSeconds/Math.max(geometry.width,1),p=project(),elements=new Map([...root.querySelectorAll('[data-clip],[data-fx],[data-text-chip]')].map(n=>[n.dataset.clip||n.dataset.fx||n.dataset.textChip,n]));
  let plan=null,ghosts=[],delta=0,moved=false,valid=true,last=null;
  const cleanup=()=>{active=null;for(const g of ghosts)g.node.remove();document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',abort,true);document.removeEventListener('keydown',key,true);globalThis.removeEventListener?.('blur',abort);preview(null);};
  const abort=ev=>{if(ev?.pointerId!==undefined&&ev.pointerId!==e.pointerId)return;cleanup();suppressClick=moved};
  const key=ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();abort()}else if(!['Control','Alt','Shift','Meta'].includes(ev.key)){ev.preventDefault();ev.stopImmediatePropagation()}};
  const move=ev=>{
   if(ev.pointerId!==e.pointerId)return;
   if(!moved&&Math.hypot(ev.clientX-e.clientX,ev.clientY-e.clientY)<5)return;
   ev.preventDefault();ev.stopImmediatePropagation();
   if(!moved){try{plan=planTimelineDuplicate(p,source)}catch(err){cleanup();error(err.message);suppressClick=true;return}moved=true;
    ghosts=plan.map(v=>{const original=elements.get(v.sourceId);const node=original?.cloneNode(true);if(!node)return null;node.removeAttribute('data-clip');node.removeAttribute('data-fx');node.removeAttribute('data-text-chip');node.removeAttribute('id');node.classList.add('duplicate-preview','selected');node.style.pointerEvents='none';original.parentNode.append(node);return{node,value:v}}).filter(Boolean);
   }
   const raw=anchor.start+(ev.clientX-e.clientX)*secondsPerPixel,skip=new Set(plan.map(v=>v.item.id));last=snapClipPosition(raw,anchor.span,{enabled:snap(),rate:anchor.kind==='audio'?null:rate(),targets:targets(skip),threshold:secondsPerPixel*12});
   if(snap()){const peers=items(true).filter(v=>v.kind===anchor.kind&&(v.item.layer||0)===(anchor.item.layer||0)&&!skip.has(v.item.id));const spacing=equalSpacingStart(raw,anchor.span,{id:anchor.item.id,layer:0},peers.map(v=>({id:v.item.id,layer:0,start:v.start,end:v.start+v.span})),secondsPerPixel);if(spacing.spacing&&Math.abs(spacing.start-raw)<=Math.abs(last.start-raw)){last.start=spacing.start;last.snapped=false;last.spacing=spacing}}
   delta=Math.max(-Math.min(...plan.map(v=>v.start)),last.start-anchor.start);
   const lane=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.video-track,.editable-audio,.fx-track');valid=!!lane&&plan.every(v=>v.start+delta+v.span<=86400)&&Number.isFinite(delta);
   for(const g of ghosts){g.node.style.left=(g.value.start+delta)/timelineSeconds*100+'%';g.node.classList.toggle('invalid-drop',!valid)}preview({...last,valid,count:plan.length});
  };
  const up=ev=>{if(ev.pointerId!==e.pointerId)return;ev.preventDefault();ev.stopImmediatePropagation();const changed=moved;cleanup();suppressClick=true;if(changed&&valid){try{if(project()!==p)throw Error('編集中にプロジェクトが変更されたため複製を中止しました。');commit(()=>commitTimelineDuplicate(p,plan,delta),plan,plan.find(v=>v.sourceId===id)?.item.id)}catch(err){error(err.message)}}else if(changed)error('タイムライン内の有効な位置へドロップしてください。')};
  active={};document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',abort,true);document.addEventListener('keydown',key,true);globalThis.addEventListener?.('blur',abort);
 };
 root.addEventListener('pointerdown',down,true);root.addEventListener('contextmenu',context,true);root.addEventListener('click',click,true);
 return()=>{root.removeEventListener('pointerdown',down,true);root.removeEventListener('contextmenu',context,true);root.removeEventListener('click',click,true)};
}
