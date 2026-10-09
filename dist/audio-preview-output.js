// A separate start gate keeps clip automation unchanged and blocks PCM until
// native play has actually started. Never reopen it from the render loop.
export const START_RAMP_SECONDS=.012;
export function silenceOutput(param,now){param.cancelScheduledValues(now);param.setValueAtTime(0,now)}
export function openOutput(param,now){silenceOutput(param,now);param.linearRampToValueAtTime(1,now+START_RAMP_SECONDS)}
export function createDelayEffect(context,source,output){
 const delay=context.createDelay(2),tone=context.createBiquadFilter(),feedback=context.createGain(),wet=context.createGain();
 tone.type='lowpass';tone.frequency.value=9000;delay.delayTime.value=.28;feedback.gain.value=0;wet.gain.value=0;
 source.connect(delay).connect(tone).connect(wet).connect(output);tone.connect(feedback).connect(delay);
 return {delay,tone,feedback,wet};
}
export function resetDelayEffect(context,graph){
 // Suspending freezes DelayNode buffers; muting feedback alone cannot clear
 // them. Replace just this branch, retaining the single media source binding.
 graph.source.disconnect(graph.delay);
 for(const node of [graph.delay,graph.tone,graph.feedback,graph.wet])node.disconnect();
 Object.assign(graph,createDelayEffect(context,graph.source,graph.output));
}
