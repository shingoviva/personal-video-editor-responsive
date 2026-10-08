export const attributeGroups={color:['color','lookName','lookAmount'],crop:['scale','scaleKeyframes','x','y'],motion:['speed','endSpeed','curve','stabilization','interpolation'],visual:['opacity','opacityKeyframes','fadeIn','fadeOut'],audio:['audio']};
export const textAttributeKeys=['font','italic','align','weight','color','lineColors','accentWords','accentColor','outline','outlineColor','outerOutline','outerOutlineColor','shadow','shadowColor','shadowOpacity','shadowBlur','shadowX','shadowY','box','boxColor','boxOpacity','boxPadding','boxRadius','size','letterSpacing','lineHeight','x','y','opacity','fadeIn','fadeOut','motion','motionDuration','motionStart','motionEnd','motionScaleFrom','motionScaleTo'];
export function pasteTextAttributes(target,source){
 if(!target||!source)return false;
 for(const key of textAttributeKeys){
  if(Object.hasOwn(source,key))target[key]=structuredClone(source[key]);
  else delete target[key];
 }
 delete target.raster;
 return true;
}
export function pasteAttributes(target,source,groups){
 if(!target||!source)return false;
 let changed=false;
 for(const group of groups){
  if(group!=='audio'&&(target.kind==='audio'||source.kind==='audio'))continue;
  if(group==='motion'&&(target.freezeAt!=null||source.freezeAt!=null||target.kind==='image'||source.kind==='image'))continue;
  for(const key of attributeGroups[group]||[]){
   if(Object.hasOwn(source,key)){target[key]=structuredClone(source[key]);changed=true}
   else if(Object.hasOwn(target,key)){delete target[key];changed=true}
  }
  if(group==='motion')delete target.timingBase;
 }
 return changed;
}
