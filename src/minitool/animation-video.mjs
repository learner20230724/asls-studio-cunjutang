const MP4 = ['video/mp4;codecs=avc1.42001f', 'video/mp4;codecs=avc1', 'video/mp4'];
const WEBM = ['video/webm;codecs=vp8', 'video/webm'];

export function videoFormat(preview) {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported
      || !HTMLCanvasElement.prototype.captureStream) return null;
  return (preview ? MP4.concat(WEBM) : MP4).find(type => MediaRecorder.isTypeSupported(type)) || null;
}

export function recordStage(source, mimeType) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
  canvas.width = Math.max(2, Math.floor(source.width * scale / 2) * 2);
  canvas.height = Math.max(2, Math.floor(source.height * scale / 2) * 2);
  const context = canvas.getContext('2d', { alpha: false });
  const stream = canvas.captureStream(30);
  const track = stream.getVideoTracks()[0];
  const chunks = [];
  let recorder;
  let started = false;
  let settled = false;
  let finishTimer;
  let cancelled = false;
  const draw = frame => {
    context.drawImage(frame, 0, 0, canvas.width, canvas.height);
    track.requestFrame?.();
  };
  const release = () => {
    clearTimeout(finishTimer);
    track.stop();
    canvas.width = canvas.height = 1;
  };

  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2200000 });
    recorder.onstart = () => { started = true; };
    recorder.start(1000);
    draw(source);
  } catch (error) {
    release();
    throw error;
  }

  const result = new Promise((resolve, reject) => {
    recorder.ondataavailable = event => {
      if (event.data.size && !settled && !cancelled) chunks.push(event.data);
    };
    recorder.onerror = () => {
      if (settled) return;
      settled = true;
      release();
      reject(Error('录制失败，请重试'));
    };
    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      release();
      const type = (recorder.mimeType || mimeType).split(';')[0];
      if (cancelled) resolve(null);
      else if (chunks.length) resolve(new Blob(chunks, { type }));
      else reject(Error('没有录到舞台画面，请重试'));
      chunks.length = 0;
    };
  });

  return {
    draw,
    result,
    get started() { return started; },
    finish() {
      // Let the last canvas paint reach the capture track before the recorder closes.
      finishTimer = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 120);
    },
    cancel() {
      if (settled) return;
      cancelled = true;
      chunks.length = 0;
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    },
  };
}
