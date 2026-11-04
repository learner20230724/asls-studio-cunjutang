// Scene state is independent of the native DMX cue model; old cues remain valid.
export const copy=value=>JSON.parse(JSON.stringify(value));
export const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export const curtainAmount=c=>Math.max(0,Math.min(1,Number.isFinite(c.amount)?c.amount:c.closed?1:0));
export function captureStage(training){return {objects:copy(training.objects),curtains:training.curtains.map(c=>({...copy(c),amount:c.closed?1:0}))};}
export function interpolateStage(from,to,progress){
 const t=ease(progress),lerp=(a,b)=>a+(b-a)*t;
 return {objects:to.objects.map(b=>{const a=from.objects.find(o=>o.id===b.id)||b;let turn=((b.rotation-a.rotation+540)%360)-180;return {...b,x:lerp(a.x,b.x),y:lerp(a.y,b.y),rotation:t===1?b.rotation:a.rotation+turn*t};}),curtains:to.curtains.map(b=>{const a=from.curtains.find(c=>c.id===b.id)||b;return {...b,amount:lerp(curtainAmount(a),curtainAmount(b))};})};
}
export function validateStageState(state,stage){
 if(!state||!Array.isArray(state.objects)||state.objects.length>100||!Array.isArray(state.curtains)||state.curtains.length>4)throw Error('场景站位数据不正确');
 const ids=new Set();for(const o of state.objects){if(!o.id||ids.has(o.id)||!['actor','table','chair','block'].includes(o.kind)||!['x','y','rotation'].every(k=>Number.isFinite(o[k]))||Math.abs(o.x)>10000||Math.abs(o.y)>10000)throw Error('场景对象数据不正确');ids.add(o.id);}
 const curtainIds=new Set();for(const c of state.curtains){if(typeof c.id!=='string'||curtainIds.has(c.id)||typeof c.name!=='string'||!Number.isFinite(c.y)||c.y<0||c.y>stage.depth||typeof c.closed!=='boolean'||c.amount!==undefined&&(!Number.isFinite(c.amount)||c.amount<0||c.amount>1))throw Error('场景幕布数据不正确');curtainIds.add(c.id);}
}
