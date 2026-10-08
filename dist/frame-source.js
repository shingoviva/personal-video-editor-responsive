// CanvasSink iterator canvases are pooled. Resolve by source timestamp and paint
// immediately so an encoder await cannot leave every output frame on one buffer.
export async function frameAtTimestamp(sink,source,state){
 if(!state.frame||Math.abs(source-state.source)>1e-8){state.frame=await sink.getCanvas(source);state.source=source}
 return state.frame;
}
