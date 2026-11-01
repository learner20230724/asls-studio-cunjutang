# 本地与服务器部署

## 构建

```sh
npm ci
npm run templates
npm test
npm run build
```

上传整个 `dist/`，不是仅上传 index.html。资源均本地提供，无需 CDN。

## 本机验收

```sh
node scripts/serve.mjs --port 4179
node scripts/serve.mjs --port 4180 --base /rehearsal
```

访问 `http://127.0.0.1:4179/` 或 `http://127.0.0.1:4180/rehearsal/`。自带服务器仅绑定本机，用于验收。

## Nginx 根路径

将 dist 内容上传到 `/var/www/cunjutang/`：

```nginx
server {
    listen 80;
    server_name rehearsal.example.com;
    root /var/www/cunjutang;
    index index.html;
    include /etc/nginx/mime.types;
    add_header X-Content-Type-Options nosniff;
    location / { try_files $uri $uri/ =404; }
}
```

替换实际域名及目录。生产建议通过现有服务器配置 HTTPS；本项目不自动申请证书或修改服务器。

## Nginx 子路径

将内容放到 `/var/www/html/rehearsal/`，在现有 server 中添加：

```nginx
location = /rehearsal { return 301 /rehearsal/; }
location /rehearsal/ {
    root /var/www/html;
    index index.html;
    try_files $uri $uri/ =404;
}
```

保留末尾斜杠。构建使用相对资源路径，无需 SPA 路由回退。缺少 JSON/JS 时应返回 404，不应返回 index.html。

## 发布前检查

- 新浏览器显示 215 盏、4 故障和 4 示例场景。
- 调光后刷新恢复；换浏览器导入 JSON 可重现练习。
- 手机底部导航可完成选灯、调光、场景操作，不依赖悬停。
- 网络请求只有本站静态资源，无 DMX / WSC 连接。
- 免登录，但没有服务器作业存储或跨设备同步。
- 升级前提醒学生导出。改变域名或协议后浏览器存储隔离，需要手动导入。

## 排错

- 黑屏：检查 WebGL 2、浏览器硬件加速，降低画质并查看控制台。
- 端口占用：修改 `--port`，不要停止其他项目的服务。
- JSON 返回 HTML：检查目录、子路径末尾斜杠以及错误的 SPA 回退规则。
- 保存失败：浏览器存储受限或配额不足，请立即导出备份。
- 开发源码更新：手动刷新。为避免 ASLS 全局单例重初始化冲突，已关闭 HMR。
