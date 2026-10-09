import assert from 'node:assert/strict';
import {project,sanitize,clip} from '../dist/model.js';
import {addEditMarker,nextEditMarker,sanitizeEditMarkers} from '../dist/edit-markers.js';
const p=project(),m={id:'m',duration:8};p.media=[m];p.clips=[clip(m)];const clips=JSON.stringify(p.clips);
addEditMarker(p,3,'later');addEditMarker(p,1,'earlier');assert.equal(JSON.stringify(p.clips),clips,'marking leaves clips intact');assert.equal(addEditMarker(p,1,'repeat'),null);assert.equal(nextEditMarker(p.editMarkers,1,1).id,'later');assert.equal(nextEditMarker(p.editMarkers,3,-1).id,'earlier');assert.equal(nextEditMarker(p.editMarkers,4,1),undefined);
const restored=sanitize(JSON.parse(JSON.stringify(p)));assert.deepEqual(restored.editMarkers,p.editMarkers,'markers survive project roundtrip');assert.deepEqual(sanitizeEditMarkers([{id:'bad',time:NaN},{id:'neg',time:-1},null]),[]);
const old=project();delete old.editMarkers;assert.deepEqual(sanitize(old).editMarkers,[],'old projects remain readable');console.log('Edit markers preserve clips, sorted navigation, duplicate rejection, old project and roundtrip PASS');
