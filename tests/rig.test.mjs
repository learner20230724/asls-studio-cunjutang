import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRig,createTemplate,normalizeShow,effectiveIntensity,nextCapacity,clone,profile} from '../src/training/rig.mjs';

test('215 fixtures, 16 moving heads and exactly four recorded faults',()=>{
 const rig=buildRig();assert.equal(rig.length,215);assert.equal(rig.filter(f=>f.training.kind==='moving').length,16);
 assert.deepEqual(rig.filter(f=>f.training.broken).map(f=>f.training.uid),['front-L04','ear-right-L02','top-1-L02','top-1-H12']);assert.equal(new Set(rig.map(f=>f.training.uid)).size,215);
});
test('alternation, independent numbering and row order',()=>{
 const rig=buildRig();for(const row of [1,3,5]){const fs=rig.filter(f=>f.training.zone===`top-${row}`);assert.equal(fs.length,30);fs.forEach((f,i)=>{assert.equal(f.training.kind,i%2?'spot':'conference');assert.equal(f.training.number,Math.floor(i/2)+1);if(i)assert.ok(fs[i-1].position.x>f.position.x);});}
 for(const row of [2,4]){const fs=rig.filter(f=>f.training.zone===`top-${row}`);assert.equal(fs.filter(f=>f.training.kind==='conference').length,11);assert.equal(fs.filter(f=>f.training.kind==='moving').length,8);assert.ok(fs.every(f=>!f.training.broken));}
});
test('ear rows descend; side-light spacing is intentionally asymmetric',()=>{
 const rig=buildRig();const ears=rig.filter(f=>f.training.zone==='ear-right');for(let row=1;row<4;row++)assert.ok(ears[row*3].position.z<ears[(row-1)*3].position.z);
 const positions=side=>rig.filter(f=>f.training.zone===`side-${side}`&&f.training.row===1&&f.training.column===1).map(f=>f.position.y);const left=positions('left'),right=positions('right');assert.ok(left[0]-left[1]<left[1]-left[2]);assert.ok(Math.abs((right[0]-right[1])-(right[1]-right[2]))<1e-9);
});
test('fault masking is independent of requested intensity, playback and master',()=>{
 for(const value of [0,.25,1,2])assert.equal(effectiveIntensity(value,true,{master:1}),0);assert.equal(effectiveIntensity(1,true,{repair:true}),1);assert.equal(effectiveIntensity(1,true,{repair:true,blackout:true}),0);assert.equal(effectiveIntensity(1,false,{master:.3}),.3);assert.equal(effectiveIntensity(1,false,{},false),0);
});
test('capacity grows without a 100 fixture boundary',()=>{for(const n of [0,100,101,215,300,513])assert.ok(nextCapacity(n)>=n);assert.equal(nextCapacity(215),256);assert.equal(nextCapacity(300),512);});
test('native showfile roundtrip preserves teaching extensions',()=>{const d=createTemplate();d.training.objects.push({id:'table',kind:'table',name:'桌',x:1,y:2,rotation:90});d.training.customNote='kept';const roundtrip=normalizeShow(JSON.parse(JSON.stringify(d)));assert.deepEqual(roundtrip.fixtures,d.fixtures);assert.deepEqual(roundtrip.training,d.training);assert.equal(roundtrip.groups.at(-1).cues.length,4);});
test('old files acquire defaults; device output is discarded',()=>{const d=createTemplate();delete d.training;for(const f of d.fixtures)delete f.training;d.outputs=[{remote:'192.168.1.5',port:6454}];const normalized=normalizeShow(d);assert.equal(normalized.training.version,1);assert.deepEqual(normalized.outputs,[]);assert.equal(normalized.training.objects.length,0);});
test('bad files are rejected without modifying caller data',()=>{
 for(const mutate of [d=>d.fixtures[1].id=d.fixtures[0].id,d=>d.fixtures[0].position.x='bad',d=>d.training.stage.width=-1,d=>d.training.stage.rows=[4,1],d=>d.fixtures[0].model='../unsafe',d=>d.training.version=99,d=>d.groups[0].fixtures.push({id:90000}),d=>d.fixtures[0].training.angle=200,d=>d.training.objects[0].x=null,d=>d.groups[1].id=d.groups[0].id,d=>d.training.settings.master=10,d=>d.training.currentChannels[0]=[999]]){const d=createTemplate();mutate(d);const before=clone(d);assert.throws(()=>normalizeShow(d));assert.deepEqual(d,before);}
});
test('patches have no overlaps and do not cross universe boundaries',()=>{const byUniverse=new Map();for(const f of buildRig()){const n=f.OFLData.modes[0].channels.length;assert.ok(f.chStart+n<=512);const used=byUniverse.get(f.universe)||new Set();for(let a=f.chStart;a<f.chStart+n;a++){assert.ok(!used.has(a));used.add(a);}byUniverse.set(f.universe,used);}});
test('fixed fixture controls never pretend to have RGB or pan/tilt',()=>{assert.deepEqual(Object.keys(profile('spot').availableChannels),['Dimmer']);assert.deepEqual(Object.keys(profile('conference').availableChannels),['Dimmer']);assert.equal(Object.keys(profile('moving').availableChannels).length,6);});

test("custom venue row count remains editable",()=>{const d=createTemplate();d.training.stage.rows=[1,3,5,7,9,11,13];assert.equal(normalizeShow(d).training.stage.rows.length,7);});
