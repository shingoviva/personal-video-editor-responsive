// Clips, ruler ticks and the playhead must share the same editable extent.
export function timelineXAtTime(time,extent,width){
  return Math.max(0,Math.min(1,time/Math.max(extent,.001)))*width;
}

export function timelineTimeAtX(x,width,extent){
  return Math.max(0,Math.min(1,x/Math.max(width,1)))*extent;
}

export function locatePreviewRow(rows,time,end){
  if(!end)return;
  let found;
  for(const row of rows){
    if(!row.clip.gap&&time>=row.start&&time<row.end&&(!found||row.layer>=found.layer))found=row;
  }
  return found||{clip:{gap:Math.max(end,.01)},start:0,end,duration:end,layer:0};
}
