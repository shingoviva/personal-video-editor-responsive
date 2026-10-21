export function safeName(name,extension){return(name||'Personal film').replace(/[^\p{L}\p{N} _-]/gu,'_')+'.'+extension;}
export function downloadable(file){const url=URL.createObjectURL(file);return{url,dispose:()=>URL.revokeObjectURL(url)};}
export function canShareFile(file){try{return!!navigator.share&&!!navigator.canShare?.({files:[file]})}catch{return false}}
export async function shareFile(file){if(!canShareFile(file))throw Error('このブラウザではファイル共有に対応していません。「ファイルとして保存」をお使いください。');await navigator.share({files:[file],title:file.name});}

// User-facing movie names are independent of collision-safe internal storage IDs.
export function movieName(name,extension='mp4'){
 const base=String(name||'').normalize('NFC').trim().replace(/\.(mp4|mov)$/iu,'').trim()||'Untitled film';
 return safeName([...base].slice(0,80).join(''),extension);
}
export function movieURL(url,name,extension,{download=false,base=globalThis.location?.href||'http://localhost/'}={}){
 const result=new URL(url,base);result.searchParams.set('filename',movieName(name,extension));
 if(download)result.searchParams.set('download','1');else result.searchParams.delete('download');
 return result.href;
}
