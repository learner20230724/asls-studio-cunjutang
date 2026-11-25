const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/opt/dayweave-reader/venv/lib/python3.12/site-packages/playwright/driver/package');
const fs=require('fs'),assert=require('node:assert/strict');
const {verifyImageLayout,verifyAnimation,verifyFullScreen}=require('./check-minitool-media.cjs');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),store={},errors=[],requests=[],media={photos:[],notes:[],files:{}};
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
await page.exposeFunction('nativeRead',key=>store[key]||null);await page.exposeFunction('nativeWrite',(key,data)=>{store[key]=data});
await page.exposeFunction('acceptPhoto',data=>media.photos.push(data));
await page.exposeFunction('acceptNote',data=>media.notes.push(data));
await page.exposeFunction('acceptFile',(path,data,append)=>{
  if(!append)media.files[path]=[];
  const buffer=Buffer.from(data,'base64');
  media.files[path].push(buffer);
  return {writtenBytes:buffer.length};
});
await page.addInitScript(()=>{
  window.xhs={launchOptions:{miniToolEnv:{buildVersion:9550000,userDataPath:'usr://mock'}},miniTool:{
    getStorage:async({key})=>({data:await window.nativeRead(key)}),
    setStorage:async({key,data})=>{if(window.failSave)throw Error('存储写入失败');await window.nativeWrite(key,data);return {errMsg:'setStorage:ok'}},
    saveImageToPhotosAlbum:async({filePath})=>window.acceptPhoto(filePath),
    postNote:async options=>{await window.acceptNote(options);window.mediaNote=options},
    getFileStorageInfo:async()=>({writeChunkMaxBytes:1024}),
    writeFile:async({filePath,data})=>window.acceptFile(filePath,data,false),
    appendFile:async({filePath,data})=>window.acceptFile(filePath,data,true),
    setKeepScreenOn:async()=>{},
  }};
  window.exportSvgs=[];
  const src=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  Object.defineProperty(HTMLImageElement.prototype,'src',{...src,set(value){
    if(typeof value==='string'&&value.startsWith('data:image/svg+xml;charset=utf-8,'))window.exportSvgs.push(value);
    src.set.call(this,value);
  }});
  window.framesSeen=0;
  const raf=window.requestAnimationFrame;
  window.requestAnimationFrame=fn=>raf.call(window,t=>{window.framesSeen++;fn(t)});
});
await page.goto(process.env.APP_URL||'http://127.0.0.1:5191');await page.locator('.loading').waitFor({state:'hidden'});await page.waitForTimeout(5000);
assert.equal(await page.getByLabel('空气光束').isChecked(),false);assert(!/存菊堂|学校|故障/.test(await page.locator('body').innerText()));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.setViewportSize({width:320,height:720});
const follow=page.getByRole('button',{name:'关注作者',exact:true});
const sharing=page.getByRole('button',{name:'存图与分享',exact:true});
assert((await follow.boundingBox()).x<(await sharing.boundingBox()).x);
await follow.tap();
await page.getByRole('status').filter({hasText:'作者旁的「关注」'}).waitFor();
await page.getByLabel('收起关注提示').tap();
await page.setViewportSize({width:390,height:844});
await page.waitForTimeout(700);
const before=await page.evaluate(()=>framesSeen);await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>framesSeen),before,'idle RAF');
await page.getByRole('button',{name:'摇头灯',exact:true}).tap();await page.getByLabel('水平转向').fill('45');await page.getByLabel('水平转向').dispatchEvent('input');await page.getByLabel('颜色 #58dbff',{exact:true}).tap();await page.waitForTimeout(1300);let saved=JSON.parse(store.STAGE_LIGHTING_GENERIC_V1);assert(saved.current.lights.some(l=>l.pan===45&&l.color==='#58dbff'));
await page.screenshot({path:'output/mini-mobile.png'});
await page.getByRole('button',{name:'布景',exact:true}).tap();await page.getByRole('button',{name:'＋椅子',exact:true}).tap();await page.getByLabel('横向位置').fill('4');await page.getByLabel('横向位置').dispatchEvent('input');await page.getByRole('button',{name:'一道幕 · 关闭',exact:true}).tap();await page.waitForTimeout(2300);saved=JSON.parse(store.STAGE_LIGHTING_GENERIC_V1);assert.equal(saved.current.objects.length,8);assert.equal(saved.current.objects.at(-1).x,4);assert.equal(saved.current.curtains[0].amount,1);
await page.getByRole('button',{name:'调度',exact:true}).tap();await page.getByRole('button',{name:'＋新增当前调度',exact:true}).tap();assert.equal(await page.locator('article').count(),13);
await page.reload();await page.locator('.loading').waitFor({state:'hidden'});await page.getByRole('button',{name:'调度',exact:true}).tap();assert.equal(await page.locator('article').count(),13);await page.getByRole('button',{name:'重置为模板调度',exact:true}).tap();assert.equal(await page.locator('article').count(),12);await page.getByRole('button',{name:'播放',exact:true}).tap();await page.waitForTimeout(5100);assert((await page.locator('.transport').innerText()).includes('启幕'));await page.getByRole('button',{name:'停止',exact:true}).tap();
await page.evaluate(()=>window.failSave=true);await page.getByRole('button',{name:'＋新增当前调度',exact:true}).tap();await page.getByRole('status').filter({hasText:'存储写入失败'}).waitFor();await page.getByLabel('关闭状态').tap();
await page.setViewportSize({width:844,height:390});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/mini-landscape.png'});
await page.setViewportSize({width:1440,height:960});await page.getByRole('button',{name:'重置为模板调度',exact:true}).click();await page.waitForTimeout(1500);await page.getByLabel('关闭状态').click();await page.screenshot({path:'output/mini-desktop.png'});
const gestures=await verifyFullScreen(page);
const imageSizes=await verifyImageLayout(page,media);
const video=await verifyAnimation(page,store,media);
await page.locator('.viewport canvas').evaluate(c=>c.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));await page.locator('canvas[aria-label="舞台平面图"]').waitFor({state:'visible'});await page.getByRole('button',{name:'灯光全开',exact:true}).click();await page.waitForTimeout(100);assert.equal(errors.length,0,errors.join('\n'));const origin=new URL(process.env.APP_URL||'http://127.0.0.1:5191').origin;const network=requests.filter(url=>!url.startsWith('blob:')&&!url.startsWith('data:'));assert(network.every(url=>new URL(url).origin===origin),'external requests: '+network.join(', '));
const result={scope:'Local Chromium with mock storage, gallery, file and note APIs',idleRAF:0,mobile:true,landscape:true,movingColor:true,curtains:true,props:true,captureRestore:true,reset12:true,playback:true,saveFailure:true,contextLossFallback:true,fullscreen:true,gestures,imageSizes,video,errors,requests:[...new Set(network)]};fs.writeFileSync('output/minitool-browser-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
