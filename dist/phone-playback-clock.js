// Media decoding owns the mobile clock. A late UI frame must not rewind speech.
export function advancePhoneClock(time,delta,sample){
 if(sample){if(sample.waiting)return time;if(Number.isFinite(sample.time))return Math.max(time,sample.time)}
 return time+Math.max(0,Math.min(.25,delta));
}
export function phonePaneSizes(height,mode='balanced',ratio=.56){
 const usable=Math.max(0,height-12),minimum=Math.min(mode==='preview'?152:224,usable*.55);
 const desired=mode==='preview'?usable*.76:mode==='timeline'?Math.min(160,usable*.3):usable*ratio;
 const preview=Math.max(Math.min(120,usable*.3),Math.min(usable-minimum,desired));
 return {preview:Math.round(preview),timeline:Math.round(usable-preview)};
}
