import styles from './style.css?raw';

const BACKGROUND = '#192224';
const MAX_SIDE = 16000;
const MAX_PIXELS = 16000000;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(Error('无法绘制工作台图片'));
    image.src = url;
  });
}

function activeRules(rules) {
  let css = '';
  for (const rule of rules) {
    if (rule.type === 4) {
      if (matchMedia(rule.conditionText).matches) css += activeRules(rule.cssRules);
    } else {
      css += rule.cssText;
    }
  }
  return css;
}

function captureStyles() {
  const style = document.createElement('style');
  style.media = 'not all';
  style.textContent = styles;
  document.head.appendChild(style);
  try {
    return activeRules(style.sheet.cssRules);
  } finally {
    style.remove();
  }
}

function clonePanel(panel) {
  const copy = panel.cloneNode(true);
  copy.style.cssText = 'display:block;overflow:visible';
  const controls = panel.querySelectorAll('input, select');
  const fields = copy.querySelectorAll('input, select');
  controls.forEach((control, index) => {
    const field = fields[index];
    if (control.tagName === 'SELECT') {
      Array.from(field.options).forEach((option, i) => {
        if (i === control.selectedIndex) option.setAttribute('selected', '');
        else option.removeAttribute('selected');
      });
    } else {
      field.setAttribute('value', control.value);
      if (control.checked) field.setAttribute('checked', '');
      else field.removeAttribute('checked');
    }
  });
  return copy;
}

function capturePanel(panel, width) {
  const copy = clonePanel(panel);
  const desk = document.createElement('div');
  desk.className = 'desk';
  desk.style.cssText = 'display:block;border:0;width:' + width + 'px';
  desk.appendChild(copy);
  const measure = document.createElement('div');
  measure.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden';
  measure.appendChild(desk);
  document.body.appendChild(measure);
  try {
    const top = copy.getBoundingClientRect().top;
    const height = copy.scrollHeight;
    const breaks = Array.from(copy.children, child => Math.ceil(child.getBoundingClientRect().bottom - top));
    return { markup: new XMLSerializer().serializeToString(desk), height, breaks };
  } finally {
    measure.remove();
  }
}

async function composite(stage, panel, css, layoutWidth, start, end) {
  const width = stage.naturalWidth;
  const stageHeight = stage.naturalHeight;
  const sectionHeight = Math.ceil((end - start) * width / layoutWidth);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + sectionHeight
    + '" viewBox="0 ' + start + ' ' + layoutWidth + ' ' + (end - start) + '" preserveAspectRatio="none">'
    + '<style><![CDATA[' + css + ']]></style><foreignObject width="' + layoutWidth + '" height="' + panel.height
    + '">' + panel.markup + '</foreignObject></svg>';
  const image = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = stageHeight + sectionHeight;
  const context = canvas.getContext('2d');
  try {
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, width, canvas.height);
    context.drawImage(stage, 0, 0);
    context.drawImage(image, 0, stageHeight);
    const result = canvas.toDataURL('image/png');
    if (result === 'data:,') throw Error('工作台图片太大，无法生成');
    return result;
  } finally {
    canvas.width = canvas.height = 1;
  }
}

export async function buildWorkbenchImages(stageURL, desk) {
  const width = desk.clientWidth;
  const css = captureStyles();
  const panels = Array.from(desk.querySelectorAll('.panel'), panel => capturePanel(panel, width));
  const stage = await loadImage(stageURL);
  const maxHeight = Math.min(MAX_SIDE, Math.floor(MAX_PIXELS / stage.naturalWidth)) - stage.naturalHeight;
  const maxSection = Math.floor(maxHeight * width / stage.naturalWidth);
  if (maxSection < 1) throw Error('舞台图片太大，无法合成工作台');
  const images = [];
  for (const panel of panels) {
    for (let start = 0; start < panel.height;) {
      const limit = Math.min(panel.height, start + maxSection);
      const end = limit === panel.height
        ? limit
        : panel.breaks.reduce((best, point) => point > best && point <= limit ? point : best, start);
      const boundary = end > start ? end : limit;
      images.push(await composite(stage, panel, css, width, start, boundary));
      start = boundary;
    }
  }
  return images;
}
