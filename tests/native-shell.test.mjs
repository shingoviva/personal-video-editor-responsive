import assert from 'node:assert/strict';
import {shouldBlockBrowserZoom,isBrowserZoomShortcut,bindNativeShell} from '../dist/native-shell.js';

const timelineTarget={},outside={},timeline={contains:target=>target===timelineTarget,getBoundingClientRect:()=>({left:100,right:500,top:600,bottom:900})};
assert.equal(shouldBlockBrowserZoom({type:'wheel',ctrlKey:true,target:outside},timeline),true);
assert.equal(shouldBlockBrowserZoom({type:'wheel',ctrlKey:true,target:timelineTarget},timeline),false);
assert.equal(shouldBlockBrowserZoom({type:'touchmove',touches:[{},{}],target:outside},timeline),true);
assert.equal(shouldBlockBrowserZoom({type:'gesturechange',target:outside},timeline),true);
assert.equal(shouldBlockBrowserZoom({type:'gesturechange',target:outside,clientX:300,clientY:700},timeline),false);
assert.equal(shouldBlockBrowserZoom({type:'wheel',target:outside},timeline),false);
assert.equal(isBrowserZoomShortcut({metaKey:true,code:'Equal'}),true);
assert.equal(isBrowserZoomShortcut({ctrlKey:true,code:'Digit0'}),true);
assert.equal(isBrowserZoomShortcut({ctrlKey:true,code:'KeyC'}),false);

const listeners=new Map(),root={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type)=>listeners.delete(type)};let prevented=0,stopped=0;
bindNativeShell({root,timeline});listeners.get('wheel')({type:'wheel',ctrlKey:true,target:outside,preventDefault:()=>prevented++,stopPropagation:()=>stopped++});
assert.equal(prevented,1);assert.equal(stopped,1);
console.log('Native shell: page zoom suppression, timeline gesture pass-through and shortcut guards PASS');
