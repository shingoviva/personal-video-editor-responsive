import assert from'node:assert/strict';import{project,sanitize}from'../dist/model.js?v=2.2.85';
for(const n of[100,101,200,400]){const p=project();p.effects=Array.from({length:n},(_,i)=>({id:'f'+i,type:'flash',start:i*.05,duration:.16}));const next=sanitize(structuredClone(p));assert.equal(next.version,n>100?2:1);assert.equal(sanitize(JSON.parse(JSON.stringify(next))).effects.length,n)}
const migrated=project();migrated.version=2;assert.equal(sanitize(migrated).version,2);assert.throws(()=>sanitize({...project(),version:3}));
console.log('FX compatibility: >100 requires guarded format 2, new/legacy round-trip, reduced v2 remains protected PASS');
