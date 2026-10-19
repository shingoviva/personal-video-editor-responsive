// Only these strengths are offered for new edits. Named legacy profiles are not
// distinct tracking algorithms. Keep them readable to preserve saved projects.
export const STABILIZATION_MODES=Object.freeze(['OFF','WEAK','MEDIUM','STRONG']);
export const LEGACY_STABILIZATION_MODES=Object.freeze(['HANDHELD','NATURAL','GIMBAL','HORIZON','TRIPOD','AGGRESSIVE']);
export function stabilizationOptions(current){
 const options=STABILIZATION_MODES.map(mode=>[mode,mode]);
 if(LEGACY_STABILIZATION_MODES.includes(current))options.push([current,`${current} · Legacy`]);
 return options;
}
