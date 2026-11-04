import * as THREE from 'three';
import {SurfaceLighting} from './surface-lighting.mjs';
import {FogField} from './fog-field.mjs';
import {BeamShadows} from './beam-shadows.mjs';
let root=new THREE.Scene(),meshes=new Map(),lighting=new SurfaceLighting(),fog,shadows,epoch;
self.onmessage=({data:d})=>{
 try{
  if(epoch!==d.epoch){epoch=d.epoch;for(const m of meshes.values())m.geometry.dispose();meshes.clear();root.clear();lighting=new SurfaceLighting();fog?.dispose();shadows?.dispose();fog=new FogField(d.stage);shadows=new BeamShadows(d.capacity);}
  const keep=new Set(d.meshes.map(m=>m.id));for(const [id,m]of meshes)if(!keep.has(id)){root.remove(m);m.geometry.dispose();meshes.delete(id);}
  for(const item of d.meshes){let m=meshes.get(item.id);if(!m){const g=new THREE.BufferGeometry();for(const k of ['position','normal','owner'])if(item[k])g.setAttribute(k,new THREE.BufferAttribute(item[k],k==='owner'?1:3));m=new THREE.Mesh(g);m.matrixAutoUpdate=false;meshes.set(item.id,m);root.add(m);}m.matrix.fromArray(item.matrix);m.matrixWorldNeedsUpdate=true;}
  const lights=d.lights.map(l=>({...l,pos:new THREE.Vector3(...l.pos),dir:new THREE.Vector3(...l.dir),color:new THREE.Color().setRGB(...l.color)}));
  lighting.update(root,lights,d.blockers,d.revision);
  const surfaces=[...meshes].map(([id,m])=>({id,energy:m.geometry.attributes.irradiance.array.slice()}));
  let volume;if(d.fog){fog.update(lights,d.blockers,d.revision,shadows);volume=fog.data.slice();}
  self.postMessage({epoch,key:d.key,surfaces,volume,computations:lighting.computations},[...surfaces.map(m=>m.energy.buffer),...(volume?[volume.buffer]:[])]);
 }catch(e){self.postMessage({epoch,error:e.message});}
};
