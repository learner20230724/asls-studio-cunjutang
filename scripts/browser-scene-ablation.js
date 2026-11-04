// Isolated WebGL ablation: same camera, mesh quality and sampling throughout.
async page=>{
 await page.waitForFunction(()=>window.__CJT?.ready&&window.__CJT.renderer.asyncLighting.settled);
 return page.evaluate(async()=>{
  const {StageRenderer}=await import('/src/training/renderer.js'),THREE=await import('/node_modules/three/build/three.module.js'),{DEFAULT_STAGE}=await import('/src/training/rig.mjs'),{defaultCurtains}=await import('/src/training/venue-layout.mjs');
  const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:256px;height:256px;z-index:50';document.body.append(host);const r=new StageRenderer(host,()=>{}),out=[];
  const f={id:0,position:{x:0,y:0,z:1},training:{kind:'spot',target:{x:0,y:8,z:0},angle:36,baseColor:'#ffffff',broken:false},_3DModel:{intensity:1,shutter:1,rgb:[1,1,1]}},settings={quality:'high',fog:false,master:1,repair:false,blackout:false};
  const curtains=defaultCurtains(DEFAULT_STAGE),objects=[{id:'prop',kind:'block',x:4,y:4,rotation:0}];
  const check=(name,ok,detail)=>{out.push({name,pass:!!ok,detail});if(!ok)throw Error(name+': '+JSON.stringify(detail));};
  const wait=async()=>{const limit=performance.now()+30000;while(!r.asyncLighting.settled){if(r.asyncLighting.error)throw Error(r.asyncLighting.error);if(performance.now()>limit)throw Error('Worker did not settle');await new Promise(resolve=>setTimeout(resolve,20));}};
  const sample=()=>{const v=new THREE.Vector3(0,8,.01).project(r.camera),pixels=new Uint16Array(100);r.renderer.readRenderTargetPixels(r.target,Math.round((v.x+1)*r.target.width/2)-2,Math.round((v.y+1)*r.target.height/2)-2,5,5,pixels);let sum=0;for(let i=0;i<100;i+=4)sum+=THREE.DataUtils.fromHalfFloat(pixels[i]);return sum/25;};
  const render=()=>{r.syncStage(objects,curtains);r.update([f],settings,[],false);r.render();};
  try{
   r.build(DEFAULT_STAGE,objects,[f],curtains);r.controls.target.set(0,8,0);r.camera.position.set(8,8,18);r.controls.update();render();const baseline=sample();
   f._3DModel.intensity=.4;render();const lights=sample();check('light-only ablation changes irradiance',lights<baseline*.8&&lights>baseline*.3,{baseline,lights});
   f._3DModel.intensity=1;objects[0].x=0;render();const prop=sample();check('object-only ablation creates a shadow',prop<baseline*.6,{baseline,prop});
   objects[0].x=4;curtains[0].closed=true;curtains[0].amount=1;render();const curtain=sample();check('curtain-only ablation blocks the same receiver',curtain<baseline*.6,{baseline,curtain});
   objects[0].x=0;f._3DModel.intensity=.4;render();const combined=sample();check('combined scene retains both blockers',combined<=Math.max(prop,curtain)+.002,{combined,prop,curtain});
   // The production worker must reproduce the synchronous reference pixels.
   r.enableAsyncLighting();render();await wait();r.render();const asyncBlocked=sample();check('background lighting matches combined reference',Math.abs(asyncBlocked-combined)<.002,{asyncBlocked,combined});
   curtains[0].closed=false;curtains[0].amount=0;objects[0].x=4;f._3DModel.intensity=1;render();await wait();r.render();const restored=sample();check('worker removes old shadows after motion ends',Math.abs(restored-baseline)<.002,{restored,baseline});
   const before=r.surfaceLighting.computations,canvas=r.renderer.domElement.width;r.camera.position.x+=2;r.controls.update();render();await wait();check('camera movement neither rebakes light nor reduces pixels',r.surfaceLighting.computations===before&&r.renderer.domElement.width===canvas,{computations:before,canvas});
   let count=0;r.lit.traverse(m=>{if(m.userData.curtainId)count++;});check('exactly four pairs of cloth panels; no fixed extra wings',count===8&&!r.venueShapes.some(b=>b.id.startsWith('wing')),{panels:count});
   return out;
  }finally{r.dispose();host.remove();}
 });
};
