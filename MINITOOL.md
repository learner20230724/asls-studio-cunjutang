# 光场灯光排练室 · 通用小工具 1.0.0

名称：光场灯光排练室（7 字）
简介：调灯布景，编排光影舞台（11 字，含标点）

独立分支 `codex/generic-stage-minitool`。原学校版和原公开入口不覆盖。
入口源码为 `src/minitool/`，复用剧场几何、布幕、遮挡与表面照明算法；不引入原 DMX 输出、学校工作台、网络加载或历史存档。

## 使用

手机上方保持舞台，下方三个页签：调灯、布景、场景。分区选择、亮度、色板、摇头方向、四道幕、人物与桌椅、场景捕获及渐变播放均可使用。默认 83 盏正常灯具（包含 16 盏摇头灯），21 米舞台，7 个演员道具，12 段可编辑场景。空气光束每次进入默认关闭。重置替换当前模板与场景清单；保存使用独立键，不接触原学校版。

## 构建与交付

- `npm run build:minitool` → `dist-minitool/`，经典 IIFE 脚本、Chrome 61 / ES2017 目标、包内经典 Worker。
- `npm run build:miniweb` → `dist-miniweb/`，独立网页预览，保存使用此通用版专用浏览器键。此构建不是平台上传包。
- `npm test`：41 项单元测试。
- `npm run check:minitool`：先将 dist-minitool 提供于 127.0.0.1:5191；可用 APP_URL、PLAYWRIGHT_PATH 指定环境。这是本地 Chromium + 模拟原生存储协议测试，不是平台认证。
- `python3 scripts/package-minitool.py`：校验目录并在 delivery 输出上传 ZIP 和校验摘要。
- `npm run deploy:miniweb`：发布独立 `/lightstage/` 网页入口。Caddy 初次路由由管理员增量配置。

## 平台契约核对

使用下载的 minitool-zip-builder 1.11.1，在线文档核对于 2026-11-23，页面标记更新 2026-11-19。
在线能力较随包基线新增 AI 非流式文本（内测）、窗口信息、定位、振动、陀螺仪、关注作者、分享；Worker 更新为客户端 9.53+ 允许单个经典 Dedicated Worker。存储兼容条件和系统门槛已更新，按在线文档执行。

实际只调用 getLaunchOptions、getWindowInfo、getStorage、setStorage。存储最低客户端 9.46；未知版本、API 缺失或失败不回退浏览器存储，不伪报保存。单键限制前检查 UTF-8 字节数，当前模板约 70 KB；上限 60 场、24 个对象。窗口信息 9.49+ 用于避让顶部原生按钮。后台暂停绘制、终止 Worker，回前台重建单个 Worker 并重送场景；不可用时回退本地计算。无网页网络请求、下载、剪贴板、模块脚本、外部资产、WASM、动态代码执行。

默认 DPR 至多 1.5、200 万像素；轻量档 DPR 至多 1、100 万像素。相机移动不单独降低分辨率。持续昂贵绘制先关闭雾光并切轻量档，仍超预算则进入可调灯、布景和编排的 Canvas 平面视图。WebGL 初始化失败或 context lost 也保留场景进入平面视图。无硬件输出。

## 验证边界

已完成静态包审计、单元测试和本地 Chromium 流程检查。平台原生 API 在本机以协议模拟验证，不宣称已在小红书运行；Android 10+ / iOS 18.4+ 系统门槛来自在线规范，Chrome 61 内核兼容仅做构建与代码审核，未运行旧内核。实际手机帧率、GPU、内存未实测。

待用户：上传同一个 ZIP 至创服平台，在平台模拟器完整验证，再用 Android 真机及 iOS 真机扫码验证。未登录或代为上传。

GPL-3.0 原作者 Timé Kadel / ASLS Studio 署名及许可证保留在 licenses.json；Three.js / Vue 为 MIT。生成图标与封面独立放在宣传素材包，不挤占上传 ZIP。
