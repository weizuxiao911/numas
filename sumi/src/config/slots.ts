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
 *   - aside.sidebar:     右列中间段左侧
 *   - aside.container:   右列中间段右侧 (容器区)
 *   - aside.footer:      右列底部栏
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
  // 右列 aside (中间段: 左 aside.sidebar | 右 aside.container)
  AsideAction: 'solo.aside.action',
  AsideSidebar: 'solo.aside.sidebar',
  AsideContainer: 'solo.aside.container',
  AsideFooter: 'solo.aside.footer',
} as const;

export type SoloSlot = (typeof SOLO_SLOTS)[keyof typeof SOLO_SLOTS];
