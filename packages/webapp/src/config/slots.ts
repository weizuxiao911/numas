/**
 * slot 配置 — src/config/slots.ts
 *
 * SOLO 模式 slot 命名: `solo.<列>.<区>`, 三列 sidebar | main | aside 从左到右.
 * 每列纵向 action / container / footer 三段; aside 中间段再左右分:
 *
 *   ┌────────────────┬──────────────────┬─────────────────────────────┐
 *   │ sidebar        │ main             │ aside                       │
 *   │  ├ action      │  ├ action        │  ├ action                   │
 *   │  ├ container   │  ├ container     │  ├ middle: sidebar│container │
 *   │  └ footer      │  └ footer        │  └ footer                   │
 *   └────────────────┴──────────────────┴─────────────────────────────┘
 *
 *   - sidebar.action:    左列顶部活动栏
 *   - sidebar.container: 左列容器区
 *   - sidebar.footer:    左列底部栏
 *   - main.action:       中列顶部活动栏
 *   - main.container:    中列容器区
 *   - main.footer:       中列底部栏
 *   - aside.action:      右列顶部活动栏
 *   - aside.browser:     右列中间段 (浏览器视图)
 *   - aside.footer:      右列底部栏
 *   (查看模式中间段直接用官方 SlotLocation.left / SlotLocation.main)
 *
 * 拓展注册时用同样 slot name (registerComponent 第 4 个参数 location).
 * 拓展不 import 本文件, 字符串字面量是协议约定.
 * SoloLayout 里 SlotRenderer slot={SOLO_SLOTS.X} 渲染.
 *
 * IDE 模式仍用 @opensumi/ide-core-browser 的 SlotLocation (top/left/main/...).
 */

/** SOLO 模式槽位 */
export const SOLO_SLOTS = {
  // 左列 sidebar
  SidebarAction: 'solo.sidebar.action',
  SidebarContainer: 'solo.sidebar.container',
  SidebarFooter: 'solo.sidebar.footer',
  // 中列 main
  MainAction: 'solo.main.action',
  MainContainer: 'solo.main.container',
  MainFooter: 'solo.main.footer',
  // 右列 aside (中间段: 查看模式左=官方 SlotLocation.left explorer, 右=官方 SlotLocation.main 编辑区)
  AsideAction: 'solo.aside.action',
  /** 浏览器视图 slot — 暂下线 (内置浏览器拓展重置中); 重做后由 asidetopbar 胶囊 + SoloLayout 重新挂载 */
  AsideBrowser: 'solo.aside.browser',
  AsideFooter: 'solo.aside.footer',
} as const;

export type SoloSlot = (typeof SOLO_SLOTS)[keyof typeof SOLO_SLOTS];
