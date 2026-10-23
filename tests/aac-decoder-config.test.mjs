import assert from 'node:assert/strict';import{aacDecoderConfig,webkitVideoOptions}from'../dist/webkit-export-compat.js?v=2.2.84';
const asc={codec:'mp4a.40.2',description:new Uint8Array([0x11,0x90]),sampleRate:48000,numberOfChannels:2};assert.equal(aacDecoderConfig(asc),asc);
const data=Uint8Array.from(Buffer.from('038080802200000004808080144014001800000000000000000005808080021190068080800102','hex'));const before=Array.from(data);const config=aacDecoderConfig({...asc,description:data.buffer});assert.deepEqual([...config.description],[0x11,0x90]);assert.deepEqual([...data],before);assert.equal(config.sampleRate,48000);
const view=new Uint8Array(data.length+8);view.set(data,4);assert.deepEqual([...aacDecoderConfig({...asc,description:view.subarray(4,-4)}).description],[0x11,0x90]);
for(let n=1;n<data.length;n++)assert.throws(()=>aacDecoderConfig({...asc,description:data.subarray(0,n)}));
const wrong=data.slice();wrong[13]=0;assert.throws(()=>aacDecoderConfig({...asc,description:wrong}));assert.equal(aacDecoderConfig({codec:'opus',description:data}).codec,'opus');
console.log('AAC decoderConfig: WebKit ES_Descriptor parsing, ASC identity, views, truncation/malformed rejection PASS');

assert.deepEqual(webkitVideoOptions('AppleWebKit/605 Safari/605'),{latencyMode:'realtime'});assert.deepEqual(webkitVideoOptions('AppleWebKit/537 Chrome/155 Safari/537'),{});assert.deepEqual(webkitVideoOptions('AppleWebKit/537 Edg/155'),{});
