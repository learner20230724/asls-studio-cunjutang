import * as THREE from 'three';
// One in-flight job and one replaceable latest request: no animation job backlog.
export class AsyncLighting {
 constructor(renderer){this.renderer=renderer;this.worker=new Worker(new URL('./lighting.worker.js',import.meta.url),{type:'module'});this.known=new Set();this.busy=false;this.lastKey='';this.epoch=0;this.worker.onmessage=({data})=>this.receive(data);this.worker.onerror=e=>{this.error=e.message;console.error('Lighting worker:',e.message);this.renderer.onError?.('灯光计算失败，请刷新页面');this.busy=false;};}
 reset(){this.epoch++;this.known.clear();this.lastKey='';this.pending=null;}
 request(){const r=this.renderer;const meshes=[];r.lit.updateMatrixWorld(true);r.lit.traverse(m=>{if(m.isMesh){if(!m.geometry.attributes.irradiance)m.geometry.setAttribute('irradiance',new THREE.BufferAttribute(new Float32Array(m.geometry.attributes.position.count*3),3));meshes.push(m);}});
 const key=JSON.stringify([this.epoch,r.activeRevision,meshes.map(m=>[m.geometry.uuid,...m.matrixWorld.elements]),r.beams.visible,r.lightData]);if(key===this.lastKey)return;this.lastKey=key;
 this.pending={key,meshes,lights:r.lightData.map(l=>({...l,pos:l.pos.toArray(),dir:l.dir.toArray(),color:[l.color.r,l.color.g,l.color.b]})),blockers:r.activeBlockers,revision:r.activeRevision,fog:r.beams.visible};this.send();}
 send(){if(this.busy||!this.pending)return;const r=this.renderer,p=this.pending;this.pending=null;this.busy=true;this.started=performance.now();const meshes=p.meshes.map(m=>{const g=m.geometry,id=g.uuid,item={id,matrix:m.matrixWorld.toArray()};if(!this.known.has(id)){for(const k of ['position','normal','owner'])if(g.attributes[k])item[k]=g.attributes[k].array.slice();this.known.add(id);}return item;});this.worker.postMessage({...p,meshes,epoch:this.epoch,stage:r.stage,capacity:r.capacity});}
 receive(d){this.busy=false;const r=this.renderer;if(d.error){this.error=d.error;console.error('Lighting worker:',d.error);r.onError?.('灯光计算失败，请刷新页面');return;}if(d.epoch===this.epoch){const values=new Map(d.surfaces.map(s=>[s.id,s.energy]));r.lit.traverse(m=>{const a=m.geometry?.attributes.irradiance,v=values.get(m.geometry?.uuid);if(a&&v&&a.array.length===v.length){a.array.set(v);a.needsUpdate=true;}});if(d.volume){r.fogField.data.set(d.volume);r.fogField.texture.needsUpdate=true;}r.surfaceLighting.computations=d.computations;this.lastDuration=performance.now()-this.started;this.completedKey=d.key;r.onInvalidate();}this.send();}
 get settled(){return !this.busy&&!this.pending;}
 dispose(){this.worker.terminate();this.pending=null;}
}
