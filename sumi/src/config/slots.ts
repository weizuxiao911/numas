/**
 * slot 配置 — src/config/slots.ts
 *
 * SOLO 模式用自定义 slot name, 跟 IDE 模式标准 SlotLocation 区分.
 *
 * 布局 (SoloLayout 三列, 中列上下分):
 *   ┌──────────┬─────────────────────────┬────────┐
 *   │ sidebar  │  action (顶部工具栏)      │        │
 *   │          ├─────────────────────────┤ drawer │
 *   │          │  main (对话主区)          │        │
 *   └──────────┴─────────────────────────┴────────┘
 *
 *   - Sidebar: Sidebar 拓展 (extensions/sidebar)
 *   - Action:  Action 拓展 (extensions/action) — 模式切换 / sidebar 展开 / 项目选择
 *   - Main:    Chatbot 拓展 (extensions/chatbot) — 消息流 + 输入区
 *   - Drawer:  右侧抽屉, 暂无拓展 (默认宽 0 / 完全隐藏)
 *   - User: 内嵌在 sidebar 底部 (用户信息)
 *
 * 拓展注册时用同样 slot name (registerComponent 第 4 个参数 location).
 * SoloLayout 里 SlotRenderer slot={SOLO_SLOTS.X} 渲染.
 *
 * IDE 模式仍用 @opensumi/ide-core-browser 的 SlotLocation (top/left/main/...).
 *
 * 命名: 纯功能名, 不加后缀 (sidebar / action / main / drawer).
 */

/** SOLO 模式槽位 */
export const SOLO_SLOTS = {
  Sidebar: 'sidebar',
  Action: 'action',
  Main: 'main',
  Drawer: 'drawer',
  /** 内嵌在 sidebar 底部: 用户信息 (头像 + 昵称, 登录入口) */
  User: 'user',
} as const;

export type SoloSlot = (typeof SOLO_SLOTS)[keyof typeof SOLO_SLOTS];
