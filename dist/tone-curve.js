export const CURVE_KEYS=['curveMaster','curveRed','curveGreen','curveBlue'];
export const CURVE_IDENTITY=Object.freeze([[0,0],[1,1]]);
export const MAX_CURVE_POINTS=16;
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));

// V2.0.5 stored five Y values at fixed X positions. New projects store [x,y]
// control points and keep both endpoints so every curve covers the full range.
export function normalizeCurve(value){
 let points=[];
 if(Array.isArray(value)&&value.length){
  if(value.every(v=>Number.isFinite(+v)))points=value.map((y,i)=>[value.length===1?0:i/(value.length-1),clamp(y)]);
  else points=value.filter(v=>Array.isArray(v)&&v.length>=2&&Number.isFinite(+v[0])&&Number.isFinite(+v[1])).map(v=>[clamp(v[0]),clamp(v[1])]);
 }
 if(!points.length)points=CURVE_IDENTITY.map(point=>[...point]);
 points.sort((a,b)=>a[0]-b[0]);const unique=[];
 for(const point of points){if(unique.length&&Math.abs(point[0]-unique.at(-1)[0])<.001)unique[unique.length-1]=point;else unique.push(point)}
 if(unique[0][0]>.001)unique.unshift([0,0]);else unique[0][0]=0;
 if(unique.at(-1)[0]<.999)unique.push([1,1]);else unique.at(-1)[0]=1;
 if(unique.length>MAX_CURVE_POINTS)return[unique[0],...unique.slice(1,-1).filter((_,i)=>i%(Math.ceil((unique.length-2)/(MAX_CURVE_POINTS-2)))===0).slice(0,MAX_CURVE_POINTS-2),unique.at(-1)];
 return unique;
}

function tangents(points){
 const n=points.length,slopes=[],m=new Array(n);if(n===2){const d=(points[1][1]-points[0][1])/(points[1][0]-points[0][0]);return[d,d]}
 for(let i=0;i<n-1;i++)slopes.push((points[i+1][1]-points[i][1])/(points[i+1][0]-points[i][0]));m[0]=slopes[0];m[n-1]=slopes.at(-1);
 for(let i=1;i<n-1;i++){const a=slopes[i-1],b=slopes[i];if(a*b<=0)m[i]=0;else{const h0=points[i][0]-points[i-1][0],h1=points[i+1][0]-points[i][0],w1=2*h1+h0,w2=h1+2*h0;m[i]=(w1+w2)/(w1/a+w2/b)}}return m;
}

// Shape-preserving cubic Hermite interpolation stays smooth without overshoot.
export function curveEvaluator(value){
 const points=normalizeCurve(value),m=tangents(points);return x=>{const at=clamp(x);let i=points.length-2;
  for(let j=0;j<points.length-1;j++)if(at<=points[j+1][0]){i=j;break}
  const[x0,y0]=points[i],[x1,y1]=points[i+1],h=x1-x0,t=h?clamp((at-x0)/h):0,t2=t*t,t3=t2*t;
  return clamp((2*t3-3*t2+1)*y0+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*y1+(t3-t2)*h*m[i+1]);
 };
}
export const curveAt=(value,x)=>curveEvaluator(value)(x);

export function curveColor(color,amount=1){
 const mix=curve=>normalizeCurve(curve).map(([x,y])=>[x,x+(y-x)*amount]);
 return Object.fromEntries(CURVE_KEYS.map(key=>[key,mix(color?.[key])]));
}

export function curveLUT(color,amount=1,size=1024){
 const curves=curveColor(color,amount),evaluate=Object.fromEntries(CURVE_KEYS.map(key=>[key,curveEvaluator(curves[key])])),data=new Float32Array(size*4);
 for(let i=0;i<size;i++){const x=i/(size-1);data[i*4]=evaluate.curveRed(x);data[i*4+1]=evaluate.curveGreen(x);data[i*4+2]=evaluate.curveBlue(x);data[i*4+3]=evaluate.curveMaster(x)}return data;
}

export function bindToneCurve(canvas,{getColor,channel='curveMaster',onStart=()=>{},onInput=()=>{},onEnd=()=>{}}={}){
 if(!canvas)return()=>{};const ctx=canvas.getContext('2d'),ratio=Math.max(1,globalThis.devicePixelRatio||1);let active=-1,started=false;
 const size=()=>{const box=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.round(box.width*ratio));canvas.height=Math.max(1,Math.round(box.height*ratio));return{w:canvas.width,h:canvas.height,p:12*ratio}};
 const screen=(point,w,h,p)=>[p+(w-p*2)*point[0],h-p-point[1]*(h-p*2)];
 const draw=()=>{const{w,h,p}=size(),points=normalizeCurve(getColor()?.[channel]),evaluate=curveEvaluator(points);ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b0f0c';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#293329';ctx.lineWidth=ratio;for(let i=0;i<=4;i++){const x=p+(w-p*2)*i/4,y=p+(h-p*2)*i/4;ctx.beginPath();ctx.moveTo(x,p);ctx.lineTo(x,h-p);ctx.stroke();ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}ctx.strokeStyle={curveMaster:'#e5edc0',curveRed:'#ff746e',curveGreen:'#77d996',curveBlue:'#79a8ff'}[channel];ctx.lineWidth=2*ratio;ctx.beginPath();for(let i=0;i<=160;i++){const x=i/160,[sx,sy]=screen([x,evaluate(x)],w,h,p);i?ctx.lineTo(sx,sy):ctx.moveTo(sx,sy)}ctx.stroke();points.forEach((point,i)=>{const[x,y]=screen(point,w,h,p);ctx.fillStyle=i===active?'#fff':ctx.strokeStyle;ctx.beginPath();ctx.arc(x,y,4.5*ratio,0,Math.PI*2);ctx.fill()})};
 const eventPoint=e=>{const box=canvas.getBoundingClientRect(),p=12;return[clamp((Math.max(p,Math.min(box.width-p,e.clientX-box.left))-p)/(box.width-p*2)),clamp(1-(Math.max(p,Math.min(box.height-p,e.clientY-box.top))-p)/(box.height-p*2))]};
 const nearest=(point,points)=>{const box=canvas.getBoundingClientRect(),sx=box.width-24,sy=box.height-24;let index=-1,distance=11;points.forEach((p,i)=>{const d=Math.hypot((p[0]-point[0])*sx,(p[1]-point[1])*sy);if(d<distance){distance=d;index=i}});return index};
 const emit=points=>{onInput(channel,normalizeCurve(points));draw()};
 const update=e=>{if(active<0)return;const point=eventPoint(e),points=normalizeCurve(getColor()?.[channel]);if(active===0)point[0]=0;else if(active===points.length-1)point[0]=1;else point[0]=Math.max(points[active-1][0]+.005,Math.min(points[active+1][0]-.005,point[0]));points[active]=point;emit(points)};
 canvas.onpointerdown=e=>{if(e.button!==0)return;const point=eventPoint(e),points=normalizeCurve(getColor()?.[channel]);active=nearest(point,points);if(active<0){if(points.length>=MAX_CURVE_POINTS)return;points.push(point);points.sort((a,b)=>a[0]-b[0]);active=points.findIndex(p=>p===point);onStart();started=true;emit(points)}else{onStart();started=true}canvas.setPointerCapture(e.pointerId);update(e)};
 canvas.onpointermove=update;canvas.onpointerup=canvas.onpointercancel=e=>{if(active>=0){active=-1;canvas.releasePointerCapture?.(e.pointerId);if(started)onEnd();started=false;draw()}};
 const remove=e=>{e.preventDefault();const points=normalizeCurve(getColor()?.[channel]),index=nearest(eventPoint(e),points);if(index<=0||index>=points.length-1)return;onStart();points.splice(index,1);active=-1;emit(points);onEnd()};canvas.ondblclick=remove;canvas.oncontextmenu=remove;
 draw();return draw;
}
