# 教学版改动说明

基线：ASLS-org/studio develop `bd6d842fd7eb2dc27e65bcadcf3fb66b64bf2fe9`。保留上游历史、GPL-3.0、作者署名及第三方声明；上游介绍存于 `README.upstream.md`。

- 增加中文默认 / 英文切换的 Vue 教学工作台，而非漫画风格；移动端底部导航。
- `src/training/rig.mjs` 维护存菊堂模板、灯具能力、版本化扩展与校验。模板含 215 盏灯、4 个故障及 4 个教学场景。
- `src/training/engine.js` 复用上游 Show / Fixture / Group / Scene / Effect / Chase，不另建一套灯光场景协议。
- `src/training/renderer.js` 增加教学固定灯和摇头灯模型、实例化、受光材质、分批 HDR 累加、演员道具与相机控制。
- `training.version=1` 保存舞台、演员道具、练习设置、渐变时间、当前通道与来源；灯具的 `training` 保存稳定 ID、分区、编号、故障和估算说明。OFL 定义随工程嵌入，通用配置随项目提供。
- 修复上游实例容量、删除与稳定 ID、零号 Universe、Cue ID 生成、嵌入灯具定义等问题。
- 输出池替换为拒绝硬件连接的实现；旧文件输出配置不加载。移除浏览器路径的 WSC 客户端依赖与 XML 解析器。
- 默认只支持 ASLS JSON showfile；不提供 XML 导入、旧控台连接界面或 Electron 安装包。
- 舞台排数可通过距台口列表扩展；数量通过复制／删除灯具调整，分区、排、组、序号和稳定 ID 可编辑。另存模板仍采用同一 showfile 格式。
- 加入本地启动脚本、静态服务器、测试及部署说明。保留的上游自动部署工作流不在本开发分支触发；本阶段没有发布到用户服务器。
