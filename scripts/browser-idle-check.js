// Playwright run-code callback against a NODE_ENV=development Vite server.
async (page) => {
  await page.waitForFunction(()=>window.__CJT?.renderer.stats.renderedFrames>0);
  const result=await page.evaluate(async()=>{
    const a=window.__CJT,Live=(await import('/src/models/DMX/live.model.js')).default;
    const saved=a.engine.snapshot(),results=[];
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const check=(name,ok,detail)=>{if(!ok)throw Error(name+': '+JSON.stringify(detail));results.push({name,pass:true,detail});};
    const until=async condition=>{const limit=performance.now()+30000;while(!condition()){if(performance.now()>limit)throw Error('animation did not settle');await wait(50);}};
    const idle=async name=>{
      await until(()=>!a.engine.animating&&!a.renderer.interactive&&a.loop.frame===null&&a.loop.timeout===null&&a.renderer.asyncLighting?.settled!==false);await wait(200);const before=a.renderer.stats.renderedFrames;let messages=0;
      const original=Live.w.onmessage;Live.w.onmessage=e=>{messages++;original(e);};
      await wait(1200);Live.w.onmessage=original;
      check(name,a.renderer.stats.renderedFrames===before&&messages===0&&a.loop.frame===null&&a.loop.timeout===null&&a.renderer.asyncLighting?.settled!==false,{frames:a.renderer.stats.renderedFrames-before,messages});
    };
    try{
      await idle('static stage has no redraw, frame timer or worker messages');
      a.settings.fog=true;await until(()=>a.loop.frame===null&&a.loop.timeout===null&&a.renderer.asyncLighting?.settled!==false);
      await idle('visible haze also sleeps without disabling its effect');
      a.engine.training.cueTimes[a.engine.cues[1].key]=.2;a.engine.go(1);
      await until(()=>!a.engine.transition&&a.loop.frame===null&&a.loop.timeout===null&&a.renderer.asyncLighting?.settled!==false);
      check('fade wakes and lands on the original cue',a.engine.fixtures[0].channels[0].value.DMX===95);
      await idle('finished fade returns to sleep');
      const before=a.renderer.stats.renderedFrames;a.loop.setVisible(false);a.engine.setVisible(false);a.engine.go(0);
      await wait(200);check('hidden page does not draw',a.renderer.stats.renderedFrames===before);
      a.engine.setVisible(true);a.loop.setVisible(true);await until(()=>!a.engine.transition);
      const demo=await(await fetch('./demo/showfiles/demo.showfile.json')).json();await a.engine.load(demo);a.sync();
      a.engine.advanced[0].handle.cue(true);await wait(200);check('imported native effect wakes its clock',Live.animations.length>0);
      Live.pause();const time=Live.time;await wait(150);check('paused native time is preserved',Live.time===time);
      const resumedAt=performance.now();Live.play();await wait(150);check('native effect resumes without counting paused duration',Live.time>time&&Live.time-time<=performance.now()-resumedAt+40);
      a.engine.stop();await until(()=>a.loop.frame===null&&a.loop.timeout===null&&a.renderer.asyncLighting?.settled!==false);await idle('stopped native effect releases its worker clock');
      return results;
    }finally{a.engine.stop();await a.engine.load(saved);a.sync();a.invalidate();}
  });
  return result;
}
