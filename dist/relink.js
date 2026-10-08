const normalized=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}]+/gu,'');
const kindOf=file=>file.kind||(/^image\//.test(file.type)?'image':/^audio\//.test(file.type)?'audio':'video');
export function relinkScore(media,file){
 let score=0,reasons=[];const expected=normalized(media.name),actual=normalized(file.name);
 if(expected&&actual===expected){score+=55;reasons.push('名前一致')}else if(expected&&actual&&(expected.includes(actual)||actual.includes(expected))){score+=28;reasons.push('名前が近い')}
 const size=Math.max(0,+file.size||0),target=Math.max(0,+media.size||0);if(size&&target){const ratio=Math.abs(size-target)/target;if(ratio<.001){score+=25;reasons.push('容量一致')}else if(ratio<.02){score+=18;reasons.push('容量が近い')}else if(ratio<.1){score+=8;reasons.push('容量差10%以内')}}
 if(kindOf(file)===(media.kind||'video')){score+=15;reasons.push('種類一致')}
 if(media.duration&&file.duration&&Math.abs(media.duration-file.duration)<.08){score+=5;reasons.push('尺一致')}
 return{score:Math.min(100,score),reasons};
}
export function rankRelinkCandidates(media,files=[]){return files.map(file=>({file,...relinkScore(media,file)})).sort((a,b)=>b.score-a.score||a.file.name.localeCompare(b.file.name));}
