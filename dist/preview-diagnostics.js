// Opt-in, bounded trace for reproducing playback faults without screen capture.
// Disabled in normal use; no media, project contents or URLs are recorded.
export function previewDiagnostics(document,enabled=false,limit=4800){
 if(!enabled)return null;
 const output=document.createElement('script');output.type='application/json';output.id='previewDiagnostics';document.body.append(output);
 const events=[];let dropped=0;
 return {record(type,detail={}){if(events.length===limit){events.shift();dropped++}events.push({at:performance.now(),type,...detail})},flush(){output.textContent=JSON.stringify({events,dropped})}};
}
