import {colors,clamp} from './model.js';
import {curveAt,curveColor} from './tone-curve.js';
export const lookPresets={
 CLEAN:{...colors()},HARD:{...colors(),contrast:65,blacks:-32,highlights:-16,saturation:-22},
 COLD:{...colors(),temperature:-40,tint:8,contrast:28,saturation:-18},
 WARM:{...colors(),temperature:38,tint:5,contrast:18,shadows:12},
 RAW:{...colors(),contrast:-20,blacks:12,saturation:-14},
 NIGHT:{...colors(),exposure:-.8,temperature:-32,contrast:35,blacks:-28,saturation:-20},
 UNDER:{...colors(),exposure:-.32,contrast:24,highlights:-34,shadows:-5,whites:-12,blacks:-18,temperature:-5,tint:3,saturation:-12,vibrance:9},
 EDITORIAL:{...colors(),contrast:42,highlights:-24,shadows:10,blacks:-18,saturation:-35},
 MONO:{...colors(),contrast:35,highlights:-20,blacks:-20,saturation:-100}
};
export const lookDescriptions={CLEAN:'補正なし',HARD:'硬い黒・強い輪郭',COLD:'冷たい青・低彩度',WARM:'暖かい光・柔らかな影',RAW:'浅い黒・穏やかな階調',NIGHT:'低露出・深い青',UNDER:'深い黒・保護したハイライト',EDITORIAL:'抑えた色・締まった黒',MONO:'モノクロ・明確な明暗'};
export function adaptiveCinematic(stats={}){
 const luma=clamp(stats.luma??.5,.02,.98),contrast=clamp(stats.contrast??.45,.02,.95),clipping=clamp(stats.clipping??0,0,1);
 return{...colors(),exposure:clamp(-.28+(.43-luma)*.55,-.58,-.08),contrast:clamp(18+( .42-contrast)*28,12,32),highlights:clamp(-28-clipping*45,-52,-24),shadows:luma<.3?8:-7,whites:-12,blacks:clamp(-15-(.45-contrast)*16,-24,-10),temperature:-4,tint:3,saturation:-10,vibrance:clamp(8+( .35-contrast)*12,5,13)};
}
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export function balanceWeights(luma){return[1-smoothstep(.18,.58,luma),smoothstep(.08,.5,luma)*(1-smoothstep(.5,.92,luma)),smoothstep(.42,.82,luma)]}
export function colorBalanceVector(hue){const a=(+hue||0)*Math.PI/180,raw=[Math.cos(a),Math.cos(a-2*Math.PI/3),Math.cos(a+2*Math.PI/3)],neutral=raw[0]*.299+raw[1]*.587+raw[2]*.114;return raw.map(value=>value-neutral)}
export function applyThreeWay(rgb,col={}){let v=[...rgb],l=v[0]*.299+v[1]*.587+v[2]*.114;const weights=balanceWeights(l),zones=['Shadow','Midtone','Highlight'];for(let z=0;z<3;z++){const vector=colorBalanceVector(col[`balance${zones[z]}Hue`]),sat=clamp(col[`balance${zones[z]}Saturation`]||0,0,100)/100*.18*weights[z],light=clamp(col[`balance${zones[z]}Lightness`]||0,-100,100)/100*.35*weights[z];v=v.map((x,i)=>x+vector[i]*sat);v=light>=0?v.map(x=>x+(1-x)*light):v.map(x=>x*(1+light))}return v.map(x=>clamp(x,0,1))}
export function gradeRGB(rgb,col,amount=1){
 const source={...colors(),...col},c=Object.fromEntries(Object.entries(source).filter(([,v])=>!Array.isArray(v)).map(([k,v])=>[k,v*amount])),curves=curveColor(source,amount),o=[...rgb];c.saturation=Math.max(-100,c.saturation);
 for(const zone of ['Shadow','Midtone','Highlight'])c[`balance${zone}Hue`]=source[`balance${zone}Hue`]||0;
 const warm=(c.temperature||0)+(c.warmth||0)*.8,bias=[warm/400+c.tint/800,-c.tint/400,-warm/400+c.tint/800];
 let v=o.map((x,i)=>clamp((x*Math.pow(2,c.exposure)-.5)*(1+c.contrast/150)+.5+c.brightness/200+c.brilliance/550*(1-Math.abs(2*x-1))+c.shadows/400*(1-x)**2+c.highlights/400*x*x+c.whites/500*x**4+c.blacks/500*(1-x)**4-c.blackPoint/180*(1-x)**3+bias[i],0,1));
 v=v.map(x=>Math.pow(x,Math.pow(2,-c.gamma/100)));v=v.map((x,i)=>curveAt(curves[['curveRed','curveGreen','curveBlue'][i]],curveAt(curves.curveMaster,x)));v=applyThreeWay(v,c);const l=v[0]*.299+v[1]*.587+v[2]*.114;v=v.map(x=>l+(x-l)*(1+c.saturation/100));
 const factor=1+c.vibrance/100*(1-(Math.max(...v)-Math.min(...v)));v=v.map(x=>clamp(l+(x-l)*factor,0,1));return v.map(x=>clamp(x+(0.5-x)*Math.max(0,c.fade)/200,0,1));
}
