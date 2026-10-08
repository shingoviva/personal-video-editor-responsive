import {translate,translateDOM} from './i18n.js';
export function phoneLayout({width,height,coarse,iphone}){
 return !!iphone||(!!coarse&&Math.min(width,height)<=600)||width<=600;
}
export function bindPhoneUI({openTab,command,refresh,pause,getState,selectItem,scrub,setZoom,edit}){
 const body=document.body,$=id=>document.getElementById(id),coarse=matchMedia('(pointer:coarse)');
 const backdrop=$('phoneSheetBackdrop'),header=$('phoneSheetHeader'),close=$('phoneSheetClose');
 let panel=null,opener=null,focusReturn=null,lastState='',scrubFrame=0,initialZoom=false;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const layout=document.querySelector('.timeline-layout'),sequenceBar=document.createElement('div');sequenceBar.className='phone-only phone-sequence';sequenceBar.setAttribute('aria-label','クリップ一覧');layout.before(sequenceBar);
 const scrubber=document.createElement('div');scrubber.className='phone-only phone-scrubber';scrubber.innerHTML='<label for="phoneScrub">再生位置</label><input id="phoneScrub" type="range" min="0" max="1" step="0.0333333333" value="0" aria-label="再生位置を調整"><output id="phoneScrubTime">0.00秒</output>';layout.before(scrubber);
 const quick=document.createElement('section');quick.className='phone-only phone-quick';quick.hidden=true;document.querySelector('.inspector').prepend(quick);
 const fit=document.createElement('button');fit.className='phone-only';fit.id='phoneFit';fit.textContent='全体';$('phoneLayers').after(fit);fit.onclick=()=>{setZoom(1);$('timelineScroll').scrollLeft=0};
 const actions=document.querySelector('.phone-clip-actions');actions.innerHTML='<button data-phone-command="split">分割</button><button data-phone-command="ripple">削除</button><button data-phone-command="duplicateClip">複製</button><button data-phone-command="undo">元に戻す</button><button id="phoneMove" aria-pressed="false">移動</button>';
 sequenceBar.onclick=e=>{const b=e.target.closest('[data-phone-item]');if(b){selectItem(b.dataset.kind,b.dataset.phoneItem);sync()}};
 $('phoneScrub').oninput=()=>{const value=+$('phoneScrub').value;$('phoneScrubTime').value=value.toFixed(2)+'秒';if(scrubFrame)cancelAnimationFrame(scrubFrame);scrubFrame=requestAnimationFrame(()=>{scrubFrame=0;scrub(value)})};
 function syncClock(){if(body.dataset.ui!=='phone')return;const state=getState();$('phoneScrub').max=Math.max(state.duration,.001);if(document.activeElement!==$('phoneScrub'))$('phoneScrub').value=state.time;$('phoneScrubTime').value=state.time.toFixed(2)+'秒'}
 window.addEventListener('pve-phone-clock',syncClock);
 function sync(){if(body.dataset.ui!=='phone')return;const state=getState(),chosen=state.items.find(i=>i.selected),key=JSON.stringify(state.items);syncClock();
  if(!initialZoom&&state.items.length){initialZoom=true;setZoom(1)}
  if(key===lastState)return;lastState=key;
  if(chosen&&chosen.kind!=='video'){body.classList.add('phone-all-layers');$('phoneLayers').setAttribute('aria-pressed','true');$('phoneLayers').textContent=translate('映像中心');const lane=$(chosen.kind==='audio'?'audioTrack'+chosen.layer:'overlayTrack'+chosen.layer);if(lane)$('timelineScroll').scrollTop=Math.max(0,lane.offsetTop-34)}
  sequenceBar.innerHTML=state.items.map(i=>`<button data-phone-item="${i.id}" data-kind="${i.kind}" aria-pressed="${i.selected}" class="${i.selected?'selected':''}"><small>${{video:'V',audio:'A',text:'T',effect:'FX'}[i.kind]}${i.layer+1} · ${i.length.toFixed(2)}秒</small><strong>${esc(i.name)}</strong></button>`).join('')||'<span>素材を追加すると、ここから選択できます。</span>';
  if(panel==='sound'){quick.innerHTML=chosen?.audio&&(chosen.kind==='audio'||chosen.hasAudio)?`<strong class="phone-selection-name">${esc(chosen.name)}</strong><label>音量 <output>${Math.round(chosen.audio.volume*100)}%</output><input id="phoneVolume" aria-label="選択クリップの音量" type="range" min="0" max="2" step=".01" value="${chosen.audio.volume}"></label><button id="phoneMute" aria-pressed="${!!chosen.audio.mute}">${chosen.audio.mute?'音声：ミュート中':'音声：オン（タップでミュート）'}</button>${chosen.kind==='video'?`<button data-phone-command="detachAudio" ${chosen.detached?'disabled':''}>${chosen.detached?'原音は分離済み':'原音を分離して編集'}</button>`:''}<p class="small-note">フェード・各トラックの音量は下で調整できます。</p>`:'<p>音声のあるクリップを選択してください。</p>';const v=$('phoneVolume');if(v)v.oninput=()=>v.previousElementSibling.value=Math.round(v.value*100)+'%';translateDOM(quick);return}
  const selectedCard=sequenceBar.querySelector('.selected');if(selectedCard){const x=selectedCard.offsetLeft-sequenceBar.offsetLeft;if(x<sequenceBar.scrollLeft||x+selectedCard.offsetWidth>sequenceBar.scrollLeft+sequenceBar.clientWidth)sequenceBar.scrollLeft=Math.max(0,x-8)}
  if(!chosen){quick.innerHTML='<p>下のクリップ一覧から選択してください。</p>';return}
  quick.innerHTML=`<strong class="phone-selection-name">${esc(chosen.name)}</strong><div class="phone-quick-grid">${chosen.still?`<label>表示時間（秒）<input id="phoneLength" type="number" min=".1" max="3600" step=".1" value="${chosen.length.toFixed(3)}"></label>`:`<label>開始（秒）<input id="phoneIn" type="number" min="0" step=".01" value="${chosen.input.toFixed(3)}"></label><label>終了（秒）<input id="phoneOut" type="number" min="0" step=".01" value="${chosen.output.toFixed(3)}"></label>`}</div><label class="phone-ripple-option"><input id="phoneRippleTrim" type="checkbox" checked> 後ろのクリップも詰める</label><button id="phoneApplyTrim" class="primary">範囲を適用</button><div class="phone-quick-grid"><button data-phone-command="setIn">開始を再生位置に</button><button data-phone-command="setOut">終了を再生位置に</button></div><div class="phone-quick-grid"><button id="phoneEarlier" ${['video','audio'].includes(chosen.kind)?'':'disabled'}>順番を前へ</button><button id="phoneLater" ${['video','audio'].includes(chosen.kind)?'':'disabled'}>順番を後ろへ</button></div><label>配置時刻（秒）<input id="phonePosition" type="number" min="0" step=".01" value="${chosen.start.toFixed(3)}"></label><button id="phoneApplyPosition">配置時刻を適用</button><button id="phoneFocusClip">選択クリップを拡大</button>${chosen.kind==='video'?'<button data-phone-panel="detail">位置・画面・トランジション</button>':''}`;
  $('phoneApplyTrim').onclick=()=>edit('trim',{input:+$('phoneIn')?.value,output:+$('phoneOut')?.value,length:+$('phoneLength')?.value,ripple:$('phoneRippleTrim').checked});$('phoneEarlier').onclick=()=>edit('reorder',-1);$('phoneLater').onclick=()=>edit('reorder',1);$('phoneApplyPosition').onclick=()=>edit('place',+$('phonePosition').value);$('phoneFocusClip').onclick=()=>{setZoom(Math.max(1,Math.min(10,state.extent*.7/Math.max(.1,chosen.length))));$('timelineScroll').scrollLeft=chosen.start/state.extent*$('timelineContent').clientWidth;dismiss()};
  translateDOM(sequenceBar);translateDOM(quick);
 }

 quick.addEventListener('change',e=>{if(e.target.id==='phoneVolume')edit('volume',+e.target.value)});quick.addEventListener('click',e=>{if(e.target.id==='phoneMute')edit('mute',e.target.getAttribute('aria-pressed')!=='true')});
 const names={library:'素材ライブラリ',import:'素材の情報',cut:'クリップ編集',detail:'位置・画面・トランジション',adjust:'カラー',look:'ルック',text:'テキスト',sound:'音声',more:'プロジェクトとツール'};
 const menu=document.createElement('section');menu.className='phone-only phone-menu';menu.hidden=true;menu.setAttribute('aria-label',names.more);
 menu.innerHTML='<div class="phone-menu-grid">'+[['openProject','開く'],['saveProject','プロジェクト保存'],['undo','元に戻す'],['redo','やり直す'],['previewInfo','プレビュー設定'],['engineButton','端末の対応状況'],['helpButton','ヘルプ'],['languageToggle','日本語 / English']].map(([id,label])=>`<button data-phone-command="${id}">${label}</button>`).join('')+'<button data-phone-panel="motion">モーション</button><button data-phone-panel="fx">エフェクト</button><button data-phone-panel="analyze">解析</button></div>';body.append(menu);
 function dismiss(){panel=null;delete body.dataset.phonePanel;backdrop.hidden=header.hidden=menu.hidden=true;body.classList.remove('media-expanded','inspector-expanded');document.querySelectorAll('[data-phone-panel]').forEach(b=>b.setAttribute('aria-expanded','false'));for(const el of focusReturn||[])el.inert=false;focusReturn=null;opener?.focus();refresh()}
 function open(value,button){if(body.dataset.ui!=='phone')return;pause();opener=button||document.activeElement;panel=value;body.dataset.phonePanel=value;body.classList.remove('media-expanded','inspector-expanded');
  $('phoneSheetTitle').textContent=translate(names[value]||({motion:'モーション',fx:'エフェクト',analyze:'解析'}[value]));backdrop.hidden=header.hidden=false;menu.hidden=value!=='more';
  if(value!=='more')openTab(value==='library'?'import':value==='detail'?'cut':value);quick.hidden=!['cut','sound'].includes(value);lastState='';sync();
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
 window.addEventListener('pve-phone-imported',dismiss);
 document.addEventListener('keydown',e=>{if(!panel||$('modal').open)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss()}if(e.key==='Tab'){
  const surface=panel==='library'?document.querySelector('.media-panel'):panel==='more'?menu:document.querySelector('.inspector');
  const items=[close,...surface.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);const i=items.indexOf(document.activeElement);e.preventDefault();items[(i+(e.shiftKey?-1:1)+items.length)%items.length]?.focus();
 }},true);
 $('phoneMove').onclick=()=>{const active=body.classList.toggle('phone-moving');$('phoneMove').setAttribute('aria-pressed',String(active));$('phoneMove').textContent=translate(active?'移動中':'移動');$('statusLine').textContent=active?'クリップをドラッグして移動。両端で長さを調整できます。':'クリップ上をスワイプしてスクロール。タップして選択。'};
 $('phoneLayers').onclick=()=>{const all=body.classList.toggle('phone-all-layers');$('phoneLayers').setAttribute('aria-pressed',String(all));$('phoneLayers').textContent=translate(all?'映像中心':'全レイヤー');$('timelineScroll').scrollTop=0;refresh()};
 function update(){const phone=phoneLayout({width:innerWidth,height:innerHeight,coarse:coarse.matches,iphone:/iPhone|iPod/.test(navigator.userAgent)});const next=phone?'phone':'desktop';if(body.dataset.ui===next)return;dismiss();body.dataset.ui=next;body.classList.remove('phone-moving');$('phoneMove').setAttribute('aria-pressed','false');refresh();sync()}
 addEventListener('resize',update);coarse.addEventListener('change',update);update();
 // Only populated video lanes are shown in the compact view; all layers remain available.
 const updateTimeline=()=>{sync();document.querySelectorAll('[data-phone-command]').forEach(b=>{b.disabled=!!$(b.dataset.phoneCommand)?.disabled||(b.dataset.phoneCommand==='duplicateClip'&&!getState().items.some(i=>i.selected))});for(const id of ['videoTrackTop','videoTrackUpper']){const lane=$(id),empty=!lane.querySelector('[data-clip]');lane.classList.toggle('phone-empty-lane',empty);document.querySelector(`[data-videohead="${id==='videoTrackTop'?2:1}"]`).classList.toggle('phone-empty-lane',empty)}};const observer=new MutationObserver(updateTimeline);
 observer.observe($('timelineContent'),{childList:true,subtree:true});updateTimeline();document.addEventListener('pointerup',e=>{if(!e.target.closest('.phone-quick'))requestAnimationFrame(sync)});
}
