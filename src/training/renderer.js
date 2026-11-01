import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { effectiveIntensity, nextCapacity } from './rig.mjs';

// Render-only facade. All channel decoding / scenes remain in ASLS Fixture and Scene.
export class TeachingLight {
  constructor(fixture){this.isTrainingModel=true;this.fixture=fixture;this.intensity=0;this.pan=0;this.tilt=0;this.position=fixture.position;this.rotation=fixture._rotation;this.rgb=[1,1,1];this.shutter=1;}
  set colorIntensity(v){const i=['Red','Green','Blue'].indexOf(v.color);if(i>=0)this.rgb[i]=Number(v.colorBrightness);const c=['Cyan','Magenta','Yellow'].indexOf(v.color);if(c>=0)this.rgb[c]=1-Number(v.colorBrightness);if(v.color==='White')this.white=Number(v.colorBrightness);}
  set colorWheelSlot(slot){const colors=['#ffffff','#ff5555','#ffaa55','#66ff99','#55aaff','#c488ff'];this.colorPreset=colors[Math.abs(slot)%colors.length];}
  set shutterStrobe(v){this.shutter=v?.type==='Closed'?0:1;}
  dispose(){this.fixture=null;}
}
const BATCH=32;
const vertex=`varying vec3 wp; varying vec3 wn; void main(){vec4 p=modelMatrix*vec4(position,1.);wp=p.xyz;wn=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*p;}`;
const fragment=`precision highp float;
uniform vec3 base;uniform float ambient;uniform int count;uniform vec4 lp[${BATCH}];uniform vec4 ld[${BATCH}];uniform vec3 lc[${BATCH}];varying vec3 wp;varying vec3 wn;
void main(){vec3 sum=vec3(ambient);for(int i=0;i<${BATCH};i++){if(i>=count)break;vec3 dv=wp-lp[i].xyz;float dist=length(dv);vec3 dir=dv/max(.001,dist);float cone=smoothstep(ld[i].w,min(1.,ld[i].w+.06),dot(dir,ld[i].xyz));float diffuse=max(.06,dot(normalize(wn),-dir));sum+=lc[i]*lp[i].w*cone*diffuse*70./(28.+dist*dist);}gl_FragColor=vec4(base*sum,1.);}`;
const vec=(o)=>new THREE.Vector3(o.x,o.y,o.z);
function disposeTree(root){root.traverse(o=>{if(o.isInstancedMesh)o.dispose();o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});root.clear();}
export class StageRenderer {
  constructor(host,onSelect){
    this.host=host;this.onSelect=onSelect;this.decor=new THREE.Scene();this.lit=new THREE.Scene();this.beamsScene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(43,1,.1,220);this.camera.up.set(0,0,1);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setClearColor(new THREE.Color(.0028,.0045,.006));this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace;this.renderer.autoClear=false;host.appendChild(this.renderer.domElement);
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
    this.postScene=new THREE.Scene();this.postCamera=new THREE.Camera();this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{image:{value:this.target.texture}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D image;varying vec2 v;void main(){vec3 c=texture2D(image,v).rgb*.85;c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);gl_FragColor=vec4(pow(clamp(c,0.,1.),vec3(1./2.2)),1.);}'})));
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=6;this.controls.maxDistance=85;this.controls.maxPolarAngle=Math.PI*.49;this.controls.target.set(0,6,2);
    this.materials=[];this.fixtures=[];this.meshes=[];this.capacity=0;this.selected=new Set();this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.stats={fps:0,fixtures:0,capacity:0,drawCalls:0,geometries:0};this.frames=0;this.lastStats=performance.now();this.quality='auto';this.resize=new ResizeObserver(()=>this.resizeView());this.resize.observe(host);
    this.down=e=>{this.pointerDown={x:e.clientX,y:e.clientY};};this.up=e=>{if(!this.pointerDown||Math.hypot(e.clientX-this.pointerDown.x,e.clientY-this.pointerDown.y)>6)return;const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects(this.meshes)[0];if(hit)this.onSelect(hit.object.userData.ids[hit.instanceId],e.shiftKey||e.ctrlKey);};this.renderer.domElement.addEventListener('pointerdown',this.down);this.renderer.domElement.addEventListener('pointerup',this.up);this.view('audience');this.resizeView();
  }
  get showData(){return this.preferences||{};}
  resizeView(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;const low=this.quality==='low'||(this.quality==='auto'&&w<700);this.renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,1.5));this.renderer.setSize(w,h);this.target.setSize(Math.round(w*this.renderer.getPixelRatio()),Math.round(h*this.renderer.getPixelRatio()));const changed=Math.abs(this.camera.aspect-w/h)>.04;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(changed)this.view(this.lastView||'audience');}
  setQuality(q){this.quality=q;this.resizeView();}
  view(name){const w=this.stage?.width||16,d=this.stage?.depth||15,h=this.stage?.height||8;const views={audience:[w*1.35,-d*1.5,h*2.3],front:[0,-d*1.55,h*.85],top:[0,d/2,Math.max(w,d)*2.15],left:[w*2.1,d/2,h*1.3],right:[-w*2.1,d/2,h*1.3]};this.lastView=name;this.controls.target.set(0,d*.46,2);this.camera.position.set(...(views[name]||views.audience));this.camera.position.sub(this.controls.target).multiplyScalar(Math.max(1,1.05/this.camera.aspect)).add(this.controls.target);this.controls.update();}
  litMaterial(color){const m=new THREE.ShaderMaterial({uniforms:{base:{value:new THREE.Color(color)},ambient:{value:.055},count:{value:0},lp:{value:Array.from({length:BATCH},()=>new THREE.Vector4())},ld:{value:Array.from({length:BATCH},()=>new THREE.Vector4())},lc:{value:Array.from({length:BATCH},()=>new THREE.Color())}},vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide});this.materials.push(m);return m;}
  box(parent,size,position,color,lit=false){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),lit?this.litMaterial(color):new THREE.MeshBasicMaterial({color}));m.position.set(...position);parent.add(m);return m;}
  label(text,x,y,z,color='#8c968e',scale=2.5){const c=document.createElement('canvas');c.width=512;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,42);const tex=new THREE.CanvasTexture(c);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));sprite.scale.set(scale,scale/8,1);sprite.position.set(x,y,z);this.decor.add(sprite);}
  build(stage,objects,fixtures){
    disposeTree(this.decor);disposeTree(this.lit);disposeTree(this.beamsScene);this.materials=[];this.meshes=[];this.stage=stage;this.fixtures=fixtures;this.capacity=nextCapacity(fixtures.length);const {width:w,depth:d,height:h}=stage;
    this.box(this.lit,[w,d,.3],[0,d/2,-.16],'#73736c',true);
    this.box(this.decor,[w+.3,d+.3,.3],[0,d/2,-.35],'#151c1c');
    this.box(this.lit,[w+.4,.25,h],[0,d+.25,h/2],'#252e30',true);
    for(let i=0;i<25;i++)this.box(this.lit,[w/25*.85,.14,h*.84],[-w/2+(i+.5)*w/25,d+.08,h*.42],'#283235',true);
    for(const sign of [-1,1]){this.box(this.decor,[.3,d,.7],[sign*(w/2+.55),d/2,.35],'#1b2326');for(let i=0;i<4;i++)this.box(this.lit,[.6,.16,h*.85],[sign*(w/2-.35),1+i*d/4,h*.425],'#1c2629',true);}
    for(const y of stage.rows){this.box(this.decor,[w+1,.12,.12],[0,y,h+.25],'#465051');for(const x of [-w/2,w/2])this.box(this.decor,[.06,.06,1.1],[x,y,h+.8],'#374044');}
    this.box(this.decor,[w+1,.14,.14],[0,-4,h+.3],'#41494c');
    // Ground marks are geometry, not downloaded textures.
    for(let x=-w/2;x<=w/2;x+=2)this.box(this.decor,[.012,d,.005],[x,d/2,.008],'#384142');
    for(let y=0;y<=d;y+=2)this.box(this.decor,[w,.012,.005],[0,y,.008],'#384142');
    this.box(this.decor,[w,.035,.015],[0,0,.02],'#ba975a');
    this.label('UPSTAGE  /  后舞台',0,d-.6,.15,'#8d9690',4);
    this.label('AUDIENCE  /  观众席',0,-2.3,.1,'#c5ab7e',4);
    this.label('台左  L',w/2+1.1,d*.5,1,'#8d9690',2);this.label('台右  R',-w/2-1.1,d*.5,1,'#8d9690',2);
    for(let r=0;r<3;r++)for(let c=0;c<15;c++){this.box(this.decor,[.7,.65,.35],[(c-7)*1.05,-6-r*1.2,-.1],'#283338');this.box(this.decor,[.7,.15,.6],[(c-7)*1.05,-6.3-r*1.2,.25],'#303a40');}
    this.objectRoot=new THREE.Group();this.lit.add(this.objectRoot);this.buildObjects(objects);
    for(const kind of ['spot','conference','rgb','moving']){
      let geo=kind==='conference'?new THREE.BoxGeometry(.32,.18,.36):new THREE.CylinderGeometry(kind==='moving'?.19:.14,.21,.42,8);if(kind!=='conference')geo.rotateX(Math.PI/2);if(kind==='moving'){const parts=[geo,new THREE.BoxGeometry(.56,.4,.16).translate(0,0,-.36),new THREE.BoxGeometry(.07,.25,.4).translate(.25,0,-.13),new THREE.BoxGeometry(.07,.25,.4).translate(-.25,0,-.13)];geo=mergeGeometries(parts);parts.forEach(g=>g.dispose());}
      const m=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({color:'#647276'}),this.capacity);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;m.userData={kind,ids:[]};this.meshes.push(m);this.decor.add(m);
    }
    this.lenses=new THREE.InstancedMesh(new THREE.SphereGeometry(.105,8,6),new THREE.MeshBasicMaterial({color:'#ffffff'}),this.capacity);this.lenses.frustumCulled=false;this.decor.add(this.lenses);
    const coneGeo=new THREE.ConeGeometry(1,1,12,1,true);coneGeo.translate(0,-.5,0);coneGeo.rotateX(-Math.PI/2);
    this.beams=new THREE.InstancedMesh(coneGeo,new THREE.MeshBasicMaterial({transparent:true,opacity:.028,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),this.capacity);this.beams.frustumCulled=false;this.beamsScene.add(this.beams);
    this.stats.fixtures=fixtures.length;this.stats.capacity=this.capacity;
  }
  buildObjects(objects){
    if(!this.objectRoot)return;
    // Remove object materials from shared update list before disposal.
    const old=new Set();this.objectRoot.traverse(o=>{if(o.material)old.add(o.material);});this.materials=this.materials.filter(m=>!old.has(m));disposeTree(this.objectRoot);
    for(const o of objects){const g=new THREE.Group();g.position.set(o.x,o.y,0);g.rotation.z=THREE.MathUtils.degToRad(o.rotation);g.userData.objectId=o.id;this.objectRoot.add(g);
      if(o.kind==='actor'){
        const mat=this.litMaterial('#c3b9a9');const head=new THREE.Mesh(new THREE.SphereGeometry(.17,12,10),mat);head.position.z=1.65;g.add(head);
        const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.21,.45,4,8),mat);torso.rotation.x=Math.PI/2;torso.position.z=1.13;g.add(torso);
        for(const sign of [-1,1]){this.box(g,[.13,.17,.7],[sign*.13,0,.4],'#82908f',true);const arm=this.box(g,[.105,.14,.6],[sign*.31,0,1.06],'#c3b9a9',true);arm.rotation.y=sign*.13;}
        this.box(g,[.1,.1,.06],[0,-.16,1.65],'#d9cbb6',true);
      }else if(o.kind==='table'){this.box(g,[1.6,.8,.1],[0,0,.8],'#b4a48e',true);for(const x of [-.65,.65])for(const y of [-.3,.3])this.box(g,[.08,.08,.75],[x,y,.375],'#7d807a',true);
      }else if(o.kind==='chair'){this.box(g,[.5,.5,.08],[0,0,.45],'#aa9b85',true);this.box(g,[.5,.06,.55],[0,.23,.73],'#aa9b85',true);for(const x of [-.2,.2])for(const y of [-.2,.2])this.box(g,[.05,.05,.45],[x,y,.225],'#7d807a',true);
      }else this.box(g,[1.4,1.2,.5],[0,0,.25],'#9caba7',true);
    }
  }
  update(fixtures,settings,selected,solo){
    this.fixtures=fixtures;this.selected=new Set(selected);this.lightData=[];const dummy=new THREE.Object3D(),lens=new THREE.Object3D();const groups=Object.fromEntries(this.meshes.map(m=>[m.userData.kind,m]));for(const m of this.meshes)m.userData.ids=[];
    let i=0;for(const f of fixtures){const meta=f.training,model=f._3DModel;const pos=vec(f.position),target=vec(meta.target);let dir=target.sub(pos).normalize();
      if(meta.kind==='moving'){const up=new THREE.Vector3(0,0,1),axis=new THREE.Vector3().crossVectors(dir,up);if(axis.lengthSq()<.0001)axis.set(1,0,0);axis.normalize();dir.applyAxisAngle(axis,THREE.MathUtils.degToRad(model.tilt||0));dir.applyAxisAngle(up,THREE.MathUtils.degToRad(model.pan||0)).normalize();}
      const intensity=effectiveIntensity(model.intensity*(model.strobeEffect==='Closed'?0:model.shutter??1),meta.broken,settings,!solo||!selected.length||this.selected.has(f.id));
      const color=new THREE.Color(meta.baseColor);if(['rgb','moving'].includes(meta.kind)){color.setRGB(...model.rgb.map(c=>c+(model.white||0)));if(model.colorPreset)color.set(Array.isArray(model.colorPreset)?model.colorPreset[0]:model.colorPreset);}
      const angle=Math.max(5,Math.min(120,Number.isFinite(model.zoom)&&model.zoom>0?model.zoom:meta.angle));this.lightData.push({pos,dir,intensity,color,angle});
      const mesh=groups[meta.kind]||groups.spot,j=mesh.userData.ids.length;mesh.userData.ids.push(f.id);dummy.position.copy(pos);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);dummy.scale.set(1,1,1);dummy.updateMatrix();mesh.setMatrixAt(j,dummy.matrix);mesh.setColorAt(j,new THREE.Color(this.selected.has(f.id)?'#f1cb80':meta.broken?'#b44f50':'#596970'));
      lens.position.copy(pos).addScaledVector(dir,.24);lens.updateMatrix();this.lenses.setMatrixAt(i,lens.matrix);this.lenses.setColorAt(i,meta.broken&&!settings.repair?new THREE.Color('#ef6266'):intensity?color.clone().multiplyScalar(.5+intensity*2):new THREE.Color('#4c5b5d'));
      const len=dir.z<-.01?Math.min(25,pos.z/-dir.z):18;dummy.scale.set(Math.tan(angle*Math.PI/360)*len,Math.tan(angle*Math.PI/360)*len,len);dummy.updateMatrix();this.beams.setMatrixAt(i,dummy.matrix);this.beams.setColorAt(i,color.clone().multiplyScalar(intensity));i++;
    }
    for(const m of this.meshes){m.count=m.userData.ids.length;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
    for(const m of [this.lenses,this.beams]){m.count=i;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
    this.beams.visible=!!settings.fog&&settings.quality!=='low';
  }
  render(){
    this.controls.update();const r=this.renderer;r.info.autoReset=false;r.info.reset();r.setRenderTarget(this.target);r.clear();
    for(const m of this.materials){m.uniforms.ambient.value=.045;m.uniforms.count.value=0;m.blending=THREE.NoBlending;m.depthWrite=true;}
    r.render(this.lit,this.camera);const lights=this.lightData?.filter(l=>l.intensity>.0001)||[];
    for(let start=0;start<lights.length;start+=BATCH){const batch=lights.slice(start,start+BATCH);for(const m of this.materials){m.blending=THREE.AdditiveBlending;m.depthWrite=false;m.uniforms.ambient.value=0;m.uniforms.count.value=batch.length;batch.forEach((l,i)=>{m.uniforms.lp.value[i].set(l.pos.x,l.pos.y,l.pos.z,l.intensity);m.uniforms.ld.value[i].set(l.dir.x,l.dir.y,l.dir.z,Math.cos(l.angle*Math.PI/360));m.uniforms.lc.value[i].copy(l.color);});}r.render(this.lit,this.camera);}
    r.render(this.decor,this.camera);r.render(this.beamsScene,this.camera);r.setRenderTarget(null);r.clear();r.render(this.postScene,this.postCamera);
    this.frames++;const now=performance.now();if(now-this.lastStats>1000){this.stats.fps=Math.round(this.frames*1000/(now-this.lastStats));this.stats.drawCalls=r.info.render.calls;this.stats.geometries=r.info.memory.geometries;this.frames=0;this.lastStats=now;}
  }
  dispose(){this.resize.disconnect();this.controls.dispose();disposeTree(this.decor);disposeTree(this.lit);disposeTree(this.beamsScene);disposeTree(this.postScene);this.target.dispose();this.renderer.domElement.removeEventListener('pointerdown',this.down);this.renderer.domElement.removeEventListener('pointerup',this.up);this.renderer.dispose();this.renderer.domElement.remove();}
}
