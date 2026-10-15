import assert from 'node:assert/strict';
import {sanitizeTexts,MAX_TEXT_LAYERS} from '../dist/model.js';
import {textStyle,textRasterPlacement} from '../dist/text-render.js';
import {captionPresets,captionDefaults,applyCaptionPreset,applyCaptionPresetStable} from '../dist/caption-presets.js';
import {textPose} from '../dist/creative.js';

const [text]=sanitizeTexts([{id:'title',text:'東京\nNIGHT',font:'Serif',align:'right',weight:'800',color:'#f2c8b0',box:'dark',outline:12,size:500,x:2,y:-1,opacity:2,fadeIn:8,fadeOut:-2,motion:'rise',motionDuration:4,start:1,end:0}]);
assert.equal(text.text,'東京\nNIGHT');
assert.equal(text.weight,800);
assert.equal(text.outline,12);
assert.equal(text.size,300);
assert.equal(text.x,1);
assert.equal(text.y,0);
assert.ok(text.end>text.start);
assert.equal(textStyle(text).outline,12);
assert.equal(textStyle(text).outlineColor,'#000000');
assert.equal(textStyle(text).box,'dark');
const [spaced]=sanitizeTexts([{text:'TYPE',letterSpacing:999,lineHeight:.1}]);
assert.equal(spaced.letterSpacing,50);assert.equal(spaced.lineHeight,.6);
assert.equal(sanitizeTexts(Array.from({length:MAX_TEXT_LAYERS+5},(_,i)=>({text:String(i)}))).length,MAX_TEXT_LAYERS);
assert.equal('raster' in sanitizeTexts([{text:'safe',raster:{data:'large'}}])[0],false);
const subtitle=captionDefaults(1,4,'subtitle');assert.equal(subtitle.outline,0);assert.equal(subtitle.y,.86);assert.equal(subtitle.shadow,false);
const custom={};applyCaptionPreset(custom,'lowerThird');assert.equal(custom.align,'left');assert.equal(custom.motion,'none');
const stable={font:'Serif',italic:true,size:71,x:.31,y:.68,align:'right',letterSpacing:2,lineHeight:1.4,motion:'pop'};applyCaptionPresetStable(stable,'tvImpact');assert.deepEqual({font:stable.font,italic:stable.italic,size:stable.size,x:stable.x,y:stable.y,align:stable.align,letterSpacing:stable.letterSpacing,lineHeight:stable.lineHeight,motion:stable.motion},{font:'Serif',italic:true,size:71,x:.31,y:.68,align:'right',letterSpacing:2,lineHeight:1.4,motion:'none'});
assert.equal(captionDefaults(0,2,'varietyYellow').outline,7);assert.equal(captionDefaults(0,2,'popPink').color,'#ff6fae');assert.equal(captionDefaults(0,2,'cornerTag').align,'left');
assert.equal(Object.keys(captionPresets).length,13);assert.equal(new Set(Object.values(captionPresets).map(p=>p.label)).size,13);assert.ok(Object.values(captionPresets).every(p=>p.sample&&p.description));assert.equal(captionPresets.headline.label,'ディープシャドウ');assert.equal(captionPresets.cornerTag.label,'ライム背景タグ');
const tv=captionDefaults(0,2,'tvBlueRed');assert.equal(tv.outerOutline,8);assert.deepEqual(tv.lineColors,['#ffffff','#b71318']);
const impact=captionDefaults(0,2,'tvImpact');impact.accentWords='欠かせない、モノ';const impactStyle=textStyle(impact);assert.equal(impactStyle.outerOutlineColor,'#ffffff');assert.deepEqual(impactStyle.accentWords,['欠かせない','モノ']);
const [decorated]=sanitizeTexts([{text:'装飾',outline:99,outlineColor:'#123456',shadow:true,shadowOpacity:2,shadowBlur:99,shadowX:-99,shadowY:99,box:'custom',boxColor:'#abcdef',boxOpacity:.4,boxPadding:.5,boxRadius:.2,motion:'pop'}]);
assert.equal(decorated.outline,20);assert.equal(decorated.shadowOpacity,1);assert.equal(decorated.shadowBlur,40);assert.equal(decorated.shadowX,-50);assert.equal(decorated.shadowY,50);assert.equal(decorated.box,'custom');assert.equal(decorated.motion,'pop');
assert.equal(sanitizeTexts([{text:'Italic',italic:true}])[0].italic,true);assert.equal(textStyle({text:'Italic',italic:true}).italic,true);
const raster={width:800,height:220,anchorX:400,anchorY:110,referenceWidth:1920,referenceHeight:1080},placed1080=textRasterPlacement({...subtitle,start:0,end:2},raster,1920,1080),placed4k=textRasterPlacement({...subtitle,start:0,end:2},raster,3840,2160);assert.equal(placed4k.scale,placed1080.scale*2);assert.equal(placed4k.x,placed1080.x*2);assert.equal(placed4k.y,placed1080.y*2);
const [rich]=sanitizeTexts([{text:'二重フチ',lineColors:['#112233','bad'],accentWords:'重要語',accentColor:'#ff817b',outerOutline:99,outerOutlineColor:'#abcdef'}]);assert.deepEqual(rich.lineColors,['#112233','#ffffff']);assert.equal(rich.accentWords,'重要語');assert.equal(rich.outerOutline,20);assert.equal(rich.outerOutlineColor,'#abcdef');
const [scaleText]=sanitizeTexts([{text:'ZOOM',start:2,end:8,motion:'scale',motionStart:1,motionEnd:4,motionScaleFrom:.5,motionScaleTo:2}]);assert.equal(textPose(scaleText,2.5).scale,.5);assert.ok(Math.abs(textPose(scaleText,4.5).scale-1.25)<1e-8);assert.equal(textPose(scaleText,7).scale,2);
const popText={text:'POP',start:0,end:3,motion:'pop',motionDuration:.3};assert.ok(textPose(popText,.05).scale<1);assert.equal(textPose(popText,2.9).scale,1);
console.log('Text layers: 300 captions, decoration, presets, validation and persisted raster exclusion PASS');

// Empty preview frames must not allocate, read layout or clear a full-size canvas.
const {TextPreview}=await import('../dist/text-render.js');
let contextReads=0,clears=0,draws=0,resizes=0,layoutReads=0;
const context=new Proxy({measureText:s=>({width:s.length*20}),clearRect(){clears++},fillText(){draws++}},{get:(o,k)=>o[k]??(()=>{})});
class NodeStub{
 constructor(tag){this.tag=tag;this.style={};this.dataset={};this.children=[];this.hidden=false;this._width=300;this._height=150;this.scrollWidth=100;this.scrollHeight=30}
 set width(v){resizes++;this._width=v}get width(){return this._width}
 set height(v){resizes++;this._height=v}get height(){return this._height}
 setAttribute(){}append(...n){this.children.push(...n)}prepend(n){this.children.unshift(n)}replaceChildren(...n){this.children=n}remove(){this.removed=true}
 getContext(){contextReads++;return context}
}
globalThis.document={createElement:t=>new NodeStub(t),createDocumentFragment:()=>new NodeStub('fragment'),createTextNode:s=>({textContent:s})};globalThis.devicePixelRatio=2;
const root=new NodeStub('root');Object.defineProperties(root,{clientWidth:{get(){layoutReads++;return 393}},clientHeight:{get(){layoutReads++;return 600}}});
const preview=new TextPreview(root),initialResizes=resizes;
for(let i=0;i<60;i++)preview.update([],i/30,1,true);
assert.equal(contextReads,0);assert.equal(layoutReads,0);assert.equal(resizes,initialResizes);assert.equal(preview.canvas.hidden,true);
const caption={id:'caption',text:'VISIBLE',start:0,end:3,x:.5,y:.5,size:48,opacity:1};
preview.update([caption],1,1,true);assert.equal(preview.canvas.width,786);assert.equal(preview.canvas.height,1200);assert.equal(preview.canvas.hidden,false);assert.ok(draws>0);
const oldNode=preview.nodes.get('caption');preview.update([],1,1,true);assert.equal(oldNode.removed,true);assert.equal(preview.nodes.size,0);assert.equal(preview.canvas.width,1);assert.equal(preview.canvas.height,1);assert.equal(preview.canvas.hidden,true);
const released={contextReads,clears,resizes,layoutReads};for(let i=0;i<60;i++)preview.update([],i/30,1,true);assert.deepEqual({contextReads,clears,resizes,layoutReads},released);
preview.update([caption],1,1,true);assert.equal(preview.canvas.hidden,false);assert.equal(preview.nodes.size,1);assert.equal(preview.canvas.width,786);assert.notEqual(preview.nodes.get('caption'),oldNode);
preview.clear();preview.update([caption],1,1,false);assert.equal(preview.canvas.hidden,false,'caption returns after memory release without changing the project');
delete globalThis.document;delete globalThis.devicePixelRatio;
console.log('Caption resource lifecycle: zero empty-frame canvas work, release, undo/reappearance and redraw PASS');

// The application's actual memory-release action must reach both resource owners.
const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm');
const {StabilizationPreview}=await import('../dist/stabilization-preview.js');
const appSource=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
assert.match(appSource,/function renderTimeline\(\)\{\s*stabilizationPreview\.reconcile\(P\.clips,mediaOf/);
let terminated=0,paused=0,audioReleased=0;
globalThis.Worker=class{postMessage(){}terminate(){terminated++}};
const stabilization=new StabilizationPreview(),stabilizedClip={id:'clip',in:0,out:2,stabilization:'NATURAL'},m={id:'media'},f={name:'source.mov',size:10,lastModified:1};
stabilization.ensure(stabilizedClip,m,f);
const voice=()=>({dataset:{url:'old',key:'old'},pause(){},removeAttribute(){},load(){}});
const currentProject={name:'Preserve project',texts:[caption]};
const scope={P:currentProject,pause(){paused++},stabilizationPreview:stabilization,textPreview:preview,lowerPreviews:[],transitionPreview:{clear(){}},stillPreview:{clear(){}},painter:{release(){}},loadController:null,loadPromise:null,loadGeneration:0,lookThumbPainter:null,lookThumbCanvas:null,video:voice(),standbyVideo:voice(),audioPreview:{dispose(){audioReleased++}},status(){}};
const releaseAction=appSource.split('\n').find(line=>line.startsWith('function releasePreviewMemory('));
const pictureAction=appSource.split('\n').find(line=>line.startsWith('function releasePictureResources(')),lookAction=appSource.split('\n').find(line=>line.startsWith('function releaseLookThumbnails('));
runInNewContext(lookAction+';'+pictureAction+';'+releaseAction+';releasePreviewMemory();',scope);
assert.equal(scope.previewMemoryReleased,true);assert.equal(terminated,1);assert.equal(stabilization.pending.size,0);assert.equal(preview.canvas.width,1);assert.equal(preview.canvas.hidden,true);assert.equal(scope.P,currentProject);assert.equal(paused,1);assert.equal(audioReleased,1);
let paints=0;Object.assign(scope,{playing:false,drawnAt:0,document:{body:{dataset:{ui:'desktop'}}},performance:{now:()=>1000},paintPreview(){paints++},previewRow:()=>({clip:{gap:1}}),time:0,linkURL(){}});scope.audioPreview.sync=()=>{};
const drawAction=appSource.split('\n').find(line=>line.startsWith('function draw('));runInNewContext(drawAction+';draw();',scope);assert.equal(paints,0,'queued stopped-frame callbacks cannot recreate resources after release');
const syncAction=appSource.slice(appSource.indexOf('async function syncVideo('),appSource.indexOf('function localSpeed('));runInNewContext(syncAction,scope);await scope.syncVideo(true);assert.equal(scope.previewMemoryReleased,false);assert.equal(paints,1,'an explicit media sync enables drawing again');
globalThis.document={createElement:t=>new NodeStub(t),createDocumentFragment:()=>new NodeStub('fragment'),createTextNode:s=>({textContent:s})};
preview.update(currentProject.texts,1,1,false);assert.equal(preview.canvas.hidden,false);stabilization.ensure(stabilizedClip,m,f);assert.equal(stabilization.pending.size,1);stabilization.clear();
delete globalThis.Worker;delete globalThis.document;
console.log('Application memory release: cancels analysis, releases captions, preserves edits and permits recreation PASS');
