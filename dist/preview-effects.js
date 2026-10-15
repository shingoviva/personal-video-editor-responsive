// Preview-only geometry: keep compositor surfaces inside the picture bounds.
export function previewZoomStyle({scale=1,x=0,y=0}={}){
 return scale===1&&x===0&&y===0?'none':`translate(${x*100}%,${y*100}%) scale(${scale})`;
}
export function focusOverlayMarkup({x,y,size},strength=.45){
 const bound=n=>Math.max(0,Math.min(100,n)),left=bound((x-size/2)*100),right=bound((x+size/2)*100),top=bound((y-size/2)*100),bottom=bound((y+size/2)*100);
 return [[0,0,100,top],[0,bottom,100,100-bottom],[0,top,left,bottom-top],[right,top,100-right,bottom-top]]
  .filter(([, ,w,h])=>w>0&&h>0)
  .map(([x,y,w,h])=>`<div style="position:absolute;left:${x}%;top:${y}%;width:${w}%;height:${h}%;background:rgba(0,0,0,${Math.max(0,Math.min(1,strength))});pointer-events:none"></div>`).join('');
}
