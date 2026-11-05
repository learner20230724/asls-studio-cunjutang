import test from 'node:test';
import assert from 'node:assert/strict';
import {createShowcaseTemplate,DEMO_NAME} from '../src/training/demo.mjs';
import {normalizeShow} from '../src/training/rig.mjs';
test('reset template is a clean twelve-scene presentation with fog off and furniture visible',()=>{
 const data=createShowcaseTemplate(),cues=data.groups.flatMap(g=>g.cues);
 assert.equal(cues.length,12);assert.equal(cues[0].name,'序幕 · 等待开场');assert.equal(cues.at(-1).name,'落幕 · 渐暗收束');
 assert.equal(data.groups.find(g=>g.id===20).name,DEMO_NAME);assert.equal(data.training.settings.fog,false);assert.equal(data.training.settings.blackout,false);assert.equal(data.training.settings.master,1);
 assert.equal(data.training.objects.length,7);assert.ok(data.training.curtains.every(c=>!c.closed));assert.equal(data.training.currentChannels[0][0],170);
 assert.equal(Object.keys(data.training.cueStages).length,12);assert.deepEqual(normalizeShow(data),{...JSON.parse(JSON.stringify(data)),selectedOutputs:[]});
});
test('each reset constructs independent scenes and matching timing/aim keys',()=>{
 const a=createShowcaseTemplate();a.groups.at(-1).cues.reverse();a.training.objects[0].x=9;a.training.settings.fog=true;
 const b=createShowcaseTemplate();assert.equal(b.groups.at(-1).cues[0].name,'序幕 · 等待开场');assert.equal(b.training.objects[0].x,2);assert.equal(b.training.settings.fog,false);
 for(const c of b.groups.at(-1).cues){const key=`20:${c.id}`;assert.ok(b.training.cueTimes[key]>=0);assert.ok(b.training.cueHolds[key]>=0);assert.equal(Object.keys(b.training.cueStages[key].aims).length,16);}
});
