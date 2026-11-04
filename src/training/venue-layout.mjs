export const defaultCurtains=stage=>[{id:'first',name:'一道幕',y:Math.min(1,stage.depth*.15),closed:false},{id:'second',name:'二道幕',y:stage.depth/2,closed:false}];
export function curtainBoxes(stage,curtains=[]){
  const out=[];
  for(const c of curtains)for(const side of [-1,1]){
    const width=c.closed?stage.width/2:.6,x=c.closed?side*stage.width/4:side*(stage.width/2-.3);
    const size=[width,.18,stage.height],center=[x,c.y,stage.height/2];
    out.push({id:`curtain-${c.id}-${side}`,size,center,min:center.map((v,i)=>v-size[i]/2),max:center.map((v,i)=>v+size[i]/2),color:c.id==='first'?'#722e3c':'#303944',lit:true});
  }
  return out;
}
export function migrateVenue(raw){
  const d=JSON.parse(JSON.stringify(raw));
  if(d.training?.stage?.width===16&&!d.training.layoutVersion&&d.training.source?.includes('存菊堂')){
    const scale=21/16;
    for(const f of d.fixtures){if(Number.isFinite(f.position?.x))f.position.x*=scale;if(Number.isFinite(f.training?.target?.x))f.training.target.x*=scale;}
    for(const o of d.training.objects||[])if(Number.isFinite(o.x))o.x*=scale;
    d.training.stage.width=21;d.training.layoutVersion=2;
  }
  return d;
}
