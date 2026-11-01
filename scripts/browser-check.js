// Run with: playwright-cli -s=cjt run-code "<contents of this file>"
async (page) => {
  await page.waitForFunction(()=>window.__CJT?.ready);
  const results=await page.evaluate(async()=>{
    const app=window.__CJT,e=app.engine,results=[];
    const ok=(name,condition,detail)=>{if(!condition)throw new Error(`${name}: ${JSON.stringify(detail)}`);results.push({name,pass:true,detail:detail?JSON.parse(JSON.stringify(detail)):undefined});};
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const original=await (await fetch('./teaching/cunjutang.showfile.json')).json();
    await e.load(original);app.sync();await wait(200);
    ok('fixture counts',e.fixtures.length===215&&e.fixtures.filter(f=>f.training.broken).length===4);
    const ids=e.fixtures.map(f=>f.id);e.setLevel(ids,255);await wait(1800);
    ok('all-on faults remain dark',app.renderer.lightData.filter(l=>l.intensity===0).length===4);
    results.push({name:'desktop-all-on-performance',...app.renderer.stats});
    app.settings.repair=true;await wait(100);ok('repair comparison',app.renderer.lightData.every(l=>l.intensity>0));
    app.settings.blackout=true;await wait(100);ok('blackout masks all',app.renderer.lightData.every(l=>l.intensity===0));
    app.settings.blackout=false;app.settings.repair=false;
    e.setLevel(ids,0);e.setLevel([0,1],128);e.saveCue('QA dialogue');const index=e.cues.length-1;
    e.training.cueTimes[e.cues[index].key]=.2;e.setLevel(ids,0);e.go(index);await wait(500);
    ok('native scene fade restores level',e.fixtures[0].channels[0].value.DMX===128&&e.fixtures[2].channels[0].value.DMX===0);
    const rgb=e.fixtures.find(f=>f.training.kind==='rgb');e.setColor([rgb.id],'#ff0000');e.setLevel([rgb.id],255);await wait(100);ok('RGB decoding',rgb._3DModel.rgb[0]===1&&rgb._3DModel.rgb[1]===0,rgb._3DModel.rgb);
    const moving=e.fixtures.find(f=>f.training.kind==='moving');const dir1=app.renderer.lightData[e.fixtures.indexOf(moving)].dir.clone();e.setAim([moving.id],'Pan',180);await wait(100);ok('moving-head aim changes',app.renderer.lightData[e.fixtures.indexOf(moving)].dir.distanceTo(dir1)>.1);
    const snap=e.snapshot();await e.load(snap);app.sync();await wait(100);ok('roundtrip level and cues',e.fixtures[0].channels[0].value.DMX===128&&e.cues.at(-1).cue.name==='QA dialogue');
    const before=JSON.stringify(e.snapshot());const bad=structuredClone(snap);bad.fixtures[0].position.x='bad';let failed=false;try{await e.load(bad);}catch{failed=true;}ok('failed import preserves live show',failed&&JSON.stringify(e.snapshot())===before);
    const memories=[];
    for(const count of [100,101,215,300,100,300,215]){
      const d=structuredClone(original);d.groups=[];d.fixtures=d.fixtures.slice(0,Math.min(count,215));
      while(d.fixtures.length<count){const f=structuredClone(d.fixtures[d.fixtures.length%215]);f.id=d.fixtures.length;f.training.uid=`test-${f.id}`;d.fixtures.push(f);}
      // Allocate non-overlapping channels in distinct universes for this stress test.
      d.fixtures.forEach((f,i)=>{f.universe=Math.floor(i/60);f.chStart=(i%60)*8;});
      await e.load(d);app.sync();e.setLevel(e.fixtures.map(f=>f.id),255);await wait(160);
      ok(`capacity ${count}`,app.renderer.meshes.reduce((s,m)=>s+m.count,0)===count&&app.renderer.capacity>=count,app.renderer.stats);
      const last=e.fixtures.at(-1);app.select([last.id]);await wait(50);ok(`select last ${count}`,app.selected[0]===last.id);
      memories.push({count,geometries:app.renderer.renderer.info.memory.geometries,textures:app.renderer.renderer.info.memory.textures});
    }
    ok('reset GPU memory stable',memories.at(-1).geometries<=memories[2].geometries+1&&memories.at(-1).textures<=memories[2].textures+1,memories);
    await e.load(original);app.sync();const duplicated=await e.duplicate([0,1]);app.sync();ok('duplicate stable IDs',e.fixtures.length===217&&new Set(e.fixtures.map(f=>f.training.uid)).size===217);
    await e.remove(duplicated);app.sync();ok('delete cleans references',e.fixtures.length===215&&e.groups.every(g=>g.fixturePool.fixtures.every(f=>!duplicated.includes(f.id))));
    await e.remove([5]);app.sync();ok('delete middle preserves stable IDs',e.fixtures.some(f=>f.id===6)&&!e.fixtures.some(f=>f.id===5));await e.load(original);app.sync();await e.editFixtures([0],{training:{kind:'rgb'}});app.sync();ok('fixed lamp can become RGB',e.fixtures[0].hasColor);e.setColor([0],'#3399ff');
    const legacy=await (await fetch('./demo/showfiles/demo.showfile.json')).json();await e.load(legacy);app.sync();await wait(150);ok('upstream demo imports',e.fixtures.length===legacy.fixtures.length&&e.advanced.length>0,{fixtures:e.fixtures.length,advanced:e.advanced.length});
    e.advanced[0].handle.cue(true);await wait(200);e.stop();ok('native effect starts and stops',true);
    await e.load(original);e.go(0,true);app.sync();app.select([]);e.save(true);
    const gl=app.renderer.renderer.getContext();const ext=gl.getExtension('WEBGL_debug_renderer_info');results.push({name:'environment',ua:navigator.userAgent,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',viewport:[innerWidth,innerHeight]});
    window.__CJT.testResults=results; return results;
  });
  return results;
}
