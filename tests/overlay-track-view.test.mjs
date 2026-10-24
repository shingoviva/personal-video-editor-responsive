import assert from'node:assert/strict';import{refreshOverlayTrack}from'../dist/overlay-track-view.js?v=2.2.85';
let writes=0;const root={childElementCount:1,set innerHTML(v){writes++;this.html=v}},a={id:'a'};
assert.deepEqual(refreshOverlayTrack(root,'a',[a],'30/100'),{replaced:true,rebind:true});
assert.deepEqual(refreshOverlayTrack(root,'a',[a],'30/100'),{replaced:false,rebind:false});assert.equal(writes,1);
assert.deepEqual(refreshOverlayTrack(root,'a',[a],'30/200'),{replaced:false,rebind:true});
assert.deepEqual(refreshOverlayTrack(root,'a',[{...a}],'30/200'),{replaced:true,rebind:true}); // Undo/restore must replace stale geometry + callbacks.
assert.deepEqual(refreshOverlayTrack(root,'moved',[a],'30/200'),{replaced:true,rebind:true});
root.childElementCount=0;assert.equal(refreshOverlayTrack(root,'moved',[a],'30/200').replaced,true);
root.childElementCount=2;root.querySelectorAll=()=>[{}];assert.equal(refreshOverlayTrack(root,'moved',[a],'30/200').replaced,false); // lane resize handle is not a clip
console.log('Overlay track view: stable DOM, geometry rebind, Undo identity, movement and missing nodes PASS');
