# CRT — CF-Server-Monitor 主题

用终端的方式看服务器：tmux 状态栏、htop 面板、top 表格、CLI 提示符，以及 sar 风格的曲线。
视觉与交互沿用 [monitor-theme-crt](https://github.com/kisukri/monitor-theme-crt) 的设计，数据层按
[CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor/) 的第三方主题 API 重写。

## 功能

- 首页 `#/`：tmux 顶栏 + htop 面板 / top 表格，可按分组、名称过滤、排序
- 详情页 `#/server/:id`：hostnamectl / lscpu / free / df / ss / vnstat / ping / nvidia-smi / iostat
- 实时数据只走 WebSocket，首页合并节流 1 秒一次
- 三网与自定义节点延迟/丢包，支持 `false` / `null` / `0` 三态
- 曲线：CPU、内存、网速、磁盘、Ping、丢包；范围 10 分钟 ~ 7 天（匿名用户 ≤ 24 小时）
- 主题配置保存在 `theme_options`，管理员可在 CLI 里运行 `settings` 修改
- 6 套配色：graphite / phosphor / amber / nord / dusk / paper

## 构建

```bash
npm install
cp .env.example .env    # 填写 API_BASE 等
npm run build
```

构建时会读取 `.env`、`.env.local`、`.env.[mode]`、`.env.[mode].local`；
真实环境变量（命令行或 CI Secrets）优先级高于文件。

| 变量 | 说明 |
| --- | --- |
| `API_BASE` | Worker 地址，多个用英文逗号分隔；写入 `<meta name="apiBase">`，并自动以 `https://` + `wss://` 加入 CSP `connect-src` |
| `TITLE` | 页面标题 |
| `BACKGROUND_IMAGE` | 背景图 |
| `CSP_API` | 追加到 `connect-src` 的域名（同样自动补 `wss://`） |
| `CSP_STATIC` | 追加到 script / style / img / font 指令的域名 |
| `VITE_DEV_PROXY_TARGET` | 本地 dev / preview 的代理目标，默认 `https://localhost:8787` |

`.env` 已在 `.gitignore` 中，不要提交真实 Worker 地址。

产物只有 `dist/index.html` 和 `dist/assets/`，直接作为主题目录提交到 Theme Store，
或用 GitHub Pages 托管后把 tree URL 填进后台「自定义主题」。

本地开发：

```bash
npm run dev
```

## 静态部署的环境变量

GitHub Actions 通过仓库 Secrets 注入（同名变量会覆盖 `.env`），不要把 Worker 地址写进仓库：

| Secret | 说明 |
| --- | --- |
| `API_BASE` | Worker 地址，多个用英文逗号分隔 |
| `TITLE` | 页面标题 |
| `BACKGROUND_IMAGE` | 背景图 |
| `CSP_API` | 追加到 `connect-src` 的 API 域名 |
| `CSP_STATIC` | 追加到静态资源指令的域名 |

推送到 `main` / `master` 后，workflow 会构建并**追加提交**到 `dist` 分支（保留历史，不 force push）。
在仓库 Settings → Pages 里选择 `dist` 分支作为托管源，并开启 Actions 的 `contents: write` 权限。

## 跨域部署

主题不在 Worker 同源域名下时，每个 Worker 都要在环境变量 `CORS_ALLOWED_ORIGINS` 里加入主题的
纯 origin（逗号分隔，不要带路径和结尾斜杠），例如：

```
https://localhost:5173,https://yourname.github.io
```

## 鉴权与 Turnstile

- 公开站匿名可浏览；私有站未登录会跳转 `/admin#/admin`
- Turnstile 开启时首次进入会显示人机验证，验证凭证缓存 1 小时并复用
- 管理入口只跳 `/admin#/admin`，主题内没有登录页和管理页

交付前请实测四种组合：公开/私有 × Turnstile 开/关。

## 数据消耗约定

- `/api/config`、`/api/servers` 每个页面生命周期只请求一次
- 首页只用 `subscribe=all` + `ids`；详情页只用 `subscribe=<id>`
- 首页卡片的延迟小图只用 `servers[].ping` / `servers[].loss`，不逐台查历史
- 历史曲线只走 `/api/history/all`，只在切换范围时请求；实时点由 WS 追加
- 页面隐藏时关闭 WebSocket，恢复时补一次 REST 再重连
- 断线指数退避，`frontend_ws_timeout_minutes` 到点弹窗询问

## 致谢

设计来自 [kisukri/monitor-theme-crt](https://github.com/kisukri/monitor-theme-crt)（MIT，见 `LICENSE`），
字体为 JetBrains Mono（OFL，见 `FONTS.md`）。
