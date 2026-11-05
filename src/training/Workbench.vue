<script setup>
import {ref,reactive,computed,nextTick,onMounted,onBeforeUnmount,watch} from 'vue';
import {TrainingEngine} from './engine';
import {StageRenderer} from './renderer';
import {DemandLoop} from './demand-loop.mjs';
import {clone,LABELS,TYPES,DEFAULT_STAGE} from './rig.mjs';
import ColorPalette from './ColorPalette.vue';
import {installDemo,createShowcaseTemplate} from './demo.mjs';
import {translate} from './i18n.mjs';

const lang=ref(localStorage.getItem('CJT_LANGUAGE')||'zh'),t=s=>translate(s,lang.value);
const engine=new TrainingEngine(),host=ref(),fileInput=ref(),ready=ref(false),busy=ref(false),error=ref(''),message=ref(''),pulse=ref(0);
const selected=ref([]),zone=ref('all'),search=ref(''),solo=ref(false),tab=ref('lights'),mobile=ref('stage'),help=ref(false),showFaults=ref(false),projectName=ref('存菊堂 · 话剧灯光预演');
const settings=reactive({quality:'auto',fog:false,repair:false,blackout:false,master:1,autoOn:false,autoLevel:70}),stageForm=reactive(clone(DEFAULT_STAGE)),rowText=ref('1.5, 4.25, 7, 9.75, 12.5');
const fixtureForm=reactive({name:'',uid:'',zone:'front',number:1,row:0,block:0,kind:'spot',angle:36,broken:false,x:0,y:0,z:8,tx:0,ty:4,tz:0,baseColor:'#ffd5a3'});
const objectId=ref('');
let renderer,loop,saveTimer;
const orbiting=ref(false),tour=ref(-1);
const tourSteps=[{title:'左侧 · 选择灯光',text:'按灯位分区选择灯组；选中即亮可以快速试灯，摇头灯有独立入口。',panel:'rig'},{title:'右侧 · 调整与布置',text:'在这里调亮度、颜色和方向。演员与道具可以在舞台上直接按住拖动。',panel:'controls'},{title:'上方 · 全局与幕布',text:'画质、灯光全开和全关在右上角；舞台上方的四道幕可以分别缓缓开合。',panel:'stage'},{title:'下方 · 保存与编排',text:'新增当前场景会一起记录灯光、站位和幕布。直接改名称，设置渐变时间，再按顺序播放。',panel:'cues'},{title:'准备好了 · 从开场到谢幕',text:'点击播放案例，观看启幕、双人对话、摇头灯交叉扫动、旋转变色和谢幕。案例会加入场景列表，之后可以继续修改。',panel:'stage'}];
function guide(index=0){tour.value=index;mobile.value=tourSteps[index].panel;}
function closeGuide(){tour.value=-1;localStorage.setItem('CJT_TOUR_V4','done');mobile.value='stage';}
function playDemo(){closeGuide();engine.stop();const index=installDemo(engine);settings.blackout=false;settings.master=1;solo.value=false;renderer.setOrbit(false);renderer.view('front');engine.go(index,true);engine.play();engine.playEnd=index+engine.cues.filter(c=>c.group===engine.cues[index].group).length-1;changed();}
let internalPulse=false,lastUI=0;
function refreshUI(){internalPulse=true;pulse.value++;internalPulse=false;}
function invalidate(){loop?.invalidate();}
function queueSave(){clearTimeout(saveTimer);if(!ready.value)return;saveTimer=setTimeout(()=>{if(engine.dirty&&!busy.value&&!engine.animating){engine.save();refreshUI();}else if(engine.dirty)queueSave();},2000);}
let fixtureBaseline={};
const fixtures=computed(()=>{pulse.value;return ready.value?engine.fixtures:[];});
const picked=computed(()=>fixtures.value.filter(f=>selected.value.includes(f.id)));
const filtered=computed(()=>fixtures.value.filter(f=>(zone.value==='all'||(zone.value==='moving'?f.training.kind==='moving':f.training.zone===zone.value))&&(!showFaults.value||f.training.broken)&&(!search.value||`${f.name} ${f.training.uid}`.toLowerCase().includes(search.value.toLowerCase()))));
const zones=computed(()=>[...new Set(fixtures.value.map(f=>f.training.zone))].map(id=>({id,name:LABELS[id]||id,count:fixtures.value.filter(f=>f.training.zone===id).length,bad:fixtures.value.filter(f=>f.training.zone===id&&f.training.broken).length})));
const broken=computed(()=>fixtures.value.filter(f=>f.training.broken).length);
const cues=computed(()=>{pulse.value;return ready.value?engine.cues:[];});
const objects=computed(()=>{pulse.value;return ready.value?engine.training.objects:[];});
const activeObject=computed(()=>objects.value.find(o=>o.id===objectId.value));
const level=computed(()=>{pulse.value;const f=picked.value[0];return f?.quickChannelsAccessors.Dimmer?.[0]?.value.DMX||0;});
const colorValue=computed(()=>{pulse.value;const f=picked.value.find(f=>f.hasColor);return f?'#'+f.color.map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''):'#ffffff';});
const hasColor=computed(()=>picked.value.some(f=>f.hasColor)),hasMoving=computed(()=>picked.value.some(f=>f.training.kind==='moving'));
const movingCount=computed(()=>fixtures.value.filter(f=>f.training.kind==='moving').length);
const curtains=computed(()=>{pulse.value;return ready.value?engine.training.curtains:[];});
function note(s){message.value=t(s);setTimeout(()=>message.value='',3500);}
function changed(){engine.mark();pulse.value++;}
watch(lang,v=>{localStorage.setItem('CJT_LANGUAGE',v);document.documentElement.lang=v==='en'?'en':'zh-CN';});
watch(settings,()=>{if(!ready.value)return;Object.assign(engine.training.settings,settings);changed();},{deep:true});
watch(()=>settings.quality,q=>renderer?.setQuality(q));
watch(pulse,()=>{if(!internalPulse)invalidate();},{flush:'sync'});
watch([selected,solo],invalidate,{deep:true});
watch(()=>{pulse.value;return engine.active;},()=>nextTick(()=>document.querySelector('.cue-card.active')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'})));
watch(selected,()=>{const f=picked.value[0];if(f)Object.assign(fixtureForm,{name:f.name,uid:f.training.uid,zone:f.training.zone,number:f.training.number,row:f.training.row||0,block:f.training.block||0,kind:f.training.kind,angle:f.training.angle,broken:f.training.broken,...f.position,tx:f.training.target.x,ty:f.training.target.y,tz:f.training.target.z,baseColor:f.training.baseColor});fixtureBaseline=clone(fixtureForm);});
function applyAutoTest(){if(settings.autoOn&&ready.value&&selected.value.length){engine.setLevel(selected.value,Math.round(settings.autoLevel*255/100));pulse.value++;}}
function toggleAutoTest(){settings.autoOn=!settings.autoOn;applyAutoTest();}
function pick(id,multi=false){selected.value=multi?(selected.value.includes(id)?selected.value.filter(v=>v!==id):[...selected.value,id]):[id];tab.value='lights';mobile.value='controls';applyAutoTest();}
function pickZone(id){zone.value=id;selected.value=fixtures.value.filter(f=>id==='all'||f.training.zone===id).map(f=>f.id);applyAutoTest();}
function pickMoving(){zone.value='moving';selected.value=fixtures.value.filter(f=>f.training.kind==='moving').map(f=>f.id);tab.value='lights';mobile.value='controls';applyAutoTest();}
function allLights(on){engine.allLights(on);if(on)solo.value=false;Object.assign(settings,engine.training.settings);changed();}
function toggleCurtain(c){engine.setCurtain(c.id,!c.closed);changed();}
function updateCurtain(c,event){const value=Number(event.target.value);c.y=Math.max(0,Math.min(engine.training.stage.depth,Number.isFinite(value)?value:0));sync();changed();}
function setView(name){renderer?.view(name);orbiting.value=false;invalidate();}
function toggleOrbit(){renderer?.setOrbit(!orbiting.value);invalidate();}
function resetAim(){engine.setAim(selected.value,'Pan',128);engine.setAim(selected.value,'Tilt',128);changed();}
function sync(){projectName.value=engine.show.name;Object.assign(settings,engine.training.settings);Object.assign(stageForm,clone(engine.training.stage));rowText.value=stageForm.rows.join(', ');renderer.build(engine.training.stage,engine.training.objects,engine.fixtures,engine.training.curtains);selected.value=selected.value.filter(id=>engine.fixtures.some(f=>f.id===id));pulse.value++;}
async function run(fn,rebuild=false){if(busy.value)return;busy.value=true;error.value='';try{await fn();if(rebuild)sync();pulse.value++;}catch(e){error.value=`${t('操作失败')}：${e.message}`;console.error(e);}finally{busy.value=false;}}
function save(){if(!engine.save(true))error.value=t('保存失败，请导出备份');refreshUI();}
function download(template=false){const d=engine.snapshot();if(template){d.training.source=d.name;d.training.settings.blackout=false;}const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${d.name.replace(/[\\/:*?"<>|]/g,'-')}${template?'.template':''}.showfile.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);note('已导出');}
async function importFile(e){const f=e.target.files?.[0];if(!f)return;await run(async()=>{if(f.size>15*1024*1024)throw new Error('文件超过 15 MB / File exceeds 15 MB');let data;try{data=JSON.parse(await f.text());}catch{throw new Error('工程文件不是有效的 JSON，请检查文件是否损坏 / Invalid JSON showfile');}await engine.load(data);engine.recoveryBlocked=false;note('工程已导入');},true);e.target.value='';}
function reset(){run(async()=>{
  const previous=JSON.stringify(engine.snapshot());
  await engine.load(createShowcaseTemplate());
  try{localStorage.setItem('CUNJUTANG_SHOW_V1.before-template-reset',previous);}catch{/* Reset still works when the old project has filled browser storage. */}
  selected.value=[];solo.value=false;zone.value='all';search.value='';showFaults.value=false;objectId.value='';tab.value='lights';closeGuide();renderer.setOrbit(false);sync();renderer.view('front');
  if(!engine.save(true))error.value=t('保存失败，请导出备份');
});}
function setLevel(e){engine.setLevel(selected.value,e.target.value);pulse.value++;}
function setColor(e){engine.setColor(selected.value,e.target.value);pulse.value++;}
function aimValue(key){pulse.value;return picked.value.find(f=>f.training.kind==='moving')?.quickChannelsAccessors[key]?.[0]?.value.DMX??128;}
function aim(key,e){engine.setAim(selected.value,key,e.target.value);pulse.value++;}
function addObject(kind){const id=`${kind}-${Date.now()}`;engine.training.objects.push({id,kind,name:`${t(kind==='actor'?'演员':kind==='table'?'桌子':kind==='chair'?'椅子':'方台')} ${objects.value.length+1}`,x:0,y:4,rotation:0});objectId.value=id;objectsChanged();}
function objectsChanged(){for(const o of engine.training.objects){o.x=Math.max(-stageForm.width/2,Math.min(stageForm.width/2,Number(o.x)||0));o.y=Math.max(0,Math.min(stageForm.depth,Number(o.y)||0));o.rotation=Number(o.rotation)||0;}engine.stop();renderer.syncStage(engine.training.objects,engine.training.curtains);changed();}
function moveObjectField(key,event){const value=Number(event.target.value);if(!Number.isFinite(value)||!activeObject.value)return;const bounded=key==='x'?Math.max(-stageForm.width/2,Math.min(stageForm.width/2,value)):key==='y'?Math.max(0,Math.min(stageForm.depth,value)):value;engine.moveObject(activeObject.value.id,{[key]:bounded});changed();}
function removeObject(){engine.training.objects=engine.training.objects.filter(o=>o.id!==objectId.value);objectId.value='';objectsChanged();}
function applyFixture(){run(async()=>{const training={},patch={training};for(const k of ['kind','angle','broken','baseColor','zone','row','block'])if(fixtureForm[k]!==fixtureBaseline[k])training[k]=fixtureForm[k];const target={};for(const [key,form] of [['x','tx'],['y','ty'],['z','tz']])if(fixtureForm[form]!==fixtureBaseline[form])target[key]=Number(fixtureForm[form]);if(Object.keys(target).length)training.target=target;if(selected.value.length===1){patch.name=fixtureForm.name;training.uid=fixtureForm.uid;training.number=Number(fixtureForm.number);patch.position={x:Number(fixtureForm.x),y:Number(fixtureForm.y),z:Number(fixtureForm.z)};}await engine.editFixtures(selected.value,patch);fixtureBaseline=clone(fixtureForm);note('参数已更新');},true);}

function applyStage(){run(()=>engine.resizeStage({...clone(stageForm),rows:rowText.value.split(/[,，\s]+/).filter(Boolean).map(Number)}),true);}
function duplicate(){run(async()=>{selected.value=await engine.duplicate(selected.value);},true);}
function removeFixtures(){if(!confirm(lang.value==='en'?'Delete the selected fixtures and their cue values?':'删除所选灯具及其场景数据？'))return;run(async()=>{await engine.remove(selected.value);selected.value=[];},true);}
function capture(){const keys=new Set(engine.cues.map(c=>c.key));engine.saveCue(`${t('新增场景')} ${cues.value.length+1}`);engine.active=engine.cues.findIndex(c=>!keys.has(c.key));changed();nextTick(()=>document.querySelector('.cue-card.active')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'}));}
function updateCue(i){engine.overwriteCue(i);changed();}
function deleteCue(i){if(confirm(lang.value==='en'?'Delete this lighting cue?':'删除这个灯光场景？')){engine.deleteCue(i);changed();}}
function cueTime(item,event){const v=Number(event.target.value);engine.training.cueTimes[item.key]=Math.min(120,Math.max(0,Number.isFinite(v)?v:2));changed();}
function cueTimeValue(item){return engine.training.cueTimes[item.key]??2;}
function blackout(){engine.stop();settings.blackout=!settings.blackout;}
function draw(now){
  if(!ready.value)return;
  renderer.advanceOrbit(now);
  engine.update(now);renderer.aims=engine.training.aims;renderer.syncStage(engine.training.objects,engine.training.curtains);renderer.update(engine.fixtures,settings,selected.value,solo.value);renderer.render();
  if(now-lastUI>120||!engine.animating){lastUI=now;refreshUI();}
}
function visibilityChanged(){if(renderer)renderer.orbitTime=null;const visible=!document.hidden;engine.setVisible(visible);loop?.setVisible(visible);}
function unload(){if(ready.value)engine.save();}
onMounted(async()=>{
  engine.onChange=()=>{invalidate();queueSave();};
  await run(async()=>{renderer=new StageRenderer(host.value,pick,invalidate);renderer.enableAsyncLighting();renderer.onError=text=>error.value=text;renderer.onObjectSelect=id=>{engine.stop();objectId.value=id;tab.value='objects';};renderer.onObjectMove=(id,x,y)=>{const o=engine.training.objects.find(o=>o.id===id);if(o){o.x=x;o.y=y;changed();}};renderer.onObjectDrop=()=>queueSave();renderer.onOrbitChange=active=>{orbiting.value=active;};engine.show.visualizerHandle=renderer;await engine.init();ready.value=true;sync();renderer.setQuality(settings.quality);renderer.view('front');if(engine.status)error.value=engine.status;});
  loop=new DemandLoop({draw,active:()=>engine.animating||orbiting.value});visibilityChanged();invalidate();queueSave();if(!localStorage.getItem('CJT_TOUR_V4'))guide();
  window.addEventListener('pagehide',unload);document.addEventListener('visibilitychange',visibilityChanged);
  if(import.meta.env.DEV)window.__CJT={engine,get renderer(){return renderer;},get loop(){return loop;},invalidate,sync,select:ids=>selected.value=ids,settings,playDemo,guide,get tour(){return tour.value;},get selected(){return selected.value;},get ready(){return ready.value;}};
});
onBeforeUnmount(()=>{loop?.dispose();clearTimeout(saveTimer);engine.onChange=null;engine.stop();renderer?.dispose();window.removeEventListener('pagehide',unload);document.removeEventListener('visibilitychange',visibilityChanged);});

</script>

<template>
  <div class="workbench" :data-mobile="mobile" :aria-busy="busy">
    <header class="app-header" :class="{'tour-focus':tour===2}">
      <div class="brand"><span class="brand-mark">◈</span><div><h1>{{t('存菊堂')}} <span>{{t('灯光排练室')}}</span></h1></div></div>
      <div class="global-light-actions"><select v-model="settings.quality" :aria-label="t('画质')"><option value="auto">{{t('清晰')}}</option><option value="high">{{t('精细')}}</option></select><button class="lights-on" @click="allLights(true)" :disabled="!ready||busy">{{t('灯光全开')}}</button><button @click="allLights(false)" :disabled="!ready||busy">{{t('灯光全关')}}</button></div>
      <div class="header-actions"><button @click="lang=lang==='zh'?'en':'zh'" aria-label="Switch language">{{lang==='zh'?'EN':'中文'}}</button><button @click="help=true">{{t('帮助')}}</button><button @click="fileInput.click()" :disabled="!ready||busy">↥ {{t('导入')}}</button><button @click="download()" :disabled="!ready||busy">↧ {{t('导出工程')}}</button><button class="primary" @click="save" :disabled="!ready||busy">{{t('保存')}}</button></div>
      <input ref="fileInput" type="file" accept=".json,.asls" hidden @change="importFile">
    </header>
    <div class="workspace" :inert="!ready||busy">
      <aside class="rig-panel" :class="{'tour-focus':tour===0}">
        <div class="panel-heading"><div class="rig-heading-row"><h2>{{t('灯位分区')}}</h2><button class="auto-test-toggle" :class="{active:settings.autoOn}" :aria-label="t('选中自动开灯')" :aria-pressed="settings.autoOn" @click="toggleAutoTest">{{t('选中即亮')}}</button></div><p>{{t('按台上面朝观众编号')}}</p></div>
        <div class="auto-test-level"><label for="auto-test-level">{{t('试灯亮度')}}<output for="auto-test-level">{{settings.autoLevel}}%</output></label><input id="auto-test-level" type="range" min="0" max="100" step="1" v-model.number="settings.autoLevel" :aria-label="t('试灯亮度')" @input="applyAutoTest"></div>
        <div class="selection-pill" v-if="selected.length"><span>{{t('已选择')}} <b>{{selected.length}}</b></span><button :class="{active:solo}" @click="solo=!solo">{{t('只看所选')}}</button><button @click="selected=[]" :aria-label="t('取消选择')">×</button></div>
        <div class="rig-totals"><span><strong>{{fixtures.length}}</strong>{{t('盏灯')}}</span><span class="fault-total"><strong>{{broken}}</strong>{{t('盏故障')}}</span></div>
        <button class="moving-shortcut" :class="{active:zone==='moving'}" @click="pickMoving">{{t('摇头灯')}} <b>{{movingCount}}</b><span>{{t('方向与颜色')}} ↗</span></button>
        <div class="zone-list"><button :class="{active:zone==='all'}" @click="pickZone('all')"><span>◎ {{t('全部灯具')}}</span><b>{{fixtures.length}}</b></button><button v-for="z in zones" :key="z.id" :class="{active:zone===z.id}" @click="pickZone(z.id)"><span><i class="zone-dot" :class="{bad:z.bad}"></i>{{t(z.name)}}</span><span><em v-if="z.bad">{{z.bad}}</em><b>{{z.count}}</b></span></button></div>
        <div class="fixture-browser"><input class="search" :placeholder="t('搜索灯具名称或编号')" v-model="search" :aria-label="t('搜索灯具名称或编号')"><label class="check small"><input type="checkbox" v-model="showFaults">{{t('故障灯')}} <span>{{filtered.length}}</span></label>
          <div class="fixture-grid"><button v-for="f in filtered" :key="f.id" :title="`${f.name} · ${f.training.uid}`" :aria-label="`${f.name} ${f.training.broken?t('故障'):t('正常')}`" :class="{selected:selected.includes(f.id),broken:f.training.broken,lit:f._3DModel.intensity>.05}" @click="pick(f.id,$event.shiftKey||$event.ctrlKey)">{{f.training.kind==='conference'?'H':f.training.kind==='moving'?'M':'L'}}{{String(f.training.number).padStart(2,'0')}}<i v-if="f.training.broken">×</i></button></div>
        </div><div class="rig-foot"><span class="legend"><i></i>{{t('选中状态')}}</span><span class="legend bad"><i></i>{{t('故障状态')}}</span></div>
      </aside>
      <main class="stage-panel">
        <div ref="host" class="stage-canvas" aria-label="3D stage lighting preview"></div>
        <div class="stage-title"><input class="show-name" v-model="projectName" :aria-label="t('当前工程')" @change="engine.show.name=projectName;changed()"></div>
        <div class="view-controls"><button v-for="v in [['audience','观众斜视'],['front','观众正视'],['top','俯视'],['left','左侧'],['right','右侧']]" :key="v[0]" @click="setView(v[0])">{{t(v[1])}}</button><button @click="setView('audience')" :title="t('复位')">↺</button><button class="orbit-button" :class="{active:orbiting}" :aria-pressed="orbiting" @click="toggleOrbit">{{t(orbiting?'停止环绕':'自动环绕')}}</button></div>
        <div class="curtain-controls"><button v-for="c in curtains" :key="c.id" :aria-pressed="c.closed" @click="toggleCurtain(c)">{{t(c.name)}} · {{t(c.closed?'打开':'关闭')}}</button></div>


        <div class="stage-caption"><span class="desktop-hint">{{t('鼠标拖动旋转 · 滚轮缩放 · 点击选灯')}}</span><span class="touch-hint">{{t('手指拖动旋转 · 双指缩放')}}</span></div>
        <div v-if="!ready" class="loading-cover"><div class="loader"></div>{{error||t('正在加载舞台…')}}</div>
      </main>
      <aside class="control-panel" :class="{'tour-focus':tour===1}">
        <div class="control-tabs"><button v-for="a in [['lights','灯光'],['objects','演员与道具'],['template','模板编辑']]" :key="a[0]" :class="{active:tab===a[0]}" @click="tab=a[0]">{{t(a[1])}}</button></div>
        <div class="control-scroll">
          <template v-if="tab==='lights'">
            <div class="control-section"><h2>{{picked.length===1?picked[0].name:picked.length?`${t('已选择')} ${picked.length} ${t('盏灯')}`:t('选择一盏或一组灯')}}</h2>
              <template v-if="picked.length"><div class="intensity-value">{{Math.round(level/255*100)}}<span>%</span></div><label class="slider-label">{{t('亮度')}}<span>DMX {{level}}</span></label><input class="range gold" type="range" min="0" max="255" :value="level" :aria-label="t('亮度')" @input="setLevel"><div class="scale"><span>0</span><span>50</span><span>100%</span></div><div class="quick-levels"><button v-for="n in [0,25,50,75,100]" :key="n" @click="engine.setLevel(selected,Math.round(n*2.55));changed()">{{n}}%</button></div>
              <div v-if="hasColor"><h3>{{t('颜色')}}</h3><ColorPalette :model-value="colorValue" @update:model-value="engine.setColor(selected,$event);changed()" /></div>
              <template v-if="hasMoving"><h3 class="moving-title">{{t('摇头灯方向')}}</h3><label class="slider-label">{{t('水平转向')}}<span>{{Math.round(aimValue('Pan')/255*360-180)}}°</span></label><input type="range" min="0" max="255" :value="aimValue('Pan')" :aria-label="t('水平转向')" @input="aim('Pan',$event)"><label class="slider-label">{{t('垂直转向')}}<span>{{Math.round(aimValue('Tilt')/255*180-90)}}°</span></label><input type="range" min="0" max="255" :value="aimValue('Tilt')" :aria-label="t('垂直转向')" @input="aim('Tilt',$event)"><button class="full" @click="resetAim">{{t('方向复位')}}</button></template>
              <p class="warning" v-if="picked.some(f=>f.training.broken)">{{t('包含故障灯：正常模式下不发光。')}}</p></template>
            </div>
            <div class="control-section"><h3>{{t('总控')}} <span>{{Math.round(settings.master*100)}}%</span></h3><input type="range" min="0" max="1" step=".01" v-model.number="settings.master" :aria-label="t('总控')"><button class="blackout-button" :class="{danger:settings.blackout}" @click="blackout">◼ {{t(settings.blackout?'恢复输出':'总黑场')}}</button></div>
            <div class="control-section"><label class="check"><input type="checkbox" v-model="settings.repair">{{t('假设全部修好')}}</label><label class="check"><input type="checkbox" v-model="settings.fog">{{t('空气光束')}}</label></div>
            <div v-if="ready&&engine.advanced.length" class="control-section"><h3>{{t('原生效果与序列')}}</h3><div v-for="item in engine.advanced" :key="item.name" class="advanced-item"><span>{{item.name}}</span><button @click="engine.stop();item.handle.cue(true)">▶</button><button @click="engine.stop()">■</button></div></div>
          </template>
          <template v-else-if="tab==='objects'">
            <div class="control-section"><h2>{{t('演员与道具')}}</h2><div class="object-add"><button @click="addObject('actor')">＋ {{t('添加演员')}}</button><button @click="addObject('table')">＋ {{t('桌子')}}</button><button @click="addObject('chair')">＋ {{t('椅子')}}</button><button @click="addObject('block')">＋ {{t('方台')}}</button></div><div class="object-list"><button v-for="o in objects" :key="o.id" :class="{active:objectId===o.id}" @click="objectId=o.id;renderer.setObjectSelection(o.id)"><span>{{o.kind==='actor'?'♙':'▧'}} {{o.name}}</span><small>{{Number(o.x||0).toFixed(1)}} / {{Number(o.y||0).toFixed(1)}} m</small></button></div></div>
            <div v-if="activeObject" class="control-section"><label class="field">{{t('名称')}}<input v-model="activeObject.name" @change="changed"></label><label class="field">{{t('横向位置')}} · m<input type="number" step=".1" :min="-stageForm.width/2" :max="stageForm.width/2" :value="Number(activeObject.x).toFixed(2)" @change="moveObjectField('x',$event)"></label><label class="field">{{t('纵向位置')}} · m<input type="number" step=".1" min="0" :max="stageForm.depth" :value="Number(activeObject.y).toFixed(2)" @change="moveObjectField('y',$event)"></label><label class="field">{{t('旋转')}} · °<input type="number" min="-360" max="360" step="15" :value="Number(activeObject.rotation).toFixed(2)" @change="moveObjectField('rotation',$event)"></label><button class="danger-text full" @click="removeObject">{{t('删除对象')}}</button></div>
          </template>
          <template v-else>
            <div class="control-section"><h2>{{t('舞台参数')}}</h2><div class="three-fields"><label v-for="f in [['width','宽度'],['depth','深度'],['height','灯高']]" :key="f[0]" class="field">{{t(f[1])}} · m<input type="number" min="2" max="100" step=".5" v-model.number="stageForm[f[0]]"></label></div><label class="field">{{t('各排距台口距离')}} · m<input v-model="rowText"></label><button class="full" @click="applyStage" :disabled="busy">{{t('应用舞台参数')}}</button><div v-for="c in curtains" :key="c.id" class="field"><label>{{t(c.name)}} · {{t('距台口')}} / m</label><input type="number" min="0" :max="stageForm.depth" step=".1" :value="c.y" :aria-label="t(c.name)+' '+t('距台口')" @change="updateCurtain(c,$event)"></div></div>
            <div v-if="picked.length" class="control-section"><h3>{{t('灯具参数')}} <span>×{{picked.length}}</span></h3><template v-if="picked.length===1"><label class="field">{{t('名称')}}<input v-model="fixtureForm.name"></label><label class="field">{{t('编号')}}<input v-model="fixtureForm.uid"></label><div class="three-fields"><label v-for="axis in ['x','y','z']" :key="axis" class="field">{{t('位置')}} {{axis.toUpperCase()}}<input type="number" step=".1" v-model.number="fixtureForm[axis]"></label></div></template>
              <label class="field">{{t('分区标识')}}<input v-model="fixtureForm.zone"></label><div class="three-fields"><label v-for="field in [['number','显示序号'],['row','排号'],['block','组号']]" :key="field[0]" class="field">{{t(field[1])}}<input type="number" min="0" :disabled="field[0]==='number'&&picked.length!==1" v-model.number="fixtureForm[field[0]]"></label></div><label class="field">{{t('类型')}}<select v-model="fixtureForm.kind"><option v-for="(kind,i) in TYPES" :value="kind" :key="kind">{{t(['固定聚光灯','会议灯','彩灯','摇头灯'][i])}}</option></select></label><label class="field">{{t('光束角')}} · °<input type="number" min="5" max="120" v-model.number="fixtureForm.angle"></label><h3>{{t('颜色')}}</h3><ColorPalette v-model="fixtureForm.baseColor" /><label class="check"><input type="checkbox" v-model="fixtureForm.broken">{{t('故障')}}</label><label class="field">{{t('照射目标')}} · X / Y / Z</label><div class="three-fields"><input v-for="k in ['tx','ty','tz']" :key="k" type="number" step=".1" v-model.number="fixtureForm[k]" :aria-label="`${t('照射目标')} ${k}`"></div><button class="full primary" @click="applyFixture" :disabled="busy">{{t('应用到所选灯具')}}</button><button class="full" @click="duplicate" :disabled="busy">{{t('复制所选灯具')}}</button><button class="full danger-text" @click="removeFixtures" :disabled="busy">{{t('删除所选灯具')}}</button>
            </div><div v-else class="control-section"><p>{{t('选择一盏或一组灯')}}</p></div>
            <div class="control-section"><button class="full" @click="download(true)">{{t('另存为模板')}}</button><button class="full danger-text" @click="reset">{{t('恢复存菊堂原模板')}}</button></div>
          </template>
        </div>
      </aside>
    </div>
    <section class="cue-panel" :class="{'tour-focus':tour===3}" :inert="!ready||busy">
      <div class="cue-toolbar"><div><h2>{{t('场景编排')}} <span>{{cues.length.toString().padStart(2,'0')}}</span></h2></div><div class="cue-transport"><button @click="engine.go(Math.max(0,engine.active-1));pulse++" :aria-label="t('上一场')">⏮</button><button class="play-button" @click="engine.play();pulse++">▶ {{t('播放')}}</button><button @click="engine.stop();pulse++">■ {{t('停止')}}</button><button @click="engine.go(Math.min(cues.length-1,engine.active+1));pulse++" :aria-label="t('下一场')">⏭</button></div><div class="cue-edit-actions"><button class="reset-template-button" @click="reset" :disabled="!ready||busy">{{t('重置为模板场景')}}</button><button class="capture-button" @click="capture" :disabled="!ready||busy">＋ {{t('新增当前场景')}}</button></div></div>
      <div class="cue-list"><article v-for="(item,i) in cues" :key="item.key" class="cue-card" :class="{active:engine.active===i}"><div class="cue-top"><span class="cue-number">{{String(i+1).padStart(2,'0')}}</span><input :value="item.cue.name" @change="item.cue.name=$event.target.value;changed()" :aria-label="`${t('名称')} ${i+1}`"><span class="cue-indicator"></span></div><div class="cue-middle"><label>{{t('渐变')}} <input type="number" min="0" max="120" step=".5" :value="cueTimeValue(item)" :aria-label="`${t('渐变')} ${i+1}`" @change="cueTime(item,$event)"> {{t('秒')}}</label><button @click="engine.go(i);pulse++">{{t('调用')}} ↗</button></div><div class="cue-actions"><button @click="updateCue(i)">{{t('更新')}}</button><button @click="engine.moveCue(i,-1);changed()" :disabled="i===0||cues[i-1]?.group!==item.group" :aria-label="`${t('上移')} ${i+1}`">↑</button><button @click="engine.moveCue(i,1);changed()" :disabled="i===cues.length-1||cues[i+1]?.group!==item.group" :aria-label="`${t('下移')} ${i+1}`">↓</button><button @click="deleteCue(i)" :aria-label="`${t('删除')} ${i+1}`">×</button></div></article><div v-if="!cues.length" class="empty-cues">{{t('暂无灯光场景')}}</div></div>

    </section>
    <nav class="mobile-nav"><button v-for="v in [['rig','布局'],['stage','舞台'],['controls','控制'],['cues','场景']]" :key="v[0]" :class="{active:mobile===v[0]}" @click="mobile=v[0]">{{t(v[1])}}</button></nav>
    <section v-if="tour>=0" class="tour-card" role="dialog" aria-label="新手引导" aria-live="polite"><div class="tour-heading"><span>{{tour+1}} / {{tourSteps.length}}</span><button @click="closeGuide">跳过 ×</button></div><h2>{{tourSteps[tour].title}}</h2><p>{{tourSteps[tour].text}}</p><div class="tour-actions"><button v-if="tour>0" @click="guide(tour-1)">上一步</button><button v-if="tour<tourSteps.length-1" class="primary" @click="guide(tour+1)">下一步 →</button><button v-else class="primary" @click="playDemo">▶ 播放案例</button></div></section>
    <div v-if="message" class="toast" role="status">✓ {{message}}</div><div v-if="error&&ready" class="error-banner" role="alert">{{error}}<button @click="error=''">×</button></div><div v-if="busy&&ready" class="busy-pill" role="status">{{t('正在应用…')}}</div>
    <div v-if="help" class="modal-backdrop" @click.self="help=false"><section class="help-modal" role="dialog" aria-modal="true" :aria-label="t('操作说明')"><div class="modal-heading"><h2>{{t('操作说明')}}</h2><button @click="help=false">{{t('关闭')}} ×</button></div><button class="full" @click="help=false;guide()">重新查看新手引导</button><h3>{{t('第一步 · 认识灯位')}}</h3><p>{{t('点击分区选中整组，点击灯具选中单灯；Shift / Ctrl 可多选。')}}</p><h3>{{t('第二步 · 试灯与站位')}}</h3><p>{{t('打开选中即亮后，点击灯具或分区试灯；亮度滑条设置点亮强度。左侧摇头灯入口可选中16盏摇头灯，在右侧调水平、垂直方向和颜色。')}}</p><h3>{{t('幕布与视角')}}</h3><p>{{t('舞台上的四道幕可分别平滑开合；幕布和演员道具会遮挡灯光。自动环绕按观众正视距离连续旋转，可随时停止或手动拖动。')}}</p><h3>{{t('第三步 · 编排灯光场景')}}</h3><p>{{t('新增当前场景会同时保存灯光、演员道具和幕布状态。设置渐变秒数，按顺序调用或播放。')}}</p><h3>总黑场与灯光全关</h3><p>总黑场临时屏蔽灯光输出，解除后恢复原亮度；灯光全关把每盏灯的亮度设为零，之后可调用场景或重新调光。</p><hr><p>{{t('浏览器保存不跨设备同步，请导出工程备份。')}}</p><small>Based on ASLS Studio · GPL-3.0 · Suzhou University venue configuration provided by the user.</small></section></div>
  </div>
</template>
