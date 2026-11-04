import * as THREE from 'three';
import {physicalKey} from './surface-lighting.mjs';
// Camera-independent scattering field: light changes update the field; orbiting
// only samples it. The opaque scene depth still clips every viewing ray.
export class FogField {
  constructor(stage){
    this.nx=80;this.ny=72;this.nz=32;this.count=this.nx*this.ny*this.nz;
    this.min=new THREE.Vector3(-stage.width/2-4,-8,0);this.size=new THREE.Vector3(stage.width+8,stage.depth+12,stage.height+1.5);
    this.energy=new Float32Array(this.count*3);this.data=new Uint16Array(this.count*4);
    this.texture=new THREE.Data3DTexture(this.data,this.nx,this.ny,this.nz);this.texture.format=THREE.RGBAFormat;this.texture.type=THREE.HalfFloatType;this.texture.minFilter=this.texture.magFilter=THREE.LinearFilter;this.texture.unpackAlignment=1;this.cache=new Map();this.updates=0;
  }
  coefficients(light,shadow,atlas){
    const out=new Uint16Array(this.count),edge=Math.cos(light.angle*Math.PI/360),inner=edge+(1-edge)*.3,tangent=shadow.rect.w,n=atlas.size,column=shadow.slot%atlas.columns,row=Math.floor(shadow.slot/atlas.columns);
    let index=0;
    for(let z=0;z<this.nz;z++)for(let y=0;y<this.ny;y++)for(let x=0;x<this.nx;x++,index++){
      const dx=this.min.x+(x+.5)/this.nx*this.size.x-light.pos.x,dy=this.min.y+(y+.5)/this.ny*this.size.y-light.pos.y,dz=this.min.z+(z+.5)/this.nz*this.size.z-light.pos.z;
      const q=dx*light.dir.x+dy*light.dir.y+dz*light.dir.z;if(q<=0)continue;
      const distance=Math.hypot(dx,dy,dz),alignment=q/Math.max(distance,.001);if(alignment<=edge)continue;
      const u=(dx*shadow.right.x+dy*shadow.right.y+dz*shadow.right.z)/(q*tangent)*.5+.5,v=(dx*shadow.up.x+dy*shadow.up.y+dz*shadow.up.z)/(q*tangent)*.5+.5;
      const px=Math.floor(u*n-.5),py=Math.floor(v*n-.5);let hit=1000;
      for(let i=0;i<2;i++)for(let j=0;j<2;j++){
        const cx=Math.max(0,Math.min(n-1,px+i)),cy=Math.max(0,Math.min(n-1,py+j));hit=Math.min(hit,atlas.data[(row*n+cy)*atlas.width+column*n+cx]);
      }
      if(q>hit+.006)continue;
      const t=Math.min(1,(alignment-edge)/(inner-edge));out[index]=Math.round(t*t*(3-2*t)*70/(28+distance*distance)*Math.exp(-distance*.025)*16384);
    }
    return out;
  }
  accumulate(weights,color){
    const r=color[0]/16384,g=color[1]/16384,b=color[2]/16384;
    for(let i=0;i<this.count;i++){const w=weights[i];if(!w)continue;const j=i*3;this.energy[j]+=w*r;this.energy[j+1]+=w*g;this.energy[j+2]+=w*b;}
  }
  update(lights,blockers,revision,atlas){
    const active=new Set();let dirty=false;
    if(!lights.some(l=>l.intensity>.0001)){
      for(const entry of this.cache.values())if(entry.rgb.some(v=>Math.abs(v)>1e-8)){entry.rgb=[0,0,0];dirty=true;}
      if(dirty){this.energy.fill(0);this.data.fill(0);this.texture.needsUpdate=true;this.updates++;}return dirty;
    }
    for(const l of lights){if(l.intensity<=.0001)continue;active.add(l.id);const key=revision+':'+physicalKey(l),rgb=[l.color.r*l.intensity,l.color.g*l.intensity,l.color.b*l.intensity];let entry=this.cache.get(l.id);
      if(!entry||entry.key!==key){if(entry)this.accumulate(entry.weights,entry.rgb.map(v=>-v));const shadow=atlas.prepare(l,blockers,revision);entry={key,weights:this.coefficients(l,shadow,atlas),rgb:[0,0,0]};this.cache.set(l.id,entry);dirty=true;}
      const delta=rgb.map((v,i)=>v-entry.rgb[i]);if(delta.some(v=>Math.abs(v)>1e-8)){this.accumulate(entry.weights,delta);entry.rgb=rgb;dirty=true;}
    }
    for(const [id,entry]of this.cache)if(!active.has(id)&&entry.rgb.some(v=>Math.abs(v)>1e-8)){this.accumulate(entry.weights,entry.rgb.map(v=>-v));entry.rgb=[0,0,0];dirty=true;}
    if(dirty){for(let i=0;i<this.count;i++){const j=i*3,k=i*4;this.data[k]=THREE.DataUtils.toHalfFloat(Math.max(0,this.energy[j])*.018);this.data[k+1]=THREE.DataUtils.toHalfFloat(Math.max(0,this.energy[j+1])*.018);this.data[k+2]=THREE.DataUtils.toHalfFloat(Math.max(0,this.energy[j+2])*.018);}
      this.texture.needsUpdate=true;this.updates++;
    }
    return dirty;
  }
  dispose(){this.texture.dispose();}
}
export const fogVertex='void main(){gl_Position=vec4(position.xy,0.,1.);}';
export const fogFragment=`
precision highp float;precision highp sampler3D;
uniform sampler3D field;uniform vec3 fieldMin;uniform vec3 fieldSize;
uniform sampler2D sceneDepth;uniform vec2 resolution;uniform mat4 inverseProjection;uniform mat4 cameraWorld;uniform int sampleCount;
void main(){
 vec2 uv=gl_FragCoord.xy/resolution;
 vec4 viewEnd=inverseProjection*vec4(uv*2.-1.,1.,1.);vec3 ray=normalize((cameraWorld*vec4(viewEnd.xyz/viewEnd.w,1.)).xyz-cameraPosition);
 vec3 safe=mix(vec3(.000001),ray,step(vec3(.000001),abs(ray)));
 vec3 a=(fieldMin-cameraPosition)/safe,b=(fieldMin+fieldSize-cameraPosition)/safe;
 vec3 lo=min(a,b),hi=max(a,b);float enter=max(0.,max(lo.x,max(lo.y,lo.z))),leave=min(hi.x,min(hi.y,hi.z));
 float depth=texture2D(sceneDepth,uv).r;vec4 viewSurface=inverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);
 vec3 surface=(cameraWorld*vec4(viewSurface.xyz/viewSurface.w,1.)).xyz;leave=min(leave,dot(surface-cameraPosition,ray)-.003);
 if(leave<=enter)discard;float stepSize=(leave-enter)/float(sampleCount);vec3 sum=vec3(0.);
 for(int i=0;i<64;i++){if(i>=sampleCount)break;vec3 p=cameraPosition+ray*(enter+(float(i)+.5)*stepSize);sum+=texture(field,(p-fieldMin)/fieldSize).rgb;}
 gl_FragColor=vec4(sum*stepSize,1.);
}`;
