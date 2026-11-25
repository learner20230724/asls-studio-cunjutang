const assert = require('node:assert/strict');
const fs = require('node:fs');

async function verifyImageLayout(page, media) {
  await page.setViewportSize({ width: 362, height: 780 });
  await page.getByRole('button', { name: '布景', exact: true }).tap();
  const propsFit = await page.locator('.curtains button').evaluateAll(buttons => buttons.every(button => {
    const range = document.createRange();
    range.selectNodeContents(button);
    const text = range.getBoundingClientRect();
    const box = button.getBoundingClientRect();
    return range.getClientRects().length === 1 && text.left >= box.left && text.right <= box.right;
  }));
  assert(propsFit, 'curtain actions fit on one line');
  await page.getByRole('button', { name: '调度', exact: true }).tap();
  await page.getByLabel('调度名称 1', { exact: true }).fill('验收调度 · 甲');
  await page.getByLabel('渐变 1', { exact: true }).fill('12.5');
  await page.locator('.transport span').tap();
  const timingFit = await page.locator('.cue-timing').first().evaluate(element => {
    const [label, input, unit] = [...element.children].map(child => child.getBoundingClientRect());
    return label.right < input.left && input.right < unit.left && Math.abs(label.y - unit.y) < 1;
  });
  assert(timingFit, 'cue timing label, value and unit share a row');
  await page.getByRole('button', { name: '存图与分享' }).tap();
  await page.getByLabel('是否保存工作台').check();
  await page.getByRole('button', { name: '存图', exact: true }).tap();
  await page.getByRole('status').filter({ hasText: '已保存 4 张到相册' }).waitFor({ timeout: 45000 });
  assert.equal(media.photos.length, 4);
  const [stage, ...workbench] = media.photos;
  const sizes = await page.evaluate(async images => {
    const decoded = await Promise.all(images.map(item => new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.src = item;
    })));
    const [stage] = decoded;
    const canvas = document.createElement('canvas');
    canvas.width = stage.width;
    canvas.height = stage.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(stage, 0, 0);
    const expected = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return decoded.map(image => {
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      return [image.width, image.height, pixels.every((pixel, index) => pixel === expected[index])];
    });
  }, media.photos);
  assert(sizes[0][0] >= 1000, 'stage is exported above viewport resolution');
  assert(sizes.slice(1).every(([width, height, match]) => width === sizes[0][0] && height > sizes[0][1] && match));
  const svgSources = await page.evaluate(() => window.exportSvgs.map(source => decodeURIComponent(source.split(',')[1])));
  assert(svgSources.some(svg => svg.includes('value="验收调度 · 甲"') && svg.includes('value="12.5"')));
  for (const [index, data] of [stage, ...workbench].entries()) {
    fs.writeFileSync('output/mini-export-' + index + '.png', Buffer.from(data.split(',')[1], 'base64'));
  }

  await page.getByRole('button', { name: '存图与分享' }).tap();
  await page.getByRole('button', { name: '分享', exact: true }).tap();
  await page.waitForFunction(() => window.mediaNote?.pageType === 'photo_publish', undefined, { timeout: 45000 });
  assert.equal(media.notes.at(-1).mediaInfo.image_resources.length, 4);
  return sizes;
}

async function verifyAnimation(page, store, media) {
  const key = 'STAGE_LIGHTING_GENERIC_V1';
  const editable = JSON.parse(store[key]);
  editable.cues = editable.cues.slice(0, 2);
  editable.cues.forEach(cue => { cue.seconds = .2; });
  store[key] = JSON.stringify(editable);
  await page.reload();
  await page.locator('.loading').waitFor({ state: 'hidden' });
  await page.waitForTimeout(900);
  const startExport = async () => {
    await page.getByRole('button', { name: '存图与分享' }).tap();
    await page.getByRole('button', { name: '导出我制作的动画' }).tap();
    await page.getByRole('button', { name: '取消录制' }).waitFor();
  };

  await startExport();
  await page.getByRole('button', { name: '取消录制' }).tap();
  await page.getByRole('dialog', { name: '导出动画' }).waitFor({ state: 'hidden' });
  assert(!media.notes.some(note => note.pageType === 'video_publish'));

  await startExport();
  try {
    await page.waitForFunction(() => window.mediaNote?.pageType === 'video_publish', undefined, { timeout: 30000 });
  } catch (error) {
    throw Error('Video note did not open: ' + (await page.getByRole('status').allTextContents()).join(', '), { cause: error });
  }
  const path = media.notes.at(-1).mediaInfo.video_resources.video_url;
  assert.equal(path, 'usr://mock/lightstage-animation.mp4');
  const video = Buffer.concat(media.files[path]);
  assert.equal(video.toString('ascii', 4, 8), 'ftyp');
  assert(media.files[path].length > 1, 'MP4 written in multiple native chunks');
  fs.writeFileSync('output/mini-animation.mp4', video);
  const stats = await page.evaluate(async bytes => {
    const video = document.createElement('video');
    const blob = new Blob([Uint8Array.from(atob(bytes), c => c.charCodeAt(0))], { type: 'video/mp4' });
    video.muted = true;
    const url = URL.createObjectURL(blob);
    try {
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(Error('导出 MP4 无法解码'));
        video.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const sample = async time => {
        await new Promise(resolve => { video.onseeked = resolve; video.currentTime = time; });
        context.drawImage(video, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const start = await sample(.8);
      const end = await sample(3.5);
      const different = start.reduce((sum, value, i) => sum + Number(Math.abs(value - end[i]) > 10), 0);
      return { width: video.videoWidth, height: video.videoHeight, duration: video.duration, different };
    } finally {
      URL.revokeObjectURL(url);
    }
  }, video.toString('base64'));
  assert(stats.duration >= 4 && stats.duration < 6, JSON.stringify(stats));
  assert(stats.different > 1000, 'video contains visibly different cues');
  assert.equal(store[key], JSON.stringify(editable), 'recording does not write to the editor project');
  await page.getByRole('dialog', { name: '导出动画' }).waitFor({ state: 'hidden' });
  return stats;
}

async function touchStage(page, session, viewport, dx, dy) {
  const turned = viewport.width < viewport.height;
  const point = (x, y) => turned ? { x: y, y: viewport.height - x, id: 1 } : { x, y, id: 1 };
  const send = (type, touchPoints) => session.send('Input.dispatchTouchEvent', { type, touchPoints });
  await send('touchStart', [point(607, 140)]);
  for (let i = 1; i <= 4; i++) await send('touchMove', [point(607 + dx * i / 4, 140 + dy * i / 4)]);
  await send('touchEnd', []);
  await page.waitForTimeout(300);
}

async function verifyFullScreen(page) {
  const samples = [];
  const session = await page.context().newCDPSession(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: '全屏', exact: true }).tap();
    const layout = await page.locator('.stage').evaluate(stage => {
      const buttons = [...stage.querySelectorAll('.view-actions button')];
      const matrix = getComputedStyle(stage).transform;
      return { labels: buttons.map(b => b.textContent), rows: buttons.map(b => b.offsetTop),
        columns: buttons.map(b => b.offsetLeft), size: [stage.clientWidth, stage.clientHeight], matrix };
    });
    assert.deepEqual(layout.labels, ['退出全屏', '正视', '俯视', '环绕']);
    assert(layout.rows.every(row => row === layout.rows[0]));
    assert(layout.columns.every((col, i) => !i || col > layout.columns[i - 1]));
    assert.deepEqual(layout.size, [844, 390]);
    assert.equal(layout.matrix === 'none', viewport.width > viewport.height);
    await page.getByRole('button', { name: '俯视', exact: true }).tap();
    await page.waitForTimeout(1150);
    const pictures = [];
    for (const [dx, dy] of [[0, 0], [-48, 0], [0, 48]]) {
      await page.getByRole('button', { name: '正视', exact: true }).tap();
      await page.waitForTimeout(1250);
      if (dx || dy) await touchStage(page, session, viewport, dx, dy);
      const sample = await page.locator('.stage').screenshot();
      pictures.push('data:image/png;base64,' + sample.toString('base64'));
    }
    samples.push(pictures);
    await page.getByRole('button', { name: '环绕', exact: true }).tap();
    assert.equal(await page.getByRole('button', { name: '环绕', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: '环绕', exact: true }).tap();
    await page.getByRole('button', { name: '退出全屏', exact: true }).tap();
    assert(await page.locator('.desk').isVisible());
  }
  await session.detach();
  const deltas = await page.evaluate(async regions => {
    const images = [];
    for (const [group, urls] of regions.entries()) {
      const frames = [];
      for (const url of urls) {
        const image = new Image();
        await new Promise(resolve => { image.onload = resolve; image.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = 844;
        canvas.height = 390;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (group === 0) {
          context.translate(844, 0);
          context.rotate(Math.PI / 2);
          context.drawImage(image, 0, 0, 390, 844);
        } else context.drawImage(image, 0, 0, 844, 390);
        frames.push(context.getImageData(150, 55, 550, 260).data);
      }
      images.push(frames);
    }
    const distance = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
    return {
      layout: images[0].map((frame, i) => distance(frame, images[1][i])),
      horizontal: distance(images[0][0], images[0][1]),
      vertical: distance(images[0][0], images[0][2]),
      distinct: distance(images[0][1], images[0][2]),
    };
  }, samples);
  assert(deltas.horizontal > 2 && deltas.vertical > 2 && deltas.distinct > 2, JSON.stringify(deltas));
  assert(deltas.layout.every(delta => delta < 2.5), 'same drag in CSS-rotated and landscape stage: ' + JSON.stringify(deltas));
  return deltas;
}

module.exports = { verifyImageLayout, verifyAnimation, verifyFullScreen };
