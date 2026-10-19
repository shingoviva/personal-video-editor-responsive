export function phonePaneSizes(height,mode='balanced',ratio=.56){
 const usable=Math.max(0,height-12),minimum=Math.min(mode==='timeline'?224:152,usable*.55);
 const desired=mode==='preview'?usable*.84:mode==='timeline'?Math.min(160,usable*.3):usable*ratio;
 const preview=Math.max(Math.min(120,usable*.3),Math.min(usable-minimum,desired));
 return {preview:Math.round(preview),timeline:Math.round(usable-preview)};
}
