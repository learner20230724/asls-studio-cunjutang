<script setup>
import {ref,computed,onMounted,onBeforeUnmount,nextTick} from 'vue';
import {StageRenderer} from '../training/renderer.js';
import {DemandLoop} from '../training/demand-loop.mjs';
import {fixtures,DEFAULT_STAGE,template,clone,validate} from './state.mjs';
import {advanceTransition,createCuePlayback,advanceCuePlayback} from './cue-playback.mjs';
import {buildWorkbenchImages} from './workbench-image.mjs';
import {recordStage,videoFormat} from './animation-video.mjs';
import {initPlatform,windowInfo,read,save,preview,canOpenVideoNote,canSaveImage,canShareImages,savePhoto,openImageNote,openVideoNote,keepScreenOn,downloadMedia,showLegacyFollow} from './platform.mjs';
const data=ref(template()),tab=ref('lights'),zone=ref('front'),selected=ref([]),objectId=ref('a'),status=ref(''),ready=ref(false),playing=ref(false),active=ref(-1),fog=ref(false),orbit=ref(false),flat=ref(false),level=ref(70),color=ref('#ffdbab'),pan=ref(0),tilt=ref(0),autoOn=ref(true),autoLevel=ref(70),host=ref(),diagram=ref(),quality=ref('auto'),shareOpen=ref(false),focus=ref(false),withDesk=ref(false),picker=ref(false),pickerEl=ref(),hue=ref(0),sat=ref(0),val=ref(1);
const zones=[['front','面光'],['ear-left','左耳光'],['ear-right','右耳光'],['side-left','左侧光'],['side-right','右侧光'],['top-1','顶光一'],['top-2','顶光二'],['top-3','顶光三'],['top-4','顶光四'],['top-5','顶光五'],['rear','彩灯'],['moving','摇头灯']];
const visible=computed(()=>fixtures.filter(f=>zone.value==='moving'?f.training.kind==='moving':f.training.zone===zone.value));
const object=computed(()=>data.value.current.objects.find(o=>o.id===objectId.value));
const desk=ref(), followHelp=ref(false), webImages=ref([]), exportingImages=ref(false), videoState=ref(''), videoProgress=ref(0);
const isTurned=()=>focus.value&&matchMedia('(orientation: portrait)').matches;
let renderer,loop,transition,playback,recording,openingFollow=false,last=0,slow=0,saveTimer,disposed=false,dragSV=false,dragHue=false;
function notice(s){status.value=s}
function invalidate(){loop?.invalidate()}
function sync(f){if(!renderer||flat.value)return;fixtures.forEach((fixture,i)=>{const l=f.lights[i];fixture.training.baseColor=l.color;fixture._3DModel={intensity:l.level,rgb:[1,3,5].map(k=>parseInt(l.color.slice(k,k+2),16)/255),pan:l.pan,tilt:l.tilt,shutter:1}});renderer.syncStage(f.objects,f.curtains);renderer.update(fixtures,{fog:fog.value,master:1,blackout:false,repair:true},selected.value,false);}
function draw2d(frame,c=diagram.value,w=c?.clientWidth,h=c?.clientHeight,ratio=1.5){if(!w||!h)return;const width=Math.round(w*ratio),height=Math.round(h*ratio);if(c.width!==width)c.width=width;if(c.height!==height)c.height=height;const x=c.getContext('2d');x.setTransform(ratio,0,0,ratio,0,0);x.fillStyle='#101416';x.fillRect(0,0,w,h);const scale=Math.min((w-32)/21,(h-45)/15),ox=(w-21*scale)/2,oy=12;x.fillStyle='#39342a';x.fillRect(ox,oy,21*scale,15*scale);x.save();x.beginPath();x.rect(ox,oy,21*scale,15*scale);x.clip();frame.lights.forEach((l,i)=>{if(!l.level)return;const f=fixtures[i],tx=ox+(f.training.target.x+10.5+Math.sin(l.pan*Math.PI/180)*3)*scale,ty=oy+(15-f.training.target.y)*scale;const g=x.createRadialGradient(tx,ty,0,tx,ty,scale*3);g.addColorStop(0,l.color+'88');g.addColorStop(1,l.color+'00');x.globalAlpha=l.level;x.fillStyle=g;x.fillRect(ox,oy,21*scale,15*scale)});x.globalAlpha=1;frame.curtains.forEach(c=>{x.fillStyle='#7c293f';const a=c.amount??(c.closed?1:0),cw=(.7+9.8*a)*scale;x.fillRect(ox,oy+(15-c.y)*scale,cw,5);x.fillRect(ox+(21*scale)-cw,oy+(15-c.y)*scale,cw,5)});frame.objects.forEach(o=>{const px=ox+(o.x+10.5)*scale,py=oy+(15-o.y)*scale;x.fillStyle=o.id===objectId.value?'#ffd88a':'#e8ddc2';x.fillRect(px-5,py-5,o.kind==='table'?20:10,10);x.font='11px sans-serif';x.fillText(o.name,px-15,py+20)});x.restore();x.fillStyle='#bab6a9';x.fillText('观众席',w/2-20,h-10);}
function draw(now){
  if(disposed)return;
  const dt=last?Math.max(0,now-last):0;
  last=now;
  const capture=recording?.playing?recording:null;
  if(capture){
    const elapsed=capture.last?Math.max(0,now-capture.last):0;
    capture.last=capture.recorder.started?now:0;
    advanceCuePlayback(capture.playback,elapsed);
    videoProgress.value=Math.floor(100*capture.playback.position/capture.playback.duration);
  }else if(playback){
    advanceCuePlayback(playback,dt);
    active.value=playback.index;
    data.value.current=playback.frame;
    if(playback.done)stop();
  }else if(transition){
    data.value.current=advanceTransition(transition,dt);
    if(transition.elapsed>=transition.duration)transition=null;
  }

  const frame=capture?.playback.frame??data.value.current;
  const start=performance.now();
  if(flat.value)draw2d(frame);
  else {
    sync(frame);
    renderer?.advanceOrbit(now);
    renderer?.render();
  }

  if(capture){
    capture.recorder.draw(stageCanvas());
    if(capture.playback.done){
      capture.playing=false;
      videoState.value='finishing';
      capture.recorder.finish();
    }
    return;
  }
  const cost=performance.now()-start;
  if((playing.value||orbit.value)&&cost>70)slow++;else slow=Math.max(0,slow-1);
  if(slow>60){
    slow=0;
    if(quality.value!=='low'){quality.value='low';renderer?.setQuality('low');fog.value=false;}
    else fallback('已切换平面视图');
  }
}
function stop(){playing.value=false;playback=null;transition=null;last=0;invalidate()}
function scheduleSave(delay=900){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{save(data.value).catch(e=>notice(e.message||'保存失败'))},delay)}
function edit(){stop();invalidate();scheduleSave()}
function select(id){selected.value=[id];const l=data.value.current.lights[id];level.value=Math.round(l.level*100);color.value=l.color;pan.value=l.pan;tilt.value=l.tilt;if(autoOn.value){l.level=autoLevel.value/100;level.value=autoLevel.value;}edit()}
function group(z){zone.value=z;selected.value=visible.value.map(f=>f.id);const l=data.value.current.lights[selected.value[0]];if(l){level.value=Math.round(l.level*100);color.value=l.color;pan.value=l.pan;tilt.value=l.tilt}if(autoOn.value)selected.value.forEach(i=>data.value.current.lights[i].level=autoLevel.value/100);edit()}
function change(){for(const i of selected.value)Object.assign(data.value.current.lights[i],{level:level.value/100,color:color.value,pan:pan.value,tilt:tilt.value});edit()}
function all(v){data.value.current.lights.forEach(l=>l.level=v);edit()}
function go(i){stop();const c=data.value.cues[i];if(!c)return;active.value=i;transition={from:clone(data.value.current),to:clone(c.frame),duration:c.seconds*1000,elapsed:0};invalidate()}
function play(){
  stop();
  if(!data.value.cues.length)return notice('请先新增调度');
  playback=createCuePlayback(data.value.current,data.value.cues);
  active.value=0;
  playing.value=true;
  invalidate();
}
function capture(){stop();if(data.value.cues.length>=60)return notice('最多保存 60 条调度');data.value.cues.push({name:'调度 '+(data.value.cues.length+1),seconds:3,hold:2,frame:clone(data.value.current)});persist()}
async function persist(){try{await save(data.value);notice('已保存')}catch(e){notice(e.message||'保存失败')}}
function reset(){stop();data.value=template();fog.value=false;selected.value=[];active.value=-1;renderer?.view('front');invalidate();persist()}
function curtain(i){stop();const to=clone(data.value.current),c=to.curtains[i];c.closed=!c.closed;c.amount=c.closed?1:0;transition={from:clone(data.value.current),to,duration:1800,elapsed:0};invalidate();scheduleSave(2100)}
function add(kind){if(data.value.current.objects.length>=24)return notice('最多放置 24 个对象');const id='o'+Date.now();data.value.current.objects.push({id,kind,name:{actor:'演员',chair:'椅子',table:'桌子',block:'方台'}[kind],x:0,y:5,rotation:0});objectId.value=id;edit()}
function clamp(n){return Math.min(1,Math.max(0,n))}
function hsv2hex(h,s,v){const f=n=>{const k=(n+h/60)%6,c=v-v*s*Math.max(0,Math.min(k,4-k,1));return Math.round(c*255).toString(16).padStart(2,'0')};return '#'+f(5)+f(3)+f(1)}
function hex2hsv(hex){const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=((g-b)/d+6)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60}return [h,mx?d/mx:0,mx]}
function applyHSV(){color.value=hsv2hex(hue.value,sat.value,val.value);change()}
function openPicker(){const [h,s,v]=hex2hsv(color.value);hue.value=h;sat.value=s;val.value=v;picker.value=true;nextTick(()=>{pickerEl.value&&pickerEl.value.scrollIntoView({block:'nearest'})})}
function downSV(e){dragSV=true;try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}moveSV(e)}
function moveSV(e){if(!dragSV)return;const r=e.currentTarget.getBoundingClientRect();sat.value=clamp((e.clientX-r.left)/r.width);val.value=1-clamp((e.clientY-r.top)/r.height);applyHSV()}
function downHue(e){dragHue=true;try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}moveHue(e)}
function moveHue(e){if(!dragHue)return;const r=e.currentTarget.getBoundingClientRect();hue.value=clamp((e.clientX-r.left)/r.width)*360;applyHSV()}
async function followAuthor(){
  if(followHelp.value){followHelp.value=false;return;}
  if(openingFollow)return;
  openingFollow=true;
  followHelp.value=!(await showLegacyFollow());
  openingFollow=false;
}
function stageCanvas(){return flat.value?diagram.value:renderer?.renderer.domElement}
function snapshot(){
  const canvas=stageCanvas();
  const w=canvas?.clientWidth,h=canvas?.clientHeight;
  if(!w||!h)return null;
  const scale=Math.max(1,Math.min(3,1600/Math.max(w,h)));
  if(!flat.value)return renderer.snapshotDataURL(scale);
  const output=document.createElement('canvas');
  draw2d(data.value.current,output,w,h,1.5*scale);
  return output.toDataURL('image/png');
}

async function exportImages(share){
  if(exportingImages.value||videoState.value)return;
  if(share&&!canShareImages())return notice('请在小红书 App 内发笔记');
  if(!share&&!preview&&!canSaveImage())return notice('请在小红书 9.42 及以上版本保存');
  shareOpen.value=false;
  exportingImages.value=true;
  notice('正在生成图片…');
  try{
    const stage=snapshot();
    if(!stage||stage==='data:,')throw Error('当前视图无法截图');
    const images=[stage];
    if(withDesk.value)images.push(...await buildWorkbenchImages(stage,desk.value));
    status.value='';
    if(share){
      await openImageNote(images);
    }else if(preview){
      if(images.length===1)downloadMedia(stage,'光场-舞台.png');
      else webImages.value=images;
    }else{
      for(const image of images)await savePhoto(image);
      notice('已保存 '+images.length+' 张到相册');
    }
  }catch(error){
    notice(error.errMsg||error.message||(share?'无法打开发布页':'保存失败'));
  }finally{
    exportingImages.value=false;
  }
}

async function exportAnimation(){
  if(videoState.value||exportingImages.value)return;
  if(!data.value.cues.length)return notice('请先新增调度');
  if(!preview&&!canOpenVideoNote())return notice('请在小红书 App 内导出动画');
  const format=videoFormat(preview);
  if(!format)return notice('当前设备无法录制'+(preview?'舞台视频':' MP4 视频'));
  const canvas=stageCanvas();
  if(!canvas?.width||!canvas.height)return notice('舞台还在准备，请稍后再试');

  shareOpen.value=false;
  status.value='';
  stop();
  let capture;
  let screen;
  try{
    if(flat.value)draw2d(data.value.current);
    else {
      sync(data.value.current);
      renderer.render();
    }
    const recorder=recordStage(canvas,format);
    capture={recorder,playback:createCuePlayback(data.value.current,data.value.cues),playing:true,last:0,cancelled:false};
    recording=capture;
    videoProgress.value=0;
    videoState.value='recording';
    screen=keepScreenOn(true);
    invalidate();
    const blob=await recorder.result;
    await screen;
    await keepScreenOn(false);
    screen=null;
    if(capture.cancelled||disposed)return;
    if(preview){
      const extension=blob.type==='video/mp4'?'mp4':'webm';
      downloadMedia(blob,'光场-调度动画.'+extension);
      notice('动画已导出');
    }else await openVideoNote(blob);
  }catch(error){
    if(!capture?.cancelled&&!disposed)notice(error.errMsg||error.message||'动画导出失败');
  }finally{
    if(recording===capture)recording=null;
    if(screen){
      await screen;
      await keepScreenOn(false);
    }
    videoState.value='';
    invalidate();
  }
}

function cancelAnimation(message){
  if(!recording||!recording.playing)return;
  recording.cancelled=true;
  recording.playing=false;
  recording.recorder.cancel();
  videoState.value='finishing';
  if(message)notice(message);
}
function fallback(message){cancelAnimation('舞台视图已切换，请重新导出动画');flat.value=true;orbit.value=false;if(renderer){renderer.dispose();renderer=null}notice(message);invalidate()}
function visibility(){if(document.hidden){cancelAnimation('录制已中断，请在前台重新导出');loop?.setVisible(false);renderer?.asyncLighting?.worker.terminate();}else {last=0;renderer?.asyncLighting?.restart();windowInfo();loop?.setVisible(true);invalidate()}}
onMounted(async()=>{await initPlatform();try{const saved=await read();if(saved)data.value=validate(saved)}catch{notice('读取存档失败，当前显示模板')}if(disposed)return;loop=new DemandLoop({draw,active:()=>!!recording?.playing||!!transition||playing.value||orbit.value||!!renderer?.isViewAnimating});try{renderer=new StageRenderer(host.value,id=>{tab.value='lights';select(id)},invalidate,isTurned);renderer.build(DEFAULT_STAGE,data.value.current.objects,fixtures,data.value.current.curtains);renderer.enableAsyncLighting();renderer.onOrbitChange=v=>{orbit.value=v};renderer.view('front');renderer.onObjectSelect=id=>{objectId.value=id;tab.value='props'};renderer.onObjectMove=(id,x,y)=>{const o=data.value.current.objects.find(o=>o.id===id);if(o){o.x=x;o.y=y;edit()}};renderer.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('图形暂不可用，已切换平面视图')});renderer.onError=()=>fallback('已切换平面视图');}catch{fallback('当前使用平面视图')}ready.value=true;invalidate();document.addEventListener('visibilitychange',visibility);window.addEventListener('resize',invalidate)});
onBeforeUnmount(()=>{disposed=true;cancelAnimation();clearTimeout(saveTimer);loop?.dispose();renderer?.dispose();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',invalidate)});
</script>
<template>
<div class="tool" :class="{focus}">
<header>
<div class="brand"><b>◈ 光场</b><span>灯光排练室</span></div>
<div class="acts">
<button v-if="!preview" class="shot" :aria-expanded="followHelp" aria-controls="follow-help" @click="followAuthor">关注作者</button>
<button class="shot" aria-label="存图与分享" :disabled="!!videoState||exportingImages" @click="followHelp=false;shareOpen=true">存图与分享</button>
</div>
<p v-if="followHelp" id="follow-help" class="follow-help" role="status">点右上角「···」，再点作者旁的「关注」。<button aria-label="收起关注提示" @click="followHelp=false">×</button></p>
</header>
<main :class="{pending:!ready}" :aria-busy="!ready">
<section class="stage">
<div class="stage-actions"><select v-model="quality" aria-label="画质" @change="renderer?.setQuality(quality);invalidate()"><option value="auto">清晰</option><option value="high">精细</option><option value="low">轻量</option></select><button @click="all(1)">灯光全开</button><button @click="all(0)">灯光全关</button></div>
<div ref="host" class="viewport" v-show="!flat"></div><canvas v-show="flat" ref="diagram" class="viewport" aria-label="舞台平面图"></canvas>
<div class="view-actions">
<button class="focus-btn" @click="followHelp=false;focus=!focus">{{focus?'退出全屏':'全屏'}}</button>
<button @click="renderer?.view('front',{animate:true});invalidate()">正视</button>
<button @click="renderer?.view('top',{animate:true});invalidate()">俯视</button>
<button :aria-pressed="orbit" :disabled="flat" @click="orbit=!orbit;renderer?.setOrbit(orbit);invalidate()">环绕</button>
<label v-show="!focus"><input type="checkbox" v-model="fog" :disabled="flat" @change="invalidate">空气光束</label>
</div>
</section>
<section class="desk" ref="desk">
<nav><button v-for="t in [['lights','调灯'],['props','布景'],['cues','调度']]" :key="t[0]" :class="{active:tab===t[0]}" @click="tab=t[0]">{{t[1]}}</button></nav>
<div class="panel" v-show="tab==='lights'">
<div class="row"><h2>灯位分区</h2><label><input type="checkbox" v-model="autoOn">选中即亮</label></div><label class="slider">试灯亮度 <input aria-label="试灯亮度" type="range" min="0" max="100" v-model.number="autoLevel" @input="if(autoOn){selected.forEach(i=>data.current.lights[i].level=autoLevel/100);level=autoLevel;edit()}"><output>{{autoLevel}}%</output></label>
<div class="zones"><button v-for="z in zones" :key="z[0]" :class="{active:zone===z[0]}" @click="group(z[0])">{{z[1]}}</button></div>
<div class="lamps"><button v-for="f in visible" :key="f.id" :class="{active:selected.includes(f.id)}" @click="select(f.id)">{{f.training.kind==='moving'?'M':'L'}}{{f.training.number}}</button></div>
<template v-if="selected.length"><h2>已选 {{selected.length}} 盏灯</h2><label class="slider">亮度<input aria-label="亮度" type="range" min="0" max="100" v-model.number="level" @input="change"><output>{{level}}%</output></label><div class="palette"><button v-for="c in ['#fff4dc','#ffbe68','#ff657f','#da6fff','#688fff','#58dbff','#78efbd']" :key="c" :style="{background:c}" :aria-label="'颜色 '+c" @click="color=c;change()"></button><button class="custom" :style="{background:color}" aria-label="自定义颜色" :aria-expanded="picker" @click="picker?picker=false:openPicker()"><span>自定义</span></button></div><div v-if="picker" class="picker" ref="pickerEl"><div class="sv" aria-label="饱和度与明度" @pointerdown.prevent="downSV" @pointermove="moveSV" @pointerup="dragSV=false" @pointercancel="dragSV=false" :style="{background:'linear-gradient(to top,#000,rgba(0,0,0,0)),linear-gradient(to right,#fff,hsl('+hue+',100%,50%))'}"><i class="thumb" :style="{left:sat*100+'%',top:(1-val)*100+'%'}"></i></div><div class="hue" aria-label="色相" @pointerdown.prevent="downHue" @pointermove="moveHue" @pointerup="dragHue=false" @pointercancel="dragHue=false"><i class="thumb" :style="{left:hue/360*100+'%'}"></i></div><div class="picker-foot"><span>{{color}}</span><button @click="picker=false">收起</button></div></div><template v-if="selected.some(i=>fixtures[i].training.kind==='moving')"><label class="slider">水平<input aria-label="水平转向" type="range" min="-180" max="180" v-model.number="pan" @input="change"><output>{{pan}}°</output></label><label class="slider">俯仰<input aria-label="垂直转向" type="range" min="-90" max="90" v-model.number="tilt" @input="change"><output>{{tilt}}°</output></label></template></template>
</div>
<div class="panel" v-show="tab==='props'"><h2>四道布幕</h2><div class="zones curtains"><button v-for="(c,i) in data.current.curtains" :key="c.id" @click="curtain(i)">{{c.name}} · {{c.closed?'打开':'关闭'}}</button></div><h2>演员与道具</h2><div class="zones"><button @click="add('actor')">＋演员</button><button @click="add('chair')">＋椅子</button><button @click="add('table')">＋桌子</button><button @click="add('block')">＋方台</button></div><select aria-label="选择道具" v-model="objectId"><option v-for="o in data.current.objects" :key="o.id" :value="o.id">{{o.name}}</option></select><template v-if="object"><label class="slider">横向<input aria-label="横向位置" type="range" min="-9" max="9" step=".1" v-model.number="object.x" @input="edit"><output>{{object.x.toFixed(1)}}</output></label><label class="slider">纵深<input aria-label="纵向位置" type="range" min="1" max="14" step=".1" v-model.number="object.y" @input="edit"><output>{{object.y.toFixed(1)}}</output></label><label class="slider">旋转<input aria-label="道具旋转" type="range" min="0" max="360" v-model.number="object.rotation" @input="edit"></label><button @click="data.current.objects=data.current.objects.filter(o=>o.id!==objectId);edit()">删除所选道具</button></template></div>
<div class="panel" v-show="tab==='cues'"><div class="row transport"><button class="primary" @click="playing?stop():play()">{{playing?'停止':'播放'}}</button><span>{{active<0?'调度编排':data.cues[active]?.name}}</span></div><div class="row edits"><button @click="reset">重置为模板调度</button><button @click="capture">＋新增当前调度</button></div><article v-for="(c,i) in data.cues" :key="i" :class="{current:i===active}"><div class="row"><span class="number">{{String(i+1).padStart(2,'0')}}</span><input :aria-label="'调度名称 '+(i+1)" v-model="c.name" maxlength="30"><button @click="go(i)">调用</button></div><div class="row"><label class="cue-timing"><span>渐变</span><input :aria-label="'渐变 '+(i+1)" type="number" min=".2" max="30" step=".5" v-model.number="c.seconds" @change="c.seconds=Math.max(.2,Math.min(30,Number(c.seconds)||3))"><span>秒</span></label><button @click="c.frame=clone(data.current);notice('已更新调度')">更新</button><button :disabled="i===0" @click="stop();data.cues.splice(i-1,0,data.cues.splice(i,1)[0]);active=-1">↑</button><button :aria-label="'删除调度 '+(i+1)" @click="stop();data.cues.splice(i,1);active=-1">×</button></div></article></div>
</section>
</main>
<div v-if="shareOpen" class="sheet" @click.self="shareOpen=false">
<div class="sheet-card" role="dialog" aria-label="存图与分享">
<b>存图与分享</b>
<label class="opt"><input type="checkbox" v-model="withDesk">是否保存工作台</label>
<button @click="exportImages(false)">存图</button>
<button v-if="!preview" @click="exportImages(true)">分享</button>
<button @click="exportAnimation">导出我制作的动画</button>
<button @click="shareOpen=false">取消</button>
</div>
</div>
<div v-if="webImages.length" class="sheet" @click.self="webImages=[]">
<div class="sheet-card" role="dialog" aria-label="下载图片">
<b>下载图片</b>
<button v-for="(image,i) in webImages" :key="i" @click="downloadMedia(image,'光场-'+(i?'工作台-'+i:'舞台')+'.png')">{{i?'下载工作台图 '+i:'下载舞台图'}}</button>
<button @click="webImages=[]">关闭</button>
</div>
</div>
<div v-if="videoState" class="recording-mask">
<div class="recording-card" role="dialog" aria-label="导出动画">
<span role="status">{{videoState==='recording'?'正在录制调度 '+videoProgress+'%':'正在处理视频…'}}</span>
<button v-if="videoState==='recording'" @click="cancelAnimation('已取消录制')">取消录制</button>
</div>
</div>
<div v-if="status" class="status" role="status" @click="status=''">{{status}} <button aria-label="关闭状态" @click="status=''">×</button></div><div v-if="!ready" class="loading">正在准备舞台…</div>
</div>
</template>
