// Playwright run-code callback. Run against the Vite development server.
async (page) => {
  await page.waitForFunction(()=>window.__CJT?.ready);
  return await page.evaluate(async()=>{
    const app=window.__CJT;
    // Isolate a small actual WebGL render from the continuously running workbench.
    const previousRender=app.renderer.render;app.renderer.render=()=>{};
    const {StageRenderer}=await import('/src/training/renderer.js');
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {DEFAULT_STAGE}=await import('/src/training/rig.mjs');
    const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:256px;height:256px;z-index:30';document.body.append(host);
    const r=new StageRenderer(host,()=>{}),results=[];
    const assert=(name,value,detail)=>{results.push({name,pass:!!value,detail});if(!value)throw Error(name+': '+JSON.stringify(detail));};
    const f={id:0,position:{x:0,y:-4,z:8},training:{kind:'spot',target:{x:0,y:4,z:1},angle:36,baseColor:'#ffffff',broken:false},_3DModel:{intensity:1,shutter:1,rgb:[1,1,1]}};
    const settings={quality:'high',fog:false,master:1,repair:false,blackout:false};
    const render=()=>{r.update([f],settings,[],false);r.render();};
    const sample=(point,target)=>{
      const v=new THREE.Vector3(...point).project(r.camera);
      const x=Math.max(0,Math.min(target.width-5,Math.round((v.x+1)*target.width/2)-2));
      const y=Math.max(0,Math.min(target.height-5,Math.round((v.y+1)*target.height/2)-2));
      const pixels=new Uint16Array(5*5*4);r.renderer.readRenderTargetPixels(target,x,y,5,5,pixels);
      let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=THREE.DataUtils.fromHalfFloat(pixels[i])+THREE.DataUtils.fromHalfFloat(pixels[i+1])+THREE.DataUtils.fromHalfFloat(pixels[i+2]);return sum/75;
    };
    const sceneSample=point=>sample(point,r.target)+sample(point,r.hazeTarget);
    const camera=(position,target)=>{r.controls.enableDamping=false;r.controls.target.set(...target);r.camera.position.set(...position);r.controls.update();};
    try{
      r.build(DEFAULT_STAGE,[],[f]);camera([10,-14,13],[0,5,0]);render();const lit=sample([0,5,.01],r.target);
      f._3DModel.intensity=0;render();const dark=sample([0,5,.01],r.target);
      assert('front light illuminates stage floor without haze',lit>dark*2&&lit>dark+.02,{lit,dark});
      f.position={x:0,y:8,z:3};f.training.target={x:0,y:20,z:3};f._3DModel.intensity=1;
      camera([0,22,3],[0,12,3]);settings.fog=false;render();const baseline=sample([0,17,3],r.target);
      settings.fog=true;render();const blocked=sceneSample([0,17,3]);
      r.blockerUniforms.blockerCount.value=0;render();const unblocked=sceneSample([0,17,3]);
      assert('haze is visible when the wall blocker is deliberately disabled',unblocked>baseline+.01,{unblocked,baseline});
      assert('wall prevents haze escaping toward an outside camera',Math.abs(blocked-baseline)<.002,{blocked,baseline,unblocked});
      r.blockerUniforms.blockerCount.value=r.blockers.length;
      camera([5,12,3],[0,12,3]);settings.fog=false;render();const insideDark=sample([0,12,3],r.target);
      settings.fog=true;render();const insideHaze=sceneSample([0,12,3]);
      assert('haze remains visible on the source side of the wall',insideHaze>insideDark+.005,{insideHaze,insideDark});
      settings.fog=false;f.training.target={x:0,y:18,z:0};
      r.box(r.lit,[4,4,.2],[0,18,-.1],'#ffffff',true);
      camera([8,22,9],[0,18,0]);render();const receiverBlocked=sample([0,18,.01],r.target);
      r.blockerUniforms.blockerCount.value=0;render();const receiverUnblocked=sample([0,18,.01],r.target);
      assert('wall also prevents direct illumination on a receiver behind it',receiverUnblocked>receiverBlocked+.03,{receiverBlocked,receiverUnblocked});
      r.blockerUniforms.blockerCount.value=r.blockers.length;settings.fog=true;
      settings.blackout=true;render();assert('blackout removes haze instances',r.beams.count===0,r.beams.count);
      settings.blackout=false;f.training.broken=true;render();assert('broken fixture cannot emit haze',r.beams.count===0,r.beams.count);
      settings.repair=true;render();assert('repair comparison restores emission',r.beams.count===1,r.beams.count);
      const bad=r.renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable);
      assert('surface, depth composite and volume shaders compile',!bad.length,bad.length);
      return results;
    }finally{r.dispose();host.remove();app.renderer.render=previousRender;}
  });
}
