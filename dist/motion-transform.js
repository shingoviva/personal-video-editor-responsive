import {activeDiagnostics} from './preview-diagnostics.js?v=2.2.82';
import {clamp} from './model.js?v=2.2.82';
import {scaleAt} from './creative.js?v=2.2.82';

export function motionTransform(clip,local,duration){const diagnosticStart=activeDiagnostics?.begin('evaluation.scaleMotion');try{
 const preset=clip.motionPreset||'none';if(preset==='none'&&!(clip.scaleKeyframes||[]).length)return clip;
 const u=clamp(local/Math.max(duration,1/60),0,1),ease=u*u*(3-2*u),amount=clamp(clip.motionAmount??.12,0,.5),next={...clip};
 if(preset==='push-in')next.scale=clamp((clip.scale||1)*(1+amount*ease),.1,3);
 else if(preset==='pull-out')next.scale=clamp((clip.scale||1)*(1+amount*(1-ease)),.1,3);
 else if(preset==='pan-left')next.x=clamp((clip.x??.5)+amount*(.5-ease),0,1);
 else if(preset==='pan-right')next.x=clamp((clip.x??.5)+amount*(ease-.5),0,1);
 else if(preset==='pan-up')next.y=clamp((clip.y??.5)+amount*(.5-ease),0,1);
 else if(preset==='pan-down')next.y=clamp((clip.y??.5)+amount*(ease-.5),0,1);
 if((clip.scaleKeyframes||[]).length)next.scale=scaleAt(clip,local,duration);
 return next;
}finally{activeDiagnostics?.end('evaluation.scaleMotion',diagnosticStart)}}
