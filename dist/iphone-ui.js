import {translate,translateDOM} from './i18n.js';
export function phoneLayout({width,height,coarse,iphone}){
 return !!iphone||(!!coarse&&Math.min(width,height)<=600)||width<=600;
}
export function bindPhoneUI({openTab,command,refresh,pause}){
 const body=document.body,$=id=>document.getElementById(id),coarse=matchMedia('(pointer:coarse)');
 const backdrop=$('phoneSheetBackdrop'),header=$('phoneSheetHeader'),close=$('phoneSheetClose');
 let panel=null,opener=null,focusReturn=null;
 const names={library:'素材ライブラリ',import:'素材の情報',cut:'クリップ編集',adjust:'カラー',look:'ルック',text:'テキスト',sound:'音声',more:'プロジェクトとツール'};
 const menu=document.createElement('section');menu.className='phone-only phone-menu';menu.hidden=true;menu.setAttribute('aria-label',names.more);
 menu.innerHTML='<div class="phone-menu-grid">'+[['openProject','開く'],['saveProject','プロジェクト保存'],['undo','元に戻す'],['redo','やり直す'],['previewInfo','プレビュー設定'],['engineButton','端末の対応状況'],['helpButton','ヘルプ'],['languageToggle','日本語 / English']].map(([id,label])=>`<button data-phone-command="${id}">${label}</button>`).join('')+'<button data-phone-panel="motion">モーション</button><button data-phone-panel="fx">エフェクト</button><button data-phone-panel="analyze">解析</button></div>';body.append(menu);
 function dismiss(){panel=null;delete body.dataset.phonePanel;backdrop.hidden=header.hidden=menu.hidden=true;body.classList.remove('media-expanded','inspector-expanded');document.querySelectorAll('[data-phone-panel]').forEach(b=>b.setAttribute('aria-expanded','false'));for(const el of focusReturn||[])el.inert=false;focusReturn=null;opener?.focus();refresh()}
 function open(value,button){if(body.dataset.ui!=='phone')return;pause();opener=button||document.activeElement;panel=value;body.dataset.phonePanel=value;body.classList.remove('media-expanded','inspector-expanded');
  $('phoneSheetTitle').textContent=translate(names[value]||({motion:'モーション',fx:'エフェクト',analyze:'解析'}[value]));backdrop.hidden=header.hidden=false;menu.hidden=value!=='more';
  if(value!=='more')openTab(value==='library'?'import':value);
  focusReturn=[document.querySelector('.viewer-panel'),document.querySelector('.timeline-panel'),document.querySelector('.topbar'),document.querySelector('.phone-tools'),document.querySelector('.phone-clip-actions')];for(const el of focusReturn)el.inert=true;
  document.querySelectorAll('[data-phone-panel]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.phonePanel===value)));translateDOM(header);translateDOM(menu);close.focus();refresh();
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-phone-panel],[data-phone-command]');if(!button)return;
  if(button.dataset.phonePanel)open(button.dataset.phonePanel,button);else{const id=button.dataset.phoneCommand;if(panel)dismiss();command(id)}
  if(event.target.closest('[data-use-asset]'))dismiss();
 });
 // Existing asset placement buttons keep their native action and dismiss afterwards.
 document.querySelector('.media-panel').addEventListener('click',e=>{if(e.target.closest('[data-use-asset]'))requestAnimationFrame(dismiss);else if(e.target.closest('[data-manage-asset]'))open('import',e.target.closest('button'))});
 backdrop.onclick=close.onclick=dismiss;
 document.addEventListener('keydown',e=>{if(!panel||$('modal').open)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss()}if(e.key==='Tab'){
  const surface=panel==='library'?document.querySelector('.media-panel'):panel==='more'?menu:document.querySelector('.inspector');
  const items=[close,...surface.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);const i=items.indexOf(document.activeElement);e.preventDefault();items[(i+(e.shiftKey?-1:1)+items.length)%items.length]?.focus();
 }},true);
 $('phoneMove').onclick=()=>{const active=body.classList.toggle('phone-moving');$('phoneMove').setAttribute('aria-pressed',String(active));$('phoneMove').textContent=translate(active?'移動中':'移動');$('statusLine').textContent=active?'クリップをドラッグして移動。両端で長さを調整できます。':'クリップ上をスワイプしてスクロール。タップして選択。'};
 $('phoneLayers').onclick=()=>{const all=body.classList.toggle('phone-all-layers');$('phoneLayers').setAttribute('aria-pressed',String(all));$('phoneLayers').textContent=translate(all?'映像中心':'全レイヤー');$('timelineScroll').scrollTop=0;refresh()};
 function update(){const phone=phoneLayout({width:innerWidth,height:innerHeight,coarse:coarse.matches,iphone:/iPhone|iPod/.test(navigator.userAgent)});const next=phone?'phone':'desktop';if(body.dataset.ui===next)return;dismiss();body.dataset.ui=next;body.classList.remove('phone-moving');$('phoneMove').setAttribute('aria-pressed','false');refresh()}
 addEventListener('resize',update);coarse.addEventListener('change',update);update();
 // Only populated video lanes are shown in the compact view; all layers remain available.
 const observer=new MutationObserver(()=>{document.querySelectorAll('[data-phone-command]').forEach(b=>{b.disabled=!!$(b.dataset.phoneCommand)?.disabled});for(const id of ['videoTrackTop','videoTrackUpper']){const lane=$(id),empty=!lane.querySelector('[data-clip]');lane.classList.toggle('phone-empty-lane',empty);document.querySelector(`[data-videohead="${id==='videoTrackTop'?2:1}"]`).classList.toggle('phone-empty-lane',empty)}});
 observer.observe($('timelineContent'),{childList:true,subtree:true});
}
