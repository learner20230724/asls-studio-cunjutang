import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { stagePoint, stageViewMotion } from '../src/training/stage-camera.mjs';

const target = new Vector3(0, 6.9, 2);
const front = new Vector3(0, -23.25, 6.8);
const top = new Vector3(0, 7.5, 45.15);
const screenUp = camera => new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

test('turned canvas uses the same horizontal and vertical touch axes as landscape', () => {
  const upright = { left: 12, top: 24 };
  const turned = { left: 12, bottom: 844 };
  for (const [x, y] of [[0, 0], [400, 110], [360, 110], [400, 70]]) {
    assert.deepEqual(stagePoint(turned, 12 + y, 844 - x, true), stagePoint(upright, 12 + x, 24 + y, false));
  }
});

test('camera rolls during the arc and lands with the audience at the top without a final flip', () => {
  const camera = new PerspectiveCamera();
  camera.up.set(0, 0, 1);
  camera.position.copy(front);
  camera.lookAt(target);
  const liveTarget = target.clone();
  const move = stageViewMotion(camera, liveTarget, top, target, true);
  const initial = camera.quaternion.clone();
  move(0, liveTarget);
  assert(initial.angleTo(camera.quaternion) < 1e-6);
  assert(screenUp(camera).z > .9);
  let previous = camera.quaternion.clone();
  for (let i = 1; i <= 100; i++) {
    move(i / 100, liveTarget);
    assert(previous.angleTo(camera.quaternion) < .09, 'adjacent frames stay continuous');
    const forward = target.clone().sub(camera.position).normalize();
    assert(forward.dot(camera.getWorldDirection(new Vector3())) > .99999, 'stage stays centered through the roll');
    if (i === 85) assert(screenUp(camera).y < -.98, 'roll is complete before the last frames');
    previous = camera.quaternion.clone();
  }
  assert(camera.position.distanceTo(top) < 1e-9);
  assert(screenUp(camera).y < -.99);
  camera.lookAt(target);
  assert(previous.angleTo(camera.quaternion) < 1e-6, 'OrbitControls world-up agrees with the final pose');

  const back = stageViewMotion(camera, liveTarget, front, target, false);
  back(.45, liveTarget);
  const interrupted = camera.quaternion.clone();
  const position = camera.position.clone();
  const restart = stageViewMotion(camera, liveTarget, top, target, true);
  restart(0, liveTarget);
  assert(interrupted.angleTo(camera.quaternion) < 1e-6);
  assert(position.distanceTo(camera.position) < 1e-9);
  back(1, liveTarget);
  assert(camera.position.distanceTo(front) < 1e-9);
  assert(screenUp(camera).z > .98);
});
