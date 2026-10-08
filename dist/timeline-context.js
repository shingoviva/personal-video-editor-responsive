import {clamp} from './model.js';

export function timeAtTimelinePoint(row,clientX,rect){
 return row.start+clamp((clientX-rect.left)/Math.max(rect.width,1),0,1)*row.duration;
}

export function canSplitTimelineRow(row,time,epsilon=.001){
 return !!row&&!row.clip.gap&&!row.clip.freezeDuration&&time>row.start+epsilon&&time<row.end-epsilon;
}

export function contextMenuPosition(x,y,width,height,viewportWidth,viewportHeight,padding=8){
 return{
  left:clamp(x,padding,Math.max(padding,viewportWidth-width-padding)),
  top:clamp(y,padding,Math.max(padding,viewportHeight-height-padding))
 };
}
