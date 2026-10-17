// Yield between GPU readbacks so preset samples cannot monopolize UI input.
export function createLookThumbnailQueue({request=requestAnimationFrame,cancel=cancelAnimationFrame}={}){
 let frame=0,generation=0;
 function stop(){generation++;if(frame)cancel(frame);frame=0}
 return {cancel:stop,start(items,paint,valid=()=>true){stop();const token=generation;let index=0;
  function next(){frame=0;if(token!==generation||!valid())return;const item=items[index++];if(item===undefined)return;paint(item);if(index<items.length&&token===generation&&valid())frame=request(next)}
  if(items.length)frame=request(next);
 }};
}
