import * as THREE from 'three';
import {rayHit} from './occlusion.mjs';
import {physicalKey} from './surface-lighting.mjs';
export const SHADOW_SIZE=64;
export class BeamShadows {
  constructor(capacity){
    this.columns=Math.ceil(Math.sqrt(capacity));this.size=SHADOW_SIZE;this.width=this.columns*this.size;
    this.data=new Float32Array(this.width*this.width);this.data.fill(1000);
    this.texture=new THREE.DataTexture(this.data,this.width,this.width,THREE.RedFormat,THREE.FloatType);this.texture.minFilter=this.texture.magFilter=THREE.NearestFilter;this.texture.needsUpdate=true;this.cache=new Map();
  }
  prepare(light,blockers,revision){
    const id=light.id,key=revision+':'+physicalKey(light);let entry=this.cache.get(id);
    if(entry?.key===key)return entry;
    const slot=entry?.slot??this.cache.size,column=slot%this.columns,row=Math.floor(slot/this.columns),dir=light.dir;
    const right=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,0,1));if(right.lengthSq()<.001)right.set(1,0,0);right.normalize();
    const up=new THREE.Vector3().crossVectors(right,dir).normalize(),tangent=Math.tan(light.angle*Math.PI/360);
    for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++){
      const u=((x+.5)/this.size*2-1)*tangent,v=((y+.5)/this.size*2-1)*tangent;
      const dx=dir.x+right.x*u+up.x*v,dy=dir.y+right.y*u+up.y*v,dz=dir.z+right.z*u+up.z*v;let hit=1000;
      for(const box of blockers)hit=Math.min(hit,rayHit(light.pos.x,light.pos.y,light.pos.z,dx,dy,dz,box,.003,hit));
      this.data[(row*this.size+y)*this.width+column*this.size+x]=hit;
    }
    this.texture.needsUpdate=true;entry={key,slot,right,up,rect:new THREE.Vector4(column/this.columns,row/this.columns,1/this.columns,tangent)};this.cache.set(id,entry);return entry;
  }
  dispose(){this.texture.dispose();}
}
