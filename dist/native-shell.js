const editable=target=>!!target?.closest?.('input,textarea,select,[contenteditable="true"]');
const inside=(container,event)=>{if(container?.contains?.(event.target))return true;const box=container?.getBoundingClientRect?.(),x=event.clientX,y=event.clientY;return!!box&&Number.isFinite(x)&&Number.isFinite(y)&&x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom};

export function shouldBlockBrowserZoom(event,timeline){
 if(inside(timeline,event))return false;
 return event.type.startsWith('gesture')||(event.type==='wheel'&&(event.ctrlKey||event.metaKey))||(event.type==='touchmove'&&event.touches?.length>1);
}

export function isBrowserZoomShortcut(event){
 return(event.metaKey||event.ctrlKey)&&['Equal','Minus','Digit0','NumpadAdd','NumpadSubtract'].includes(event.code);
}

// Keep the page behaving like an editor surface while preserving form controls,
// normal scrolling and the timeline's own pinch-to-zoom gesture.
export function bindNativeShell({root=document,timeline}){
 const zoom=event=>{if(shouldBlockBrowserZoom(event,timeline)){event.preventDefault();event.stopPropagation()}};
 const keys=event=>{if(isBrowserZoomShortcut(event)){event.preventDefault();event.stopPropagation()}};
 const context=event=>{if(!editable(event.target))event.preventDefault()};
 const drag=event=>{if(event.target?.tagName==='IMG'&&!event.target.closest?.('[draggable="true"]'))event.preventDefault()};
 for(const type of ['gesturestart','gesturechange','gestureend','wheel','touchmove'])root.addEventListener(type,zoom,{capture:true,passive:false});
 root.addEventListener('keydown',keys,{capture:true});root.addEventListener('contextmenu',context);root.addEventListener('dragstart',drag);
 return()=>{for(const type of ['gesturestart','gesturechange','gestureend','wheel','touchmove'])root.removeEventListener(type,zoom,{capture:true});root.removeEventListener('keydown',keys,{capture:true});root.removeEventListener('contextmenu',context);root.removeEventListener('dragstart',drag)};
}
