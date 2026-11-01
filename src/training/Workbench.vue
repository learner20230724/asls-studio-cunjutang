<script setup>
import {ref,reactive,computed,onMounted,onBeforeUnmount,watch} from 'vue';
import {TrainingEngine} from './engine';
import {StageRenderer} from './renderer';
import {createTemplate,clone,LABELS,TYPES,DEFAULT_STAGE} from './rig.mjs';
import {translate} from './i18n.mjs';

const lang=ref(localStorage.getItem('CJT_LANGUAGE')||'zh'),t=s=>translate(s,lang.value);
const engine=new TrainingEngine(),host=ref(),fileInput=ref(),ready=ref(false),busy=ref(false),error=ref(''),message=ref(''),pulse=ref(0);
const selected=ref([]),zone=ref('all'),search=ref(''),solo=ref(false),tab=ref('lights'),mobile=ref('stage'),help=ref(false),showFaults=ref(false),projectName=ref('存菊堂 · 话剧灯光预演');
const settings=reactive({quality:'auto',fog:false,repair:false,blackout:false,master:1}),stageForm=reactive(clone(DEFAULT_STAGE)),rowText=ref('1.5, 4.25, 7, 9.75, 12.5');
const fixtureForm=reactive({name:'',uid:'',zone:'front',number:1,row:0,block:0,kind:'spot',angle:36,broken:false,x:0,y:0,z:8,tx:0,ty:4,tz:0,baseColor:'#ffd5a3'});
const objectId=ref(''),stats=reactive({fps:0,fixtures:0,capacity:0,drawCalls:0,geometries:0});
let renderer,raf,timer,saveTimer;
let fixtureBaseline={};
const fixtures=computed(()=>{pulse.value;return ready.value?engine.fixtures:[];});
const picked=computed(()=>fixtures.value.filter(f=>selected.value.includes(f.id)));
const filtered=computed(()=>fixtures.value.filter(f=>(zone.value==='all'||f.training.zone===zone.value)&&(!showFaults.value||f.training.broken)&&(!search.value||`${f.name} ${f.training.uid}`.toLowerCase().includes(search.value.toLowerCase()))));
const zones=computed(()=>[...new Set(fixtures.value.map(f=>f.training.zone))].map(id=>({id,name:LABELS[id]||id,count:fixtures.value.filter(f=>f.training.zone===id).length,bad:fixtures.value.filter(f=>f.training.zone===id&&f.training.broken).length})));
const broken=computed(()=>fixtures.value.filter(f=>f.training.broken).length);
const cues=computed(()=>{pulse.value;return ready.value?engine.cues:[];});
const objects=computed(()=>{pulse.value;return ready.value?engine.training.objects:[];});
const activeObject=computed(()=>objects.value.find(o=>o.id===objectId.value));
const level=computed(()=>{pulse.value;const f=picked.value[0];return f?.quickChannelsAccessors.Dimmer?.[0]?.value.DMX||0;});
const colorValue=computed(()=>{pulse.value;const f=picked.value.find(f=>f.hasColor);return f?'#'+f.color.map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''):'#ffffff';});
const hasColor=computed(()=>picked.value.some(f=>f.hasColor)),hasMoving=computed(()=>picked.value.some(f=>f.training.kind==='moving'));
const dirty=computed(()=>{pulse.value;return engine.dirty;});
function note(s){message.value=t(s);setTimeout(()=>message.value='',3500);}
function changed(){engine.mark();pulse.value++;}
watch(lang,v=>{localStorage.setItem('CJT_LANGUAGE',v);document.documentElement.lang=v==='en'?'en':'zh-CN';});
watch(settings,()=>{if(!ready.value)return;Object.assign(engine.training.settings,settings);renderer?.setQuality(settings.quality);changed();},{deep:true});
watch(selected,()=>{const f=picked.value[0];if(f)Object.assign(fixtureForm,{name:f.name,uid:f.training.uid,zone:f.training.zone,number:f.training.number,row:f.training.row||0,block:f.training.block||0,kind:f.training.kind,angle:f.training.angle,broken:f.training.broken,...f.position,tx:f.training.target.x,ty:f.training.target.y,tz:f.training.target.z,baseColor:f.training.baseColor});fixtureBaseline=clone(fixtureForm);});
function pick(id,multi=false){selected.value=multi?(selected.value.includes(id)?selected.value.filter(v=>v!==id):[...selected.value,id]):[id];tab.value='lights';mobile.value='controls';}
function pickZone(id){zone.value=id;selected.value=fixtures.value.filter(f=>id==='all'||f.training.zone===id).map(f=>f.id);}
function sync(){projectName.value=engine.show.name;Object.assign(settings,engine.training.settings);Object.assign(stageForm,clone(engine.training.stage));rowText.value=stageForm.rows.join(', ');renderer.build(engine.training.stage,engine.training.objects,engine.fixtures);selected.value=selected.value.filter(id=>engine.fixtures.some(f=>f.id===id));pulse.value++;}
async function run(fn,rebuild=false){if(busy.value)return;busy.value=true;error.value='';try{await fn();if(rebuild)sync();pulse.value++;}catch(e){error.value=`${t('操作失败')}：${e.message}`;console.error(e);}finally{busy.value=false;}}
function save(){if(engine.save(true))note('本机已保存');else error.value=t('保存失败，请导出备份');pulse.value++;}
function download(template=false){const d=engine.snapshot();if(template){d.training.source=d.name;d.training.settings.blackout=false;}const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${d.name.replace(/[\\/:*?"<>|]/g,'-')}${template?'.template':''}.showfile.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);note('已导出');}
async function importFile(e){const f=e.target.files?.[0];if(!f)return;await run(async()=>{if(f.size>15*1024*1024)throw new Error('文件超过 15 MB / File exceeds 15 MB');let data;try{data=JSON.parse(await f.text());}catch{throw new Error('工程文件不是有效的 JSON，请检查文件是否损坏 / Invalid JSON showfile');}await engine.load(data);engine.recoveryBlocked=false;note('工程已导入');},true);e.target.value='';}
function reset(){if(!confirm(lang.value==='en'?'Replace this practice with the original template? Export a backup first.':'恢复原模板会替换当前练习，请先导出备份。确定恢复？'))return;run(async()=>{await engine.load(createTemplate());engine.go(0,true);selected.value=[];solo.value=false;note('已恢复默认模板');},true);}
function setLevel(e){engine.setLevel(selected.value,e.target.value);pulse.value++;}
function setColor(e){engine.setColor(selected.value,e.target.value);pulse.value++;}
function aimValue(key){pulse.value;return picked.value.find(f=>f.training.kind==='moving')?.quickChannelsAccessors[key]?.[0]?.value.DMX??128;}
function aim(key,e){engine.setAim(selected.value,key,e.target.value);pulse.value++;}
function addObject(kind){const id=`${kind}-${Date.now()}`;engine.training.objects.push({id,kind,name:`${t(kind==='actor'?'演员':kind==='table'?'桌子':kind==='chair'?'椅子':'方台')} ${objects.value.length+1}`,x:0,y:4,rotation:0});objectId.value=id;objectsChanged();}
function objectsChanged(){for(const o of engine.training.objects){o.x=Math.max(-stageForm.width/2,Math.min(stageForm.width/2,Number(o.x)||0));o.y=Math.max(0,Math.min(stageForm.depth,Number(o.y)||0));o.rotation=Number(o.rotation)||0;}renderer.buildObjects(engine.training.objects);changed();}
function removeObject(){engine.training.objects=engine.training.objects.filter(o=>o.id!==objectId.value);objectId.value='';objectsChanged();}
function applyFixture(){run(async()=>{const training={},patch={training};for(const k of ['kind','angle','broken','baseColor','zone','row','block'])if(fixtureForm[k]!==fixtureBaseline[k])training[k]=fixtureForm[k];const target={};for(const [key,form] of [['x','tx'],['y','ty'],['z','tz']])if(fixtureForm[form]!==fixtureBaseline[form])target[key]=Number(fixtureForm[form]);if(Object.keys(target).length)training.target=target;if(selected.value.length===1){patch.name=fixtureForm.name;training.uid=fixtureForm.uid;training.number=Number(fixtureForm.number);patch.position={x:Number(fixtureForm.x),y:Number(fixtureForm.y),z:Number(fixtureForm.z)};}await engine.editFixtures(selected.value,patch);fixtureBaseline=clone(fixtureForm);note('参数已更新');},true);}

function applyStage(){run(()=>engine.resizeStage({...clone(stageForm),rows:rowText.value.split(/[,，\s]+/).filter(Boolean).map(Number)}),true);}
function duplicate(){run(async()=>{selected.value=await engine.duplicate(selected.value);},true);}
function removeFixtures(){if(!confirm(lang.value==='en'?'Delete the selected fixtures and their cue values?':'删除所选灯具及其场景数据？'))return;run(async()=>{await engine.remove(selected.value);selected.value=[];},true);}
function capture(){const name=prompt(lang.value==='en'?'Name this lighting cue:':'给当前灯光场景起个名字：',`${t('新增场景')} ${cues.value.length+1}`);if(name?.trim()){engine.saveCue(name.trim());changed();}}
function updateCue(i){if(confirm(lang.value==='en'?'Overwrite this cue with the current look?':'用当前灯光覆盖这个场景？')){engine.overwriteCue(i);changed();}}
function deleteCue(i){if(confirm(lang.value==='en'?'Delete this lighting cue?':'删除这个灯光场景？')){engine.deleteCue(i);changed();}}
function cueTime(item,event){const v=Number(event.target.value);engine.training.cueTimes[item.key]=Math.min(120,Math.max(0,Number.isFinite(v)?v:2));changed();}
function cueTimeValue(item){return engine.training.cueTimes[item.key]??2;}
function blackout(){engine.stop();settings.blackout=!settings.blackout;}
function startLoop(now){if(ready.value){engine.update(now);renderer.update(engine.fixtures,settings,selected.value,solo.value);renderer.render();}raf=requestAnimationFrame(startLoop);}
function unload(){if(ready.value)engine.save();}
onMounted(async()=>{await run(async()=>{renderer=new StageRenderer(host.value,pick);engine.show.visualizerHandle=renderer;await engine.init();ready.value=true;sync();renderer.view('audience');if(engine.status)error.value=engine.status;});raf=requestAnimationFrame(startLoop);timer=setInterval(()=>{pulse.value++;if(renderer)Object.assign(stats,renderer.stats);},300);saveTimer=setInterval(()=>{if(ready.value&&engine.dirty&&!busy.value&&!engine.transition)engine.save();},2000);window.addEventListener('pagehide',unload);if(import.meta.env.DEV)window.__CJT={engine,get renderer(){return renderer;},sync,select:ids=>selected.value=ids,settings,get selected(){return selected.value;},get ready(){return ready.value;}};});
onBeforeUnmount(()=>{cancelAnimationFrame(raf);clearInterval(timer);clearInterval(saveTimer);engine.stop();renderer?.dispose();window.removeEventListener('pagehide',unload);});
</script>

<template>
  <div class="workbench" :data-mobile="mobile" :aria-busy="busy">
    <header class="app-header">
      <div class="brand"><span class="brand-mark">◈</span><div><div class="eyebrow">ASLS STUDIO <span>/</span> THEATRE LAB</div><h1>{{t('存菊堂')}} <span>{{t('灯光排练室')}}</span></h1></div></div>
      <div class="header-status"><i class="live-dot"></i>{{t('免登录 · 纯模拟')}}<span class="divider"></span><span>{{t(dirty?'未保存':'本机已保存')}}</span></div>
      <div class="header-actions"><button @click="lang=lang==='zh'?'en':'zh'" aria-label="Switch language">{{lang==='zh'?'EN':'中文'}}</button><button @click="help=true">{{t('帮助')}}</button><button @click="fileInput.click()" :disabled="!ready||busy">↥ {{t('导入')}}</button><button @click="download()" :disabled="!ready||busy">↧ {{t('导出工程')}}</button><button class="primary" @click="save" :disabled="!ready||busy">{{t('保存')}}</button></div>
      <input ref="fileInput" type="file" accept=".json,.asls" hidden @change="importFile">
    </header>
    <div class="workspace" :inert="!ready||busy">
      <aside class="rig-panel">
        <div class="panel-heading"><span class="eyebrow">01 / LIGHTING RIG</span><h2>{{t('灯位分区')}}</h2><p>{{t('按台上面朝观众编号')}}</p></div>
        <div class="rig-totals"><span><strong>{{fixtures.length}}</strong>{{t('盏灯')}}</span><span class="fault-total"><strong>{{broken}}</strong>{{t('盏故障')}}</span></div>
        <div class="zone-list"><button :class="{active:zone==='all'}" @click="pickZone('all')"><span>◎ {{t('全部灯具')}}</span><b>{{fixtures.length}}</b></button><button v-for="z in zones" :key="z.id" :class="{active:zone===z.id}" @click="pickZone(z.id)"><span><i class="zone-dot" :class="{bad:z.bad}"></i>{{t(z.name)}}</span><span><em v-if="z.bad">{{z.bad}}</em><b>{{z.count}}</b></span></button></div>
        <div class="fixture-browser"><input class="search" :placeholder="t('搜索灯具名称或编号')" v-model="search" :aria-label="t('搜索灯具名称或编号')"><label class="check small"><input type="checkbox" v-model="showFaults">{{t('故障灯')}} <span>{{filtered.length}}</span></label>
          <div class="fixture-grid"><button v-for="f in filtered" :key="f.id" :title="`${f.name} · ${f.training.uid}`" :aria-label="`${f.name} ${f.training.broken?t('故障'):t('正常')}`" :class="{selected:selected.includes(f.id),broken:f.training.broken,lit:f._3DModel.intensity>.05}" @click="pick(f.id,$event.shiftKey||$event.ctrlKey)">{{f.training.kind==='conference'?'H':f.training.kind==='moving'?'M':'L'}}{{String(f.training.number).padStart(2,'0')}}<i v-if="f.training.broken">×</i></button></div>
        </div><div class="rig-foot"><span class="legend"><i></i>{{t('选中状态')}}</span><span class="legend bad"><i></i>{{t('故障状态')}}</span></div>
      </aside>
      <main class="stage-panel">
        <div ref="host" class="stage-canvas" aria-label="3D stage lighting preview"></div>
        <div class="stage-title"><span class="eyebrow">CUNJUTANG / SUZHOU UNIVERSITY</span><input class="show-name" v-model="projectName" :aria-label="t('当前工程')" @change="engine.show.name=projectName;changed()"><span class="estimate-badge">{{t('教学近似预演')}}</span></div>
        <div class="view-controls"><button v-for="v in [['audience','观众斜视'],['front','观众正视'],['top','俯视'],['left','左侧'],['right','右侧']]" :key="v[0]" @click="renderer?.view(v[0])">{{t(v[1])}}</button><button @click="renderer?.view('audience')" :title="t('复位')">↺</button></div>
        <div class="selection-pill" v-if="selected.length"><span>{{t('已选择')}} <b>{{selected.length}}</b></span><button :class="{active:solo}" @click="solo=!solo">{{t('只看所选')}}</button><button @click="selected=[]" :aria-label="t('取消选择')">×</button></div>
        <div class="blackout-banner" v-if="settings.blackout">{{t('总黑场')}} <button @click="blackout">{{t('恢复输出')}}</button></div>
        <div class="stage-caption"><span class="desktop-hint">{{t('鼠标拖动旋转 · 滚轮缩放 · 点击选灯')}}</span><span class="touch-hint">{{t('手指拖动旋转 · 双指缩放')}}</span><span>{{stats.fps}} FPS <i class="live-dot"></i></span></div>
        <div v-if="!ready" class="loading-cover"><div class="loader"></div>{{error||t('正在加载舞台…')}}</div>
      </main>
      <aside class="control-panel">
        <div class="control-tabs"><button v-for="a in [['lights','灯光'],['objects','演员与道具'],['template','模板编辑']]" :key="a[0]" :class="{active:tab===a[0]}" @click="tab=a[0]">{{t(a[1])}}</button></div>
        <div class="control-scroll">
          <template v-if="tab==='lights'">
            <div class="control-section"><span class="eyebrow">02 / FIXTURE CONTROL</span><h2>{{picked.length===1?picked[0].name:picked.length?`${t('已选择')} ${picked.length} ${t('盏灯')}`:t('选择一盏或一组灯')}}</h2><p v-if="!picked.length">{{t('在左侧选择灯组，或直接点击舞台灯具。')}}</p>
              <template v-else><div class="intensity-value">{{Math.round(level/255*100)}}<span>%</span></div><label class="slider-label">{{t('亮度')}}<span>DMX {{level}}</span></label><input class="range gold" type="range" min="0" max="255" :value="level" :aria-label="t('亮度')" @input="setLevel"><div class="scale"><span>0</span><span>50</span><span>100%</span></div><div class="quick-levels"><button v-for="n in [0,25,50,75,100]" :key="n" @click="engine.setLevel(selected,Math.round(n*2.55));changed()">{{n}}%</button></div>
              <label v-if="hasColor" class="color-control">{{t('颜色')}}<input type="color" :value="colorValue" @input="setColor"></label>
              <template v-if="hasMoving"><label class="slider-label">{{t('水平转向')}}<span>{{Math.round(aimValue('Pan')/255*360-180)}}°</span></label><input type="range" min="0" max="255" :value="aimValue('Pan')" :aria-label="t('水平转向')" @input="aim('Pan',$event)"><label class="slider-label">{{t('垂直转向')}}<span>{{Math.round(aimValue('Tilt')/255*180-90)}}°</span></label><input type="range" min="0" max="255" :value="aimValue('Tilt')" :aria-label="t('垂直转向')" @input="aim('Tilt',$event)"></template>
              <p class="hint" v-if="!hasColor&&!hasMoving">{{t('固定灯具：排练时只调亮度；类型与朝向可在模板中修改。')}}</p><p class="warning" v-if="picked.some(f=>f.training.broken)">{{t('包含故障灯：正常模式下不发光。')}}</p></template>
            </div>
            <div class="control-section"><h3>{{t('总控')}} <span>{{Math.round(settings.master*100)}}%</span></h3><input type="range" min="0" max="1" step=".01" v-model.number="settings.master" :aria-label="t('总控')"><button class="blackout-button" :class="{danger:settings.blackout}" @click="blackout">◼ {{t(settings.blackout?'恢复输出':'总黑场')}}</button></div>
            <div class="control-section"><label class="check"><input type="checkbox" v-model="settings.repair">{{t('假设全部修好')}}</label><p class="hint">{{t('仅比较效果，不修改故障记录')}}</p><label class="check"><input type="checkbox" v-model="settings.fog">{{t('空气光束')}}</label><label class="field row">{{t('画质')}}<select v-model="settings.quality"><option value="auto">{{t('自动')}}</option><option value="low">{{t('低')}}</option><option value="high">{{t('高')}}</option></select></label></div>
            <div v-if="ready&&engine.advanced.length" class="control-section"><h3>{{t('原生效果与序列')}}</h3><div v-for="item in engine.advanced" :key="item.name" class="advanced-item"><span>{{item.name}}</span><button @click="engine.stop();item.handle.cue(true)">▶</button><button @click="engine.stop()">■</button></div></div>
          </template>
          <template v-else-if="tab==='objects'">
            <div class="control-section"><span class="eyebrow">02 / STAGE BLOCKING</span><h2>{{t('演员与道具')}}</h2><div class="object-add"><button @click="addObject('actor')">＋ {{t('添加演员')}}</button><button @click="addObject('table')">＋ {{t('桌子')}}</button><button @click="addObject('chair')">＋ {{t('椅子')}}</button><button @click="addObject('block')">＋ {{t('方台')}}</button></div><div class="object-list"><button v-for="o in objects" :key="o.id" :class="{active:objectId===o.id}" @click="objectId=o.id"><span>{{o.kind==='actor'?'♙':'▧'}} {{o.name}}</span><small>{{Number(o.x||0).toFixed(1)}} / {{Number(o.y||0).toFixed(1)}} m</small></button></div></div>
            <div v-if="activeObject" class="control-section"><label class="field">{{t('名称')}}<input v-model="activeObject.name" @change="changed"></label><label class="field">{{t('横向位置')}} · m<input type="number" step=".1" :min="-stageForm.width/2" :max="stageForm.width/2" v-model.number="activeObject.x" @change="objectsChanged"></label><label class="field">{{t('纵向位置')}} · m<input type="number" step=".1" min="0" :max="stageForm.depth" v-model.number="activeObject.y" @change="objectsChanged"></label><label class="field">{{t('旋转')}} · °<input type="number" min="-360" max="360" step="15" v-model.number="activeObject.rotation" @change="objectsChanged"></label><button class="danger-text full" @click="removeObject">{{t('删除对象')}}</button></div><p class="panel-note">{{t('站位属于整个工程，不随灯光场景移动。')}}</p>
          </template>
          <template v-else>
            <div class="control-section"><span class="eyebrow">02 / VENUE TEMPLATE</span><h2>{{t('舞台参数')}}</h2><p class="hint">{{t('尺寸、型号与朝向均为教学估算')}}</p><div class="three-fields"><label v-for="f in [['width','宽度'],['depth','深度'],['height','灯高']]" :key="f[0]" class="field">{{t(f[1])}} · m<input type="number" min="2" max="100" step=".5" v-model.number="stageForm[f[0]]"></label></div><label class="field">{{t('各排距台口距离')}} · m<input v-model="rowText"></label><button class="full" @click="applyStage" :disabled="busy">{{t('应用舞台参数')}}</button></div>
            <div v-if="picked.length" class="control-section"><h3>{{t('灯具参数')}} <span>×{{picked.length}}</span></h3><template v-if="picked.length===1"><label class="field">{{t('名称')}}<input v-model="fixtureForm.name"></label><label class="field">{{t('编号')}}<input v-model="fixtureForm.uid"></label><div class="three-fields"><label v-for="axis in ['x','y','z']" :key="axis" class="field">{{t('位置')}} {{axis.toUpperCase()}}<input type="number" step=".1" v-model.number="fixtureForm[axis]"></label></div></template>
              <label class="field">{{t('分区标识')}}<input v-model="fixtureForm.zone"></label><div class="three-fields"><label v-for="field in [['number','显示序号'],['row','排号'],['block','组号']]" :key="field[0]" class="field">{{t(field[1])}}<input type="number" min="0" :disabled="field[0]==='number'&&picked.length!==1" v-model.number="fixtureForm[field[0]]"></label></div><label class="field">{{t('类型')}}<select v-model="fixtureForm.kind"><option v-for="(kind,i) in TYPES" :value="kind" :key="kind">{{t(['固定聚光灯','会议灯','彩灯','摇头灯'][i])}}</option></select></label><label class="field">{{t('光束角')}} · °<input type="number" min="5" max="120" v-model.number="fixtureForm.angle"></label><label class="color-control">{{t('颜色')}}<input type="color" v-model="fixtureForm.baseColor"></label><label class="check"><input type="checkbox" v-model="fixtureForm.broken">{{t('故障')}}</label><label class="field">{{t('照射目标')}} · X / Y / Z</label><div class="three-fields"><input v-for="k in ['tx','ty','tz']" :key="k" type="number" step=".1" v-model.number="fixtureForm[k]" :aria-label="`${t('照射目标')} ${k}`"></div><button class="full primary" @click="applyFixture" :disabled="busy">{{t('应用到所选灯具')}}</button><button class="full" @click="duplicate" :disabled="busy">{{t('复制所选灯具')}}</button><button class="full danger-text" @click="removeFixtures" :disabled="busy">{{t('删除所选灯具')}}</button>
            </div><div v-else class="control-section"><p>{{t('选择一盏或一组灯')}}</p></div>
            <div class="control-section"><button class="full" @click="download(true)">{{t('另存为模板')}}</button><button class="full danger-text" @click="reset">{{t('恢复存菊堂原模板')}}</button><p class="hint" v-if="ready">{{engine.training.note}}</p><small>{{t('扩容容量')}}: {{stats.capacity}} · {{t('绘制调用')}}: {{stats.drawCalls}}</small></div>
          </template>
        </div><div class="control-footer"><i class="live-dot"></i>{{t('已停用所有硬件输出')}}</div>
      </aside>
    </div>
    <section class="cue-panel" :inert="!ready||busy">
      <div class="cue-toolbar"><div><span class="eyebrow">03 / CUE LIST</span><h2>{{t('灯光场景')}} <span>{{cues.length.toString().padStart(2,'0')}}</span></h2></div><div class="cue-transport"><button @click="engine.go(Math.max(0,engine.active-1));pulse++" :aria-label="t('上一场')">⏮</button><button class="play-button" @click="engine.play();pulse++">▶ {{t('播放')}}</button><button @click="engine.stop();pulse++">■ {{t('停止')}}</button><button @click="engine.go(Math.min(cues.length-1,engine.active+1));pulse++" :aria-label="t('下一场')">⏭</button></div><button class="capture-button" @click="capture" :disabled="!ready||busy">＋ {{t('保存当前灯光')}}</button></div>
      <div class="cue-list"><article v-for="(item,i) in cues" :key="item.key" class="cue-card" :class="{active:engine.active===i}"><div class="cue-top"><span class="cue-number">{{String(i+1).padStart(2,'0')}}</span><input :value="item.cue.name" @change="item.cue.name=$event.target.value;changed()" :aria-label="`${t('名称')} ${i+1}`"><span class="cue-indicator"></span></div><div class="cue-middle"><label>{{t('渐变')}} <input type="number" min="0" max="120" step=".5" :value="cueTimeValue(item)" :aria-label="`${t('渐变')} ${i+1}`" @change="cueTime(item,$event)"> {{t('秒')}}</label><button @click="engine.go(i);pulse++">{{t('调用')}} ↗</button></div><div class="cue-actions"><button @click="updateCue(i)">{{t('更新')}}</button><button @click="engine.moveCue(i,-1);changed()" :disabled="i===0||cues[i-1]?.group!==item.group" :aria-label="`${t('上移')} ${i+1}`">↑</button><button @click="engine.moveCue(i,1);changed()" :disabled="i===cues.length-1||cues[i+1]?.group!==item.group" :aria-label="`${t('下移')} ${i+1}`">↓</button><button @click="deleteCue(i)" :aria-label="`${t('删除')} ${i+1}`">×</button></div></article><div v-if="!cues.length" class="empty-cues">{{t('暂无灯光场景')}}</div></div>
      <div class="cue-note"><span>{{t('示例场景仅供教学，不是现场标准方案')}}</span><span>{{t('按顺序播放，每场渐变后停留 2 秒')}}</span></div>
    </section>
    <nav class="mobile-nav"><button v-for="v in [['rig','布局'],['stage','舞台'],['controls','控制'],['cues','场景']]" :key="v[0]" :class="{active:mobile===v[0]}" @click="mobile=v[0]">{{t(v[1])}}</button></nav>
    <div v-if="message" class="toast" role="status">✓ {{message}}</div><div v-if="error&&ready" class="error-banner" role="alert">{{error}}<button @click="error=''">×</button></div><div v-if="busy&&ready" class="busy-pill" role="status">{{t('正在应用…')}}</div>
    <div v-if="help" class="modal-backdrop" @click.self="help=false"><section class="help-modal" role="dialog" aria-modal="true" :aria-label="t('操作说明')"><div class="modal-heading"><h2>{{t('操作说明')}}</h2><button @click="help=false">{{t('关闭')}} ×</button></div><h3>{{t('第一步 · 认识灯位')}}</h3><p>{{t('点击分区选中整组，点击灯具选中单灯；Shift / Ctrl 可多选。')}}</p><h3>{{t('第二步 · 试灯与站位')}}</h3><p>{{t('用亮度、颜色和摇头方向调灯；在演员与道具中摆放参照物。')}}</p><h3>{{t('第三步 · 编排灯光场景')}}</h3><p>{{t('保存多个灯光场景，设置渐变秒数，按顺序调用或播放。')}}</p><hr><p>{{t('浏览器保存不跨设备同步，请导出工程备份或交作业。')}}</p><p class="warning">{{t('教学模拟不提供精确照度、遮挡与现场配光保证。')}}</p><small>Based on ASLS Studio · GPL-3.0 · Suzhou University venue configuration provided by the user.</small></section></div>
  </div>
</template>
