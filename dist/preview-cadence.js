// Retain the fractional interval. Resetting to `now` on every draw slowly
// drops the cadence (e.g. a 30 fps budget becomes 24 fps on a 120 Hz display).
export function previewCadence(previous,now,interval){
 const elapsed=now-previous;if(elapsed<interval-.1)return null;
 return previous+Math.max(1,Math.floor((elapsed+.1)/interval))*interval;
}
