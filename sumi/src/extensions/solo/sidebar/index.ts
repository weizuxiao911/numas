/**
 * Sidebar 组 — 左列 (solo.sidebar.*) 相关模块
 *
 *   topbar: sidebar.action (模式切换 + 折叠)
 *   sessions:    sidebar.container (新建会话 + 历史会话)
 *
 * 每个子目录仍是独立 BrowserModule; 这里只做分组 barrel, 多 export 汇总.
 */
export * from './topbar';
export * from './sessions';
