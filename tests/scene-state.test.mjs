import test from 'node:test';
import assert from 'node:assert/strict';
import {captureStage,interpolateStage,validateStageState} from '../src/training/scene-state.mjs';
import {createTemplate,normalizeShow} from '../src/training/rig.mjs';
import {curtainBoxes} from '../src/training/venue-layout.mjs';
import {demoPlan} from '../src/training/demo.mjs';
test('a full scene captures independent object and curtain data and survives export/import',()=>{
 const d=createTemplate(),state=captureStage(d.training);d.training.cueStages['20:0']=state;d.training.objects[0].x=9;d.training.curtains[0].closed=true;
 assert.notEqual(state.objects[0].x,9);assert.equal(state.curtains[0].closed,false);assert.deepEqual(normalizeShow(JSON.parse(JSON.stringify(d))).training.cueStages['20:0'],state);
});
test('scene motion has intermediate positions, shortest rotation, exact endpoints',()=>{
 const d=createTemplate(),a=captureStage(d.training),b=structuredClone(a);b.objects[0].x=8;a.objects[0].rotation=350;b.objects[0].rotation=10;b.curtains[0].closed=true;b.curtains[0].amount=1;
 const mid=interpolateStage(a,b,.5);assert.equal(mid.objects[0].x,5);assert.equal(mid.objects[0].rotation,360);assert.equal(mid.curtains[0].amount,.5);assert.deepEqual(interpolateStage(a,b,1),b);
 const boxes=curtainBoxes(d.training.stage,mid.curtains);assert.ok(boxes[0].size[0]>.6&&boxes[0].size[0]<d.training.stage.width/2);
});
test('four curtains have independent partial states; old pair expands without moving it',()=>{
 const d=createTemplate();d.training.curtains=d.training.curtains.slice(0,2);d.training.curtains[1].y=7.5;d.training.curtains[0].amount=.4;
 const next=normalizeShow(d);assert.equal(next.training.curtains.length,4);assert.equal(next.training.curtains[1].y,7.5);assert.equal(next.training.curtains[0].amount,.4);
});
test('malformed saved scene positions are rejected before import changes the show',()=>{
 const d=createTemplate(),state=captureStage(d.training);state.objects[0].x=Infinity;assert.throws(()=>validateStageState(state,d.training.stage));state.objects[0].x=0;state.curtains[0].amount=2;assert.throws(()=>validateStageState(state,d.training.stage));
});
test('ablation: object motion and curtain motion act independently and combine',()=>{
 const d=createTemplate(),from=captureStage(d.training),target=structuredClone(from);target.objects[0].x+=4;target.curtains[0].closed=true;target.curtains[0].amount=1;
 const onlyObjects=interpolateStage(from,{objects:target.objects,curtains:from.curtains},.5),onlyCurtains=interpolateStage(from,{objects:from.objects,curtains:target.curtains},.5),combined=interpolateStage(from,target,.5);
 assert.equal(onlyObjects.objects[0].x,combined.objects[0].x);assert.equal(onlyObjects.curtains[0].amount,0);assert.deepEqual(onlyCurtains.objects,from.objects);assert.equal(onlyCurtains.curtains[0].amount,combined.curtains[0].amount);
});
test('demonstration has twelve varied scenes, starts and ends closed, preserves input',()=>{
 const d=createTemplate(),before=structuredClone(d),plan=demoPlan(d.training.stage,d.training.objects);assert.equal(plan.length,12);assert.ok(plan[0].stage.curtains.every(c=>c.closed));assert.ok(plan.at(-1).stage.curtains.every(c=>c.closed));assert.ok(plan[3].stage.curtains.every(c=>!c.closed));assert.notEqual(plan[2].stage.objects[0].x,plan[4].stage.objects[0].x);for(const p of plan)validateStageState(p.stage,d.training.stage);assert.deepEqual(d,before);
});

test('authored moving-head rotation interpolates continuously and survives save/import',()=>{
 const d=createTemplate(),a=captureStage(d.training),b=structuredClone(a);a.aims={7:{pan:140,tilt:14}};b.aims={7:{pan:210,tilt:4}};
 const mid=interpolateStage(a,b,.5);assert.deepEqual(mid.aims[7],{pan:175,tilt:9});d.training.aims=mid.aims;d.training.cueStages['20:0']=captureStage(d.training);assert.deepEqual(normalizeShow(d).training.cueStages['20:0'].aims,mid.aims);
 d.training.aims[7].pan=Infinity;assert.throws(()=>normalizeShow(d));
});
test('new demo has paired moving-head colors, full rotation and five reusable props',async()=>{
 const {demoChannels}=await import('../src/training/demo.mjs'),d=createTemplate(),plan=demoPlan(d.training.stage,d.training.objects);
 assert.equal(plan[0].stage.objects.filter(o=>o.demoProp).length,5);assert.equal(new Set(plan[0].stage.objects.map(o=>o.id)).size,7);
 const moving=d.fixtures.filter(f=>f.training.kind==='moving'&&f.training.number%2===0);assert.equal(moving.length,8);
 for(const step of plan.slice(3,10)){const values=moving.map(f=>demoChannels(f,step));assert.ok(values.every(v=>v.level>0));assert.ok(new Set(values.map(v=>v.rgb.join())).size>1);assert.ok(values.every(v=>v.pan>=0&&v.pan<=255&&v.tilt>=0&&v.tilt<=255));assert.equal(step.hold,step===plan[9]?1:0);}
 assert.equal(demoChannels(moving[0],plan[9]).aim.pan-demoChannels(moving[0],plan[3]).aim.pan,360*Math.sign(moving[0].position.x));
 const again=demoPlan(d.training.stage,plan[3].stage.objects);assert.equal(again[0].stage.objects.length,7);
 const custom={id:'own-table',name:'用户桌子',kind:'table',x:7,y:8,rotation:10};for(const step of demoPlan(d.training.stage,[...d.training.objects,custom]))assert.deepEqual(step.stage.objects.find(o=>o.id===custom.id),custom);
 const bad=createTemplate();bad.training.cueHolds={'20:0':-1};assert.throws(()=>normalizeShow(bad));
});
