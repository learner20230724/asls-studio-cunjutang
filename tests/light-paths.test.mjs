import test from 'node:test';
import assert from 'node:assert/strict';
import {venueBlockers,segmentBlocked,MAX_BLOCKERS} from '../src/training/light-paths.mjs';
import {buildRig,DEFAULT_STAGE,createTemplate,normalizeShow} from '../src/training/rig.mjs';
import {curtainBoxes,defaultCurtains} from '../src/training/venue-layout.mjs';
const walls=[...venueBlockers(DEFAULT_STAGE),...curtainBoxes(DEFAULT_STAGE,defaultCurtains(DEFAULT_STAGE))];
test('every working front light has an unobstructed path through the stage mouth',()=>{
  for(const light of buildRig().filter(f=>f.training.zone==='front')){
    const {position:p,training:{target:t}}=light;
    assert.equal(segmentBlocked([p.x,p.y,p.z],[t.x,t.y,t.z],walls),false,light.name);
    // At floor height, the same optical axis must still reach the actual stage.
    const scale=(-.01-p.z)/(t.z-p.z),floor=[p.x+(t.x-p.x)*scale,p.y+(t.y-p.y)*scale,-.01];
    assert.ok(Math.abs(floor[0])<DEFAULT_STAGE.width/2&&floor[1]>0&&floor[1]<15);
    assert.equal(segmentBlocked([p.x,p.y,p.z],floor,walls),false,light.name);
  }
});
test('wall, floor and wing stop light behind them, not on their receiving surface',()=>{
  assert.equal(segmentBlocked([0,8,3],[0,16,3],walls),true);
  assert.equal(segmentBlocked([0,8,3],[0,15.125,3],walls),false);
  assert.equal(segmentBlocked([0,4,8],[0,4,-1],walls),true);
  assert.equal(segmentBlocked([0,4,8],[0,4,-.01],walls),false);
  assert.equal(segmentBlocked([DEFAULT_STAGE.width/2-.3,0,2],[DEFAULT_STAGE.width/2-.3,2,2],walls),true);
  assert.equal(segmentBlocked([0,8,9],[0,16,9],walls),false);
});
test('parallel, reverse, inside-wall and short rays are handled',()=>{
  assert.equal(segmentBlocked([0,-4,8],[0,4,1],walls),false);
  assert.equal(segmentBlocked([0,16,3],[0,8,3],walls),true);
  assert.equal(segmentBlocked([0,15.2,3],[0,8,3],walls),true);
  assert.equal(segmentBlocked([0,4,1],[0,4,1],walls),false);
});
test('blockers follow custom venue dimensions without closing the front',()=>{
  for(const stage of [{width:8,depth:9,height:5,rows:[1,4]},DEFAULT_STAGE,{width:30,depth:25,height:12,rows:[1,5]}]){
    const boxes=venueBlockers(stage);assert.ok(boxes.length<=MAX_BLOCKERS);
    assert.equal(segmentBlocked([0,-4,stage.height],[0,stage.depth/2,1],boxes),false);
    assert.equal(segmentBlocked([0,stage.depth/2,2],[0,stage.depth+1,2],boxes),true);
  }
});
test('existing shows retain channels, cues and focus while auto-test defaults are added',()=>{
  const saved=createTemplate();delete saved.training.settings.autoOn;delete saved.training.settings.autoLevel;
  saved.training.currentChannels[0]=[114];const oldFixtures=structuredClone(saved.fixtures),oldGroups=structuredClone(saved.groups);
  const loaded=normalizeShow(saved);assert.equal(loaded.training.settings.autoOn,false);assert.equal(loaded.training.settings.autoLevel,70);
  assert.deepEqual(loaded.fixtures,oldFixtures);assert.deepEqual(loaded.groups,oldGroups);assert.deepEqual(loaded.training.currentChannels[0],[114]);
  for(const bad of [-1,101,NaN]){const d=createTemplate();d.training.settings.autoLevel=bad;assert.throws(()=>normalizeShow(d));}
});
