// Scope-limited defaults. Resets never change source ranges, placement, links or mute.
export const settingDefaults={scale:1,x:.5,y:.5,opacity:1,motionAmount:.12,lookAmount:1,'audio.volume':1,'audio.fadeIn':0,'audio.fadeOut':0,'audio.delayTime':.28,'audio.delayFeedback':.35,'audio.delayMix':.25,'bgm.volume':.3,'bgm.fadeIn':0,'bgm.fadeOut':0};
export function defaultForSetting(key){const normalized=key.replace(/^soundclip\./,'');if(normalized.startsWith('color.'))return 0;return settingDefaults[normalized]}
export function resetMotionAppearance(c){Object.assign(c,{motionPreset:'none',motionAmount:.12,scale:1,x:.5,y:.5,opacity:1,scaleKeyframes:[],opacityKeyframes:[]})}
export function resetAudioAdjustments(audio,{bgm=false}={}){Object.assign(audio,{volume:bgm ? .3 : 1,fadeIn:0,fadeOut:0,delayEnabled:false,delayTime:.28,delayFeedback:.35,delayMix:.25,gainEnvelope:[],gainKeyframes:[]})}
