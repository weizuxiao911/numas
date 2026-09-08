/**
 * Sidebar 对外 API — commands/sidebar.ts
 *
 * 跨拓展共享的 sidebar 状态契约 (位于 commands 契约层,
 * 见 docs/AI 工作台总体设计.md §3.1):
 *   extensions → commands → service → codeblitz/opencode
 *
 * Sidebar 拓展 (业务承载) mount 时通过 registerSidebarApi 把自身交互能力
 * 暴露到 commands/sidebar (api owner), 卸载时清空. 消费方 (ActionBar / 未来的拓展)
 * 调 getSidebarApi() 拿快照 + 调方法, 不直连 Sidebar.tsx, 不破 §2.2 铁律.
 *
 * 不挂 window 全局, 模块级单例 register/get.
 * 历史曾放 extensions/sidebar/commands/sidebarApi, 后按文档精神统一迁到 commands/ 全局契约层.
 */

export interface SidebarApi {
  /** 当前是否折叠 (sidebar 宽度 = 1px) */
  readonly collapsed: boolean;
  /** 当前 sidebar 宽 (px) */
  readonly width: number;
  /** 折叠: width 设为 1, 持久化 collapsed=true, 保留 savedWidth 用于后续 expand */
  collapse(): void;
  /** 展开: 恢复到 savedWidth (默认 256), 持久化 collapsed=false */
  expand(): void;
  /** 切换 collapsed 态 */
  toggle(): void;
  /** 直接 set width (拖动条用) */
  setWidth(n: number): void;
  /** 订阅 collapsed 变化 (返回 unsubscribe 函数) */
  onChange(cb: (s: { collapsed: boolean; width: number }) => void): () => void;
}

let registered: SidebarApi | null = null;

export function registerSidebarApi(api: SidebarApi | null): void {
  registered = api;
}

export function getSidebarApi(): SidebarApi | null {
  return registered;
}
