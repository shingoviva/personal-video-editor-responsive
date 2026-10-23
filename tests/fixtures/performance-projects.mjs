import {project,clip} from '../../dist/model.js?v=2.2.84';
// Deterministic synthetic projects; source bytes are supplied separately by the harness.
export function performanceProject(scenario='A',metadata={}){
 const p=project();p.id='performance-fixture';p.name='Performance fixture';p.aspect='16:9';const m={id:'fixture-media',name:'fixture.mp4',kind:'video',width:1920,height:1080,duration:8,fps:30,codec:'AVC',audio:true,hdr:false,...metadata};p.media=[m];
 const video=(id,layer=0)=>({...clip(m),id,start:0,layer,out:8});p.clips=[video('base')];
 if(['B','F'].includes(scenario))for(const c of p.clips)c.color={...c.color,exposure:.2,contrast:20,saturation:-10,sharpness:15};
 if(['C','F'].includes(scenario)){const middle=video('middle',1),top=video('top',2),next=video('next',2);middle.opacity=.7;top.opacity=.6;top.out=4;next.in=4;next.start=4;next.opacity=.6;next.transition={type:'dissolve',duration:.8,direction:'left'};p.clips.push(middle,top,next)}
 if(['D','F'].includes(scenario))p.texts=[{id:'caption',text:'PERFORMANCE TEST',start:0,end:8,size:90,x:.5,y:.85,opacity:1,outline:3,outerOutline:2,shadow:true,shadowBlur:8,shadowX:2,shadowY:2,letterSpacing:2,font:'Sans',motion:'none',layer:0}];
 if(['E','F'].includes(scenario))p.effects=[{id:'focus',type:'region-zoom',motionKind:'focus',start:0,duration:8,zoomSize:.5,zoomX:.5,zoomY:.5,strength:.4,zoomTexts:false,layer:0,trackPath:[{time:0,x:.4,y:.5},{time:8,x:.6,y:.5}]},{id:'zoom',type:'region-zoom',start:0,duration:8,zoomSize:.8,zoomX:.5,zoomY:.5,zoomIn:1,zoomOut:1,returnAt:7,zoomTexts:true,layer:1}];
 if(['G','F'].includes(scenario))p.audioClips=Array.from({length:4},(_,layer)=>({...video('audio-'+layer,layer),kind:'audio',audio:{...clip(m).audio,volume:.15,fadeIn:.2,fadeOut:.2,gainKeyframes:[{time:0,value:.5},{time:3,value:1},{time:8,value:.3}],gainEnvelope:[{id:'p0',time:0,valueDb:-6,interpolation:'linear'},{id:'p1',time:4,valueDb:0,interpolation:'linear'},{id:'p2',time:8,valueDb:-6,interpolation:'linear'}]}}));
 return p;
}
