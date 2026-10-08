export async function startAssetVideoPreview(video){
 if(!video)return false;video.muted=true;video.playsInline=true;
 if(Number.isFinite(video.duration)&&video.duration>0&&video.currentTime<.02)video.currentTime=Math.min(.12,video.duration/3);
 try{await video.play();return true}catch{return false}
}
export function stopAssetVideoPreview(video){if(!video)return;video.pause?.()}
export function stopAssetVideoPreviews(root=document){for(const video of root.querySelectorAll?.('[data-asset-preview]')||[])stopAssetVideoPreview(video)}
export function bindAssetVideoPreviews(root=document){
 const videos=[...(root.querySelectorAll?.('[data-asset-preview]')||[])];
 for(const video of videos){video.onpointerenter=()=>startAssetVideoPreview(video);video.onpointerleave=()=>stopAssetVideoPreview(video);video.onfocus=()=>startAssetVideoPreview(video);video.onblur=()=>stopAssetVideoPreview(video)}
 return videos.length;
}
