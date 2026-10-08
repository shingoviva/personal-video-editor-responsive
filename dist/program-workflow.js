import {clamp,uid,total,MAX_TEXT_LAYERS} from './model.js';
import {captionDefaults} from './caption-presets.js';

export function dialogueLines(value){return String(value||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean).slice(0,MAX_TEXT_LAYERS)}

export function sequentialCaptions(value,{start=0,duration=2.4,gap=0,limit=86400,style={},id=uid}={}){
 const lines=dialogueLines(value),span=clamp(duration,.2,120),space=clamp(gap,0,10),result=[];let at=clamp(start,0,limit);
 for(const text of lines){const end=Math.min(limit,at+span);if(end-at<1/60)break;result.push({...captionDefaults(at,end,'subtitle'),...structuredClone(style),id:id(),text,start:at,end});at=end+space}
 return result
}

export function youtubeProgramPlan(total,{title='TITLE',hold=1.6,fade=1,outro=1}={}){
 const end=Math.max(1/30,+total||0),introHold=clamp(hold,0,Math.max(0,end-1/30)),introFade=clamp(fade,1/30,Math.max(1/30,end-introHold)),introDuration=Math.min(end,introHold+introFade),outroDuration=clamp(outro,1/30,end),titleEnd=Math.min(end,introDuration);
 return{
  aspect:'16:9',
  effects:[
   {id:uid(),type:'black-in',start:0,duration:introDuration,hold:Math.min(introHold,introDuration-1/60),strength:1},
   {id:uid(),type:'black-out',start:Math.max(0,end-outroDuration),duration:outroDuration,hold:Math.min(.25,outroDuration/3),strength:1}
  ],
  text:{id:uid(),...captionDefaults(0,titleEnd,'headline'),text:String(title||'TITLE').slice(0,2000),start:0,end:titleEnd,fadeIn:Math.min(.25,introHold/3),fadeOut:Math.min(introFade,titleEnd/2),motion:'none'},
  export:{preset:'YOUTUBE',aspect:'AUTO',resolution:'1080p',fps:'30',quality:'High',codec:'H.264'}
 }
}

export function applyYoutubeProgram(project,options={}){
 if(!project?.clips?.length)throw Error('先に動画をタイムラインへ配置してください。');
 if((project.effects?.length||0)>18)throw Error('画面効果の空きが2個必要です。');
 if((project.texts?.length||0)>=MAX_TEXT_LAYERS)throw Error('テロップの空きが必要です。');
 const plan=youtubeProgramPlan(total(project),options);
 project.aspect=plan.aspect;project.effects.push(...plan.effects);project.texts.push(plan.text);project.export=plan.export;return plan
}
