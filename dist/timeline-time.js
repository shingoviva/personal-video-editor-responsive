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

export function timelineLabelShift(x,scrollLeft,viewportWidth,labelWidth){const half=Math.min(labelWidth,viewportWidth)/2;return Math.max(scrollLeft+half,Math.min(scrollLeft+viewportWidth-half,x))-x}

// Editing rate is independent of source and export sampling. Stored times stay
// continuous seconds; only explicitly requested frame operations use this grid.
export const EDIT_RATES=[['24000/1001','23.976'],['24/1','24'],['25/1','25'],['30000/1001','29.97'],['30/1','30'],['50/1','50'],['60000/1001','59.94'],['60/1','60']];
export function normalizeTimelineRate(value){
 const raw=typeof value==='object'&&value?`${value.numerator}/${value.denominator}`:String(value??'30/1');
 const entry=EDIT_RATES.find(([ratio,label])=>raw===ratio||raw===label||Math.abs(Number(raw)-Number(ratio.split('/')[0])/Number(ratio.split('/')[1]))<1e-7);
 const[numerator,denominator]=(entry?.[0]||'30/1').split('/').map(Number);return{numerator,denominator};
}
export function editingFrameTime(index,rate){const{numerator,denominator}=normalizeTimelineRate(rate);return index*denominator/numerator}
export function quantizeTimelineTime(time,rate){const{numerator,denominator}=normalizeTimelineRate(rate);return editingFrameTime(Math.round(time*numerator/denominator),rate)}
export function stepTimelineFrame(time,direction,rate){
 const{numerator,denominator}=normalizeTimelineRate(rate),position=time*numerator/denominator,nearest=Math.round(position),aligned=Math.abs(position-nearest)<=Number.EPSILON*Math.max(1,Math.abs(position))*8;
 const index=aligned?nearest+Math.sign(direction):direction>0?Math.floor(position)+1:Math.ceil(position)-1;
 return Math.max(0,editingFrameTime(index,rate));
}

// Decimal labels for standard NTSC rates denote their exact rational cadence.
// Other numeric values (including measured source rates) are kept as supplied.
export function frameRateValue(value){const text=String(value),known=EDIT_RATES.some(([ratio,label])=>text===ratio||text===label);if(!known)return Number(value);const{numerator,denominator}=normalizeTimelineRate(value);return numerator/denominator}
