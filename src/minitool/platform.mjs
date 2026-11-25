let api,version=0;
const preview=typeof __WEB_PREVIEW__!=='undefined'&&__WEB_PREVIEW__;
const timeout=p=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error('连接超时，请重试')),5000))]);
export async function windowInfo(){if(version<9490||!api?.getWindowInfo)return;try{const r=await timeout(api.getWindowInfo());const buttons=Object.values(r.menuButtons||{}).filter(b=>b&&b.height>0);const top=Math.max(r.safeArea?.top||0,...buttons.map(b=>b.bottom+6));document.documentElement.style.setProperty('--safe-area-inset-top',top+'px');if(r.safeArea&&r.windowHeight)document.documentElement.style.setProperty('--safe-area-inset-bottom',Math.max(0,r.windowHeight-r.safeArea.bottom)+'px');}catch{}}
export async function initPlatform(){const x=window.xhs;api=x&&x.miniTool;let options=x&&x.launchOptions;if(!options&&api&&api.getLaunchOptions)try{options=await timeout(api.getLaunchOptions())}catch{}version=Math.floor(Number(options?.miniToolEnv?.buildVersion||0)/1000);await windowInfo();return version;}
export const canWorker=()=>(preview||version>=9530)&&typeof Worker==='function';
const key='STAGE_LIGHTING_GENERIC_V1';
export async function read(){if(preview){const s=localStorage.getItem(key);return s?JSON.parse(s):null}if(version<9460||!api?.getStorage)return null;const r=await timeout(api.getStorage({key}));return r.data?JSON.parse(r.data):null;}
export async function save(data){const json=JSON.stringify(data);if(preview){localStorage.setItem(key,json);return}if(version<9460||!api?.setStorage)throw Error('请在小红书 9.46 及以上版本保存');if(new TextEncoder().encode(json).length>950000)throw Error('调度过多，请删除部分调度后保存');const r=await timeout(api.setStorage({key,data:json}));if(!r||r.errMsg!=='setStorage:ok')throw Error('保存失败，请重试');}
