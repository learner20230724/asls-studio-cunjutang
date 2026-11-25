import { blend, clone } from './state.mjs';

const HOLD_MS = 2000;

export function advanceTransition(transition, elapsed) {
  transition.elapsed += elapsed;
  const progress = Math.min(1, transition.elapsed / transition.duration);
  return blend(transition.from, transition.to, progress * progress * (3 - 2 * progress));
}

export function createCuePlayback(frame, cues) {
  const duration = cues.reduce((total, cue) => total + cue.seconds * 1000 + HOLD_MS, 0);
  return { cues: clone(cues), frame, from: frame, index: 0, elapsed: 0, position: 0, duration, done: false };
}

export function advanceCuePlayback(playback, elapsed) {
  playback.position = Math.min(playback.duration, playback.position + elapsed);
  playback.elapsed += elapsed;
  while (playback.index < playback.cues.length) {
    const cue = playback.cues[playback.index];
    const duration = cue.seconds * 1000;
    if (playback.elapsed < duration + HOLD_MS) {
      const progress = Math.min(1, playback.elapsed / duration);
      if (progress === 0) playback.frame = playback.from;
      else if (progress === 1) playback.frame = cue.frame;
      else playback.frame = blend(playback.from, cue.frame, progress * progress * (3 - 2 * progress));
      return;
    }
    playback.frame = playback.from = cue.frame;
    playback.elapsed -= duration + HOLD_MS;
    if (playback.index === playback.cues.length - 1) break;
    playback.index++;
  }
  playback.done = true;
}
