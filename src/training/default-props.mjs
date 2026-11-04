// Default furniture belongs to the ordinary stage, not just the guided demo.
export function defaultProps(stage){
 const x=stage.width/21,y=stage.depth/15;
 return [['table','table','会客桌',0,5,0],['chair-left','chair','左侧座椅',-1.3,4.3,20],['chair-right','chair','右侧座椅',1.3,4.3,-20],['platform-left','block','左侧矮台',-4.8,6,0],['platform-right','block','右侧矮台',4.8,6,0]].map(([key,kind,name,px,py,rotation])=>({id:'stage-'+key,kind,name,x:px*x,y:py*y,rotation,demoProp:key}));
}
export const needsDefaultProps=t=>!!t&&t.propsVersion===undefined&&typeof t.source==='string'&&t.source.includes('存菊堂');
export function addDefaultProps(training){
 const objects=training.objects,ids=new Set(objects.map(o=>o.id)),required={table:1,chair:2,block:2};
 for(const prop of defaultProps(training.stage)){
  if(objects.length>=100||objects.filter(o=>o.kind===prop.kind).length>=required[prop.kind])continue;
  if(objects.some(o=>o.kind===prop.kind&&Math.hypot(o.x-prop.x,o.y-prop.y)<.8))continue;
  while(ids.has(prop.id))prop.id+='-new';ids.add(prop.id);objects.push(prop);
 }
 training.propsVersion=1;
}
