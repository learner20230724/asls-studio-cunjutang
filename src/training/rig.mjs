// Parametric venue template. Z is up; +X is actor-left, +Y is upstage.
export const clone = value => JSON.parse(JSON.stringify(value));
export const TYPES = ['spot', 'conference', 'rgb', 'moving'];
export const ZONES = ['front', 'ear-left', 'ear-right', 'side-left', 'side-right', 'top-1', 'top-2', 'top-3', 'top-4', 'top-5', 'rear'];
export const LABELS = {front:'面光', 'ear-left':'左耳光', 'ear-right':'右耳光', 'side-left':'左侧光', 'side-right':'右侧光', 'top-1':'顶光 · 第一排', 'top-2':'顶光 · 第二排', 'top-3':'顶光 · 第三排', 'top-4':'顶光 · 第四排', 'top-5':'顶光 · 第五排', rear:'末排彩灯'};
export const DEFAULT_STAGE = {width:16, depth:15, height:8, rows:[1.5,4.25,7,9.75,12.5], estimated:true};
export function profile(kind='spot', angle=36) {
  const availableChannels = {Dimmer:{capability:{type:'Intensity'}}};
  if (kind==='rgb'||kind==='moving') for (const color of ['Red','Green','Blue']) availableChannels[color]={capability:{type:'ColorIntensity',color}};
  if (kind==='moving') {
    availableChannels.Pan={capability:{type:'Pan',angleStart:'-180deg',angleEnd:'180deg'}};
    availableChannels.Tilt={capability:{type:'Tilt',angleStart:'-90deg',angleEnd:'90deg'}};
  }
  return {name:`Teaching ${kind}`,categories:[kind==='moving'?'Moving Head':kind==='rgb'?'Color Changer':'Other'],physical:{bulb:{colorTemperature:kind==='conference'?4500:3200},lens:{degreesMinMax:[angle,angle]}},modes:[{name:'Teaching',channels:Object.keys(availableChannels)}],availableChannels};
}
export function buildRig(stage=DEFAULT_STAGE) {
  stage={...clone(DEFAULT_STAGE),...clone(stage)};
  const out=[]; const w=stage.width, d=stage.depth, h=stage.height;
  const spread=(i,n)=>w*.44*(1-2*i/Math.max(1,n-1));
  function add(zone,number,kind,x,y,z,target,more={}) {
    const id=out.length, prefix=kind==='conference'?'H':kind==='moving'?'M':'L';
    const meta={uid:`${zone}-${prefix}${String(number).padStart(2,'0')}`,zone,number,kind,broken:false,angle:kind==='conference'?55:kind==='moving'?24:36,target,baseColor:kind==='conference'?'#fff0db':kind==='rgb'||kind==='moving'?'#ffffff':'#ffd5a3',estimated:true,...more};
    out.push({id,name:`${LABELS[zone]} ${prefix}${String(number).padStart(2,'0')}`,manufacturer:'cunjutang',model:kind,category:kind==='moving'?'Moving Head':'Other',mode:'Teaching',universe:0,chStart:0,position:{x,y,z},rotation:{x:0,y:0,z:0},training:meta,OFLData:profile(kind,meta.angle)});
  }
  for(let i=0;i<27;i++)add('front',i+1,'spot',spread(i,27),-4,h,{x:spread(i,27)*.8,y:4,z:1},{broken:i===3});
  for(const side of ['left','right']){
    const sign=side==='left'?1:-1;
    for(let r=0;r<4;r++)for(let c=0;c<3;c++)add(`ear-${side}`,r*3+c+1,'spot',sign*(w/2+1+c*.38),-1,h-1-r*1.25,{x:-sign*w*.17,y:2+c*2,z:1},{row:r+1,column:c+1,broken:side==='right'&&r===0&&c===1});
    const ys=(side==='left'?[.84,.68,.22]:[.84,.51,.18]).map(v=>v*d);
    for(let g=0;g<3;g++)for(let r=0;r<2;r++)for(let c=0;c<2;c++)add(`side-${side}`,g*4+r*2+c+1,'spot',sign*(w/2+.7),ys[g]+c*.45,3.6-r*.65,{x:-sign*w*.18,y:ys[g],z:1},{block:g+1,row:r+1,column:c+1});
  }
  for(let row=1;row<=5;row++){
    const y=stage.rows[row-1];
    if(row%2){
      for(let i=0;i<15;i++)for(const kind of ['conference','spot']){
        const x=spread(i*2+(kind==='spot'?1:0),30);
        add(`top-${row}`,i+1,kind,x,y,h,{x:x*.95,y:y+.7,z:0},{row,broken:row===1&&((kind==='spot'&&i===1)||(kind==='conference'&&i===11))});
      }
    }else{
      for(let i=0;i<11;i++)add(`top-${row}`,i+1,'conference',spread(i,11),y,h,{x:spread(i,11),y:y+.5,z:0},{row});
      for(let i=0;i<8;i++)add(`top-${row}`,i+1,'moving',spread(i,8),y+.35,h,{x:spread(i,8)*.6,y:y-1,z:0},{row});
    }
  }
  for(let i=0;i<12;i++)add('rear',i+1,'rgb',spread(i,12),d-.5,h-1,{x:spread(i,12)*.8,y:d*.65,z:0});
  return repatch(out);
}
export function repatch(fixtures){
  let universe=0,address=0;
  for(const f of fixtures){const n=(f.OFLData?.modes.find(m=>m.name===f.mode)||f.OFLData?.modes[0])?.channels.length||1;if(address+n>512){universe++;address=0;}f.universe=universe;f.chStart=address;address+=n;}
  return fixtures;
}
export function universesFor(fixtures){return [...new Set(fixtures.map(f=>f.universe))].map(id=>({id,name:`Universe ${id+1}`,fixtures:fixtures.filter(f=>f.universe===id).map(f=>({id:f.id}))}));}
export function blankGroup(id,name,fixtures){return {id,name,fixtures:fixtures.map(f=>({id:f.id})),cues:[],chases:[],solo:false,disabled:false,color:'#cfae74',master:255};}
export function createTemplate(){
  const fixtures=buildRig();
  const groups=ZONES.map((zone,i)=>blankGroup(i,LABELS[zone],fixtures.filter(f=>f.training.zone===zone)));
  const all=blankGroup(20,'话剧灯光场景',fixtures);
  const levels=[f=>f.training.zone==='front'?170:f.training.zone==='top-1'?45:0,f=>f.training.zone==='front'?95:f.training.zone.startsWith('ear')?150:0,f=>f.training.zone.startsWith('side')?210:f.training.zone==='front'?40:0,()=>0];
  ['人物面光','双人对话','侧光塑形','换场暗场'].forEach((name,id)=>all.cues.push({id,name,type:0,duration:1,relative:1,fixtureValues:fixtures.map(f=>({fixture:{id:f.id},channelValues:Object.keys(f.OFLData.availableChannels).map((key,i)=>({id:i+1,type:['Red','Green','Blue'].includes(key)?'Color':key,qaIndex:['Red','Green','Blue'].includes(key)?['Red','Green','Blue'].indexOf(key):0,color:['Red','Green','Blue'].includes(key)?key:null,value:key==='Dimmer'?levels[id](f):['Pan','Tilt'].includes(key)?128:255,active:true}))}))}));
  groups.push(all);
  return {name:'存菊堂 · 话剧灯光预演',bpm:120,fixtures,universes:universesFor(fixtures),groups,outputs:[],visualizer:{globalBrightness:15,globalFoggingState:0},training:{version:1,source:'存菊堂口述灯位 / 2026-11-02',stage:clone(DEFAULT_STAGE),objects:[{id:'actor-1',kind:'actor',name:'演员 A',x:2,y:4,rotation:0},{id:'actor-2',kind:'actor',name:'演员 B',x:-2,y:4,rotation:0}],settings:{quality:'auto',fog:false,repair:false,blackout:false,master:1,autoOn:false,autoLevel:70},cueTimes:{'20:0':2,'20:1':2,'20:2':3,'20:3':2},currentChannels:{},note:'左耳光镜像、尺寸、灯高、朝向、灯具型号及能力为教学估算，可修改；不代表实测。'}};
}
export function effectiveIntensity(value,broken,settings={},soloPass=true){return settings.blackout||!soloPass||(broken&&!settings.repair)?0:Math.min(1,Math.max(0,Number(value)||0))*Math.min(1,Math.max(0,settings.master??1));}
export function nextCapacity(count){let capacity=32;while(capacity<count)capacity*=2;return capacity;}

// Validate before touching the current live show. Unknown upstream fields survive normalization.
export function normalizeShow(raw){
  const d=clone(raw);
  if(!d||!Array.isArray(d.fixtures)||!Array.isArray(d.groups)||!Array.isArray(d.universes))throw new Error('工程格式不正确 / Invalid showfile');
  if(d.fixtures.length>2000)throw new Error('教学版本最多支持 2000 盏灯 / Fixture limit exceeded');
  const ids=new Set(),uids=new Set();
  for(const f of d.fixtures){
    if(!Number.isInteger(f.id)||ids.has(f.id))throw new Error('灯具 ID 重复或无效 / Invalid fixture ID');ids.add(f.id);
    for(const key of ['manufacturer','model'])if(typeof f[key]!=='string'||!/^[\w .-]+$/.test(f[key]))throw new Error('灯具路径不合法 / Invalid fixture path');
    f.position??={x:0,y:0,z:8};f.rotation??={x:0,y:0,z:0};
    for(const pos of [f.position,f.rotation])for(const k of ['x','y','z'])if(!Number.isFinite(pos[k])||Math.abs(pos[k])>10000)throw new Error('灯位数值不合法 / Invalid position');
    f.training??={uid:`import-${f.id}`,zone:'import',number:f.id+1,kind:f.category==='Moving Head'?'moving':'spot',broken:false,angle:36,target:{x:f.position.x,y:f.position.y,z:0},baseColor:'#ffffff',estimated:true};
    if(!TYPES.includes(f.training.kind)||typeof f.training.uid!=='string'||!f.training.uid.trim()||uids.has(f.training.uid)||typeof f.training.zone!=='string'||!f.training.zone.trim()||!Number.isInteger(f.training.number)||f.training.number<1||typeof f.training.broken!=='boolean'||['row','block'].some(k=>f.training[k]!==undefined&&(!Number.isInteger(f.training[k])||f.training[k]<0)))throw new Error('灯具类型、分区或编号不合法 / Invalid fixture metadata');uids.add(f.training.uid);
    if(!Number.isFinite(f.training.angle)||f.training.angle<5||f.training.angle>120)throw new Error('光束角应为 5–120° / Invalid beam angle');
    for(const k of ['x','y','z'])if(!Number.isFinite(f.training.target?.[k]))throw new Error('照射目标不合法 / Invalid focus');
    if(!/^#[0-9a-f]{6}$/i.test(f.training.baseColor))throw new Error('灯色不合法 / Invalid color');
  }
  const groupIds=new Set();
  for(const g of d.groups){
    if(!Number.isInteger(g.id)||groupIds.has(g.id))throw new Error('分组 ID 不合法 / Invalid group ID');groupIds.add(g.id);
    g.fixtures??=[];g.cues??=[];g.chases??=[];
    if(!Array.isArray(g.fixtures)||!Array.isArray(g.cues)||!Array.isArray(g.chases))throw new Error('分组格式不正确 / Invalid group');
    const members=new Set();for(const f of g.fixtures){if(!ids.has(f.id)||members.has(f.id))throw new Error('分组引用不存在或重复的灯 / Invalid group reference');members.add(f.id);}
    const cueIds=new Set();for(const cue of g.cues){if(!Number.isInteger(cue.id)||cueIds.has(cue.id)||![0,1].includes(cue.type))throw new Error('场景 ID 或类型不合法 / Invalid cue');cueIds.add(cue.id);for(const fv of cue.fixtureValues||[]){if(!members.has(fv.fixture?.id)||!Array.isArray(fv.channelValues))throw new Error('场景引用不合法 / Invalid cue fixture');for(const c of fv.channelValues)if(!Number.isFinite(Number(c.value))||Number(c.value)<0||Number(c.value)>255)throw new Error('场景通道应为 0–255 / Invalid channel value');}}
  }
  const defaults=createTemplate().training;
  if(d.training&&d.training.version!==1)throw new Error('不支持的教学工程版本 / Unsupported version');
  d.training={...defaults,...d.training,objects:d.training?.objects||[],settings:{...defaults.settings,...d.training?.settings},currentChannels:d.training?.currentChannels||{},cueTimes:d.training?.cueTimes||{}};
  const s=d.training.stage;
  for(const k of ['width','depth','height'])if(!Number.isFinite(s[k])||s[k]<2||s[k]>100)throw new Error('舞台尺寸应为 2–100 米 / Invalid stage dimensions');
  if(!Array.isArray(s.rows)||s.rows.length<1||s.rows.length>32||s.rows.some((v,i)=>!Number.isFinite(v)||v<0||v>s.depth||(i>0&&v<=s.rows[i-1])))throw new Error('灯排应有 1–32 排，距台口距离递增且位于舞台内 / Invalid row depths');
  if(!Array.isArray(d.training.objects)||d.training.objects.length>100)throw new Error('舞台对象过多 / Too many stage objects');
  const objectIds=new Set();for(const o of d.training.objects){if(!o.id||objectIds.has(o.id)||!['actor','table','chair','block'].includes(o.kind)||!Number.isFinite(o.x)||!Number.isFinite(o.y)||!Number.isFinite(o.rotation))throw new Error('舞台对象不合法 / Invalid stage object');objectIds.add(o.id);}
  for(const v of Object.values(d.training.cueTimes))if(!Number.isFinite(v)||v<0||v>120)throw new Error('渐变时间应为 0–120 秒 / Invalid fade time');
  const settings=d.training.settings;
  if(!['auto','low','high'].includes(settings.quality)||!Number.isFinite(settings.master)||settings.master<0||settings.master>1||['fog','repair','blackout','autoOn'].some(k=>typeof settings[k]!=='boolean')||!Number.isFinite(settings.autoLevel)||settings.autoLevel<0||settings.autoLevel>100)throw new Error('预演设置不合法 / Invalid settings');
  for(const values of Object.values(d.training.currentChannels))if(!Array.isArray(values)||values.some(v=>!Number.isFinite(v)||v<0||v>255))throw new Error('通道值不合法 / Invalid channels');
  d.outputs=[];d.selectedOutputs=[];
  return d;
}
