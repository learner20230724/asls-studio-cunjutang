import test from 'node:test';
import assert from 'node:assert/strict';
import {template,validate,blend,fixtures} from '../src/minitool/state.mjs';
test('generic template contains all zones, moving heads and no school faults',()=>{assert.equal(fixtures.length,83);assert(fixtures.every(f=>!f.training.broken));assert.equal(fixtures.filter(f=>f.training.kind==='moving').length,16);const t=template();assert.equal(t.cues.length,12);assert.equal(t.current.objects.length,7);assert.deepEqual(validate(t),t);assert(JSON.stringify(t).length<100000);assert(!JSON.stringify(t).includes('存菊堂'));});
test('scenes interpolate lighting, moving direction, stage and curtains',()=>{const t=template(),a=t.cues[0].frame,b=t.cues[4].frame,m=blend(a,b,.5);assert.equal(m.curtains[0].amount,.5);assert(m.lights.some(l=>l.level>0&&l.level<.85));assert.notDeepEqual(m.objects,b.objects);assert.equal(JSON.stringify(blend(a,b,1).lights),JSON.stringify(b.lights));});
test('invalid storage is rejected without replacing a good draft',()=>{const t=template();t.current.lights[0].color='invalid';assert.throws(()=>validate(t));const x=template();x.cues[0].seconds=NaN;assert.throws(()=>validate(x));});

test('cue playback preserves the editor frame, transitions and the final hold', async () => {
  const { createCuePlayback, advanceCuePlayback } = await import('../src/minitool/cue-playback.mjs');
  const { current, cues } = template();
  const original = JSON.stringify(current);
  const selected = cues.slice(0, 2).map(cue => ({ ...cue, seconds: .5 }));
  const playback = createCuePlayback(current, selected);
  advanceCuePlayback(playback, 250);
  assert(playback.frame.lights[0].level < current.lights[0].level);
  advanceCuePlayback(playback, 2250);
  assert.equal(playback.index, 1);
  assert.deepEqual(playback.frame, selected[0].frame);
  advanceCuePlayback(playback, 500);
  assert.deepEqual(playback.frame, selected[1].frame);
  advanceCuePlayback(playback, 1999);
  assert.equal(playback.done, false);
  advanceCuePlayback(playback, 1);
  assert.equal(playback.done, true);
  assert.equal(playback.position, 5000);
  assert.equal(JSON.stringify(current), original);
  assert.notEqual(playback.frame, selected[1].frame);
});
