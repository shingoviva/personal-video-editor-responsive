// Preserve the shared compositor stages: screen colors, focus mask, then
// whole-picture motion. Within each stage F/T1 is below F/T2 and F/T3.
// Stable same-plane order and a copy preserve project/Undo serialization.
const stage=e=>e.type!=='region-zoom'?0:e.motionKind==='focus'?1:2;
export function orderedEffects(effects=[]){return [...effects].sort((a,b)=>stage(a)-stage(b)||(a.layer||0)-(b.layer||0))}
