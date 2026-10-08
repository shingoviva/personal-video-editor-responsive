import {sequence,audioSequence,timing,trimClip,anchor} from './model.js';
import {syncLinkedAudio} from './linked-audio.js';
export function reorderPhoneClip(p,id,direction){
 const c=[...p.clips,...p.audioClips].find(c=>c.id===id);if(!c)return false;
 const rows=(c.kind==='audio'?audioSequence(p):sequence(p)).filter(r=>r.layer===(c.layer||0)).sort((a,b)=>a.start-b.start),i=rows.findIndex(r=>r.clip.id===id),other=rows[i+direction];if(!other)return false;
 const [a,b]=[rows[i],other].sort((a,b)=>a.start-b.start);if(a.end>b.start+.0001)throw Error('重なったクリップは、配置時刻で調整してください。');
 anchor(p);const gap=Math.max(0,b.start-a.end);b.clip.start=a.start;a.clip.start=a.start+b.duration+gap;syncLinkedAudio(p,a.clip);syncLinkedAudio(p,b.clip);return true;
}
export function trimPhoneClip(p,c,{input,output,length,limit,ripple=true}){
 const rows=c.kind==='audio'?audioSequence(p):sequence(p),row=rows.find(r=>r.clip.id===c.id);if(!row)throw Error('クリップを選択してください。');
 const old=row.duration;
 if(c.kind==='image'||c.freezeDuration){if(!Number.isFinite(length)||length<.1||length>3600)throw Error('表示時間は0.1〜3600秒です。');}
 else if(!Number.isFinite(input)||!Number.isFinite(output)||input<0||output-input<.1||output>limit+.001)throw Error('開始・終了を素材の範囲内で指定してください（最短0.1秒）。');
 anchor(p);if(c.freezeDuration)c.freezeDuration=length;else if(c.kind==='image'){c.in=0;c.out=length;}else{if(output>c.out)trimClip(c,'out',output,limit);trimClip(c,'in',input,limit);trimClip(c,'out',output,limit);}
 const delta=timing(c).duration-old;if(ripple)for(const r of rows)if(r.clip.id!==c.id&&r.layer===row.layer&&r.start>=row.end-.0001){r.clip.start=Math.max(0,r.start+delta);syncLinkedAudio(p,r.clip)}
 syncLinkedAudio(p,c);return c;
}
