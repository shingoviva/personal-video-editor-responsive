// A single sequential decoder iterator retains codec state across output frames.
// Copy and close each owned sample before advancing; no recycled canvas survives.
export function streamingFrames(sink,timestamps,copy){
 const iterator=sink.samplesAtTimestamps(timestamps);let closed=false;
 return{async next(){if(closed)throw Error('Frame reader is closed');const result=await iterator.next();const sample=result.value;if(result.done||!sample)throw Error('映像フレームを読み込めません。');try{return copy(sample)}finally{sample.close()}},async close(){if(closed)return;closed=true;await iterator.return?.()}};
}
