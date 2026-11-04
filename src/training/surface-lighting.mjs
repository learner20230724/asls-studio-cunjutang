import * as THREE from 'three';
import {blockedSegment} from './occlusion.mjs';
export const surfaceVertex=`attribute vec3 irradiance;varying vec3 lightEnergy;void main(){lightEnergy=irradiance;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}`;
export const surfaceFragment=`uniform vec3 base;varying vec3 lightEnergy;void main(){gl_FragColor=vec4(base*(vec3(.045)+lightEnergy),1.);}`;
export const physicalKey=l=>[l.pos.x,l.pos.y,l.pos.z,l.dir.x,l.dir.y,l.dir.z,l.angle].join(',');
export class SurfaceLighting {
  constructor(){this.cache=new WeakMap();this.lastKey='';this.computations=0;}
  update(root,lights,blockers,revision){
    const active=lights.filter(l=>l.intensity>.0001),meshes=[];root.updateMatrixWorld(true);root.traverse(m=>{if(m.isMesh)meshes.push(m);});
    const key=revision+'|'+meshes.map(m=>m.geometry.uuid).join()+'|'+active.map(l=>[l.id,physicalKey(l),l.intensity,l.color.r,l.color.g,l.color.b].join(':')).join('|');
    if(key===this.lastKey)return false;this.lastKey=key;this.computations++;
    for(const mesh of meshes){
      const geometry=mesh.geometry,p=geometry.attributes.position,n=geometry.attributes.normal;
      let data=this.cache.get(geometry);
      if(!data){
        const positions=new Float32Array(p.count*3),normals=new Float32Array(p.count*3),point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
        for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray(positions,i*3);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize().toArray(normals,i*3);}
        data={positions,normals,owners:geometry.attributes.owner?.array,weights:new Map(),energy:new Float32Array(p.count*3)};this.cache.set(geometry,data);geometry.setAttribute('irradiance',new THREE.BufferAttribute(data.energy,3));
      }
      data.energy.fill(0);
      for(const l of active){
        const id=l.id,signature=revision+':'+physicalKey(l);let cached=data.weights.get(id);
        if(!cached||cached.key!==signature){
          const weights=new Float32Array(p.count),edge=Math.cos(l.angle*Math.PI/360),inner=edge+(1-edge)*.3;
          for(let i=0;i<p.count;i++){
            const j=i*3,dx=data.positions[j]-l.pos.x,dy=data.positions[j+1]-l.pos.y,dz=data.positions[j+2]-l.pos.z;
            const normal=-(dx*data.normals[j]+dy*data.normals[j+1]+dz*data.normals[j+2]);if(normal<=0)continue;
            const distance=Math.hypot(dx,dy,dz),alignment=(dx*l.dir.x+dy*l.dir.y+dz*l.dir.z)/Math.max(distance,.001);if(alignment<=edge)continue;
            if(blockedSegment(l.pos.x,l.pos.y,l.pos.z,data.positions[j],data.positions[j+1],data.positions[j+2],blockers,data.owners?.[i]||0))continue;
            const t=Math.min(1,(alignment-edge)/(inner-edge));weights[i]=t*t*(3-2*t)*normal/Math.max(distance,.001)*70/(28+distance*distance);
          }
          cached={key:signature,weights};data.weights.set(id,cached);
        }
        const red=l.color.r*l.intensity,green=l.color.g*l.intensity,blue=l.color.b*l.intensity;
        for(let i=0;i<p.count;i++){const weight=cached.weights[i];if(!weight)continue;const j=i*3;data.energy[j]+=weight*red;data.energy[j+1]+=weight*green;data.energy[j+2]+=weight*blue;}
      }
      geometry.attributes.irradiance.needsUpdate=true;
    }
    return true;
  }
}
