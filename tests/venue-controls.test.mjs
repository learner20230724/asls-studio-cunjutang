import test from 'node:test';
import assert from 'node:assert/strict';
import {createTemplate,normalizeShow} from '../src/training/rig.mjs';
import {migrateVenue,curtainBoxes} from '../src/training/venue-layout.mjs';
import {blockedSegment,objectBlockers,rayHit} from '../src/training/occlusion.mjs';

test('21m venue and two independently openable curtains',()=>{
 const show=createTemplate();assert.equal(show.training.stage.width,21);assert.equal(show.training.curtains.length,2);
 const [first,second]=show.training.curtains;assert.equal(blockedSegment(0,-4,4,0,5,1,curtainBoxes(show.training.stage,show.training.curtains)),false);
 first.closed=true;assert.equal(blockedSegment(0,-4,4,0,5,1,curtainBoxes(show.training.stage,show.training.curtains)),true);
 first.closed=false;second.closed=true;assert.equal(blockedSegment(0,3,4,0,12,1,curtainBoxes(show.training.stage,show.training.curtains)),true);
});
test('old 16m saved layout widens once while cues and channels stay intact',()=>{
 const old=createTemplate();old.training.stage.width=16;delete old.training.layoutVersion;delete old.training.curtains;old.training.currentChannels[0]=[114];
 const before=structuredClone(old),updated=normalizeShow(old);assert.equal(updated.training.stage.width,21);
 assert.equal(updated.fixtures[0].position.x,before.fixtures[0].position.x*21/16);assert.deepEqual(updated.groups,before.groups);assert.deepEqual(updated.training.currentChannels,before.training.currentChannels);
 assert.deepEqual(migrateVenue(updated),updated);assert.deepEqual(old,before);
 const custom=structuredClone(before);custom.training.stage.width=18;assert.equal(normalizeShow(custom).training.stage.width,18);
});
test('curtain definitions roundtrip and invalid positions are rejected',()=>{
 const data=createTemplate();data.training.curtains[0].closed=true;assert.deepEqual(normalizeShow(data).training.curtains,data.training.curtains);
 for(const mutate of [d=>d.training.curtains[0].y=99,d=>d.training.curtains[0].closed='yes',d=>d.training.curtains[1].id='first']){const bad=createTemplate();mutate(bad);assert.throws(()=>normalizeShow(bad));}
});
test('actors and rotated props block light and move their shadows with them',()=>{
 const block={id:'block',kind:'block',x:0,y:4,rotation:45};const blockers=objectBlockers([block]);
 assert.equal(blockedSegment(0,0,.25,0,8,.25,blockers),true);
 assert.equal(blockedSegment(0,0,2,0,8,2,blockers),false);
 block.x=4;assert.equal(blockedSegment(0,0,.25,0,8,.25,objectBlockers([block])),false);
 const actor=objectBlockers([{id:'a',kind:'actor',x:0,y:4,rotation:0}]);assert.equal(blockedSegment(0,0,1.2,0,8,1.2,actor),true);
 assert.equal(blockedSegment(0,0,1.65,0,8,1.65,actor),true);
 assert.equal(blockedSegment(0,0,1.2,0,4,1.2,actor,1),false);
});
test('shadow distance handles parallel rays and sphere tangents',()=>{
 assert.ok(rayHit(0,0,0,0,1,0,{kind:'sphere',center:[0,4,0],radius:1})===3);
 assert.equal(rayHit(2,0,0,0,1,0,{kind:'sphere',center:[0,4,0],radius:1}),1000);
});
