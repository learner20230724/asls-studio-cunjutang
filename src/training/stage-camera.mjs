import { Matrix4, Quaternion, Vector3 } from 'three';

const worldUp = new Vector3(0, 0, 1);
const overheadUp = new Vector3(0, -1, 0);
const rotation = new Matrix4();

export function stagePoint(rect, clientX, clientY, turned) {
  return turned
    ? [rect.bottom - clientY, clientX - rect.left]
    : [clientX - rect.left, clientY - rect.top];
}

export function connectStageControls(controls, canvas, isTurned) {
  // OrbitControls uses client coordinates for mouse and page coordinates for touch.
  for (const name of ['_onPointerDown', '_onPointerMove']) {
    const handle = controls[name];
    controls[name] = event => {
      if (!isTurned()) return handle(event);
      const [x, y] = stagePoint(canvas.getBoundingClientRect(), event.clientX, event.clientY, true);
      const { pointerId, pointerType, button, ctrlKey, metaKey, shiftKey } = event;
      return handle({ pointerId, pointerType, button, ctrlKey, metaKey, shiftKey,
        clientX: x, clientY: y, pageX: x, pageY: y });
    };
  }
  controls.domElement = canvas;
  controls.connect();
}

function bezierEase(progress) {
  if (progress <= 0 || progress >= 1) return progress;
  // Solve x(t) for the CSS cubic-bezier(.42, 0, .58, 1), then evaluate y(t).
  let t = progress;
  for (let i = 0; i < 8; i++) {
    const x = ((.52 * t - .78) * t + 1.26) * t;
    if (Math.abs(x - progress) < 1e-6) break;
    t -= (x - progress) / ((1.56 * t - 1.56) * t + 1.26);
  }
  return t * t * (3 - 2 * t);
}

export function stageViewMotion(camera, fromTarget, toPosition, toTarget, overhead) {
  const startPosition = camera.position.clone().sub(fromTarget);
  const endPosition = toPosition.clone().sub(toTarget);
  const startDistance = startPosition.length();
  const endDistance = endPosition.length();
  const startDirection = startPosition.normalize();
  const endDirection = endPosition.normalize();
  const arc = new Quaternion().setFromUnitVectors(startDirection, endDirection);
  const startUp = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  rotation.lookAt(toPosition, toTarget, overhead ? overheadUp : worldUp);
  const endUp = new Vector3().setFromMatrixColumn(rotation, 1);
  const carriedUp = startUp.clone().applyQuaternion(arc);
  const cosine = carriedUp.dot(endUp);
  const sine = endDirection.dot(carriedUp.cross(endUp));
  const roll = cosine < 0 && Math.abs(sine) < 1e-7 ? Math.PI : Math.atan2(sine, cosine);
  const partialArc = new Quaternion();
  const direction = new Vector3();
  const screenUp = new Vector3();
  const startTarget = fromTarget.clone();

  return (progress, target) => {
    const eased = bezierEase(progress);
    partialArc.identity().slerp(arc, eased);
    direction.copy(startDirection).applyQuaternion(partialArc);
    // Carry the screen up vector along the arc, then finish rolling before the camera settles.
    screenUp.copy(startUp).applyQuaternion(partialArc)
      .applyAxisAngle(direction, roll * bezierEase(Math.min(1, progress / .85)));
    target.lerpVectors(startTarget, toTarget, eased);
    camera.position.copy(target).addScaledVector(direction, startDistance + (endDistance - startDistance) * eased);
    camera.quaternion.setFromRotationMatrix(rotation.lookAt(camera.position, target, screenUp));
  };
}
