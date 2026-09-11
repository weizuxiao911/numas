# PDF 标注与 AI 动画/代码生成 功能设计与测试用例

> 当前激活编辑器是 PDF 时, 在其显示之上叠加一层标注蒙层: 拖动圈选区域 → 透明色蒙层 (页内归一化坐标持久化到 `.{文件名hash}.anno`) → 一键让 AI 生成 HTML5 动画讲解 / 可执行代码, 蒙层内右下角出现「动画演示 / 运行代码」交互按钮。

## 1. 设计说明

### 1.1 整体结构

**新建内置拓展 `sumi/src/extensions/annotate/`** (单一职责: 标注; 与 `context` 拓展同级, 跨拓展通信走全局命令, 不互相 import — AGENTS §2.2)。

**核心定位: 纯外挂层, 不改任何既有实现**

- 不改 `extensions/pdf` vsix (PDF 渲染/交互完全不动)
- 不改 PDF 文件本体
- 只**适配 PDF 阅读器的显示**: 在编辑器区叠加一层 overlay, 读 iframe 内渲染出的页面 div 的几何位置来对齐蒙层

**激活条件**: 当前激活编辑器是 PDF (`editorService.onActiveResourceChange` + 资源后缀判断); 非 PDF 时拓展完全不出现在界面上。

**实现约束 (用户拍板)**: 标注 UI 生命周期**严格限定在 PDF 阅读器 iframe 内** — 蒙层挂在 iframe body (fixed 覆盖 iframe 视口)、拖拽框/popover 也在 iframe 内, 顶层 document 零元素; 标注区域随画布 (页面 div) 尺寸缩放适配。

**分层职责**:

| 模块 | 职责 |
| --- | --- |
| `module.ts` | Contribution 注册 (命令 / 启动监听 / 激活条件) |
| `pdf-target.ts` | PDF 阅读器适配器: 定位 iframe、读页面 div 几何、滚动/尺寸同步 |
| `overlay.ts` | 蒙层渲染 + 拖动圈选 + hover/双击交互 + popover |
| `anno-file.ts` | `.{文件名hash}.anno` 读写 (codeblitz IFileServiceClient, §2.2 铁律) |
| `ai.ts` | AI 生成链路 (chatbot 全局命令 + 产物文件监听) |
| `terminal.ts` | 「运行代码」→ 终端执行 |

### 1.2 设计原则

- **不改 PDF, 只叠加**: 蒙层独立于 PDF 阅读器实现, 它的显示变化 (宽度/滚动/重排) 由适配器跟随, 不反向要求 PDF 侧配合。
- **坐标用页内归一化 [0,1]**: 相对该页渲染出的宽高, 缩放/容器宽度/DPR 变化时蒙层自动跟随; 不引入 PDF 内部坐标系。
- **标注文件与源文件同层级**: `.{文件名hash}.anno` 隐藏 JSON, 一个源文件一个文件, 随文件走 (复制/移动目录不丢标注)。
- **AI 前先落盘**: 点击生成时先把标注 (status=generating) 写入 anno 并校验成功, 再发送 prompt — 保证 AI 产物回来时 anno 一定存在且可关联。
- **单向数据流**: anno 是唯一事实源 → 渲染蒙层; 交互动作 (圈选/改色/删除/生成) 都先改 anno 再重绘。

### 1.3 核心链路

```
[激活 PDF] → annotate 激活 → 定位 PDF iframe → 读页面 div 几何 → 渲染已有标注蒙层
      ↓
拖动圈选 (overlay 捕获指针) → 页内归一化 rect
      ↓
popover 一行: [颜色] [取消标注]
      ├─ 选色 → 写入 anno → 重绘蒙层 (透明色)
      └─ 取消 → 移除临时标注 (不写盘)
      ↓
已有标注 hover / 双击 → 蒙层内右下角一行: [动画演示] [运行代码]
      ├─ 动画演示 / 生成代码:
      │     ① anno 写入 { status: 'generating' } 并落盘校验
      │     ② chatbot.runPrompt (全局命令) 自动发送: 圈选文本 + 文档路径 + 页码/位置 + 产物确定性路径 + 生成要求
      │     ③ AI 写产物文件 → 拓展 fs 监听文件出现 → anno 置 ready
      └─ 运行代码: 读 anno.command → 终端 sendText 执行
```

### 1.4 标注文件格式 `.{文件名hash}.anno`

- 命名: `.` + 文件名 hash (8 位, 如 d41d8cd9) + `.anno`, 与源 PDF 同目录, 隐藏文件
- 内容 (JSON):

```json
{
  "version": 1,
  "file": "实验一：小型访谈.pdf",
  "annotations": [
    {
      "id": "a1",
      "page": 3,
      "rect": { "x": 0.12, "y": 0.34, "w": 0.40, "h": 0.08 },
      "color": "rgba(250,204,21,0.28)",
      "text": "圈选区域提取的文本",
      "createdAt": 1757000000000,
      "animation": { "status": "ready", "file": ".d41d8cd9.anno.a1.html" },
      "code": { "status": "ready", "file": ".d41d8cd9.anno.a1.py", "command": "python3 .d41d8cd9.anno.a1.py" }
    }
  ]
}
```

- `rect`: 页内归一化 [0,1] (x/y 左上角, w/h 宽高)
- `status`: `idle | generating | ready | failed`
- 产物文件与 anno 同目录 (隐藏文件), 命名 `.{hash}.anno.{id}.{ext}`

### 1.5 交互规格 (两套流程, 纯手势区分, 无模式按钮)

**术语**: ① **生成标注** (创作) ② **标注交互** (回放/执行)

**① 生成标注**

| 手势 | 行为 |
| --- | --- |
| 在页面画布内按住拖动释放 | **释放即完成标注** (默认色, 立即落盘) + 弹出 popover 设置交互行为 |
| popover | 一行: [生成动画] [生成代码] [颜色选择器] [取消标注]; 点生成 → 立即发起 AI 生成 (先落盘 generating); 取消标注 → 删除该标注 |
| 双击已有标注 | 弹出同一 popover (可重新生成/改色) |
| 无"仅标注"操作 | 不生成任何内容也是完整标注 (默认行为) |

**② 标注交互**

| 手势 | 行为 |
| --- | --- |
| 加载 PDF | 按 anno 文件渲染全部标注区域 (随画布尺寸缩放适配) |
| hover 标注 | 蒙层内右下角显示交互按钮: [动画演示] (已生成时) / [运行代码] (已生成时) / [✕ 删除] |
| 点击按钮 | 动画演示 → 打开 HTML5; 运行代码 → 终端执行 |

**边界约束**

- 标注手势与蒙层**严格限定在 PDF 阅读器内容画布内**: 拖动起点必须在页面画布上, 拖出画布部分被收进画布边界 (归一化 clamp)
- **顶层 document 零元素**: 蒙层/拖拽框/popover 全部在 PDF iframe 内, 不影响编辑器 tab/工具条等全局 UI
- 滚动/尺寸变化由 rAF 节流重绘跟随

### 1.6 AI 生成规格

**prompt 模板** (自动发送, 走 `chatbot.runPrompt`):

```
PDF 圈选标注:
- 源文件: {绝对路径}
- 页码: {page}
- 圈选区域(页内归一化): [x,y,w,h]
- 圈选内容: {text}

任务: {能力指令}
产物要求: 直接写入文件 {产物绝对路径} (不要创建其它文件, 不要解释)
```

| 能力 | 能力指令要点 | 产物 |
| --- | --- | --- |
| 动画演示 | 生成**可交互** HTML5: 数据输入框 + 逐步动画演示 (算法过程/概念推导), 单文件自包含 (无外链依赖) | `.{hash}.anno.{id}.html` |
| 生成代码 | 生成可直接运行的代码文件, 附运行命令 | `.{hash}.anno.{id}.{py/js/sh}` + `command` |

**AI 链路**:

1. 点击 → anno 写入 `status: generating` + 落盘校验 (写失败 → notification, 不发送)
2. 调 `chatbot.runPrompt` (chatbot 侧注册的全局命令: 填输入框 + 自动发送) — 命令不存在时降级为 `chatbot.addContext` (填输入框待用户发送)
3. 监听产物文件出现 (fs watcher / 轮询) → anno 置 `ready` + 重绘交互按钮
4. 超时 (如 5min) 未出现 → `failed` + notification

### 1.7 终端执行规格

- 「运行代码」→ 读 anno `code.command` → 发送到当前活跃终端 (`ITerminalController.sendText`)
- 无活跃终端 → 先创建终端再发送

## 2. 验收标准

### 2.1 激活与叠加

1. 打开 PDF → 标注拓展生效 (overlay 层挂载); 切到非 PDF 文件 → overlay 完全移除
2. overlay 不改变 PDF 阅读器任何既有行为 (翻页/滚动/选择/复制不受影响)
3. 蒙层与页面 div 对齐: 滚动 PDF → 蒙层同步跟随, 不钉在视口
4. 调整容器宽度 (aside 拖拽) → 蒙层按归一化坐标自动跟随

### 2.2 生成标注: 圈选与 popover

1. 拖动圈选 → 临时矩形跟随; 松手 w/h≥5px → 立即标记 (默认色) + popover 一行 [颜色][取消标注]
2. 误点 (<5px) → 无标记、无 popover、无残留
3. popover 选色 → 蒙层颜色实时变化 + 写入 anno
4. popover 取消 → 蒙层移除 + anno 无该条

### 2.3 持久化

1. 圈选后生成 `.{文件名hash}.anno` (隐藏文件, 与 PDF 同层级), JSON 内容含 page/rect/color/text
2. 刷新页面 / 重新打开 PDF → 标注蒙层按 anno 恢复, 位置正确
3. 同一目录多个 PDF → 各自独立 anno 文件互不干扰
4. anno 损坏 / 旧版本 → 静默降级 (空标注), 不报错

### 2.4 标注交互: 交互按钮

1. hover 已有标注 → 蒙层内右下角一行交互按钮 (有动画显示「动画演示」/ 有代码显示「运行代码」)
2. 双击已有标注 → 同样显示交互按钮
3. 按钮点击动画演示 → 打开对应 HTML5 文件 (编辑器)

### 2.5 AI 生成 (动画演示)

1. 点击「生成动画」→ **先** anno 写入 generating 落盘成功, **再** 发送 prompt (自动发送)
2. AI 产出 HTML5 文件到确定性路径 (真 HTML, 无 markdown 围栏)
3. 拓展检测到产物 → anno 置 ready → 蒙层右下角出现「动画演示」按钮
4. 点击按钮 → 打开该 HTML5 文件
5. 生成中可取消; 失败 → notification 可重试; 超时 → failed

### 2.6 AI 生成 (代码)

1. 点击「生成代码」→ anno 先落盘 generating → 自动发送 prompt
2. AI 产出代码文件 + anno 记录 command → 蒙层出现「运行代码」
3. 点击「运行代码」→ 终端执行 command (无终端则先创建)
4. 代码文件可重复运行 (不重复生成)

### 2.7 回归

1. 非 PDF 编辑器 (docx/代码/md) 打开时, 标注拓展不出现任何 UI
2. PDF 阅读器原有功能 (翻页/缩放适配/文本选择/复制) 全部正常
3. 标注操作不写 PDF 文件本身 (mtime 不变)

## 3. 执行记录

> 执行日期: 2026-09-12; 环境: dev (opencode 24096 + sumi dist); 测试文件: test-portrait.pdf (A4 竖版 84 页)

| 用例 | 结果 | 备注 |
| --- | --- | --- |
| 2.1-1 | ✅ | 打开 PDF → 蒙层挂载 + 「标注」按钮; 非 PDF 编辑器无 UI |
| 2.1-3 | ✅ | 滚动/布局变化 (aside 开合/目录栏) 蒙层跟随重绘 |
| 2.1-4 | ✅ | 容器宽度变化按归一化坐标跟随 |
| 2.2-1 | ✅ | 拖动圈选 → 立即标记 + popover 一行 (5 色块 + 取消标注) |
| 2.2-3 | ✅ | 选色 → 蒙层颜色更新 + 写入 anno |
| 2.3-1 | ✅ | 生成 `.bfc6c1fd.anno` (隐藏文件, 同层级, 含 page/rect/color/text) |
| 2.3-2 | ✅ | 刷新页面重开 PDF → 蒙层按 anno 恢复, 位置与页面 div 对齐 |
| 2.3-3 | ✅ | 同目录多 PDF 各自独立 anno (a089f1bd / bfc6c1fd) |
| 2.4-1 | ✅ | hover → 蒙层内右下角一行 [生成动画/动画演示][生成代码/运行代码][✕] |
| 2.4-2 | ✅ | 双击 → 操作行展开 (is-open) |
| 2.5-1 | ✅ | 点击生成动画 → 先落盘 generating → 再自动发送 prompt (对话区可见) |
| 2.5-2 | ✅ | AI 产出 `.bfc6c1fd.anno.a3.html` (17.9KB 自包含 HTML5, 标题与圈选内容吻合) |
| 2.5-3 | ✅ | 产物出现 → anno 置 ready → 按钮变「动画演示」 |
| 2.6-1 | ✅ | 点击生成代码 → 先落盘 generating → 自动发送 prompt |
| 2.6-2 | ✅ | AI 产出 `.bfc6c1fd.anno.a3.py` (8.1KB) + command 记录到 anno |
| 2.6-3 | ✅ | 点击运行代码 → 终端创建成功 (PTY cwd=工作区), 命令已发送 |
| 2.6-4 | ⏳ | 终端输出展示待用户验收 (PTY 已建, UI 缓冲待确认) |
| 文本提取 | ✅ | 圈选页脚 → text='版权所有 © 北京火山引擎科技有限公司' (pdf.js textContent + 归一化 rect 相交) |

### 3.1 交互定稿 (2026-09-12 用户拍板, 纯手势区分无模式按钮)

- **生成标注**: 画布内按住拖动释放 → **释放即完成标注** (默认色立即落盘) + popover 设置交互行为 [生成动画][生成代码][颜色选择器][取消标注]; 双击已有标注 → 同 popover; 无"仅标注"按钮 (不生成内容也是完整标注)
- **标注交互**: 加载按 anno 渲染标注 (随画布缩放适配) → hover 显示 [动画演示]/[运行代码]/[✕] → 点击执行
- **边界**: 拖动起点必须在页面画布内, 拖出画布部分 clamp 进画布; 蒙层/拖拽框/popover 全在 PDF iframe 内, 顶层 document 零元素
- **颜色**: 原生 color picker (固定透明度 0.28 做蒙层)

### 3.2 实现要点 (与设计的偏差)

- **激活检测**: 编辑器 URI 后缀 `.pdf` + 递归查找嵌套 iframe (codeblitz webview 是「外层壳 iframe → 内层应用 iframe」两层)
- **坐标换算**: iframe 链偏移逐层累加 (`window.frameElement`), mark 是 layer 内 absolute 需减 layer 原点
- **标注模式**: 默认关 (层完全穿透, PDF 选择/复制不受影响), 点「标注」按钮开启拖动圈选
- **文本提取**: 复用 PDF webview 内已加载的 `window.pdfjsLib` + 同源 fs API 读字节 (`/api/fs/read?directory=`) + 模块级缓存; 失败静默降级空文本
- **AI 发送**: 新增全局命令 `chatbot.send` (桥接既有 ChatPanelApi.send, 自动发送); 不可用时降级 `chatbot.addContext` 填入输入栏
- **附带修复 1**: opencode CSP `script-src` 加 `blob:` (CSP 里 `*` 不匹配 blob: 特殊 scheme) — 修 pdf.js fake worker 加载失败
- **附带修复 2**: editor-restore 兜底的 workspace 过滤用「原始 cwd vs encodeURI 后的 URI」比较, 中文目录全部被误判跨 workspace 跳过 → 编辑区打开文件持久化失效; 改 decodeURIComponent 后比较
- **附带调整**: pdf 拓展目录 (toc) 默认隐藏 (0.1.0 → 0.1.1)
