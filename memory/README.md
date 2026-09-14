# memory/ — 长期记忆库

> 由 AI 自主维护（AGENTS.md §3.1 自成长机制）. 用户可随时指出错误或要求补充.
> 这里是坑/实践/经验的**存放处**; AGENTS.md 只保留**索引与引用**，避免主文件膨胀.

## 文件导航

| 文件 | 主题 | 编号 |
|---|---|---|
| `practices.md` | 实践指南（AGENTS.md §4.1 原文） | 1-4 |
| `pitfalls-docker.md` | Docker 构建 / 镜像源 / 产物 / 运行时 | 11,12,14,15,16,18,22,58,59 |
| `pitfalls-server.md` | opencode 服务端 / 路径 / 沙箱 / CLI / 网络 | 1,2,3,13,21,24,25,26,30,31,32,33,41,44,48 |
| `pitfalls-frontend.md` | sumi 前端 / codeblitz / 布局 / chat | 19,20,27,28,29,34-39,42,43,45,46,47,50,51,54-57 |
| `pitfalls-extension.md` | vsix / 扩展 / 浏览器 / pdf / registry | 10,17,40,49,52,53 |
| `pitfalls-workflow.md` | git / 协作 / 工作流 / 杂项 | 4,5,6,7,8,9,23 |

## 维护规则

- **编号全局唯一 (1-59, 永不重编)**: 新增一条坑, 查 `pitfalls-*.md` 末尾编号用下一个;
  同主题的坑**按原文编号落到对应文件**, 不按序号重排.
- **新坑落文件原则**: 先看主题归属 (docker/server/frontend/extension/workflow), 归不进的
  去 `pitfalls-workflow.md` (杂项) 或新建 `pitfalls-<主题>.md` (需同步 AGENTS.md 索引).
- **引用写法**: 正文引用一条坑用 `memory/pitfalls-*.md#NN` (如 `pitfalls-server.md#21`).
- **AGENTS.md 同步**: 每次给 memory 增删条目, 同步更新 AGENTS.md §4 索引对应行
  (编号 + 一句话标题 + 文件链接), 保证索引与文件一一对应.
- **来源**: 2026-09 从 AGENTS.md §4 整体迁出 (编号/内容未改), 降低主文件维护压力.
