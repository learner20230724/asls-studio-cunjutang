import {blankGroup,clone} from './rig.mjs';
import {defaultCurtains} from './venue-layout.mjs';
export const DEMO_NAME='光影剧场 · 摇头灯与布景';
export function demoPlan(stage,existing){
 const curtains=defaultCurtains(stage),actors=existing.filter(o=>o.kind==='actor').slice(0,2).map(clone);
 const used=new Set(existing.map(o=>o.id));let added=0;
 const unique=base=>{let id=base;while(used.has(id))id+='-new';used.add(id);return id;};
 while(actors.length<2&&existing.length+added<100){actors.push({id:unique('demo-actor-'+actors.length),kind:'actor',name:`演员 ${actors.length?'B':'A'}`,x:0,y:3,rotation:0});added++;}
 const props=[];
 for(const [key,kind,name,x,y,rotation] of [['table','table','会客桌',0,5.8,0],['chair-left','chair','左侧座椅',-1.3,5.2,25],['chair-right','chair','右侧座椅',1.3,5.2,-25],['platform-left','block','左侧矮台',-5,9,0],['platform-right','block','右侧矮台',5,9,0]]){
  const old=existing.find(o=>o.demoProp===key);if(old){props.push({...clone(old),x,y,rotation});continue;}
  if(existing.length+added>=100)continue;props.push({id:unique('demo-'+key),kind,name,x,y,rotation,demoProp:key});added++;
 }
 const retained=existing.filter(o=>![...actors,...props].some(a=>a.id===o.id)).map(clone);
 const sx=stage.width/21,sy=stage.depth/15;
 const object=(x,y,rotation=0,shift=0)=>[...actors.map((o,i)=>({...o,x:(i?1:-1)*x*sx,y:(y+(i?.3:0))*sy,rotation:i?-rotation:rotation})),...props.map(o=>({...o,x:(o.x+(o.kind==='table'?-3.5*shift:o.kind==='chair'?3.4*shift:0))*sx,y:(o.y+shift*(o.kind==='block'?1:2))*sy,rotation:o.rotation+(o.kind==='chair'?45*shift:0)})),...retained.map(clone)];
 const frame=(name,objects,closed,look,seconds=4,motion=null,hold=2)=>({name,look,seconds,motion,hold,stage:{objects,curtains:curtains.map((c,i)=>({...c,closed:closed.includes(i),amount:closed.includes(i)?1:0}))}});
 return [
  frame('序幕 · 等待开场',object(4.4,2.8),[0,1,2,3],0,2),
  frame('启幕 · 暖光入场',object(2.4,3),[1,2,3],1,4),
  frame('相遇 · 桌边对话',object(1.1,4.3),[2,3],2,5),
  frame('换景 · 打开纵深',object(3.2,6.4,30,1),[],3,5,{pan:0,tilt:-3,palette:0},0),
  frame('摇头 · 青蓝交叉',object(2.3,5.8,20,1),[],3,4,{pan:-34,tilt:12,palette:1},0),
  frame('摇头 · 紫红反扫',object(-2.3,5.8,-30,1),[],3,5,{pan:34,tilt:-10,palette:2},0),
  frame('旋转 · 扇形展开',object(-3.3,6.6,-15,1),[],4,4,{pan:70,tilt:5,palette:3},0),
  frame('旋转 · 光束回环',object(-2.1,5.2,20,1),[],4,5,{pan:140,tilt:14,palette:4},0),
  frame('旋转 · 金青交汇',object(2.1,5.2,-20,1),[],4,5,{pan:210,tilt:4,palette:5},0),
  frame('旋转 · 收束归位',object(1.7,3.2,0,1),[],4,6,{pan:360,tilt:0,palette:0},1),
  frame('谢幕 · 暖金定格',object(1.7,2.6,0,.5),[],5,4,{pan:360,tilt:0,palette:0},3),
  frame('落幕 · 渐暗收束',object(1.7,2.6,0,.5),[0,1,2,3],0,4,{pan:360,tilt:0,palette:0},0)
 ];
}
const palettes=[[[255,193,100],[255,220,150]],[[35,195,255],[70,90,255]],[[178,60,255],[255,65,150]],[[65,245,175],[255,110,55]],[[90,110,255],[230,80,255]],[[255,195,65],[35,225,215]]];
export function demoChannels(f,step){
 const z=f.training.zone,k=f.training.kind,n=step.look,number=f.training.number;let level=0;
 if(n&&z==='front'&&number%4===0)level=n===3||n===4?35:230;
 if(n===2&&z.startsWith('ear')&&number%6===0)level=170;
 if(n>=3&&k==='moving'&&number%2===0)level=n===5?150:245;
 if(n>=3&&z==='rear'&&number%3===0)level=125;
 if(n===5&&z==='top-1'&&number%6===0)level=150;
 const side=f.position.x>=0?1:-1,motion=step.motion,bank=f.training.row===4?1:0;
 const degrees=motion?motion.pan*side+(bank?8:0):0;
 // Keep the existing manual control response; choose demo channel values only.
 return {level,rgb:palettes[motion?.palette??0][(side>0?0:1)^bank],pan:(((degrees+180)%360+360)%360)/360*255,tilt:((motion?.tilt||0)+90)/180*255,aim:{pan:degrees,tilt:motion?.tilt||0}};
}
export function installDemo(engine){
 // A new edition gets its own group; older/user-edited scenes remain intact.
 const old=engine.groups.find(g=>g.name===DEMO_NAME);if(old?.cuePool.cues.length)return engine.cues.findIndex(c=>c.group===old);
 const fixtures=engine.fixtures,g=engine.show.groupPool.addRaw(blankGroup(Math.max(-1,...engine.groups.map(g=>g.id))+1,DEMO_NAME,[]));for(const f of fixtures)g.addFixture(f);
 engine.training.cueHolds??={};
 for(const [id,step] of demoPlan(engine.training.stage,engine.training.objects).entries()){
  const raw=engine.capture(g,id,step.name);step.stage.aims={};
  for(const fv of raw.fixtureValues){const f=fixtures.find(f=>f.id===fv.fixture.id),v=demoChannels(f,step);if(f.training.kind==='moving')step.stage.aims[f.id]=v.aim;for(const c of fv.channelValues)c.value=c.type==='Dimmer'?v.level:c.type==='Color'?v.rgb[['Red','Green','Blue'].indexOf(c.color)]??255:c.type==='Pan'?v.pan:c.type==='Tilt'?v.tilt:c.value;}
  g.addCue(raw);const key=`${g.id}:${id}`;engine.training.cueTimes[key]=step.seconds;engine.training.cueHolds[key]=step.hold;engine.training.cueStages??={};engine.training.cueStages[key]=step.stage;
 }
 engine.mark();return engine.cues.findIndex(c=>c.group===g);
}
