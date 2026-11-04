import {blankGroup,clone} from './rig.mjs';
import {defaultCurtains} from './venue-layout.mjs';
export function demoPlan(stage,existing){
 const curtains=defaultCurtains(stage),actors=existing.filter(o=>o.kind==='actor').slice(0,2).map(clone);
 const used=new Set(existing.map(o=>o.id));let added=0;while(actors.length<2&&existing.length+added<100){let id='demo-actor-'+actors.length;while(used.has(id))id+='-new';used.add(id);actors.push({id,kind:'actor',name:`演员 ${actors.length?'B':'A'}`,x:0,y:3,rotation:0});added++;}
 const retained=existing.filter(o=>!actors.some(a=>a.id===o.id)).map(clone);
 const object=(x,y,rotation=0)=>[...actors.map((o,i)=>({...o,x:(i?1:-1)*x,y:y+(i?.3:0),rotation:i?-rotation:rotation})),...retained.map(clone)];
 const frame=(name,objects,closed,look,seconds=4)=>({name,look,seconds,stage:{objects,curtains:curtains.map((c,i)=>({...c,closed:closed.includes(i),amount:closed.includes(i)?1:0}))}});
 return [frame('序幕 · 等待开场',object(stage.width*.21,2.8),[0,1,2,3],0,2),frame('启幕 · 暖光入场',object(2.4,3),[1,2,3],1,4),frame('相遇 · 双人对话',object(.9,3.2),[2,3],2,5),frame('转场 · 蓝紫纵深',object(3.2,stage.depth*.48,35),[],3,5),frame('追光 · 交错行进',object(-2.3,stage.depth*.39,-40),[],4,6),frame('谢幕 · 暖金定格',object(1.7,2.6),[],5,5),frame('落幕 · 渐暗收束',object(1.7,2.6),[0,1,2,3],0,4)];
}
export function installDemo(engine){
 const old=engine.groups.find(g=>g.name==='开场到谢幕 · 示例');if(old?.cuePool.cues.length)return engine.cues.findIndex(c=>c.group===old);
 const fixtures=engine.fixtures,g=engine.show.groupPool.addRaw(blankGroup(Math.max(-1,...engine.groups.map(g=>g.id))+1,'开场到谢幕 · 示例',[]));for(const f of fixtures)g.addFixture(f);
 const select=(f,n)=>f.training.number%n===0;
 for(const [id,step] of demoPlan(engine.training.stage,engine.training.objects).entries()){
  const raw=engine.capture(g,id,step.name);
  for(const fv of raw.fixtureValues){const f=fixtures.find(f=>f.id===fv.fixture.id),z=f.training.zone,k=f.training.kind,n=step.look;let level=0;
   if(n&&z==='front'&&select(f,4))level=n===3||n===4?55:230;
   if(n===2&&z.startsWith('ear')&&select(f,6))level=170;
   if((n===3||n===4)&&k==='moving'&&select(f,3))level=230;
   if(n>=3&&z==='rear'&&select(f,3))level=200;
   if(n===5&&z==='top-1'&&select(f,6))level=150;
   const rgb=n===3?[110,80,255]:n===4?[50,200,255]:[255,193,100];
   for(const c of fv.channelValues)c.value=c.type==='Dimmer'?level:c.type==='Color'?rgb[['Red','Green','Blue'].indexOf(c.color)]??255:c.type==='Pan'?(n===4?136:128):c.type==='Tilt'?(n===4?121:128):c.value;
  }
  g.addCue(raw);const key=`${g.id}:${id}`;engine.training.cueTimes[key]=step.seconds;engine.training.cueStages??={};engine.training.cueStages[key]=step.stage;
 }
 engine.mark();return engine.cues.findIndex(c=>c.group===g);
}
