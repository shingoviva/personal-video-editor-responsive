const modes={
 eco:{label:'省メモリ',fps:24,description:'プレビュー更新を24fpsに抑え、非表示後10秒でデコーダを解放します。'},
 balanced:{label:'バランス',fps:30,description:'通常編集向け。画面を離れて30秒後にデコーダを解放します。'},
 quality:{label:'高画質',fps:60,description:'動きの確認を優先します。自動解放は行いません。'}
};
let current;try{current=globalThis.localStorage?.getItem('pve.iphone.preview-performance')}catch{}if(!modes[current])current=(globalThis.navigator?.deviceMemory||8)<=4?'eco':'balanced';
let timer;
export const performanceModes=modes;
export const performanceMode=()=>current;
export const previewFrameInterval=()=>1000/modes[current].fps;
export function setPerformanceMode(mode){if(!modes[mode])return current;current=mode;try{globalThis.localStorage?.setItem('pve.iphone.preview-performance',mode)}catch{}return current}
export function cancelIdleRelease(){clearTimeout(timer);timer=null}
export function scheduleIdleRelease(callback){cancelIdleRelease();const delay=current==='eco'?10000:current==='balanced'?30000:0;if(delay)timer=setTimeout(callback,delay)}
export function memorySnapshot(){const m=globalThis.performance?.memory;return{mode:current,deviceMemory:globalThis.navigator?.deviceMemory||null,used:m?.usedJSHeapSize||null,limit:m?.jsHeapSizeLimit||null}}
