/**
 * Solo 组 — SOLO 布局 (solo.* 槽位) 相关模块
 *
 *   sidebar/: 左列 (solo.sidebar.action / .container)
 *   main/:    中列 (solo.main.action)
 *   aside/:   右列 (solo.aside.action)
 *
 * 注: chatbot (solo.main.container) 独立在 extensions/chat;
 *     文件类功能在 extensions/file (picker / ops / open-type).
 * 各组仍有自己的 barrel, 这里再做一级汇总 (多 export).
 */
export * from './sidebar';
export * from './main';
export * from './aside';
