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
test('demonstration has seven varied scenes, starts and ends closed, preserves input',()=>{
 const d=createTemplate(),before=structuredClone(d),plan=demoPlan(d.training.stage,d.training.objects);assert.equal(plan.length,7);assert.ok(plan[0].stage.curtains.every(c=>c.closed));assert.ok(plan.at(-1).stage.curtains.every(c=>c.closed));assert.ok(plan[3].stage.curtains.every(c=>!c.closed));assert.notEqual(plan[2].stage.objects[0].x,plan[4].stage.objects[0].x);for(const p of plan)validateStageState(p.stage,d.training.stage);assert.deepEqual(d,before);
});
