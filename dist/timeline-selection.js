export function normalizedRect(a,b){
 const left=Math.min(a.x,b.x),top=Math.min(a.y,b.y),right=Math.max(a.x,b.x),bottom=Math.max(a.y,b.y);
 return{left,top,right,bottom,width:right-left,height:bottom-top};
}

export function rectsIntersect(a,b){
 return a.left<=b.right&&a.right>=b.left&&a.top<=b.bottom&&a.bottom>=b.top;
}

export function timelineItemId(element){
 return element?.dataset?.clip||element?.dataset?.fx||element?.dataset?.textChip||null;
}

export function idsInRect(elements,rect){
 const ids=[];
 for(const element of elements){
  const id=timelineItemId(element),box=element.getBoundingClientRect();
  if(id&&box.width>0&&box.height>0&&rectsIntersect(rect,box))ids.push(id);
 }
 return ids;
}

// Bound once: rendered item nodes are collected only when a gesture begins.
export function bindTimelineMarquee({root,guide,getSelected,preview,finish,cancel,click,surfaceSelector='.fx-track,.video-track,.editable-audio'}){
 const down=event=>{
  if(event.pointerType!=='mouse'||event.button!==0||event.target.closest('[data-clip],[data-fx],[data-text-chip],[data-marker],.ruler'))return;
  if(!event.target.closest(surfaceSelector))return;
  event.preventDefault();event.stopPropagation();
  const start={x:event.clientX,y:event.clientY},base=new Set(event.shiftKey||event.metaKey||event.ctrlKey?getSelected():[]),elements=[...root.querySelectorAll('[data-clip],[data-fx],[data-text-chip]')];
  let moved=false,current=[...base],done=false;
  root.setPointerCapture?.(event.pointerId);
  const update=move=>{
   if(!moved&&Math.hypot(move.clientX-start.x,move.clientY-start.y)<4)return;
   moved=true;const clientRect=normalizedRect(start,{x:move.clientX,y:move.clientY}),rootRect=root.getBoundingClientRect();
   guide.hidden=false;guide.style.left=Math.max(0,clientRect.left-rootRect.left)+'px';guide.style.top=Math.max(0,clientRect.top-rootRect.top)+'px';guide.style.width=Math.max(0,Math.min(clientRect.right,rootRect.right)-Math.max(clientRect.left,rootRect.left))+'px';guide.style.height=Math.max(0,Math.min(clientRect.bottom,rootRect.bottom)-Math.max(clientRect.top,rootRect.top))+'px';
   current=[...new Set([...base,...idsInRect(elements,clientRect)])];preview(current,elements);
  };
  const cleanup=()=>{guide.hidden=true;root.onpointermove=root.onpointerup=root.onpointercancel=root.onlostpointercapture=null};
  const end=up=>{if(done)return;done=true;cleanup();if(moved)finish(current);else click(up)};
  const abort=()=>{if(done)return;done=true;cleanup();cancel([...base])};
  root.onpointermove=update;root.onpointerup=end;root.onpointercancel=abort;root.onlostpointercapture=abort;
 };
 root.addEventListener('pointerdown',down,true);
 return()=>root.removeEventListener('pointerdown',down,true);
}
