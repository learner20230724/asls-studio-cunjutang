import test from 'node:test';
import assert from 'node:assert/strict';
import {createTemplate,normalizeShow} from '../src/training/rig.mjs';
test('ordinary initial stage has visible furniture without playing a demo',()=>{
 const t=createTemplate().training;assert.equal(t.propsVersion,1);assert.equal(t.objects.filter(o=>o.kind==='table').length,1);assert.equal(t.objects.filter(o=>o.kind==='chair').length,2);assert.equal(t.objects.filter(o=>o.kind==='block').length,2);
});
test('old browser stage gets missing props once without changing lights or saved cues',()=>{
 const d=createTemplate();delete d.training.propsVersion;d.training.objects=d.training.objects.filter(o=>o.kind==='actor');d.training.currentChannels={0:[116]};const before=structuredClone(d),n=normalizeShow(d);
 assert.equal(n.training.objects.length,7);assert.deepEqual(n.training.objects.slice(0,2),before.training.objects);assert.deepEqual(n.groups,before.groups);assert.deepEqual(n.training.currentChannels,before.training.currentChannels);assert.deepEqual(n.fixtures,before.fixtures);assert.deepEqual(d,before);assert.deepEqual(normalizeShow(n).training.objects,n.training.objects);
 n.training.objects=n.training.objects.filter(o=>o.kind!=='chair');assert.equal(normalizeShow(n).training.objects.filter(o=>o.kind==='chair').length,0);
});
test('migration preserves custom furniture, avoids duplicates and leaves external imports alone',()=>{
 const d=createTemplate();delete d.training.propsVersion;const chair=d.training.objects.find(o=>o.kind==='chair');chair.id='my-chair';chair.name='我的椅子';chair.x=7;chair.rotation=95;
 const n=normalizeShow(d);assert.equal(n.training.objects.length,7);assert.deepEqual(n.training.objects.find(o=>o.id==='my-chair'),chair);
 const single=createTemplate();delete single.training.propsVersion;single.training.objects=single.training.objects.filter(o=>o.id!=='stage-chair-right');const filled=normalizeShow(single).training.objects.filter(o=>o.kind==='chair');assert.equal(filled.length,2);assert.notEqual(filled[0].x,filled[1].x);
 d.training.source='Other venue';d.training.objects=[];assert.deepEqual(normalizeShow(d).training.objects,[]);
});
