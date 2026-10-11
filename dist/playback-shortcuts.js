// A bare Shift release toggles playback; chords and Shift-click never do.
export function shiftPlaybackShortcut(canToggle,toggle){
 let armed=false;
 return {
  down(event){if(event.code==='ShiftLeft'||event.code==='ShiftRight'){if(!event.repeat)armed=canToggle(event)&&!event.metaKey&&!event.ctrlKey&&!event.altKey}else armed=false},
  up(event){if(event.code!=='ShiftLeft'&&event.code!=='ShiftRight')return;const fire=armed;armed=false;if(fire&&canToggle(event)){event.preventDefault();toggle()}},
  cancel(){armed=false}
 };
}
