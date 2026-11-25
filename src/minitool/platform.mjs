let api,version=0,userDataPath='';
export const preview=typeof __WEB_PREVIEW__!=='undefined'&&__WEB_PREVIEW__;
const timeout=p=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error('连接超时，请重试')),5000))]);
export async function windowInfo(){if(version<9490||!api?.getWindowInfo)return;try{const r=await timeout(api.getWindowInfo());const buttons=Object.values(r.menuButtons||{}).filter(b=>b&&b.height>0);const top=Math.max(r.safeArea?.top||0,...buttons.map(b=>b.bottom+6));document.documentElement.style.setProperty('--safe-area-inset-top',top+'px');if(r.safeArea&&r.windowHeight)document.documentElement.style.setProperty('--safe-area-inset-bottom',Math.max(0,r.windowHeight-r.safeArea.bottom)+'px');}catch{}}
export async function initPlatform(){const x=window.xhs;api=x&&x.miniTool;let options=x&&x.launchOptions;if(!options&&api&&api.getLaunchOptions)try{options=await timeout(api.getLaunchOptions())}catch{}version=Math.floor(Number(options?.miniToolEnv?.buildVersion||0)/1000);userDataPath=options?.miniToolEnv?.userDataPath||'';await windowInfo();return version;}
export const canWorker=()=>(preview||version>=9530)&&typeof Worker==='function';
const key='STAGE_LIGHTING_GENERIC_V1';
export async function read(){if(preview){const s=localStorage.getItem(key);return s?JSON.parse(s):null}if(version<9460||!api?.getStorage)return null;const r=await timeout(api.getStorage({key}));return r.data?JSON.parse(r.data):null;}
export async function save(data){const json=JSON.stringify(data);if(preview){localStorage.setItem(key,json);return}if(version<9460||!api?.setStorage)throw Error('请在小红书 9.46 及以上版本保存');if(new TextEncoder().encode(json).length>950000)throw Error('调度过多，请删除部分调度后保存');const r=await timeout(api.setStorage({key,data:json}));if(!r||r.errMsg!=='setStorage:ok')throw Error('保存失败，请重试');}

export async function showLegacyFollow() {
  if (typeof __LEGACY_FOLLOW__ === 'undefined' || !__LEGACY_FOLLOW__) return false;
  const deadline = Date.UTC(2026, 10, 30, 16);
  if (Date.now() >= deadline || typeof api?.followAuthor !== 'function') return false;
  try {
    await api.followAuthor();
    return true;
  } catch {
    return false;
  }
}

export const canOpenVideoNote = () => version >= 9430 && typeof api?.postNote === 'function';
export const canSaveImage = () => version >= 9420 && typeof api?.saveImageToPhotosAlbum === 'function';
export const canShareImages = () => typeof api?.postNote === 'function';
const noteContent = '\n\n#光场灯光排练室# #舞台灯光# #灯光设计#';

function fileData(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error('无法读取视频文件'));
    reader.readAsDataURL(blob);
  });
}

async function tempPath(data) {
  if (typeof api?.writeTempFile !== 'function') return data;
  const result = await api.writeTempFile({ data });
  if (!result?.filePath) throw Error('无法写入媒体文件');
  return result.filePath;
}

export async function savePhoto(data) {
  await api.saveImageToPhotosAlbum({ filePath: await tempPath(data) });
}

export async function openImageNote(images) {
  const image_resources = [];
  for (const image of images) image_resources.push({ url: await tempPath(image) });
  await api.postNote({ content: noteContent, pageType: 'photo_publish', mediaInfo: { image_resources } });
}

async function videoPath(blob) {
  if (version < 9490 || !userDataPath || !api.getFileStorageInfo || !api.writeFile || !api.appendFile) {
    return tempPath(await fileData(blob));
  }
  const { writeChunkMaxBytes } = await api.getFileStorageInfo();
  if (!Number.isSafeInteger(writeChunkMaxBytes) || writeChunkMaxBytes < 1) {
    throw Error('无法读取视频写入配额');
  }
  const filePath = userDataPath + '/lightstage-animation.mp4';
  try {
    for (let offset = 0; offset < blob.size; offset += writeChunkMaxBytes) {
      const part = blob.slice(offset, offset + writeChunkMaxBytes);
      const data = (await fileData(part)).split(',')[1];
      const method = offset === 0 ? 'writeFile' : 'appendFile';
      const result = await api[method]({ filePath, data, encoding: 'base64' });
      if (result?.writtenBytes !== part.size) throw Error('视频文件未完整写入');
    }
    return filePath;
  } catch (error) {
    if (typeof api.unlink === 'function') await api.unlink({ filePath }).catch(() => {});
    throw error;
  }
}

export async function openVideoNote(blob) {
  const video_url = await videoPath(blob);
  await api.postNote({ content: noteContent, pageType: 'video_publish', mediaInfo: { video_resources: { video_url } } });
}

export async function keepScreenOn(keepScreenOn) {
  if (version >= 9550 && typeof api?.setKeepScreenOn === 'function') {
    await timeout(api.setKeepScreenOn({ keepScreenOn })).catch(() => {});
  }
}

export function downloadMedia(data, filename) {
  if (!preview) return;
  const link = document.createElement('a');
  const isBlob = data instanceof Blob;
  link.href = isBlob ? URL.createObjectURL(data) : data;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (isBlob) setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}
