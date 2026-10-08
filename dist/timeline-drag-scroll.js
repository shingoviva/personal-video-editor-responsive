export function edgeScrollVelocity(position,min,max,zone=48,speed=650){
 const size=max-min;if(size<=0||position<min||position>max)return 0;
 zone=Math.min(zone,size/3);
 if(position<min+zone)return-speed*Math.pow(1-(position-min)/zone,2);
 if(position>max-zone)return speed*Math.pow(1-(max-position)/zone,2);
 return 0;
}
const supported=transfer=>['application/x-pve-media','application/x-pve-effect','application/x-pve-text'].some(type=>Array.from(transfer?.types||[]).includes(type));
export function bindTimelineDragScroll(scroll,{headerHeight=()=>0,onScroll=()=>{},onStop=()=>{}}={}){
 let pointer=null,frame=0,last=0,transfer=null;
 const stop=()=>{if(frame)cancelAnimationFrame(frame);frame=0;last=0;pointer=null;transfer=null;scroll.classList.remove('drag-scroll-active');onStop()};
 const tick=now=>{frame=-1;if(!pointer)return;const rect=scroll.getBoundingClientRect(),dt=Math.min(.05,last?(now-last)/1000:1/60);last=now;
 const x=edgeScrollVelocity(pointer.x,rect.left,rect.right),y=edgeScrollVelocity(pointer.y,rect.top+headerHeight(),rect.bottom);
 const beforeX=scroll.scrollLeft,beforeY=scroll.scrollTop;scroll.scrollLeft+=x*dt;scroll.scrollTop+=y*dt;
 if(beforeX!==scroll.scrollLeft||beforeY!==scroll.scrollTop){onScroll(pointer,transfer);}
 if(pointer)frame=requestAnimationFrame(tick);
 };
 const over=event=>{if(!supported(event.dataTransfer))return;event.preventDefault();pointer={x:event.clientX,y:event.clientY};transfer={types:Array.from(event.dataTransfer.types),getData:()=>''};scroll.classList.add('drag-scroll-active');if(!frame)frame=requestAnimationFrame(tick)};
 const leave=event=>{const rect=scroll.getBoundingClientRect();if(!scroll.contains(event.relatedTarget)&&(event.clientX<=rect.left||event.clientX>=rect.right||event.clientY<=rect.top||event.clientY>=rect.bottom))stop()};
 const wheel=event=>{if(!pointer||event.ctrlKey)return;event.preventDefault();const unit=event.deltaMode===1?16:event.deltaMode===2?scroll.clientHeight:1;scroll.scrollLeft+=event.deltaX*unit;scroll.scrollTop+=event.deltaY*unit};
 const key=event=>{if(event.key==='Escape')stop()};
 scroll.addEventListener('dragover',over);scroll.addEventListener('dragleave',leave);scroll.addEventListener('wheel',wheel,{passive:false});document.addEventListener('drop',stop,true);document.addEventListener('dragend',stop,true);document.addEventListener('keydown',key);window.addEventListener('blur',stop);
 return()=>{stop();scroll.removeEventListener('dragover',over);scroll.removeEventListener('dragleave',leave);scroll.removeEventListener('wheel',wheel);document.removeEventListener('drop',stop,true);document.removeEventListener('dragend',stop,true);document.removeEventListener('keydown',key);window.removeEventListener('blur',stop)};
}
