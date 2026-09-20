# 开源贡献业务链路设计

## 核心流程

1. 用户访问“活动任务页”（内容参考 https://antdesign.beta.oscollege.net/os/compete/87, 风格参考 https://workshop.cloudlab.top/），卡片显示活动任务，点击卡片的【领取任务】按钮，进入“开源贡献 AI 工作台”页面（携带任务项目、issue等信息）。使用如下真实项目作为验证：
  - https://github.com/antgroup/vsag/issues/2862
  - https://github.com/antgroup/vsag/issues/2865
  - https://github.com/antgroup/vsag/issues/2867
  - https://github.com/antgroup/vsag/issues/2869
  - https://github.com/antgroup/vsag/issues/2870
  - https://github.com/antgroup/vsag/issues/2871
  - https://github.com/jeandle/jeandle-jdk/issues/620
  - https://github.com/jeandle/jeandle-jdk/issues/621  

2. 进入“开源贡献 AI 工作台”后先检测是否安装 numas 应用程序（通过 numas://scheme 方式唤起），如果未安装提供下载地址，引导安装，直到可以访问接入；如果已安装，接入本地服务器，显示 AI 工作台，实现按 packages/codeblitz 完成，先不用管项目初始化问题，确保“开源贡献 AI 工作台”正常接入到本地 numas 应用程序，将其作为服务器端！

## 注意事项

1. “开源贡献 AI 工作台”是纯 web IDE 项目，部署在平台侧， 通过 numas://scheme 方式唤起用户本地的 numas 作为服务器端。（前后端分离）
2. 如果用户本地未下载 numas 应用程序，需提供下载地址，并引导安装，直到“开源贡献 AI 工作台”可以接入本地 numas 应用程序 API 接口。
3. “活动任务页”（:5173，实现在 test/demo 下）和“开源贡献 AI 工作台”（:7788, 实现在 pacakges/codeblitz 下，使用 webpack 运行，单独打包成 site 产物，补充前置 numas://scheme 检测和下载引导，直到IDE 接入本地 numas 服务器）是两个单独的 web 网站。边界职责说明： 
  - “活动任务页”： 显示业务交互，按参考完成独立站点，终点是“领取任务”按钮
  - “开源贡献 AI 工作台”： 是从点击“领取任务”按钮，到加载 IDE 为止
  - 本地 numas 服务器： 后台运行，仅提供 API 接口

--- 

# packages/codeblitz 改造

> 改造当且仅当访问codeblitz（:7788）URL 参数是repo={远程git仓库地址}时生效

1. 维持现有流程：认领任务（test/demo，端口5173） → 检测或引导下载，直到启动本地 numas 服务，codeblitz 与本地 numas 正常通信（packages/codeblitz，端口7788）
2. 检查 codeblitz 请求 URL 是否携带 repo 参数，如果是切换成 IDE 模式
3. 其他我们边做边调整，我觉得可以后你负责维护功能设计到文档(docs/AI工作台适配开源项目贡献 SPEC.md)

---

## 功能设计 (AI 维护)

### 1. URL `?repo=` → 强制 IDE 模式 (2026-09-20 定稿)

- **触发**: codeblitz 页面 URL 携带 `repo` 参数 (远程 git 仓库地址; 由活动任务页【领取任务】注入)
- **行为**: 加载时强制 `ide` 模式, 并写入 `localStorage.NUMAS_MODE` (后续无 repo 打开也保持 IDE)
- **无 repo**: 按 `localStorage.NUMAS_MODE` / 默认 `solo`
- **参数处理**: `repo` / `issue` 保留在 URL, 不做一次性清理 (供 AI 工作台后续读取 issue/项目信息)
- **手动切换**: 模式切换按钮保留, 不锁定
- **实现**: `packages/codeblitz/src/App.tsx` — `readStoredAppMode()` 前置 URL 判定 (`urlRepoMode()`)
- **与门控关系**: 模式判定在模块加载时完成, 与 Gate (numas 接入门控) 无耦合; 接入成功后按判定模式渲染