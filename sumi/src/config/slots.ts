/**
 * slot 配置 — src/config/slots.ts
 *
 * SOLO 模式用自定义 slot name (Sidebar / Composer), 跟 IDE 模式标准 SlotLocation 区分.
 *   - Sidebar: Sidebar 拓展装这里
 *   - Composer: Chatbot 拓展装这里
 *
 * 拓展注册时用同样 slot name (registerComponent 第 4 个参数 location).
 * SoloLayout 里 SlotRenderer slot={SOLO_SLOTS.Sidebar} 渲染.
 *
 * IDE 模式仍用 @opensumi/ide-core-browser 的 SlotLocation (top/left/main/...).
 *
 * 命名: 纯功能名, 不加后缀 (chat / chatbot / dashboard / ide).
 */

/** SOLO 模式槽位 (chat 风格: 侧边 + 主区) */
export const SOLO_SLOTS = {
  Sidebar: 'sidebar',
  Composer: 'composer',
} as const;

export type SoloSlot = (typeof SOLO_SLOTS)[keyof typeof SOLO_SLOTS];
