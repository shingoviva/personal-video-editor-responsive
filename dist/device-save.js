export function safeName(name,extension){return(name||'Personal film').replace(/[^\p{L}\p{N} _-]/gu,'_')+'.'+extension;}
export function downloadable(file){const url=URL.createObjectURL(file);return{url,dispose:()=>URL.revokeObjectURL(url)};}
export function canShareFile(file){try{return!!navigator.share&&!!navigator.canShare?.({files:[file]})}catch{return false}}
export async function shareFile(file){if(!canShareFile(file))throw Error('このブラウザではファイル共有に対応していません。「ファイルとして保存」をお使いください。');await navigator.share({files:[file],title:file.name});}
