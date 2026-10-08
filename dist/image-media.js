// Only one full image is decoded during import; previews and thumbnails are bounded.
export async function probeImage(file,url){
 if(file.size>100*1024*1024)throw Error('静止画は100MB以下にしてください。');
 const img=new Image();img.decoding='async';img.src=url;
 try{
  await img.decode();const width=img.naturalWidth,height=img.naturalHeight;
  if(!width||!height||width*height>80000000)throw Error('静止画は8,000万画素以下にしてください。');
  const scale=Math.min(1,320/Math.max(width,height)),cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(width*scale));cv.height=Math.max(1,Math.round(height*scale));
  const ctx=cv.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);
  return{kind:'image',width,height,duration:5,fps:0,rateMode:'STILL',audio:false,hdr:false,codec:file.type||file.name.split('.').at(-1).toUpperCase(),thumbnail:cv.toDataURL('image/jpeg',.75)};
 }finally{img.removeAttribute('src')}
}
export async function imageBitmap(file,m,maxEdge=1280){
 const scale=Math.min(1,maxEdge/Math.max(m.width,m.height));
 return createImageBitmap(file,{resizeWidth:Math.max(1,Math.round(m.width*scale)),resizeHeight:Math.max(1,Math.round(m.height*scale)),resizeQuality:'high'});
}
export class StillPreview{
 constructor(){this.key=null;this.bitmap=null;this.pending=null;this.generation=0}
 async load(key,getFile,m){
  if(this.key===key)return this.pending;
  this.clear();this.key=key;const generation=this.generation;
  this.pending=(async()=>{const bitmap=await imageBitmap(await getFile(),m);if(generation!==this.generation){bitmap.close();return null}this.bitmap=bitmap;return bitmap})();
  try{return await this.pending}catch(e){if(generation===this.generation)this.clear();throw e}
 }
 clear(){this.generation++;this.bitmap?.close();this.bitmap=null;this.key=null;this.pending=null}
}
