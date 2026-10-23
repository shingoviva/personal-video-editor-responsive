// Some WebKit AAC encoders return an ES_Descriptor where WebCodecs expects
// DecoderSpecificInfo (AudioSpecificConfig). Parse the descriptor, never scan
// for a byte pattern or infer an encoder delay.
export function aacDecoderConfig(config){
 if(config?.codec!=='mp4a.40.2'||!config.description)return config;
 const d=config.description,b=ArrayBuffer.isView(d)?new Uint8Array(d.buffer,d.byteOffset,d.byteLength):new Uint8Array(d);
 if(b[0]!==3)return config;
 const descriptor=(at,end)=>{const tag=b[at++];let size=0,done=false;for(let n=0;n<4&&at<end;n++){const v=b[at++];size=size*128+(v&127);if(!(v&128)){done=true;break}}if(!done||at+size>end)throw Error('AACのdecoderConfigが不正です。');return{tag,start:at,end:at+size}};
 const es=descriptor(0,b.length);if(es.tag!==3||es.end!==b.length||es.end-es.start<3)throw Error('AACのES descriptorが不正です。');
 let at=es.start+2;const flags=b[at++];if(flags&128)at+=2;if(flags&64){if(at>=es.end)throw Error('AACのURL descriptorが不正です。');at+=1+b[at]}if(flags&32)at+=2;
 const decoder=descriptor(at,es.end);if(decoder.tag!==4||decoder.end-decoder.start<13||b[decoder.start]!==64||b[decoder.start+1]>>2!==5)throw Error('AACのDecoderConfig descriptorが不正です。');
 const specific=descriptor(decoder.start+13,decoder.end);if(specific.tag!==5||specific.end-specific.start<2)throw Error('AACのAudioSpecificConfigを確認できません。');
 return{...config,description:b.slice(specific.start,specific.end)};
}

// WebKit's quality encoder can retain more frames than the bounded source queue
// permits. Real-time mode emits frames while the timeline continues feeding it.
export function webkitVideoOptions(userAgent=globalThis.navigator?.userAgent||''){
 return /AppleWebKit\//.test(userAgent)&&!/(?:Chrome|Chromium|Edg|OPR)\//.test(userAgent)?{latencyMode:'realtime'}:{};
}
