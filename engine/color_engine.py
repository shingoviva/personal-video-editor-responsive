"""Same RGB transform as preview.js; a cached 33-point LUT for native FFmpeg."""
import hashlib,json,math,pathlib
BALANCE_ZONES=('Shadow','Midtone','Highlight')
BALANCE_KEYS=tuple(f'balance{zone}{part}' for zone in BALANCE_ZONES for part in ('Hue','Saturation','Lightness'))
COLOR_KEYS=('exposure','brilliance','highlights','shadows','contrast','brightness','blackPoint','whites','blacks','gamma','temperature','warmth','tint','saturation','vibrance','fade')+BALANCE_KEYS
CURVE_KEYS=('curveMaster','curveRed','curveGreen','curveBlue')
SPATIAL_KEYS=('sharpness','definition','noiseReduction','vignette')
KEYS=COLOR_KEYS+SPATIAL_KEYS
IDENTITY=((0.,0.),(1.,1.));MAX_CURVE_POINTS=16
def normalize_curve(value):
 clip=lambda x:max(0.,min(1.,float(x)))
 if isinstance(value,list) and value:
  if all(not isinstance(v,(list,tuple)) for v in value):points=[[i/max(1,len(value)-1),clip(v)] for i,v in enumerate(value)]
  else:points=[[clip(v[0]),clip(v[1])] for v in value if isinstance(v,(list,tuple)) and len(v)>=2]
 else:points=[list(v) for v in IDENTITY]
 if not points:points=[list(v) for v in IDENTITY]
 points.sort(key=lambda p:p[0]);unique=[]
 for point in points:
  if unique and abs(point[0]-unique[-1][0])<.001:unique[-1]=point
  else:unique.append(point)
 if unique[0][0]>.001:unique.insert(0,[0.,0.])
 else:unique[0][0]=0.
 if unique[-1][0]<.999:unique.append([1.,1.])
 else:unique[-1][0]=1.
 if len(unique)>MAX_CURVE_POINTS:
  step=-(-(len(unique)-2)//(MAX_CURVE_POINTS-2));unique=[unique[0]]+[v for i,v in enumerate(unique[1:-1]) if i%step==0][:MAX_CURVE_POINTS-2]+[unique[-1]]
 return unique
def tangents(points):
 n=len(points);slopes=[(points[i+1][1]-points[i][1])/(points[i+1][0]-points[i][0]) for i in range(n-1)]
 if n==2:return [slopes[0],slopes[0]]
 result=[slopes[0]]+[0.]*(n-2)+[slopes[-1]]
 for i in range(1,n-1):
  a,b=slopes[i-1],slopes[i]
  if a*b<=0:result[i]=0.
  else:
   h0=points[i][0]-points[i-1][0];h1=points[i+1][0]-points[i][0];w1=2*h1+h0;w2=h1+2*h0;result[i]=(w1+w2)/(w1/a+w2/b)
 return result
def prepare_curve(points):
 points=normalize_curve(points);return points,tangents(points)
def curve_at_prepared(prepared,x):
 points,m=prepared;x=max(0.,min(1.,x));i=len(points)-2
 for j in range(len(points)-1):
  if x<=points[j+1][0]:i=j;break
 x0,y0=points[i];x1,y1=points[i+1];h=x1-x0;t=max(0.,min(1.,(x-x0)/h if h else 0));t2=t*t;t3=t2*t
 return max(0.,min(1.,(2*t3-3*t2+1)*y0+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*y1+(t3-t2)*h*m[i+1]))
def curve_at(points,x):return curve_at_prepared(prepare_curve(points),x)
def prepared_curves(col,amount=1):return {k:prepare_curve([[x,x+(y-x)*amount] for x,y in normalize_curve(col.get(k))]) for k in CURVE_KEYS}
def smoothstep(a,b,x):
 t=max(0.,min(1.,(x-a)/(b-a)));return t*t*(3-2*t)
def balance_weights(luma):return (1-smoothstep(.18,.58,luma),smoothstep(.08,.5,luma)*(1-smoothstep(.5,.92,luma)),smoothstep(.42,.82,luma))
def balance_vector(hue):
 a=float(hue or 0)*math.pi/180;raw=(math.cos(a),math.cos(a-2*math.pi/3),math.cos(a+2*math.pi/3));neutral=sum(a*b for a,b in zip(raw,(.299,.587,.114)));return tuple(value-neutral for value in raw)
def apply_three_way(rgb,c):
 clip=lambda x:max(0.,min(1.,x));v=list(rgb);l=sum(a*b for a,b in zip(v,(.299,.587,.114)))
 for zone,weight in zip(BALANCE_ZONES,balance_weights(l)):
  vector=balance_vector(c.get(f'balance{zone}Hue',0));sat=clip(c.get(f'balance{zone}Saturation',0)/100)*.18*weight;light=max(-1.,min(1.,c.get(f'balance{zone}Lightness',0)/100))*.35*weight
  v=[x+vector[i]*sat for i,x in enumerate(v)];v=[x+(1-x)*light for x in v] if light>=0 else [x*(1+light) for x in v]
 return [clip(x) for x in v]
def grade(rgb,col,amount=1,prepared=None):
 c={k:float(col.get(k,0))*amount for k in COLOR_KEYS};clip=lambda x:max(0.,min(1.,x))
 for zone in BALANCE_ZONES:c[f'balance{zone}Hue']=float(col.get(f'balance{zone}Hue',0))
 c['saturation']=max(-100,c['saturation'])
 curves=prepared or prepared_curves(col,amount)
 warm=c['temperature']+c['warmth']*.8;bias=(warm/400+c['tint']/800,-c['tint']/400,-warm/400+c['tint']/800)
 v=[clip((x*2**c['exposure']-.5)*(1+c['contrast']/150)+.5+c['brightness']/200+c['brilliance']/550*(1-abs(2*x-1))+c['shadows']/400*(1-x)**2+c['highlights']/400*x*x+c['whites']/500*x**4+c['blacks']/500*(1-x)**4-c['blackPoint']/180*(1-x)**3+bias[i]) for i,x in enumerate(rgb)]
 v=[x**(2**(-c['gamma']/100)) for x in v];v=[curve_at_prepared(curves[('curveRed','curveGreen','curveBlue')[i]],curve_at_prepared(curves['curveMaster'],x)) for i,x in enumerate(v)];v=apply_three_way(v,c);l=sum(a*b for a,b in zip(v,(.299,.587,.114)));v=[l+(x-l)*(1+c['saturation']/100) for x in v]
 f=1+c['vibrance']/100*(1-(max(v)-min(v)));v=[clip(l+(x-l)*f) for x in v];return [clip(x+(.5-x)*max(0,c['fade'])/200) for x in v]
def filters(col,cache,amount=1):
 values={k:max(-3 if k=='exposure' else 0 if k in SPATIAL_KEYS or k=='fade' or k.endswith(('Hue','Saturation')) else -100,min(3 if k=='exposure' else 360 if k.endswith('Hue') else 100,float(col.get(k,0)))) for k in KEYS}
 curves={k:normalize_curve(col.get(k)) for k in CURVE_KEYS}
 curve_active=any(curves[k]!=[list(v) for v in IDENTITY] for k in CURVE_KEYS);balance_active=any(values[k] for k in BALANCE_KEYS if not k.endswith('Hue'));base_active=any(values[k] for k in COLOR_KEYS if k not in BALANCE_KEYS);has_color=base_active or balance_active or curve_active;has_spatial=any(values[k] for k in SPATIAL_KEYS)
 if (not has_color and not has_spatial) or amount==0:return []
 key=hashlib.sha256(json.dumps([values,curves,amount],sort_keys=True).encode()).hexdigest()[:24]
 cache=pathlib.Path(cache);path=cache/('look-'+key+'.cube')
 color_values={**{k:values[k] for k in COLOR_KEYS},**curves}
 if has_color and not path.exists():
  prepared=prepared_curves(color_values,amount)
  with path.with_suffix('.tmp').open('w') as f:
   f.write('LUT_3D_SIZE 33\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
   for b in range(33):
    for g in range(33):
     for r in range(33):f.write(' '.join(f'{v:.7f}' for v in grade((r/32,g/32,b/32),color_values,amount,prepared))+'\n')
  path.with_suffix('.tmp').replace(path)
  for old in sorted(cache.glob('look-*.cube'),key=lambda p:p.stat().st_mtime,reverse=True)[32:]:old.unlink(missing_ok=True)
 result=[f"lut3d=file='{path}':interp=tetrahedral"] if has_color else []
 sharpness=values['sharpness']*amount
 definition=values['definition']*amount
 noise=values['noiseReduction']*amount
 vignette=values['vignette']*amount
 if sharpness:result.append(f'unsharp=5:5:{1.5*sharpness/100:.6f}:5:5:0')
 if definition:result.append(f'unsharp=9:9:{0.9*definition/100:.6f}:9:9:0')
 if noise:result.append(f'hqdn3d={1.5*noise/100:.6f}:{1.2*noise/100:.6f}:{4.5*noise/100:.6f}:{3.6*noise/100:.6f}')
 if vignette:result.append(f'vignette=angle={0.05+0.7*vignette/100:.6f}:mode=forward:eval=frame')
 return result
