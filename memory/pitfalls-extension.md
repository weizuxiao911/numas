## 避坑指南 — vsix / 扩展 / 浏览器 / pdf / registry

#### 10. 内置浏览器默认 `<embed>` 渲染 PDF 不可靠 (依赖 Chrome PDF 插件)

- **问题描述**: headless Chrome 无 PDFium, 部分 Chrome flag 禁用 PDF viewer, `<embed src=blob type=application/pdf>` 渲染失败显示空白.
- **复现路径**: 启用 PDF plugin 禁用的 Chrome.
- **解决方案**: 默认 `pdfMode='pdfjs'`, 走 pdf.js + canvas 渲染, 跨环境可靠. worker 从 unpkg/jsdelivr CDN 拉, CSP `worker-src * blob:` 已透传.

#### 17. "简化"框架适配逻辑丢字段语义 → 资源路由回归 (explorer 图标全 404)

- **问题描述**: 静态资源 provider 的 resolveStaticResource "简化"成一律 `registryBaseUrl + path`, 丢掉原实现的 `uri.authority` 分流语义 → codeblitz 市场资产 (alipay CDN 的 vsicons 图标, uri 自带 authority) 被指到本地 registry → 图标全 404.
- **复现路径**: 改 kt-ext 静态解析后不对比旧 dist 视觉/网络行为.
- **解决方案**: 改动前先理解字段语义 (authority = 外部市场 host, 无 authority = 本地 registry 扩展); 改动后用旧 dist 页面做网络级对照 (图标请求 host), 再下"简化"结论.

#### 40. customEditor `Webview is disposed` 白屏: 卸载 dispose 与 `$resolveCustomTextEditor` 在途 RPC 竞态

- **现象**: docx/paper/html viewer 偶发白屏; console `Uncaught (in promise) Error: Webview is disposed at resolveCustomEditor (show-docx extension.js)`.
- **根因**: `sumi/src/patches/patch-custom-editor.ts` 的 `__paperUnmount` 直接 `webview.remove()/dispose()`; 而 `IFrameWebviewPanel.remove()` 触发 `onRemove` → `webview.dispose() + $onDidDisposeWebviewPanel(id)` (扩展侧 panel 标记 disposed). 若扩展侧 `$resolveCustomTextEditor` RPC 还在途 (慢 worker / 快速切 tab), resolveCustomEditor 读到已 dispose 的 panel 抛错 → viewer 白屏.
- **解决方案**: `__paperTryMount` 记录 `info.resolvePromise = Promise.resolve($resolveCustomTextEditor(...))`; `__paperUnmount` 等 `Promise.race([resolvePromise, timeout(8s)])` 落地再 `remove()/dispose()`; 同时立即 `removeAttribute('data-paper-mount-key')` 防同 key 重开复用待销毁容器.
- **改动文件**: `sumi/src/patches/patch-custom-editor.ts`.
- **排查方法**: 日志里 `__paperUnmount` 后紧跟 `[ce-ui] useEffect fire onCustomEditor <viewType>` (重开) + `Webview is disposed` = 此竞态; 本地快 (无慢 worker) 难复现, 需远程慢网络或快速关/开 tab.

#### 49. 大 PDF (30MB+) 加载: webview 自己 fetch 裸字节, 不要 host 读 + postMessage

- **现象**: pdf vsix 首版由 host 读整文件 (`vscode.workspace.fs.readFile` → 失败则 `/file/content` base64 JSON) 再 `postMessage({bytes})` 给 webview → 30MB 文件时结构化克隆卡主线程, base64 路径峰值内存 ~100MB+ (atob + 逐字节循环).
- **正解 (对齐 deff9df 旧实现 + 在树 fs provider)**: host 只算**相对路径 + x-opencode-directory** 注入 shell HTML; webview 自己 `fetch('/api/fs/read/<rel>', {headers})` → `arrayBuffer()` 裸字节 → pdf.js 直接吃 (typed array transfer 进 worker, 无额外拷贝). 渲染用骨架 (全量 div 定尺寸) + 可见页 ±5 懒加载 canvas (300 页大书只有几个 canvas).
- **ext host 陷阱**: `__APP_CONFIG__` / `__APP_OPENCODE_RUNTIME__` 在 ext host 里**拿不到** (同 §4.2 #48 坑 2); registry 基址在 webview 侧读 `window.parent.__APP_CONFIG__`, API 地址用**同源相对 URL** (dev 走 webpack proxy, 生产同源).
- **排查方法**: 大文件卡顿先看数据流有几份拷贝 (host 读/克隆/slice/worker); `bytes.slice(0)` 这类防御性拷贝在确认不复用后要删; 验证用真实大文件 (如 29M 教材 PDF: 274 页, 加载后 canvas opacity=1).

#### 52. vsix 多市场合并 (内置 /extensions + 外部 gateway): 契约差异 + 来源路由 keying

- **现象**: `--registry` 指向 gateway (`.../api/v2/agent-registry/plugins`) 时 vsix 阅读器 (pdf/docx/html 等) 全部加载不到, PDF 显示成二进制; 且内置 pdf 的静态资源请求被错误指到网关 (`.../plugins/numas.pdf-0.1.0/dist/extension.js` → net::ERR_FAILED).
- **根因 (两个)**:
  1. **metadata 端点契约不同**: 内置 `/extensions` 是 `GET /extensions/metadata.json`; gateway 是 `GET <base>/plugins/metadata` (带 `/plugins` 的 base 则是 `<base>/metadata`). 前端只拉 `/metadata.json` → gateway 404 → 元数据为空.
  2. **来源路由 keying 错**: `sourceByExtId` 按 `extension.name` (如 `pdf`) 记录, 但静态资源 uri 首段是**带版本 id** (`kt-ext:///numas.pdf-0.1.0` → `numas.pdf-0.1.0`) → 查不到来源 → 落到 `registryBaseUrl` (此时=网关) → 404.
- **gateway vsix 契约 (2026-09 实测)**:
  - metadata: `<base>/plugins/metadata` → JSON 数组, 形状同内置 (extension/packageJSON/uri/...), uri 带 authority: `kt-ext://<host>/api/v2/agent-registry/plugins/<publisher>.<name>-<version>/file`
  - 文件: `<base>/plugins/<id>/file/<relPath>` (如 `/file/dist/extension.js` → 200 application/javascript)
  - **无** `/metadata.json` / `/manifest.json` / `/vsix/<name>` (这些是内置市场契约)
  - authority 形态 uri 由 `resolveStaticResource` 的 authority 分支处理 (保 host + scheme), 不需要来源 map
- **解决方案**:
  - metadata 拉取按序尝试 3 端点: `<base>/metadata.json` → `<base>/metadata` → `<base>/plugins/metadata`; 空数组 = 端点存在但无扩展 (不再试下一个)
  - `sourceByExtId` 双 key 记录: `extension.name` + uri 首段 id (`kt-ext:///<id>` 形态, 正则 `^kt-ext:\/\/\/([^/]+)`; 带 authority 的返回空走 authority 分支)
  - 失败源指数退避重试 (1s/3s/7s × 3) + 后台补拉 (5 轮 × 10s, metadata 0→N 时 reload 一次)
  - 服务端 `ui.ts` 注入 `registryBaseUrls` 数组 (内置 `/extensions` 恒有 + `--registry` 外部追加去重), 前端多源合并按 name 去重 (内置优先)
- **排查方法**: ① 区分「metadata 拉不到」vs「metadata 有但文件 404」: 看 network 里 `metadata.json` 404 还是 `<id>/file/...` 404; ② 网关端点探测顺序: `curl <base>/plugins/metadata` (无 /plugins 的 base) 或 `<base>/metadata` (带 /plugins 的 base); ③ 来源路由 bug 的指纹: 内置扩展的 extension.js 请求指向外部网关 = sourceByExtId 查不到 → 查 uri 首段 id 与 map key 是否一致 (name ≠ versioned id).
- **注**: `dev.js` 默认不再传 `--extensions-dir` (需 `NUMAS_EXTENSIONS_DIR` 显式指定); Docker 镜像默认 registry = `https://gateway.cloudlab.top/api/v2/agent-registry/plugins`.

#### 53. vsix 拓展 webview 资源不能手拼 registryBase 路径: 网关/内置两种市场形态不同, 必须用 asWebviewUri

- **现象**: pdf 拓展在网关市场下白屏/显示 "webview bundle 加载失败" 或 pdf.js "无法加载: Invalid Root reference."; 本地内置市场 (dev) 却正常 — 典型「本地好, 部署服务器坏」.
- **根因**: pdf 拓展 shell HTML 手拼 `${registryBase}/${VSIX_ID}/dist/webview.js` + `${registryBase}/${VSIX_ID}/pdfjs/...` — 这只匹配**内置市场**路径形态 (`/extensions/<id>/<file>`); 网关形态是 `<base>/plugins/<id>/file/<file>` (多一段 `/file`), 手拼必 404 → webview bundle / pdf.js / worker 全加载失败.
  - 实测: `.../plugins/numas.pdf-0.1.0/dist/webview.js` → 404; `.../plugins/numas.pdf-0.1.0/file/dist/webview.js` → 200.
- **解决方案 (标准 vscode 姿势, docx/html 等第三方拓展同款)**:
  ```ts
  webviewPanel.webview.options = {
    enableScripts: true, retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist'), ...],
  }
  const jsUri = webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.js')).toString()
  const pdfjsBase = webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'pdfjs')).toString().replace(/\/+$/, '')
  // shell: <script src="${jsUri}"> + window.__PDF_CFG__.pdfjsBase = pdfjsBase
  ```
  `asWebviewUri` 走 codeblitz 静态资源解析 (sumi `resolveStaticResource`), 自动适配两种市场路径 (内置无 authority → `<base>/<id>/...`; 网关带 authority → `<host>/<path>/file/...`), 不依赖 `__APP_CONFIG__` (ext host 拿不到).
- **排查方法**: ① 网络面板看 webview bundle/pdfjs 请求 URL 与 status: 手拼的 URL 与 metadata.uri 形态不一致 = 此坑; ② 对照第三方拓展 (show-docx 等) 的 `asWebviewUri` 用法; ③ 若 webview bundle 正常但 pdf.js 报 "Invalid Root reference" 且 pdfinfo 也报语法错 = 文件本身损坏, 非拓展 bug.
- **附带**: `extensions/scripts/copy-vsix-to-home.js` (打包后 cp 到 `~/.numas/extensions`) 已删除, 打包只产出 `registry/vsix/*.vsix`; 运行时扩展来源走 `--extensions-dir` / `--registry` 配置.

#### 63. 网关市场下 vsix webview 子资源被 CSP 拦: cspSource 带 path 不匹配

- **现象**: docx 阅读器在网关市场下裸 HTML 全露 (hidden 面板全显示、工具栏透明); 本地内置市场正常.
- **根因**: 网关的 `webview.cspSource` 是带 path 的源 (`https://gateway.cloudlab.top/api/v2/agent-registry/plugins`), 浏览器按路径匹配失败 → `<link>` 样式表/codicon 字体被拦. 本地 `/extensions` 形态恰好能匹配.
- **复现**: 网关模式下打开 docx → console 报 stylesheet violates CSP; 页面无样式.
- **解决方案**: 扩展 shell 的 CSP 把资源实际 origin 显式加进 style-src/font-src/img-src (`new URL(styleUri).origin`) — host source 不限路径.
- **排查方法**: 「本地好、网关坏」+ 无样式/资源 404 的观感 → 先看 console 的 CSP violation 与 cspSource 的实际取值.
